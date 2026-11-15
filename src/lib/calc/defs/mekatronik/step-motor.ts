/**
 * KAPSAM 6.3 — Step motor.
 *
 * - Adım/devir: N = (360°/θ)·m (θ: tam adım açısı, m: mikroadım bölmesi); SI'da N = 2π·m/θ (θ radyan).
 * - Darbe frekansı ↔ devir: f = N·ω/(2π) (= N·n), ω = 2π·f/N.
 * - Doğrusal çözünürlük (redüksiyon i = motor devri / mekanizma devri): vida Δx = P_h/(N·i),
 *   kasnak/pinyon Δx = π·D/(N·i); doğrudan döner yükte çıkış açısı Δφ = θ/(m·i). THK denklem (56)
 *   E = 360·S/(P_h·A) ile aynı ilişkidir (A = 1/i); darbe hızı f = V/S (THK denklem 57).
 * - Gerekli tork (Oriental Motor): T_M = (T_L + T_a)·S_f, T_a = (J_rotor + J_yük)·α, α = ω/t (sıfırdan
 *   doğrusal rampa). S_f varsayılanı THK önerisi: hesaplanan tork normalde iki katına çıkarılır (config).
 * Yük torku ve yük ataleti motor miline indirgenmiş olarak girilir (vidalı mil için 6.2, redüktör için 6.4).
 */
import { LIMITS } from "@/config/sinirlar";
import { latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { REF, num, qNum, qOmega, specWriter } from "./tahrik-ortak";

export type StepHizGirdi = "devir" | "frekans";
export type StepMekanizma = "dogrudan" | "vida" | "kasnak";

const WHERE = "step-motor";

const MESSAGES = {
  nonInteger: (n: string) =>
    `Adım/devir tam sayı değil (${n}): adım açısı ve mikroadım bölmesi motor/sürücü veri sayfasıyla uyumlu olmalıdır.`,
  assumptions:
    "Hızlanma sıfırdan doğrusal rampa kabul edildi (başlangıç darbe hızı 0). Gerekli tork, motorun hız–tork eğrisinde çalışma devrinde sağlanmalıdır (THK).",
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "number",
    key: "theta",
    label: "Tam adım açısı",
    symbol: "\\theta",
    dimension: "aci",
    defaultUnit: "deg",
    units: ["deg", "rad"],
    default: 1.8,
    min: 0,
    minExclusive: true,
    max: 2 * Math.PI,
    help: "Motor veri sayfasındaki adım açısı (ör. 1,8° = 200 adım/devir, 0,9° = 400 adım/devir).",
  },
  {
    kind: "number",
    key: "mikro",
    label: "Mikroadım bölmesi",
    symbol: "m",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 16,
    min: 1,
    integer: true,
    help: "Sürücüde seçilen bölme (tam adım = 1, yarım adım = 2, …).",
  },
  {
    kind: "select",
    key: "hizGirdi",
    label: "Hız girdisi",
    options: [
      { value: "devir", label: "Motor devri" },
      { value: "frekans", label: "Darbe frekansı" },
    ],
    default: "devir",
  },
  {
    kind: "number",
    key: "n",
    label: "Motor devri",
    symbol: "n",
    dimension: "acisal_hiz",
    defaultUnit: "rpm",
    default: 300,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "hizGirdi", equals: "devir" },
  },
  {
    kind: "number",
    key: "f",
    label: "Darbe frekansı",
    symbol: "f",
    dimension: "frekans",
    defaultUnit: "Hz",
    units: ["Hz", "kHz"],
    default: 16000,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "hizGirdi", equals: "frekans" },
  },
  {
    kind: "select",
    key: "mekanizma",
    label: "Mekanizma",
    options: [
      { value: "dogrudan", label: "Döner yük (doğrudan veya redüktörlü)" },
      { value: "vida", label: "Vidalı mil" },
      { value: "kasnak", label: "Kayış-kasnak veya kremayer-pinyon" },
    ],
    default: "vida",
  },
  {
    kind: "number",
    key: "Ph",
    label: "Vida hatvesi",
    symbol: "P_h",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 5,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mekanizma", equals: "vida" },
  },
  {
    kind: "number",
    key: "D",
    label: "Kasnak / pinyon çapı",
    symbol: "D",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 30,
    min: 0,
    minExclusive: true,
    help: "Kayışta hatve çapı, kremayerde pinyon referans çapı (d = m·z).",
    visibleWhen: { key: "mekanizma", equals: "kasnak" },
  },
  {
    kind: "number",
    key: "i",
    label: "Redüksiyon oranı",
    symbol: "i",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 1,
    min: 0,
    minExclusive: true,
    help: "Motor devri / mekanizma devri (doğrudan bağlıysa 1).",
  },
  {
    kind: "number",
    key: "TL",
    label: "Yük torku (motor milinde)",
    symbol: "T_L",
    dimension: "tork",
    defaultUnit: "Nm",
    default: 0.2,
    min: 0,
  },
  {
    kind: "number",
    key: "Jr",
    label: "Rotor ataleti",
    symbol: "J_{\\text{rotor}}",
    dimension: "atalet",
    defaultUnit: "kgcm2",
    default: 0.3,
    min: 0,
  },
  {
    kind: "number",
    key: "JL",
    label: "Yük ataleti (motor miline indirgenmiş)",
    symbol: "J_{\\text{yük}}",
    dimension: "atalet",
    defaultUnit: "kgcm2",
    default: 1,
    min: 0,
  },
  {
    kind: "number",
    key: "t",
    label: "Hızlanma süresi",
    symbol: "t",
    dimension: "zaman",
    defaultUnit: "s",
    default: 0.1,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "Sf",
    label: "Emniyet katsayısı",
    symbol: "S_f",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: LIMITS.mekatronikTahrik.stepEmniyetKatsayisi,
    min: 1,
    help: "THK: hesaplanan tork normalde iki katına çıkarılır (motora göre değişir).",
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "N", label: "Adım/devir", symbol: "N", dimension: "boyutsuz", defaultUnit: "unitless", integer: true },
  { key: "dTheta", label: "Mikroadım açısı", symbol: "\\Delta\\theta", dimension: "aci", defaultUnit: "deg", significant: 6 },
  { key: "f", label: "Darbe frekansı", symbol: "f", dimension: "frekans", defaultUnit: "Hz", units: ["Hz", "kHz"] },
  { key: "n", label: "Motor devri", symbol: "n", dimension: "acisal_hiz", defaultUnit: "rpm" },
  { key: "nCikis", label: "Çıkış devri", symbol: "n_{\\text{çıkış}}", dimension: "acisal_hiz", defaultUnit: "rpm" },
  { key: "dPhi", label: "Çıkışta açısal çözünürlük", symbol: "\\Delta\\varphi", dimension: "aci", defaultUnit: "deg", significant: 6 },
  { key: "dx", label: "Doğrusal çözünürlük", symbol: "\\Delta x", dimension: "uzunluk", defaultUnit: "um", units: ["um", "mm"], significant: 6 },
  { key: "v", label: "Doğrusal hız", symbol: "v", dimension: "hiz", defaultUnit: "mm_s" },
  { key: "alfa", label: "Açısal ivme", symbol: "\\alpha", dimension: "acisal_ivme", defaultUnit: "rad_s2" },
  { key: "Ta", label: "Hızlanma torku", symbol: "T_a", dimension: "tork", defaultUnit: "Nm" },
  { key: "TM", label: "Gerekli motor torku", symbol: "T_M", dimension: "tork", defaultUnit: "Nm" },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);

