/**
 * KAPSAM 5.1 — Analog ölçekleme (4-20 mA, 0-10 V, ham sayım).
 *
 * Doğrusal ölçekleme: y = (x − x₁)·(y₂ − y₁)/(x₂ − x₁) + y₁ ve tersi.
 * x: sinyal (4-20 mA'da akım, 0-10 V'ta gerilim, ham sayımda birimsiz ADC değeri),
 * y: mühendislik değeri (kullanıcının proses biriminde, birimsiz girilir).
 *
 * Sinyal tipi ve yön tek bir select'te birleştirildi: `visibleWhen` yalnızca tek bir select'e
 * bakabildiği için "sinyal tipi = 4-20 mA VE yön = sinyal → mühendislik" koşulu iki ayrı select ile
 * ifade edilemiyor (sözleşme önerisi raporda).
 *
 * NAMUR NE 43 (sınırlar ctx.limits.otomasyon.namurNe43, SI/A):
 * - 4–20 mA: nominal ölçüm aralığı
 * - 3,8–4 mA ve 20–20,5 mA: ölçüm aralığı içinde ama nominalin dışında (proses değeri ölçek dışı) → uyarı
 * - 3,6–3,8 mA ve 20,5–21 mA: ne geçerli ölçüm ne tanımlı arıza (geçiş bölgesi) → uyarı
 * - ≤ 3,6 mA veya ≥ 21 mA: arıza sinyali. Sinyal → mühendislik yönünde "hata" (validate): arıza
 *   sinyali ölçüm bilgisi taşımaz, ölçeklenmiş bir değer göstermek yanıltıcı olur. Mühendislik → sinyal
 *   yönünde ise hesaplanan akım gösterilir ve "uyari" verilir (verici bu değeri ölçüm olarak iletemez).
 */
import { latexNum, latexQty } from "@/lib/calc/latex";
import { formatQuantity, fromSI } from "@/lib/units";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";

export type AnalogMod = "ma-muh" | "muh-ma" | "v-muh" | "muh-v" | "ham-muh" | "muh-ham";
type Sinyal = "ma" | "v" | "ham";

const MOD_OPTIONS: { value: AnalogMod; label: string }[] = [
  { value: "ma-muh", label: "4-20 mA → mühendislik değeri" },
  { value: "muh-ma", label: "Mühendislik değeri → 4-20 mA" },
  { value: "v-muh", label: "0-10 V → mühendislik değeri" },
  { value: "muh-v", label: "Mühendislik değeri → 0-10 V" },
  { value: "ham-muh", label: "Ham sayım → mühendislik değeri" },
  { value: "muh-ham", label: "Mühendislik değeri → ham sayım" },
];

/** Sinyal tanımları (SI): 4–20 mA (IEC 60381-1) ve 0–10 V. Bunlar sınır değil, sinyalin tanımıdır. */
const SINYAL_ARALIGI = { ma: [4e-3, 20e-3], v: [0, 10] } as const;

/** Sinyal girdisi/çıktısının anahtarı ve gösterim birimi */
const SINYAL_ANAHTARI: Record<Sinyal, string> = { ma: "x_ma", v: "x_v", ham: "x_ham" };
const SINYAL_BIRIMI: Record<Sinyal, string> = { ma: "mA", v: "V", ham: "unitless" };

