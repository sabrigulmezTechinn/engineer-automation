/**
 * KAPSAM 4.3 — RC / LC filtre kesim frekansı.
 *
 * - RC birinci derece filtre: f_c = 1/(2πRC) (Microchip AN699, Figure 8: V_OUT/V_IN = 1/(1 + sRC)).
 *   Alçak geçiren: R seri, çıkış C üzerinden; yüksek geçiren: C seri, çıkış R üzerinden.
 * - RL birinci derece filtre: τ = L/R, f_c = R/(2πL). Alçak geçiren: L seri, çıkış R üzerinden; yüksek geçiren: R seri,
 *   çıkış L üzerinden.
 * - LC: f₀ = 1/(2π√(LC)) REZONANS frekansıdır (OpenStax §15.5 denklem 15.17), −3 dB kesim frekansı değildir; ayrıca
 *   karakteristik empedans Z₀ = √(L/C) verilir.
 * - Birinci derece kazanç ve faz (u = f/f_c):
 *   alçak geçiren H = 1/(1 + ju) → |H| = 1/√(1 + u²), φ = −arctan u;
 *   yüksek geçiren H = ju/(1 + ju) → |H| = u/√(1 + u²), φ = 90° − arctan u. Kazanç G = 20·log₁₀|H| dB.
 *   f = f_c'de |H| = 1/√2 → −3,0103 dB, φ = −45° (alçak) / +45° (yüksek).
 * - Ters hesap: hedef f_c ve C'den R = 1/(2π f_c C); seçilen E serisinde EN YAKIN standart değer ve o değerle gerçekleşen
 *   f_c ile sapması (kesim frekansında güvenli yön yoktur).
 * Kaynak empedansı sıfır, yük empedansı sonsuz kabul edilir.
 */
import { latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { standardNeighbours } from "../yardimci/standart-deger-serileri";
import { E_SERI_SECENEKLERI, REF, eSeri, num, opt, specText, specWriter } from "./temel-ortak";

export type FiltreMod = "rc" | "rl" | "lc" | "ters";
export type FiltreTip = "lp" | "hp";

/** Hüküm olmayan notlar (varsayım, yöntem, hatırlatma) */

const WHERE = "filtre-kesim-frekansi";

const MESSAGES = {
  topology: (text: string) =>
    `${text} Kaynak empedansı sıfır, yük empedansı sonsuz kabul edildi; yük direnci kesim frekansını değiştirir.`,
  lc: "f₀ ideal L ve C'nin rezonans frekansıdır, −3 dB kesim frekansı değildir. Bant genişliği devredeki dirence (kalite faktörü Q) bağlıdır.",
  nearest: (series: string, r: string, fc: string, dev: string) =>
    `${series} serisinde en yakın standart direnç ${r}; gerçekleşen kesim frekansı ${fc} (sapma ${dev}).`,
} as const;

const TOPOLOGY: Record<"rc" | "rl", Record<FiltreTip, string>> = {
  rc: {
    lp: "RC alçak geçiren: R seri, çıkış C üzerinden alınır.",
    hp: "RC yüksek geçiren: C seri, çıkış R üzerinden alınır.",
  },
  rl: {
    lp: "RL alçak geçiren: L seri, çıkış R üzerinden alınır.",
    hp: "RL yüksek geçiren: R seri, çıkış L üzerinden alınır.",
  },
};

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Hesap",
    options: [
      { value: "rc", label: "RC filtre (R ve C'den f_c)" },
      { value: "rl", label: "RL filtre (R ve L'den f_c)" },
      { value: "lc", label: "LC rezonans frekansı" },
      { value: "ters", label: "Ters hesap: hedef f_c ve C'den R" },
    ],
    default: "rc",
  },
  {
    kind: "select",
    key: "tip",
    label: "Filtre tipi",
    options: [
      { value: "lp", label: "Alçak geçiren" },
      { value: "hp", label: "Yüksek geçiren" },
    ],
    default: "lp",
    visibleWhen: { key: "mod", equals: ["rc", "rl", "ters"] },
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
    key: "Rl",
    label: "Direnç",
    symbol: "R",
    dimension: "direnc",
    defaultUnit: "ohm",
    units: ["mohm", "ohm", "kohm"],
    default: 100,
    min: 0,
    minExclusive: true,
    help: "Bobin sargı direnci dahil.",
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
    visibleWhen: { key: "mod", equals: ["rl", "lc"] },
  },
  {
    kind: "number",
    key: "fHedef",
    label: "Hedef kesim frekansı",
    symbol: "f_{c,\\text{hedef}}",
    dimension: "frekans",
    defaultUnit: "kHz",
    units: ["Hz", "kHz", "MHz"],
    default: 1,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "ters" },
  },
  {
    kind: "number",
    key: "C",
    label: "Kapasitans",
    symbol: "C",
    dimension: "kapasitans",
    defaultUnit: "nF",
    units: ["pF", "nF", "uF", "mF"],
    default: 10,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: ["rc", "lc", "ters"] },
  },
  {
    kind: "select",
    key: "seri",
    label: "Direnç serisi",
    options: E_SERI_SECENEKLERI,
    default: "E24",
    help: "Hesaplanan dirence en yakın standart değer seçilir.",
    visibleWhen: { key: "mod", equals: "ters" },
  },
  {
    kind: "number",
    key: "f",
    label: "Değerlendirme frekansı (kazanç ve faz)",
    symbol: "f",
    dimension: "frekans",
    defaultUnit: "kHz",
    units: ["Hz", "kHz", "MHz"],
    default: 1,
    min: 0,
    minExclusive: true,
    optional: true,
    help: "Bu frekanstaki birinci derece kazanç ve faz hesaplanır; boş bırakılabilir.",
    visibleWhen: { key: "mod", equals: ["rc", "rl", "ters"] },
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "fc", label: "Kesim frekansı (−3 dB)", symbol: "f_c", dimension: "frekans", defaultUnit: "Hz", units: ["Hz", "kHz", "MHz"] },
  { key: "R", label: "Hesaplanan direnç", symbol: "R", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Rstd", label: "Standart direnç (en yakın)", symbol: "R_{\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  {
    key: "fcStd",
    label: "Standart dirençle kesim frekansı",
    symbol: "f_{c,\\text{std}}",
    dimension: "frekans",
    defaultUnit: "Hz",
    units: ["Hz", "kHz", "MHz"],
  },
  { key: "sapma", label: "Kesim frekansı sapması", symbol: "\\delta", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
  { key: "tau", label: "Zaman sabiti", symbol: "\\tau", dimension: "zaman", defaultUnit: "s", units: ["ns", "us", "ms", "s"] },
  { key: "f0", label: "Rezonans frekansı", symbol: "f_0", dimension: "frekans", defaultUnit: "Hz", units: ["Hz", "kHz", "MHz"] },
  { key: "Z0", label: "Karakteristik empedans", symbol: "Z_0", dimension: "direnc", defaultUnit: "ohm" },
  { key: "H", label: "Genlik oranı", symbol: "|H|", dimension: "boyutsuz", defaultUnit: "unitless", units: ["unitless"] },
  { key: "G", label: "Kazanç", symbol: "G", dimension: "seviye_db", defaultUnit: "dB", units: ["dB"] },
  { key: "phi", label: "Faz açısı", symbol: "\\varphi", dimension: "aci", defaultUnit: "deg", units: ["deg", "rad"] },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);

/** Birinci derece filtrenin f'teki kazancı ve fazı; adımları ekler. */
function response(tip: FiltreTip, f: number, fc: number, fcKey: "fc" | "fcStd", steps: Step[]) {
  const u = f / fc;
  const root = Math.sqrt(1 + u * u);
  const H = tip === "lp" ? 1 / root : u / root;
  const G = 20 * Math.log10(H);
  const phi = tip === "lp" ? -Math.atan(u) : Math.PI / 2 - Math.atan(u);
  const fcSym = fcKey === "fc" ? "f_c" : "f_{c,\\text{std}}";
  steps.push(
    { label: "Normalize frekans", latex: `u = \\frac{f}{${fcSym}} = \\frac{${qi("f", f)}}{${qo(fcKey, fc)}} = ${latexNum(u)}` },
    tip === "lp"
      ? { label: "Genlik oranı", latex: `|H| = \\frac{1}{\\sqrt{1 + u^2}} = \\frac{1}{\\sqrt{1 + (${latexNum(u)})^2}} = ${qo("H", H)}` }
      : { label: "Genlik oranı", latex: `|H| = \\frac{u}{\\sqrt{1 + u^2}} = \\frac{${latexNum(u)}}{\\sqrt{1 + (${latexNum(u)})^2}} = ${qo("H", H)}` },
    { label: "Kazanç", latex: `G = 20 \\log_{10} |H| = 20 \\log_{10} ${qo("H", H)} = ${qo("G", G)}` },
    tip === "lp"
      ? { label: "Faz açısı", latex: `\\varphi = -\\arctan u = -\\arctan ${latexNum(u)} = ${qo("phi", phi)}` }
      : { label: "Faz açısı", latex: `\\varphi = 90^\\circ - \\arctan u = 90^\\circ - \\arctan ${latexNum(u)} = ${qo("phi", phi)}` },
  );
  return { H, G, phi };
}

function compute(inputs: ComputeInputs) {
  const mod = inputs.mod as FiltreMod;
  const steps: Step[] = [];
  const checks: Check[] = [];
  const outputs: Record<string, number> = {};

  if (mod === "lc") {
    const L = num(inputs, "L", WHERE);
    const C = num(inputs, "C", WHERE);
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const Z0 = Math.sqrt(L / C);
    steps.push(
      {
        label: "Rezonans frekansı",
        latex: `f_0 = \\frac{1}{2\\pi\\sqrt{L C}} = \\frac{1}{2\\pi\\sqrt{${qi("L", L)} \\cdot ${qi("C", C)}}} = ${qo("f0", f0)}`,
      },
      {
        label: "Karakteristik empedans",
        latex: `Z_0 = \\sqrt{\\frac{L}{C}} = \\sqrt{\\frac{${qi("L", L)}}{${qi("C", C)}}} = ${qo("Z0", Z0)}`,
      },
    );
    checks.push({ level: "bilgi", message: MESSAGES.lc, reference: REF.openstaxRezonans });
    return { outputs: { f0, Z0 }, steps, checks };
  }

  const tip = inputs.tip as FiltreTip;
  const f = opt(inputs, "f");
  let fc: number;
  let fcKey: "fc" | "fcStd" = "fc";

  if (mod === "rc") {
    const R = num(inputs, "R", WHERE);
    const C = num(inputs, "C", WHERE);
    const tau = R * C;
    fc = 1 / (2 * Math.PI * tau);
    steps.push(
      { label: "Zaman sabiti", latex: `\\tau = R \\cdot C = ${qi("R", R)} \\cdot ${qi("C", C)} = ${qo("tau", tau)}` },
      {
        label: "Kesim frekansı",
        latex: `f_c = \\frac{1}{2\\pi R C} = \\frac{1}{2\\pi \\cdot ${qi("R", R)} \\cdot ${qi("C", C)}} = ${qo("fc", fc)}`,
      },
    );
    Object.assign(outputs, { tau, fc });
    checks.push({ level: "bilgi", message: MESSAGES.topology(TOPOLOGY.rc[tip]), reference: REF.microchipAn699 });
  } else if (mod === "rl") {
    const R = num(inputs, "Rl", WHERE);
    const L = num(inputs, "L", WHERE);
    const tau = L / R;
    fc = R / (2 * Math.PI * L);
    steps.push(
      { label: "Zaman sabiti", latex: `\\tau = \\frac{L}{R} = \\frac{${qi("L", L)}}{${qi("Rl", R)}} = ${qo("tau", tau)}` },
      {
        label: "Kesim frekansı",
        latex: `f_c = \\frac{R}{2\\pi L} = \\frac{${qi("Rl", R)}}{2\\pi \\cdot ${qi("L", L)}} = ${qo("fc", fc)}`,
      },
    );
    Object.assign(outputs, { tau, fc });
    checks.push({ level: "bilgi", message: MESSAGES.topology(TOPOLOGY.rl[tip]), reference: REF.openstaxRL });
  } else {
    const fHedef = num(inputs, "fHedef", WHERE);
    const C = num(inputs, "C", WHERE);
    const series = eSeri(inputs, "seri", WHERE);
    const R = 1 / (2 * Math.PI * fHedef * C);
    const Rstd = standardNeighbours(R, series).nearest;
    const tau = Rstd * C;
    fc = 1 / (2 * Math.PI * tau);
    const sapma = (fc - fHedef) / fHedef;
    fcKey = "fcStd";
    steps.push(
      {
        label: "Gereken direnç",
        latex: `R = \\frac{1}{2\\pi f_{c,\\text{hedef}} C} = \\frac{1}{2\\pi \\cdot ${qi("fHedef", fHedef)} \\cdot ${qi("C", C)}} = ${qo("R", R)}`,
      },
      { label: `${series} serisinde en yakın standart değer`, latex: `R_{\\text{std}} = ${qo("Rstd", Rstd)}` },
      {
        label: "Standart dirençle kesim frekansı",
        latex: `f_{c,\\text{std}} = \\frac{1}{2\\pi R_{\\text{std}} C} = \\frac{1}{2\\pi \\cdot ${qo("Rstd", Rstd)} \\cdot ${qi("C", C)}} = ${qo("fcStd", fc)}`,
      },
      {
        label: "Sapma",
        latex: `\\delta = \\frac{f_{c,\\text{std}} - f_{c,\\text{hedef}}}{f_{c,\\text{hedef}}} = \\frac{${qo("fcStd", fc)} - ${qi("fHedef", fHedef)}}{${qi("fHedef", fHedef)}} = ${qo("sapma", sapma)}`,
      },
    );
    Object.assign(outputs, { R, Rstd, fcStd: fc, sapma, tau });
    checks.push(
      {
        level: "bilgi",
        message: MESSAGES.nearest(series, specText(OUTPUTS, "Rstd", Rstd), specText(OUTPUTS, "fcStd", fc), specText(OUTPUTS, "sapma", sapma)),
        reference: REF.eSerileri,
      },
      { level: "bilgi", message: MESSAGES.topology(TOPOLOGY.rc[tip]), reference: REF.microchipAn699 },
    );
  }

  if (f !== undefined) Object.assign(outputs, response(tip, f, fc, fcKey, steps));
  return { outputs, steps, checks };
}

export const filtreKesimFrekansi: CalcDefinition = {
  id: "4.3",
  slug: "filtre-kesim-frekansi",
  category: "elektronik",
  title: "RC / LC filtre kesim frekansı",
  description:
    "Birinci derece RC ve RL filtrelerin kesim frekansını, verilen frekanstaki kazancı (dB) ve fazı, LC devrenin rezonans frekansını hesaplayın; hedef kesim frekansı için E serisinden standart direnç seçin.",
  formulas: [
    { label: "RC kesim frekansı", latex: "f_c = \\frac{1}{2\\pi R C}" },
    { label: "RL kesim frekansı", latex: "f_c = \\frac{R}{2\\pi L}" },
    { label: "LC rezonans frekansı (−3 dB değil)", latex: "f_0 = \\frac{1}{2\\pi\\sqrt{L C}}, \\qquad Z_0 = \\sqrt{\\frac{L}{C}}" },
    {
      label: "Alçak geçiren (1. derece)",
      latex: "H = \\frac{1}{1 + j u}, \\quad |H| = \\frac{1}{\\sqrt{1 + u^2}}, \\quad \\varphi = -\\arctan u, \\quad u = \\frac{f}{f_c}",
    },
    {
      label: "Yüksek geçiren (1. derece)",
      latex: "H = \\frac{j u}{1 + j u}, \\quad |H| = \\frac{u}{\\sqrt{1 + u^2}}, \\quad \\varphi = 90^\\circ - \\arctan u",
    },
    { label: "Kazanç", latex: "G = 20 \\log_{10} |H| \\;\\text{dB}" },
    { label: "Ters hesap", latex: "R = \\frac{1}{2\\pi f_c C}" },
  ],
  references: [REF.microchipAn699, REF.openstaxRezonans, REF.eSerileri],
  inputs: INPUTS,
  outputs: OUTPUTS,
  compute: (inputs) => compute(inputs),
};
