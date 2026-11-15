/**
 * KAPSAM 6.4 — Servo boyutlandırma.
 *
 * Kural: i = motor devri / yük devri (i > 1 redüktör). Devir girdisi MOTOR milindedir; yük ataleti ve yük torku
 * YÜK (redüktör çıkış) milindedir ve motora yansıtılır:
 *   J_yük,y = J_yük/i², J_top = J_motor + J_yük,y, atalet oranı = J_yük,y/J_motor
 *   T_L,m = T_yük/(i·η)
 * Trapez hız profili (hızlanma t_a, sabit t_c, yavaşlama t_d, bekleme t_b), motor tarafı:
 *   α_a = ω/t_a, α_d = ω/t_d
 *   T₁ = J_top·α_a + T_L,m (hızlanma), T₂ = T_L,m (sabit), T₃ = T_L,m − J_top·α_d (yavaşlama; negatif = frenleme)
 *   T_rms = √((T₁²·t_a + T₂²·t_c + T₃²·t_d)/(t_a + t_c + t_d + t_b)) (THK denklem 54; Oriental Motor)
 * Atalet oranı sınırı motora/sürücüye özgüdür: THK "normalde 3–10" der; girdi olarak alınır, varsayılan
 * config'ten (src/config/sinir/mekatronik-tahrik.ts).
 * Bütün bölümlerde aynı yansıyan yük torku kullanılır (Oriental Motor ve THK yöntemi gibi); beklemede tutma torku
 * (dikey eksen) dahil değildir.
 */
import { LIMITS } from "@/config/sinirlar";
import { latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { REF, num, qNum, qOmega, specWriter } from "./tahrik-ortak";

const WHERE = "servo-boyutlandirma";

const fmtRatio = (x: number) => String(Number(x.toPrecision(4))).replace(".", ",");

const MESSAGES = {
  ratioHigh: (r: string, max: string) =>
    `Atalet oranı (${r}) izin verilen değeri (${max}) aşıyor: daha büyük ataletli motor, daha yüksek redüksiyon oranı veya daha yumuşak profil düşünülmeli. Sınır motor/sürücü kataloğuna göre değişir.`,
  ratioOk: (r: string, max: string) => `Atalet oranı (${r}) izin verilen değerin (${max}) altında.`,
  assumptions:
    "Seçim için: motorun anlık tepe torku ≥ hızlanmadaki tork, anma torku ≥ T_rms olmalıdır (THK). Tüm bölümlerde aynı yansıyan yük torku alındı; beklemede tutma torku (dikey eksen) dahil değildir.",
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "number",
    key: "Jm",
    label: "Motor rotor ataleti",
    symbol: "J_{\\text{motor}}",
    dimension: "atalet",
    defaultUnit: "kgcm2",
    default: 10,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "JL",
    label: "Yük ataleti (yük milinde)",
    symbol: "J_{\\text{yük}}",
    dimension: "atalet",
    defaultUnit: "kgcm2",
    default: 500,
    min: 0,
    help: "Redüktör çıkış milindeki toplam atalet (yük, kaplin, dişli/kasnak). Vidalı milde 6.2'deki J.",
  },
  {
    kind: "number",
    key: "i",
    label: "Redüksiyon oranı",
    symbol: "i",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 5,
    min: 0,
    minExclusive: true,
    help: "Motor devri / yük devri (doğrudan bağlıysa 1).",
  },
  {
    kind: "number",
    key: "eta",
    label: "Redüktör verimi",
    symbol: "\\eta",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    default: 95,
    min: 0,
    minExclusive: true,
    max: 1,
  },
  {
    kind: "number",
    key: "TL",
    label: "Yük torku (yük milinde)",
    symbol: "T_{\\text{yük}}",
    dimension: "tork",
    defaultUnit: "Nm",
    default: 20,
    min: 0,
    help: "Sürtünme, dış kuvvet ve (dikeyde) ağırlıktan gelen sabit tork.",
  },
  {
    kind: "number",
    key: "n",
    label: "Motor devri (sabit hız bölümü)",
    symbol: "n",
    dimension: "acisal_hiz",
    defaultUnit: "rpm",
    default: 3000,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "ta",
    label: "Hızlanma süresi",
    symbol: "t_a",
    dimension: "zaman",
    defaultUnit: "s",
    default: 0.1,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "tc",
    label: "Sabit hız süresi",
    symbol: "t_c",
    dimension: "zaman",
    defaultUnit: "s",
    default: 0.5,
    min: 0,
  },
  {
    kind: "number",
    key: "td",
    label: "Yavaşlama süresi",
    symbol: "t_d",
    dimension: "zaman",
    defaultUnit: "s",
    default: 0.1,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "tb",
    label: "Bekleme süresi",
    symbol: "t_b",
    dimension: "zaman",
    defaultUnit: "s",
    default: 0.5,
    min: 0,
  },
  {
    kind: "number",
    key: "oranMaks",
    label: "İzin verilen atalet oranı",
    symbol: "k_{\\text{maks}}",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: LIMITS.mekatronikTahrik.servoAtaletOrani.tipikUst,
    min: 0,
    minExclusive: true,
    help: "Motor kataloğundaki önerilen yük/rotor atalet oranı. THK: normalde 3–10, motora ve sürücüye göre değişir (ör. Panasonic MHMF5AZL1U2M: 30 kat veya altı).",
  },
];


