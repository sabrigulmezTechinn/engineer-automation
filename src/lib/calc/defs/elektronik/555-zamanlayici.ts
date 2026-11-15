/**
 * KAPSAM 4.6 — 555 zamanlayıcı (astable ve monostable).
 *
 * Kondansatör tetikleme seviyesi V_tr = V_CC/3 ile eşik seviyesi V_th = 2·V_CC/3 arasında dolar/boşalır (TI SLFS022K Tablo 6-1,
 * §6.3.2). RC dolma/boşalma denkleminden:
 * - Astable: t_H = R·C·ln((V_CC − V_tr)/(V_CC − V_th)) = ln 2·(R₁+R₂)·C, t_L = R₂·C·ln(V_th/V_tr) = ln 2·R₂·C,
 *   f = 1/(ln 2·(R₁+2R₂)·C), görev oranı (çıkış yüksek) D = (R₁+R₂)/(R₁+2R₂) — diyotsuz devrede her zaman > %50.
 * - Monostable: kondansatör 0'dan V_th'ye dolar: t_w = R·C·ln(V_CC/(V_CC − V_th)) = ln 3·R·C.
 * `compute` tam ln 2 ve ln 3 kullanır. Veri sayfasındaki 0,693, 1,44 (≈ 1/ln 2) ve 1,1 (≈ ln 3) katsayıları yalnızca
 * `formulas` içinde yaklaşım olarak gösterilir (1,44 ile f ≈ %0,19 düşük çıkar).
 * Ters mod: astable'da hedef f ve D'den S = 1/(ln 2·f·C), R₁ = (2D − 1)·S, R₂ = (1 − D)·S; monostable'da R = t_w/(ln 3·C);
 * seçilen E serisinden en yakın standart değerler ve onlarla gerçekleşen f, D, t_w.
 * Sınırlar (besleme aralığı, en büyük R_A + R_B, en kısa darbe, en yüksek astable frekansı) ctx.limits.elektronikEntegre.zamanlayici555.
 */
