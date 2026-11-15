/**
 * KAPSAM 1.2 — Seri/paralel R, C, L.
 *
 * Direnç ve bobin: seri Σxᵢ, paralel (Σ1/xᵢ)⁻¹. Kondansatör tersidir: paralel ΣCᵢ, seri (Σ1/Cᵢ)⁻¹.
 * Bobinlerde karşılıklı endüktans (manyetik kuplaj) ihmal edilir.
 */
import { latexAuto } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, OutputSpec } from "@/lib/calc/types";
import type { Dimension } from "@/lib/units";

export type Bilesen = "direnc" | "kondansator" | "bobin";
export type Baglanti = "seri" | "paralel";

interface BilesenBilgi {
  /** Liste girdisinin ve çıktının sembol harfi */
  letter: "R" | "C" | "L";
  dimension: Dimension;
  output: string;
  /** Bu bağlantıda değerler doğrudan toplanır mı (aksi halde terslerin toplamının tersi) */
  sums: (b: Baglanti) => boolean;
}

const BILESEN: Record<Bilesen, BilesenBilgi> = {
  direnc: { letter: "R", dimension: "direnc", output: "Req", sums: (b) => b === "seri" },
  bobin: { letter: "L", dimension: "enduktans", output: "Leq", sums: (b) => b === "seri" },
  kondansator: { letter: "C", dimension: "kapasitans", output: "Ceq", sums: (b) => b === "paralel" },
};

const MESSAGES = {
  mutual:
    "Bobinler arasındaki karşılıklı endüktans (manyetik kuplaj) ihmal edildi. Kuplajlı bobinlerde eşdeğer endüktans, sargı yönlerine göre karşılıklı endüktansın iki katı kadar artar veya azalır.",
  seriesCaps:
    "Seri kondansatörlerde gerilim kapasitansla ters orantılı paylaşılır: en küçük kondansatör en yüksek gerilimi taşır. Gerilim sınıflarını buna göre seçin.",
} as const;

/** Adımda en fazla bu kadar terim açık yazılır; fazlası "⋯" ile kısaltılır. */
const MAX_TERMS = 6;

function list(inputs: ComputeInputs, key: string): number[] {
  const v = inputs[key];
  if (!Array.isArray(v)) throw new Error(`seri-paralel: "${key}" liste değil`);
  return v;
}

/** Terim listesini kısaltır: a, b, c, ⋯, z */
function terms(items: string[]): string[] {
  if (items.length <= MAX_TERMS) return items;
  return [...items.slice(0, 3), "\\cdots", items[items.length - 1]];
}

const OUT = "_{\\text{eş}}";

const OUTPUTS: OutputSpec[] = [
  { key: "Req", label: "Eşdeğer direnç", symbol: `R${OUT}`, dimension: "direnc", defaultUnit: "ohm" },
  { key: "Ceq", label: "Eşdeğer kapasitans", symbol: `C${OUT}`, dimension: "kapasitans", defaultUnit: "uF" },
  { key: "Leq", label: "Eşdeğer endüktans", symbol: `L${OUT}`, dimension: "enduktans", defaultUnit: "mH" },
];

