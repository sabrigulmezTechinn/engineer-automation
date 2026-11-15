/**
 * KAPSAM 6.1 — Dişli ve kayış-kasnak oranları.
 *
 * Dişli: kademe oranı i_k = z_sürülen/z_sürücü, toplam oran i = Π i_k (çok kademe). Çıkış devri n₂ = n₁/i;
 * çıkış torku T₂ = T₁·i·η_top, η_top = η_k^k (her kademede aynı verim). Güç korunumu: P₂ = P₁·η_top.
 * Kayış-kasnak: i = d₂/d₁ (hatve/datum çapları, kayma ihmal), kayış hızı v = ω₁·d₁/2 (= π·d₁·n₁).
 * Açık kayışta sarım açıları (tam geometri): β = arcsin((d₂ − d₁)/(2C)), θ₁ = π − 2β, θ₂ = π + 2β.
 * Kayış boyu: Gates Formula No. 13 yaklaşımı L ≈ 2C + (π/2)(D + d) + (D − d)²/(4C) (katalogda π/2 yerine 1,57);
 * karşılaştırma için tam geometrik boy L = √(4C² − (D − d)²) + (d₁θ₁ + d₂θ₂)/2 de verilir.
 * Hesap SI'dadır: devir rad/s gelir; π·d·n ve 60'lı biçimler yalnızca formül gösterimidir.
 */
import { latexNum, latexSpecOperand } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { REF, list, num, qNum, qOmega, qRad, specWriter } from "./tahrik-ortak";

export type OranTip = "disli" | "kayis";
export type DisliGiris = "dis" | "oran";

const WHERE = "disli-kayis-kasnak-oranlari";