import { latexNum } from "@/lib/calc/latex";
import type { CalcContext, CalcDefinition, Check, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import type { ESeriesId } from "../yardimci/e-serileri";
import { REF, eSeriInput, num, specWriters, standartDeger } from "./entegre-ortak";

export type ZamanlayiciMod = "astable" | "astable-tasarim" | "monostable" | "monostable-tasarim";

const WHERE = "555-zamanlayici";
const LN3 = Math.log(3);

/** Hüküm olmayan notlar (kabul, yöntem, hatırlatma). */
const BILGI = "ok" as const; // birleştirmede "bilgi" olur

const TASARIM: ZamanlayiciMod[] = ["astable-tasarim", "monostable-tasarim"];

const MESSAGES = {
  gorevAraligi:
    "Diyotsuz astable devrede görev oranı (çıkış yüksek) %50'den büyük ve %100'den küçük olmalıdır: R₁ = (2D − 1)·S ve R₂ = (1 − D)·S pozitif kalmalı.",
  gorevBilgi:
    "Bu (diyotsuz) astable bağlantıda kondansatör R₁ + R₂ üzerinden dolar, yalnız R₂ üzerinden boşalır; bu yüzden görev oranı (R₁+R₂)/(R₁+2R₂) her zaman %50'nin üzerindedir. %50 ve altı için dolma ve boşalma yollarını ayıran farklı bir bağlantı gerekir.",
  besleme: (v: string, min: string, max: string) =>
    `Besleme gerilimi ${v}, NE555 önerilen çalışma aralığının (${min} – ${max}) dışında.`,
  rMax: (ad: string, r: string, max: string) =>
    `${ad} = ${r}, veri sayfasındaki en büyük değeri (≅ ${max}) aşıyor: THRES giriş akımı kondansatörün eşik seviyesine dolmasını engelleyebilir. Veri sayfası 5 V için ≅ 3,4 MΩ, 15 V için ≅ 10 MΩ verir; V_CC < 15 V'ta tutucu olarak 5 V değeri esas alındı.`,
  fMax: (f: string, max: string) =>
    `Frekans ${f}: veri sayfası bozulmayı azaltmak için astable çalışmada en çok ${max} önerir (daha yüksek frekansta CMOS 555 önerilir).`,
  tMin: (tw: string, min: string) =>
    `Darbe süresi ${tw}: tetikleme girişi toprağa çekildiğinde karşılaştırıcı gecikmesi en kısa monostable darbeyi ${min} ile sınırlar.`,
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Çalışma modu",
    options: [
      { value: "astable", label: "Astable (kare dalga osilatör)" },
      { value: "astable-tasarim", label: "Astable — hedef frekans ve görev oranından R₁, R₂" },
      { value: "monostable", label: "Monostable (tek darbe)" },
      { value: "monostable-tasarim", label: "Monostable — hedef darbe süresinden R" },
    ],
    default: "astable",
  },
  {
    kind: "number",
    key: "Vcc",
    label: "Besleme gerilimi",
    symbol: "V_{CC}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["V"],
    default: 9,
    min: 0,
    minExclusive: true,
    help: "Zamanlama süreleri beslemeden bağımsızdır; besleme eşik gerilimleri ve sınır kontrolleri için kullanılır.",
  },
  {
    kind: "number",
    key: "R1",
    label: "R₁ (R_A, besleme–deşarj arası)",
    symbol: "R_1",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 1,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "astable" },
  },
  {
    kind: "number",
    key: "R2",
    label: "R₂ (R_B, deşarj–eşik arası)",
    symbol: "R_2",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 10,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "astable" },
  },
  {
    kind: "number",
    key: "R",
    label: "Zamanlama direnci (R_A)",
    symbol: "R",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 100,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "monostable" },
  },
  {
    kind: "number",
    key: "fHedef",
    label: "Hedef frekans",
    symbol: "f_{\\text{hedef}}",
    dimension: "frekans",
    defaultUnit: "Hz",
    units: ["Hz", "kHz"],
    default: 1000,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "astable-tasarim" },
  },
  {
    kind: "number",
    key: "DHedef",
    label: "Hedef görev oranı (çıkış yüksek)",
    symbol: "D_{\\text{hedef}}",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent"],
    default: 60,
    min: 0,
    max: 1,
    help: "t_H / T. Diyotsuz devrede %50 ile %100 arasında olmalıdır.",
    visibleWhen: { key: "mod", equals: "astable-tasarim" },
  },
  {
    kind: "number",
    key: "tHedef",
    label: "Hedef darbe süresi",
    symbol: "t_{w,\\text{hedef}}",
    dimension: "zaman",
    defaultUnit: "ms",
    units: ["us", "ms", "s"],
    default: 100,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "monostable-tasarim" },
  },
  {
    kind: "number",
    key: "C",
    label: "Zamanlama kondansatörü",
    symbol: "C",
    dimension: "kapasitans",
    defaultUnit: "nF",
    units: ["pF", "nF", "uF"],
    default: 100,
    min: 0,
    minExclusive: true,
  },
  eSeriInput("E24", { key: "mod", equals: TASARIM }),
];

