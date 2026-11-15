/**
 * KAPSAM 4.1 — LED ön direnci.
 *
 * - Dirençteki gerilim V_R = V_s − V_sat − n·V_F (n seri LED, V_sat transistörlü sürücüde doyma gerilimi; doğrudan
 *   beslemede 0). Hesaplanan direnç R = V_R/I_F (Broadcom AN1005 denklem 4).
 * - Standart değer GÜVENLİ YÖNDE seçilir: seçilen E serisinde R'ye eşit değer varsa o, yoksa üst komşu. Böylece akım
 *   hedefi aşmaz: I = V_R/R_std ≤ I_F.
 * - Dirençte harcanan güç standart dirençle gerçek akımdan: P_R = I²·R_std. Önerilen en düşük anma gücü k·P_R
 *   (k varsayılanı 2, Broadcom AN1005; config). Kullanıcı seçtiği direncin anma gücünü girerse yeterliliği denetlenir.
 * - Paralel diziler: her dizi kendi ön direnciyle bağlanır; toplam akım m·I, besleme gücü V_s·m·I.
 * - Devre verimi η = (LED'lerde harcanan güç)/(besleme gücü) = n·V_F/V_s (akımdan bağımsız).
 *
 * Varsayılan seri E24: ±%5 dirençlerin serisidir (Vishay 31001) ve E12 ⊂ E24 olduğundan E24'teki üst komşu hiçbir zaman
 * E12'dekinden büyük değildir; yani akım hedefe en az E12 kadar yakın kalır.
 */
