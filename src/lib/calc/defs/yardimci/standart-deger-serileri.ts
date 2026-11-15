/**
 * KAPSAM 7.2 — Standart değer serileri (IEC 60063 E serileri).
 * Bir direnç, kondansatör veya bobin değeri için seçilen serideki en yakın standart değeri,
 * değerin hemen altındaki ve üstündeki standart değerleri ve yüzde sapmalarını verir.
 *
 * Tanımlar:
 * - alt = serideki x'ten küçük en büyük değer, üst = x'ten büyük en küçük değer (kesin komşular).
 * - En yakın: x bir standart değerse (eşitlik payı içinde) x'in kendisi; değilse |s − x| en küçük olan
 *   (alt veya üst), yani x'e göre yüzde sapması en küçük olan değer. Tam ortada eşitlikte üst değer seçilir.
 *   Böylece 10 kΩ (E12) için en yakın 10 kΩ, alt 8,2 kΩ, üst 12 kΩ olur.
 * - Sapma δ = (s − x) / x.
 * Değerler dekatlar arasında taşınır: 9,6 kΩ için E12'de üst değer bir sonraki dekadın ilk değeri 10 kΩ'dur.
 */
import { latexAuto, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Step } from "@/lib/calc/types";
import type { Dimension } from "@/lib/units";
import { E_SERIES, seriesScale, type ESeriesId } from "./e-serileri";

export type Bilesen = "direnc" | "kondansator" | "bobin";

const SERIES_IDS: ESeriesId[] = ["E6", "E12", "E24", "E48", "E96", "E192"];

/** Bileşene göre girdi/çıktı anahtarları ve boyut */
const BILESEN: Record<Bilesen, { input: string; prefix: string; dimension: Dimension; symbol: string; label: string }> = {
  direnc: { input: "R", prefix: "R", dimension: "direnc", symbol: "R", label: "Direnç" },
  kondansator: { input: "C", prefix: "C", dimension: "kapasitans", symbol: "C", label: "Kapasitans" },
  bobin: { input: "L", prefix: "L", dimension: "enduktans", symbol: "L", label: "Endüktans" },
};

/** Eşitlik payı: 4,7 kΩ girişi 4700,000000000001 Ω gelse de standart değer sayılsın. */
const REL_TOL = 1e-9;

/** m · 10^e; negatif üste bölme kullanılır ki 47 / 10 = 4,7 tam en yakın double olsun. */
function scaled(m: number, e: number): number {
  return e >= 0 ? m * 10 ** e : m / 10 ** -e;
}

export interface StandardNeighbours {
  lower: number;
  upper: number;
  nearest: number;
  /** x serideki bir değere eşit mi (eşitlik payı içinde) */
  exact: boolean;
}

/**
 * x > 0 için seçilen serideki kesin alt ve üst komşular ve en yakın standart değer.
 * Adaylar x'in dekadı ve komşu iki dekattan üretilir (log10 yuvarlama hatasına karşı).
 */
export function standardNeighbours(x: number, id: ESeriesId): StandardNeighbours {
  if (!(x > 0) || !Number.isFinite(x)) throw new Error(`standart-deger-serileri: geçersiz değer ${x}`);
  const mantissas = E_SERIES[id];
  // Tam sayı mantis m, m / scale ∈ [1, 10) demektir; değer = m · 10^(k − basamak + 1)
  const digitsBelow = seriesScale(id) === 10 ? 1 : 2;
  const k0 = Math.floor(Math.log10(x));
  const candidates: number[] = [];
  for (let k = k0 - 1; k <= k0 + 1; k++) {
    for (const m of mantissas) candidates.push(scaled(m, k - digitsBelow));
  }
  let lower = -Infinity;
  let upper = Infinity;
  let match: number | undefined;
  for (const c of candidates) {
    if (Math.abs(c - x) <= x * REL_TOL) match = c;
    else if (c < x && c > lower) lower = c;
    else if (c > x && c < upper) upper = c;
  }
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    throw new Error(`standart-deger-serileri: ${x} için komşu değer bulunamadı`);
  }
  const nearest = match ?? (x - lower < upper - x ? lower : upper);
  return { lower, upper, nearest, exact: match !== undefined };
}

const MESSAGES = {
  exact: (series: string) => `Girilen değer ${series} serisinde standart bir değerdir.`,
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`standart-deger-serileri: "${key}" sayı değil`);
  return v;
}

const pct = (v: number) => latexQty(v, "percent");

