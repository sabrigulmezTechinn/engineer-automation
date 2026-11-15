/**
 * KAPSAM 1.1 — Ohm yasası ve güç.
 * Gerilim, akım, direnç ve güçten bilinen ikisiyle diğer ikisi hesaplanır.
 *
 * İşaret kuralı (pasif işaret yönü): doğru akımda gerilim ve akım işaretli girilebilir;
 * pasif bir dirençte ikisi aynı işaretlidir, böylece R > 0 ve P ≥ 0 olur.
 */
import { latexAuto, latexAutoOperand } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";

export type OhmMode = "V-I" | "V-R" | "I-R" | "P-V" | "P-I" | "P-R";

const MODE_OPTIONS: { value: OhmMode; label: string }[] = [
  { value: "V-I", label: "Gerilim ve akım biliniyor" },
  { value: "V-R", label: "Gerilim ve direnç biliniyor" },
  { value: "I-R", label: "Akım ve direnç biliniyor" },
  { value: "P-V", label: "Güç ve gerilim biliniyor" },
  { value: "P-I", label: "Güç ve akım biliniyor" },
  { value: "P-R", label: "Güç ve direnç biliniyor" },
];

const MESSAGES = {
  oppositeSigns:
    "Gerilim ve akım zıt işaretli: direnç negatif çıkar. Pasif bir dirençte akım, gerilimle aynı yöndedir (R = V/I > 0).",
  zeroVoltageWithPower: "Güç ve gerilim biliniyorken gerilim sıfır olamaz: I = P/V tanımsızdır.",
  zeroCurrentWithPower: "Güç ve akım biliniyorken akım sıfır olamaz: V = P/I tanımsızdır.",
  resistanceUndefined: "Akım sıfır olduğundan direnç tanımsızdır (açık devre); direnç gösterilmedi.",
  shortCircuit: "Direnç sıfır çıktı: gerilim sıfırken akım akması kısa devre anlamına gelir.",
  positiveRoot:
    "Karekök alındığı için gerilim ve akım pozitif (aynı yönlü) kabul edildi; bu modda işaret belirlenemez.",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`ohm-yasasi: "${key}" sayı değil`);
  return v;
}

/** Moda göre çapraz alan kontrolleri ("hata" seviyesinde hesap yapılmaz). */
function crossChecks(inputs: ComputeInputs): Check[] {
  const mode = inputs.mod as OhmMode;
  if (mode === "V-I" && num(inputs, "V") * num(inputs, "I") < 0) {
    return [{ level: "hata", message: MESSAGES.oppositeSigns }];
  }
  if (mode === "P-V" && num(inputs, "V") === 0) {
    return [{ level: "hata", message: MESSAGES.zeroVoltageWithPower }];
  }
  if (mode === "P-I" && num(inputs, "I") === 0) {
    return [{ level: "hata", message: MESSAGES.zeroCurrentWithPower }];
  }
  return [];
}

// Adım yardımcıları: q → değer + otomatik birim (kartlarla aynı kural), op → çarpım içinde (negatifse parantezli), sq → kare için her zaman parantezli
const qV = (v: number) => latexAuto(v, "gerilim");
const qI = (v: number) => latexAuto(v, "akim");
const qR = (v: number) => latexAuto(v, "direnc");
const qP = (v: number) => latexAuto(v, "guc");
const sq = (latex: string) => `(${latex})^2`;
/** -0 → 0: ör. 0 W / (−2 A) gösterimde "−0" olarak çıkmasın. */
const n0 = (x: number) => (x === 0 ? 0 : x);

