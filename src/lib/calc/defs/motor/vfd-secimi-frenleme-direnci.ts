/**
 * KAPSAM 3.4 — VFD seçimi ve frenleme direnci.
 *
 * (a) Sürücü akımı: sürücünün nominal çıkış akımı hem motor nominal akımını hem de uygulamanın
 *     kısa süreli akımını (aşırı yük çarpanıyla) karşılamalıdır: I_sürücü ≥ max(I_n, I_kısa/k_aşırı).
 *     Aşırı yük çarpanı ve süresi sürücü veri sayfasından alınır (görev derecesine göre değişir).
 * (b) Frenleme direnci: fren kıyıcısı DC bara gerilimi U_dc'de devreye girer; tepe frenleme gücünü
 *     bu gerilimde çekebilmek için R ≤ R_maks = U_dc²/P_fren. Sürücünün izin verdiği R_min ile
 *     karşılaştırılır. Direncin sürekli güç değeri = frenleme süresince ortalama güç · görev çevrimi.
 * (c) Frenleme gücü mekanikten: doğrusal rampa (sabit yavaşlama) varsayımıyla
 *     ΔE = ½·J·(ω₁² − ω₂²), T_fren = J·(ω₁ − ω₂)/t, P_tepe = T_fren·ω₁; DC baraya ulaşan güç
 *     mekanik ve elektriksel verimle çarpılır (kayıplar frenleme gücünü azaltır).
 */
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexAuto, latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";
import { formatQuantity, fromSI } from "@/lib/units";
import { num, optNum, qFrac, qOmega, qRpm } from "./ortak";

export type VfdHesap = "surucu" | "fren";
export type FrenKaynak = "dogrudan" | "mekanik";

const WHERE = "vfd-secimi-frenleme-direnci";

const MESSAGES = {
  speedOrder: "Yavaşlamada son devir hızı (n₂) ilk devir hızından (n₁) küçük olmalıdır.",
  overloadGoverns:
    "Kısa süreli akım belirleyici: sürücü, aşırı yük çarpanıyla bu akımı verebilecek nominal akımda seçilmeli.",
  nominalGoverns: "Motor nominal akımı belirleyici; kısa süreli akım sürücünün aşırı yük kapasitesi içinde kalıyor.",
  rminTooHigh: (rmin: string, rmax: string) =>
    `Sürücünün izin verdiği en küçük direnç (${rmin}), gereken en büyük dirençten (${rmax}) büyük: bu frenleme gücü bu sürücünün fren kıyıcısıyla karşılanamaz. Daha büyük sürücü veya harici fren ünitesi gerekir.`,
  rangeOk: (rmin: string, rmax: string) => `Frenleme direnci ${rmin} ile ${rmax} arasında seçilmelidir.`,
  rangeNoRmin:
    "Seçilen direnç R_maks'ı aşmamalı ve sürücü veri sayfasındaki en küçük direnç değerinin (R_min) altında olmamalıdır.",
  directAssumption:
    "Frenleme süresince güç sabit ve tepe değere eşit kabul edildi (güvenli taraf). Doğrusal rampayla sıfıra yavaşlamada ortalama güç tepe değerin yaklaşık yarısıdır.",
  mechAssumption:
    "Doğrusal rampa (sabit yavaşlama) kabul edildi; yükün sürtünme torku ihmal edildi (güvenli taraf). Verimleri %100 almak da güvenli taraftadır.",
} as const;

const qI = (v: number) => latexAuto(v, "akim");
const qU = (v: number) => latexAuto(v, "gerilim");
const qP = (v: number) => latexAuto(v, "guc");
const qR = (v: number) => latexAuto(v, "direnc");
const qE = (v: number) => latexAuto(v, "enerji");
const qT = (v: number) => latexAuto(v, "tork");
const qJ = (v: number) => latexAuto(v, "atalet");
const qt = (v: number) => latexAuto(v, "zaman");

function isMechanical(inputs: ComputeInputs): boolean {
  return inputs.hesap === "fren" && inputs.kaynak === "mekanik";
}

