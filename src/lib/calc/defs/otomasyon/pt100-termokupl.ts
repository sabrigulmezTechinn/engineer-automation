/**
 * KAPSAM 5.3 — PT100/PT1000 (RTD) ve termokupl dönüşümleri.
 *
 * (a) Platin RTD, IEC 60751 Callendar–Van Dusen (t: °C, geçerli aralık −200…850 °C):
 *   t ≥ 0 °C: R = R₀·(1 + A·t + B·t²)
 *   t < 0 °C: R = R₀·(1 + A·t + B·t² + C·(t − 100)·t³)
 *   A = 3,9083e-3, B = −5,775e-7, C = −4,183e-12. Katsayıların kaynağı (IEC 60751'e atıfla):
 *   Texas Instruments SBAA275A "A Basic Guide to RTD Measurements", Bölüm 1.1,
 *   https://www.ti.com/lit/an/sbaa275a/sbaa275a.pdf
 *   Ters yön: R ≥ R₀ için ikinci derece denklemin kökü (kapalı form); R < R₀ için bu kökten başlayan
 *   Newton yinelemesi (C terimi dördüncü dereceden olduğu için).
 *
 * (b) Termokupl, NIST ITS-90 referans fonksiyonları (t: °C, E: mV; katsayılar termokupl-nist.ts'te):
 *   E = Σ cᵢ·tⁱ (K tipinde 0 °C üstünde + a₀·exp(a₁·(t − a₂)²))
 *   Ters yön: NIST yaklaşık ters polinomu t = Σ dᵢ·Eⁱ ilk tahmin olarak kullanılır, ardından referans
 *   fonksiyonu üzerinde Newton yinelemesiyle düzeltilir. Böylece sonuç, ters polinomun ±0,06 °C'ye varan
 *   yaklaşım hatası olmadan referans fonksiyonunun (ve ondan üretilen tabloların) tam tersi olur.
 *   Geçerlilik: sıcaklık → EMF referans fonksiyonunun aralığında; EMF → sıcaklık NIST ters polinomlarının
 *   gerilim aralığında (K, E, N, T için −200 °C'den, B için 250 °C'den başlar).
 *   R ve S tiplerinde ters polinom aralıkları örtüşür (250–1200 °C ve 1064–1664,5 °C); tablo sırasındaki
 *   ilk uygun aralık seçilir, yani geçiş 1200 °C'ye karşılık gelen gerilimdedir (R: 13,228 mV, S: 11,950 mV).
 *   Soğuk uç kompanzasyonu: E(t) = E_ölçülen + E(t_soğuk uç), ardından t = E⁻¹(E(t)).
 *
 * Motor içinde sıcaklık K, gerilim V'tur; dönüşümler compute sınırında yapılır.
 */
