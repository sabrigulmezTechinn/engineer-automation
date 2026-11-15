/**
 * KAPSAM 1.4 — AC güç (1 faz / 3 faz).
 *
 * Sinüzoidal gerilim ve akım; üç fazda dengeli yük. Üç fazda U fazlar arası (hat) gerilimi,
 * I hat akımıdır: S = √3·U·I. Tek fazda S = U·I.
 *
 * İşaret kuralı: φ, gerilimin akıma göre faz öncülüğüdür. Endüktif yükte akım geri kalır: φ > 0, Q > 0.
 * Kapasitif yükte φ < 0, Q < 0. Böylece her iki durumda da Q = S·sin φ ve P = S·cos φ geçerlidir.
 */
import { latexAuto, latexNum, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";

export type AcFaz = "1" | "3";
export type AcMod = "U-I" | "P-U";
export type AcKarakter = "enduktif" | "kapasitif";

const MESSAGES = {
  cosPhiZero:
    "Aktif güç biliniyorken cos φ sıfır olamaz: I = P / (U·cos φ) tanımsızdır. Saf reaktif yük için akım bilinen modu kullanın.",
  assumptions1:
    "Sinüzoidal (harmoniksiz) gerilim ve akım kabul edildi; cos φ kayma güç faktörüdür. Endüktif yükte φ ve Q pozitif, kapasitif yükte negatiftir.",
  assumptions3:
    "Sinüzoidal (harmoniksiz) gerilim ve akım ile dengeli üç fazlı yük kabul edildi; U fazlar arası gerilim, I hat akımıdır. Endüktif yükte φ ve Q pozitif, kapasitif yükte negatiftir.",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`ac-guc: "${key}" sayı değil`);
  return v;
}

/** -0 → 0: cos φ = 1 iken kapasitif seçimde "−0°" ve "−0 var" gösterilmesin. */
const n0 = (x: number) => (x === 0 ? 0 : x);

function crossChecks(inputs: ComputeInputs): Check[] {
  if (inputs.mod === "P-U" && num(inputs, "cosphi") === 0) return [{ level: "hata", message: MESSAGES.cosPhiZero }];
  return [];
}

