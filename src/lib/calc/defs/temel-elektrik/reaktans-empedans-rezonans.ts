/**
 * KAPSAM 1.5 — Reaktans, empedans, rezonans.
 *
 * Girdilerin hepsi isteğe bağlıdır; girilen bileşenlerle anlamlı olan çıktılar hesaplanır:
 * - f ve L → X_L = 2πfL;  f ve C → X_C = 1/(2πfC)
 * - f ve (L veya C) → seri devrenin net reaktansı, empedansı ve faz açısı. Girilmeyen bileşen seri devrede
 *   yok sayılır (L yoksa X_L = 0, C yoksa X_C = 0, R yoksa R = 0).
 * - L ve C → seri rezonans frekansı f₀ = 1/(2π√(LC)); R > 0 ise Q = (1/R)·√(L/C) ve bant genişliği B = f₀/Q.
 * Faz açısı φ, gerilimin akıma göre öncülüğüdür: endüktif devrede pozitif, kapasitif devrede negatif.
 */
import { latexAuto, latexNum, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";

const MESSAGES = {
  insufficient:
    "Hesap için frekansla birlikte L veya C (reaktans ve empedans) ya da L ile C birlikte (rezonans) girilmelidir.",
  zeroImpedance: "Empedans sıfır (R = 0 ve XL = XC): faz açısı tanımsızdır; gösterilmedi.",
  zeroR: "R = 0 (ideal devre): kalite faktörü sonsuzdur; Q ve bant genişliği hesaplanmadı.",
  series: (omitted: string[]) =>
    `Empedans ve faz açısı seri bağlantı içindir; bileşenler ideal kabul edildi.${
      omitted.length > 0 ? ` Girilmeyen bileşenler devrede yok sayıldı: ${omitted.join(", ")}.` : ""
    }`,
} as const;

function opt(inputs: ComputeInputs, key: string): number | undefined {
  const v = inputs[key];
  return typeof v === "number" ? v : undefined;
}

function canCompute(inputs: ComputeInputs): boolean {
  const f = opt(inputs, "f");
  const L = opt(inputs, "L");
  const C = opt(inputs, "C");
  return (f !== undefined && (L !== undefined || C !== undefined)) || (L !== undefined && C !== undefined);
}

const qR = (v: number) => latexAuto(v, "direnc");
const qF = (v: number) => latexAuto(v, "frekans");
const qL = (v: number) => latexAuto(v, "enduktans");
const qC = (v: number) => latexAuto(v, "kapasitans");
/** -0 → 0 */
const n0 = (x: number) => (x === 0 ? 0 : x);

export const reaktansEmpedansRezonans: CalcDefinition = {
  id: "1.5",
  slug: "reaktans-empedans-rezonans",
  category: "temel-elektrik",
  title: "Reaktans, empedans, rezonans",
  description:
    "Endüktif ve kapasitif reaktansı, seri RLC devrenin empedansını ve faz açısını, rezonans frekansını ve kalite faktörünü hesaplayın. Bildiğiniz bileşenleri girin; boş bırakılanlar seri devrede yok sayılır.",
  formulas: [
    { label: "Endüktif reaktans", latex: "X_L = 2\\pi f L" },
    { label: "Kapasitif reaktans", latex: "X_C = \\frac{1}{2\\pi f C}" },
    { label: "Seri RLC empedansı", latex: "Z = \\sqrt{R^2 + (X_L - X_C)^2}" },
    { label: "Faz açısı", latex: "\\varphi = \\arctan\\frac{X_L - X_C}{R}" },
    { label: "Rezonans frekansı", latex: "f_0 = \\frac{1}{2\\pi\\sqrt{L C}}" },
    { label: "Kalite faktörü (seri RLC)", latex: "Q = \\frac{1}{R}\\sqrt{\\frac{L}{C}}, \\quad B = \\frac{f_0}{Q}" },
  ],
  references: [
    {
      standard: "IEC 60050-131",
      title: "Uluslararası Elektroteknik Sözlük (IEV) — Bölüm 131: Devre teorisi",
      note: "Empedans, reaktans ve faz farkı terimleri (sinüzoidal koşullar)",
    },
  ],
  inputs: [
    {
      kind: "number",
      key: "f",
      label: "Frekans",
      symbol: "f",
      dimension: "frekans",
      defaultUnit: "kHz",
      default: 1,
      min: 0,
      minExclusive: true,
      optional: true,
      help: "Reaktans ve empedans için gerekir; yalnız rezonans için boş bırakılabilir.",
    },
    {
      kind: "number",
      key: "L",
      label: "Endüktans",
      symbol: "L",
      dimension: "enduktans",
      defaultUnit: "mH",
      default: 10,
      min: 0,
      minExclusive: true,
      optional: true,
    },
    {
      kind: "number",
      key: "C",
      label: "Kapasitans",
      symbol: "C",
      dimension: "kapasitans",
      defaultUnit: "uF",
      default: 1,
      min: 0,
      minExclusive: true,
      optional: true,
    },
    {
      kind: "number",
      key: "R",
      label: "Direnç",
      symbol: "R",
      dimension: "direnc",
      defaultUnit: "ohm",
      default: 10,
      min: 0,
      optional: true,
      help: "Seri direnç (bobin sargı direnci dahil). Kalite faktörü için gerekir.",
    },
  ],
  outputs: [
    { key: "XL", label: "Endüktif reaktans", symbol: "X_L", dimension: "direnc", defaultUnit: "ohm" },
    { key: "XC", label: "Kapasitif reaktans", symbol: "X_C", dimension: "direnc", defaultUnit: "ohm" },
    { key: "X", label: "Net reaktans (XL − XC)", symbol: "X", dimension: "direnc", defaultUnit: "ohm" },
    { key: "Z", label: "Empedans (seri)", symbol: "Z", dimension: "direnc", defaultUnit: "ohm" },
    { key: "phi", label: "Faz açısı", symbol: "\\varphi", dimension: "aci", defaultUnit: "deg" },
    { key: "f0", label: "Rezonans frekansı", symbol: "f_0", dimension: "frekans", defaultUnit: "Hz" },
    { key: "Q", label: "Kalite faktörü", symbol: "Q", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "B", label: "Bant genişliği (−3 dB)", symbol: "B", dimension: "frekans", defaultUnit: "Hz" },
  ],

  validate: (inputs) => (canCompute(inputs) ? [] : [{ level: "hata", message: MESSAGES.insufficient }]),

  compute: (inputs) => {
    if (!canCompute(inputs)) return { outputs: {}, steps: [], checks: [{ level: "hata", message: MESSAGES.insufficient }] };

    const f = opt(inputs, "f");
    const L = opt(inputs, "L");
    const C = opt(inputs, "C");
    const R = opt(inputs, "R");
    const outputs: Record<string, number> = {};
    const steps: Step[] = [];
    const checks: Check[] = [];

    if (f !== undefined && (L !== undefined || C !== undefined)) {
      let XL = 0;
      let XC = 0;
      if (L !== undefined) {
        XL = 2 * Math.PI * f * L;
        outputs.XL = XL;
        steps.push({ label: "Endüktif reaktans", latex: `X_L = 2\\pi f L = 2\\pi \\cdot ${qF(f)} \\cdot ${qL(L)} = ${qR(XL)}` });
      }
      if (C !== undefined) {
        XC = 1 / (2 * Math.PI * f * C);
        outputs.XC = XC;
        steps.push({
          label: "Kapasitif reaktans",
          latex: `X_C = \\frac{1}{2\\pi f C} = \\frac{1}{2\\pi \\cdot ${qF(f)} \\cdot ${qC(C)}} = ${qR(XC)}`,
        });
      }
      const X = n0(XL - XC);
      outputs.X = X;
      const xLatex =
        L !== undefined && C !== undefined
          ? `X = X_L - X_C = ${qR(XL)} - ${qR(XC)} = ${qR(X)}`
          : `X = ${L !== undefined ? "X_L" : "-X_C"} = ${qR(X)}`;
      steps.push({ label: "Net reaktans", latex: xLatex });

      const R0 = R ?? 0;
      const Z = Math.hypot(R0, X);
      outputs.Z = Z;
      steps.push({
        label: "Empedans",
        latex: `Z = \\sqrt{R^2 + X^2} = \\sqrt{(${qR(R0)})^2 + (${qR(X)})^2} = ${qR(Z)}`,
      });

      if (Z === 0) {
        checks.push({ level: "uyari", message: MESSAGES.zeroImpedance });
      } else {
        const phi = n0(Math.atan2(X, R0));
        outputs.phi = phi;
        steps.push({
          label: "Faz açısı",
          latex:
            R0 > 0
              ? `\\varphi = \\arctan\\frac{X}{R} = \\arctan\\frac{${qR(X)}}{${qR(R0)}} = ${latexQty(phi, "deg")}`
              : `\\varphi = \\operatorname{sgn}(X) \\cdot 90^\\circ = ${latexQty(phi, "deg")}`,
        });
      }

      const omitted: string[] = [];
      if (L === undefined) omitted.push("L (XL = 0)");
      if (C === undefined) omitted.push("C (XC = 0)");
      if (R === undefined) omitted.push("R (R = 0)");
      checks.push({ level: "bilgi", message: MESSAGES.series(omitted) });
    }

    if (L !== undefined && C !== undefined) {
      const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
      outputs.f0 = f0;
      steps.push({
        label: "Rezonans frekansı",
        latex: `f_0 = \\frac{1}{2\\pi\\sqrt{L C}} = \\frac{1}{2\\pi\\sqrt{${qL(L)} \\cdot ${qC(C)}}} = ${qF(f0)}`,
      });
      if (R !== undefined && R > 0) {
        const Q = Math.sqrt(L / C) / R;
        const B = f0 / Q;
        outputs.Q = Q;
        outputs.B = B;
        steps.push({
          label: "Kalite faktörü",
          latex: `Q = \\frac{1}{R}\\sqrt{\\frac{L}{C}} = \\frac{1}{${qR(R)}}\\sqrt{\\frac{${qL(L)}}{${qC(C)}}} = ${latexNum(Q)}`,
        });
        steps.push({ label: "Bant genişliği", latex: `B = \\frac{f_0}{Q} = \\frac{${qF(f0)}}{${latexNum(Q)}} = ${qF(B)}` });
      } else if (R === 0) {
        checks.push({ level: "uyari", message: MESSAGES.zeroR });
      }
    }

    return { outputs, steps, checks };
  },
};