const MESSAGES = {
  listLength: "Sürücü ve sürülen dişli listelerinde aynı sayıda değer olmalıdır (her kademe için bir çift).",
  pulleyOverlap:
    "Merkez mesafesi kasnak yarıçaplarının toplamından büyük olmalıdır: C > (d₁ + d₂)/2. Daha küçük mesafede kasnaklar çakışır.",
  gearAssumption:
    "Her kademede aynı verim kabul edildi (η_top = η^k). i > 1 redüktördür (devir düşer, tork artar); i < 1 hız artırıcıdır.",
  beltAssumption:
    "Kayma (slip) ihmal edildi; çaplar hatve (datum) çaplarıdır. Kayış boyu Gates Formula No. 13 yaklaşımıdır; standart kayış boyu seçildikten sonra merkez mesafesi yeniden hesaplanmalıdır.",
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "tip",
    label: "Aktarma türü",
    options: [
      { value: "disli", label: "Dişli (tek veya çok kademe)" },
      { value: "kayis", label: "Kayış-kasnak (açık kayış)" },
    ],
    default: "disli",
  },
  {
    kind: "select",
    key: "disliGiris",
    label: "Dişli kademeleri",
    options: [
      { value: "dis", label: "Diş sayılarıyla" },
      { value: "oran", label: "Kademe oranlarıyla" },
    ],
    default: "dis",
    visibleWhen: { key: "tip", equals: "disli" },
  },
  {
    kind: "numberList",
    key: "z1",
    label: "Sürücü dişli diş sayıları",
    symbol: "z_1",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: [20, 18],
    min: 1,
    integer: true,
    help: "Her kademenin giriş (sürücü) dişlisi, girişten çıkışa sırayla, noktalı virgülle ayrılmış.",
    visibleWhen: { key: "disliGiris", equals: "dis" },
  },
  {
    kind: "numberList",
    key: "z2",
    label: "Sürülen dişli diş sayıları",
    symbol: "z_2",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: [60, 54],
    min: 1,
    integer: true,
    help: "Her kademenin çıkış (sürülen) dişlisi, sürücü listesiyle aynı sırada.",
    visibleWhen: { key: "disliGiris", equals: "dis" },
  },
  {
    kind: "numberList",
    key: "oranlar",
    label: "Kademe oranları",
    symbol: "i_k",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: [3, 3],
    min: 0,
    minExclusive: true,
    help: "Her kademenin oranı (giriş devri / çıkış devri), noktalı virgülle ayrılmış.",
    visibleWhen: { key: "disliGiris", equals: "oran" },
  },
  {
    kind: "number",
    key: "etaKademe",
    label: "Kademe başına verim",
    symbol: "\\eta_k",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    default: 98,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "Bir dişli kademesinin verimi; dişli türüne ve yağlamaya göre üretici verisinden alınır.",
    visibleWhen: { key: "tip", equals: "disli" },
  },
  {
    kind: "number",
    key: "d1",
    label: "Sürücü kasnak çapı",
    symbol: "d_1",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 100,
    min: 0,
    minExclusive: true,
    help: "Motor tarafındaki kasnağın hatve (datum) çapı.",
    visibleWhen: { key: "tip", equals: "kayis" },
  },
  {
    kind: "number",
    key: "d2",
    label: "Sürülen kasnak çapı",
    symbol: "d_2",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 250,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "tip", equals: "kayis" },
  },
  {
    kind: "number",
    key: "C",
    label: "Merkez mesafesi",
    symbol: "C",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 500,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "tip", equals: "kayis" },
  },
  {
    kind: "number",
    key: "etaKayis",
    label: "Kayış aktarma verimi",
    symbol: "\\eta",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    default: 95,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "Kayış türüne göre üretici verisinden alınır.",
    visibleWhen: { key: "tip", equals: "kayis" },
  },
  {
    kind: "number",
    key: "n1",
    label: "Giriş devri",
    symbol: "n_1",
    dimension: "acisal_hiz",
    defaultUnit: "rpm",
    default: 1450,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "T1",
    label: "Giriş torku",
    symbol: "T_1",
    dimension: "tork",
    defaultUnit: "Nm",
    default: 20,
    min: 0,
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "i", label: "Toplam çevrim oranı", symbol: "i", dimension: "boyutsuz", defaultUnit: "unitless", significant: 6 },
  { key: "n2", label: "Çıkış devri", symbol: "n_2", dimension: "acisal_hiz", defaultUnit: "rpm" },
  { key: "T2", label: "Çıkış torku", symbol: "T_2", dimension: "tork", defaultUnit: "Nm" },
  {
    key: "etaTop",
    label: "Toplam verim",
    symbol: "\\eta_{\\text{top}}",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
  },
  { key: "P1", label: "Giriş gücü", symbol: "P_1", dimension: "guc", defaultUnit: "kW" },
  { key: "P2", label: "Çıkış gücü", symbol: "P_2", dimension: "guc", defaultUnit: "kW" },
  { key: "v", label: "Kayış hızı", symbol: "v", dimension: "hiz", defaultUnit: "m_s" },
  { key: "theta1", label: "Sürücü kasnakta sarım açısı", symbol: "\\theta_1", dimension: "aci", defaultUnit: "deg" },
  { key: "theta2", label: "Sürülen kasnakta sarım açısı", symbol: "\\theta_2", dimension: "aci", defaultUnit: "deg" },
  { key: "L", label: "Kayış boyu (Gates yaklaşımı)", symbol: "L", dimension: "uzunluk", defaultUnit: "mm", significant: 6 },
  {
    key: "Ltam",
    label: "Kayış boyu (tam geometri)",
    symbol: "L_{\\text{tam}}",
    dimension: "uzunluk",
    defaultUnit: "mm",
    significant: 6,
  },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);

function crossChecks(inputs: ComputeInputs): Check[] {
  if (inputs.tip === "disli" && inputs.disliGiris === "dis") {
    if (list(inputs, "z1", WHERE).length !== list(inputs, "z2", WHERE).length) {
      return [{ level: "hata", message: MESSAGES.listLength }];
    }
  }
  if (inputs.tip === "kayis") {
    const d1 = num(inputs, "d1", WHERE);
    const d2 = num(inputs, "d2", WHERE);
    if (num(inputs, "C", WHERE) <= (d1 + d2) / 2) return [{ level: "hata", message: MESSAGES.pulleyOverlap }];
  }
  return [];
}

/** n (rad/s) adımında devir gösterimi: kartla aynı dev/dk */
function speedSteps(i: number, w1: number, w2: number, T1: number, T2: number, eta: number, etaSym: string): Step[] {
  return [
    {
      label: "Çıkış devri",
      latex: `n_2 = \\frac{n_1}{i} = \\frac{${qi("n1", w1)}}{${latexNum(i, { significant: 6 })}} = ${qo("n2", w2)}`,
    },
    {
      label: "Çıkış torku",
      latex: `T_2 = T_1 \\cdot i \\cdot ${etaSym} = ${qi("T1", T1)} \\cdot ${latexNum(i, { significant: 6 })} \\cdot ${qNum(eta)} = ${qo("T2", T2)}`,
    },
  ];
}

