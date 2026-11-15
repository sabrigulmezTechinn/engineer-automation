/**
 * KAPSAM 6.6 — Pnömatik silindir kuvveti ve hava tüketimi.
 *
 * Kuvvet (p: gösterge basıncı, η: sürtünme kayıplarını içeren verim):
 *   itme F = p·A·η (tek etkili silindirde − F_yay), çekme F = p·(A − A_mil)·η.
 * Hava tüketimi (normal litre, ISO 8778 standart referans atmosferi):
 *   Q = V_çevrim·n·(p + p_atm)/p_atm; çift etkilide V_çevrim = (A + (A − A_mil))·s, tek etkilide A·s.
 *   p_atm hem gösterge→mutlak çevirmede hem normal koşula indirgemede ISO 8778'in 100 kPa değeridir
 *   (config: ctx.limits.mekatronikAkiskan.iso8778). İzotermal kabul; ölü hacimler ve sıcaklık farkı dahil değil.
 * Standart piston/mil çapları (Festo DSNU ISO 6432, DSBC ISO 15552) config'te; girilen çap onlarla karşılaştırılır.
 */
import { latexNum, latexSpec } from "@/lib/calc/latex";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, NumberInputSpec, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { formatNumber, formatQuantity, fromSI } from "@/lib/units";
import { daireAlani, num, optNum } from "./akiskan-ortak";

const WHERE = "pnomatik-silindir";

export type PnomatikEtki = "cift" | "tek";

const REF_15552: Reference = {
  standard: "ISO 15552",
  title:
    "Pnömatik akışkan gücü — Ayrılabilir bağlantılı silindirler, 1 000 kPa (10 bar) serisi, 32 mm'den 320 mm'ye çaplar — Temel, bağlantı ve aksesuar ölçüleri",
};
const REF_6432: Reference = {
  standard: "ISO 6432",
  title: "Pnömatik akışkan gücü — Tek milli silindirler, 1 000 kPa (10 bar) serisi, 8 mm'den 25 mm'ye çaplar — Temel ve bağlantı ölçüleri",
};
const REF_8778: Reference = {
  standard: "ISO 8778",
  title: "Pnömatik akışkan gücü — Standart referans atmosfer",
  clause: "§4.1, Tablo 1",
  note: "Standart referans atmosfer (ANR): 100 kPa, 20 °C, %65 bağıl nem; normal litre bu koşula indirgenmiş hacimdir.",
};