function crossChecks(inputs: ComputeInputs): Check[] {
  if (isMechanical(inputs) && num(inputs, "n2", WHERE) >= num(inputs, "n1", WHERE)) {
    return [{ level: "hata", message: MESSAGES.speedOrder }];
  }
  return [];
}

function computeDrive(inputs: ComputeInputs) {
  const In = num(inputs, "In", WHERE);
  const Ikisa = num(inputs, "Ikisa", WHERE);
  const kAsiri = num(inputs, "kAsiri", WHERE);
  const Ireq = Ikisa / kAsiri;
  const Imin = Math.max(In, Ireq);
  const steps: Step[] = [
    {
      label: "Kısa süreli akımı karşılayan nominal akım",
      latex: `\\frac{I_{\\text{kısa}}}{k_{\\text{aşırı}}} = \\frac{${qI(Ikisa)}}{${latexNum(kAsiri)}} = ${qI(Ireq)}`,
    },
    {
      label: "Gerekli sürücü nominal akımı",
      latex: `I_{\\text{sürücü}} \\geq \\max\\left(I_n,\\ \\frac{I_{\\text{kısa}}}{k_{\\text{aşırı}}}\\right) = \\max\\left(${qI(In)},\\ ${qI(Ireq)}\\right) = ${qI(Imin)}`,
    },
  ];
  const checks: Check[] = [{ level: "bilgi", message: Ireq > In ? MESSAGES.overloadGoverns : MESSAGES.nominalGoverns }];
  return { outputs: { IsurucuMin: Imin }, steps, checks };
}