function powerSteps(T1: number, w1: number, P1: number, P2: number, eta: number, etaSym: string): Step[] {
  return [
    {
      label: "Giriş gücü",
      latex: `P_1 = T_1 \\cdot \\omega_1 = ${qi("T1", T1)} \\cdot ${qOmega(w1)} = ${qo("P1", P1)}`,
    },
    { label: "Çıkış gücü", latex: `P_2 = P_1 \\cdot ${etaSym} = ${qo("P1", P1)} \\cdot ${qNum(eta)} = ${qo("P2", P2)}` },
  ];
}

function computeGear(inputs: ComputeInputs) {
  const w1 = num(inputs, "n1", WHERE);
  const T1 = num(inputs, "T1", WHERE);
  const etaK = num(inputs, "etaKademe", WHERE);
  const steps: Step[] = [];

  let ratios: number[];
  if (inputs.disliGiris === "oran") {
    ratios = list(inputs, "oranlar", WHERE);
    steps.push({
      label: "Toplam çevrim oranı",
      latex: `i = \\prod i_k = ${ratios.map((r) => latexNum(r, { significant: 6 })).join(" \\cdot ")} = ${latexNum(ratios.reduce((a, b) => a * b, 1), { significant: 6 })}`,
    });
  } else {
    const z1 = list(inputs, "z1", WHERE);
    const z2 = list(inputs, "z2", WHERE);
    ratios = z1.map((z, k) => z2[k] / z);
    const fractions = z1.map((z, k) => `\\frac{${latexNum(z2[k], { decimals: 0 })}}{${latexNum(z, { decimals: 0 })}}`);
    steps.push({
      label: ratios.length > 1 ? "Kademe oranları ve toplam oran" : "Çevrim oranı",
      latex: `i = \\prod \\frac{z_{2,k}}{z_{1,k}} = ${fractions.join(" \\cdot ")} = ${latexNum(ratios.reduce((a, b) => a * b, 1), { significant: 6 })}`,
    });
  }

  const k = ratios.length;
  const i = ratios.reduce((a, b) => a * b, 1);
  const etaTop = etaK ** k;
  const w2 = w1 / i;
  const T2 = T1 * i * etaTop;
  const P1 = T1 * w1;
  const P2 = P1 * etaTop;

  steps.push({
    label: "Toplam verim",
    latex: `\\eta_{\\text{top}} = \\eta_k^{\\,k} = ${qNum(etaK)}^{${k}} = ${qNum(etaTop)}`,
  });
  steps.push(...speedSteps(i, w1, w2, T1, T2, etaTop, "\\eta_{\\text{top}}"));
  steps.push(...powerSteps(T1, w1, P1, P2, etaTop, "\\eta_{\\text{top}}"));

  const checks: Check[] = [{ level: "bilgi", message: MESSAGES.gearAssumption }];
  return { outputs: { i, n2: w2, T2, etaTop, P1, P2 }, steps, checks };
}

