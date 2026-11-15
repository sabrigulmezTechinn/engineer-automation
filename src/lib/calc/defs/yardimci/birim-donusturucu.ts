/**
 * KAPSAM 7.1 — Birim dönüştürücü (özel arayüz: src/components/calc/custom/birim-donusturucu.tsx).
 *
 * Doğrusal büyüklüklerde (güç, tork, basınç, sıcaklık…) hesap, girilen değeri SI'ya çevirip çıktı olarak
 * döndürmektir; tüm birimlerdeki karşılıklarını arayüz birim kataloğuyla (fromSI) gösterir. Birim
 * çarpanları src/lib/units/catalog.ts'tedir.
 *
 * AWG doğrusal olmadığı için ayrı hesaplanır. Tanım (NBS Handbook 100, "Copper Wire Tables", 1966, §2.2,
 * https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook100.pdf): No. 0000 = 0,4600 inç, No. 36 = 0,0050 inç,
 * aradaki 38 boyut geometrik dizidir; oran 92^(1/39) = 1,122 932 2. Buradan
 *   d_n = 0,005 inç · 92^((36 − n)/39) = 0,127 mm · 92^((36 − n)/39),  0000 → n = −3.
 * Bu araç 4/0 (n = −3) … 40 aralığını kapsar. ASTM B258 tablosu bu formülden üretilir (standardın metni
 * ücretlidir; kapsadığı aralık burada doğrulanmadı).
 */