function compute(inputs: ComputeInputs) {
  const theta = num(inputs, "theta", WHERE);
  const m = num(inputs, "mikro", WHERE);
  const i = num(inputs, "i", WHERE);
  const TL = num(inputs, "TL", WHERE);
  const Jr = num(inputs, "Jr", WHERE);
  const JL = num(inputs, "JL", WHERE);
  const t = num(inputs, "t", WHERE);
  const Sf = num(inputs, "Sf", WHERE);
  const mech = inputs.mekanizma as StepMekanizma;

  const N = (2 * Math.PI * m) / theta;
  const dTheta = theta / m;
  const steps: Step[] = [
    {
      label: "Adım/devir",
      latex: `N = \\frac{360^\\circ}{\\theta} \\cdot m = \\frac{360^\\circ}{${qi("theta", theta)}} \\cdot ${latexNum(m, { decimals: 0 })} = ${latexNum(N, { significant: 6 })}`,
    },
    {
      label: "Mikroadım açısı",
      latex: `\\Delta\\theta = \\frac{\\theta}{m} = \\frac{${qi("theta", theta)}}{${latexNum(m, { decimals: 0 })}} = ${qo("dTheta", dTheta)}`,
    },
  ];
  const checks: Check[] = [];
  if (Math.abs(N - Math.round(N)) > 1e-6 * N) {
    checks.push({ level: "uyari", message: MESSAGES.nonInteger(String(Number(N.toPrecision(6))).replace(".", ",")) });
  }

  let omega: number;
  let f: number;
  if (inputs.hizGirdi === "frekans") {
    f = num(inputs, "f", WHERE);
    omega = (2 * Math.PI * f) / N;
    steps.push({
      label: "Motor devri",
      latex: `n = \\frac{f}{N} = \\frac{${qi("f", f)}}{${latexNum(N, { significant: 6 })}} = ${qo("n", omega)}`,
    });
  } else {
    omega = num(inputs, "n", WHERE);
    f = (N * omega) / (2 * Math.PI);
    steps.push({
      label: "Darbe frekansı",
      latex: `f = N \\cdot n = ${latexNum(N, { significant: 6 })} \\cdot ${qi("n", omega)} = ${qo("f", f)}`,
    });
  }

  const outputs: Record<string, number> = { N, dTheta, f, n: omega };
  const revOut = omega / (2 * Math.PI * i); // mekanizma devri, dev/s
  if (mech === "dogrudan") {
    const dPhi = theta / (m * i);
    const nCikis = omega / i;
    steps.push(
      {
        label: "Çıkış devri",
        latex: `n_{\\text{çıkış}} = \\frac{n}{i} = \\frac{${qo("n", omega)}}{${qNum(i)}} = ${qo("nCikis", nCikis)}`,
      },
      {
        label: "Çıkışta açısal çözünürlük",
        latex: `\\Delta\\varphi = \\frac{\\theta}{m \\cdot i} = \\frac{${qi("theta", theta)}}{${latexNum(m, { decimals: 0 })} \\cdot ${qNum(i)}} = ${qo("dPhi", dPhi)}`,
      },
    );
    Object.assign(outputs, { dPhi, nCikis });
  } else {
    const strokePerRev = mech === "vida" ? num(inputs, "Ph", WHERE) : Math.PI * num(inputs, "D", WHERE);
    const strokeLatex = mech === "vida" ? `P_h` : `\\pi \\cdot D`;
    const strokeValue = mech === "vida" ? qi("Ph", strokePerRev) : `\\pi \\cdot ${qi("D", strokePerRev / Math.PI)}`;
    const dx = strokePerRev / (N * i);
    const v = revOut * strokePerRev;
    steps.push(
      {
        label: "Doğrusal çözünürlük (adım başına ilerleme)",
        latex: `\\Delta x = \\frac{${strokeLatex}}{N \\cdot i} = \\frac{${strokeValue}}{${latexNum(N, { significant: 6 })} \\cdot ${qNum(i)}} = ${qo("dx", dx)}`,
      },
      {
        label: "Doğrusal hız",
        latex: `v = \\frac{n}{i} \\cdot ${strokeLatex} = f \\cdot \\Delta x = ${qo("f", f)} \\cdot ${qo("dx", dx)} = ${qo("v", v)}`,
      },
    );
    Object.assign(outputs, { dx, v });
  }

  const alfa = omega / t;
  const J = Jr + JL;
  const Ta = J * alfa;
  const TM = (TL + Ta) * Sf;
  steps.push(
    {
      label: "Açısal ivme (doğrusal rampa)",
      latex: `\\alpha = \\frac{\\omega}{t} = \\frac{${qOmega(omega)}}{${qi("t", t)}} = ${qo("alfa", alfa)}`,
    },
    {
      label: "Hızlanma torku",
      latex: `T_a = (J_{\\text{rotor}} + J_{\\text{yük}}) \\cdot \\alpha = (${qi("Jr", Jr)} + ${qi("JL", JL)}) \\cdot ${qo("alfa", alfa)} = ${qo("Ta", Ta)}`,
    },
    {
      label: "Gerekli motor torku",
      latex: `T_M = (T_L + T_a) \\cdot S_f = (${qi("TL", TL)} + ${qo("Ta", Ta)}) \\cdot ${qNum(Sf)} = ${qo("TM", TM)}`,
    },
  );
  Object.assign(outputs, { alfa, Ta, TM });
  checks.push({ level: "bilgi", message: MESSAGES.assumptions });
  return { outputs, steps, checks };
}