const IN_D: NumberInputSpec = {
  kind: "number",
  key: "D",
  label: "Piston çapı",
  symbol: "D",
  dimension: "uzunluk",
  defaultUnit: "mm",
  units: ["mm", "cm", "in"],
  default: 50,
  min: 0,
  minExclusive: true,
  help: "Standart çaplar: ISO 6432 (8–25 mm) ve ISO 15552 (32–320 mm).",
};
const IN_DMIL: NumberInputSpec = {
  kind: "number",
  key: "d",
  label: "Piston mili çapı",
  symbol: "d",
  dimension: "uzunluk",
  defaultUnit: "mm",
  units: ["mm", "cm", "in"],
  default: 20,
  min: 0,
  minExclusive: true,
  help: "Üretici kataloğundan (ör. ∅50 mm ISO 15552 silindirde 20 mm).",
  visibleWhen: { key: "etki", equals: "cift" },
};
const IN_P: NumberInputSpec = {
  kind: "number",
  key: "p",
  label: "Çalışma basıncı (gösterge)",
  symbol: "p",
  dimension: "basinc",
  defaultUnit: "bar",
  units: ["bar", "kPa", "MPa", "psi"],
  default: 6,
  min: 0,
  minExclusive: true,
  help: "Atmosfer basıncının üstündeki basınç (manometre değeri).",
};
const IN_ETA: NumberInputSpec = {
  kind: "number",
  key: "eta",
  label: "Verim (sürtünme kayıpları)",
  symbol: "\\eta",
  dimension: "oran",
  defaultUnit: "percent",
  units: ["percent", "fraction"],
  default: 100,
  min: 0,
  minExclusive: true,
  max: 1,
  help: "%100 teorik kuvveti verir (kataloglardaki 'teorik kuvvet'). Sürtünme kayıplarını katmak için üreticinin verdiği verimi girin.",
};
const IN_FYAY: NumberInputSpec = {
  kind: "number",
  key: "Fyay",
  label: "Yay kuvveti (strok sonunda)",
  symbol: "F_{\\text{yay}}",
  dimension: "kuvvet",
  defaultUnit: "N",
  units: ["N", "kN", "kgf"],
  min: 0,
  optional: true,
  help: "Yay dönüşlü silindirde yayın en büyük kuvveti; üretici kataloğundan. Boş bırakılırsa düşülmez.",
  visibleWhen: { key: "etki", equals: "tek" },
};
const IN_S: NumberInputSpec = {
  kind: "number",
  key: "s",
  label: "Strok",
  symbol: "s",
  dimension: "uzunluk",
  defaultUnit: "mm",
  units: ["mm", "cm", "m", "in"],
  default: 100,
  min: 0,
  minExclusive: true,
};
const IN_N: NumberInputSpec = {
  kind: "number",
  key: "n",
  label: "Çevrim sayısı (ileri + geri)",
  symbol: "n",
  dimension: "frekans",
  defaultUnit: "per_min",
  units: ["per_min", "Hz"],
  default: 10,
  min: 0,
  minExclusive: true,
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
const OUT_FITME: OutputSpec = {
  key: "Fitme",
  label: "İtme kuvveti",
  symbol: "F_{\\text{itme}}",
  dimension: "kuvvet",
  defaultUnit: "N",
  units: ["N", "kN", "kgf"],
};
const OUT_FCEKME: OutputSpec = {
  key: "Fcekme",
  label: "Çekme kuvveti",
  symbol: "F_{\\text{çekme}}",
  dimension: "kuvvet",
  defaultUnit: "N",
  units: ["N", "kN", "kgf"],
};
const OUT_Q: OutputSpec = {
  key: "Q",
  label: "Hava tüketimi (normal litre)",
  symbol: "Q_N",
  dimension: "debi",
  defaultUnit: "NL_min",
  units: ["NL_min"],
};

const qD = (v: number) => latexSpec(IN_D, v);
const qs = (v: number) => latexSpec(IN_S, v);
const qp = (v: number) => latexSpec(IN_P, v);
const qn = (v: number) => latexSpec(IN_N, v);
const qA = (v: number) => latexSpec(OUT_A, v);
const qF = (v: number) => latexSpec(OUT_FITME, v);
const qQ = (v: number) => latexSpec(OUT_Q, v);

/** Kontrol mesajlarında uzunluk mm ile (düz metin) */
const mmText = (m: number) => formatQuantity(fromSI(m, "mm"), "mm");

const MESSAGES = {
  rodTooLarge: "Mil çapı (d) piston çapından (D) küçük olmalıdır.",
  springTooLarge: "Yay kuvveti basınç kuvvetinden (p·A·η) küçük olmalıdır; aksi halde silindir ilerlemez.",
  pressureOverSeries:
    "Çalışma basıncı 10 bar'ı aşıyor: ISO 15552 ve ISO 6432 silindirleri 1 000 kPa (10 bar) serisidir. Üretici kataloğundaki en yüksek çalışma basıncını kontrol edin.",
  noSpring:
    "Yay kuvveti girilmedi: itme kuvvetinden yay kuvveti düşülmedi. Yay dönüşlü silindirde yay kuvvetini katalogdan alıp girin.",
  assumptions:
    "Hava tüketimi izotermal kabulle, ölü hacimler (hortum, bağlantı, piston uç boşlukları) hariç hesaplandı. Normal litre (NL) ISO 8778 standart referans atmosferine (100 kPa, 20 °C) göredir; atmosfer basıncı da 100 kPa alındı.",
  catalogMatch: (D: string, d: string, standart: string, katalog: string) =>
    `∅${D} / ∅${d}: ${standart} standart piston çapı; mil çapı ${katalog} kataloğuyla aynı.`,
  catalogRodDiffers: (D: string, standart: string, katalog: string, dk: string, d: string) =>
    `∅${D} ${standart} standart piston çapı; ${katalog} kataloğunda mil çapı ${dk} (girilen ${d}).`,
  catalogBoreOnly: (D: string, standart: string) => `∅${D} ${standart} standart piston çapı.`,
  notInCatalog: (list6432: string, list15552: string) =>
    `Piston çapı katalogdaki standart çaplardan biri değil (Festo DSNU, ISO 6432: ${list6432} mm; Festo DSBC, ISO 15552: ${list15552} mm).`,
} as const;

function crossChecks(inputs: ComputeInputs): Check[] {
  const D = num(inputs, "D", WHERE);
  if (inputs.etki === "cift") {
    if (num(inputs, "d", WHERE) >= D) return [{ level: "hata", message: MESSAGES.rodTooLarge }];
  } else {
    const Fyay = optNum(inputs, "Fyay") ?? 0;
    const Fp = num(inputs, "p", WHERE) * daireAlani(D) * num(inputs, "eta", WHERE);
    if (Fyay >= Fp) return [{ level: "hata", message: MESSAGES.springTooLarge }];
  }
  return [];
}

/** Girilen piston (ve mil) çapını config'teki katalog çaplarıyla karşılaştırır (bilgi düzeyinde). */
function catalogCheck(D: number, d: number | undefined, ctx: CalcContext): Check {
  const list = ctx.limits.mekatronikAkiskan.pnomatikKatalogCaplari;
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-7;
  const hit = list.find((k) => same(k.D, D));
  if (!hit) {
    const join = (std: string) =>
      list
        .filter((k) => k.standart === std)
        .map((k) => formatNumber(fromSI(k.D, "mm")))
        .join(", ");
    return { level: "ok", message: MESSAGES.notInCatalog(join("ISO 6432"), join("ISO 15552")) };
  }
  const reference = hit.standart === "ISO 15552" ? REF_15552 : REF_6432;
  if (d === undefined) return { level: "ok", message: MESSAGES.catalogBoreOnly(mmText(D), hit.standart), reference };
  if (same(hit.d, d)) {
    return { level: "ok", message: MESSAGES.catalogMatch(mmText(D), mmText(d), hit.standart, hit.katalog), reference };
  }
  return {
    level: "ok",
    message: MESSAGES.catalogRodDiffers(mmText(D), hit.standart, hit.katalog, mmText(hit.d), mmText(d)),
    reference,
  };
}

export const pnomatikSilindir: CalcDefinition = {
  id: "6.6",
  slug: "pnomatik-silindir-kuvveti-hava-tuketimi",
  category: "mekatronik",
  title: "Pnömatik silindir kuvveti ve hava tüketimi",
  description:
    "Çift veya tek etkili pnömatik silindirin itme ve çekme kuvvetini gösterge basıncından, hava tüketimini strok ve çevrim sayısından normal litre/dakika (ISO 8778) olarak hesaplayın. Girilen çap, ISO 15552 / ISO 6432 standart katalog çaplarıyla karşılaştırılır.",
  formulas: [
    { label: "Piston alanı ve halka alanı", latex: "A = \\frac{\\pi D^2}{4} \\qquad A_r = \\frac{\\pi \\left(D^2 - d^2\\right)}{4}" },
    { label: "İtme kuvveti (tek etkilide yay kuvveti düşülür)", latex: "F_{\\text{itme}} = p \\cdot A \\cdot \\eta \\; \\left(- F_{\\text{yay}}\\right)" },
    { label: "Çekme kuvveti", latex: "F_{\\text{çekme}} = p \\cdot A_r \\cdot \\eta" },
    {
      label: "Hava tüketimi, çift etkili (p_atm = 100 kPa, ISO 8778)",
      latex: "Q_N = \\left(A + A_r\\right) \\cdot s \\cdot n \\cdot \\frac{p + p_{\\text{atm}}}{p_{\\text{atm}}}",
    },
    { label: "Hava tüketimi, tek etkili", latex: "Q_N = A \\cdot s \\cdot n \\cdot \\frac{p + p_{\\text{atm}}}{p_{\\text{atm}}}" },
  ],
  references: [REF_15552, REF_6432, REF_8778],
  inputs: [
    {
      kind: "select",
      key: "etki",
      label: "Silindir tipi",
      options: [
        { value: "cift", label: "Çift etkili" },
        { value: "tek", label: "Tek etkili (yay dönüşlü)" },
      ],
      default: "cift",
    },
    IN_D,
    IN_DMIL,
    IN_P,
    IN_ETA,
    IN_FYAY,
    IN_S,
    IN_N,
  ],
  outputs: [OUT_A, OUT_AR, OUT_FITME, OUT_FCEKME, OUT_Q],

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs, ctx) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const etki = inputs.etki as PnomatikEtki;
    if (etki !== "cift" && etki !== "tek") throw new Error(`${WHERE}: bilinmeyen silindir tipi "${String(etki)}"`);
    const D = num(inputs, "D", WHERE);
    const p = num(inputs, "p", WHERE);
    const eta = num(inputs, "eta", WHERE);
    const s = num(inputs, "s", WHERE);
    const n = num(inputs, "n", WHERE);
    const pAtm = ctx.limits.mekatronikAkiskan.iso8778.basinc;

    const A = daireAlani(D);
    const oran = (p + pAtm) / pAtm;
    const steps: Step[] = [
      { label: "Piston alanı", latex: `A = \\frac{\\pi D^2}{4} = \\frac{\\pi \\cdot (${qD(D)})^2}{4} = ${qA(A)}` },
    ];
    const outputs: Record<string, number> = { A };
    const checks: Check[] = [];

    let Vcevrim: number;
    if (etki === "cift") {
      const d = num(inputs, "d", WHERE);
      const Ar = A - daireAlani(d);
      const Fitme = p * A * eta;
      const Fcekme = p * Ar * eta;
      Vcevrim = (A + Ar) * s;
      Object.assign(outputs, { Ar, Fitme, Fcekme });
      steps.push(
        {
          label: "Halka alanı",
          latex: `A_r = \\frac{\\pi \\left(D^2 - d^2\\right)}{4} = \\frac{\\pi \\cdot \\left((${qD(D)})^2 - (${qD(d)})^2\\right)}{4} = ${qA(Ar)}`,
        },
        {
          label: "İtme kuvveti",
          latex: `F_{\\text{itme}} = p \\cdot A \\cdot \\eta = ${qp(p)} \\cdot ${qA(A)} \\cdot ${latexNum(eta)} = ${qF(Fitme)}`,
        },
        {
          label: "Çekme kuvveti",
          latex: `F_{\\text{çekme}} = p \\cdot A_r \\cdot \\eta = ${qp(p)} \\cdot ${qA(Ar)} \\cdot ${latexNum(eta)} = ${qF(Fcekme)}`,
        },
      );
      checks.push(catalogCheck(D, d, ctx));
    } else {
      const Fyay = optNum(inputs, "Fyay");
      const Fitme = p * A * eta - (Fyay ?? 0);
      Vcevrim = A * s;
      outputs.Fitme = Fitme;
      steps.push(
        Fyay === undefined
          ? {
              label: "İtme kuvveti (yay kuvveti girilmedi)",
              latex: `F_{\\text{itme}} = p \\cdot A \\cdot \\eta = ${qp(p)} \\cdot ${qA(A)} \\cdot ${latexNum(eta)} = ${qF(Fitme)}`,
            }
          : {
              label: "İtme kuvveti",
              latex: `F_{\\text{itme}} = p \\cdot A \\cdot \\eta - F_{\\text{yay}} = ${qp(p)} \\cdot ${qA(A)} \\cdot ${latexNum(eta)} - ${qF(Fyay)} = ${qF(Fitme)}`,
            },
      );
      if (Fyay === undefined) checks.push({ level: "ok", message: MESSAGES.noSpring });
      checks.push(catalogCheck(D, undefined, ctx));
    }

    const Q = Vcevrim * n * oran;
    outputs.Q = Q;
    const hacim = etki === "cift" ? `\\left(${qA(A)} + ${qA(outputs.Ar)}\\right)` : qA(A);
    steps.push(
      {
        label: "Sıkıştırma oranı (p_atm = 100 kPa, ISO 8778)",
        latex: `\\frac{p + p_{\\text{atm}}}{p_{\\text{atm}}} = \\frac{${qp(p)} + ${qp(pAtm)}}{${qp(pAtm)}} = ${latexNum(oran)}`,
      },
      {
        label: etki === "cift" ? "Hava tüketimi (itme + çekme)" : "Hava tüketimi (yalnız itme)",
        latex: `Q_N = ${etki === "cift" ? "\\left(A + A_r\\right)" : "A"} \\cdot s \\cdot n \\cdot \\frac{p + p_{\\text{atm}}}{p_{\\text{atm}}} = ${hacim} \\cdot ${qs(s)} \\cdot ${qn(n)} \\cdot ${latexNum(oran)} = ${qQ(Q)}`,
      },
    );

    const seri = ctx.limits.mekatronikAkiskan.pnomatikSeriBasinci;
    if (p > seri * (1 + 1e-9)) checks.push({ level: "uyari", message: MESSAGES.pressureOverSeries, reference: REF_15552 });
    checks.push({ level: "ok", message: MESSAGES.assumptions, reference: REF_8778 });

    return { outputs, steps, checks };
  },
};
