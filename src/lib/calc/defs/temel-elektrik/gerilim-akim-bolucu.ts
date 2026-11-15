/**
 * KAPSAM 1.3 — Gerilim ve akım bölücü.
 *
 * Gerilim bölücü: Vₒ = Vᵢ·R₂/(R₁+R₂) (yüksüz). Yük direnci R_L verilirse R₂ yerine R₂‖R_L konur.
 * Yüksüz ve yüklü çıktılar ayrı anahtarlarla ve etiketlerle verilir; yük bağlanınca R₁'in akımı ve gücü
 * artar, R₂'ninki azalır.
 * Akım bölücü (iki paralel direnç): I₁ = I·R₂/(R₁+R₂), I₂ = I·R₁/(R₁+R₂).
 *
 * Doğru akımda gerilim ve akım işaretli girilebilir; oranlar işareti korur, güçler pozitiftir.
 */
import { latexAuto, latexAutoOperand, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";

export type BolucuMod = "gerilim" | "akim";

const MESSAGES = {
  unloaded:
    "Çıkış yüksüz kabul edildi. Çıkışa bağlanacak yük, çıkış gerilimini düşürür; etkisini görmek için yük direncini girin.",
  loadedRating:
    "Direnç güç sınıfını seçerken R₁ için yüklü, R₂ için yüksüz durumdaki gücü esas alın (yük bağlanınca R₁'in gücü artar, R₂'ninki azalır).",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`gerilim-akim-bolucu: "${key}" sayı değil`);
  return v;
}

/** -0 → 0 */
const n0 = (x: number) => (x === 0 ? 0 : x);

const qV = (v: number) => latexAuto(v, "gerilim");
const qI = (v: number) => latexAuto(v, "akim");
const qR = (v: number) => latexAuto(v, "direnc");
const qP = (v: number) => latexAuto(v, "guc");
const sq = (latex: string) => `(${latex})^2`;

