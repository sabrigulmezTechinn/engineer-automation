/**
 * KAPSAM 3.1 — Güç–tork–devir.
 * Mil gücü, tork ve devir hızından bilinen ikisiyle üçüncüsü hesaplanır.
 *
 * Hesap SI'da yapılır: P [W] = T [N·m] · ω [rad/s]. Devir hızı compute'a zaten rad/s olarak gelir.
 * T = 9550·P/n mühendislik formu yalnızca kW ve dev/dk için geçerlidir ve 60000/(2π) ≈ 9549,3
 * sayısının yuvarlatılmış halidir; formüllerde gösterim için yer alır, hesapta kullanılmaz.
 */
import { latexAuto } from "@/lib/calc/latex";
import type { CalcDefinition, Step } from "@/lib/calc/types";
import { num, qOmega, qRpm } from "./ortak";

export type GtdMode = "P-n" | "T-n" | "P-T";

const MODE_OPTIONS: { value: GtdMode; label: string }[] = [
  { value: "P-n", label: "Güç ve devir biliniyor → tork" },
  { value: "T-n", label: "Tork ve devir biliniyor → güç" },
  { value: "P-T", label: "Güç ve tork biliniyor → devir" },
];

const WHERE = "guc-tork-devir";

const qP = (v: number) => latexAuto(v, "guc");
const qT = (v: number) => latexAuto(v, "tork");

/** n (dev/dk) → ω adımı */
function omegaStep(omega: number): Step {
  return {
    label: "Açısal hız",
    latex: `\\omega = \\frac{2\\pi \\cdot n}{60} = \\frac{2\\pi \\cdot ${qRpm(omega)}}{60} = ${qOmega(omega)}`,
  };
}

export const gucTorkDevir: CalcDefinition = {
  id: "3.1",
  slug: "guc-tork-devir",
  category: "motor",
  title: "Güç–tork–devir",
  description:
    "Motor milindeki güç, tork ve devir hızından bilinen ikisini girerek üçüncüsünü hesaplayın. Hesap SI birimlerinde (P = T·ω) yapılır; kW, hp, PS, N·m, kgf·m, lbf·ft ve dev/dk gibi birimler girişte ve sonuçta seçilebilir.",
  formulas: [
    { label: "Güç–tork ilişkisi (SI)", latex: "P = T \\cdot \\omega" },
    { label: "Açısal hız (n: dev/dk)", latex: "\\omega = \\frac{2\\pi \\cdot n}{60}" },
    {
      label: "Mühendislik formu (yalnızca kW ve dev/dk ile; 9550 ≈ 60000/2π)",
      latex: "T\\,[\\mathrm{N\\cdot m}] = \\frac{9550 \\cdot P\\,[\\mathrm{kW}]}{n\\,[\\mathrm{dev/dk}]}",
    },
  ],
  references: [
    {
      standard: "ISO 80000-4",
      title: "Büyüklükler ve birimler — Bölüm 4: Mekanik",
      note: "Tork ve güç büyüklüklerinin tanımları",
    },
    {
      standard: "ISO 80000-3",
      title: "Büyüklükler ve birimler — Bölüm 3: Uzay ve zaman",
      note: "Açısal hız (ω) ve dönme frekansı (n) tanımları",
    },
  ],
  inputs: [
    { kind: "select", key: "mod", label: "Bilinen büyüklükler", options: MODE_OPTIONS, default: "P-n" },
    {
      kind: "number",
      key: "P",
      label: "Mil gücü",
      symbol: "P",
      dimension: "guc",
      defaultUnit: "kW",
      default: 7.5,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "mod", equals: ["P-n", "P-T"] },
    },
    {
      kind: "number",
      key: "T",
      label: "Tork",
      symbol: "T",
      dimension: "tork",
      defaultUnit: "Nm",
      default: 49.4,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "mod", equals: ["T-n", "P-T"] },
    },
    {
      kind: "number",
      key: "n",
      label: "Devir hızı",
      symbol: "n",
      dimension: "acisal_hiz",
      defaultUnit: "rpm",
      default: 1450,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "mod", equals: ["P-n", "T-n"] },
    },
  ],
  outputs: [
    { key: "P", label: "Mil gücü", symbol: "P", dimension: "guc", defaultUnit: "kW" },
    { key: "T", label: "Tork", symbol: "T", dimension: "tork", defaultUnit: "Nm" },
    { key: "n", label: "Devir hızı", symbol: "n", dimension: "acisal_hiz", defaultUnit: "rpm" },
  ],

  compute: (inputs) => {
    const mode = inputs.mod as GtdMode;
    const steps: Step[] = [];
    let P: number;
    let T: number;
    let omega: number;

    switch (mode) {
      case "P-n": {
        P = num(inputs, "P", WHERE);
        omega = num(inputs, "n", WHERE);
        T = P / omega;
        steps.push(omegaStep(omega));
        steps.push({ label: "Tork", latex: `T = \\frac{P}{\\omega} = \\frac{${qP(P)}}{${qOmega(omega)}} = ${qT(T)}` });
        break;
      }
      case "T-n": {
        T = num(inputs, "T", WHERE);
        omega = num(inputs, "n", WHERE);
        P = T * omega;
        steps.push(omegaStep(omega));
        steps.push({ label: "Güç", latex: `P = T \\cdot \\omega = ${qT(T)} \\cdot ${qOmega(omega)} = ${qP(P)}` });
        break;
      }
      case "P-T": {
        P = num(inputs, "P", WHERE);
        T = num(inputs, "T", WHERE);
        omega = P / T;
        steps.push({
          label: "Açısal hız",
          latex: `\\omega = \\frac{P}{T} = \\frac{${qP(P)}}{${qT(T)}} = ${qOmega(omega)}`,
        });
        steps.push({
          label: "Devir hızı",
          latex: `n = \\frac{60 \\cdot \\omega}{2\\pi} = \\frac{60 \\cdot ${qOmega(omega)}}{2\\pi} = ${qRpm(omega)}`,
        });
        break;
      }
      default:
        throw new Error(`${WHERE}: bilinmeyen mod "${String(mode)}"`);
    }

    return { outputs: { P, T, n: omega }, steps, checks: [] };
  },
};
