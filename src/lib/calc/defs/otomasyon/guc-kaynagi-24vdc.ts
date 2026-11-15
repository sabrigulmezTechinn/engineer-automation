/**
 * KAPSAM 5.4 — 24 V DC güç kaynağı yük hesabı.
 *
 *   ΣP = Σ Pᵢ                         (akım girilirse Pᵢ = 24 V · Iᵢ)
 *   P_eş = ΣP · kₑ                    (eşzamanlı yük, kₑ: eşzamanlılık katsayısı 0…1)
 *   P_top = ΣP · kₑ · k_r             (tasarım gücü, k_r: rezerv katsayısı ≥ 1)
 *   I = P / 24 V
 * Önerilen kaynak: aşağıdaki tipik DIN ray kaynak akımlarından I_top'u karşılayan en küçüğü.
 *
 * IEC 61131-2'ye göre 24 V DC beslemenin çalışma aralığı ctx.limits.otomasyon.besleme24V'ten okunur
 * (20,4–28,8 V; kaynakları config dosyasında).
 */
import { latexAuto, latexNum, latexQty } from "@/lib/calc/latex";
import { formatQuantity } from "@/lib/units";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";

/**
 * Tipik 24 V DIN ray güç kaynağı anma akımları, A. Standart bir seri DEĞİLDİR; yaygın bir üreticinin
 * DIN ray serilerindeki 24 V modellerinin anma akımlarıdır (veri sayfalarından alındı):
 * - Mean Well HDR-15-24: 0,63 A; HDR-30-24: 1,5 A; HDR-60-24: 2,5 A; HDR-100-24: 3,83 A;
 *   HDR-150-24: 6,25 A (230 V AC girişte; 115 V AC'de 5,31 A)
 *   https://www.meanwell.com/Upload/PDF/HDR-15/HDR-15-SPEC.PDF (HDR-30, HDR-60, HDR-100, HDR-150 aynı yolda)
 * - Mean Well NDR-75-24: 3,2 A; NDR-120-24: 5 A; NDR-240-24: 10 A; NDR-480-24: 20 A
 *   https://www.meanwell.com/Upload/PDF/NDR-75/NDR-75-SPEC.PDF (NDR-120, NDR-240, NDR-480 aynı yolda)
 * - Mean Well SDR-960-24: 40 A
 *   https://www.meanwell.com/Upload/PDF/SDR-960/SDR-960-SPEC.PDF
 */
export const TIPIK_KAYNAK_AKIMLARI = [0.63, 1.5, 2.5, 3.2, 3.83, 5, 6.25, 10, 20, 40] as const;

export type YukMod = "guc" | "akim";

const MOD_OPTIONS: { value: YukMod; label: string }[] = [
  { value: "guc", label: "Yükleri güç olarak gir (W)" },
  { value: "akim", label: "Yükleri 24 V'taki akım olarak gir" },
];

const MESSAGES = {
  sifirYuk: "Toplam yük sıfır: en az bir yükün gücü veya akımı sıfırdan büyük olmalıdır.",
  listeUstu: (i: string, iMax: string) =>
    `Gerekli kaynak akımı (${i}) tipik tek kaynak değerlerinin en büyüğünü (${iMax}) aşıyor: paralel çalışabilen kaynaklar veya yükleri birden çok besleme devresine bölmeyi düşünün.`,
  tipikDeger:
    "Önerilen kaynak akımı, yaygın DIN ray kaynak serilerinin 24 V anma akımlarından (0,63 A … 40 A) seçildi; bunlar tipik değerlerdir, standart bir seri değildir. Kendi üreticinizin kataloğundan bu akımı karşılayan modeli seçin.",
  tolerans: (min: string, max: string) =>
    `IEC 61131-2'ye göre 24 V DC besleme gerilimi yük uçlarında ${min}…${max} (−%15/+%20) aralığında kalmalıdır; kablo gerilim düşümünü buna göre sınırlayın.`,
  yukGerilimiIcinde: (u: string, min: string, max: string) =>
    `Yük klemensindeki gerilim (${u}) IEC 61131-2 çalışma aralığında (${min}…${max}).`,
  yukGerilimiAlt: (u: string, min: string) =>
    `Yük klemensindeki gerilim (${u}) IEC 61131-2 alt sınırının (${min}) altında: kablo kesitini büyütün, hattı kısaltın veya kaynak çıkış gerilimini yükseltin.`,
  yukGerilimiUst: (u: string, max: string) =>
    `Yük klemensindeki gerilim (${u}) IEC 61131-2 üst sınırının (${max}) üstünde: kaynak çıkış gerilimini düşürün.`,
} as const;

