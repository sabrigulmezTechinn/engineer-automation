/**
 * KAPSAM 6.5 — Kremayer-pinyon ve konveyör gücü.
 *
 * Kremayer-pinyon: pinyon referans çapı d₀ = m·z (KHK Tablo 4.1); pinyonun bir devri kremayeri π·d₀ ilerletir,
 * v = ω·d₀/2 (= π·d₀·n). Tork → kuvvet: F = 2·T·η/d₀; kuvvet → tork: T = F·d₀/(2·η) (Oriental Motor
 * T_L = F·D/(2·η·i), i = 1). η = 1 iken F = 2T/d₀. Pinyon mili gücü P = T·ω.
 *
 * Konveyör (BASİTLEŞTİRİLMİŞ yöntem): F = m·g·(μ·cos α + sin α) + m·a (Oriental Motor F = F_A + m·g·(sin θ + μ·cos θ),
 * ivme terimi Newton'un ikinci yasası), P = F·v/η. Tambur torku T = F·D/2, tambur devri ω = 2v/D.
 * DIN 22101'in ayrıntılı direnç hesabı uygulanmaz; tek bir eşdeğer sürtünme katsayısı kullanılır. Eğim ≥ 0 ile
 * sınırlıdır: yük motoru sürdüğünde (iniş) P = F·v/η geçerli değildir.
 */
import { latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { G_N, REF, num, qNum, qOmega, specWriter } from "./tahrik-ortak";

export type KkHesap = "kremayer" | "konveyor";
export type KremayerBilinen = "tork" | "kuvvet";

const WHERE = "kremayer-konveyor-gucu";

const MESSAGES = {
  rackAssumption:
    "Düz dişli pinyon: referans çap d₀ = m·z. Verim dişli kavramasındaki kayıpları kapsar.",
  conveyorSimplified:
    "Basitleştirilmiş yöntem: tüm hareket dirençleri tek bir eşdeğer sürtünme katsayısıyla (μ) temsil edilir. DIN 22101'in ayrıntılı hesap yöntemi uygulanmamıştır; bant konveyör tasarımında standarda veya üreticiye başvurun.",
} as const;

/** Başlık ve baskı DIN Media katalog sayfasından: https://www.dinmedia.de/de/norm/din-22101/145598666 */
const DIN_22101: Reference = {
  standard: "DIN 22101:2011-12",
  title: "Stetigförderer — Gurtförderer für Schüttgüter — Grundlagen für die Berechnung und Auslegung",
  note: "Bant konveyörlerin hesap ve boyutlandırma esasları. Bu hesap standardın yöntemini uygulamaz; basitleştirilmiş yöntemdir. Standardın metni açılmadı (telifli).",
};

const ETA_UNITS = ["percent", "fraction"];

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "hesap",
    label: "Hesap",
    options: [
      { value: "kremayer", label: "Kremayer-pinyon" },
      { value: "konveyor", label: "Konveyör gücü (basitleştirilmiş)" },
    ],
    default: "kremayer",
  },
  // Kremayer-pinyon
  {
    kind: "number",
    key: "modul",
    label: "Modül",
    symbol: "m",
    dimension: "uzunluk",
    defaultUnit: "mm",
    units: ["mm"],
    default: 2,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "hesap", equals: "kremayer" },
  },
  {
    kind: "number",
    key: "z",
    label: "Pinyon diş sayısı",
    symbol: "z",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 20,
    min: 1,
    integer: true,
    visibleWhen: { key: "hesap", equals: "kremayer" },
  },
  {
    kind: "select",
    key: "bilinen",
    label: "Bilinen büyüklük",
    options: [
      { value: "tork", label: "Pinyon torku → kremayer kuvveti" },
      { value: "kuvvet", label: "Kremayer kuvveti → pinyon torku" },
    ],
    default: "tork",
    visibleWhen: { key: "hesap", equals: "kremayer" },
  },
  {
    kind: "number",
    key: "T",
    label: "Pinyon torku",
    symbol: "T",
    dimension: "tork",
    defaultUnit: "Nm",
    default: 10,
    min: 0,
    visibleWhen: { key: "bilinen", equals: "tork" },
  },
  {
    kind: "number",
    key: "F",
    label: "Kremayer kuvveti",
    symbol: "F",
    dimension: "kuvvet",
    defaultUnit: "N",
    default: 500,
    min: 0,
    visibleWhen: { key: "bilinen", equals: "kuvvet" },
  },
  {
    kind: "number",
    key: "n",
    label: "Pinyon devri",
    symbol: "n",
    dimension: "acisal_hiz",
    defaultUnit: "rpm",
    default: 100,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "hesap", equals: "kremayer" },
  },
  {
    kind: "number",
    key: "etaK",
    label: "Kremayer-pinyon verimi",
    symbol: "\\eta",
    dimension: "oran",
    defaultUnit: "percent",
    units: ETA_UNITS,
    default: 95,
    min: 0,
    minExclusive: true,
    max: 1,
    visibleWhen: { key: "hesap", equals: "kremayer" },
  },
  // Konveyör
  {
    kind: "number",
    key: "mKonv",
    label: "Taşınan toplam kütle",
    symbol: "m",
    dimension: "kutle",
    defaultUnit: "kg",
    default: 500,
    min: 0,
    minExclusive: true,
    help: "Banttaki yük + hareket eden bant ve taşıyıcı parçalar.",
    visibleWhen: { key: "hesap", equals: "konveyor" },
  },
  {
    kind: "number",
    key: "mu",
    label: "Eşdeğer sürtünme katsayısı",
    symbol: "\\mu",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 0.05,
    min: 0,
    help: "Tüm hareket dirençlerini temsil eden katsayı; bant–kızak/rulo düzenine göre üretici verisinden alınır (Oriental Motor örneklerinde kayar yüzey için 0,05).",
    visibleWhen: { key: "hesap", equals: "konveyor" },
  },
  {
    kind: "number",
    key: "egim",
    label: "Eğim açısı (yukarı)",
    symbol: "\\alpha",
    dimension: "aci",
    defaultUnit: "deg",
    units: ["deg", "rad"],
    default: 5,
    min: 0,
    max: Math.PI / 2,
    help: "Yükün yukarı taşındığı eğim; yatay konveyörde 0. İnişte (yük motoru sürdüğünde) bu yöntem geçerli değildir.",
    visibleWhen: { key: "hesap", equals: "konveyor" },
  },
  {
    kind: "number",
    key: "a",
    label: "Hızlanma ivmesi",
    symbol: "a",
    dimension: "ivme",
    defaultUnit: "m_s2",
    default: 0.5,
    min: 0,
    visibleWhen: { key: "hesap", equals: "konveyor" },
  },
  {
    kind: "number",
    key: "vBant",
    label: "Bant hızı",
    symbol: "v",
    dimension: "hiz",
    defaultUnit: "m_s",
    default: 0.5,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "hesap", equals: "konveyor" },
  },
  {
    kind: "number",
    key: "etaKonv",
    label: "Tahrik verimi",
    symbol: "\\eta",
    dimension: "oran",
    defaultUnit: "percent",
    units: ETA_UNITS,
    default: 85,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "Motor milinden banda kadar (redüktör, zincir/kayış, tambur) toplam verim.",
    visibleWhen: { key: "hesap", equals: "konveyor" },
  },
  {
    kind: "number",
    key: "Dtambur",
    label: "Tahrik tamburu çapı",
    symbol: "D",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 200,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "hesap", equals: "konveyor" },
  },
];

