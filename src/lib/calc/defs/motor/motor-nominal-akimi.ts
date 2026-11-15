/**
 * KAPSAM 3.2 — Motor nominal akımı.
 *
 * Plakadaki anma gücü milden alınan mekanik (çıkış) güçtür (IEC 60034-1); şebekeden çekilen güç
 * P₁ = P/η'dır. Akım bu giriş gücünden bulunur:
 *   3 faz: I = P / (√3 · U · cosφ · η)   (U: fazlar arası gerilim)
 *   1 faz: I = P / (U · cosφ · η)
 *   DC:    I = P / (U · η)
 * Görünür güç (AC): S = P₁ / cosφ.
 */
import { latexAuto } from "@/lib/calc/latex";
import type { CalcDefinition, Step } from "@/lib/calc/types";
import { num, qFrac } from "./ortak";

export type MotorSistemi = "3faz" | "1faz" | "dc";

const SYSTEM_OPTIONS: { value: MotorSistemi; label: string }[] = [
  { value: "3faz", label: "Üç fazlı AC motor" },
  { value: "1faz", label: "Tek fazlı AC motor" },
  { value: "dc", label: "Doğru akım (DC) motoru" },
];

const WHERE = "motor-nominal-akimi";

const qP = (v: number) => latexAuto(v, "guc");
const qU = (v: number) => latexAuto(v, "gerilim");
const qI = (v: number) => latexAuto(v, "akim");
const qS = (v: number) => latexAuto(v, "gorunur_guc");

export const motorNominalAkimi: CalcDefinition = {
  id: "3.2",
  slug: "motor-nominal-akimi",
  category: "motor",
  title: "Motor nominal akımı",
  description:
    "Plakadaki mil (çıkış) gücü, gerilim, güç katsayısı ve verimden motorun şebekeden çektiği nominal akımı, giriş gücünü ve görünür gücü hesaplayın. Üç fazlı, tek fazlı ve DC motorlar için.",
  formulas: [
    { label: "Üç faz (U: fazlar arası)", latex: "I = \\frac{P}{\\sqrt{3} \\cdot U \\cdot \\cos\\varphi \\cdot \\eta}" },
    { label: "Tek faz", latex: "I = \\frac{P}{U \\cdot \\cos\\varphi \\cdot \\eta}" },
    { label: "Doğru akım", latex: "I = \\frac{P}{U \\cdot \\eta}" },
    { label: "Giriş (elektriksel) gücü", latex: "P_1 = \\frac{P}{\\eta}" },
    { label: "Görünür güç (AC)", latex: "S = \\frac{P_1}{\\cos\\varphi}" },
  ],
  references: [
    {
      standard: "IEC 60034-1",
      title: "Döner elektrik makineleri — Bölüm 1: Anma değerleri ve performans",
      note: "Motorun anma gücü milde verilen mekanik güçtür; plaka değerleri",
    },
  ],
  inputs: [
    { kind: "select", key: "sistem", label: "Motor türü", options: SYSTEM_OPTIONS, default: "3faz" },
    {
      kind: "number",
      key: "P",
      label: "Anma (mil) gücü",
      symbol: "P",
      dimension: "guc",
      defaultUnit: "kW",
      default: 7.5,
      min: 0,
      minExclusive: true,
      help: "Plakadaki güç: milden alınan mekanik çıkış gücüdür (IEC 60034-1), şebekeden çekilen güç değildir.",
    },
    {
      kind: "number",
      key: "U",
      label: "Anma gerilimi",
      symbol: "U",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 400,
      min: 0,
      minExclusive: true,
      help: "Üç fazda fazlar arası (hat) gerilim.",
    },
    {
      kind: "number",
      key: "cosphi",
      label: "Güç katsayısı",
      symbol: "\\cos\\varphi",
      dimension: "oran",
      defaultUnit: "fraction",
      units: ["fraction", "percent"],
      default: 0.83,
      min: 0,
      minExclusive: true,
      max: 1,
      visibleWhen: { key: "sistem", equals: ["3faz", "1faz"] },
    },
    {
      kind: "number",
      key: "eta",
      label: "Verim",
      symbol: "\\eta",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 90,
      min: 0,
      minExclusive: true,
      max: 1,
    },
  ],
  outputs: [
    { key: "I", label: "Nominal akım", symbol: "I_n", dimension: "akim", defaultUnit: "A" },
    { key: "P1", label: "Giriş (elektriksel) gücü", symbol: "P_1", dimension: "guc", defaultUnit: "kW" },
    { key: "S", label: "Görünür güç", symbol: "S", dimension: "gorunur_guc", defaultUnit: "kVA" },
  ],

  compute: (inputs) => {
    const sistem = inputs.sistem as MotorSistemi;
    const P = num(inputs, "P", WHERE);
    const U = num(inputs, "U", WHERE);
    const eta = num(inputs, "eta", WHERE);
    const steps: Step[] = [];
    const outputs: Record<string, number> = {};

    switch (sistem) {
      case "3faz": {
        const cosphi = num(inputs, "cosphi", WHERE);
        const I = P / (Math.sqrt(3) * U * cosphi * eta);
        steps.push({
          label: "Nominal akım",
          latex: `I = \\frac{P}{\\sqrt{3} \\cdot U \\cdot \\cos\\varphi \\cdot \\eta} = \\frac{${qP(P)}}{\\sqrt{3} \\cdot ${qU(U)} \\cdot ${qFrac(cosphi)} \\cdot ${qFrac(eta)}} = ${qI(I)}`,
        });
        outputs.I = I;
        outputs.S = P / eta / cosphi;
        break;
      }
      case "1faz": {
        const cosphi = num(inputs, "cosphi", WHERE);
        const I = P / (U * cosphi * eta);
        steps.push({
          label: "Nominal akım",
          latex: `I = \\frac{P}{U \\cdot \\cos\\varphi \\cdot \\eta} = \\frac{${qP(P)}}{${qU(U)} \\cdot ${qFrac(cosphi)} \\cdot ${qFrac(eta)}} = ${qI(I)}`,
        });
        outputs.I = I;
        outputs.S = P / eta / cosphi;
        break;
      }
      case "dc": {
        const I = P / (U * eta);
        steps.push({
          label: "Nominal akım",
          latex: `I = \\frac{P}{U \\cdot \\eta} = \\frac{${qP(P)}}{${qU(U)} \\cdot ${qFrac(eta)}} = ${qI(I)}`,
        });
        outputs.I = I;
        break;
      }
      default:
        throw new Error(`${WHERE}: bilinmeyen motor türü "${String(sistem)}"`);
    }

    const P1 = P / eta;
    outputs.P1 = P1;
    steps.push({ label: "Giriş gücü", latex: `P_1 = \\frac{P}{\\eta} = \\frac{${qP(P)}}{${qFrac(eta)}} = ${qP(P1)}` });
    if (outputs.S !== undefined) {
      const cosphi = num(inputs, "cosphi", WHERE);
      steps.push({
        label: "Görünür güç",
        latex: `S = \\frac{P_1}{\\cos\\varphi} = \\frac{${qP(P1)}}{${qFrac(cosphi)}} = ${qS(outputs.S)}`,
      });
    }

    return { outputs, steps, checks: [] };
  },
};