export const standartDegerSerileri: CalcDefinition = {
  id: "7.2",
  slug: "standart-deger-serileri",
  category: "yardimci",
  title: "Standart değer serileri",
  description:
    "Direnç, kondansatör veya bobin değerinin IEC 60063 E serilerindeki (E6–E192) en yakın standart karşılığını, hemen altındaki ve üstündeki standart değerleri ve yüzde sapmaları bulun.",
  formulas: [
    { label: "Dekat ve mantis", latex: "x = m \\cdot 10^{k}, \\quad 1 \\le m < 10" },
    { label: "Komşu standart değerler", latex: "x_{\\text{alt}} < x < x_{\\text{üst}}" },
    { label: "Sapma", latex: "\\delta = \\frac{x_{\\text{std}} - x}{x} \\cdot 100\\,\\%" },
  ],
  references: [
    {
      standard: "IEC 60063",
      title: "Preferred number series for resistors and capacitors (2015)",
      clause: "4.1 (Tablo 1: E3–E24), 4.2 (Tablo 2: E48–E192)",
      note: "Seri değerleri Vishay belge no. 28372 'Standard Series Values in a Decade … according to IEC 60063' belgesinden alınmıştır.",
    },
    {
      standard: "Vishay 31001",
      title: "Standard Electronic Decade Value Tables",
      note: "Tolerans–seri ilişkisi: ±%10 → E12, ±%2/±%5 → E24, ±%1 → E96, ±%0,1/0,25/0,5 → E192.",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "bilesen",
      label: "Bileşen",
      options: [
        { value: "direnc", label: "Direnç" },
        { value: "kondansator", label: "Kondansatör" },
        { value: "bobin", label: "Bobin" },
      ],
      default: "direnc",
    },
    {
      kind: "select",
      key: "seri",
      label: "Seri",
      options: SERIES_IDS.map((id) => ({ value: id, label: id })),
      default: "E24",
      help: "Vishay 31001: ±%10 → E12, ±%2 ve ±%5 → E24, ±%1 → E96, ±%0,1–0,5 → E192.",
    },
    {
      kind: "number",
      key: "R",
      label: "Direnç değeri",
      symbol: "R",
      dimension: "direnc",
      defaultUnit: "kohm",
      default: 9.6,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "bilesen", equals: "direnc" },
    },
    {
      kind: "number",
      key: "C",
      label: "Kapasitans değeri",
      symbol: "C",
      dimension: "kapasitans",
      defaultUnit: "nF",
      default: 85,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "bilesen", equals: "kondansator" },
    },
    {
      kind: "number",
      key: "L",
      label: "Endüktans değeri",
      symbol: "L",
      dimension: "enduktans",
      defaultUnit: "mH",
      default: 4,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "bilesen", equals: "bobin" },
    },
  ],
  outputs: [
    { key: "R_yakin", label: "En yakın standart direnç", symbol: "R_{\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
    { key: "R_alt", label: "Alt standart direnç", symbol: "R_{\\text{alt}}", dimension: "direnc", defaultUnit: "ohm" },
    { key: "R_ust", label: "Üst standart direnç", symbol: "R_{\\text{üst}}", dimension: "direnc", defaultUnit: "ohm" },
    { key: "C_yakin", label: "En yakın standart kapasitans", symbol: "C_{\\text{std}}", dimension: "kapasitans", defaultUnit: "F" },
    { key: "C_alt", label: "Alt standart kapasitans", symbol: "C_{\\text{alt}}", dimension: "kapasitans", defaultUnit: "F" },
    { key: "C_ust", label: "Üst standart kapasitans", symbol: "C_{\\text{üst}}", dimension: "kapasitans", defaultUnit: "F" },
    { key: "L_yakin", label: "En yakın standart endüktans", symbol: "L_{\\text{std}}", dimension: "enduktans", defaultUnit: "H" },
    { key: "L_alt", label: "Alt standart endüktans", symbol: "L_{\\text{alt}}", dimension: "enduktans", defaultUnit: "H" },
    { key: "L_ust", label: "Üst standart endüktans", symbol: "L_{\\text{üst}}", dimension: "enduktans", defaultUnit: "H" },
    { key: "sapma_yakin", label: "En yakın değerin sapması", symbol: "\\delta_{\\text{std}}", dimension: "oran", defaultUnit: "percent" },
    { key: "sapma_alt", label: "Alt değerin sapması", symbol: "\\delta_{\\text{alt}}", dimension: "oran", defaultUnit: "percent" },
    { key: "sapma_ust", label: "Üst değerin sapması", symbol: "\\delta_{\\text{üst}}", dimension: "oran", defaultUnit: "percent" },
  ],

  compute: (inputs) => {
    const bilesen = inputs.bilesen as Bilesen;
    const series = inputs.seri as ESeriesId;
    const meta = BILESEN[bilesen];
    if (!meta) throw new Error(`standart-deger-serileri: bilinmeyen bileşen "${String(bilesen)}"`);
    if (!E_SERIES[series]) throw new Error(`standart-deger-serileri: bilinmeyen seri "${String(series)}"`);

    const x = num(inputs, meta.input);
    const { lower, upper, nearest, exact } = standardNeighbours(x, series);
    // Eşitlik payı içindeki fark (3,3 µF → 3,2999999999999996e-6 F) sıfır sapma sayılır.
    const dev = (s: number) => {
      const d = (s - x) / x;
      return Math.abs(d) < REL_TOL ? 0 : d;
    };
    const q = (v: number) => latexAuto(v, meta.dimension);
    const s = meta.symbol;

    const steps: Step[] = [
      {
        label: `${series} serisinde komşu standart değerler`,
        latex: `${s}_{\\text{alt}} = ${q(lower)} < ${s} = ${q(x)} < ${s}_{\\text{üst}} = ${q(upper)}`,
      },
      {
        label: "En yakın standart değer ve sapması",
        latex: `\\delta_{\\text{std}} = \\frac{${s}_{\\text{std}} - ${s}}{${s}} = \\frac{${q(nearest)} - ${q(x)}}{${q(x)}} = ${pct(dev(nearest))}`,
      },
    ];
    const checks: Check[] = [];
    if (exact) checks.push({ level: "ok", message: MESSAGES.exact(series) });

    return {
      outputs: {
        [`${meta.prefix}_yakin`]: nearest,
        [`${meta.prefix}_alt`]: lower,
        [`${meta.prefix}_ust`]: upper,
        sapma_yakin: dev(nearest),
        sapma_alt: dev(lower),
        sapma_ust: dev(upper),
      },
      steps,
      checks,
    };
  },
};