export const seriParalel: CalcDefinition = {
  id: "1.2",
  slug: "seri-paralel",
  category: "temel-elektrik",
  title: "Seri/paralel R, C, L",
  description:
    "Seri veya paralel bağlı dirençlerin, kondansatörlerin ya da bobinlerin eşdeğer değerini hesaplayın. Değerleri noktalı virgülle ayırarak girin. Bobinlerde karşılıklı endüktans ihmal edilir.",
  formulas: [
    { label: "Seri direnç / bobin", latex: "R_{\\text{eş}} = \\sum_{i=1}^{n} R_i, \\quad L_{\\text{eş}} = \\sum_{i=1}^{n} L_i" },
    {
      label: "Paralel direnç / bobin",
      latex: "\\frac{1}{R_{\\text{eş}}} = \\sum_{i=1}^{n} \\frac{1}{R_i}, \\quad \\frac{1}{L_{\\text{eş}}} = \\sum_{i=1}^{n} \\frac{1}{L_i}",
    },
    { label: "Paralel kondansatör", latex: "C_{\\text{eş}} = \\sum_{i=1}^{n} C_i" },
    { label: "Seri kondansatör", latex: "\\frac{1}{C_{\\text{eş}}} = \\sum_{i=1}^{n} \\frac{1}{C_i}" },
  ],
  references: [
    {
      standard: "IEC 60050-131",
      title: "Uluslararası Elektroteknik Sözlük (IEV) — Bölüm 131: Devre teorisi",
      note: "Seri ve paralel bağlantı, direnç, kapasitans ve endüktans terimleri",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "bilesen",
      label: "Bileşen",
      options: [
        { value: "direnc", label: "Direnç (R)" },
        { value: "kondansator", label: "Kondansatör (C)" },
        { value: "bobin", label: "Bobin (L)" },
      ],
      default: "direnc",
    },
    {
      kind: "select",
      key: "baglanti",
      label: "Bağlantı",
      options: [
        { value: "seri", label: "Seri" },
        { value: "paralel", label: "Paralel" },
      ],
      default: "paralel",
    },
    {
      kind: "numberList",
      key: "R",
      label: "Dirençler",
      symbol: "R_i",
      dimension: "direnc",
      defaultUnit: "ohm",
      default: [100, 220, 470],
      min: 0,
      minExclusive: true,
      minItems: 2,
      help: "Değerleri noktalı virgülle ayırın, ör. 100; 220; 470.",
      visibleWhen: { key: "bilesen", equals: "direnc" },
    },
    {
      kind: "numberList",
      key: "C",
      label: "Kondansatörler",
      symbol: "C_i",
      dimension: "kapasitans",
      defaultUnit: "uF",
      default: [10, 22, 47],
      min: 0,
      minExclusive: true,
      minItems: 2,
      help: "Değerleri noktalı virgülle ayırın, ör. 10; 22; 47.",
      visibleWhen: { key: "bilesen", equals: "kondansator" },
    },
    {
      kind: "numberList",
      key: "L",
      label: "Bobinler",
      symbol: "L_i",
      dimension: "enduktans",
      defaultUnit: "mH",
      default: [1, 2.2, 4.7],
      min: 0,
      minExclusive: true,
      minItems: 2,
      help: "Değerleri noktalı virgülle ayırın, ör. 1; 2,2; 4,7.",
      visibleWhen: { key: "bilesen", equals: "bobin" },
    },
  ],
  outputs: OUTPUTS,

  compute: (inputs) => {
    const bilesen = inputs.bilesen as Bilesen;
    const baglanti = inputs.baglanti as Baglanti;
    const info = BILESEN[bilesen];
    if (!info) throw new Error(`seri-paralel: bilinmeyen bileşen "${String(bilesen)}"`);
    const values = list(inputs, info.letter);
    const n = values.length;
    const sums = info.sums(baglanti);

    const result = sums ? values.reduce((a, x) => a + x, 0) : 1 / values.reduce((a, x) => a + 1 / x, 0);

    const x = info.letter;
    const q = (v: number) => latexAuto(v, info.dimension);
    const symbolTerms = n <= MAX_TERMS ? values.map((_, i) => `${x}_{${i + 1}}`) : null;
    const valueTerms = terms(values.map(q));
    let latex: string;
    if (sums) {
      const symbolic = symbolTerms ? symbolTerms.join(" + ") : `\\sum_{i=1}^{${n}} ${x}_i`;
      latex = `${x}${OUT} = ${symbolic} = ${valueTerms.join(" + ")} = ${q(result)}`;
    } else {
      const recip = (t: string) => (t === "\\cdots" ? t : `\\frac{1}{${t}}`);
      const symbolic = symbolTerms
        ? `\\left(${symbolTerms.map(recip).join(" + ")}\\right)^{-1}`
        : `\\left(\\sum_{i=1}^{${n}} \\frac{1}{${x}_i}\\right)^{-1}`;
      latex = `${x}${OUT} = ${symbolic} = \\left(${valueTerms.map(recip).join(" + ")}\\right)^{-1} = ${q(result)}`;
    }

    const checks: Check[] = [];
    if (bilesen === "bobin") checks.push({ level: "ok", message: MESSAGES.mutual });
    if (bilesen === "kondansator" && baglanti === "seri") checks.push({ level: "ok", message: MESSAGES.seriesCaps });

    const label = `${baglanti === "seri" ? "Seri" : "Paralel"} eşdeğer (${n} eleman)`;
    return { outputs: { [info.output]: result }, steps: [{ label, latex }], checks };
  },
};