const OUTPUTS: OutputSpec[] = [
  {
    key: "JLy",
    label: "Motora yansıyan yük ataleti",
    symbol: "J_{\\text{yük,y}}",
    dimension: "atalet",
    defaultUnit: "kgm2",
  },
  { key: "Jtop", label: "Toplam atalet (motor milinde)", symbol: "J_{\\text{top}}", dimension: "atalet", defaultUnit: "kgm2" },
  { key: "oran", label: "Atalet oranı (yük/motor)", symbol: "k", dimension: "boyutsuz", defaultUnit: "unitless" },
  { key: "nYuk", label: "Yük devri", symbol: "n_{\\text{yük}}", dimension: "acisal_hiz", defaultUnit: "rpm" },
  { key: "alfaA", label: "Hızlanmada açısal ivme", symbol: "\\alpha_a", dimension: "acisal_ivme", defaultUnit: "rad_s2" },
  { key: "TLm", label: "Motora yansıyan yük torku", symbol: "T_{L,m}", dimension: "tork", defaultUnit: "Nm" },
  { key: "Ta", label: "Hızlanma (atalet) torku", symbol: "T_a", dimension: "tork", defaultUnit: "Nm" },
  { key: "T1", label: "Hızlanmada motor torku (tepe)", symbol: "T_1", dimension: "tork", defaultUnit: "Nm" },
  { key: "T2", label: "Sabit hızda motor torku", symbol: "T_2", dimension: "tork", defaultUnit: "Nm" },
  { key: "T3", label: "Yavaşlamada motor torku", symbol: "T_3", dimension: "tork", defaultUnit: "Nm" },
  { key: "Trms", label: "Efektif (RMS) tork", symbol: "T_{\\text{rms}}", dimension: "tork", defaultUnit: "Nm" },
  { key: "Ptepe", label: "Tepe mil gücü", symbol: "P_{\\text{tepe}}", dimension: "guc", defaultUnit: "kW" },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);