import { LIMITS } from "@/config/sinirlar";
import { latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { standardNeighbours } from "../yardimci/standart-deger-serileri";
import { E_SERI_SECENEKLERI, REF, eSeri, num, opt, specText, specWriter } from "./temel-ortak";

/** Hüküm olmayan notlar (varsayım, yöntem, hatırlatma) */
const BILGI = "ok" as const; // birleştirmede "bilgi" olur

const WHERE = "led-on-direnci";

const MESSAGES = {
  noHeadroom: (vLed: string, vs: string) =>
    `LED'lerin ve sürücünün toplam gerilimi (${vLed}) besleme gerilimine (${vs}) eşit veya ondan büyük: ön dirençle sürülemez. Seri LED sayısını azaltın veya besleme gerilimini yükseltin.`,
  exact: (series: string, r: string) => `Hesaplanan direnç ${series} serisinde standart bir değerdir (${r}); akım hedefe eşittir.`,
  upper: (series: string, r: string, pct: string) =>
    `${series} serisinde üst komşu ${r} seçildi (güvenli yön): LED akımı hedefin %${pct} altında kalır.`,
  overRating: (pr: string, pa: string) =>
    `Dirençte harcanan güç (${pr}) seçilen direncin anma gücünü (${pa}) aşıyor: daha yüksek anma güçlü direnç seçin.`,
  lowMargin: (pa: string, need: string, k: string) =>
    `Seçilen direncin anma gücü (${pa}), ${k} emniyet katsayısıyla gereken ${need} değerinin altında.`,
  ratingOk: (pa: string, need: string, k: string) =>
    `Seçilen direncin anma gücü (${pa}) yeterli: ${k} emniyet katsayısıyla gereken ${need}.`,
  parallel: "Paralel diziler için her dizinin kendi ön direnci olduğu varsayıldı (dizi başına bir direnç).",
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "number",
    key: "Vs",
    label: "Besleme gerilimi",
    symbol: "V_s",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["mV", "V"],
    default: 12,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "Vf",
    label: "LED ileri gerilimi",
    symbol: "V_F",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["mV", "V"],
    default: 3.2,
    min: 0,
    minExclusive: true,
    help: "LED veri sayfasında çalışma akımındaki ileri gerilim (bir LED için).",
  },
  {
    kind: "number",
    key: "If",
    label: "LED akımı (hedef)",
    symbol: "I_F",
    dimension: "akim",
    defaultUnit: "mA",
    units: ["uA", "mA", "A"],
    default: 20,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "n",
    label: "Seri LED sayısı",
    symbol: "n",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 3,
    min: 1,
    integer: true,
  },
  {
    kind: "number",
    key: "m",
    label: "Paralel dizi sayısı",
    symbol: "m",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 1,
    min: 1,
    integer: true,
    help: "Her dizi kendi ön direnciyle bağlanır; toplam akım ve besleme gücü için kullanılır.",
  },
  {
    kind: "number",
    key: "Vsat",
    label: "Sürücü doyma gerilimi",
    symbol: "V_{\\text{sat}}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["mV", "V"],
    default: 0,
    min: 0,
    help: "LED bir transistörle anahtarlanıyorsa onun doyma gerilimi (Broadcom AN1005 örneğinde 0,1 V); doğrudan beslemede 0.",
  },
  {
    kind: "select",
    key: "seri",
    label: "Direnç serisi",
    options: E_SERI_SECENEKLERI,
    default: "E24",
    help: "Standart değer güvenli yönde (üst komşu) seçilir; böylece akım hedefi aşmaz.",
  },
  {
    kind: "number",
    key: "k",
    label: "Güç emniyet katsayısı",
    symbol: "k",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: LIMITS.elektronikTemel.ledDirencGucKatsayisi,
    min: 1,
    help: "Direnç anma gücü / harcanan güç. Broadcom AN1005: anma gücü harcanan gücün 2 katı olmalı. Karşılaştırma: NASA GSFC PD-ED-1201 dirençte en çok %60 yük öngörür (≈ 1,67).",
  },
  {
    kind: "number",
    key: "Panma",
    label: "Seçilen direncin anma gücü",
    symbol: "P_{\\text{anma}}",
    dimension: "guc",
    defaultUnit: "W",
    units: ["mW", "W"],
    default: 0.25,
    min: 0,
    minExclusive: true,
    optional: true,
    help: "Boş bırakılırsa yeterlilik denetimi yapılmaz.",
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "VR", label: "Direnç gerilimi", symbol: "V_R", dimension: "gerilim", defaultUnit: "V" },
  { key: "R", label: "Hesaplanan direnç", symbol: "R", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Rstd", label: "Standart direnç (üst komşu)", symbol: "R_{\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "I", label: "LED akımı (standart dirençle)", symbol: "I", dimension: "akim", defaultUnit: "A" },
  { key: "PR", label: "Direnç gücü", symbol: "P_R", dimension: "guc", defaultUnit: "W" },
  { key: "PRmin", label: "Önerilen en düşük anma gücü", symbol: "P_{\\text{anma,min}}", dimension: "guc", defaultUnit: "W" },
  { key: "PLED", label: "LED gücü (dizi başına)", symbol: "P_{\\text{LED}}", dimension: "guc", defaultUnit: "W" },
  { key: "Itop", label: "Toplam akım", symbol: "I_{\\text{top}}", dimension: "akim", defaultUnit: "A" },
  { key: "Ptop", label: "Toplam besleme gücü", symbol: "P_{\\text{top}}", dimension: "guc", defaultUnit: "W" },
  { key: "eta", label: "Devre verimi", symbol: "\\eta", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);
const qInt = (x: number) => latexNum(x, { decimals: 0 });

/** Dirençteki gerilim; ≤ 0 ise ön dirençle sürülemez. */
function headroom(inputs: ComputeInputs): { VR: number; vLed: number } {
  const Vs = num(inputs, "Vs", WHERE);
  const Vf = num(inputs, "Vf", WHERE);
  const n = num(inputs, "n", WHERE);
  const Vsat = num(inputs, "Vsat", WHERE);
  const vLed = n * Vf + Vsat;
  return { VR: Vs - vLed, vLed };
}

function validate(inputs: ComputeInputs): Check[] {
  const { VR, vLed } = headroom(inputs);
  if (VR > 0) return [];
  const Vs = num(inputs, "Vs", WHERE);
  return [{ level: "hata", message: MESSAGES.noHeadroom(specText(INPUTS, "Vs", vLed), specText(INPUTS, "Vs", Vs)) }];
}

function compute(inputs: ComputeInputs) {
  const Vs = num(inputs, "Vs", WHERE);
  const Vf = num(inputs, "Vf", WHERE);
  const If = num(inputs, "If", WHERE);
  const n = num(inputs, "n", WHERE);
  const m = num(inputs, "m", WHERE);
  const Vsat = num(inputs, "Vsat", WHERE);
  const k = num(inputs, "k", WHERE);
  const Panma = opt(inputs, "Panma");
  const series = eSeri(inputs, "seri", WHERE);
  const { VR } = headroom(inputs);

  const R = VR / If;
  const nb = standardNeighbours(R, series);
  const Rstd = nb.exact ? nb.nearest : nb.upper;
  const I = VR / Rstd;
  const PR = I * I * Rstd;
  const PRmin = k * PR;
  const PLED = n * Vf * I;
  const Itop = m * I;
  const Ptop = Vs * Itop;
  const eta = (n * Vf) / Vs;

  const satTerm = Vsat > 0 ? ` - V_{\\text{sat}}` : "";
  const satValue = Vsat > 0 ? ` - ${qi("Vsat", Vsat)}` : "";
  const steps: Step[] = [
    {
      label: "Dirençteki gerilim",
      latex: `V_R = V_s${satTerm} - n \\cdot V_F = ${qi("Vs", Vs)}${satValue} - ${qInt(n)} \\cdot ${qi("Vf", Vf)} = ${qo("VR", VR)}`,
    },
    {
      label: "Hesaplanan direnç",
      latex: `R = \\frac{V_R}{I_F} = \\frac{${qo("VR", VR)}}{${qi("If", If)}} = ${qo("R", R)}`,
    },
    {
      label: `${series} serisinde standart değer (güvenli yön: üst komşu)`,
      latex: nb.exact
        ? `R_{\\text{std}} = R = ${qo("Rstd", Rstd)}`
        : `${qo("R", nb.lower)} < R = ${qo("R", R)} < R_{\\text{std}} = ${qo("Rstd", Rstd)}`,
    },
    {
      label: "Standart dirençle LED akımı",
      latex: `I = \\frac{V_R}{R_{\\text{std}}} = \\frac{${qo("VR", VR)}}{${qo("Rstd", Rstd)}} = ${qo("I", I)}`,
    },
    {
      label: "Direnç gücü",
      latex: `P_R = I^2 \\cdot R_{\\text{std}} = (${qo("I", I)})^2 \\cdot ${qo("Rstd", Rstd)} = ${qo("PR", PR)}`,
    },
    {
      label: "Önerilen en düşük anma gücü",
      latex: `P_{\\text{anma,min}} = k \\cdot P_R = ${latexNum(k)} \\cdot ${qo("PR", PR)} = ${qo("PRmin", PRmin)}`,
    },
    {
      label: "LED gücü (dizi başına)",
      latex: `P_{\\text{LED}} = n \\cdot V_F \\cdot I = ${qInt(n)} \\cdot ${qi("Vf", Vf)} \\cdot ${qo("I", I)} = ${qo("PLED", PLED)}`,
    },
    {
      label: "Toplam akım ve besleme gücü",
      latex: `I_{\\text{top}} = m \\cdot I = ${qInt(m)} \\cdot ${qo("I", I)} = ${qo("Itop", Itop)}, \\quad P_{\\text{top}} = V_s \\cdot I_{\\text{top}} = ${qi("Vs", Vs)} \\cdot ${qo("Itop", Itop)} = ${qo("Ptop", Ptop)}`,
    },
    {
      label: "Devre verimi",
      latex: `\\eta = \\frac{n \\cdot V_F}{V_s} = \\frac{${qInt(n)} \\cdot ${qi("Vf", Vf)}}{${qi("Vs", Vs)}} = ${qo("eta", eta)}`,
    },
  ];

  const checks: Check[] = [];
  const rText = specText(OUTPUTS, "Rstd", Rstd);
  if (nb.exact) {
    checks.push({ level: BILGI, message: MESSAGES.exact(series, rText), reference: REF.eSerileri });
  } else {
    const pct = (((If - I) / If) * 100).toFixed(1).replace(".", ",");
    checks.push({ level: BILGI, message: MESSAGES.upper(series, rText, pct), reference: REF.eSerileri });
  }
  if (Panma !== undefined) {
    const pa = specText(INPUTS, "Panma", Panma);
    const kText = String(Number(k.toPrecision(4))).replace(".", ",");
    const need = specText(OUTPUTS, "PRmin", PRmin);
    if (PR > Panma) {
      checks.push({ level: "uyari", message: MESSAGES.overRating(specText(OUTPUTS, "PR", PR), pa), reference: REF.broadcomAn1005 });
    } else if (PRmin > Panma) {
      checks.push({ level: "uyari", message: MESSAGES.lowMargin(pa, need, kText), reference: REF.broadcomAn1005 });
    } else {
      checks.push({ level: "ok", message: MESSAGES.ratingOk(pa, need, kText), reference: REF.broadcomAn1005 });
    }
  }
  if (m > 1) checks.push({ level: BILGI, message: MESSAGES.parallel });

  return { outputs: { VR, R, Rstd, I, PR, PRmin, PLED, Itop, Ptop, eta }, steps, checks };
}

export const ledOnDirenci: CalcDefinition = {
  id: "4.1",
  slug: "led-on-direnci",
  category: "elektronik",
  title: "LED ön direnci",
  description:
    "Seri bağlı LED'ler için ön direnci hesaplayın; E serisinde güvenli yönde (üst komşu) standart değeri seçin, o dirençle gerçekleşen LED akımını, direnç gücünü, önerilen anma gücünü ve devre verimini bulun.",
  formulas: [
    { label: "Ön direnç", latex: "R = \\frac{V_s - V_{\\text{sat}} - n \\cdot V_F}{I_F}" },
    { label: "Standart değer (güvenli yön)", latex: "R_{\\text{std}} = \\min\\{R_E \\ge R\\}" },
    { label: "Gerçekleşen akım", latex: "I = \\frac{V_s - V_{\\text{sat}} - n \\cdot V_F}{R_{\\text{std}}}" },
    { label: "Direnç gücü ve önerilen anma gücü", latex: "P_R = I^2 R_{\\text{std}}, \\qquad P_{\\text{anma}} \\ge k \\cdot P_R" },
    { label: "Toplam (m paralel dizi)", latex: "I_{\\text{top}} = m \\cdot I, \\qquad P_{\\text{top}} = V_s \\cdot I_{\\text{top}}" },
    { label: "Devre verimi", latex: "\\eta = \\frac{n \\cdot V_F \\cdot I}{V_s \\cdot I} = \\frac{n \\cdot V_F}{V_s}" },
  ],
  references: [REF.broadcomAn1005, REF.eSerileri, REF.nasaDerating],
  inputs: INPUTS,
  outputs: OUTPUTS,
  validate: (inputs) => validate(inputs),
  compute: (inputs) => compute(inputs),
};