function computeBelt(inputs: ComputeInputs) {
  const w1 = num(inputs, "n1", WHERE);
  const T1 = num(inputs, "T1", WHERE);
  const d1 = num(inputs, "d1", WHERE);
  const d2 = num(inputs, "d2", WHERE);
  const C = num(inputs, "C", WHERE);
  const eta = num(inputs, "etaKayis", WHERE);

  const i = d2 / d1;
  const w2 = w1 / i;
  const T2 = T1 * i * eta;
  const P1 = T1 * w1;
  const P2 = P1 * eta;
  const v = (w1 * d1) / 2;

  const beta = Math.asin((d2 - d1) / (2 * C));
  const theta1 = Math.PI - 2 * beta;
  const theta2 = Math.PI + 2 * beta;
  const D = Math.max(d1, d2);
  const d = Math.min(d1, d2);
  const L = 2 * C + (Math.PI / 2) * (D + d) + (D - d) ** 2 / (4 * C);
  const Ltam = Math.sqrt(4 * C * C - (D - d) ** 2) + (d1 * theta1 + d2 * theta2) / 2;

  const steps: Step[] = [
    {
      label: "Çevrim oranı",
      latex: `i = \\frac{d_2}{d_1} = \\frac{${qi("d2", d2)}}{${qi("d1", d1)}} = ${latexNum(i, { significant: 6 })}`,
    },
    ...speedSteps(i, w1, w2, T1, T2, eta, "\\eta"),
    ...powerSteps(T1, w1, P1, P2, eta, "\\eta"),
    {
      label: "Kayış hızı",
      latex: `v = \\omega_1 \\cdot \\frac{d_1}{2} = ${qOmega(w1)} \\cdot \\frac{${qi("d1", d1)}}{2} = ${qo("v", v)}`,
    },
    {
      label: "Sarım açıları",
      latex: `\\beta = \\arcsin\\frac{d_2 - d_1}{2C} = \\arcsin\\frac{${qi("d2", d2)} - ${qi("d1", d1)}}{2 \\cdot ${qi("C", C)}} = ${latexSpecOperand({ dimension: "aci", defaultUnit: "deg" }, beta)} \\qquad \\theta_1 = 180^\\circ - 2\\beta = ${qo("theta1", theta1)}, \\quad \\theta_2 = 180^\\circ + 2\\beta = ${qo("theta2", theta2)}`,
    },
    {
      label: "Kayış boyu (Gates Formula No. 13)",
      latex: `L \\approx 2C + \\frac{\\pi}{2}(D + d) + \\frac{(D - d)^2}{4C} = 2 \\cdot ${qi("C", C)} + \\frac{\\pi}{2}\\left(${qi("d1", D)} + ${qi("d1", d)}\\right) + \\frac{(${qi("d1", D)} - ${qi("d1", d)})^2}{4 \\cdot ${qi("C", C)}} = ${qo("L", L)}`,
    },
    {
      label: "Kayış boyu (tam geometri)",
      latex: `L_{\\text{tam}} = \\sqrt{4C^2 - (D - d)^2} + \\frac{d_1\\theta_1 + d_2\\theta_2}{2} = \\sqrt{4 \\cdot (${qi("C", C)})^2 - (${qi("d1", D - d)})^2} + \\frac{${qi("d1", d1)} \\cdot ${qRad(theta1)} + ${qi("d2", d2)} \\cdot ${qRad(theta2)}}{2} = ${qo("Ltam", Ltam)}`,
    },
  ];
  const checks: Check[] = [{ level: "bilgi", message: MESSAGES.beltAssumption }];
  return { outputs: { i, n2: w2, T2, P1, P2, v, theta1, theta2, L, Ltam }, steps, checks };
}

export const disliKayisKasnakOranlari: CalcDefinition = {
  id: "6.1",
  slug: "disli-kayis-kasnak-oranlari",
  category: "mekatronik",
  title: "Dişli ve kayış-kasnak oranları",
  description:
    "Tek veya çok kademeli dişli aktarmada toplam oranı, çıkış devrini ve torkunu; kayış-kasnak aktarmada oranı, kayış hızını, sarım açılarını ve kayış boyunu hesaplayın. Kademeler diş sayılarıyla veya oranlarla girilebilir.",
  formulas: [
    { label: "Dişli oranı (çok kademe)", latex: "i = \\prod_k \\frac{z_{2,k}}{z_{1,k}}" },
    { label: "Çıkış devri ve torku", latex: "n_2 = \\frac{n_1}{i}, \\qquad T_2 = T_1 \\cdot i \\cdot \\eta" },
    { label: "Kayış-kasnak oranı", latex: "i = \\frac{d_2}{d_1}" },
    { label: "Kayış hızı", latex: "v = \\pi \\cdot d_1 \\cdot n_1 = \\omega_1 \\cdot \\frac{d_1}{2}" },
    {
      label: "Sarım açıları (açık kayış)",
      latex: "\\theta_{1,2} = \\pi \\mp 2 \\arcsin\\frac{d_2 - d_1}{2C}",
    },
    {
      label: "Kayış boyu (Gates Formula No. 13)",
      latex: "L \\approx 2C + \\frac{\\pi}{2}(D + d) + \\frac{(D - d)^2}{4C}",
    },
  ],
  references: [REF.gates, REF.iso80000_4],
  inputs: INPUTS,
  outputs: OUTPUTS,
  validate: (inputs) => crossChecks(inputs),
  compute: (inputs) => {
    if (crossChecks(inputs).length > 0) return { outputs: {}, steps: [], checks: [] };
    return inputs.tip === "kayis" ? computeBelt(inputs) : computeGear(inputs);
  },
};
