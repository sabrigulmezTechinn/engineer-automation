/**
 * KAPSAM 5.6 — 4-20 mA döngü yük direnci.
 *
 * İki telli (döngüden beslenen) vericinin terminallerinde en büyük döngü akımında bile en düşük çalışma
 * gerilimi kalmalıdır: V_s − I_maks·R_yük ≥ V_min  ⇒  R_maks = (V_s − V_min) / I_maks.
 * Döngüdeki yük: seri dirençler (analog giriş kartı, bariyer, gösterge…) + kablo (gidiş-dönüş 2·L).
 *
 * En büyük döngü akımının varsayılanı ve NAMUR NE 43 sinyal sınırları koddan ayrı tutulur
 * (src/config/sinir/otomasyon.ts → ctx.limits.otomasyon).
 */
import { LIMITS } from "@/config/sinirlar";
import { latexAuto, latexAutoOperand, latexQty } from "@/lib/calc/latex";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, Reference, Step } from "@/lib/calc/types";
import { formatQuantity, fromSI } from "@/lib/units";

export type KabloModu = "yok" | "ozdirenc" | "ohm_km";

const NE43: Reference = {
  standard: "NAMUR NE 43",
  title: "Standardization of the signal level for the failure information of digital transmitters",
  clause: "Sinyal aralıkları: ölçüm 3,8–20,5 mA; arıza ≤ 3,6 mA veya ≥ 21 mA",
};

/** NBS Handbook 100 (1966) §1: Uluslararası Tavlanmış Bakır Standardı (IACS), 20 °C: 1/58 = 0,017241 Ω·mm²/m */
const IACS_RESISTIVITY_OHM_MM2_M = 0.017241;

const MESSAGES = {
  supplyTooLow: "Besleme gerilimi, vericinin en düşük çalışma geriliminden büyük olmalıdır.",
  ok: (pay: string) => `Toplam yük direnci sınır içinde; pay ${pay}.`,
  overAlarmOnly: (r: string, iUst: string) =>
    `Toplam yük, en büyük döngü akımındaki sınırı aşıyor; ölçüm aralığı (${iUst}'e kadar) sürülebilir, ancak üst arıza sinyali sürülemez. Ölçüm aralığı için R_maks = ${r}.`,
  overMeasuring: "Toplam yük direnci R_maks'ı aşıyor: verici terminal gerilimi en düşük çalışma geriliminin altına düşer, döngü ölçüm aralığını süremez.",
  belowAlarm: (i: string, a: string) =>
    `Tasarım akımı (${i}) NE 43 üst arıza eşiğinin (≥ ${a}) altında: verici üst arıza sinyalini sürerken döngü yetersiz kalabilir.`,
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`dongu-yuk-direnci: "${key}" sayı değil`);
  return v;
}

function list(inputs: ComputeInputs, key: string): number[] {
  const v = inputs[key];
  if (!Array.isArray(v)) throw new Error(`dongu-yuk-direnci: "${key}" liste değil`);
  return v;
}

function crossChecks(inputs: ComputeInputs): Check[] {
  if (num(inputs, "V_s") <= num(inputs, "V_min")) return [{ level: "hata", message: MESSAGES.supplyTooLow }];
  return [];
}

/** Kablo direnci (gidiş-dönüş): yok → 0. */
function cableResistance(inputs: ComputeInputs): { R: number; step?: Step } {
  const mode = inputs.kablo as KabloModu;
  if (mode === "yok") return { R: 0 };
  const L = num(inputs, "L");
  const qLen = latexQty(L, "m");
  if (mode === "ozdirenc") {
    const rho = num(inputs, "rho");
    const A = num(inputs, "A");
    const R = (rho * 2 * L) / A;
    return {
      R,
      step: {
        label: "Kablo direnci (gidiş-dönüş)",
        latex: `R_{\\text{kablo}} = \\frac{\\rho \\cdot 2L}{A} = \\frac{${latexQty(rho, "ohm_mm2_m", { significant: 5 })} \\cdot 2 \\cdot ${qLen}}{${latexQty(A, "mm2")}} = ${latexAuto(R, "direnc")}`,
      },
    };
  }
  if (mode === "ohm_km") {
    const r = num(inputs, "r_km");
    const R = r * 2 * L;
    return {
      R,
      step: {
        label: "Kablo direnci (gidiş-dönüş)",
        latex: `R_{\\text{kablo}} = r \\cdot 2L = ${latexQty(r, "ohm_per_km")} \\cdot 2 \\cdot ${qLen} = ${latexAuto(R, "direnc")}`,
      },
    };
  }
  throw new Error(`dongu-yuk-direnci: bilinmeyen kablo modu "${String(mode)}"`);
}