export const ohmYasasi: CalcDefinition = {
  id: "1.1",
  slug: "ohm-yasasi",
  category: "temel-elektrik",
  title: "Ohm yasası ve güç",
  description:
    "Gerilim, akım, direnç ve güçten bilinen ikisini girerek diğer ikisini hesaplayın. Doğru akım veya saf omik yükte etkin (RMS) değerler için geçerlidir.",
  formulas: [
    { label: "Ohm yasası", latex: "V = I \\cdot R" },
    { label: "Güç (gerilim ve akım)", latex: "P = V \\cdot I" },
    { label: "Güç (akım ve direnç)", latex: "P = I^2 \\cdot R" },
    { label: "Güç (gerilim ve direnç)", latex: "P = \\frac{V^2}{R}" },
  ],
  references: [
    {
      standard: "IEC 60050",
      title: "Uluslararası Elektroteknik Sözlük (IEV)",
      clause: "Bölüm 131: Devre teorisi",
      note: "Gerilim, akım, direnç ve güç terimlerinin tanımları",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "mod",
      label: "Bilinen büyüklükler",
      options: MODE_OPTIONS,
      default: "V-R",
    },
    {
      kind: "number",
      key: "V",
      label: "Gerilim",
      symbol: "V",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 12,
      help: "Doğru akımda ters yön için negatif girilebilir.",
      visibleWhen: { key: "mod", equals: ["V-I", "V-R", "P-V"] },
    },
    {
      kind: "number",
      key: "I",
      label: "Akım",
      symbol: "I",
      dimension: "akim",
      defaultUnit: "A",
      default: 2,
      help: "Doğru akımda ters yön için negatif girilebilir.",
      visibleWhen: { key: "mod", equals: ["V-I", "I-R", "P-I"] },
    },
    {
      kind: "number",
      key: "R",
      label: "Direnç",
      symbol: "R",
      dimension: "direnc",
      defaultUnit: "ohm",
      default: 6,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "mod", equals: ["V-R", "I-R", "P-R"] },
    },
    {
      kind: "number",
      key: "P",
      label: "Güç",
      symbol: "P",
      dimension: "guc",
      defaultUnit: "W",
      default: 24,
      min: 0,
      help: "Dirençte harcanan güç.",
      visibleWhen: { key: "mod", equals: ["P-V", "P-I", "P-R"] },
    },
  ],
  outputs: [
    { key: "V", label: "Gerilim", symbol: "V", dimension: "gerilim", defaultUnit: "V" },
    { key: "I", label: "Akım", symbol: "I", dimension: "akim", defaultUnit: "A" },
    { key: "R", label: "Direnç", symbol: "R", dimension: "direnc", defaultUnit: "ohm" },
    { key: "P", label: "Güç", symbol: "P", dimension: "guc", defaultUnit: "W" },
  ],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const mode = inputs.mod as OhmMode;
    const steps: Step[] = [];
    const checks: Check[] = [];
    let V: number;
    let I: number;
    let R: number | undefined;
    let P: number;

    switch (mode) {
      case "V-I": {
        V = num(inputs, "V");
        I = num(inputs, "I");
        P = n0(V * I);
        if (I !== 0) {
          R = n0(V / I);
          steps.push({ label: "Direnç", latex: `R = \\frac{V}{I} = \\frac{${qV(V)}}{${qI(I)}} = ${qR(R)}` });
        }
        steps.push({
          label: "Güç",
          latex: `P = V \\cdot I = ${latexAutoOperand(V, "gerilim")} \\cdot ${latexAutoOperand(I, "akim")} = ${qP(P)}`,
        });
        break;
      }
      case "V-R": {
        V = num(inputs, "V");
        R = num(inputs, "R");
        I = n0(V / R);
        P = (V * V) / R;
        steps.push({ label: "Akım", latex: `I = \\frac{V}{R} = \\frac{${qV(V)}}{${qR(R)}} = ${qI(I)}` });
        steps.push({ label: "Güç", latex: `P = \\frac{V^2}{R} = \\frac{${sq(qV(V))}}{${qR(R)}} = ${qP(P)}` });
        break;
      }
      case "I-R": {
        I = num(inputs, "I");
        R = num(inputs, "R");
        V = n0(I * R);
        P = I * I * R;
        steps.push({
          label: "Gerilim",
          latex: `V = I \\cdot R = ${latexAutoOperand(I, "akim")} \\cdot ${qR(R)} = ${qV(V)}`,
        });
        steps.push({ label: "Güç", latex: `P = I^2 \\cdot R = ${sq(qI(I))} \\cdot ${qR(R)} = ${qP(P)}` });
        break;
      }
      case "P-V": {
        P = num(inputs, "P");
        V = num(inputs, "V");
        I = n0(P / V);
        steps.push({ label: "Akım", latex: `I = \\frac{P}{V} = \\frac{${qP(P)}}{${qV(V)}} = ${qI(I)}` });
        if (P !== 0) {
          R = (V * V) / P;
          steps.push({ label: "Direnç", latex: `R = \\frac{V^2}{P} = \\frac{${sq(qV(V))}}{${qP(P)}} = ${qR(R)}` });
        }
        break;
      }
      case "P-I": {
        P = num(inputs, "P");
        I = num(inputs, "I");
        V = n0(P / I);
        R = P / (I * I);
        steps.push({ label: "Gerilim", latex: `V = \\frac{P}{I} = \\frac{${qP(P)}}{${qI(I)}} = ${qV(V)}` });
        steps.push({ label: "Direnç", latex: `R = \\frac{P}{I^2} = \\frac{${qP(P)}}{${sq(qI(I))}} = ${qR(R)}` });
        break;
      }
      case "P-R": {
        P = num(inputs, "P");
        R = num(inputs, "R");
        V = Math.sqrt(P * R);
        I = Math.sqrt(P / R);
        steps.push({
          label: "Gerilim (pozitif kök)",
          latex: `V = \\sqrt{P \\cdot R} = \\sqrt{${qP(P)} \\cdot ${qR(R)}} = ${qV(V)}`,
        });
        steps.push({
          label: "Akım (pozitif kök)",
          latex: `I = \\sqrt{\\frac{P}{R}} = \\sqrt{\\frac{${qP(P)}}{${qR(R)}}} = ${qI(I)}`,
        });
        checks.push({ level: "bilgi", message: MESSAGES.positiveRoot });
        break;
      }
      default:
        throw new Error(`ohm-yasasi: bilinmeyen mod "${String(mode)}"`);
    }

    if (R === undefined) checks.push({ level: "uyari", message: MESSAGES.resistanceUndefined });
    else if (R === 0) checks.push({ level: "uyari", message: MESSAGES.shortCircuit });

    const outputs: Record<string, number> = { V, I, P };
    if (R !== undefined) outputs.R = R;
    return { outputs, steps, checks };
  },
};