export const stepMotor: CalcDefinition = {
  id: "6.3",
  slug: "step-motor",
  category: "mekatronik",
  title: "Step motor",
  description:
    "Step motorda adım/devir ve mikroadım açısını, darbe frekansı ile devir ilişkisini, vidalı mil veya kasnakla doğrusal çözünürlüğü ve hızı, yük ve hızlanma torkundan emniyet katsayısıyla gerekli motor torkunu hesaplayın.",
  formulas: [
    { label: "Adım/devir", latex: "N = \\frac{360^\\circ}{\\theta} \\cdot m" },
    { label: "Darbe frekansı", latex: "f = N \\cdot n = \\frac{N \\cdot \\omega}{2\\pi}" },
    {
      label: "Doğrusal çözünürlük",
      latex: "\\Delta x = \\frac{P_h}{N \\cdot i} \\;(\\text{vida}), \\qquad \\Delta x = \\frac{\\pi D}{N \\cdot i} \\;(\\text{kasnak, pinyon})",
    },
    { label: "Hızlanma torku", latex: "T_a = (J_{\\text{rotor}} + J_{\\text{yük}}) \\cdot \\alpha, \\qquad \\alpha = \\frac{\\omega}{t}" },
    { label: "Gerekli motor torku", latex: "T_M = (T_L + T_a) \\cdot S_f" },
  ],
  references: [REF.orientalMotor, REF.thkMotor],
  inputs: INPUTS,
  outputs: OUTPUTS,
  compute: (inputs) => compute(inputs),
};