const MESSAGES = {
  sifirSinyalAraligi: "Sinyal aralığının iki ucu (x₁ ve x₂) eşit olamaz: ölçekleme tanımsızdır (x₂ − x₁ = 0).",
  sifirMuhendislikAraligi:
    "Mühendislik aralığının iki ucu (y₁ ve y₂) eşit olamaz: ölçek tanımsızdır (y₂ − y₁ = 0).",
  arizaAlt: (q: string, L: NamurMetni) =>
    `${q} NAMUR NE 43'e göre arıza sinyalidir (≤ ${L.arizaAlt}): verici arızası, kopuk hat veya besleme kaybı. Bu sinyal ölçüm bilgisi taşımaz; ölçekleme yapılmadı.`,
  arizaUst: (q: string, L: NamurMetni) =>
    `${q} NAMUR NE 43'e göre arıza sinyalidir (≥ ${L.arizaUst}): verici arızası veya döngüde kısa devre. Bu sinyal ölçüm bilgisi taşımaz; ölçekleme yapılmadı.`,
  belirsiz: (L: NamurMetni) =>
    `Sinyal NE 43 ölçüm aralığının (${L.olcumAlt}…${L.olcumUst}) dışında, arıza eşiklerinin (${L.arizaAlt} / ${L.arizaUst}) içinde: tanımlı bir ölçüm ya da arıza sinyali değildir. Alıcı bu değeri güvenilir ölçüm saymamalı; kabloyu ve vericiyi kontrol edin.`,
  asimAlt: (L: NamurMetni) =>
    `Sinyal 4 mA'nın altında ama NE 43 ölçüm aralığında (≥ ${L.olcumAlt}): proses değeri ölçek aralığının alt ucunun altında. Değer doğrusal olarak uzatılarak hesaplandı.`,
  asimUst: (L: NamurMetni) =>
    `Sinyal 20 mA'nın üstünde ama NE 43 ölçüm aralığında (≤ ${L.olcumUst}): proses değeri ölçek aralığının üst ucunun üstünde. Değer doğrusal olarak uzatılarak hesaplandı.`,
  geriAriza: (L: NamurMetni) =>
    `Hesaplanan akım NE 43 arıza bölgesinde (≤ ${L.arizaAlt} veya ≥ ${L.arizaUst}): verici bu proses değerini ölçüm olarak iletemez (ölçüm sinyali ${L.olcumAlt} / ${L.olcumUst} değerinde doyar) ve alıcı bu akımı arıza olarak yorumlar. Ölçek aralığını genişletin.`,
  geriBelirsiz: (L: NamurMetni) =>
    `Hesaplanan akım NE 43 ölçüm aralığının (${L.olcumAlt}…${L.olcumUst}) dışında, arıza eşiklerinin içinde: verici bu değeri üretmez ve alıcı güvenilir ölçüm saymaz. Ölçek aralığını genişletin.`,
  geriAsim: (L: NamurMetni) =>
    `Proses değeri ölçek aralığının (y₁…y₂) dışında: hesaplanan akım 4–20 mA dışında ama NE 43 ölçüm aralığında (${L.olcumAlt}…${L.olcumUst}). NE 43 uyumlu verici bu sınırlara kadar sürer, ötesinde doyar.`,
  gerilimDisi:
    "Sinyal 0–10 V aralığının dışında: proses değeri ölçek aralığının dışında olabilir ya da kablo/kaynak hatası vardır. Değer doğrusal olarak uzatıldı; analog girişin aşım bölgesini ve doyma değerini modül veri sayfasından kontrol edin.",
  geriGerilimDisi:
    "Hesaplanan gerilim 0–10 V aralığının dışında: proses değeri ölçek aralığının (y₁…y₂) dışında, analog çıkış bu değeri üretemeyebilir.",
  hamDisi:
    "Ham değer x₁…x₂ aralığının dışında: değer doğrusal olarak uzatıldı. Analog modülün aşım/taşma bölgesini (ör. S7'de 27648 üstü) veri sayfasından kontrol edin.",
  geriHamDisi:
    "Proses değeri ölçek aralığının (y₁…y₂) dışında: hesaplanan ham değer x₁…x₂ aralığının dışında.",
} as const;

const NAMUR_REF = {
  standard: "NAMUR NE 43",
  title: "Dijital vericilerin arıza bilgisi için sinyal seviyelerinin standartlaştırılması",
  note: "Ölçüm aralığı 3,8–20,5 mA; arıza sinyali ≤ 3,6 mA veya ≥ 21 mA",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`analog-olcekleme: "${key}" sayı değil`);
  return v;
}

function parseMod(mod: AnalogMod): { sinyal: Sinyal; ileri: boolean } {
  const [a, b] = mod.split("-");
  return a === "muh" ? { sinyal: b as Sinyal, ileri: false } : { sinyal: a as Sinyal, ileri: true };
}

/** Kayan nokta payıyla karşılaştırma: 3,6 mA girdisi SI'da 0,0036000000000000003 A olur. */
const EPS = 1e-9;
const le = (a: number, b: number) => a <= b + EPS * Math.max(Math.abs(a), Math.abs(b));
const ge = (a: number, b: number) => a >= b - EPS * Math.max(Math.abs(a), Math.abs(b));

type NamurBolgesi = "ariza-alt" | "belirsiz" | "asim-alt" | "nominal" | "asim-ust" | "ariza-ust";

/** 4-20 mA akımının NE 43 bölgesi (sınırlar dahil: ≤ 3,6 mA arıza, ≥ 3,8 mA ölçüm, ≤ 20,5 mA ölçüm, ≥ 21 mA arıza) */
function namurBolgesi(x: number, ctx: CalcContext): NamurBolgesi {
  const n = ctx.limits.otomasyon.namurNe43;
  const [x1, x2] = SINYAL_ARALIGI.ma;
  if (le(x, n.arizaAlt)) return "ariza-alt";
  if (ge(x, n.arizaUst)) return "ariza-ust";
  if (!ge(x, n.olcumAlt) || !le(x, n.olcumUst)) return "belirsiz";
  if (!ge(x, x1)) return "asim-alt";
  if (!le(x, x2)) return "asim-ust";
  return "nominal";
}