function computeBrake(inputs: ComputeInputs) {
  const Udc = num(inputs, "Udc", WHERE);
  const ED = num(inputs, "ED", WHERE);
  const Rmin = optNum(inputs, "Rmin");
  const steps: Step[] = [];
  const checks: Check[] = [];
  const outputs: Record<string, number> = {};

  let Pfren: number;
  let Port: number;
  if (inputs.kaynak === "mekanik") {
    const J = num(inputs, "J", WHERE);
    const w1 = num(inputs, "n1", WHERE);
    const w2 = num(inputs, "n2", WHERE);
    const t = num(inputs, "tFren", WHERE);
    const etaMek = num(inputs, "etaMek", WHERE);
    const etaEl = num(inputs, "etaEl", WHERE);

    const dE = 0.5 * J * (w1 * w1 - w2 * w2);
    const Tfren = (J * (w1 - w2)) / t;
    const PmekTepe = Tfren * w1;
    Pfren = PmekTepe * etaMek * etaEl;
    const Efren = dE * etaMek * etaEl;
    Port = Efren / t;
    Object.assign(outputs, { dE, Efren, Tfren });

    steps.push(
      {
        label: "Açısal hızlar",
        latex: `\\omega_1 = \\frac{2\\pi \\cdot ${qRpm(w1)}}{60} = ${qOmega(w1)} \\qquad \\omega_2 = \\frac{2\\pi \\cdot ${qRpm(w2)}}{60} = ${qOmega(w2)}`,
      },
      {
        label: "Kinetik enerji değişimi",
        latex: `\\Delta E = \\tfrac{1}{2} J \\left(\\omega_1^2 - \\omega_2^2\\right) = \\tfrac{1}{2} \\cdot ${qJ(J)} \\cdot \\left((${qOmega(w1)})^2 - (${qOmega(w2)})^2\\right) = ${qE(dE)}`,
      },
      {
        label: "Yavaşlatma torku (doğrusal rampa)",
        latex: `T_{\\text{fren}} = \\frac{J \\left(\\omega_1 - \\omega_2\\right)}{t} = \\frac{${qJ(J)} \\cdot \\left(${qOmega(w1)} - ${qOmega(w2)}\\right)}{${qt(t)}} = ${qT(Tfren)}`,
      },
      {
        label: "Tepe frenleme gücü (DC bara)",
        latex: `P_{\\text{fren}} = T_{\\text{fren}} \\cdot \\omega_1 \\cdot \\eta_{\\text{mek}} \\cdot \\eta_{\\text{el}} = ${qT(Tfren)} \\cdot ${qOmega(w1)} \\cdot ${qFrac(etaMek)} \\cdot ${qFrac(etaEl)} = ${qP(Pfren)}`,
      },
      {
        label: "Dirence aktarılan enerji",
        latex: `E_{\\text{fren}} = \\Delta E \\cdot \\eta_{\\text{mek}} \\cdot \\eta_{\\text{el}} = ${qE(dE)} \\cdot ${qFrac(etaMek)} \\cdot ${qFrac(etaEl)} = ${qE(Efren)}`,
      },
      {
        label: "Frenleme süresince ortalama güç",
        latex: `\\bar{P}_{\\text{fren}} = \\frac{E_{\\text{fren}}}{t} = \\frac{${qE(Efren)}}{${qt(t)}} = ${qP(Port)}`,
      },
    );
    checks.push({ level: "bilgi", message: MESSAGES.mechAssumption });
  } else {
    Pfren = num(inputs, "Pfren", WHERE);
    Port = Pfren;
    checks.push({ level: "bilgi", message: MESSAGES.directAssumption });
  }

  const Rmaks = (Udc * Udc) / Pfren;
  const Itepe = Udc / Rmaks;
  const Psurekli = Port * ED;
  Object.assign(outputs, { PfrenTepe: Pfren, Rmaks, IfrenTepe: Itepe, PfrenOrt: Port, Psurekli });

  steps.push(
    {
      label: "En büyük frenleme direnci",
      latex: `R_{\\text{maks}} = \\frac{U_{dc}^2}{P_{\\text{fren}}} = \\frac{(${qU(Udc)})^2}{${qP(Pfren)}} = ${qR(Rmaks)}`,
    },
    {
      label: "Tepe fren akımı (R = R_maks)",
      latex: `I_{\\text{fren}} = \\frac{U_{dc}}{R_{\\text{maks}}} = \\frac{${qU(Udc)}}{${qR(Rmaks)}} = ${qI(Itepe)}`,
    },
    {
      label: "Direncin sürekli güç değeri",
      latex: `P_{\\text{sürekli}} = \\bar{P}_{\\text{fren}} \\cdot ED = ${qP(Port)} \\cdot ${qFrac(ED)} = ${qP(Psurekli)}`,
    },
  );

  const rmaxText = qRText(Rmaks);
  if (Rmin === undefined) {
    checks.push({ level: "bilgi", message: MESSAGES.rangeNoRmin });
  } else if (Rmin > Rmaks) {
    checks.push({
      level: "uyari",
      message: MESSAGES.rminTooHigh(qRText(Rmin), rmaxText),
    });
  } else {
    checks.push({ level: "ok", message: MESSAGES.rangeOk(qRText(Rmin), rmaxText) });
  }

  return { outputs, steps, checks };
}

/** Kontrol mesajları düz metindir: direnci kartlarla aynı biçim ve otomatik birimle yazar (ör. "57 Ω"). */
function qRText(ohm: number): string {
  const unit = autoOutputUnit({ dimension: "direnc", defaultUnit: "ohm" }, ohm);
  return formatQuantity(fromSI(ohm, unit), unit);
}