import { latexNum, latexQty } from "@/lib/calc/latex";
import { formatNumber } from "@/lib/units";
import type { CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";
import { NIST_TERMOKUPL, type TermokuplTipi } from "./termokupl-nist";

export type SensorMod = "rtd-tr" | "rtd-rt" | "tc-te" | "tc-et";

const MOD_OPTIONS: { value: SensorMod; label: string }[] = [
  { value: "rtd-tr", label: "RTD (Pt100/Pt1000): sıcaklık → direnç" },
  { value: "rtd-rt", label: "RTD (Pt100/Pt1000): direnç → sıcaklık" },
  { value: "tc-te", label: "Termokupl: sıcaklık → EMF" },
  { value: "tc-et", label: "Termokupl: EMF → sıcaklık" },
];

const R0_OPTIONS = [
  { value: "100", label: "Pt100 (R₀ = 100 Ω)" },
  { value: "1000", label: "Pt1000 (R₀ = 1000 Ω)" },
  { value: "ozel", label: "Özel R₀" },
];

const TC_OPTIONS: { value: TermokuplTipi; label: string }[] = [
  { value: "K", label: "K (NiCr–NiAl)" },
  { value: "J", label: "J (Fe–CuNi)" },
  { value: "T", label: "T (Cu–CuNi)" },
  { value: "E", label: "E (NiCr–CuNi)" },
  { value: "N", label: "N (NiCrSi–NiSi)" },
  { value: "R", label: "R (Pt13Rh–Pt)" },
  { value: "S", label: "S (Pt10Rh–Pt)" },
  { value: "B", label: "B (Pt30Rh–Pt6Rh)" },
];

/** IEC 60751 Callendar–Van Dusen katsayıları (°C⁻¹, °C⁻², °C⁻⁴); kaynak dosya başında. */
export const CVD = { A: 3.9083e-3, B: -5.775e-7, C: -4.183e-12 } as const;
/** IEC 60751 denkleminin geçerli aralığı, °C */
export const RTD_ARALIGI = { tMin: -200, tMax: 850 } as const;

const ZERO_C = 273.15;
const TOL = 1e-9;

// ---------------------------------------------------------------------------------------------
// RTD
// ---------------------------------------------------------------------------------------------

/** R/R₀ oranı, t: °C */
function rtdOran(t: number): number {
  const { A, B, C } = CVD;
  const base = 1 + A * t + B * t * t;
  return t >= 0 ? base : base + C * (t - 100) * t * t * t;
}

/** IEC 60751: t (°C) → R (Ω) */
export function rtdDirenc(r0: number, t: number): number {
  return r0 * rtdOran(t);
}

/** IEC 60751: R (Ω) → t (°C). R ≥ R₀: kapalı form kök; R < R₀: Newton yinelemesi. */
export function rtdSicaklik(r0: number, r: number): number {
  const { A, B, C } = CVD;
  const oran = r / r0;
  // B·t² + A·t + (1 − oran) = 0 kökünün sayısal olarak kararlı biçimi: t = 2(oran − 1)/(A + √(A² − 4B(1 − oran)))
  const tq = (2 * (oran - 1)) / (A + Math.sqrt(A * A - 4 * B * (1 - oran)));
  if (oran >= 1) return tq;
  let t = tq;
  for (let i = 0; i < 50; i++) {
    const f = rtdOran(t) - oran;
    const df = A + 2 * B * t + C * (4 * t * t * t - 300 * t * t);
    const dt = f / df;
    t -= dt;
    if (Math.abs(dt) < 1e-12) break;
  }
  return t;
}

// ---------------------------------------------------------------------------------------------
// Termokupl
// ---------------------------------------------------------------------------------------------

function polyval(c: readonly number[], x: number): number {
  let s = 0;
  for (let i = c.length - 1; i >= 0; i--) s = s * x + c[i];
  return s;
}

function polyder(c: readonly number[], x: number): number {
  let s = 0;
  for (let i = c.length - 1; i >= 1; i--) s = s * x + i * c[i];
  return s;
}

/** Referans fonksiyonunun (sıcaklık → EMF) geçerli aralığı, °C */
export function tcSicaklikAraligi(tip: TermokuplTipi): { tMin: number; tMax: number } {
  const r = NIST_TERMOKUPL[tip].referans;
  return { tMin: r[0].tMin, tMax: r[r.length - 1].tMax };
}

/** Ters polinomların (EMF → sıcaklık) geçerli gerilim aralığı, mV */
export function tcEmfAraligi(tip: TermokuplTipi): { eMin: number; eMax: number } {
  const r = NIST_TERMOKUPL[tip].ters;
  return { eMin: r[0].eMin, eMax: r[r.length - 1].eMax };
}

function referansAraligi(tip: TermokuplTipi, t: number) {
  const r = NIST_TERMOKUPL[tip].referans;
  return r.find((x) => t <= x.tMax) ?? r[r.length - 1];
}

/** NIST ITS-90 referans fonksiyonu: t (°C) → E (mV), 0 °C referans ucuyla */
export function tcEmf(tip: TermokuplTipi, t: number): number {
  const data = NIST_TERMOKUPL[tip];
  const r = referansAraligi(tip, t);
  let e = polyval(r.c, t);
  if (data.ustel && r.tMin >= 0) {
    const { a0, a1, a2 } = data.ustel;
    e += a0 * Math.exp(a1 * (t - a2) ** 2);
  }
  return e;
}

/** dE/dt (mV/°C) */
function tcEmfTurev(tip: TermokuplTipi, t: number): number {
  const data = NIST_TERMOKUPL[tip];
  const r = referansAraligi(tip, t);
  let d = polyder(r.c, t);
  if (data.ustel && r.tMin >= 0) {
    const { a0, a1, a2 } = data.ustel;
    d += a0 * Math.exp(a1 * (t - a2) ** 2) * 2 * a1 * (t - a2);
  }
  return d;
}

/** NIST yaklaşık ters polinomu: E (mV) → t (°C). Aralık seçimi tablo sırasına göre (ilk eMax ≥ E). */
export function tcTersPolinom(tip: TermokuplTipi, e: number): number {
  const r = NIST_TERMOKUPL[tip].ters;
  const aralik = r.find((x) => e <= x.eMax) ?? r[r.length - 1];
  return polyval(aralik.d, e);
}

/** E (mV) → t (°C): ters polinomla başlayıp referans fonksiyonu üzerinde Newton yinelemesi */
export function tcSicaklik(tip: TermokuplTipi, e: number): number {
  const { tMin, tMax } = tcSicaklikAraligi(tip);
  let t = tcTersPolinom(tip, e);
  for (let i = 0; i < 50; i++) {
    t = Math.min(tMax, Math.max(tMin, t));
    const dt = (tcEmf(tip, t) - e) / tcEmfTurev(tip, t);
    t -= dt;
    if (Math.abs(dt) < 1e-10) break;
  }
  return t;
}

// ---------------------------------------------------------------------------------------------
// Hesap tanımı
// ---------------------------------------------------------------------------------------------

const MESSAGES = {
  rtdSicaklikDisi: (t: string) =>
    `Sıcaklık (${t}) IEC 60751 Callendar–Van Dusen denkleminin geçerli aralığının (−200…850 °C) dışında.`,
  rtdDirencDisi: (r: string, rMin: string, rMax: string) =>
    `Direnç (${r}) bu R₀ için −200…850 °C aralığına karşılık gelen ${rMin}…${rMax} aralığının dışında.`,
  tcSicaklikDisi: (ad: string, tip: string, t: string, tMin: string, tMax: string) =>
    `${ad} (${t}) ${tip} tipi termokuplun NIST ITS-90 referans fonksiyonunun geçerli aralığının (${tMin}…${tMax}) dışında.`,
  tcEmfDisi: (e: string, tip: string, eMin: string, eMax: string) =>
    `Soğuk uç kompanzasyonlu EMF (${e}) ${tip} tipi için NIST ters fonksiyonunun geçerli aralığının (${eMin}…${eMax}) dışında.`,
} as const;

const REF_IEC60751 = {
  standard: "IEC 60751",
  title: "Endüstriyel platin dirençli termometreler ve platin sıcaklık sensörleri",
  clause: "Sıcaklık/direnç ilişkisi (Callendar–Van Dusen)",
} as const;
const REF_IEC60584 = {
  standard: "IEC 60584-1",
  title: "Termokupllar — Bölüm 1: EMF özellikleri ve toleranslar",
} as const;
const REF_NIST = {
  standard: "NIST ITS-90 Thermocouple Database (SRD 60)",
  title: "ITS-90 termokupl referans fonksiyonları ve ters fonksiyonları; NIST Monograph 175",
  note: "Katsayılar: https://its90.nist.gov/downloadFiles/allcoeff.tab.txt",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`pt100-termokupl: "${key}" sayı değil`);
  return v;
}