const OUTPUTS: OutputSpec[] = [
  // Kremayer
  { key: "d0", label: "Pinyon referans çapı", symbol: "d_0", dimension: "uzunluk", defaultUnit: "mm" },
  { key: "F", label: "Kremayer kuvveti", symbol: "F", dimension: "kuvvet", defaultUnit: "N" },
  { key: "T", label: "Pinyon torku", symbol: "T", dimension: "tork", defaultUnit: "Nm" },
  { key: "v", label: "Doğrusal hız", symbol: "v", dimension: "hiz", defaultUnit: "m_s" },
  { key: "P", label: "Pinyon mili gücü", symbol: "P", dimension: "guc", defaultUnit: "kW" },
  // Konveyör
  { key: "Fsabit", label: "Çekme kuvveti (sabit hız)", symbol: "F_{\\text{sabit}}", dimension: "kuvvet", defaultUnit: "N" },
  { key: "Fivme", label: "Çekme kuvveti (hızlanma)", symbol: "F_{\\text{ivme}}", dimension: "kuvvet", defaultUnit: "N" },
  { key: "Psabit", label: "Motor gücü (sabit hız)", symbol: "P_{\\text{sabit}}", dimension: "guc", defaultUnit: "kW" },
  { key: "Ptepe", label: "Motor gücü (hızlanma, tepe)", symbol: "P_{\\text{tepe}}", dimension: "guc", defaultUnit: "kW" },
  { key: "Ttambur", label: "Tambur torku (hızlanma)", symbol: "T_{\\text{tambur}}", dimension: "tork", defaultUnit: "Nm" },
  { key: "nTambur", label: "Tambur devri", symbol: "n_{\\text{tambur}}", dimension: "acisal_hiz", defaultUnit: "rpm" },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);

function computeRack(inputs: ComputeInputs) {
  const m = num(inputs, "modul", WHERE);
  const z = num(inputs, "z", WHERE);
  const omega = num(inputs, "n", WHERE);
  const eta = num(inputs, "etaK", WHERE);

  const d0 = m * z;
  const v = (omega * d0) / 2;
  const steps: Step[] = [
    {
      label: "Pinyon referans çapı",
      latex: `d_0 = m \\cdot z = ${qi("modul", m)} \\cdot ${latexNum(z, { decimals: 0 })} = ${qo("d0", d0)}`,
    },
  ];

  let F: number;
  let T: number;
  if (inputs.bilinen === "kuvvet") {
    F = num(inputs, "F", WHERE);
    T = (F * d0) / (2 * eta);
    steps.push({
      label: "Gerekli pinyon torku",
      latex: `T = \\frac{F \\cdot d_0}{2 \\cdot \\eta} = \\frac{${qi("F", F)} \\cdot ${qo("d0", d0)}}{2 \\cdot ${qNum(eta)}} = ${qo("T", T)}`,
    });
  } else {
    T = num(inputs, "T", WHERE);
    F = (2 * T * eta) / d0;
    steps.push({
      label: "Kremayer kuvveti",
      latex: `F = \\frac{2 \\cdot T \\cdot \\eta}{d_0} = \\frac{2 \\cdot ${qi("T", T)} \\cdot ${qNum(eta)}}{${qo("d0", d0)}} = ${qo("F", F)}`,
    });
  }
  const P = T * omega;
  steps.push(
    {
      label: "Doğrusal hız",
      latex: `v = \\omega \\cdot \\frac{d_0}{2} = ${qOmega(omega)} \\cdot \\frac{${qo("d0", d0)}}{2} = ${qo("v", v)}`,
    },
    {
      label: "Pinyon mili gücü",
      latex: `P = T \\cdot \\omega = ${qo("T", T)} \\cdot ${qOmega(omega)} = ${qo("P", P)}`,
    },
  );
  const checks: Check[] = [{ level: "ok", message: MESSAGES.rackAssumption }];
  return { outputs: { d0, F, T, v, P }, steps, checks };
}