import { latexNum, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { formatQuantity, fromSI, siUnit, type Dimension } from "@/lib/units";

// ---------------------------------------------------------------------------
// AWG

/** En kalın (4/0 = 0000) ve en ince AWG numarası */
export const AWG_MIN = -3;
export const AWG_MAX = 40;
/** No. 36 çapı: 0,0050 inç = 0,127 mm (NBS Handbook 100 §2.2), SI: m */
const D36 = 0.005 * 0.0254;

/** AWG numarasının yaygın adı: −3 → "4/0", 0 → "1/0", 14 → "14". */
export function awgName(n: number): string {
  return n <= 0 ? `${1 - n}/0` : String(n);
}

/** AWG çapı (m) */
export function awgDiameter(n: number): number {
  return D36 * 92 ** ((36 - n) / 39);
}

/** AWG kesiti (m²) */
export function awgArea(n: number): number {
  const d = awgDiameter(n);
  return (Math.PI / 4) * d * d;
}

/** Kesitin (m²) sürekli AWG karşılığı: n = 36 − 39·log₉₂(d / 0,127 mm) */
export function awgFromArea(area: number): number {
  const d = Math.sqrt((4 * area) / Math.PI);
  return 36 - (39 * Math.log(d / D36)) / Math.log(92);
}

/**
 * En yakın AWG: sürekli AWG numarasının yuvarlanması, yani kesit oranı (logaritmik ölçekte) en yakın
 * boyut. Aralık dışındaki kesitler 4/0 veya 40'a sınırlanır.
 */
export function nearestAwg(area: number): { n: number; continuous: number; clamped: "buyuk" | "kucuk" | null } {
  const continuous = awgFromArea(area);
  const rounded = Math.round(continuous);
  if (rounded < AWG_MIN) return { n: AWG_MIN, continuous, clamped: "buyuk" };
  if (rounded > AWG_MAX) return { n: AWG_MAX, continuous, clamped: "kucuk" };
  return { n: rounded, continuous, clamped: null };
}

// ---------------------------------------------------------------------------
// Doğrusal büyüklükler

export interface LinearQuantity {
  id: string;
  label: string;
  dimension: Dimension;
  symbol: string;
  defaultUnit: string;
  default: number;
  /** SI cinsinden alt sınır (uzunluk, kütle… negatif olamaz; sıcaklık 0 K) */
  min?: number;
}

export const LINEAR_QUANTITIES: readonly LinearQuantity[] = [
  { id: "guc", label: "Güç", dimension: "guc", symbol: "P", defaultUnit: "kW", default: 1 },
  { id: "tork", label: "Tork", dimension: "tork", symbol: "M", defaultUnit: "Nm", default: 10 },
  { id: "basinc", label: "Basınç", dimension: "basinc", symbol: "p", defaultUnit: "bar", default: 6 },
  { id: "sicaklik", label: "Sıcaklık", dimension: "sicaklik", symbol: "T", defaultUnit: "degC", default: 20, min: 0 },
  { id: "sicaklik_farki", label: "Sıcaklık farkı", dimension: "sicaklik_farki", symbol: "\\Delta T", defaultUnit: "deltaK", default: 10 },
  { id: "uzunluk", label: "Uzunluk", dimension: "uzunluk", symbol: "\\ell", defaultUnit: "mm", default: 25.4, min: 0 },
  { id: "alan", label: "Alan", dimension: "alan", symbol: "A", defaultUnit: "mm2", default: 2.5, min: 0 },
  { id: "kuvvet", label: "Kuvvet", dimension: "kuvvet", symbol: "F", defaultUnit: "N", default: 100 },
  { id: "enerji", label: "Enerji", dimension: "enerji", symbol: "E", defaultUnit: "kWh", default: 1 },
  { id: "hiz", label: "Hız", dimension: "hiz", symbol: "v", defaultUnit: "m_s", default: 1 },
  { id: "debi", label: "Debi (hacimsel)", dimension: "debi", symbol: "Q", defaultUnit: "L_min", default: 100 },
  { id: "hacim", label: "Hacim", dimension: "hacim", symbol: "V", defaultUnit: "L", default: 1, min: 0 },
  { id: "kutle", label: "Kütle", dimension: "kutle", symbol: "m", defaultUnit: "kg", default: 1, min: 0 },
  { id: "acisal_hiz", label: "Açısal hız", dimension: "acisal_hiz", symbol: "\\omega", defaultUnit: "rpm", default: 1500 },
];

/** Doğrusal büyüklüğün girdi anahtarı (çıktı anahtarı büyüklük kimliğinin kendisidir). */
export const inputKey = (id: string) => `x_${id}`;

export const AWG_ID = "awg";
export type AwgYon = "awg-mm2" | "mm2-awg";

const AWG_OPTIONS = Array.from({ length: AWG_MAX - AWG_MIN + 1 }, (_, i) => {
  const n = AWG_MIN + i;
  return { value: String(n), label: n <= 0 ? `${awgName(n)} (${"0".repeat(1 - n)})` : awgName(n) };
});

// ---------------------------------------------------------------------------
// Tanım

const NBS100: Reference = {
  standard: "NBS Handbook 100",
  title: "Copper Wire Tables (1966)",
  clause: "§2.1–2.2 American Wire Gage",
};

const MESSAGES = {
  awgNearest: (yakin: string, buyuk?: string, kucuk?: string) =>
    `En yakın boyut ${yakin}.` +
    (buyuk ? ` Bir büyük kesit: ${buyuk}.` : "") +
    (kucuk ? ` Bir küçük kesit: ${kucuk}.` : ""),
  awgTooLarge:
    "Kesit 4/0 AWG'den büyük: bu kesitler AWG numarasıyla değil, dairesel mil (kcmil) cinsinden toplam kesitle belirtilir. En yakın değer olarak 4/0 gösterildi.",
  awgTooSmall: "Kesit 40 AWG'den küçük; bu araç 4/0–40 AWG aralığını kapsar. En yakın değer olarak 40 AWG gösterildi.",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`birim-donusturucu: "${key}" sayı değil`);
  return v;
}

const awgLabel = (n: number) => `${awgName(n)} AWG (${formatQuantity(fromSI(awgArea(n), "mm2"), "mm2")})`;
const negParen = (n: number) => (n < 0 ? `(${latexNum(n)})` : latexNum(n));

