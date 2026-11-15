/**
 * KAPSAM 3.5 — Motor verimi ve enerji tasarrufu.
 *
 * Aynı mil gücünü veren iki motorun şebekeden çektiği güçler P₁ = P/η₁ ve P₂ = P/η₂'dir.
 *   ΔP = P·(1/η₁ − 1/η₂), yıllık enerji tasarrufu ΔE = ΔP·t, maliyet tasarrufu = ΔE·c,
 *   basit geri ödeme süresi = fiyat farkı / yıllık maliyet tasarrufu.
 * SI: ΔE [J] = ΔP [W] · t [s], c [TL/J] (arayüzde TL/kWh), maliyet [TL].
 *
 * IE sınıfı tespiti bu sürümde yok: (EU) 2019/1781 Ek I tablosu birincil kaynaktan indirilemedi.
 */
import { latexAuto, latexNum, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, Step } from "@/lib/calc/types";
import { num, optNum, qFrac } from "./ortak";

const WHERE = "motor-verimi-enerji-tasarrufu";

/** 366 günlük yıl, saniye */
const LEAP_YEAR_S = 366 * 24 * 3600;

const MESSAGES = {
  noSaving: "Yeni motorun verimi mevcut motordan yüksek değil: enerji tasarrufu yok, geri ödeme süresi hesaplanmadı.",
  noPriceDifference: "Fiyat farkı girilmediği için geri ödeme süresi hesaplanmadı.",
} as const;

const qP = (v: number) => latexAuto(v, "guc");
/** Enerji tasarrufu kWh'de sabit (kart da autoUnit: false); TL/kWh fiyatla aynı birimde çarpılsın. */
const qEkWh = (v: number) => latexQty(v, "kWh");
const qTL = (v: number) => latexQty(v, "TL");
const qPrice = (v: number) => latexQty(v, "TL_kWh");
const qHours = (v: number) => latexQty(v, "h");