function computeConveyor(inputs: ComputeInputs) {
  const m = num(inputs, "mKonv", WHERE);
  const mu = num(inputs, "mu", WHERE);
  const alpha = num(inputs, "egim", WHERE);
  const a = num(inputs, "a", WHERE);
  const v = num(inputs, "vBant", WHERE);
  const eta = num(inputs, "etaKonv", WHERE);
  const D = num(inputs, "Dtambur", WHERE);

  const Fsabit = m * G_N * (mu * Math.cos(alpha) + Math.sin(alpha));
  const Fivme = Fsabit + m * a;
  const Psabit = (Fsabit * v) / eta;
  const Ptepe = (Fivme * v) / eta;
  const Ttambur = (Fivme * D) / 2;
  const omegaT = (2 * v) / D;

  const gText = `${latexNum(G_N, { significant: 6 })}\\,\\mathrm{m/s^2}`;
  const steps: Step[] = [
    {
      label: "Çekme kuvveti (sabit hız)",
      latex: `F_{\\text{sabit}} = m \\cdot g \\cdot (\\mu \\cos\\alpha + \\sin\\alpha) = ${qi("mKonv", m)} \\cdot ${gText} \\cdot (${qNum(mu)} \\cdot \\cos ${qi("egim", alpha)} + \\sin ${qi("egim", alpha)}) = ${qo("Fsabit", Fsabit)}`,
    },
    {
      label: "Çekme kuvveti (hızlanma)",
      latex: `F_{\\text{ivme}} = F_{\\text{sabit}} + m \\cdot a = ${qo("Fsabit", Fsabit)} + ${qi("mKonv", m)} \\cdot ${qi("a", a)} = ${qo("Fivme", Fivme)}`,
    },
    {
      label: "Motor gücü",
      latex: `P_{\\text{sabit}} = \\frac{F_{\\text{sabit}} \\cdot v}{\\eta} = \\frac{${qo("Fsabit", Fsabit)} \\cdot ${qi("vBant", v)}}{${qNum(eta)}} = ${qo("Psabit", Psabit)}, \\qquad P_{\\text{tepe}} = \\frac{F_{\\text{ivme}} \\cdot v}{\\eta} = ${qo("Ptepe", Ptepe)}`,
    },
    {
      label: "Tambur torku ve devri",
      latex: `T_{\\text{tambur}} = F_{\\text{ivme}} \\cdot \\frac{D}{2} = ${qo("Fivme", Fivme)} \\cdot \\frac{${qi("Dtambur", D)}}{2} = ${qo("Ttambur", Ttambur)}, \\qquad \\omega_{\\text{tambur}} = \\frac{2v}{D} = ${qOmega(omegaT)} = ${qo("nTambur", omegaT)}`,
    },
  ];
  const checks: Check[] = [{ level: "ok", message: MESSAGES.conveyorSimplified, reference: DIN_22101 }];
  return { outputs: { Fsabit, Fivme, Psabit, Ptepe, Ttambur, nTambur: omegaT }, steps, checks };
}

export const kremayerKonveyorGucu: CalcDefinition = {
  id: "6.5",
  slug: "kremayer-pinyon-konveyor-gucu",
  category: "mekatronik",
  title: "Kremayer-pinyon ve konveyör gücü",
  description:
    "Kremayer-pinyonda referans çapı, kuvvet–tork dönüşümünü, doğrusal hızı ve gücü; konveyörde eğim, sürtünme ve ivmeden çekme kuvvetini, motor gücünü ve tambur torkunu basitleştirilmiş yöntemle hesaplayın.",
  formulas: [
    { label: "Pinyon referans çapı", latex: "d_0 = m \\cdot z" },
    { label: "Kremayer kuvveti", latex: "F = \\frac{2 \\cdot T}{d_0} \\cdot \\eta" },
    { label: "Doğrusal hız", latex: "v = \\pi \\cdot d_0 \\cdot n = \\omega \\cdot \\frac{d_0}{2}" },
    {
      label: "Konveyör çekme kuvveti (basitleştirilmiş)",
      latex: "F = m \\cdot g \\cdot (\\mu \\cos\\alpha + \\sin\\alpha) + m \\cdot a",
    },
    { label: "Motor gücü", latex: "P = \\frac{F \\cdot v}{\\eta}" },
  ],
  references: [REF.khk, REF.orientalMotor, DIN_22101],
  inputs: INPUTS,
  outputs: OUTPUTS,
  compute: (inputs) => (inputs.hesap === "konveyor" ? computeConveyor(inputs) : computeRack(inputs)),
};