function aralik(inputs: ComputeInputs, sinyal: Sinyal): [number, number] {
  if (sinyal === "ham") return [num(inputs, "x1_ham"), num(inputs, "x2_ham")];
  const [a, b] = SINYAL_ARALIGI[sinyal];
  return [a, b];
}

/** Çapraz kontroller ("hata" seviyesinde hesap yapılmaz) */
function crossChecks(inputs: ComputeInputs, ctx: CalcContext): Check[] {
  const { sinyal, ileri } = parseMod(inputs.mod as AnalogMod);
  const checks: Check[] = [];
  if (sinyal === "ham" && num(inputs, "x1_ham") === num(inputs, "x2_ham")) {
    checks.push({ level: "hata", message: MESSAGES.sifirSinyalAraligi });
  }
  if (num(inputs, "y1") === num(inputs, "y2")) {
    checks.push({ level: "hata", message: MESSAGES.sifirMuhendislikAraligi });
  }
  if (sinyal === "ma" && ileri) {
    const x = num(inputs, "x_ma");
    const bolge = namurBolgesi(x, ctx);
    const q = mAMetni(x);
    if (bolge === "ariza-alt") checks.push({ level: "hata", message: MESSAGES.arizaAlt(q, namurMetni(ctx)), reference: NAMUR_REF });
    if (bolge === "ariza-ust") checks.push({ level: "hata", message: MESSAGES.arizaUst(q, namurMetni(ctx)), reference: NAMUR_REF });
  }
  return checks;
}

/** Mesaj metni için mA gösterimi, ör. "3,5 mA". */
function mAMetni(xA: number): string {
  return formatQuantity(fromSI(xA, "mA"), "mA", { significant: 6 });
}

/** NE 43 sınırlarının mesaj metni (config'teki değerlerden), ör. { arizaAlt: "3,6 mA", … } */
type NamurMetni = Record<"arizaAlt" | "olcumAlt" | "olcumUst" | "arizaUst", string>;
function namurMetni(ctx: CalcContext): NamurMetni {
  const n = ctx.limits.otomasyon.namurNe43;
  return {
    arizaAlt: mAMetni(n.arizaAlt),
    olcumAlt: mAMetni(n.olcumAlt),
    olcumUst: mAMetni(n.olcumUst),
    arizaUst: mAMetni(n.arizaUst),
  };
}

/** Sinyal → mühendislik yönündeki sinyal kontrolleri (arıza bölgesi validate'te reddedilir) */
function ileriKontroller(sinyal: Sinyal, x: number, x1: number, x2: number, ctx: CalcContext): Check[] {
  if (sinyal === "ma") {
    switch (namurBolgesi(x, ctx)) {
      case "belirsiz":
        return [{ level: "uyari", message: MESSAGES.belirsiz(namurMetni(ctx)), reference: NAMUR_REF }];
      case "asim-alt":
        return [{ level: "uyari", message: MESSAGES.asimAlt(namurMetni(ctx)), reference: NAMUR_REF }];
      case "asim-ust":
        return [{ level: "uyari", message: MESSAGES.asimUst(namurMetni(ctx)), reference: NAMUR_REF }];
      default:
        return [];
    }
  }
  const disarida = !ge(x, Math.min(x1, x2)) || !le(x, Math.max(x1, x2));
  if (!disarida) return [];
  return [{ level: "uyari", message: sinyal === "v" ? MESSAGES.gerilimDisi : MESSAGES.hamDisi }];
}

/** Mühendislik → sinyal yönünde hesaplanan sinyalin kontrolleri */
function geriKontroller(sinyal: Sinyal, x: number, x1: number, x2: number, ctx: CalcContext): Check[] {
  if (sinyal === "ma") {
    switch (namurBolgesi(x, ctx)) {
      case "ariza-alt":
      case "ariza-ust":
        return [{ level: "uyari", message: MESSAGES.geriAriza(namurMetni(ctx)), reference: NAMUR_REF }];
      case "belirsiz":
        return [{ level: "uyari", message: MESSAGES.geriBelirsiz(namurMetni(ctx)), reference: NAMUR_REF }];
      case "asim-alt":
      case "asim-ust":
        return [{ level: "uyari", message: MESSAGES.geriAsim(namurMetni(ctx)), reference: NAMUR_REF }];
      default:
        return [];
    }
  }
  const disarida = !ge(x, Math.min(x1, x2)) || !le(x, Math.max(x1, x2));
  if (!disarida) return [];
  return [{ level: "uyari", message: sinyal === "v" ? MESSAGES.geriGerilimDisi : MESSAGES.geriHamDisi }];
}