export const gerilimAkimBolucu: CalcDefinition = {
  id: "1.3",
  slug: "gerilim-akim-bolucu",
  category: "temel-elektrik",
  title: "Gerilim ve akım bölücü",
  description:
    "İki dirençli gerilim bölücünün çıkış gerilimini, akımını ve direnç güçlerini; isteğe bağlı yük direnciyle yüklü çıkışı ya da iki paralel dirençte akım paylaşımını hesaplayın.",
  formulas: [
    { label: "Gerilim bölücü (yüksüz)", latex: "V_o = V_i \\cdot \\frac{R_2}{R_1 + R_2}" },
    { label: "Yüklü gerilim bölücü", latex: "V_{oL} = V_i \\cdot \\frac{R_2 \\parallel R_L}{R_1 + R_2 \\parallel R_L}, \\quad R_2 \\parallel R_L = \\frac{R_2 \\cdot R_L}{R_2 + R_L}" },
    { label: "Akım bölücü", latex: "I_1 = I \\cdot \\frac{R_2}{R_1 + R_2}, \\quad I_2 = I \\cdot \\frac{R_1}{R_1 + R_2}" },
  ],
  references: [
    {
      standard: "IEC 60050-131",
      title: "Uluslararası Elektroteknik Sözlük (IEV) — Bölüm 131: Devre teorisi",
      note: "Seri ve paralel bağlantı, gerilim, akım ve direnç terimleri",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "mod",
      label: "Devre",
      options: [
        { value: "gerilim", label: "Gerilim bölücü (seri R₁, R₂)" },
        { value: "akim", label: "Akım bölücü (paralel R₁, R₂)" },
      ],
      default: "gerilim",
    },
    {
      kind: "number",
      key: "Vi",
      label: "Giriş gerilimi",
      symbol: "V_i",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 12,
      help: "Doğru akımda negatif girilebilir.",
      visibleWhen: { key: "mod", equals: "gerilim" },
    },
    {
      kind: "number",
      key: "I",
      label: "Toplam akım",
      symbol: "I",
      dimension: "akim",
      defaultUnit: "mA",
      default: 10,
      help: "Paralel iki dirence giren toplam akım. Doğru akımda negatif girilebilir.",
      visibleWhen: { key: "mod", equals: "akim" },
    },
    {
      kind: "number",
      key: "R1",
      label: "R₁",
      symbol: "R_1",
      dimension: "direnc",
      defaultUnit: "kohm",
      default: 10,
      min: 0,
      minExclusive: true,
      help: "Gerilim bölücüde girişe bağlı (üst) direnç.",
    },
    {
      kind: "number",
      key: "R2",
      label: "R₂",
      symbol: "R_2",
      dimension: "direnc",
      defaultUnit: "kohm",
      default: 4.7,
      min: 0,
      minExclusive: true,
      help: "Gerilim bölücüde çıkışın alındığı (alt) direnç.",
    },
    {
      kind: "number",
      key: "RL",
      label: "Yük direnci (isteğe bağlı)",
      symbol: "R_L",
      dimension: "direnc",
      defaultUnit: "kohm",
      min: 0,
      minExclusive: true,
      optional: true,
      help: "Çıkışa (R₂'ye paralel) bağlanan yük. Boş bırakılırsa yalnız yüksüz değerler hesaplanır.",
      visibleWhen: { key: "mod", equals: "gerilim" },
    },
  ],
  outputs: [
    { key: "Vo", label: "Çıkış gerilimi (yüksüz)", symbol: "V_o", dimension: "gerilim", defaultUnit: "V" },
    { key: "Id", label: "Bölücü akımı (yüksüz)", symbol: "I", dimension: "akim", defaultUnit: "A" },
    { key: "P1", label: "R₁ gücü (yüksüz)", symbol: "P_1", dimension: "guc", defaultUnit: "W" },
    { key: "P2", label: "R₂ gücü (yüksüz)", symbol: "P_2", dimension: "guc", defaultUnit: "W" },
    { key: "R2L", label: "R₂ ∥ yük direnci", symbol: "R_2 \\parallel R_L", dimension: "direnc", defaultUnit: "ohm" },
    { key: "VoL", label: "Çıkış gerilimi (yüklü)", symbol: "V_{oL}", dimension: "gerilim", defaultUnit: "V" },
    { key: "I1L", label: "R₁ akımı (yüklü)", symbol: "I_{1L}", dimension: "akim", defaultUnit: "A" },
    { key: "IL", label: "Yük akımı", symbol: "I_L", dimension: "akim", defaultUnit: "A" },
    { key: "P1L", label: "R₁ gücü (yüklü)", symbol: "P_{1L}", dimension: "guc", defaultUnit: "W" },
    { key: "P2L", label: "R₂ gücü (yüklü)", symbol: "P_{2L}", dimension: "guc", defaultUnit: "W" },
    {
      key: "dusus",
      label: "Yük nedeniyle çıkış gerilimindeki düşüş",
      symbol: "\\delta",
      dimension: "oran",
      defaultUnit: "percent",
    },
    { key: "I1", label: "R₁ akımı", symbol: "I_1", dimension: "akim", defaultUnit: "A" },
    { key: "I2", label: "R₂ akımı", symbol: "I_2", dimension: "akim", defaultUnit: "A" },
    { key: "Vp", label: "Paralel kol gerilimi", symbol: "V", dimension: "gerilim", defaultUnit: "V" },
  ],

  compute: (inputs) => {
    const mode = inputs.mod as BolucuMod;
    const R1 = num(inputs, "R1");
    const R2 = num(inputs, "R2");
    const steps: Step[] = [];
    const checks: Check[] = [];
    const outputs: Record<string, number> = {};

    if (mode === "akim") {
      const I = num(inputs, "I");
      const I1 = n0((I * R2) / (R1 + R2));
      const I2 = n0((I * R1) / (R1 + R2));
      const Vp = n0((I * R1 * R2) / (R1 + R2));
      steps.push({ label: "R₁ akımı", latex: `I_1 = I \\cdot \\frac{R_2}{R_1 + R_2} = ${latexAutoOperand(I, "akim")} \\cdot \\frac{${qR(R2)}}{${qR(R1)} + ${qR(R2)}} = ${qI(I1)}` });
      steps.push({ label: "R₂ akımı", latex: `I_2 = I \\cdot \\frac{R_1}{R_1 + R_2} = ${latexAutoOperand(I, "akim")} \\cdot \\frac{${qR(R1)}}{${qR(R1)} + ${qR(R2)}} = ${qI(I2)}` });
      steps.push({
        label: "Paralel kol gerilimi",
        latex: `V = I \\cdot \\frac{R_1 \\cdot R_2}{R_1 + R_2} = ${latexAutoOperand(I, "akim")} \\cdot \\frac{${qR(R1)} \\cdot ${qR(R2)}}{${qR(R1)} + ${qR(R2)}} = ${qV(Vp)}`,
      });
      Object.assign(outputs, { I1, I2, Vp });
      return { outputs, steps, checks };
    }

    if (mode !== "gerilim") throw new Error(`gerilim-akim-bolucu: bilinmeyen mod "${String(mode)}"`);

    const Vi = num(inputs, "Vi");
    const sumR = `${qR(R1)} + ${qR(R2)}`;
    const Vo = n0((Vi * R2) / (R1 + R2));
    const Id = n0(Vi / (R1 + R2));
    const P1 = Id * Id * R1;
    const P2 = Id * Id * R2;
    steps.push({
      label: "Çıkış gerilimi (yüksüz)",
      latex: `V_o = V_i \\cdot \\frac{R_2}{R_1 + R_2} = ${latexAutoOperand(Vi, "gerilim")} \\cdot \\frac{${qR(R2)}}{${sumR}} = ${qV(Vo)}`,
    });
    steps.push({ label: "Bölücü akımı (yüksüz)", latex: `I = \\frac{V_i}{R_1 + R_2} = \\frac{${qV(Vi)}}{${sumR}} = ${qI(Id)}` });
    steps.push({ label: "R₁ gücü (yüksüz)", latex: `P_1 = I^2 \\cdot R_1 = ${sq(qI(Id))} \\cdot ${qR(R1)} = ${qP(P1)}` });
    steps.push({ label: "R₂ gücü (yüksüz)", latex: `P_2 = I^2 \\cdot R_2 = ${sq(qI(Id))} \\cdot ${qR(R2)} = ${qP(P2)}` });
    Object.assign(outputs, { Vo, Id, P1, P2 });

    if (typeof inputs.RL !== "number") {
      checks.push({ level: "bilgi", message: MESSAGES.unloaded });
      return { outputs, steps, checks };
    }

    const RL = inputs.RL;
    const R2L = (R2 * RL) / (R2 + RL);
    const VoL = n0((Vi * R2L) / (R1 + R2L));
    const I1L = n0(Vi / (R1 + R2L));
    const IL = n0(VoL / RL);
    const P1L = I1L * I1L * R1;
    const P2L = (VoL * VoL) / R2;
    steps.push({
      label: "R₂ ∥ yük direnci",
      latex: `R_2 \\parallel R_L = \\frac{R_2 \\cdot R_L}{R_2 + R_L} = \\frac{${qR(R2)} \\cdot ${qR(RL)}}{${qR(R2)} + ${qR(RL)}} = ${qR(R2L)}`,
    });
    steps.push({
      label: "Çıkış gerilimi (yüklü)",
      latex: `V_{oL} = V_i \\cdot \\frac{R_2 \\parallel R_L}{R_1 + R_2 \\parallel R_L} = ${latexAutoOperand(Vi, "gerilim")} \\cdot \\frac{${qR(R2L)}}{${qR(R1)} + ${qR(R2L)}} = ${qV(VoL)}`,
    });
    steps.push({
      label: "R₁ akımı (yüklü)",
      latex: `I_{1L} = \\frac{V_i}{R_1 + R_2 \\parallel R_L} = \\frac{${qV(Vi)}}{${qR(R1)} + ${qR(R2L)}} = ${qI(I1L)}`,
    });
    steps.push({ label: "Yük akımı", latex: `I_L = \\frac{V_{oL}}{R_L} = \\frac{${qV(VoL)}}{${qR(RL)}} = ${qI(IL)}` });
    steps.push({ label: "R₁ gücü (yüklü)", latex: `P_{1L} = I_{1L}^2 \\cdot R_1 = ${sq(qI(I1L))} \\cdot ${qR(R1)} = ${qP(P1L)}` });
    steps.push({ label: "R₂ gücü (yüklü)", latex: `P_{2L} = \\frac{V_{oL}^2}{R_2} = \\frac{${sq(qV(VoL))}}{${qR(R2)}} = ${qP(P2L)}` });
    Object.assign(outputs, { R2L, VoL, I1L, IL, P1L, P2L });

    if (Vo !== 0) {
      const dusus = (Vo - VoL) / Vo;
      steps.push({
        label: "Yük etkisi",
        latex: `\\delta = \\frac{V_o - V_{oL}}{V_o} = \\frac{${qV(Vo)} - ${latexAutoOperand(VoL, "gerilim")}}{${qV(Vo)}} = ${latexQty(dusus, "percent")}`,
      });
      outputs.dusus = dusus;
    }
    checks.push({ level: "bilgi", message: MESSAGES.loadedRating });
    return { outputs, steps, checks };
  },
};