function r0Degeri(inputs: ComputeInputs): number {
  const sec = inputs.r0Secim as string;
  return sec === "ozel" ? num(inputs, "R0") : Number(sec);
}

// Mesaj metinleri için biçim
const fC = (t: number) => `${formatNumber(t)} °C`;
const fOhm = (r: number) => `${formatNumber(r)} Ω`;
const fmV = (e: number) => `${formatNumber(e)} mV`;

const icinde = (x: number, a: number, b: number) =>
  x >= a - TOL * Math.max(1, Math.abs(a)) && x <= b + TOL * Math.max(1, Math.abs(b));

/** Aralık kontrolleri ("hata" seviyesinde hesap yapılmaz) */
function crossChecks(inputs: ComputeInputs): Check[] {
  const mod = inputs.mod as SensorMod;
  const checks: Check[] = [];
  if (mod === "rtd-tr") {
    const t = num(inputs, "T") - ZERO_C;
    if (!icinde(t, RTD_ARALIGI.tMin, RTD_ARALIGI.tMax)) {
      checks.push({ level: "hata", message: MESSAGES.rtdSicaklikDisi(fC(t)), reference: REF_IEC60751 });
    }
  } else if (mod === "rtd-rt") {
    const r0 = r0Degeri(inputs);
    const r = num(inputs, "R");
    const rMin = rtdDirenc(r0, RTD_ARALIGI.tMin);
    const rMax = rtdDirenc(r0, RTD_ARALIGI.tMax);
    if (!icinde(r, rMin, rMax)) {
      checks.push({ level: "hata", message: MESSAGES.rtdDirencDisi(fOhm(r), fOhm(rMin), fOhm(rMax)), reference: REF_IEC60751 });
    }
  } else {
    const tip = inputs.tcTip as TermokuplTipi;
    const { tMin, tMax } = tcSicaklikAraligi(tip);
    const tS = num(inputs, "Ts") - ZERO_C;
    if (!icinde(tS, tMin, tMax)) {
      checks.push({
        level: "hata",
        message: MESSAGES.tcSicaklikDisi("Soğuk uç sıcaklığı", tip, fC(tS), fC(tMin), fC(tMax)),
        reference: REF_NIST,
      });
      return checks;
    }
    if (mod === "tc-te") {
      const t = num(inputs, "T") - ZERO_C;
      if (!icinde(t, tMin, tMax)) {
        checks.push({
          level: "hata",
          message: MESSAGES.tcSicaklikDisi("Sıcaklık", tip, fC(t), fC(tMin), fC(tMax)),
          reference: REF_NIST,
        });
      }
    } else {
      const eToplam = num(inputs, "E") * 1e3 + tcEmf(tip, tS);
      const { eMin, eMax } = tcEmfAraligi(tip);
      if (!icinde(eToplam, eMin, eMax)) {
        checks.push({ level: "hata", message: MESSAGES.tcEmfDisi(fmV(eToplam), tip, fmV(eMin), fmV(eMax)), reference: REF_NIST });
      }
    }
  }
  return checks;
}