// Adım yardımcıları: kartlarla aynı sabit birim (sinyal çıktılarında otomatik birim kapalı), 6 anlamlı basamak
const SIG = { significant: 6 } as const;
const qx = (v: number, sinyal: Sinyal) => latexQty(v, SINYAL_BIRIMI[sinyal], SIG);
const qy = (v: number) => latexNum(v, SIG);
/** Çıkarma işleminde negatif ikinci terim parantezlenir */
const par = (s: string, v: number) => (v < 0 ? `(${s})` : s);
const farkX = (a: number, b: number, s: Sinyal) => `${par(qx(a, s), a)} - ${par(qx(b, s), b)}`;
const farkY = (a: number, b: number) => `${par(qy(a), a)} - ${par(qy(b), b)}`;
/** Toplamada negatif terim: "+ (-5)" yerine "- 5" */
const arti = (s: string, v: number) => (v < 0 ? `- ${s.replace(/^-/, "")}` : `+ ${s}`);

export const analogOlcekleme: CalcDefinition = {
  id: "5.1",
  slug: "analog-olcekleme",
  category: "otomasyon",
  title: "Analog ölçekleme (4-20 mA, 0-10 V, ham sayım)",
  description:
    "Analog sinyali (4-20 mA, 0-10 V veya PLC'nin ham sayım değeri) mühendislik değerine ya da mühendislik değerini sinyale doğrusal olarak ölçekleyin. 4-20 mA'da sinyal NAMUR NE 43 ölçüm ve arıza bölgelerine göre denetlenir.",
  formulas: [
    { label: "Sinyal → mühendislik değeri", latex: "y = \\frac{(x - x_1)\\,(y_2 - y_1)}{x_2 - x_1} + y_1" },
    { label: "Mühendislik değeri → sinyal", latex: "x = \\frac{(y - y_1)\\,(x_2 - x_1)}{y_2 - y_1} + x_1" },
    { label: "Ölçek yüzdesi", latex: "\\%\\,\\text{ölçek} = \\frac{x - x_1}{x_2 - x_1} \\cdot 100" },
  ],
  references: [
    NAMUR_REF,
    {
      standard: "IEC 60381-1",
      title: "Proses kontrol sistemleri için analog sinyaller — Bölüm 1: Doğru akım sinyalleri",
      note: "4–20 mA sinyal aralığı",
    },
  ],
  inputs: [
    { kind: "select", key: "mod", label: "Dönüşüm", options: MOD_OPTIONS, default: "ma-muh" },
    {
      kind: "number",
      key: "x_ma",
      label: "Sinyal akımı",
      symbol: "x",
      dimension: "akim",
      defaultUnit: "mA",
      units: ["mA", "uA", "A"],
      default: 12,
      min: 0,
      help: "Ölçülen döngü akımı. NE 43'e göre ≤ 3,6 mA ve ≥ 21 mA arıza sinyalidir.",
      visibleWhen: { key: "mod", equals: "ma-muh" },
    },
    {
      kind: "number",
      key: "x_v",
      label: "Sinyal gerilimi",
      symbol: "x",
      dimension: "gerilim",
      defaultUnit: "V",
      units: ["V", "mV"],
      default: 7.5,
      visibleWhen: { key: "mod", equals: "v-muh" },
    },
    {
      kind: "number",
      key: "x1_ham",
      label: "Ham değer alt ucu",
      symbol: "x_1",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 0,
      help: "Sinyal aralığının alt ucuna karşılık gelen ham sayım (ör. Siemens S7: 0; 12 bit ADC: 0).",
      visibleWhen: { key: "mod", equals: ["ham-muh", "muh-ham"] },
    },
    {
      kind: "number",
      key: "x2_ham",
      label: "Ham değer üst ucu",
      symbol: "x_2",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 27648,
      help: "Sinyal aralığının üst ucuna karşılık gelen ham sayım (ör. Siemens S7: 27648; 12 bit ADC: 4095).",
      visibleWhen: { key: "mod", equals: ["ham-muh", "muh-ham"] },
    },
    {
      kind: "number",
      key: "x_ham",
      label: "Ham değer",
      symbol: "x",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 20736,
      visibleWhen: { key: "mod", equals: "ham-muh" },
    },
    {
      kind: "number",
      key: "y1",
      label: "Mühendislik değeri alt ucu (proses biriminde)",
      symbol: "y_1",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 0,
      help: "Sinyalin alt ucuna (4 mA, 0 V veya x₁) karşılık gelen değer, kendi proses biriminizde (bar, °C, m³/h, % …).",
    },
    {
      kind: "number",
      key: "y2",
      label: "Mühendislik değeri üst ucu (proses biriminde)",
      symbol: "y_2",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 10,
      help: "Sinyalin üst ucuna (20 mA, 10 V veya x₂) karşılık gelen değer. Ters etkili ölçekte y₂ < y₁ olabilir.",
    },
    {
      kind: "number",
      key: "y",
      label: "Mühendislik değeri (proses biriminde)",
      symbol: "y",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 6.5,
      visibleWhen: { key: "mod", equals: ["muh-ma", "muh-v", "muh-ham"] },
    },
  ],
  outputs: [
    { key: "y", label: "Mühendislik değeri (proses biriminde)", symbol: "y", dimension: "boyutsuz", defaultUnit: "unitless", significant: 6 },
    { key: "x_ma", label: "Sinyal akımı", symbol: "x", dimension: "akim", defaultUnit: "mA", units: ["mA", "uA", "A"], autoUnit: false },
    { key: "x_v", label: "Sinyal gerilimi", symbol: "x", dimension: "gerilim", defaultUnit: "V", units: ["V", "mV"], autoUnit: false },
    { key: "x_ham", label: "Ham değer", symbol: "x", dimension: "boyutsuz", defaultUnit: "unitless", significant: 6 },
    { key: "oran", label: "Ölçek yüzdesi", dimension: "oran", defaultUnit: "percent", units: ["percent", "fraction"] },
  ],

  validate: (inputs, ctx) => crossChecks(inputs, ctx),

  compute: (inputs, ctx) => {
    const blocking = crossChecks(inputs, ctx).filter((c) => c.level === "hata");
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const { sinyal, ileri } = parseMod(inputs.mod as AnalogMod);
    const [x1, x2] = aralik(inputs, sinyal);
    const y1 = num(inputs, "y1");
    const y2 = num(inputs, "y2");
    const steps: Step[] = [];
    const outputs: Record<string, number> = {};
    let checks: Check[];

    if (ileri) {
      const x = num(inputs, SINYAL_ANAHTARI[sinyal]);
      const y = ((x - x1) * (y2 - y1)) / (x2 - x1) + y1;
      const oran = (x - x1) / (x2 - x1);
      outputs.y = y;
      outputs.oran = oran;
      steps.push({
        label: "Mühendislik değeri",
        latex:
          `y = \\frac{(x - x_1)\\,(y_2 - y_1)}{x_2 - x_1} + y_1 = ` +
          `\\frac{(${farkX(x, x1, sinyal)}) \\cdot (${farkY(y2, y1)})}{${farkX(x2, x1, sinyal)}} ${arti(qy(y1), y1)} = ${qy(y)}`,
      });
      steps.push({
        label: "Ölçek yüzdesi",
        latex: `\\frac{x - x_1}{x_2 - x_1} = \\frac{${farkX(x, x1, sinyal)}}{${farkX(x2, x1, sinyal)}} = ${latexQty(oran, "percent", SIG)}`,
      });
      checks = ileriKontroller(sinyal, x, x1, x2, ctx);
    } else {
      const y = num(inputs, "y");
      const x = ((y - y1) * (x2 - x1)) / (y2 - y1) + x1;
      const oran = (y - y1) / (y2 - y1);
      outputs[SINYAL_ANAHTARI[sinyal]] = x;
      outputs.oran = oran;
      steps.push({
        label: sinyal === "ma" ? "Sinyal akımı" : sinyal === "v" ? "Sinyal gerilimi" : "Ham değer",
        latex:
          `x = \\frac{(y - y_1)\\,(x_2 - x_1)}{y_2 - y_1} + x_1 = ` +
          `\\frac{(${farkY(y, y1)}) \\cdot (${farkX(x2, x1, sinyal)})}{${farkY(y2, y1)}} ${arti(qx(x1, sinyal), x1)} = ${qx(x, sinyal)}`,
      });
      steps.push({
        label: "Ölçek yüzdesi",
        latex: `\\frac{y - y_1}{y_2 - y_1} = \\frac{${farkY(y, y1)}}{${farkY(y2, y1)}} = ${latexQty(oran, "percent", SIG)}`,
      });
      checks = geriKontroller(sinyal, x, x1, x2, ctx);
    }

    return { outputs, steps, checks };
  },
};
