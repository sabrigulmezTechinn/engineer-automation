/**
 * KAPSAM 3.3 — Yol verme akımları.
 *
 * Doğrudan yol verme (DOL) referanstır: I_D = k·I_n, T_D = k_T·T_n (k ve k_T motor kataloğundan).
 * Asenkron motorun kalkış akımı uygulanan gerilimle, torku gerilimin karesiyle orantılı kabul edilir:
 * - Yıldız-üçgen: sargı gerilimi U/√3 → hat akımı ve tork DOL'un 1/3'ü.
 * - Ototrafo (kademe x = U_motor/U): motor akımı x·I_D, şebeke (hat) akımı x²·I_D, tork x²·T_D.
 * - Yumuşak yolverici: akım sınırı I_s = k_s·I_n; tork ≈ (I_s/I_D)²·T_D.
 */
import { latexAuto, latexNum, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";
import { num } from "./ortak";

export type YolVermeYontemi = "direkt" | "yildiz-ucgen" | "ototrafo" | "yumusak";

const METHOD_OPTIONS: { value: YolVermeYontemi; label: string }[] = [
  { value: "direkt", label: "Doğrudan yol verme (DOL)" },
  { value: "yildiz-ucgen", label: "Yıldız-üçgen" },
  { value: "ototrafo", label: "Ototrafo ile" },
  { value: "yumusak", label: "Yumuşak yolverici (akım sınırlı)" },
];

const WHERE = "yol-verme-akimlari";

const MESSAGES = {
  softLimitAboveDol:
    "Akım sınırı doğrudan yol verme kalkış akımından büyük olamaz (k_s ≤ k): motor zaten en fazla doğrudan kalkış akımını çeker.",
  starDelta:
    "Yıldız-üçgen yol verme yalnızca normal çalışmada üçgen bağlı motorlarda kullanılabilir (ör. 400 V şebekede 400/690 V Δ/Y plakalı motor).",
  softApprox:
    "Yumuşak yolvericide tork, akımın karesiyle orantılı kabul edilerek yaklaşık hesaplandı; kesin değer motor ve yük eğrisine bağlıdır.",
} as const;

const qI = (v: number) => latexAuto(v, "akim");
const qT = (v: number) => latexAuto(v, "tork");

function crossChecks(inputs: ComputeInputs): Check[] {
  if (inputs.yontem === "yumusak" && num(inputs, "ks", WHERE) > num(inputs, "k", WHERE)) {
    return [{ level: "hata", message: MESSAGES.softLimitAboveDol }];
  }
  return [];
}

export const yolVermeAkimlari: CalcDefinition = {
  id: "3.3",
  slug: "yol-verme-akimlari",
  category: "motor",
  title: "Yol verme akımları",
  description:
    "Üç fazlı asenkron motorun doğrudan, yıldız-üçgen, ototrafolu ve yumuşak yolvericili kalkışında şebekeden çekilen kalkış akımını ve kalkış torkunu hesaplayın; doğrudan yol vermeye göre oranlarını görün.",
  formulas: [
    { label: "Doğrudan yol verme", latex: "I_D = k \\cdot I_n \\qquad T_D = k_T \\cdot T_n" },
    { label: "Yıldız-üçgen", latex: "I_{Y} = \\frac{I_D}{3} \\qquad T_{Y} = \\frac{T_D}{3}" },
    { label: "Ototrafo (kademe x)", latex: "I_{\\text{hat}} = x^2 \\cdot I_D \\qquad I_{\\text{motor}} = x \\cdot I_D \\qquad T = x^2 \\cdot T_D" },
    {
      label: "Yumuşak yolverici (akım sınırı)",
      latex: "I_s = k_s \\cdot I_n \\qquad T \\approx \\left(\\frac{I_s}{I_D}\\right)^2 \\cdot T_D",
    },
  ],
  references: [
    {
      standard: "IEC 60947-4-1",
      title:
        "Alçak gerilim anahtarlama ve kumanda düzenleri — Bölüm 4-1: Kontaktörler ve motor yol vericiler — Elektromekanik kontaktörler ve motor yol vericiler",
      note: "Doğrudan, yıldız-üçgen ve ototrafolu yol vericiler",
    },
    {
      standard: "IEC 60947-4-2",
      title:
        "Alçak gerilim anahtarlama ve kumanda düzenleri — Bölüm 4-2: Kontaktörler ve motor yol vericiler — Yarı iletken motor kontrol düzenleri ve yol vericiler",
      note: "Yumuşak yolvericiler",
    },
    {
      standard: "IEC 60034-12",
      title: "Döner elektrik makineleri — Bölüm 12: Tek hızlı üç fazlı sincap kafesli asenkron motorların kalkış performansı",
      note: "Kalkış akımı ve kalkış torku oranları",
    },
  ],
  inputs: [
    { kind: "select", key: "yontem", label: "Yol verme yöntemi", options: METHOD_OPTIONS, default: "yildiz-ucgen" },
    {
      kind: "number",
      key: "In",
      label: "Motor nominal akımı",
      symbol: "I_n",
      dimension: "akim",
      defaultUnit: "A",
      default: 14.5,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "number",
      key: "k",
      label: "Kalkış akımı oranı (doğrudan yol vermede I_kalkış/I_n)",
      symbol: "k",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 7,
      min: 1,
      help: "Motor kataloğundan (I_A/I_N, I_s/I_n). Sincap kafesli motorlarda tipik 5–8.",
    },
    {
      kind: "number",
      key: "Tn",
      label: "Motor nominal torku",
      symbol: "T_n",
      dimension: "tork",
      defaultUnit: "Nm",
      default: 49.4,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "number",
      key: "kT",
      label: "Kalkış torku oranı (doğrudan yol vermede T_kalkış/T_n)",
      symbol: "k_T",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 2.3,
      min: 0,
      minExclusive: true,
      help: "Motor kataloğundan (T_A/T_N, T_s/T_n).",
    },
    {
      kind: "number",
      key: "x",
      label: "Ototrafo kademesi (motor gerilimi / şebeke gerilimi)",
      symbol: "x",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 65,
      min: 0,
      minExclusive: true,
      max: 1,
      visibleWhen: { key: "yontem", equals: "ototrafo" },
    },
    {
      kind: "number",
      key: "ks",
      label: "Akım sınırı (I_sınır/I_n)",
      symbol: "k_s",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 3.5,
      min: 1,
      help: "Yumuşak yolvericide ayarlanan kalkış akımı sınırının motor nominal akımına oranı.",
      visibleWhen: { key: "yontem", equals: "yumusak" },
    },
  ],
  outputs: [
    { key: "Ik", label: "Kalkış akımı (şebeke/hat)", symbol: "I_{\\text{kalkış}}", dimension: "akim", defaultUnit: "A" },
    { key: "IkOran", label: "Kalkış akımı / nominal akım", symbol: "I_{\\text{kalkış}}/I_n", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "Imotor", label: "Motor akımı (ototrafo çıkışı)", symbol: "I_{\\text{motor}}", dimension: "akim", defaultUnit: "A" },
    { key: "Tk", label: "Kalkış torku", symbol: "T_{\\text{kalkış}}", dimension: "tork", defaultUnit: "Nm" },
    { key: "TkOran", label: "Kalkış torku / nominal tork", symbol: "T_{\\text{kalkış}}/T_n", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "akimOrani", label: "Akım: doğrudan yol vermeye oranı", symbol: "I_{\\text{kalkış}}/I_D", dimension: "oran", defaultUnit: "percent" },
    { key: "torkOrani", label: "Tork: doğrudan yol vermeye oranı", symbol: "T_{\\text{kalkış}}/T_D", dimension: "oran", defaultUnit: "percent" },
  ],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const yontem = inputs.yontem as YolVermeYontemi;
    const In = num(inputs, "In", WHERE);
    const k = num(inputs, "k", WHERE);
    const Tn = num(inputs, "Tn", WHERE);
    const kT = num(inputs, "kT", WHERE);

    const ID = k * In;
    const TD = kT * Tn;
    const steps: Step[] = [
      {
        label: "Doğrudan yol verme kalkış akımı",
        latex: `I_D = k \\cdot I_n = ${latexNum(k)} \\cdot ${qI(In)} = ${qI(ID)}`,
      },
      {
        label: "Doğrudan yol verme kalkış torku",
        latex: `T_D = k_T \\cdot T_n = ${latexNum(kT)} \\cdot ${qT(Tn)} = ${qT(TD)}`,
      },
    ];
    const checks: Check[] = [];
    const outputs: Record<string, number> = {};
    /** Hat akımı ve torkun DOL'a oranı */
    let rI: number;
    let rT: number;

    switch (yontem) {
      case "direkt":
        rI = 1;
        rT = 1;
        break;
      case "yildiz-ucgen":
        rI = 1 / 3;
        rT = 1 / 3;
        steps.push(
          { label: "Yıldız bağlı kalkış akımı", latex: `I_Y = \\frac{I_D}{3} = \\frac{${qI(ID)}}{3} = ${qI(ID / 3)}` },
          { label: "Yıldız bağlı kalkış torku", latex: `T_Y = \\frac{T_D}{3} = \\frac{${qT(TD)}}{3} = ${qT(TD / 3)}` },
        );
        checks.push({ level: "ok", message: MESSAGES.starDelta });
        break;
      case "ototrafo": {
        const x = num(inputs, "x", WHERE);
        rI = x * x;
        rT = x * x;
        outputs.Imotor = x * ID;
        steps.push(
          {
            label: "Motor akımı",
            latex: `I_{\\text{motor}} = x \\cdot I_D = ${latexNum(x)} \\cdot ${qI(ID)} = ${qI(x * ID)}`,
          },
          {
            label: "Şebeke (hat) akımı",
            latex: `I_{\\text{hat}} = x^2 \\cdot I_D = (${latexNum(x)})^2 \\cdot ${qI(ID)} = ${qI(rI * ID)}`,
          },
          {
            label: "Kalkış torku",
            latex: `T = x^2 \\cdot T_D = (${latexNum(x)})^2 \\cdot ${qT(TD)} = ${qT(rT * TD)}`,
          },
        );
        break;
      }
      case "yumusak": {
        const ks = num(inputs, "ks", WHERE);
        const Is = ks * In;
        rI = Is / ID;
        rT = rI * rI;
        steps.push(
          { label: "Akım sınırı", latex: `I_s = k_s \\cdot I_n = ${latexNum(ks)} \\cdot ${qI(In)} = ${qI(Is)}` },
          {
            label: "Kalkış torku (yaklaşık)",
            latex: `T \\approx \\left(\\frac{I_s}{I_D}\\right)^2 \\cdot T_D = \\left(\\frac{${qI(Is)}}{${qI(ID)}}\\right)^2 \\cdot ${qT(TD)} = ${qT(rT * TD)}`,
          },
        );
        checks.push({ level: "ok", message: MESSAGES.softApprox });
        break;
      }
      default:
        throw new Error(`${WHERE}: bilinmeyen yöntem "${String(yontem)}"`);
    }

    const Ik = rI * ID;
    const Tk = rT * TD;
    Object.assign(outputs, {
      Ik,
      IkOran: Ik / In,
      Tk,
      TkOran: Tk / Tn,
      akimOrani: rI,
      torkOrani: rT,
    });
    steps.push({
      label: "Doğrudan yol vermeye oran",
      latex: `\\frac{I_{\\text{kalkış}}}{I_D} = ${latexQty(rI, "percent")} \\qquad \\frac{T_{\\text{kalkış}}}{T_D} = ${latexQty(rT, "percent")}`,
    });

    return { outputs, steps, checks };
  },
};