const REF_61131 = {
  standard: "IEC 61131-2",
  title: "Programlanabilir denetleyiciler — Bölüm 2: Donanım gereksinimleri ve testler",
  note: "24 V DC besleme: anma değeri ve çalışma aralığı (−%15/+%20)",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`guc-kaynagi-24vdc: "${key}" sayı değil`);
  return v;
}

function list(inputs: ComputeInputs, key: string): number[] {
  const v = inputs[key];
  if (!Array.isArray(v)) throw new Error(`guc-kaynagi-24vdc: "${key}" liste değil`);
  return v;
}

/** Yük güçleri (W): güç modunda doğrudan, akım modunda Pᵢ = U_anma · Iᵢ */
function yukGucleri(inputs: ComputeInputs, ctx: CalcContext): number[] {
  const u = ctx.limits.otomasyon.besleme24V.anma;
  return (inputs.mod as YukMod) === "akim" ? list(inputs, "yukAkim").map((i) => u * i) : list(inputs, "yukGuc");
}

function crossChecks(inputs: ComputeInputs, ctx: CalcContext): Check[] {
  const toplam = yukGucleri(inputs, ctx).reduce((a, b) => a + b, 0);
  return toplam > 0 ? [] : [{ level: "hata", message: MESSAGES.sifirYuk }];
}

// Adım ve mesaj yardımcıları
const qP = (w: number) => latexAuto(w, "guc");
const qI = (a: number) => latexAuto(a, "akim");
const qU = (v: number) => latexQty(v, "V");
const fV = (v: number) => formatQuantity(v, "V");
const fA = (a: number) => formatQuantity(a, "A");
/** Uzun listelerde toplamı kısaltır: ilk 6 terim, sonra "\ldots" */
function toplamLatex(terms: string[]): string {
  return terms.length <= 6 ? terms.join(" + ") : `${terms.slice(0, 6).join(" + ")} + \\ldots`;
}