export const vfdSecimiFrenlemeDirenci: CalcDefinition = {
  id: "3.4",
  slug: "vfd-secimi-frenleme-direnci",
  category: "motor",
  title: "VFD seçimi ve frenleme direnci",
  description:
    "Frekans çeviricinin (VFD) gerekli nominal çıkış akımını aşırı yük çarpanıyla belirleyin; frenleme direnci için en büyük direnç değerini, tepe akımı ve sürekli gücü hesaplayın. Frenleme gücü doğrudan girilebilir veya atalet ve yavaşlama süresinden hesaplanabilir.",
  formulas: [
    {
      label: "Sürücü nominal akımı",
      latex: "I_{\\text{sürücü}} \\geq \\max\\left(I_n,\\ \\frac{I_{\\text{kısa}}}{k_{\\text{aşırı}}}\\right)",
    },
    { label: "En büyük frenleme direnci", latex: "R_{\\text{fren}} \\leq R_{\\text{maks}} = \\frac{U_{dc}^2}{P_{\\text{fren}}}" },
    { label: "Direncin sürekli gücü", latex: "P_{\\text{sürekli}} = \\bar{P}_{\\text{fren}} \\cdot ED" },
    { label: "Kinetik enerji değişimi", latex: "\\Delta E = \\tfrac{1}{2} J \\left(\\omega_1^2 - \\omega_2^2\\right)" },
    {
      label: "Tepe frenleme gücü (doğrusal rampa)",
      latex: "P_{\\text{fren}} = \\frac{J \\, \\omega_1 \\left(\\omega_1 - \\omega_2\\right)}{t} \\cdot \\eta_{\\text{mek}} \\cdot \\eta_{\\text{el}}",
    },
  ],
  references: [
    {
      standard: "IEC 61800-2",
      title:
        "Ayarlanabilir hızlı elektrik güç tahrik sistemleri — Bölüm 2: Genel gereksinimler — AC ayarlanabilir hızlı güç tahrik sistemleri için anma değerleri",
      note: "Sürücünün sürekli ve kısa süreli (aşırı yük) akım anma değerleri; frenleme",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "hesap",
      label: "Hesap",
      options: [
        { value: "surucu", label: "Sürücü akımı seçimi" },
        { value: "fren", label: "Frenleme direnci" },
      ],
      default: "surucu",
    },
    // (a) Sürücü akımı
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
      visibleWhen: { key: "hesap", equals: "surucu" },
    },
    {
      kind: "number",
      key: "Ikisa",
      label: "Gerekli kısa süreli akım",
      symbol: "I_{\\text{kısa}}",
      dimension: "akim",
      defaultUnit: "A",
      default: 21,
      min: 0,
      minExclusive: true,
      help: "Hızlanma veya darbeli yük sırasında motorun kısa süre çekeceği en büyük akım.",
      visibleWhen: { key: "hesap", equals: "surucu" },
    },
    {
      kind: "number",
      key: "kAsiri",
      label: "Sürücü aşırı yük çarpanı",
      symbol: "k_{\\text{aşırı}}",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 1.5,
      min: 1,
      help: "Sürücü veri sayfasındaki kısa süreli çıkış akımının nominal çıkış akımına oranı (ör. 1,5 = %150). Süresi ve tekrar aralığı veri sayfasında verilir; ağır ve normal görev derecelerinde farklıdır.",
      visibleWhen: { key: "hesap", equals: "surucu" },
    },
    // (b) Frenleme direnci
    {
      kind: "select",
      key: "kaynak",
      label: "Frenleme gücü",
      options: [
        { value: "dogrudan", label: "Tepe frenleme gücünü gir" },
        { value: "mekanik", label: "Atalet ve yavaşlama süresinden hesapla" },
      ],
      default: "dogrudan",
      visibleWhen: { key: "hesap", equals: "fren" },
    },
    {
      kind: "number",
      key: "Udc",
      label: "Fren kıyıcısı DC bara gerilimi",
      symbol: "U_{dc}",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 750,
      min: 0,
      minExclusive: true,
      help: "Fren kıyıcısının devreye girdiği DC bara gerilimi; sürücü veri sayfasından alın (400 V şebekede tipik 650–780 V).",
      visibleWhen: { key: "hesap", equals: "fren" },
    },
    {
      kind: "number",
      key: "Pfren",
      label: "Tepe frenleme gücü",
      symbol: "P_{\\text{fren}}",
      dimension: "guc",
      defaultUnit: "kW",
      default: 7.5,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "kaynak", equals: "dogrudan" },
    },
    {
      kind: "number",
      key: "J",
      label: "Toplam atalet (motor + yük, motor miline indirgenmiş)",
      symbol: "J",
      dimension: "atalet",
      defaultUnit: "kgm2",
      default: 2,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "kaynak", equals: "mekanik" },
    },
    {
      kind: "number",
      key: "n1",
      label: "İlk devir hızı",
      symbol: "n_1",
      dimension: "acisal_hiz",
      defaultUnit: "rpm",
      default: 1500,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "kaynak", equals: "mekanik" },
    },
    {
      kind: "number",
      key: "n2",
      label: "Son devir hızı",
      symbol: "n_2",
      dimension: "acisal_hiz",
      defaultUnit: "rpm",
      default: 0,
      min: 0,
      visibleWhen: { key: "kaynak", equals: "mekanik" },
    },
    {
      kind: "number",
      key: "tFren",
      label: "Yavaşlama süresi",
      symbol: "t",
      dimension: "zaman",
      defaultUnit: "s",
      units: ["ms", "s", "min"],
      default: 5,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "kaynak", equals: "mekanik" },
    },
    {
      kind: "number",
      key: "etaMek",
      label: "Mekanik aktarma verimi",
      symbol: "\\eta_{\\text{mek}}",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 100,
      min: 0,
      minExclusive: true,
      max: 1,
      help: "Redüktör, kayış vb. %100 almak güvenli taraftadır.",
      visibleWhen: { key: "kaynak", equals: "mekanik" },
    },
    {
      kind: "number",
      key: "etaEl",
      label: "Motor ve sürücü verimi (frenlemede)",
      symbol: "\\eta_{\\text{el}}",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 100,
      min: 0,
      minExclusive: true,
      max: 1,
      help: "%100 almak güvenli taraftadır.",
      visibleWhen: { key: "kaynak", equals: "mekanik" },
    },
    {
      kind: "number",
      key: "ED",
      label: "Frenleme görev çevrimi (t_fren / t_çevrim)",
      symbol: "ED",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 10,
      min: 0,
      minExclusive: true,
      max: 1,
      visibleWhen: { key: "hesap", equals: "fren" },
    },
    {
      kind: "number",
      key: "Rmin",
      label: "Sürücünün izin verdiği en küçük direnç",
      symbol: "R_{\\text{min}}",
      dimension: "direnc",
      defaultUnit: "ohm",
      min: 0,
      minExclusive: true,
      optional: true,
      help: "Sürücü veri sayfasından; girilirse seçim aralığı kontrol edilir.",
      visibleWhen: { key: "hesap", equals: "fren" },
    },
  ],
  outputs: [
    { key: "IsurucuMin", label: "Gerekli en küçük sürücü nominal akımı", symbol: "I_{\\text{sürücü}}", dimension: "akim", defaultUnit: "A" },
    { key: "PfrenTepe", label: "Tepe frenleme gücü", symbol: "P_{\\text{fren}}", dimension: "guc", defaultUnit: "kW" },
    { key: "Rmaks", label: "En büyük frenleme direnci", symbol: "R_{\\text{maks}}", dimension: "direnc", defaultUnit: "ohm" },
    { key: "IfrenTepe", label: "Tepe fren akımı (R = R_maks)", symbol: "I_{\\text{fren}}", dimension: "akim", defaultUnit: "A" },
    { key: "PfrenOrt", label: "Frenleme süresince ortalama güç", symbol: "\\bar{P}_{\\text{fren}}", dimension: "guc", defaultUnit: "kW" },
    { key: "Psurekli", label: "Direncin sürekli güç değeri (en az)", symbol: "P_{\\text{sürekli}}", dimension: "guc", defaultUnit: "kW" },
    { key: "dE", label: "Frenleme başına kinetik enerji değişimi", symbol: "\\Delta E", dimension: "enerji", defaultUnit: "kJ" },
    { key: "Efren", label: "Frenleme başına dirence aktarılan enerji", symbol: "E_{\\text{fren}}", dimension: "enerji", defaultUnit: "kJ" },
    { key: "Tfren", label: "Yavaşlatma torku", symbol: "T_{\\text{fren}}", dimension: "tork", defaultUnit: "Nm" },
  ],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };
    const hesap = inputs.hesap as VfdHesap;
    if (hesap === "surucu") return computeDrive(inputs);
    if (hesap === "fren") return computeBrake(inputs);
    throw new Error(`${WHERE}: bilinmeyen hesap "${String(hesap)}"`);
  },
};