// Adım yardımcıları: kartlarla aynı birimler (°C, Ω, mV), 6 anlamlı basamak (direnç 7: 138,5055 Ω)
const SIG = { significant: 6 } as const;
const qT = (tC: number) => latexQty(tC + ZERO_C, "degC", SIG);
const qR = (r: number) => latexQty(r, "ohm", { significant: 7 });
const qE = (emV: number) => latexQty(emV * 1e-3, "mV", SIG);
const n6 = (x: number) => latexNum(x, SIG);
/** Çarpım/toplam içinde negatif sayı parantezlenir */
const op = (x: number) => (x < 0 ? `(${n6(x)})` : n6(x));

export const pt100Termokupl: CalcDefinition = {
  id: "5.3",
  slug: "pt100-termokupl",
  category: "otomasyon",
  title: "PT100/PT1000 ve termokupl dönüşümleri",
  description:
    "Platin dirençli termometrelerde (Pt100, Pt1000) sıcaklık ile direnç arasında IEC 60751 Callendar–Van Dusen denklemiyle; termokupllarda (K, J, T, E, N, R, S, B) sıcaklık ile EMF arasında NIST ITS-90 referans fonksiyonlarıyla, soğuk uç kompanzasyonu dahil dönüşüm yapın.",
  formulas: [
    { label: "RTD, T ≥ 0 °C", latex: "R = R_0\\,(1 + A\\,T + B\\,T^2)" },
    { label: "RTD, T < 0 °C", latex: "R = R_0\\,\\left[1 + A\\,T + B\\,T^2 + C\\,(T - 100)\\,T^3\\right]" },
    { label: "RTD ters (R ≥ R₀)", latex: "T = \\frac{-A + \\sqrt{A^2 - 4B\\,(1 - R/R_0)}}{2B}" },
    { label: "Termokupl (NIST ITS-90)", latex: "E = \\sum_{i=0}^{n} c_i\\,t^i \\quad (\\text{K tipi, } t > 0: + a_0\\,e^{a_1 (t - a_2)^2})" },
    { label: "Termokupl ters (NIST)", latex: "t = \\sum_{i=0}^{n} d_i\\,E^i" },
    { label: "Soğuk uç kompanzasyonu", latex: "E(t) = E_{\\text{ölç}} + E(t_s)" },
  ],
  references: [REF_IEC60751, REF_IEC60584, REF_NIST],
  inputs: [
    { kind: "select", key: "mod", label: "Sensör ve yön", options: MOD_OPTIONS, default: "rtd-tr" },
    {
      kind: "select",
      key: "r0Secim",
      label: "RTD tipi",
      options: R0_OPTIONS,
      default: "100",
      visibleWhen: { key: "mod", equals: ["rtd-tr", "rtd-rt"] },
    },
    {
      kind: "number",
      key: "R0",
      label: "0 °C'deki direnç",
      symbol: "R_0",
      dimension: "direnc",
      defaultUnit: "ohm",
      units: ["ohm", "kohm"],
      default: 500,
      min: 0,
      minExclusive: true,
      help: "IEC 60751 katsayıları (α = 0,00385 /°C) tüm platin sensörler için geçerlidir (ör. Pt200, Pt500).",
      visibleWhen: { key: "r0Secim", equals: "ozel" },
    },
    {
      kind: "select",
      key: "tcTip",
      label: "Termokupl tipi",
      options: TC_OPTIONS,
      default: "K",
      visibleWhen: { key: "mod", equals: ["tc-te", "tc-et"] },
    },
    {
      kind: "number",
      key: "T",
      label: "Sıcaklık",
      symbol: "T",
      dimension: "sicaklik",
      defaultUnit: "degC",
      units: ["degC", "K", "degF"],
      default: 100,
      min: 0,
      help: "RTD için −200…850 °C; termokuplda tipe göre NIST referans fonksiyonunun aralığı.",
      visibleWhen: { key: "mod", equals: ["rtd-tr", "tc-te"] },
    },
    {
      kind: "number",
      key: "R",
      label: "Ölçülen direnç",
      symbol: "R",
      dimension: "direnc",
      defaultUnit: "ohm",
      units: ["ohm", "kohm"],
      default: 119.4,
      min: 0,
      minExclusive: true,
      help: "Kablo direnci düşülmüş sensör direnci (2 telli bağlantıda kablo direnci ölçüme eklenir).",
      visibleWhen: { key: "mod", equals: "rtd-rt" },
    },
    {
      kind: "number",
      key: "E",
      label: "Ölçülen EMF (klemens gerilimi)",
      symbol: "E_{\\text{ölç}}",
      dimension: "gerilim",
      defaultUnit: "mV",
      units: ["mV", "uV", "V"],
      default: 3.096,
      help: "Termokuplun ölçü aleti/PLC klemensinde ölçülen gerilim; soğuk uç sıcaklığına göre kompanze edilir.",
      visibleWhen: { key: "mod", equals: "tc-et" },
    },
    {
      kind: "number",
      key: "Ts",
      label: "Soğuk uç (referans uç) sıcaklığı",
      symbol: "t_s",
      dimension: "sicaklik",
      defaultUnit: "degC",
      units: ["degC", "K", "degF"],
      default: 25,
      min: 0,
      help: "Termokupl tellerinin bakır iletkenlere geçtiği noktanın (klemens) sıcaklığı. NIST tablolarıyla karşılaştırmak için 0 °C girin.",
      visibleWhen: { key: "mod", equals: ["tc-te", "tc-et"] },
    },
  ],
  outputs: [
    { key: "R", label: "Direnç", symbol: "R", dimension: "direnc", defaultUnit: "ohm", units: ["ohm", "kohm"], autoUnit: false },
    { key: "T", label: "Sıcaklık", symbol: "T", dimension: "sicaklik", defaultUnit: "degC", units: ["degC", "K", "degF"] },
    {
      key: "E_olcum",
      label: "Ölçülecek EMF (klemens gerilimi)",
      symbol: "E_{\\text{ölç}}",
      dimension: "gerilim",
      defaultUnit: "mV",
      units: ["mV", "uV", "V"],
      autoUnit: false,
    },
    {
      key: "E_sicak",
      label: "Sıcak uç EMF'si E(t) (0 °C referanslı)",
      symbol: "E(t)",
      dimension: "gerilim",
      defaultUnit: "mV",
      units: ["mV", "uV", "V"],
      autoUnit: false,
    },
    {
      key: "E_soguk",
      label: "Soğuk uç EMF'si E(tₛ) (0 °C referanslı)",
      symbol: "E(t_s)",
      dimension: "gerilim",
      defaultUnit: "mV",
      units: ["mV", "uV", "V"],
      autoUnit: false,
    },
  ],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const mod = inputs.mod as SensorMod;
    const steps: Step[] = [];
    const outputs: Record<string, number> = {};
    const { A, B, C } = CVD;
    const katsayilar = `A = ${n6(A)},\\; B = ${n6(B)},\\; C = ${n6(C)}`;

    if (mod === "rtd-tr") {
      const r0 = r0Degeri(inputs);
      const t = num(inputs, "T") - ZERO_C;
      const r = rtdDirenc(r0, t);
      outputs.R = r;
      steps.push({ label: "IEC 60751 katsayıları", latex: katsayilar });
      steps.push(
        t >= 0
          ? {
              label: "Direnç (T ≥ 0 °C)",
              latex: `R = R_0\\,(1 + A\\,T + B\\,T^2) = ${qR(r0)} \\cdot (1 + ${n6(A)} \\cdot ${n6(t)} + ${op(B)} \\cdot ${op(t)}^2) = ${qR(r)}`,
            }
          : {
              label: "Direnç (T < 0 °C)",
              latex:
                `R = R_0\\,\\left[1 + A\\,T + B\\,T^2 + C\\,(T - 100)\\,T^3\\right] = ` +
                `${qR(r0)} \\cdot \\left[1 + ${n6(A)} \\cdot ${op(t)} + ${op(B)} \\cdot ${op(t)}^2 + ${op(C)} \\cdot (${n6(t)} - 100) \\cdot ${op(t)}^3\\right] = ${qR(r)}`,
            },
      );
    } else if (mod === "rtd-rt") {
      const r0 = r0Degeri(inputs);
      const r = num(inputs, "R");
      const t = rtdSicaklik(r0, r);
      outputs.T = t + ZERO_C;
      steps.push({ label: "IEC 60751 katsayıları", latex: katsayilar });
      steps.push({ label: "Direnç oranı", latex: `\\frac{R}{R_0} = \\frac{${qR(r)}}{${qR(r0)}} = ${n6(r / r0)}` });
      steps.push(
        r >= r0
          ? {
              label: "Sıcaklık (R ≥ R₀, ikinci derece denklemin kökü)",
              latex: `T = \\frac{-A + \\sqrt{A^2 - 4B\\,(1 - R/R_0)}}{2B} = ${qT(t)}`,
            }
          : {
              label: "Sıcaklık (R < R₀, Newton yinelemesi)",
              latex: `1 + A\\,T + B\\,T^2 + C\\,(T - 100)\\,T^3 = ${n6(r / r0)} \\;\\Rightarrow\\; T = ${qT(t)}`,
            },
      );
    } else {
      const tip = inputs.tcTip as TermokuplTipi;
      const tS = num(inputs, "Ts") - ZERO_C;
      const eS = tcEmf(tip, tS);
      outputs.E_soguk = eS * 1e-3;
      steps.push({ label: "Soğuk uç EMF'si (NIST ITS-90)", latex: `E(t_s) = E(${qT(tS)}) = ${qE(eS)}` });

      if (mod === "tc-te") {
        const t = num(inputs, "T") - ZERO_C;
        const eT = tcEmf(tip, t);
        const eM = eT - eS;
        outputs.E_sicak = eT * 1e-3;
        outputs.E_olcum = eM * 1e-3;
        steps.push({ label: "Sıcak uç EMF'si (NIST ITS-90)", latex: `E(t) = E(${qT(t)}) = ${qE(eT)}` });
        steps.push({
          label: "Klemenste ölçülecek EMF",
          latex: `E_{\\text{ölç}} = E(t) - E(t_s) = ${qE(eT)} - ${eS < 0 ? `(${qE(eS)})` : qE(eS)} = ${qE(eM)}`,
        });
      } else {
        const eM = num(inputs, "E") * 1e3;
        const eT = eM + eS;
        const t = tcSicaklik(tip, eT);
        outputs.E_sicak = eT * 1e-3;
        outputs.T = t + ZERO_C;
        steps.push({
          label: "Soğuk uç kompanzasyonu",
          latex: `E(t) = E_{\\text{ölç}} + E(t_s) = ${qE(eM)} + ${eS < 0 ? `(${qE(eS)})` : qE(eS)} = ${qE(eT)}`,
        });
        steps.push({
          label: "Sıcaklık (NIST ters polinomu, referans fonksiyonuyla Newton düzeltmesi)",
          latex: `t = E^{-1}(${qE(eT)}) = ${qT(t)}`,
        });
      }
    }

    return { outputs, steps, checks: [] };
  },
};