function computeAwg(inputs: ComputeInputs): { outputs: Record<string, number>; steps: Step[]; checks: Check[] } {
  const yon = inputs.awg_yon as AwgYon;
  if (yon === "awg-mm2") {
    const n = Number(inputs.awg_no);
    if (!Number.isInteger(n) || n < AWG_MIN || n > AWG_MAX) throw new Error(`birim-donusturucu: geçersiz AWG "${String(inputs.awg_no)}"`);
    const d = awgDiameter(n);
    const A = awgArea(n);
    return {
      outputs: { awg_cap: d, awg_alan: A },
      steps: [
        {
          label: `${awgName(n)} AWG çapı`,
          latex: `d = 0{,}127\\,\\mathrm{mm} \\cdot 92^{(36 - ${negParen(n)})/39} = ${latexQty(d, "mm", { significant: 5 })}`,
        },
        {
          label: "Kesit",
          latex: `A = \\frac{\\pi}{4} d^2 = \\frac{\\pi}{4} \\cdot (${latexQty(d, "mm", { significant: 5 })})^2 = ${latexQty(A, "mm2", { significant: 5 })}`,
        },
      ],
      checks: [],
    };
  }
  if (yon === "mm2-awg") {
    const A = num(inputs, "awg_kesit");
    const d = Math.sqrt((4 * A) / Math.PI);
    const { n, continuous, clamped } = nearestAwg(A);
    const An = awgArea(n);
    const outputs: Record<string, number> = {
      awg_n: n,
      awg_n_alan: An,
      awg_n_cap: awgDiameter(n),
      awg_sapma: (An - A) / A,
    };
    const buyuk = n - 1 >= AWG_MIN ? n - 1 : undefined;
    const kucuk = n + 1 <= AWG_MAX ? n + 1 : undefined;
    if (buyuk !== undefined) {
      outputs.awg_buyuk_n = buyuk;
      outputs.awg_buyuk_alan = awgArea(buyuk);
    }
    if (kucuk !== undefined) {
      outputs.awg_kucuk_n = kucuk;
      outputs.awg_kucuk_alan = awgArea(kucuk);
    }
    const checks: Check[] = [];
    if (clamped === "buyuk") checks.push({ level: "uyari", message: MESSAGES.awgTooLarge, reference: NBS100 });
    if (clamped === "kucuk") checks.push({ level: "uyari", message: MESSAGES.awgTooSmall });
    checks.push({
      level: "ok",
      message: MESSAGES.awgNearest(
        awgLabel(n),
        buyuk !== undefined ? awgLabel(buyuk) : undefined,
        kucuk !== undefined ? awgLabel(kucuk) : undefined,
      ),
    });
    return {
      outputs,
      steps: [
        {
          label: "Eşdeğer çap",
          latex: `d = \\sqrt{\\frac{4A}{\\pi}} = \\sqrt{\\frac{4 \\cdot ${latexQty(A, "mm2", { significant: 5 })}}{\\pi}} = ${latexQty(d, "mm", { significant: 5 })}`,
        },
        {
          label: "Sürekli AWG numarası",
          latex: `n = 36 - 39 \\log_{92} \\frac{${latexQty(d, "mm", { significant: 5 })}}{0{,}127\\,\\mathrm{mm}} = ${latexNum(continuous)}`,
        },
        {
          label: "En yakın AWG ve sapma",
          latex: `n_{\\text{yakın}} = ${latexNum(n)} \\;(\\text{${awgName(n)} AWG}), \\quad \\delta = \\frac{${latexQty(An, "mm2", { significant: 5 })} - ${latexQty(A, "mm2", { significant: 5 })}}{${latexQty(A, "mm2", { significant: 5 })}} = ${latexQty(outputs.awg_sapma, "percent")}`,
        },
      ],
      checks,
    };
  }
  throw new Error(`birim-donusturucu: bilinmeyen AWG yönü "${String(yon)}"`);
}

const linearInputs: InputSpec[] = LINEAR_QUANTITIES.map((q) => ({
  kind: "number",
  key: inputKey(q.id),
  label: q.label,
  symbol: q.symbol,
  dimension: q.dimension,
  defaultUnit: q.defaultUnit,
  default: q.default,
  ...(q.min !== undefined ? { min: q.min } : {}),
  visibleWhen: { key: "buyukluk", equals: q.id },
}));

const linearOutputs: OutputSpec[] = LINEAR_QUANTITIES.map((q) => ({
  key: q.id,
  label: q.label,
  symbol: q.symbol,
  dimension: q.dimension,
  defaultUnit: q.defaultUnit,
  autoUnit: false,
}));