function compute(inputs: ComputeInputs) {
  const Jm = num(inputs, "Jm", WHERE);
  const JL = num(inputs, "JL", WHERE);
  const i = num(inputs, "i", WHERE);
  const eta = num(inputs, "eta", WHERE);
  const TL = num(inputs, "TL", WHERE);
  const omega = num(inputs, "n", WHERE);
  const ta = num(inputs, "ta", WHERE);
  const tc = num(inputs, "tc", WHERE);
  const td = num(inputs, "td", WHERE);
  const tb = num(inputs, "tb", WHERE);
  const oranMaks = num(inputs, "oranMaks", WHERE);

  const JLy = JL / (i * i);
  const Jtop = Jm + JLy;
  const oran = JLy / Jm;
  const nYuk = omega / i;
  const alfaA = omega / ta;
  const alfaD = omega / td;
  const TLm = TL / (i * eta);
  const Ta = Jtop * alfaA;
  const Td = Jtop * alfaD;
  const T1 = Ta + TLm;
  const T2 = TLm;
  const T3 = TLm - Td;
  const tf = ta + tc + td + tb;
  const Trms = Math.sqrt((T1 * T1 * ta + T2 * T2 * tc + T3 * T3 * td) / tf);
  const Ptepe = T1 * omega;

  const steps: Step[] = [
    {
      label: "Motora yansıyan yük ataleti",
      latex: `J_{\\text{yük,y}} = \\frac{J_{\\text{yük}}}{i^2} = \\frac{${qi("JL", JL)}}{${qNum(i)}^2} = ${qo("JLy", JLy)}`,
    },
    {
      label: "Toplam atalet",
      latex: `J_{\\text{top}} = J_{\\text{motor}} + J_{\\text{yük,y}} = ${qi("Jm", Jm)} + ${qo("JLy", JLy)} = ${qo("Jtop", Jtop)}`,
    },
    {
      label: "Atalet oranı",
      latex: `k = \\frac{J_{\\text{yük,y}}}{J_{\\text{motor}}} = \\frac{${qo("JLy", JLy)}}{${qi("Jm", Jm)}} = ${latexNum(oran)}`,
    },
    {
      label: "Yük devri",
      latex: `n_{\\text{yük}} = \\frac{n}{i} = \\frac{${qi("n", omega)}}{${qNum(i)}} = ${qo("nYuk", nYuk)}`,
    },
    {
      label: "Açısal ivmeler (trapez profil)",
      latex: `\\alpha_a = \\frac{\\omega}{t_a} = \\frac{${qOmega(omega)}}{${qi("ta", ta)}} = ${qo("alfaA", alfaA)}, \\qquad \\alpha_d = \\frac{\\omega}{t_d} = \\frac{${qOmega(omega)}}{${qi("td", td)}} = ${qo("alfaA", alfaD)}`,
    },
    {
      label: "Motora yansıyan yük torku",
      latex: `T_{L,m} = \\frac{T_{\\text{yük}}}{i \\cdot \\eta} = \\frac{${qi("TL", TL)}}{${qNum(i)} \\cdot ${qNum(eta)}} = ${qo("TLm", TLm)}`,
    },
    {
      label: "Hızlanma (atalet) torku",
      latex: `T_a = J_{\\text{top}} \\cdot \\alpha_a = ${qo("Jtop", Jtop)} \\cdot ${qo("alfaA", alfaA)} = ${qo("Ta", Ta)}`,
    },
    {
      label: "Bölüm torkları",
      latex: `T_1 = T_a + T_{L,m} = ${qo("T1", T1)}, \\quad T_2 = T_{L,m} = ${qo("T2", T2)}, \\quad T_3 = T_{L,m} - J_{\\text{top}} \\cdot \\alpha_d = ${qo("T2", T2)} - ${qo("Ta", Td)} = ${qo("T3", T3)}`,
    },
    {
      label: "Efektif (RMS) tork",
      latex: `T_{\\text{rms}} = \\sqrt{\\frac{T_1^2 t_a + T_2^2 t_c + T_3^2 t_d}{t_a + t_c + t_d + t_b}} = \\sqrt{\\frac{(${qo("T1", T1)})^2 \\cdot ${qi("ta", ta)} + (${qo("T2", T2)})^2 \\cdot ${qi("tc", tc)} + (${qo("T3", T3)})^2 \\cdot ${qi("td", td)}}{${qi("ta", tf)}}} = ${qo("Trms", Trms)}`,
    },
    {
      label: "Tepe mil gücü",
      latex: `P_{\\text{tepe}} = T_1 \\cdot \\omega = ${qo("T1", T1)} \\cdot ${qOmega(omega)} = ${qo("Ptepe", Ptepe)}`,
    },
  ];

  const checks: Check[] = [];
  if (oran > oranMaks) {
    checks.push({
      level: "uyari",
      message: MESSAGES.ratioHigh(fmtRatio(oran), fmtRatio(oranMaks)),
      reference: REF.thkMotor,
    });
  } else {
    checks.push({ level: "ok", message: MESSAGES.ratioOk(fmtRatio(oran), fmtRatio(oranMaks)) });
  }
  checks.push({ level: "ok", message: MESSAGES.assumptions });

  return { outputs: { JLy, Jtop, oran, nYuk, alfaA, TLm, Ta, T1, T2, T3, Trms, Ptepe }, steps, checks };
}

export const servoBoyutlandirma: CalcDefinition = {
  id: "6.4",
  slug: "servo-boyutlandirma",
  category: "mekatronik",
  title: "Servo boyutlandırma",
  description:
    "Redüktörlü veya doğrudan bağlı servo eksende yükün motora yansıyan ataletini, atalet oranını, trapez hareket profilinde hızlanma, sabit hız ve yavaşlama torklarını ve efektif (RMS) torku hesaplayın.",
  formulas: [
    { label: "Yansıyan atalet ve toplam atalet", latex: "J_{\\text{top}} = J_{\\text{motor}} + \\frac{J_{\\text{yük}}}{i^2}" },
    { label: "Atalet oranı", latex: "k = \\frac{J_{\\text{yük}}/i^2}{J_{\\text{motor}}} \\leq k_{\\text{maks}}" },
    {
      label: "Hızlanma torku",
      latex: "T_1 = J_{\\text{top}} \\cdot \\alpha + \\frac{T_{\\text{yük}}}{i \\cdot \\eta}, \\qquad \\alpha = \\frac{\\omega}{t_a}",
    },
    {
      label: "Efektif tork",
      latex: "T_{\\text{rms}} = \\sqrt{\\frac{T_1^2 t_a + T_2^2 t_c + T_3^2 t_d}{t_a + t_c + t_d + t_b}}",
    },
  ],
  references: [REF.thkMotor, REF.orientalMotor, REF.thkOrnek],
  inputs: INPUTS,
  outputs: OUTPUTS,
  compute: (inputs) => compute(inputs),
};
