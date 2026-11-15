/**
 * KAPSAM 6.7 — Hidrolik silindir ve pompa.
 *
 * Silindir (teorik; sürtünme ve sızıntı hariç):
 *   itme F = p·A, çekme F = p·A_r (A_r = A − A_mil); itme hızı v = Q/A, çekme hızı v = Q/A_r; alan oranı φ = A/A_r.
 * Pompa:
 *   hidrolik güç P_hid = p·Q; pompa mil gücü = motor gücü P_motor = p·Q/η_t (η_t: pompanın toplam verimi).
 *   "Motor gücü" pompayı süren motorun mil (anma çıkış) gücü olarak yorumlanır; şebekeden çekilen güç için
 *   motor verimi ayrıca hesaba katılmalıdır (3.x motor hesapları).
 * Seri anma basınçları (ISO 6020-2: 16 MPa, ISO 6022: 25 MPa) config'te: ctx.limits.mekatronikAkiskan.hidrolikSeriBasinci.
 */
import { latexNum, latexSpec } from "@/lib/calc/latex";
import type { CalcDefinition, CalcResult, Check, ComputeInputs, NumberInputSpec, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { formatQuantity, fromSI } from "@/lib/units";
import { daireAlani, num } from "./akiskan-ortak";

const WHERE = "hidrolik-silindir-pompa";

export type HidrolikSeri = "yok" | "iso6020_2" | "iso6022";

const REF_6020: Reference = {
  standard: "ISO 6020-2",
  title: "Hidrolik akışkan gücü — Tek milli silindirlerin bağlantı ölçüleri, 16 MPa (160 bar) serisi — Bölüm 2: Kompakt seri",
};
const REF_6022: Reference = {
  standard: "ISO 6022",
  title: "Hidrolik akışkan gücü — Tek milli silindirlerin bağlantı ölçüleri, 25 MPa (250 bar) serisi",
};

const IN_D: NumberInputSpec = {
  kind: "number",
  key: "D",
  label: "Piston çapı",
  symbol: "D",
  dimension: "uzunluk",
  defaultUnit: "mm",
  units: ["mm", "cm", "in"],
  default: 63,
  min: 0,
  minExclusive: true,
};
const IN_DMIL: NumberInputSpec = {
  kind: "number",
  key: "d",
  label: "Piston mili çapı",
  symbol: "d",
  dimension: "uzunluk",
  defaultUnit: "mm",
  units: ["mm", "cm", "in"],
  default: 36,
  min: 0,
  minExclusive: true,
};
const IN_P: NumberInputSpec = {
  kind: "number",
  key: "p",
  label: "Çalışma basıncı",
  symbol: "p",
  dimension: "basinc",
  defaultUnit: "bar",
  units: ["bar", "MPa", "kPa", "psi"],
  default: 100,
  min: 0,
  minExclusive: true,
  help: "Silindire etkiyen basınç (dönüş hattı basıncı ihmal edilir).",
};
const IN_Q: NumberInputSpec = {
  kind: "number",
  key: "Q",
  label: "Pompa debisi",
  symbol: "Q",
  dimension: "debi",
  defaultUnit: "L_min",
  units: ["L_min", "L_s", "m3_h"],
  default: 40,
  min: 0,
  minExclusive: true,
};
const IN_ETA: NumberInputSpec = {
  kind: "number",
  key: "eta",
  label: "Pompa toplam verimi",
  symbol: "\\eta_t",
  dimension: "oran",
  defaultUnit: "percent",
  units: ["percent", "fraction"],
  default: 85,
  min: 0,
  minExclusive: true,
  max: 1,
  help: "Hacimsel ve hidromekanik verimin çarpımı; pompa veri sayfasından, çalışma basıncı ve devrinde.",
};

const OUT_A: OutputSpec = { key: "A", label: "Piston alanı", symbol: "A", dimension: "alan", defaultUnit: "cm2", units: ["mm2", "cm2"] };
const OUT_AR: OutputSpec = {
  key: "Ar",
  label: "Halka alanı (mil tarafı)",
  symbol: "A_r",
  dimension: "alan",
  defaultUnit: "cm2",
  units: ["mm2", "cm2"],
};
const OUT_PHI: OutputSpec = {
  key: "phi",
  label: "Alan oranı",
  symbol: "\\varphi",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
};
const OUT_FITME: OutputSpec = {
  key: "Fitme",
  label: "İtme kuvveti",
  symbol: "F_{\\text{itme}}",
  dimension: "kuvvet",
  defaultUnit: "kN",
  units: ["N", "kN", "kgf"],
};
const OUT_FCEKME: OutputSpec = {
  key: "Fcekme",
  label: "Çekme kuvveti",
  symbol: "F_{\\text{çekme}}",
  dimension: "kuvvet",
  defaultUnit: "kN",
  units: ["N", "kN", "kgf"],
};
const OUT_VITME: OutputSpec = {
  key: "vitme",
  label: "İtme hızı",
  symbol: "v_{\\text{itme}}",
  dimension: "hiz",
  defaultUnit: "m_s",
  units: ["mm_s", "m_s", "m_min"],
};
const OUT_VCEKME: OutputSpec = {
  key: "vcekme",
  label: "Çekme hızı",
  symbol: "v_{\\text{çekme}}",
  dimension: "hiz",
  defaultUnit: "m_s",
  units: ["mm_s", "m_s", "m_min"],
};
const OUT_PHID: OutputSpec = { key: "Phid", label: "Hidrolik güç", symbol: "P_{\\text{hid}}", dimension: "guc", defaultUnit: "kW" };
const OUT_PMOTOR: OutputSpec = {
  key: "Pmotor",
  label: "Pompa mil gücü (gerekli motor gücü)",
  symbol: "P_{\\text{motor}}",
  dimension: "guc",
  defaultUnit: "kW",
};

const qD = (v: number) => latexSpec(IN_D, v);
const qp = (v: number) => latexSpec(IN_P, v);
const qQ = (v: number) => latexSpec(IN_Q, v);
const qA = (v: number) => latexSpec(OUT_A, v);
const qF = (v: number) => latexSpec(OUT_FITME, v);
const qv = (v: number) => latexSpec(OUT_VITME, v);
const qP = (v: number) => latexSpec(OUT_PHID, v);

const barText = (pa: number) => formatQuantity(fromSI(pa, "bar"), "bar");

const MESSAGES = {
  rodTooLarge: "Mil çapı (d) piston çapından (D) küçük olmalıdır.",
  overSeries: (std: string, pn: string) =>
    `Çalışma basıncı ${std} serisinin anma basıncını (${pn}) aşıyor. Silindirin üretici kataloğundaki anma basıncını kontrol edin.`,
  withinSeries: (std: string, pn: string) => `Çalışma basıncı ${std} serisinin anma basıncı (${pn}) içinde.`,
  assumptions:
    "Kuvvetler teoriktir (conta sürtünmesi ve dönüş hattı basıncı hariç); hızlar sızıntısız kabulle hesaplandı. Motor gücü, pompayı süren motorun mil gücüdür; şebekeden çekilen güç için motor verimiyle bölün.",
} as const;

function crossChecks(inputs: ComputeInputs): Check[] {
  if (num(inputs, "d", WHERE) >= num(inputs, "D", WHERE)) return [{ level: "hata", message: MESSAGES.rodTooLarge }];
  return [];
}

export const hidrolikSilindirPompa: CalcDefinition = {
  id: "6.7",
  slug: "hidrolik-silindir-pompa",
  category: "mekatronik",
  title: "Hidrolik silindir ve pompa",
  description:
    "Hidrolik silindirin itme ve çekme kuvvetini, pompa debisiyle itme ve çekme hızlarını, hidrolik gücü ve pompayı sürecek motorun gücünü hesaplayın. Çalışma basıncı ISO 6020-2 (160 bar) veya ISO 6022 (250 bar) serisinin anma basıncıyla karşılaştırılabilir.",
  formulas: [
    { label: "Piston alanı, halka alanı, alan oranı", latex: "A = \\frac{\\pi D^2}{4} \\qquad A_r = \\frac{\\pi \\left(D^2 - d^2\\right)}{4} \\qquad \\varphi = \\frac{A}{A_r}" },
    { label: "Kuvvet", latex: "F_{\\text{itme}} = p \\cdot A \\qquad F_{\\text{çekme}} = p \\cdot A_r" },
    { label: "Hız", latex: "v_{\\text{itme}} = \\frac{Q}{A} \\qquad v_{\\text{çekme}} = \\frac{Q}{A_r}" },
    { label: "Hidrolik güç ve pompa mil (motor) gücü", latex: "P_{\\text{hid}} = p \\cdot Q \\qquad P_{\\text{motor}} = \\frac{p \\cdot Q}{\\eta_t}" },
  ],
  references: [REF_6020, REF_6022],
  inputs: [
    {
      kind: "select",
      key: "seri",
      label: "Silindir serisi (anma basıncı kontrolü)",
      options: [
        { value: "iso6020_2", label: "ISO 6020-2 kompakt seri (16 MPa / 160 bar)" },
        { value: "iso6022", label: "ISO 6022 (25 MPa / 250 bar)" },
        { value: "yok", label: "Belirtilmemiş (kontrol yok)" },
      ],
      default: "iso6020_2",
    },
    IN_D,
    IN_DMIL,
    IN_P,
    IN_Q,
    IN_ETA,
  ],
  outputs: [OUT_A, OUT_AR, OUT_PHI, OUT_FITME, OUT_FCEKME, OUT_VITME, OUT_VCEKME, OUT_PHID, OUT_PMOTOR],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs, ctx): CalcResult => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const seri = inputs.seri as HidrolikSeri;
    if (seri !== "yok" && seri !== "iso6020_2" && seri !== "iso6022") throw new Error(`${WHERE}: bilinmeyen seri "${String(seri)}"`);
    const D = num(inputs, "D", WHERE);
    const d = num(inputs, "d", WHERE);
    const p = num(inputs, "p", WHERE);
    const Q = num(inputs, "Q", WHERE);
    const eta = num(inputs, "eta", WHERE);

    const A = daireAlani(D);
    const Ar = A - daireAlani(d);
    const phi = A / Ar;
    const Fitme = p * A;
    const Fcekme = p * Ar;
    const vitme = Q / A;
    const vcekme = Q / Ar;
    const Phid = p * Q;
    const Pmotor = Phid / eta;

    const steps: Step[] = [
      { label: "Piston alanı", latex: `A = \\frac{\\pi D^2}{4} = \\frac{\\pi \\cdot (${qD(D)})^2}{4} = ${qA(A)}` },
      {
        label: "Halka alanı",
        latex: `A_r = \\frac{\\pi \\left(D^2 - d^2\\right)}{4} = \\frac{\\pi \\cdot \\left((${qD(D)})^2 - (${qD(d)})^2\\right)}{4} = ${qA(Ar)}`,
      },
      { label: "Alan oranı", latex: `\\varphi = \\frac{A}{A_r} = \\frac{${qA(A)}}{${qA(Ar)}} = ${latexNum(phi)}` },
      { label: "İtme kuvveti", latex: `F_{\\text{itme}} = p \\cdot A = ${qp(p)} \\cdot ${qA(A)} = ${qF(Fitme)}` },
      { label: "Çekme kuvveti", latex: `F_{\\text{çekme}} = p \\cdot A_r = ${qp(p)} \\cdot ${qA(Ar)} = ${qF(Fcekme)}` },
      { label: "İtme hızı", latex: `v_{\\text{itme}} = \\frac{Q}{A} = \\frac{${qQ(Q)}}{${qA(A)}} = ${qv(vitme)}` },
      { label: "Çekme hızı", latex: `v_{\\text{çekme}} = \\frac{Q}{A_r} = \\frac{${qQ(Q)}}{${qA(Ar)}} = ${qv(vcekme)}` },
      { label: "Hidrolik güç", latex: `P_{\\text{hid}} = p \\cdot Q = ${qp(p)} \\cdot ${qQ(Q)} = ${qP(Phid)}` },
      {
        label: "Pompa mil gücü (gerekli motor gücü)",
        latex: `P_{\\text{motor}} = \\frac{P_{\\text{hid}}}{\\eta_t} = \\frac{${qP(Phid)}}{${latexNum(eta)}} = ${qP(Pmotor)}`,
      },
    ];

    const checks: Check[] = [];
    if (seri !== "yok") {
      const pn = ctx.limits.mekatronikAkiskan.hidrolikSeriBasinci[seri];
      const ref = seri === "iso6020_2" ? REF_6020 : REF_6022;
      checks.push(
        p > pn * (1 + 1e-9)
          ? { level: "uyari", message: MESSAGES.overSeries(ref.standard, barText(pn)), reference: ref }
          : { level: "ok", message: MESSAGES.withinSeries(ref.standard, barText(pn)), reference: ref },
      );
    }
    checks.push({ level: "bilgi", message: MESSAGES.assumptions });

    return { outputs: { A, Ar, phi, Fitme, Fcekme, vitme, vcekme, Phid, Pmotor }, steps, checks };
  },
};