export const birimDonusturucu: CalcDefinition = {
  id: "7.1",
  slug: "birim-donusturucu",
  category: "yardimci",
  title: "Birim dönüştürücü",
  description:
    "Güç, tork, basınç, sıcaklık, uzunluk, alan, kuvvet, enerji, hız, debi, hacim, kütle ve açısal hız değerlerini tüm birimlere çevirin; AWG tel numarası ile mm² kesit arasında dönüşüm yapın.",
  customUi: "birim-donusturucu",
  formulas: [
    { label: "Doğrusal birim dönüşümü (k: çarpan, b: ofset)", latex: "x_{\\text{SI}} = x \\cdot k + b, \\qquad y = \\frac{x_{\\text{SI}} - b_y}{k_y}" },
    { label: "AWG çapı", latex: "d_n = 0{,}127\\,\\mathrm{mm} \\cdot 92^{(36 - n)/39}, \\quad 4/0 \\to n = -3" },
    { label: "AWG kesiti", latex: "A_n = \\frac{\\pi}{4} d_n^2" },
    { label: "Kesitten AWG", latex: "n = 36 - 39 \\log_{92} \\frac{d}{0{,}127\\,\\mathrm{mm}}, \\quad d = \\sqrt{\\frac{4A}{\\pi}}" },
  ],
  references: [
    {
      standard: "ISO 80000-1",
      title: "Quantities and units — Part 1: General",
      note: "Birim tanımları ve çarpanları; sayı yazımı (ondalık virgül, binlik ayırıcı).",
    },
    {
      standard: "ASTM B258",
      title: "Standard nominal diameters and cross-sectional areas of AWG sizes of solid round wires used as electrical conductors",
      note: "AWG tanım formülü NBS Handbook 100 §2.2'den doğrulandı.",
    },
    { ...NBS100, note: "No. 0000 = 0,4600 inç, No. 36 = 0,0050 inç; aradaki 38 boyut geometrik dizi (oran 92^(1/39))." },
  ],
  inputs: [
    {
      kind: "select",
      key: "buyukluk",
      label: "Büyüklük",
      options: [...LINEAR_QUANTITIES.map((q) => ({ value: q.id, label: q.label })), { value: AWG_ID, label: "AWG ↔ mm²" }],
      default: "guc",
    },
    ...linearInputs,
    {
      kind: "select",
      key: "awg_yon",
      label: "Dönüşüm yönü",
      options: [
        { value: "awg-mm2", label: "AWG → mm²" },
        { value: "mm2-awg", label: "mm² → AWG" },
      ],
      default: "awg-mm2",
      visibleWhen: { key: "buyukluk", equals: AWG_ID },
    },
    {
      kind: "select",
      key: "awg_no",
      label: "AWG numarası",
      options: AWG_OPTIONS,
      default: "14",
      visibleWhen: { key: "awg_yon", equals: "awg-mm2" },
    },
    {
      kind: "number",
      key: "awg_kesit",
      label: "Kesit",
      symbol: "A",
      dimension: "alan",
      defaultUnit: "mm2",
      default: 2.5,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "awg_yon", equals: "mm2-awg" },
    },
  ],
  outputs: [
    ...linearOutputs,
    { key: "awg_cap", label: "Tel çapı", symbol: "d", dimension: "uzunluk", defaultUnit: "mm" },
    { key: "awg_alan", label: "Kesit", symbol: "A", dimension: "alan", defaultUnit: "mm2" },
    {
      key: "awg_n",
      label: "En yakın AWG numarası (0 = 1/0, −1 = 2/0, −2 = 3/0, −3 = 4/0)",
      symbol: "n",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
    },
    { key: "awg_n_alan", label: "En yakın AWG kesiti", symbol: "A_n", dimension: "alan", defaultUnit: "mm2" },
    { key: "awg_n_cap", label: "En yakın AWG çapı", symbol: "d_n", dimension: "uzunluk", defaultUnit: "mm" },
    { key: "awg_sapma", label: "Kesit sapması", symbol: "\\delta", dimension: "oran", defaultUnit: "percent" },
    { key: "awg_buyuk_n", label: "Bir büyük kesit (AWG)", symbol: "n - 1", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "awg_buyuk_alan", label: "Bir büyük kesit", symbol: "A_{n-1}", dimension: "alan", defaultUnit: "mm2" },
    { key: "awg_kucuk_n", label: "Bir küçük kesit (AWG)", symbol: "n + 1", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "awg_kucuk_alan", label: "Bir küçük kesit", symbol: "A_{n+1}", dimension: "alan", defaultUnit: "mm2" },
  ],

  compute: (inputs) => {
    const id = inputs.buyukluk as string;
    if (id === AWG_ID) return computeAwg(inputs);
    const q = LINEAR_QUANTITIES.find((x) => x.id === id);
    if (!q) throw new Error(`birim-donusturucu: bilinmeyen büyüklük "${id}"`);
    const valueSI = num(inputs, inputKey(q.id));
    const si = siUnit(q.dimension);
    return {
      outputs: { [q.id]: valueSI },
      steps: [
        {
          label: `SI birimi (${si.name})`,
          latex: `${q.symbol} = ${latexQty(valueSI, si.id, { significant: 6 })}`,
        },
      ],
      checks: [],
    };
  },
};