const OUTPUTS: OutputSpec[] = [
  { key: "R1h", label: "Hesaplanan R₁", symbol: "R_1", dimension: "direnc", defaultUnit: "ohm" },
  { key: "R2h", label: "Hesaplanan R₂", symbol: "R_2", dimension: "direnc", defaultUnit: "ohm" },
  { key: "R1s", label: "Seçilen standart R₁", symbol: "R_{1,\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "R2s", label: "Seçilen standart R₂", symbol: "R_{2,\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Rh", label: "Hesaplanan R", symbol: "R", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Rs", label: "Seçilen standart R", symbol: "R_{\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "f", label: "Frekans", symbol: "f", dimension: "frekans", defaultUnit: "Hz" },
  { key: "D", label: "Görev oranı (çıkış yüksek)", symbol: "D", dimension: "oran", defaultUnit: "percent" },
  { key: "tH", label: "Çıkış yüksek süresi", symbol: "t_H", dimension: "zaman", defaultUnit: "s" },
  { key: "tL", label: "Çıkış düşük süresi", symbol: "t_L", dimension: "zaman", defaultUnit: "s" },
  { key: "T", label: "Periyot", symbol: "T", dimension: "zaman", defaultUnit: "s" },
  { key: "tw", label: "Darbe süresi", symbol: "t_w", dimension: "zaman", defaultUnit: "s" },
  { key: "fSapma", label: "Hedef frekanstan sapma", symbol: "\\delta_f", dimension: "oran", defaultUnit: "percent" },
  { key: "tSapma", label: "Hedef darbe süresinden sapma", symbol: "\\delta_t", dimension: "oran", defaultUnit: "percent" },
  { key: "Vth", label: "Eşik seviyesi (THRES)", symbol: "V_{th}", dimension: "gerilim", defaultUnit: "V" },
  { key: "Vtr", label: "Tetikleme seviyesi (TRIG)", symbol: "V_{tr}", dimension: "gerilim", defaultUnit: "V" },
];

const { q, t } = specWriters([...INPUTS, ...OUTPUTS]);

/** Veri sayfası notuna göre en büyük R_A + R_B: yalnız iki örnek nokta var, ara değer üretilmez (V_CC < 15 V → 5 V değeri). */
export function rToplamMax(Vcc: number, ctx: CalcContext): number {
  const s = ctx.limits.elektronikEntegre.zamanlayici555.rToplamMax;
  return Vcc >= s.vccYuksek ? s.rYuksek : s.rDusuk;
}

/** Astable süreleri (tam ln 2) ve adımları */
function astable(R1: number, R2: number, C: number, std: boolean, steps: Step[], outputs: Record<string, number>) {
  const r1 = std ? "R_{1,\\text{std}}" : "R_1";
  const r2 = std ? "R_{2,\\text{std}}" : "R_2";
  const qR1 = std ? q("R1s", R1) : q("R1", R1);
  const qR2 = std ? q("R2s", R2) : q("R2", R2);
  const tH = Math.LN2 * (R1 + R2) * C;
  const tL = Math.LN2 * R2 * C;
  const T = tH + tL;
  const f = 1 / (Math.LN2 * (R1 + 2 * R2) * C);
  const D = (R1 + R2) / (R1 + 2 * R2);
  const suffix = std ? " (standart değerlerle)" : "";
  steps.push({ label: `Çıkış yüksek süresi${suffix}`, latex: `t_H = \\ln 2 \\cdot (${r1} + ${r2}) \\cdot C = \\ln 2 \\cdot (${qR1} + ${qR2}) \\cdot ${q("C", C)} = ${q("tH", tH)}` });
  steps.push({ label: `Çıkış düşük süresi${suffix}`, latex: `t_L = \\ln 2 \\cdot ${r2} \\cdot C = \\ln 2 \\cdot ${qR2} \\cdot ${q("C", C)} = ${q("tL", tL)}` });
  steps.push({ label: "Periyot", latex: `T = t_H + t_L = ${q("tH", tH)} + ${q("tL", tL)} = ${q("T", T)}` });
  steps.push({
    label: `Frekans${suffix}`,
    latex: `f = \\frac{1}{\\ln 2 \\cdot (${r1} + 2 ${r2}) \\cdot C} = \\frac{1}{\\ln 2 \\cdot (${qR1} + 2 \\cdot ${qR2}) \\cdot ${q("C", C)}} = ${q("f", f)}`,
  });
  steps.push({
    label: `Görev oranı${suffix}`,
    latex: `D = \\frac{t_H}{T} = \\frac{${r1} + ${r2}}{${r1} + 2 ${r2}} = \\frac{${qR1} + ${qR2}}{${qR1} + 2 \\cdot ${qR2}} = ${q("D", D)}`,
  });
  Object.assign(outputs, { tH, tL, T, f, D });
  return { f, D };
}

export const zamanlayici555: CalcDefinition = {
  id: "4.6",
  slug: "555-zamanlayici",
  category: "elektronik",
  title: "555 zamanlayıcı",
  description:
    "555 zamanlayıcının astable modda frekansını, görev oranını ve yüksek/düşük sürelerini, monostable modda darbe süresini hesaplayın; hedef frekans/görev oranından veya darbe süresinden standart dirençleri seçin. Hesap tam ln 2 ve ln 3 ile yapılır; veri sayfasındaki 1,44 ve 1,1 katsayıları yalnızca yaklaşım olarak formüllerde gösterilir.",
  formulas: [
    { label: "Eşik ve tetikleme seviyeleri", latex: "V_{th} = \\tfrac{2}{3} V_{CC}, \\quad V_{tr} = \\tfrac{1}{3} V_{CC}" },
    {
      label: "Astable — yüksek ve düşük süreler",
      latex: "t_H = (R_1 + R_2) C \\ln \\frac{V_{CC} - V_{tr}}{V_{CC} - V_{th}} = \\ln 2 \\cdot (R_1 + R_2) \\cdot C, \\quad t_L = \\ln 2 \\cdot R_2 \\cdot C",
    },
    {
      label: "Astable — frekans (veri sayfası yaklaşımı: 1,44 ≈ 1/ln 2)",
      latex: "f = \\frac{1}{\\ln 2 \\cdot (R_1 + 2 R_2) \\cdot C} \\approx \\frac{1{,}44}{(R_1 + 2 R_2) \\cdot C}",
    },
    { label: "Astable — görev oranı (çıkış yüksek)", latex: "D = \\frac{t_H}{T} = \\frac{R_1 + R_2}{R_1 + 2 R_2} > \\tfrac{1}{2}" },
    {
      label: "Monostable — darbe süresi (veri sayfası yaklaşımı: 1,1 ≈ ln 3)",
      latex: "t_w = R C \\ln \\frac{V_{CC}}{V_{CC} - V_{th}} = \\ln 3 \\cdot R \\cdot C \\approx 1{,}1 \\cdot R \\cdot C",
    },
    {
      label: "Ters mod — astable",
      latex: "S = \\frac{1}{\\ln 2 \\cdot f \\cdot C}, \\quad R_1 = (2D - 1) \\cdot S, \\quad R_2 = (1 - D) \\cdot S",
    },
    { label: "Ters mod — monostable", latex: "R = \\frac{t_w}{\\ln 3 \\cdot C}" },
  ],
  references: [REF.ne555, REF.ne555Sinir, REF.lm555],
  inputs: INPUTS,
  outputs: OUTPUTS,

  validate: (inputs) => {
    const checks: Check[] = [];
    if (inputs.mod === "astable-tasarim") {
      const D = num(inputs, "DHedef", WHERE);
      if (D <= 0.5 || D >= 1) checks.push({ level: "hata", message: MESSAGES.gorevAraligi });
    }
    return checks;
  },

  compute: (inputs, ctx) => {
    const mode = inputs.mod as ZamanlayiciMod;
    const sinir = ctx.limits.elektronikEntegre.zamanlayici555;
    const Vcc = num(inputs, "Vcc", WHERE);
    const C = num(inputs, "C", WHERE);
    const steps: Step[] = [];
    const checks: Check[] = [];
    const outputs: Record<string, number> = {};

    const Vth = sinir.esikOrani * Vcc;
    const Vtr = sinir.tetikOrani * Vcc;
    steps.push({
      label: "Eşik ve tetikleme seviyeleri",
      latex: `V_{th} = \\tfrac{2}{3} V_{CC} = ${q("Vth", Vth)}, \\quad V_{tr} = \\tfrac{1}{3} V_{CC} = ${q("Vtr", Vtr)}`,
    });
    Object.assign(outputs, { Vth, Vtr });

    let Rtoplam: number;
    let rAd: string;

    if (mode === "astable" || mode === "astable-tasarim") {
      let R1: number;
      let R2: number;
      if (mode === "astable-tasarim") {
        const fh = num(inputs, "fHedef", WHERE);
        const Dh = num(inputs, "DHedef", WHERE);
        const seri = inputs.seri as ESeriesId;
        const S = 1 / (Math.LN2 * fh * C);
        const R1h = (2 * Dh - 1) * S;
        const R2h = (1 - Dh) * S;
        steps.push({
          label: "Ortak çarpan",
          latex: `S = \\frac{1}{\\ln 2 \\cdot f_{\\text{hedef}} \\cdot C} = \\frac{1}{\\ln 2 \\cdot ${q("fHedef", fh)} \\cdot ${q("C", C)}} = ${q("R1h", S)}`,
        });
        steps.push({ label: "Hesaplanan R₁", latex: `R_1 = (2D - 1) \\cdot S = (2 \\cdot ${latexNum(Dh)} - 1) \\cdot ${q("R1h", S)} = ${q("R1h", R1h)}` });
        steps.push({ label: "Hesaplanan R₂", latex: `R_2 = (1 - D) \\cdot S = (1 - ${latexNum(Dh)}) \\cdot ${q("R2h", S)} = ${q("R2h", R2h)}` });
        R1 = standartDeger(R1h, seri, "yakin");
        R2 = standartDeger(R2h, seri, "yakin");
        steps.push({ label: `Standart değerler (${seri}, en yakın)`, latex: `R_{1,\\text{std}} = ${q("R1s", R1)}, \\quad R_{2,\\text{std}} = ${q("R2s", R2)}` });
        Object.assign(outputs, { R1h, R2h, R1s: R1, R2s: R2 });
        const { f } = astable(R1, R2, C, true, steps, outputs);
        outputs.fSapma = (f - fh) / fh;
        steps.push({
          label: "Hedef frekanstan sapma",
          latex: `\\delta_f = \\frac{f - f_{\\text{hedef}}}{f_{\\text{hedef}}} = \\frac{${q("f", f)} - ${q("fHedef", fh)}}{${q("fHedef", fh)}} = ${q("fSapma", outputs.fSapma)}`,
        });
      } else {
        R1 = num(inputs, "R1", WHERE);
        R2 = num(inputs, "R2", WHERE);
        astable(R1, R2, C, false, steps, outputs);
      }
      Rtoplam = R1 + R2;
      rAd = "R₁ + R₂";
      checks.push({ level: BILGI, message: MESSAGES.gorevBilgi, reference: REF.ne555 });
      if (outputs.f > sinir.astableMaxFrekans) {
        checks.push({ level: "uyari", message: MESSAGES.fMax(t("f", outputs.f), t("f", sinir.astableMaxFrekans)), reference: REF.ne555Sinir });
      }
    } else if (mode === "monostable" || mode === "monostable-tasarim") {
      let R: number;
      if (mode === "monostable-tasarim") {
        const th = num(inputs, "tHedef", WHERE);
        const seri = inputs.seri as ESeriesId;
        const Rh = th / (LN3 * C);
        steps.push({ label: "Hesaplanan R", latex: `R = \\frac{t_w}{\\ln 3 \\cdot C} = \\frac{${q("tHedef", th)}}{\\ln 3 \\cdot ${q("C", C)}} = ${q("Rh", Rh)}` });
        R = standartDeger(Rh, seri, "yakin");
        steps.push({ label: `Standart değer (${seri}, en yakın)`, latex: `R_{\\text{std}} = ${q("Rs", R)}` });
        Object.assign(outputs, { Rh, Rs: R });
        const tw = LN3 * R * C;
        steps.push({
          label: "Darbe süresi (standart değerle)",
          latex: `t_w = \\ln 3 \\cdot R_{\\text{std}} \\cdot C = \\ln 3 \\cdot ${q("Rs", R)} \\cdot ${q("C", C)} = ${q("tw", tw)}`,
        });
        outputs.tw = tw;
        outputs.tSapma = (tw - th) / th;
        steps.push({
          label: "Hedef darbe süresinden sapma",
          latex: `\\delta_t = \\frac{t_w - t_{w,\\text{hedef}}}{t_{w,\\text{hedef}}} = \\frac{${q("tw", tw)} - ${q("tHedef", th)}}{${q("tHedef", th)}} = ${q("tSapma", outputs.tSapma)}`,
        });
      } else {
        R = num(inputs, "R", WHERE);
        const tw = LN3 * R * C;
        steps.push({ label: "Darbe süresi", latex: `t_w = \\ln 3 \\cdot R \\cdot C = \\ln 3 \\cdot ${q("R", R)} \\cdot ${q("C", C)} = ${q("tw", tw)}` });
        outputs.tw = tw;
      }
      Rtoplam = R;
      rAd = "R";
      if (outputs.tw < sinir.monostableMinDarbe) {
        checks.push({ level: "uyari", message: MESSAGES.tMin(t("tw", outputs.tw), t("tw", sinir.monostableMinDarbe)), reference: REF.ne555Sinir });
      }
    } else {
      throw new Error(`${WHERE}: bilinmeyen mod "${String(mode)}"`);
    }

    if (Vcc < sinir.beslemeMin || Vcc > sinir.beslemeMax) {
      checks.push({
        level: "uyari",
        message: MESSAGES.besleme(t("Vcc", Vcc), t("Vcc", sinir.beslemeMin), t("Vcc", sinir.beslemeMax)),
        reference: REF.ne555Sinir,
      });
    }
    const rMax = rToplamMax(Vcc, ctx);
    if (Rtoplam > rMax) {
      checks.push({ level: "uyari", message: MESSAGES.rMax(rAd, t("R1h", Rtoplam), t("R1h", rMax)), reference: REF.ne555Sinir });
    }

    return { outputs, steps, checks };
  },
};