export const motorVerimiEnerjiTasarrufu: CalcDefinition = {
  id: "3.5",
  slug: "motor-verimi-enerji-tasarrufu",
  category: "motor",
  title: "Motor verimi ve enerji tasarrufu",
  description:
    "Mevcut motoru daha verimli bir motorla değiştirmenin yıllık enerji ve maliyet tasarrufunu ve basit geri ödeme süresini hesaplayın. İki motorun aynı mil gücünü verdiği kabul edilir; verimli motorlar genellikle daha az kaymayla biraz daha hızlı döner ve pompa/fan yüklerinde mil gücünü artırabilir.",
  formulas: [
    { label: "Verim", latex: "\\eta = \\frac{P_{\\text{çıkış}}}{P_{\\text{giriş}}}" },
    { label: "Giriş güçleri", latex: "P_{1} = \\frac{P}{\\eta_1} \\qquad P_{2} = \\frac{P}{\\eta_2}" },
    { label: "Güç farkı", latex: "\\Delta P = P \\left(\\frac{1}{\\eta_1} - \\frac{1}{\\eta_2}\\right)" },
    { label: "Yıllık enerji ve maliyet tasarrufu", latex: "\\Delta E = \\Delta P \\cdot t \\qquad \\Delta C = \\Delta E \\cdot c" },
    { label: "Basit geri ödeme süresi", latex: "t_{\\text{gö}} = \\frac{\\Delta K}{\\Delta C}" },
  ],
  references: [
    {
      standard: "IEC 60034-2-1",
      title:
        "Döner elektrik makineleri — Bölüm 2-1: Kayıpları ve verimi deneyle belirlemek için standart yöntemler (çekiş araçları makineleri hariç)",
      note: "Katalog verim değerlerinin ölçüm yöntemi",
    },
    {
      standard: "IEC 60034-30-1",
      title: "Döner elektrik makineleri — Bölüm 30-1: Şebekeden beslenen AC motorların verim sınıfları (IE kodu)",
      note: "IE sınıfı tespiti bu hesapta henüz yoktur",
    },
  ],
  inputs: [
    {
      kind: "number",
      key: "P",
      label: "Mil gücü (çalışma noktası)",
      symbol: "P",
      dimension: "guc",
      defaultUnit: "kW",
      default: 15,
      min: 0,
      minExclusive: true,
      help: "Motorun çalışma noktasında milden verdiği güç (anma gücü değil, yüke göre).",
    },
    {
      kind: "number",
      key: "eta1",
      label: "Mevcut motorun verimi",
      symbol: "\\eta_1",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 88,
      min: 0,
      minExclusive: true,
      max: 1,
    },
    {
      kind: "number",
      key: "eta2",
      label: "Yeni motorun verimi",
      symbol: "\\eta_2",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 92,
      min: 0,
      minExclusive: true,
      max: 1,
    },
    {
      kind: "number",
      key: "t",
      label: "Yıllık çalışma süresi",
      symbol: "t",
      dimension: "zaman",
      defaultUnit: "h",
      units: ["h", "day"],
      default: 6000,
      min: 0,
      minExclusive: true,
      max: LEAP_YEAR_S,
      help: "Bir yılda en fazla 8784 saat (366 gün).",
    },
    {
      kind: "number",
      key: "c",
      label: "Enerji birim fiyatı",
      symbol: "c",
      dimension: "enerji_fiyati",
      defaultUnit: "TL_kWh",
      default: 4,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "number",
      key: "dK",
      label: "Fiyat farkı (yatırım)",
      symbol: "\\Delta K",
      dimension: "para",
      defaultUnit: "TL",
      default: 25000,
      min: 0,
      optional: true,
      help: "Yeni motorun ek maliyeti (veya toplam yatırım). Girilirse geri ödeme süresi hesaplanır.",
    },
  ],
  outputs: [
    { key: "P1", label: "Mevcut motorun giriş gücü", symbol: "P_1", dimension: "guc", defaultUnit: "kW" },
    { key: "P2", label: "Yeni motorun giriş gücü", symbol: "P_2", dimension: "guc", defaultUnit: "kW" },
    { key: "dP", label: "Güç farkı", symbol: "\\Delta P", dimension: "guc", defaultUnit: "kW" },
    {
      key: "dE",
      label: "Yıllık enerji tasarrufu",
      symbol: "\\Delta E",
      dimension: "enerji",
      defaultUnit: "kWh",
      // Tasarruf kWh ile ifade edilir ve TL/kWh fiyatla çarpılır; MWh'ye otomatik geçmesin.
      autoUnit: false,
    },
    { key: "dC", label: "Yıllık maliyet tasarrufu", symbol: "\\Delta C", dimension: "para", defaultUnit: "TL" },
    {
      key: "geriOdeme",
      label: "Basit geri ödeme süresi (yıl)",
      symbol: "t_{\\text{gö}}",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
    },
  ],

  compute: (inputs) => {
    const P = num(inputs, "P", WHERE);
    const eta1 = num(inputs, "eta1", WHERE);
    const eta2 = num(inputs, "eta2", WHERE);
    const t = num(inputs, "t", WHERE);
    const c = num(inputs, "c", WHERE);
    const dK = optNum(inputs, "dK");

    const P1 = P / eta1;
    const P2 = P / eta2;
    const dP = P1 - P2;
    const dE = dP * t;
    const dC = dE * c;

    const steps: Step[] = [
      { label: "Mevcut motorun giriş gücü", latex: `P_1 = \\frac{P}{\\eta_1} = \\frac{${qP(P)}}{${qFrac(eta1)}} = ${qP(P1)}` },
      { label: "Yeni motorun giriş gücü", latex: `P_2 = \\frac{P}{\\eta_2} = \\frac{${qP(P)}}{${qFrac(eta2)}} = ${qP(P2)}` },
      { label: "Güç farkı", latex: `\\Delta P = P_1 - P_2 = ${qP(P1)} - ${qP(P2)} = ${qP(dP)}` },
      { label: "Yıllık enerji tasarrufu", latex: `\\Delta E = \\Delta P \\cdot t = ${qP(dP)} \\cdot ${qHours(t)} = ${qEkWh(dE)}` },
      { label: "Yıllık maliyet tasarrufu", latex: `\\Delta C = \\Delta E \\cdot c = ${qEkWh(dE)} \\cdot ${qPrice(c)} = ${qTL(dC)}` },
    ];
    const checks: Check[] = [];
    const outputs: Record<string, number> = { P1, P2, dP, dE, dC };

    if (dC <= 0) {
      checks.push({ level: "uyari", message: MESSAGES.noSaving });
    } else if (dK === undefined) {
      checks.push({ level: "ok", message: MESSAGES.noPriceDifference });
    } else {
      const years = dK / dC;
      outputs.geriOdeme = years;
      steps.push({
        label: "Basit geri ödeme süresi",
        latex: `t_{\\text{gö}} = \\frac{\\Delta K}{\\Delta C} = \\frac{${qTL(dK)}}{${qTL(dC)}/\\text{yıl}} = ${latexNum(years)}\\ \\text{yıl}`,
      });
    }

    return { outputs, steps, checks };
  },
};
