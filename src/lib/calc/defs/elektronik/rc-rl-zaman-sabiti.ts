/**
 * KAPSAM 4.2 — RC / RL zaman sabiti.
 *
 * - RC: τ = R·C. Şarj (kaynak V_s bağlanır, C başlangıçta boş): v_C(t) = V_s(1 − e^(−t/τ)), i(t) = (V_s/R)·e^(−t/τ).
 *   Deşarj (C, V₀'dan R üzerinden boşalır): v_C(t) = V₀·e^(−t/τ), |i(t)| = (V₀/R)·e^(−t/τ).
 * - RL: τ = L/R. Akım yükselmesi (V_s bağlanır): i(t) = (V_s/R)(1 − e^(−t/τ)), |v_L(t)| = V_s·e^(−t/τ).
 *   Sönüm (kaynak ayrılır, akım aynı R üzerinden söner; başlangıç akımı I₀ = V₀/R): i(t) = I₀·e^(−t/τ),
 *   |v_L(t)| = R·i(t) = V₀·e^(−t/τ).
 * - Hedef seviyeye ulaşma süresi: şarjda son değerin x oranına t = −τ·ln(1 − x); deşarjda başlangıç değerinin x oranına
 *   inme t = −τ·ln(x). Yerleşme süresi 5τ (kalan e⁻⁵ ≈ %0,67).
 * - En yüksek depolanan enerji: RC'de ½·C·V², RL'de ½·L·(V/R)² (V: şarjda V_s, deşarjda V₀).
 * R, kaynak iç direnci ve (RL'de) bobin sargı direnci dahil toplam seri dirençtir; bileşenler ideal kabul edilir.
 */
import { latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { REF, num, opt, specWriter } from "./temel-ortak";

export type ZamanSabitiMod = "rc" | "rl";
export type ZamanSabitiIslem = "sarj" | "desarj";

/** Hüküm olmayan notlar (varsayım, yöntem, hatırlatma) */

const WHERE = "rc-rl-zaman-sabiti";

const MESSAGES = {
  unreachable: "Hedef seviye %100'den küçük olmalıdır: üstel şarjda son değere kuramsal olarak sonsuz sürede ulaşılır.",
  assumptionsRc:
    "İdeal bileşenler kabul edildi; R, kaynak iç direnci dahil toplam seri dirençtir. Deşarjda kondansatör aynı R üzerinden boşalır.",
  assumptionsRl:
    "İdeal bileşenler kabul edildi; R, bobin sargı direnci ve kaynak iç direnci dahil toplam seri dirençtir. Sönümde akım aynı R üzerinden akar.",
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Devre",
    options: [
      { value: "rc", label: "RC (direnç–kondansatör)" },
      { value: "rl", label: "RL (direnç–bobin)" },
    ],
    default: "rc",
  },
  {
    kind: "select",
    key: "islem",
    label: "Geçiş",
    options: [
      { value: "sarj", label: "Şarj / akım yükselmesi (kaynak bağlanır)" },
      { value: "desarj", label: "Deşarj / sönüm (kaynak ayrılır)" },
    ],
    default: "sarj",
  },
  {
    kind: "number",
    key: "R",
    label: "Direnç",
    symbol: "R",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 10,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "rc" },
  },
  {
    kind: "number",
    key: "C",
    label: "Kapasitans",
    symbol: "C",
    dimension: "kapasitans",
    defaultUnit: "uF",
    units: ["pF", "nF", "uF", "mF", "F"],
    default: 100,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "rc" },
  },
  {
    kind: "number",
    key: "t",
    label: "Anahtarlamadan sonraki süre",
    symbol: "t",
    dimension: "zaman",
    defaultUnit: "s",
    units: ["us", "ms", "s", "min", "h"],
    default: 1,
    min: 0,
    visibleWhen: { key: "mod", equals: "rc" },
  },
  {
    kind: "number",
    key: "Rl",
    label: "Toplam seri direnç",
    symbol: "R",
    dimension: "direnc",
    defaultUnit: "ohm",
    units: ["mohm", "ohm", "kohm"],
    default: 100,
    min: 0,
    minExclusive: true,
    help: "Bobin sargı direnci ve kaynak iç direnci dahil.",
    visibleWhen: { key: "mod", equals: "rl" },
  },
  {
    kind: "number",
    key: "L",
    label: "Endüktans",
    symbol: "L",
    dimension: "enduktans",
    defaultUnit: "mH",
    units: ["nH", "uH", "mH", "H"],
    default: 10,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "rl" },
  },
  {
    kind: "number",
    key: "tL",
    label: "Anahtarlamadan sonraki süre",
    symbol: "t",
    dimension: "zaman",
    defaultUnit: "us",
    units: ["ns", "us", "ms", "s"],
    default: 100,
    min: 0,
    visibleWhen: { key: "mod", equals: "rl" },
  },
  {
    kind: "number",
    key: "Vs",
    label: "Kaynak gerilimi",
    symbol: "V_s",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["mV", "V", "kV"],
    default: 5,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "islem", equals: "sarj" },
  },
  {
    kind: "number",
    key: "V0",
    label: "Başlangıç gerilimi",
    symbol: "V_0",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["mV", "V", "kV"],
    default: 5,
    min: 0,
    minExclusive: true,
    help: "RC: kondansatörün başlangıç gerilimi. RL: kaynak ayrılmadan önceki gerilim (başlangıç akımı I₀ = V₀/R).",
    visibleWhen: { key: "islem", equals: "desarj" },
  },
  {
    kind: "number",
    key: "xS",
    label: "Hedef seviye (son değerin oranı)",
    symbol: "x",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    default: 90,
    min: 0,
    minExclusive: true,
    help: "Ör. %90: gerilim (RC) veya akım (RL) son değerinin %90'ına ne zaman ulaşır? %100'den küçük olmalı.",
    visibleWhen: { key: "islem", equals: "sarj" },
  },
  {
    kind: "number",
    key: "xD",
    label: "Hedef seviye (başlangıç değerinin oranı)",
    symbol: "x",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    default: 10,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "Ör. %10: gerilim (RC) veya akım (RL) başlangıç değerinin %10'una ne zaman iner?",
    visibleWhen: { key: "islem", equals: "desarj" },
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "tau", label: "Zaman sabiti", symbol: "\\tau", dimension: "zaman", defaultUnit: "s", units: ["ns", "us", "ms", "s", "min", "h"] },
  { key: "t5", label: "Yerleşme süresi (5τ)", symbol: "5\\tau", dimension: "zaman", defaultUnit: "s", units: ["ns", "us", "ms", "s", "min", "h"] },
  { key: "vC", label: "Kondansatör gerilimi", symbol: "v_C(t)", dimension: "gerilim", defaultUnit: "V" },
  { key: "iC", label: "Devre akımı (büyüklük)", symbol: "i(t)", dimension: "akim", defaultUnit: "A" },
  { key: "iL", label: "Bobin akımı", symbol: "i_L(t)", dimension: "akim", defaultUnit: "A" },
  { key: "vL", label: "Bobin gerilimi (büyüklük)", symbol: "v_L(t)", dimension: "gerilim", defaultUnit: "V" },
  { key: "oranS", label: "t anında seviye (son değerin oranı)", symbol: "1 - e^{-t/\\tau}", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
  { key: "oranD", label: "t anında kalan (başlangıç değerinin oranı)", symbol: "e^{-t/\\tau}", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
  { key: "Imax", label: "En yüksek akım (V/R)", symbol: "I_{\\max}", dimension: "akim", defaultUnit: "A" },
  { key: "tx", label: "Hedef seviyeye ulaşma süresi", symbol: "t_x", dimension: "zaman", defaultUnit: "s", units: ["ns", "us", "ms", "s", "min", "h"] },
  { key: "E", label: "En yüksek depolanan enerji", symbol: "E", dimension: "enerji", defaultUnit: "J", units: ["uJ", "mJ", "J", "kJ"] },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);

function validate(inputs: ComputeInputs): Check[] {
  const xS = opt(inputs, "xS");
  return xS !== undefined && xS >= 1 ? [{ level: "hata", message: MESSAGES.unreachable }] : [];
}

function compute(inputs: ComputeInputs) {
  const mod = inputs.mod as ZamanSabitiMod;
  const sarj = inputs.islem === "sarj";
  const rc = mod === "rc";

  const R = rc ? num(inputs, "R", WHERE) : num(inputs, "Rl", WHERE);
  const rKey = rc ? "R" : "Rl";
  const t = rc ? num(inputs, "t", WHERE) : num(inputs, "tL", WHERE);
  const tKey = rc ? "t" : "tL";
  const V = sarj ? num(inputs, "Vs", WHERE) : num(inputs, "V0", WHERE);
  const vKey = sarj ? "Vs" : "V0";
  const vSym = sarj ? "V_s" : "V_0";
  const x = sarj ? num(inputs, "xS", WHERE) : num(inputs, "xD", WHERE);

  const steps: Step[] = [];
  let tau: number;
  let E: number;
  if (rc) {
    const C = num(inputs, "C", WHERE);
    tau = R * C;
    E = 0.5 * C * V * V;
    steps.push({ label: "Zaman sabiti", latex: `\\tau = R \\cdot C = ${qi("R", R)} \\cdot ${qi("C", C)} = ${qo("tau", tau)}` });
  } else {
    const L = num(inputs, "L", WHERE);
    tau = L / R;
    E = 0.5 * L * (V / R) ** 2;
    steps.push({ label: "Zaman sabiti", latex: `\\tau = \\frac{L}{R} = \\frac{${qi("L", L)}}{${qi("Rl", R)}} = ${qo("tau", tau)}` });
  }
  const t5 = 5 * tau;
  steps.push({ label: "Yerleşme süresi", latex: `5\\tau = 5 \\cdot ${qo("tau", tau)} = ${qo("t5", t5)}` });

  const r = t / tau;
  const decay = Math.exp(-r);
  const Imax = V / R;
  const outputs: Record<string, number> = { tau, t5, Imax, E };
  steps.push({
    label: "Süre / zaman sabiti",
    latex: `\\frac{t}{\\tau} = \\frac{${qi(tKey, t)}}{${qo("tau", tau)}} = ${latexNum(r)}`,
  });

  if (sarj) {
    const oranS = 1 - decay;
    outputs.oranS = oranS;
    steps.push({ label: "t anında seviye", latex: `1 - e^{-t/\\tau} = 1 - e^{-${latexNum(r)}} = ${qo("oranS", oranS)}` });
  } else {
    outputs.oranD = decay;
    steps.push({ label: "t anında kalan", latex: `e^{-t/\\tau} = e^{-${latexNum(r)}} = ${qo("oranD", decay)}` });
  }

  const vIn = qi(vKey, V);
  const rIn = qi(rKey, R);
  if (rc) {
    const vC = sarj ? V * (1 - decay) : V * decay;
    const iC = Imax * decay;
    Object.assign(outputs, { vC, iC });
    steps.push(
      sarj
        ? { label: "Kondansatör gerilimi", latex: `v_C(t) = V_s \\left(1 - e^{-t/\\tau}\\right) = ${vIn} \\cdot ${latexNum(1 - decay)} = ${qo("vC", vC)}` }
        : { label: "Kondansatör gerilimi", latex: `v_C(t) = V_0 \\, e^{-t/\\tau} = ${vIn} \\cdot ${latexNum(decay)} = ${qo("vC", vC)}` },
      {
        label: sarj ? "Şarj akımı" : "Deşarj akımı (büyüklük)",
        latex: `i(t) = \\frac{${vSym}}{R} \\, e^{-t/\\tau} = \\frac{${vIn}}{${rIn}} \\cdot ${latexNum(decay)} = ${qo("iC", iC)}`,
      },
    );
  } else {
    const iL = sarj ? Imax * (1 - decay) : Imax * decay;
    const vL = V * decay;
    Object.assign(outputs, { iL, vL });
    steps.push(
      sarj
        ? {
            label: "Bobin akımı",
            latex: `i_L(t) = \\frac{V_s}{R}\\left(1 - e^{-t/\\tau}\\right) = \\frac{${vIn}}{${rIn}} \\cdot ${latexNum(1 - decay)} = ${qo("iL", iL)}`,
          }
        : {
            label: "Bobin akımı",
            latex: `i_L(t) = \\frac{V_0}{R} \\, e^{-t/\\tau} = \\frac{${vIn}}{${rIn}} \\cdot ${latexNum(decay)} = ${qo("iL", iL)}`,
          },
      {
        label: "Bobin gerilimi (büyüklük)",
        latex: `v_L(t) = ${vSym} \\, e^{-t/\\tau} = ${vIn} \\cdot ${latexNum(decay)} = ${qo("vL", vL)}`,
      },
    );
  }

  steps.push({
    label: rc ? "En yüksek akım (t = 0)" : sarj ? "Kararlı (son) akım" : "Başlangıç akımı",
    latex: `I_{\\max} = \\frac{${vSym}}{R} = \\frac{${vIn}}{${rIn}} = ${qo("Imax", Imax)}`,
  });

  // "+ 0": x = %100 deşarjda -0 yerine 0
  const tx = (sarj ? -tau * Math.log(1 - x) : -tau * Math.log(x)) + 0;
  outputs.tx = tx;
  steps.push(
    sarj
      ? {
          label: "Son değerin x oranına ulaşma süresi",
          latex: `t_x = -\\tau \\ln(1 - x) = -${qo("tau", tau)} \\cdot \\ln(1 - ${latexNum(x)}) = ${qo("tx", tx)}`,
        }
      : {
          label: "Başlangıç değerinin x oranına inme süresi",
          latex: `t_x = -\\tau \\ln x = -${qo("tau", tau)} \\cdot \\ln ${latexNum(x)} = ${qo("tx", tx)}`,
        },
  );

  steps.push(
    rc
      ? { label: "En yüksek depolanan enerji", latex: `E = \\tfrac{1}{2} C \\, ${vSym}^2 = \\tfrac{1}{2} \\cdot ${qi("C", num(inputs, "C", WHERE))} \\cdot (${vIn})^2 = ${qo("E", E)}` }
      : { label: "En yüksek depolanan enerji", latex: `E = \\tfrac{1}{2} L \\, I_{\\max}^2 = \\tfrac{1}{2} \\cdot ${qi("L", num(inputs, "L", WHERE))} \\cdot (${qo("Imax", Imax)})^2 = ${qo("E", E)}` },
  );

  const checks: Check[] = [
    { level: "bilgi", message: rc ? MESSAGES.assumptionsRc : MESSAGES.assumptionsRl, reference: rc ? REF.openstaxRC : REF.openstaxRL },
  ];
  return { outputs, steps, checks };
}

export const rcRlZamanSabiti: CalcDefinition = {
  id: "4.2",
  slug: "rc-rl-zaman-sabiti",
  category: "elektronik",
  title: "RC / RL zaman sabiti",
  description:
    "RC ve RL devrelerinde zaman sabitini, 5τ yerleşme süresini, şarj/deşarj sırasında belirli bir andaki gerilim ve akımı ve istenen seviyeye ulaşma süresini hesaplayın.",
  formulas: [
    { label: "Zaman sabiti", latex: "\\tau_{RC} = R \\cdot C, \\qquad \\tau_{RL} = \\frac{L}{R}" },
    { label: "RC şarj / deşarj", latex: "v_C(t) = V_s\\left(1 - e^{-t/\\tau}\\right), \\qquad v_C(t) = V_0 \\, e^{-t/\\tau}" },
    { label: "RL akım yükselmesi / sönümü", latex: "i_L(t) = \\frac{V_s}{R}\\left(1 - e^{-t/\\tau}\\right), \\qquad i_L(t) = \\frac{V_0}{R} \\, e^{-t/\\tau}" },
    { label: "Seviyeye ulaşma süresi", latex: "t_x = -\\tau \\ln(1 - x) \\;(\\text{şarj}), \\qquad t_x = -\\tau \\ln x \\;(\\text{deşarj})" },
    { label: "Yerleşme süresi", latex: "t_{\\text{yer}} \\approx 5\\tau \\quad (e^{-5} \\approx 0{,}0067)" },
    { label: "Depolanan enerji", latex: "E_C = \\tfrac{1}{2} C V^2, \\qquad E_L = \\tfrac{1}{2} L I^2" },
  ],
  references: [REF.openstaxRC, REF.openstaxRL],
  inputs: INPUTS,
  outputs: OUTPUTS,
  validate: (inputs) => validate(inputs),
  compute: (inputs) => compute(inputs),
};