export const acGuc: CalcDefinition = {
  id: "1.4",
  slug: "ac-guc",
  category: "temel-elektrik",
  title: "AC güç (1 faz / 3 faz)",
  description:
    "Tek veya üç fazlı sinüzoidal sistemde aktif, reaktif ve görünür gücü, faz açısını ya da aktif güçten akımı hesaplayın. Üç fazda U fazlar arası (hat) gerilimidir ve yük dengeli kabul edilir.",
  formulas: [
    { label: "Aktif güç (3 faz)", latex: "P = \\sqrt{3} \\cdot U \\cdot I \\cdot \\cos\\varphi" },
    { label: "Aktif güç (1 faz)", latex: "P = U \\cdot I \\cdot \\cos\\varphi" },
    { label: "Görünür güç", latex: "S = \\sqrt{3} \\cdot U \\cdot I \\;(\\text{3 faz}), \\quad S = U \\cdot I \\;(\\text{1 faz})" },
    { label: "Reaktif güç", latex: "Q = S \\cdot \\sin\\varphi" },
    { label: "Güç üçgeni", latex: "S = \\sqrt{P^2 + Q^2}" },
  ],
  references: [
    {
      standard: "IEC 60050-131",
      title: "Uluslararası Elektroteknik Sözlük (IEV) — Bölüm 131: Devre teorisi",
      note: "Aktif, reaktif ve görünür güç ile güç faktörü tanımları (sinüzoidal koşullar)",
    },
    {
      standard: "IEC 60050-141",
      title: "Uluslararası Elektroteknik Sözlük (IEV) — Bölüm 141: Çok fazlı sistemler ve devreler",
      note: "Çok fazlı sistemde güçler ve hat/faz gerilimi terimleri",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "faz",
      label: "Sistem",
      options: [
        { value: "1", label: "Tek faz" },
        { value: "3", label: "Üç faz (dengeli)" },
      ],
      default: "3",
    },
    {
      kind: "select",
      key: "mod",
      label: "Bilinen büyüklükler",
      options: [
        { value: "U-I", label: "Gerilim, akım ve cos φ biliniyor" },
        { value: "P-U", label: "Aktif güç, gerilim ve cos φ biliniyor" },
      ],
      default: "U-I",
    },
    {
      kind: "number",
      key: "U1",
      label: "Gerilim (faz-nötr)",
      symbol: "U",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 230,
      min: 0,
      minExclusive: true,
      help: "Tek fazlı yükün uçlarındaki etkin (RMS) gerilim.",
      visibleWhen: { key: "faz", equals: "1" },
    },
    {
      kind: "number",
      key: "U3",
      label: "Fazlar arası gerilim (hat gerilimi)",
      symbol: "U",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 400,
      min: 0,
      minExclusive: true,
      help: "İki faz iletkeni arasındaki etkin gerilim (ör. 400 V). Faz-nötr gerilimi (230 V) değildir.",
      visibleWhen: { key: "faz", equals: "3" },
    },
    {
      kind: "number",
      key: "I",
      label: "Akım",
      symbol: "I",
      dimension: "akim",
      defaultUnit: "A",
      default: 10,
      min: 0,
      help: "Etkin (RMS) akım; üç fazda hat (faz iletkeni) akımı.",
      visibleWhen: { key: "mod", equals: "U-I" },
    },
    {
      kind: "number",
      key: "P",
      label: "Aktif güç",
      symbol: "P",
      dimension: "guc",
      defaultUnit: "kW",
      default: 5.5,
      min: 0,
      help: "Üç fazda üç fazın toplam aktif gücü.",
      visibleWhen: { key: "mod", equals: "P-U" },
    },
    {
      kind: "number",
      key: "cosphi",
      label: "Güç faktörü (cos φ)",
      symbol: "\\cos\\varphi",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      units: ["unitless"],
      default: 0.8,
      min: 0,
      max: 1,
    },
    {
      kind: "select",
      key: "karakter",
      label: "Yük karakteri",
      options: [
        { value: "enduktif", label: "Endüktif (akım geri, Q > 0)" },
        { value: "kapasitif", label: "Kapasitif (akım ileri, Q < 0)" },
      ],
      default: "enduktif",
    },
  ],
  outputs: [
    { key: "P", label: "Aktif güç", symbol: "P", dimension: "guc", defaultUnit: "W" },
    { key: "I", label: "Akım", symbol: "I", dimension: "akim", defaultUnit: "A" },
    { key: "Q", label: "Reaktif güç", symbol: "Q", dimension: "reaktif_guc", defaultUnit: "var" },
    { key: "S", label: "Görünür güç", symbol: "S", dimension: "gorunur_guc", defaultUnit: "VA" },
    { key: "phi", label: "Faz açısı", symbol: "\\varphi", dimension: "aci", defaultUnit: "deg" },
  ],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const faz = inputs.faz as AcFaz;
    const mode = inputs.mod as AcMod;
    const U = num(inputs, faz === "3" ? "U3" : "U1");
    const cosphi = num(inputs, "cosphi");
    const sign = inputs.karakter === "kapasitif" ? -1 : 1;
    const k = faz === "3" ? Math.sqrt(3) : 1;

    const phi = n0(sign * Math.acos(cosphi));
    const sinphi = n0(Math.sin(phi));

    // Adım parçaları: üç fazda "\sqrt{3} \cdot " ön eki
    const k_ = faz === "3" ? "\\sqrt{3} \\cdot " : "";
    const qU = latexAuto(U, "gerilim");
    const qCos = latexNum(cosphi);
    const qSin = sinphi < 0 ? `(${latexNum(sinphi)})` : latexNum(sinphi);
    const qPhi = latexQty(phi, "deg");

    const steps: Step[] = [];
    const outputs: Record<string, number> = {};
    steps.push({
      label: "Faz açısı",
      latex: `\\varphi = ${sign < 0 ? "-" : ""}\\arccos(\\cos\\varphi) = ${sign < 0 ? "-" : ""}\\arccos(${qCos}) = ${qPhi}`,
    });

    if (mode === "U-I") {
      const I = num(inputs, "I");
      const S = k * U * I;
      const P = S * cosphi;
      const Q = n0(S * sinphi);
      const qI = latexAuto(I, "akim");
      steps.push({
        label: "Aktif güç",
        latex: `P = ${k_}U \\cdot I \\cdot \\cos\\varphi = ${k_}${qU} \\cdot ${qI} \\cdot ${qCos} = ${latexAuto(P, "guc")}`,
      });
      steps.push({
        label: "Reaktif güç",
        latex: `Q = ${k_}U \\cdot I \\cdot \\sin\\varphi = ${k_}${qU} \\cdot ${qI} \\cdot ${qSin} = ${latexAuto(Q, "reaktif_guc")}`,
      });
      steps.push({
        label: "Görünür güç",
        latex: `S = ${k_}U \\cdot I = ${k_}${qU} \\cdot ${qI} = ${latexAuto(S, "gorunur_guc")}`,
      });
      Object.assign(outputs, { P, Q, S, phi });
    } else {
      const P = num(inputs, "P");
      const I = P / (k * U * cosphi);
      const S = P / cosphi;
      const Q = n0(S * sinphi);
      const qP = latexAuto(P, "guc");
      steps.push({
        label: "Akım",
        latex: `I = \\frac{P}{${k_}U \\cdot \\cos\\varphi} = \\frac{${qP}}{${k_}${qU} \\cdot ${qCos}} = ${latexAuto(I, "akim")}`,
      });
      steps.push({
        label: "Görünür güç",
        latex: `S = \\frac{P}{\\cos\\varphi} = \\frac{${qP}}{${qCos}} = ${latexAuto(S, "gorunur_guc")}`,
      });
      steps.push({
        label: "Reaktif güç",
        latex: `Q = S \\cdot \\sin\\varphi = ${latexAuto(S, "gorunur_guc")} \\cdot ${qSin} = ${latexAuto(Q, "reaktif_guc")}`,
      });
      Object.assign(outputs, { I, Q, S, phi });
    }

    return {
      outputs,
      steps,
      checks: [{ level: "ok", message: faz === "3" ? MESSAGES.assumptions3 : MESSAGES.assumptions1 }],
    };
  },
};