export const gucKaynagi24Vdc: CalcDefinition = {
  id: "5.4",
  slug: "guc-kaynagi-24vdc",
  category: "otomasyon",
  title: "24 V DC güç kaynağı yük hesabı",
  description:
    "Pano yüklerinin güç veya akımlarını girerek eşzamanlılık ve rezerv katsayılarıyla gerekli 24 V DC kaynak akımını bulun; tipik DIN ray kaynak değerlerinden bir üstünü önerir ve IEC 61131-2 besleme toleransını hatırlatır.",
  formulas: [
    { label: "Bağlı yük", latex: "\\Sigma P = \\sum_i P_i \\quad (P_i = 24\\,\\mathrm{V} \\cdot I_i)" },
    { label: "Tasarım gücü", latex: "P_{top} = \\Sigma P \\cdot k_e \\cdot k_r" },
    { label: "Gerekli kaynak akımı", latex: "I_{top} = \\frac{P_{top}}{24\\,\\mathrm{V}}" },
  ],
  references: [REF_61131],
  inputs: [
    { kind: "select", key: "mod", label: "Yük girişi", options: MOD_OPTIONS, default: "guc" },
    {
      kind: "numberList",
      key: "yukGuc",
      label: "Yük güçleri",
      symbol: "P_i",
      dimension: "guc",
      defaultUnit: "W",
      units: ["W", "mW", "kW"],
      default: [12, 6, 6, 10, 18],
      min: 0,
      help: "Her yükün 24 V'tan çektiği güç, noktalı virgülle ayrılmış (ör. PLC CPU; I/O modülleri; HMI; sensör ve valfler).",
      visibleWhen: { key: "mod", equals: "guc" },
    },
    {
      kind: "numberList",
      key: "yukAkim",
      label: "Yük akımları (24 V'ta)",
      symbol: "I_i",
      dimension: "akim",
      defaultUnit: "mA",
      units: ["mA", "A"],
      default: [500, 250, 250, 420, 750],
      min: 0,
      help: "Her yükün 24 V'tan çektiği akım, noktalı virgülle ayrılmış.",
      visibleWhen: { key: "mod", equals: "akim" },
    },
    {
      kind: "number",
      key: "ke",
      label: "Eşzamanlılık katsayısı",
      symbol: "k_e",
      dimension: "oran",
      defaultUnit: "fraction",
      units: ["fraction", "percent"],
      default: 0.8,
      min: 0,
      minExclusive: true,
      max: 1,
      help: "Aynı anda çalışan yükün bağlı yüke oranı (tüm yükler sürekli çalışıyorsa 1).",
    },
    {
      kind: "number",
      key: "kr",
      label: "Rezerv katsayısı",
      symbol: "k_r",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 1.25,
      min: 1,
      help: "Gelecekteki genişleme ve kaynağın tam yükte çalışmaması için pay (ör. 1,25 → %25 rezerv).",
    },
    {
      kind: "number",
      key: "uYuk",
      label: "Yük klemensindeki gerilim (isteğe bağlı)",
      symbol: "U_{\\text{yük}}",
      dimension: "gerilim",
      defaultUnit: "V",
      units: ["V"],
      min: 0,
      optional: true,
      help: "Kablo gerilim düşümünden sonra en uzaktaki cihazın klemensindeki gerilim; IEC 61131-2 çalışma aralığına göre denetlenir.",
    },
  ],
  outputs: [
    { key: "pToplam", label: "Bağlı yük toplamı", symbol: "\\Sigma P", dimension: "guc", defaultUnit: "W" },
    { key: "pEs", label: "Eşzamanlı yük", symbol: "P_{e}", dimension: "guc", defaultUnit: "W" },
    { key: "pTasarim", label: "Tasarım gücü (rezervli)", symbol: "P_{top}", dimension: "guc", defaultUnit: "W" },
    { key: "iEs", label: "Eşzamanlı yük akımı (24 V)", symbol: "I_e", dimension: "akim", defaultUnit: "A" },
    { key: "iTasarim", label: "Gerekli kaynak akımı (rezervli)", symbol: "I_{top}", dimension: "akim", defaultUnit: "A" },
    {
      key: "iKaynak",
      label: "Önerilen kaynak anma akımı (tipik değer)",
      symbol: "I_{kaynak}",
      dimension: "akim",
      defaultUnit: "A",
      autoUnit: false,
    },
    {
      key: "yuklenme",
      label: "Kaynağın eşzamanlı yükte yüklenmesi",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
    },
  ],

  validate: (inputs, ctx) => crossChecks(inputs, ctx),

  compute: (inputs, ctx) => {
    const blocking = crossChecks(inputs, ctx);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const { anma: u, min: uMin, max: uMax } = ctx.limits.otomasyon.besleme24V;
    const mod = inputs.mod as YukMod;
    const guc = yukGucleri(inputs, ctx);
    const ke = num(inputs, "ke");
    const kr = num(inputs, "kr");
    const steps: Step[] = [];
    const checks: Check[] = [];

    const pToplam = guc.reduce((a, b) => a + b, 0);
    const pEs = pToplam * ke;
    const pTasarim = pEs * kr;
    const iEs = pEs / u;
    const iTasarim = pTasarim / u;
    const outputs: Record<string, number> = { pToplam, pEs, pTasarim, iEs, iTasarim };

    if (mod === "akim") {
      const akim = list(inputs, "yukAkim");
      const iToplam = akim.reduce((a, b) => a + b, 0);
      steps.push({
        label: "Bağlı yük akımı",
        latex: `\\Sigma I = ${toplamLatex(akim.map(qI))} = ${qI(iToplam)}`,
      });
      steps.push({ label: "Bağlı yük", latex: `\\Sigma P = ${qU(u)} \\cdot \\Sigma I = ${qU(u)} \\cdot ${qI(iToplam)} = ${qP(pToplam)}` });
    } else {
      steps.push({ label: "Bağlı yük", latex: `\\Sigma P = ${toplamLatex(guc.map(qP))} = ${qP(pToplam)}` });
    }
    steps.push({ label: "Eşzamanlı yük", latex: `P_e = \\Sigma P \\cdot k_e = ${qP(pToplam)} \\cdot ${latexNum(ke)} = ${qP(pEs)}` });
    steps.push({ label: "Tasarım gücü", latex: `P_{top} = P_e \\cdot k_r = ${qP(pEs)} \\cdot ${latexNum(kr)} = ${qP(pTasarim)}` });
    steps.push({ label: "Eşzamanlı yük akımı", latex: `I_e = \\frac{P_e}{U} = \\frac{${qP(pEs)}}{${qU(u)}} = ${qI(iEs)}` });
    steps.push({
      label: "Gerekli kaynak akımı",
      latex: `I_{top} = \\frac{P_{top}}{U} = \\frac{${qP(pTasarim)}}{${qU(u)}} = ${qI(iTasarim)}`,
    });

    // Kayan nokta payı: tam 2,5 A gereken yükte 2,5000000000000004 A yüzünden 3,2 A önerilmesin.
    const iKaynak = TIPIK_KAYNAK_AKIMLARI.find((i) => i >= iTasarim * (1 - 1e-12));
    if (iKaynak === undefined) {
      checks.push({ level: "uyari", message: MESSAGES.listeUstu(fA(iTasarim), fA(TIPIK_KAYNAK_AKIMLARI[TIPIK_KAYNAK_AKIMLARI.length - 1])) });
    } else {
      outputs.iKaynak = iKaynak;
      outputs.yuklenme = iEs / iKaynak;
      steps.push({
        label: "Önerilen kaynak (tipik değerlerden bir üstü)",
        latex: `I_{kaynak} = ${latexQty(iKaynak, "A")} \\geq ${qI(iTasarim)}`,
      });
      steps.push({
        label: "Kaynağın yüklenmesi",
        latex: `\\frac{I_e}{I_{kaynak}} = \\frac{${qI(iEs)}}{${latexQty(iKaynak, "A")}} = ${latexQty(iEs / iKaynak, "percent")}`,
      });
      checks.push({ level: "bilgi", message: MESSAGES.tipikDeger });
    }

    if (inputs.uYuk === undefined) {
      checks.push({ level: "bilgi", message: MESSAGES.tolerans(fV(uMin), fV(uMax)), reference: REF_61131 });
    } else {
      const uYuk = num(inputs, "uYuk");
      const tol = 1e-9 * u;
      if (uYuk < uMin - tol) {
        checks.push({ level: "uyari", message: MESSAGES.yukGerilimiAlt(fV(uYuk), fV(uMin)), reference: REF_61131 });
      } else if (uYuk > uMax + tol) {
        checks.push({ level: "uyari", message: MESSAGES.yukGerilimiUst(fV(uYuk), fV(uMax)), reference: REF_61131 });
      } else {
        checks.push({ level: "ok", message: MESSAGES.yukGerilimiIcinde(fV(uYuk), fV(uMin), fV(uMax)), reference: REF_61131 });
      }
    }

    return { outputs, steps, checks };
  },
};
