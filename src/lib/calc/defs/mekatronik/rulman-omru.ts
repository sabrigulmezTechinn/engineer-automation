/**
 * KAPSAM 6.9 — Rulman ömrü (ISO 281).
 *
 * Temel anma ömrü (%90 güvenilirlik): L₁₀ = (C/P)^p milyon devir; bilyeli p = 3, makaralı p = 10/3.
 * Saat cinsinden: L₁₀h = 10⁶/(60·n)·L₁₀ (n: dev/dk) — yalnızca gösterim; compute SI'da çalışır:
 *   t [s] = L₁₀·10⁶ [devir] / (ω/2π) [devir/s].
 * Eşdeğer dinamik yük: P = X·F_r + Y·F_a (X, Y rulman tipine ve F_a/F_r oranına bağlıdır; kullanıcı girdisi).
 * Güvenilirlik düzeltmesi: L_n = a₁·L₁₀ (a_ISO = 1 kabulü; yağlama/kirlilik/yorulma yük sınırı etkisi dahil değil).
 * a₁ değerleri config'te (SKF katalog Tablo 3, ISO 281 ile uyumlu): ctx.limits.mekatronikAkiskan.rulmanA1.
 */
import { latexNum, latexSpec } from "@/lib/calc/latex";
import type { CalcDefinition, CalcResult, Check, ComputeInputs, NumberInputSpec, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { fromSI } from "@/lib/units";
import { num } from "./akiskan-ortak";

const WHERE = "rulman-omru";

export type RulmanTipi = "bilyeli" | "makarali";
export type RulmanYuk = "dogrudan" | "xy";
export type Guvenilirlik = "90" | "95" | "96" | "97" | "98" | "99";

const REF_281: Reference = {
  standard: "ISO 281",
  title: "Rulmanlar — Dinamik yük sayıları ve anma ömrü",
  note: "Temel anma ömrü L₁₀ = (C/P)^p; güvenilirlik düzeltme katsayısı a₁",
};
const REF_SKF: Reference = {
  standard: "SKF Rolling bearings (PUB BU/P1 17000/1 EN)",
  title: "Size selection based on rating life — Values for life adjustment factor a1",
  clause: "Tablo 3, s. 90",
  note: "https://www.skf.com/binaries/pub12/Images/0901d196802809de-Rolling-bearings---17000_1-EN_tcm_12-121486.pdf",
};

/** Ömür üsleri (ISO 281): bilyeli 3, makaralı 10/3 */
const USLER: Record<RulmanTipi, { p: number; latex: string }> = {
  bilyeli: { p: 3, latex: "3" },
  makarali: { p: 10 / 3, latex: "\\frac{10}{3}" },
};

const GUVENILIRLIK: Guvenilirlik[] = ["90", "95", "96", "97", "98", "99"];

const IN_C: NumberInputSpec = {
  kind: "number",
  key: "C",
  label: "Temel dinamik yük sayısı",
  symbol: "C",
  dimension: "kuvvet",
  defaultUnit: "kN",
  units: ["N", "kN"],
  default: 25,
  min: 0,
  minExclusive: true,
  help: "Rulman kataloğundan (C, dinamik).",
};
const IN_P: NumberInputSpec = {
  kind: "number",
  key: "P",
  label: "Eşdeğer dinamik yük",
  symbol: "P",
  dimension: "kuvvet",
  defaultUnit: "kN",
  units: ["N", "kN"],
  default: 2.5,
  min: 0,
  minExclusive: true,
  visibleWhen: { key: "yuk", equals: "dogrudan" },
};
const IN_FR: NumberInputSpec = {
  kind: "number",
  key: "Fr",
  label: "Radyal yük",
  symbol: "F_r",
  dimension: "kuvvet",
  defaultUnit: "kN",
  units: ["N", "kN"],
  default: 2.5,
  min: 0,
  visibleWhen: { key: "yuk", equals: "xy" },
};
const IN_FA: NumberInputSpec = {
  kind: "number",
  key: "Fa",
  label: "Eksenel yük",
  symbol: "F_a",
  dimension: "kuvvet",
  defaultUnit: "kN",
  units: ["N", "kN"],
  default: 0,
  min: 0,
  visibleWhen: { key: "yuk", equals: "xy" },
};
const IN_X: NumberInputSpec = {
  kind: "number",
  key: "X",
  label: "Radyal yük katsayısı",
  symbol: "X",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
  default: 1,
  min: 0,
  help: "Rulman tipine ve F_a/F_r oranına (e değeri) göre rulman kataloğundan.",
  visibleWhen: { key: "yuk", equals: "xy" },
};
const IN_Y: NumberInputSpec = {
  kind: "number",
  key: "Y",
  label: "Eksenel yük katsayısı",
  symbol: "Y",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
  default: 0,
  min: 0,
  help: "Rulman tipine ve F_a/F_r oranına (e değeri) göre rulman kataloğundan.",
  visibleWhen: { key: "yuk", equals: "xy" },
};
const IN_N: NumberInputSpec = {
  kind: "number",
  key: "n",
  label: "Devir hızı",
  symbol: "n",
  dimension: "acisal_hiz",
  defaultUnit: "rpm",
  units: ["rpm", "rps", "rad_s"],
  default: 1500,
  min: 0,
  minExclusive: true,
};

const OUT_P: OutputSpec = { key: "P", label: "Eşdeğer dinamik yük", symbol: "P", dimension: "kuvvet", defaultUnit: "kN", units: ["N", "kN"] };
const OUT_L10: OutputSpec = {
  key: "L10",
  label: "Temel anma ömrü (%90 güvenilirlik)",
  symbol: "L_{10}",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
  unitLabel: "milyon devir",
};
const OUT_L10H: OutputSpec = {
  key: "L10h",
  label: "Temel anma ömrü, saat",
  symbol: "L_{10h}",
  dimension: "zaman",
  defaultUnit: "h",
  units: ["h"],
  autoUnit: false,
};
const OUT_A1: OutputSpec = { key: "a1", label: "Güvenilirlik düzeltme katsayısı", symbol: "a_1", dimension: "boyutsuz", defaultUnit: "unitless" };
const OUT_LN: OutputSpec = {
  key: "Ln",
  label: "Seçilen güvenilirlikte ömür (a_ISO = 1)",
  symbol: "L_{n}",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
  unitLabel: "milyon devir",
};
const OUT_LNH: OutputSpec = {
  key: "Lnh",
  label: "Seçilen güvenilirlikte ömür, saat (a_ISO = 1)",
  symbol: "L_{nh}",
  dimension: "zaman",
  defaultUnit: "h",
  units: ["h"],
  autoUnit: false,
};

const qF = (v: number) => latexSpec(IN_C, v);
const qh = (v: number) => latexSpec(OUT_L10H, v);
/** Milyon devir: birimsiz sayı + metin etiketi (kartla aynı) */
const qMrev = (v: number) => `${latexNum(v)}\\,\\text{milyon devir}`;

const MESSAGES = {
  zeroLoad: "Eşdeğer dinamik yük P = X·F_r + Y·F_a sıfırdan büyük olmalıdır.",
  xyNote: "X ve Y rulman tipine ve F_a/F_r oranına (e değeri) bağlıdır; rulman kataloğundaki tablodan alınmalıdır.",
  aIso: "a_ISO = 1 kabul edildi: yağlama, kirlilik ve yorulma yük sınırının etkisi (ISO 281 değiştirilmiş anma ömrü) dahil değildir; bunun için üretici yöntemine (ör. SKF a_SKF) bakın.",
} as const;

function equivalentLoad(inputs: ComputeInputs): number {
  if (inputs.yuk === "dogrudan") return num(inputs, "P", WHERE);
  return num(inputs, "X", WHERE) * num(inputs, "Fr", WHERE) + num(inputs, "Y", WHERE) * num(inputs, "Fa", WHERE);
}

function crossChecks(inputs: ComputeInputs): Check[] {
  if (inputs.yuk === "xy" && !(equivalentLoad(inputs) > 0)) return [{ level: "hata", message: MESSAGES.zeroLoad }];
  return [];
}

export const rulmanOmru: CalcDefinition = {
  id: "6.9",
  slug: "rulman-omru",
  category: "mekatronik",
  title: "Rulman ömrü (ISO 281)",
  description:
    "Bilyeli veya makaralı rulmanın temel anma ömrünü (L₁₀) milyon devir ve çalışma saati olarak hesaplayın. Eşdeğer dinamik yük doğrudan veya X·F_r + Y·F_a ile girilebilir; %95–99 güvenilirlik için a₁ katsayısıyla düzeltilmiş ömür verilir.",
  formulas: [
    { label: "Temel anma ömrü (bilyeli p = 3, makaralı p = 10/3)", latex: "L_{10} = \\left(\\frac{C}{P}\\right)^{p}" },
    { label: "Saat cinsinden ömür (n: dev/dk)", latex: "L_{10h} = \\frac{10^6}{60 \\cdot n} \\cdot L_{10}" },
    { label: "Eşdeğer dinamik yük", latex: "P = X \\cdot F_r + Y \\cdot F_a" },
    { label: "Güvenilirlik düzeltmesi (a_ISO = 1)", latex: "L_{n} = a_1 \\cdot L_{10} \\qquad L_{nh} = a_1 \\cdot L_{10h}" },
  ],
  references: [REF_281, REF_SKF],
  inputs: [
    {
      kind: "select",
      key: "tip",
      label: "Rulman tipi",
      options: [
        { value: "bilyeli", label: "Bilyeli (p = 3)" },
        { value: "makarali", label: "Makaralı (p = 10/3)" },
      ],
      default: "bilyeli",
    },
    {
      kind: "select",
      key: "yuk",
      label: "Eşdeğer yük",
      options: [
        { value: "dogrudan", label: "Eşdeğer dinamik yükü gir (P)" },
        { value: "xy", label: "Radyal ve eksenel yükten hesapla (X·F_r + Y·F_a)" },
      ],
      default: "dogrudan",
    },
    IN_C,
    IN_P,
    IN_FR,
    IN_FA,
    IN_X,
    IN_Y,
    IN_N,
    {
      kind: "select",
      key: "R",
      label: "Güvenilirlik",
      options: GUVENILIRLIK.map((g) => ({ value: g, label: `%${g}` })),
      default: "90",
    },
  ],
  outputs: [OUT_P, OUT_L10, OUT_L10H, OUT_A1, OUT_LN, OUT_LNH],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs, ctx): CalcResult => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const tip = inputs.tip as RulmanTipi;
    const R = inputs.R as Guvenilirlik;
    const us = USLER[tip];
    if (!us) throw new Error(`${WHERE}: bilinmeyen rulman tipi "${String(tip)}"`);
    if (!GUVENILIRLIK.includes(R)) throw new Error(`${WHERE}: bilinmeyen güvenilirlik "${String(R)}"`);
    const C = num(inputs, "C", WHERE);
    const omega = num(inputs, "n", WHERE);
    const P = equivalentLoad(inputs);

    const L10 = (C / P) ** us.p;
    // SI: devir sayısı / (devir/s) = s
    const L10h = (L10 * 1e6 * 2 * Math.PI) / omega;
    const a1 = ctx.limits.mekatronikAkiskan.rulmanA1[R];
    const Ln = a1 * L10;
    const Lnh = a1 * L10h;

    const steps: Step[] = [];
    const checks: Check[] = [];
    const outputs: Record<string, number> = { L10, L10h, a1, Ln, Lnh };
    if (inputs.yuk === "xy") {
      const X = num(inputs, "X", WHERE);
      const Y = num(inputs, "Y", WHERE);
      const Fr = num(inputs, "Fr", WHERE);
      const Fa = num(inputs, "Fa", WHERE);
      outputs.P = P;
      steps.push({
        label: "Eşdeğer dinamik yük",
        latex: `P = X \\cdot F_r + Y \\cdot F_a = ${latexNum(X)} \\cdot ${qF(Fr)} + ${latexNum(Y)} \\cdot ${qF(Fa)} = ${qF(P)}`,
      });
      checks.push({ level: "bilgi", message: MESSAGES.xyNote });
    }
    const nRpm = fromSI(omega, "rpm");
    steps.push(
      {
        label: "Temel anma ömrü",
        latex: `L_{10} = \\left(\\frac{C}{P}\\right)^{p} = \\left(\\frac{${qF(C)}}{${qF(P)}}\\right)^{${us.latex}} = ${qMrev(L10)}`,
      },
      {
        label: "Saat cinsinden ömür (n dev/dk ile)",
        latex: `L_{10h} = \\frac{10^6}{60 \\cdot n} \\cdot L_{10} = \\frac{10^6}{60 \\cdot ${latexNum(nRpm)}} \\cdot ${latexNum(L10)} = ${qh(L10h)}`,
      },
    );
    if (R !== "90") {
      steps.push(
        {
          label: `Güvenilirlik %${R} için ömür`,
          latex: `L_{n} = a_1 \\cdot L_{10} = ${latexNum(a1)} \\cdot ${qMrev(L10)} = ${qMrev(Ln)}`,
        },
        {
          label: "Seçilen güvenilirlikte ömür, saat",
          latex: `L_{nh} = a_1 \\cdot L_{10h} = ${latexNum(a1)} \\cdot ${qh(L10h)} = ${qh(Lnh)}`,
        },
      );
    }
    checks.push({ level: "bilgi", message: MESSAGES.aIso, reference: REF_281 });

    return { outputs, steps, checks };
  },
};