const qR = (v: number) => latexAuto(v, "direnc");
const qV = (v: number) => latexAuto(v, "gerilim");
const qI = (v: number) => latexAuto(v, "akim");
const fmtR = (v: number) => formatQuantity(v, "ohm");
const fmtmA = (v: number) => formatQuantity(fromSI(v, "mA"), "mA");

export const donguYukDirenci: CalcDefinition = {
  id: "5.6",
  slug: "dongu-yuk-direnci",
  category: "otomasyon",
  title: "4-20 mA döngü yük direnci",
  description:
    "İki telli 4-20 mA vericide besleme gerilimi, vericinin en düşük çalışma gerilimi ve en büyük döngü akımından izin verilen en büyük yük direncini bulun; giriş kartı, bariyer ve kablo dirençleriyle toplam yükü ve payı kontrol edin.",
  formulas: [
    { label: "En büyük yük direnci", latex: "R_{\\text{maks}} = \\frac{V_s - V_{\\text{min}}}{I_{\\text{maks}}}" },
    { label: "Kablo direnci (gidiş-dönüş)", latex: "R_{\\text{kablo}} = \\frac{\\rho \\cdot 2L}{A} = r \\cdot 2L" },
    { label: "Toplam yük", latex: "R_{\\text{yük}} = \\sum R_i + R_{\\text{kablo}}" },
    { label: "Verici terminal gerilimi", latex: "V_t = V_s - I_{\\text{maks}} \\cdot R_{\\text{yük}} \\ge V_{\\text{min}}" },
  ],
  references: [
    { ...NE43, note: "Varsayılan tasarım akımı 22 mA: vericiler üst arıza sinyalini 21 mA ve üstünde sürer." },
    {
      standard: "NBS Handbook 100",
      title: "Copper Wire Tables (1966)",
      clause: "§1 Uluslararası Tavlanmış Bakır Standardı",
      note: "Bakır özdirenci 20 °C'de 0,017241 Ω·mm²/m (varsayılan değer).",
    },
  ],
  inputs: [
    {
      kind: "number",
      key: "V_s",
      label: "Besleme gerilimi",
      symbol: "V_s",
      dimension: "gerilim",
      defaultUnit: "V",
      units: ["V"],
      default: 24,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "number",
      key: "V_min",
      label: "Vericinin en düşük çalışma gerilimi",
      symbol: "V_{\\text{min}}",
      dimension: "gerilim",
      defaultUnit: "V",
      units: ["V"],
      default: 12,
      min: 0,
      help: "Verici veri sayfasındaki en düşük terminal (besleme) gerilimi.",
    },
    {
      kind: "number",
      key: "I_maks",
      label: "En büyük döngü akımı",
      symbol: "I_{\\text{maks}}",
      dimension: "akim",
      defaultUnit: "mA",
      units: ["mA", "A"],
      // Varsayılan config'ten (SI, A) gelir; `default` defaultUnit (mA) cinsindendir. 12 anlamlı basamağa
      // yuvarlanır ki giriş kutusunda kayan nokta artığı (ör. 22,999999999999996) görünmesin.
      default: Number(fromSI(LIMITS.otomasyon.donguTasarimAkimi, "mA").toPrecision(12)),
      min: 0,
      minExclusive: true,
      help: "Verici üst arıza sinyalini (NE 43: ≥ 21 mA) sürebileceği için tasarımda tipik 22 mA alınır; veri sayfasına göre değiştirin.",
    },
    {
      kind: "numberList",
      key: "R_list",
      label: "Döngüdeki dirençler",
      symbol: "R_i",
      dimension: "direnc",
      defaultUnit: "ohm",
      units: ["ohm", "kohm"],
      default: [250],
      min: 0,
      help: "Analog giriş kartı, bariyer, gösterge vb. Noktalı virgülle (;) ayırın.",
    },
    {
      kind: "select",
      key: "kablo",
      label: "Kablo direnci",
      options: [
        { value: "yok", label: "İhmal et" },
        { value: "ozdirenc", label: "Uzunluk, kesit ve özdirençle" },
        { value: "ohm_km", label: "Uzunluk ve Ω/km değeriyle" },
      ],
      default: "ozdirenc",
    },
    {
      kind: "number",
      key: "L",
      label: "Kablo uzunluğu (tek yön)",
      symbol: "L",
      dimension: "uzunluk",
      defaultUnit: "m",
      units: ["m", "km", "ft"],
      default: 300,
      min: 0,
      visibleWhen: { key: "kablo", equals: ["ozdirenc", "ohm_km"] },
      help: "Döngü gidiş-dönüş olduğu için hesapta 2·L alınır.",
    },
    {
      kind: "number",
      key: "A",
      label: "İletken kesiti",
      symbol: "A",
      dimension: "alan",
      defaultUnit: "mm2",
      units: ["mm2"],
      default: 0.75,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "kablo", equals: "ozdirenc" },
    },
    {
      kind: "number",
      key: "rho",
      label: "İletken özdirenci",
      symbol: "\\rho",
      dimension: "ozdirenc",
      defaultUnit: "ohm_mm2_m",
      default: IACS_RESISTIVITY_OHM_MM2_M,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "kablo", equals: "ozdirenc" },
      help: "Tavlanmış bakır, 20 °C: 0,017241 Ω·mm²/m (IACS).",
    },
    {
      kind: "number",
      key: "r_km",
      label: "İletken direnci (katalog)",
      symbol: "r",
      dimension: "direnc_uzunluk",
      defaultUnit: "ohm_per_km",
      default: 24.5,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "kablo", equals: "ohm_km" },
      help: "Kablo kataloğundaki tek iletken direnci.",
    },
  ],
  outputs: [
    { key: "R_maks", label: "İzin verilen en büyük yük", symbol: "R_{\\text{maks}}", dimension: "direnc", defaultUnit: "ohm" },
    { key: "R_kablo", label: "Kablo direnci (gidiş-dönüş)", symbol: "R_{\\text{kablo}}", dimension: "direnc", defaultUnit: "ohm" },
    { key: "R_yuk", label: "Toplam yük direnci", symbol: "R_{\\text{yük}}", dimension: "direnc", defaultUnit: "ohm" },
    { key: "pay", label: "Direnç payı", symbol: "R_{\\text{maks}} - R_{\\text{yük}}", dimension: "direnc", defaultUnit: "ohm" },
    { key: "V_t", label: "Verici terminal gerilimi (I_maks'ta)", symbol: "V_t", dimension: "gerilim", defaultUnit: "V" },
  ],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs, ctx: CalcContext) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const Vs = num(inputs, "V_s");
    const Vmin = num(inputs, "V_min");
    const I = num(inputs, "I_maks");
    const Rs = list(inputs, "R_list");
    const ne43 = ctx.limits.otomasyon.namurNe43;

    const Rmax = (Vs - Vmin) / I;
    const cable = cableResistance(inputs);
    const Rsum = Rs.reduce((a, b) => a + b, 0);
    const Rload = Rsum + cable.R;
    const margin = Rmax - Rload;
    const Vt = Vs - I * Rload;

    const steps: Step[] = [
      {
        label: "En büyük yük direnci",
        latex: `R_{\\text{maks}} = \\frac{V_s - V_{\\text{min}}}{I_{\\text{maks}}} = \\frac{${qV(Vs)} - ${qV(Vmin)}}{${qI(I)}} = ${qR(Rmax)}`,
      },
    ];
    if (cable.step) steps.push(cable.step);
    const terms = [...Rs.map(qR), ...(cable.step ? [qR(cable.R)] : [])];
    steps.push({
      label: "Toplam yük direnci",
      latex: `R_{\\text{yük}} = ${terms.length > 1 ? `${terms.join(" + ")} = ` : ""}${qR(Rload)}`,
    });
    steps.push({
      label: "Direnç payı",
      latex: `R_{\\text{maks}} - R_{\\text{yük}} = ${qR(Rmax)} - ${qR(Rload)} = ${qR(margin)}`,
    });
    steps.push({
      label: "Verici terminal gerilimi",
      latex: `V_t = V_s - I_{\\text{maks}} \\cdot R_{\\text{yük}} = ${qV(Vs)} - ${qI(I)} \\cdot ${qR(Rload)} = ${latexAutoOperand(Vt, "gerilim")}`,
    });

    const checks: Check[] = [];
    if (Rload <= Rmax) {
      checks.push({ level: "ok", message: MESSAGES.ok(fmtR(margin)), reference: NE43 });
    } else {
      // Ölçüm aralığının üst sınırında (NE 43: 20,5 mA) yük yeterli mi?
      const RmaxMeasuring = (Vs - Vmin) / ne43.olcumUst;
      if (I > ne43.olcumUst && Rload <= RmaxMeasuring) {
        checks.push({ level: "uyari", message: MESSAGES.overAlarmOnly(fmtR(RmaxMeasuring), fmtmA(ne43.olcumUst)), reference: NE43 });
      } else {
        checks.push({ level: "hata", message: MESSAGES.overMeasuring, reference: NE43 });
      }
    }
    if (I < ne43.arizaUst) {
      checks.push({ level: "uyari", message: MESSAGES.belowAlarm(fmtmA(I), fmtmA(ne43.arizaUst)), reference: NE43 });
    }

    const outputs: Record<string, number> = { R_maks: Rmax, R_yuk: Rload, pay: margin, V_t: Vt };
    if (cable.step) outputs.R_kablo = cable.R;
    return { outputs, steps, checks };
  },
};
