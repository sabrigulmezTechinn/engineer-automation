/**
 * KAPSAM 4.5 — Direnç renk kodu, SMD direnç kodu ve kondansatör kodu (kod → değer).
 *
 * Durum yalnızca select girdileriyle (ve EIA-96 kodu için bir tam sayı girdisiyle) tutulur; özel arayüz
 * (src/components/calc/custom/renk-kodu.tsx) bant renklerini görsel seçtirir ve SMD/kondansatör kodunu tek metin
 * kutusundan ayrıştırıp bu girdilere yazar. Sonuç her zaman runCalc'tan gelir.
 *
 * - Renk bantları: 4 bant = 2 rakam + çarpan + tolerans; 5 bant = 3 rakam + çarpan + tolerans; 6 bant = 5 bant + TCR.
 *   R = (rakamlar) · 10^n; R_min/max = R·(1 ∓ t).
 * - SMD: 3 karakter (2 hane + sıfır sayısı), 4 karakter (3 hane + sıfır sayısı); "R" ondalık virgül (Ω), "L" ondalık
 *   virgül (mΩ); EIA-96 = 2 haneli kod (E96 değeri) + çarpan harfi.
 * - Kondansatör: 2 hane + çarpan hanesi, pF (8 = ×0,01, 9 = ×0,1) + tolerans harfi.
 * Tablolar ve kaynakları: kod-ortak.ts.
 */
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexSpec } from "@/lib/calc/latex";
import type {
  CalcDefinition,
  Check,
  ComputeInputs,
  InputSpec,
  OutputSpec,
  Reference,
  SelectInputSpec,
  Step,
} from "@/lib/calc/types";
import { formatQuantity, fromSI } from "@/lib/units";
import type { ESeriesId } from "../yardimci/e-serileri";
import { standardNeighbours } from "../yardimci/standart-deger-serileri";
import {
  ANAHTAR,
  CARPAN_US,
  anlamliHane,
  bantRenkleri,
  smdKodlari,
  EIA96_HARF_US,
  KOND_CARPAN_US,
  KOND_TOLERANS,
  RAKAM,
  RAKAM_RENKLERI,
  RENK_ADI,
  TCR,
  TOLERANS,
  eia96Taban,
  scaled,
  smdKodDegeri,
  type BantSayisi,
  type KodMod,
  type Renk,
  type SmdTip,
} from "./kod-ortak";

/** Hüküm olmayan notlar (kod metni, yöntem, hatırlatma) için seviye */

// ---------------------------------------------------------------------------
// Referanslar

const REF_IEC60062: Reference = {
  standard: "IEC 60062:2016+AMD1:2019",
  title: "Marking codes for resistors and capacitors",
  clause: "3.2–3.4 (renk kodu, değer/tolerans ve TCR işaretleme), Ek A",
  note: "Standardın tabloları yayınlanmaz; renk ve kod değerleri aşağıdaki üretici belgelerinden alınmıştır (Vishay 20020 ve TT TN004 renk kodu için IEC 60062'ye atıf yapar).",
};

const REF_VISHAY_20020: Reference = {
  standard: "Vishay Draloric 20020",
  title: "Surface Mount Resistor Marking (rev. 25-May-2010)",
  note: "Renk kodu (rakam, çarpan 10⁻²–10⁹, tolerans), 4/5/6 bant düzeni, 6. bant TCR (100/50/25/15/10/5 ppm/K); çip direnç işareti: 3 karakter E24 %2/%5/%10, 4 karakter ≤%1; R ve L ondalık işaretleri. https://www.vishay.com/doc?20020",
};

const REF_TT_TN004: Reference = {
  standard: "TT Electronics TN004",
  title: "Methods for Marking Values on Resistors (09.24)",
  note: "Renk kodu (gri ±%0,05 dahil), tolerans bandının daha geniş ya da daha aralıklı olması; çip direnç kodu (2–3 hane + sıfır sayısı, R ondalık) ve EIA-96 tablosu. https://www.ttelectronics.com/TTElectronics/media/ProductFiles/Application-Note/TN004-Methods-for-Marking-Values-on-Resistors.pdf",
};

const REF_BOURNS_CR: Reference = {
  standard: "Bourns CR Series",
  title: "Thick Film Chip Resistors — EIA-96 Marking for CR0603, 1 %; Multipliers",
  note: "EIA-96 kodu 01–96 → 100–976; çarpan harfleri Z 10⁻³, Y 10⁻², X 10⁻¹, A 10⁰ … F 10⁵ (H, R, S kaynaklar arasında çeliştiği için kullanılmaz). https://www.bourns.com/docs/product-datasheets/cr.pdf",
};

const REF_VISHAY_45171: Reference = {
  standard: "Vishay 45171",
  title: "K Series Radial Leaded MLCC — Marking (rev. 05-Sep-2025)",
  note: "İşaret EIA 198'e göre: iki anlamlı hane + çarpan hanesi; 100 pF'tan küçükte iki hane doğrudan pF; J = %5, K = %10, M = %20. https://www.vishay.com/docs/45171/kseries.pdf",
};

const REF_KEMET: Reference = {
  standard: "KEMET C1003_C0G ve C1005_Y5V SMD MLCC (2/20/2025)",
  title: "Ordering Information — Capacitance Code ve Capacitance Tolerance",
  note: "İki anlamlı hane + sıfır sayısı; 9 → 1,0–9,9 pF, 8 → 0,5–0,99 pF (2,2 pF = 229). B ±0,10 pF, C ±0,25 pF, D ±0,5 pF, F ±%1, G ±%2, J ±%5, K ±%10, M ±%20, Z +%80/−%20. https://search.kemet.com/download/datasheet/C0805C101J5GACTU",
};

const REF_IEC60063: Reference = {
  standard: "IEC 60063",
  title: "Preferred number series for resistors and capacitors",
  note: "E serisi denetimi; seri değerleri Vishay 28372'den (bkz. 7.2 Standart değer serileri).",
};

// ---------------------------------------------------------------------------
// Seçenek etiketleri

const CARPAN_METNI: Record<number, string> = {
  [-3]: "×0,001",
  [-2]: "×0,01",
  [-1]: "×0,1",
  0: "×1",
  1: "×10",
  2: "×100",
  3: "×1 k",
  4: "×10 k",
  5: "×100 k",
  6: "×1 M",
  7: "×10 M",
  8: "×100 M",
  9: "×1 G",
};

const yuzde = (kesir: number) => `±%${String(Math.round(kesir * 1e6) / 1e4).replace(".", ",")}`;

const rakamSecenekleri = (renkler: readonly Renk[]) =>
  renkler.map((r) => ({ value: r, label: `${RENK_ADI[r]} (${RAKAM[r]})` }));

const CARPAN_SIRASI: Renk[] = ["gumus", "altin", ...RAKAM_RENKLERI];
const TOLERANS_SIRASI: Renk[] = ["kahverengi", "kirmizi", "yesil", "mavi", "mor", "gri", "altin", "gumus", "yok"];
const TCR_SIRASI: Renk[] = ["kahverengi", "kirmizi", "sari", "turuncu", "mavi", "mor"];

const RAKAMLAR = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const hane = (ekler: { value: string; label: string }[] = []) => [...RAKAMLAR.map((d) => ({ value: d, label: d })), ...ekler];
const R_SECENEGI = { value: "R", label: "R (ondalık virgül)" };
const L_SECENEGI = { value: "L", label: "L (mΩ ondalık virgül)" };

const KOND_CARPAN_METNI: Record<string, string> = {
  "0": "0 (×1)",
  "1": "1 (×10)",
  "2": "2 (×100)",
  "3": "3 (×1000)",
  "4": "4 (×10 000)",
  "5": "5 (×100 000)",
  "6": "6 (×1 000 000)",
  "8": "8 (×0,01)",
  "9": "9 (×0,1)",
};

const KOND_TOLERANS_METNI: Record<string, string> = {
  B: "B (±0,1 pF)",
  C: "C (±0,25 pF)",
  D: "D (±0,5 pF)",
  F: "F (±%1)",
  G: "G (±%2)",
  J: "J (±%5)",
  K: "K (±%10)",
  M: "M (±%20)",
  Z: "Z (+%80 / −%20)",
};

const renkModu = { key: ANAHTAR.mod, equals: "renk" };
const smdModu = { key: ANAHTAR.mod, equals: "smd" };
const kondModu = { key: ANAHTAR.mod, equals: "kondansator" };

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: ANAHTAR.mod,
    label: "Kod türü",
    options: [
      { value: "renk", label: "Renk bantları" },
      { value: "smd", label: "SMD direnç kodu" },
      { value: "kondansator", label: "Kondansatör kodu" },
      { value: "ters", label: "Değerden koda" },
    ],
    default: "renk",
  },
  // Ters yön: değer → kod
  {
    kind: "number",
    key: ANAHTAR.tersDeger,
    label: "Direnç değeri",
    symbol: "R",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["mohm", "ohm", "kohm", "Mohm"],
    default: 4.7,
    min: 0.01,
    max: 1e12,
    help: "Renk bantları ve SMD kodları bulunur; değer iki (4 bant) ya da üç (5 bant) anlamlı haneye yuvarlanır.",
    visibleWhen: { key: ANAHTAR.mod, equals: "ters" },
  },
  // Renk bantları
  {
    kind: "select",
    key: ANAHTAR.bant,
    label: "Bant sayısı",
    options: [
      { value: "4", label: "4 bant" },
      { value: "5", label: "5 bant" },
      { value: "6", label: "6 bant" },
    ],
    default: "4",
    help: "4 bant: 2 rakam + çarpan + tolerans. 5 bant: 3 rakam + çarpan + tolerans. 6 bant: 5 bant + sıcaklık katsayısı. Tolerans bandı diğerlerinden daha geniş ya da daha aralıklıdır; okumaya karşı uçtan başlayın.",
    visibleWhen: renkModu,
  },
  {
    kind: "select",
    key: ANAHTAR.rakam[0],
    label: "1. bant (1. rakam)",
    // Baştaki sıfır işaretlemede kullanılmaz; siyah ilk bantta sunulmaz.
    options: rakamSecenekleri(RAKAM_RENKLERI.slice(1)),
    default: "sari",
    visibleWhen: renkModu,
  },
  {
    kind: "select",
    key: ANAHTAR.rakam[1],
    label: "2. bant (2. rakam)",
    options: rakamSecenekleri(RAKAM_RENKLERI),
    default: "mor",
    visibleWhen: renkModu,
  },
  {
    kind: "select",
    key: ANAHTAR.rakam[2],
    label: "3. bant (3. rakam)",
    options: rakamSecenekleri(RAKAM_RENKLERI),
    default: "siyah",
    visibleWhen: { key: ANAHTAR.bant, equals: ["5", "6"] },
  },
  {
    kind: "select",
    key: ANAHTAR.carpan,
    label: "Çarpan bandı",
    options: CARPAN_SIRASI.map((r) => ({ value: r, label: `${RENK_ADI[r]} (${CARPAN_METNI[CARPAN_US[r] as number]})` })),
    default: "kirmizi",
    visibleWhen: renkModu,
  },
  {
    kind: "select",
    key: ANAHTAR.tol,
    label: "Tolerans bandı",
    options: TOLERANS_SIRASI.map((r) => ({
      value: r,
      label: r === "yok" ? `Yok (${yuzde(0.2)})` : `${RENK_ADI[r]} (${yuzde((TOLERANS[r] as { tol: number }).tol)})`,
    })),
    default: "altin",
    visibleWhen: { key: ANAHTAR.mod, equals: ["renk", "ters"] },
  },
  {
    kind: "select",
    key: ANAHTAR.tcr,
    label: "6. bant (sıcaklık katsayısı)",
    options: TCR_SIRASI.map((r) => ({ value: r, label: `${RENK_ADI[r]} (${Math.round((TCR[r] as number) * 1e6)} ppm/K)` })),
    default: "kahverengi",
    visibleWhen: { key: ANAHTAR.bant, equals: "6" },
  },
  // SMD direnç kodu
  {
    kind: "select",
    key: ANAHTAR.tip,
    label: "SMD kod biçimi",
    options: [
      { value: "3", label: "3 karakter" },
      { value: "4", label: "4 karakter" },
      { value: "eia96", label: "EIA-96" },
    ],
    default: "3",
    help: "3 karakter: 2 hane + sıfır sayısı (472). 4 karakter: 3 hane + sıfır sayısı (4702). R ondalık virgüldür (4R7, R47); L miliohm ondalık virgülüdür (10L0). EIA-96: 2 haneli kod + çarpan harfi (01C).",
    visibleWhen: smdModu,
  },
  { kind: "select", key: ANAHTAR.s3[0], label: "1. karakter", options: hane([R_SECENEGI]), default: "4", visibleWhen: { key: ANAHTAR.tip, equals: "3" } },
  { kind: "select", key: ANAHTAR.s3[1], label: "2. karakter", options: hane([R_SECENEGI]), default: "7", visibleWhen: { key: ANAHTAR.tip, equals: "3" } },
  {
    kind: "select",
    key: ANAHTAR.s3[2],
    label: "3. karakter",
    options: hane(),
    default: "2",
    help: "Kodda R yoksa sıfır sayısı (çarpan), R varsa son anlamlı hane.",
    visibleWhen: { key: ANAHTAR.tip, equals: "3" },
  },
  { kind: "select", key: ANAHTAR.s4[0], label: "1. karakter", options: hane([R_SECENEGI]), default: "4", visibleWhen: { key: ANAHTAR.tip, equals: "4" } },
  { kind: "select", key: ANAHTAR.s4[1], label: "2. karakter", options: hane([R_SECENEGI]), default: "7", visibleWhen: { key: ANAHTAR.tip, equals: "4" } },
  { kind: "select", key: ANAHTAR.s4[2], label: "3. karakter", options: hane([R_SECENEGI, L_SECENEGI]), default: "0", visibleWhen: { key: ANAHTAR.tip, equals: "4" } },
  {
    kind: "select",
    key: ANAHTAR.s4[3],
    label: "4. karakter",
    options: hane(),
    default: "2",
    help: "Kodda R/L yoksa sıfır sayısı (çarpan), varsa son anlamlı hane.",
    visibleWhen: { key: ANAHTAR.tip, equals: "4" },
  },
  {
    kind: "number",
    key: ANAHTAR.eiaKod,
    label: "EIA-96 kodu (ilk iki hane)",
    symbol: "n",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 1,
    min: 1,
    max: 96,
    integer: true,
    help: "01 → 100, 02 → 102 … 96 → 976 (E96 serisi).",
    visibleWhen: { key: ANAHTAR.tip, equals: "eia96" },
  },
  {
    kind: "select",
    key: ANAHTAR.eiaHarf,
    label: "EIA-96 çarpan harfi",
    options: Object.entries(EIA96_HARF_US).map(([harf, us]) => ({ value: harf, label: `${harf} (${CARPAN_METNI[us]})` })),
    default: "C",
    visibleWhen: { key: ANAHTAR.tip, equals: "eia96" },
  },
  // Kondansatör kodu
  {
    kind: "select",
    key: ANAHTAR.kond[0],
    label: "1. hane",
    // Baştaki sıfır kullanılmaz (1,0–9,9 pF için çarpan 9: 229 = 2,2 pF); 0 sunulmaz, böylece kapasitans 0 olamaz.
    options: hane().slice(1),
    default: "1",
    visibleWhen: kondModu,
  },
  { kind: "select", key: ANAHTAR.kond[1], label: "2. hane", options: hane(), default: "0", visibleWhen: kondModu },
  {
    kind: "select",
    key: ANAHTAR.kond[2],
    label: "3. hane (çarpan, pF)",
    options: Object.keys(KOND_CARPAN_US).map((d) => ({ value: d, label: KOND_CARPAN_METNI[d] })),
    default: "4",
    help: "Sıfır sayısı; 9 → ×0,1 (1,0–9,9 pF), 8 → ×0,01 (0,5–0,99 pF). İki haneli kod (ör. 47) doğrudan pF'tır: 3. hane 0.",
    visibleWhen: kondModu,
  },
  {
    kind: "select",
    key: ANAHTAR.kTol,
    label: "Tolerans harfi",
    options: [{ value: "yok", label: "Yok" }, ...Object.keys(KOND_TOLERANS).map((h) => ({ value: h, label: KOND_TOLERANS_METNI[h] }))],
    default: "J",
    visibleWhen: kondModu,
  },
];

const R_UNITS = ["mohm", "ohm", "kohm", "Mohm"];
const C_UNITS = ["pF", "nF", "uF", "mF"];

const OUTPUTS: OutputSpec[] = [
  { key: "R", label: "Direnç", symbol: "R", dimension: "direnc", defaultUnit: "ohm", units: R_UNITS },
  { key: "tol", label: "Tolerans", symbol: "t", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
  { key: "Rmin", label: "En küçük direnç", symbol: "R_{\\min}", dimension: "direnc", defaultUnit: "ohm", units: R_UNITS },
  { key: "Rmax", label: "En büyük direnç", symbol: "R_{\\max}", dimension: "direnc", defaultUnit: "ohm", units: R_UNITS },
  {
    key: "tcr",
    label: "Sıcaklık katsayısı (TCR)",
    symbol: "\\alpha",
    dimension: "oran",
    defaultUnit: "ppm",
    units: ["ppm"],
    unitLabel: "ppm/K",
  },
  { key: "C", label: "Kapasitans", symbol: "C", dimension: "kapasitans", defaultUnit: "pF", units: C_UNITS },
  { key: "tolC", label: "Tolerans", symbol: "t", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
  { key: "tolCabs", label: "Tolerans (mutlak)", symbol: "\\Delta C", dimension: "kapasitans", defaultUnit: "pF", units: ["pF"] },
  { key: "Cmin", label: "En küçük kapasitans", symbol: "C_{\\min}", dimension: "kapasitans", defaultUnit: "pF", units: C_UNITS },
  { key: "Cmax", label: "En büyük kapasitans", symbol: "C_{\\max}", dimension: "kapasitans", defaultUnit: "pF", units: C_UNITS },
  // Ters yön
  { key: "R4", label: "4 bant: gösterilen değer", symbol: "R_4", dimension: "direnc", defaultUnit: "ohm", units: R_UNITS },
  { key: "h4", label: "4 bant: rakamlar", symbol: "d_1 d_2", dimension: "boyutsuz", defaultUnit: "unitless", integer: true },
  { key: "n4", label: "4 bant: çarpan üssü", symbol: "n_4", dimension: "boyutsuz", defaultUnit: "unitless", integer: true },
  { key: "sapma4", label: "4 bant: yuvarlama sapması", symbol: "\\delta_4", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
  { key: "R5", label: "5 bant: gösterilen değer", symbol: "R_5", dimension: "direnc", defaultUnit: "ohm", units: R_UNITS },
  { key: "h5", label: "5 bant: rakamlar", symbol: "d_1 d_2 d_3", dimension: "boyutsuz", defaultUnit: "unitless", integer: true },
  { key: "n5", label: "5 bant: çarpan üssü", symbol: "n_5", dimension: "boyutsuz", defaultUnit: "unitless", integer: true },
  { key: "sapma5", label: "5 bant: yuvarlama sapması", symbol: "\\delta_5", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
];

// ---------------------------------------------------------------------------
// Yardımcılar

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`renk-smd-kondansator-kodlari: "${key}" sayı değil`);
  return v;
}

function sel(inputs: ComputeInputs, key: string): string {
  const v = inputs[key];
  if (typeof v !== "string") throw new Error(`renk-smd-kondansator-kodlari: "${key}" seçim değil`);
  return v;
}

function outSpec(key: string): OutputSpec {
  const s = OUTPUTS.find((o) => o.key === key);
  if (!s) throw new Error(`renk-smd-kondansator-kodlari: "${key}" çıktısı yok`);
  return s;
}

/** Adımlarda çıktı kartıyla aynı birim */
const q = (key: string, valueSI: number) => latexSpec(outSpec(key), valueSI);

/** Düz metinde çıktı kartıyla aynı birim */
function metin(key: string, valueSI: number): string {
  const spec = outSpec(key);
  const unit = autoOutputUnit(spec, valueSI);
  return formatQuantity(fromSI(valueSI, unit), unit);
}

/** Bir select girdisinin seçilen seçeneğinin etiketi (ör. "Sarı (4)") */
function etiket(key: string, value: string): string {
  const spec = INPUTS.find((i): i is SelectInputSpec => i.kind === "select" && i.key === key);
  return spec?.options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Anlamlı haneler için LaTeX ağırlıklı toplam: (10 \cdot 4 + 7). Her kip tek ve kısa bir adım üretir: hesap bir tablo
 * okumasıdır; tolerans sınırları çıktı kartlarında. (Kombinasyon testi her seçeneği tek tek KaTeX'ten geçirir.)
 */
function haneToplami(haneler: number[]): string {
  const n = haneler.length;
  return `(${haneler.map((d, i) => (n - 1 - i === 0 ? String(d) : `${10 ** (n - 1 - i)} \\cdot ${d}`)).join(" + ")})`;
}

const SERILER: ESeriesId[] = ["E6", "E12", "E24", "E48", "E96", "E192"];

/** Değerin bulunduğu en küçük E serisi (yoksa uyarı). */
function seriKontrolu(key: "R" | "C", x: number, ipucu: string, ipucuRef?: Reference): Check {
  const yazi = metin(key, x);
  for (const id of SERILER) {
    if (standardNeighbours(x, id).exact) {
      return { level: "ok", message: `${yazi}, ${id} serisinde standart bir değerdir.`, reference: REF_IEC60063 };
    }
  }
  return { level: "uyari", message: `${yazi} E6–E192 serilerinin hiçbirinde yok. ${ipucu}`, reference: ipucuRef ?? REF_IEC60063 };
}

const MESSAGES = {
  bantYonu:
    "Bant sırasını kontrol edin: tolerans bandı diğerlerinden daha geniş ya da daha aralıklıdır; okumaya karşı uçtan başlanır.",
  kodKontrol: "Kodu kontrol edin.",
  tersSeri: "Bu değer standart (E serisi) bir direnç değeri değil; üretilen kodlar yalnızca gösterim içindir.",
  smd3: "Çip dirençlerde tolerans işaretlenmez; 3 karakterli kod E24 serisindeki %2, %5 ve %10 dirençlerde kullanılır.",
  smd4: "Çip dirençlerde tolerans işaretlenmez; 4 karakterli kod ≤%1 ve %2 (E24, E48/E96) dirençlerde kullanılır.",
  eia96: "EIA-96 kodu 0603 boyutundaki %1'lik (E96) dirençlerde kullanılır; tolerans ayrıca işaretlenmez.",
  smd3Tablo: "Çarpan hanesi 8 ya da 9: Vishay tablosu 3 karakterli kodu 107–917'ye (100–910 MΩ) kadar verir. Kodu kontrol edin.",
  smd4Tablo: "Çarpan hanesi 7 ya da üstü: Vishay tablosu 4 karakterli kodu 1006–9766'ya (100–976 MΩ) kadar verir. Kodu kontrol edin.",
  tersYok: (bant: string, aralik: string) => `${bant} bantla gösterilemez (renk koduyla ${aralik}).`,
  tersSmd: (uc: string, dort: string, eia: string) => `SMD kodları: 3 karakter ${uc}; 4 karakter ${dort}; EIA-96 ${eia}.`,
  tersSmdYok: "tam gösterilemez",
  kopru: "Değer 0 Ω: köprü (jumper). Bourns CR serisinde 0603 ve üstü köprüler tek \"0\" ile işaretlenir.",
  mutlakBuyuk: "Mutlak tolerans kapasitansın kendisinden büyük; en küçük değer 0 alındı. Kodu kontrol edin.",
} as const;

// ---------------------------------------------------------------------------
// Hesaplar

function renkHesabi(inputs: ComputeInputs) {
  const bant = sel(inputs, ANAHTAR.bant) as BantSayisi;
  const rakamKeys = bant === "4" ? ANAHTAR.rakam.slice(0, 2) : ANAHTAR.rakam.slice(0, 3);
  const renkler = rakamKeys.map((k) => sel(inputs, k) as Renk);
  const haneler = renkler.map((r) => {
    const d = RAKAM[r];
    if (d === undefined) throw new Error(`renk-smd-kondansator-kodlari: "${r}" rakam rengi değil`);
    return d;
  });
  const carpan = sel(inputs, ANAHTAR.carpan) as Renk;
  const us = CARPAN_US[carpan];
  const tolRenk = sel(inputs, ANAHTAR.tol) as Renk;
  const tolBilgi = TOLERANS[tolRenk];
  if (us === undefined || !tolBilgi) throw new Error("renk-smd-kondansator-kodlari: geçersiz çarpan/tolerans rengi");

  const m = Number(haneler.join(""));
  const R = scaled(m, us);
  const t = tolBilgi.tol;
  const Rmin = R * (1 - t);
  const Rmax = R * (1 + t);
  const outputs: Record<string, number> = { R, tol: t, Rmin, Rmax };
  const steps: Step[] = [
    { label: `Değer (${bant} bant)`, latex: `R = ${haneToplami(haneler)} \\cdot 10^{${us}}\\,\\Omega = ${q("R", R)}` },
  ];

  const parcalar = [
    ...rakamKeys.map((k, i) => etiket(k, renkler[i])),
    etiket(ANAHTAR.carpan, carpan),
    tolRenk === "yok" ? "tolerans bandı yok" : etiket(ANAHTAR.tol, tolRenk),
  ];
  let ozet = `${metin("R", R)} ${yuzde(t)}`;
  if (bant === "6") {
    const tcrRenk = sel(inputs, ANAHTAR.tcr) as Renk;
    const tcr = TCR[tcrRenk];
    if (tcr === undefined) throw new Error(`renk-smd-kondansator-kodlari: "${tcrRenk}" TCR rengi değil`);
    outputs.tcr = tcr;
    parcalar.push(etiket(ANAHTAR.tcr, tcrRenk));
    ozet += `, ±${Math.round(tcr * 1e6)} ppm/K`;
  }
  const checks: Check[] = [
    { level: "bilgi", message: `Bantlar (soldan sağa): ${parcalar.join(" – ")} → ${ozet}.`, reference: REF_VISHAY_20020 },
    seriKontrolu("R", R, MESSAGES.bantYonu, REF_TT_TN004),
  ];
  return { outputs, steps, checks };
}

function smdKarakterleri(inputs: ComputeInputs, tip: SmdTip): string[] {
  const keys = tip === "4" ? ANAHTAR.s4 : ANAHTAR.s3;
  return keys.map((k) => sel(inputs, k));
}

function smdHesabi(inputs: ComputeInputs) {
  const tip = sel(inputs, ANAHTAR.tip) as SmdTip;
  const steps: Step[] = [];
  const checks: Check[] = [];
  let R: number;
  let kod: string;

  if (tip === "eia96") {
    const n = num(inputs, ANAHTAR.eiaKod);
    const harf = sel(inputs, ANAHTAR.eiaHarf);
    const us = EIA96_HARF_US[harf];
    if (us === undefined) throw new Error(`renk-smd-kondansator-kodlari: "${harf}" EIA-96 harfi değil`);
    const taban = eia96Taban(n);
    R = scaled(taban, us);
    kod = `${String(n).padStart(2, "0")}${harf}`;
    steps.push({
      label: `EIA-96: kod ${String(n).padStart(2, "0")} → ${taban}, ${harf} → ${CARPAN_METNI[us]}`,
      latex: `R = ${taban} \\cdot 10^{${us}}\\,\\Omega = ${q("R", R)}`,
    });
    checks.push({ level: "bilgi", message: `Kod ${kod} → ${metin("R", R)}. ${MESSAGES.eia96}`, reference: REF_BOURNS_CR });
  } else if (tip === "3" || tip === "4") {
    const chars = smdKarakterleri(inputs, tip);
    const d = smdKodDegeri(chars);
    if ("hata" in d) throw new Error(`renk-smd-kondansator-kodlari: ${d.hata}`);
    R = scaled(d.m, d.us);
    kod = chars.join("");
    if (d.isaret === null) {
      steps.push({
        label: `Kod ${kod}: son hane sıfır sayısıdır`,
        latex: `R = ${haneToplami(chars.slice(0, -1).map(Number))} \\cdot 10^{${d.us}}\\,\\Omega = ${q("R", R)}`,
      });
      const tabloSiniri = tip === "3" ? 7 : 6;
      if (d.us > tabloSiniri) {
        checks.push({ level: "uyari", message: tip === "3" ? MESSAGES.smd3Tablo : MESSAGES.smd4Tablo, reference: REF_VISHAY_20020 });
      }
    } else {
      steps.push({
        label: d.isaret === "R" ? `Kod ${kod}: R ondalık virgüldür (Ω)` : `Kod ${kod}: L ondalık virgüldür (mΩ)`,
        latex: `\\text{${kod}} \\;\\Rightarrow\\; R = ${q("R", R)}`,
      });
    }
    checks.push({
      level: "bilgi",
      message: `Kod ${kod} → ${metin("R", R)}. ${tip === "3" ? MESSAGES.smd3 : MESSAGES.smd4}`,
      reference: REF_VISHAY_20020,
    });
  } else {
    throw new Error(`renk-smd-kondansator-kodlari: bilinmeyen SMD kod biçimi "${String(tip)}"`);
  }

  if (R === 0) checks.push({ level: "bilgi", message: MESSAGES.kopru, reference: REF_BOURNS_CR });
  else checks.push(seriKontrolu("R", R, MESSAGES.kodKontrol));
  return { outputs: { R } as Record<string, number>, steps, checks };
}

function kondansatorHesabi(inputs: ComputeInputs) {
  const [d1, d2, d3] = ANAHTAR.kond.map((k) => sel(inputs, k));
  const us = KOND_CARPAN_US[d3];
  if (us === undefined) throw new Error(`renk-smd-kondansator-kodlari: "${d3}" çarpan hanesi değil`);
  const haneler = [Number(d1), Number(d2)];
  const m = 10 * haneler[0] + haneler[1];
  // pF → F: 10⁻¹²
  const C = scaled(m, us - 12);
  const harf = sel(inputs, ANAHTAR.kTol);
  const outputs: Record<string, number> = { C };
  const steps: Step[] = [
    {
      label: `Kod ${d1}${d2}${d3}: iki anlamlı hane + çarpan hanesi (pF)`,
      latex: `C = ${haneToplami(haneler)} \\cdot 10^{${us}}\\,\\mathrm{pF} = ${q("C", C)}`,
    },
  ];
  const checks: Check[] = [];
  let tolMetni = "tolerans harfi yok";

  if (harf !== "yok") {
    const tol = KOND_TOLERANS[harf];
    if (!tol) throw new Error(`renk-smd-kondansator-kodlari: "${harf}" tolerans harfi değil`);
    let Cmin: number;
    let Cmax: number;
    if (tol.tur === "mutlak") {
      Cmax = C + tol.deger;
      Cmin = Math.max(0, C - tol.deger);
      outputs.tolCabs = tol.deger;
      if (C - tol.deger < 0) checks.push({ level: "uyari", message: MESSAGES.mutlakBuyuk, reference: REF_KEMET });
      tolMetni = `${harf}: ±${metin("tolCabs", tol.deger)}`;
    } else if (tol.tur === "oran") {
      Cmin = C * (1 - tol.deger);
      Cmax = C * (1 + tol.deger);
      outputs.tolC = tol.deger;
      tolMetni = `${harf}: ${yuzde(tol.deger)}`;
    } else {
      Cmin = C * (1 - tol.eksi);
      Cmax = C * (1 + tol.arti);
      tolMetni = `${harf}: +%80 / −%20`;
    }
    Object.assign(outputs, { Cmin, Cmax });
  }

  const kod = `${d1}${d2}${d3}${harf === "yok" ? "" : harf}`;
  checks.unshift({ level: "bilgi", message: `Kod ${kod} → ${metin("C", C)} (${tolMetni}).`, reference: harf === "yok" ? REF_VISHAY_45171 : REF_KEMET });
  checks.push(seriKontrolu("C", C, MESSAGES.kodKontrol));
  return { outputs, steps, checks };
}

/** Ters yön: değeri 4 ve 5 bantlı renk koduna ve SMD kodlarına çevirir. */
function tersHesabi(inputs: ComputeInputs) {
  const R = num(inputs, ANAHTAR.tersDeger);
  const tolRenk = sel(inputs, ANAHTAR.tol) as Renk;
  const tolBilgi = TOLERANS[tolRenk];
  if (!tolBilgi) throw new Error(`renk-smd-kondansator-kodlari: "${tolRenk}" tolerans rengi değil`);
  const tolEtiketi = tolRenk === "yok" ? "tolerans bandı yok" : etiket(ANAHTAR.tol, tolRenk);
  const outputs: Record<string, number> = {};
  const adimlar: string[] = [];
  const checks: Check[] = [];

  for (const [bant, s] of [
    ["4", 2],
    ["5", 3],
  ] as const) {
    const g = anlamliHane(R, s);
    const renkler = bantRenkleri(g.m, g.us);
    if (!renkler) {
      checks.push({ level: "bilgi", message: MESSAGES.tersYok(bant, bant === "4" ? "0,1 Ω – 99 GΩ" : "1 Ω – 999 GΩ"), reference: REF_VISHAY_20020 });
      continue;
    }
    // Birim çevirisi artığı (0,23 kΩ → 230,00000000000003 Ω) sapma olarak gösterilmesin.
    const ham = (g.deger - R) / R;
    const sapma = Math.abs(ham) <= 1e-9 ? 0 : ham;
    Object.assign(outputs, { [`R${bant}`]: g.deger, [`h${bant}`]: g.m, [`n${bant}`]: g.us, [`sapma${bant}`]: sapma });
    adimlar.push(`R_${bant} = ${g.m} \\cdot 10^{${g.us}}\\,\\Omega = ${q(`R${bant}`, g.deger)}`);
    const adlar = [
      ...renkler.slice(0, -1).map((r, i) => etiket(ANAHTAR.rakam[i], r)),
      etiket(ANAHTAR.carpan, renkler[renkler.length - 1]),
      tolEtiketi,
    ];
    const yuvarlama = sapma !== 0 ? ` (girilen değerden sapma ${metin("sapma4", sapma)})` : "";
    checks.push({
      level: "bilgi",
      message: `${bant} bant (soldan sağa): ${adlar.join(" – ")} → ${metin("R", g.deger)} ${yuzde(tolBilgi.tol)}${yuvarlama}.`,
      reference: REF_VISHAY_20020,
    });
  }

  const smd = smdKodlari(R);
  const yok = MESSAGES.tersSmdYok;
  checks.push({
    level: "bilgi",
    message: MESSAGES.tersSmd(smd.uc ?? yok, smd.dort ?? yok, smd.eia96 ?? yok),
    reference: REF_VISHAY_20020,
  });
  checks.push(seriKontrolu("R", R, MESSAGES.tersSeri));
  const steps: Step[] =
    adimlar.length > 0 ? [{ label: "Renk kodu: 4 bant 2, 5 bant 3 anlamlı haneye yuvarlanır", latex: adimlar.join(", \\quad ") }] : [];
  return { outputs, steps, checks };
}

export const renkSmdKondansatorKodlari: CalcDefinition = {
  id: "4.5",
  slug: "renk-smd-kondansator-kodlari",
  category: "elektronik",
  title: "Direnç renk kodu, SMD ve kondansatör kodları",
  description:
    "Direnç renk bantlarından (4, 5, 6 bant), SMD direnç kodundan (472, 4R7, 4702, EIA-96 01C) ya da kondansatör kodundan (104J) değeri, toleransı ve tolerans sınırlarını bulun; ya da bir direnç değerinin renk bantlarını ve SMD kodlarını görün.",
  formulas: [
    { label: "Renk bantları (4 bant)", latex: "R = (10 \\cdot d_1 + d_2) \\cdot 10^{n}\\,\\Omega" },
    { label: "Renk bantları (5 ve 6 bant)", latex: "R = (100 \\cdot d_1 + 10 \\cdot d_2 + d_3) \\cdot 10^{n}\\,\\Omega" },
    { label: "Tolerans sınırları", latex: "R_{\\min} = R \\cdot (1 - t), \\quad R_{\\max} = R \\cdot (1 + t)" },
    {
      label: "SMD kodu (son hane sıfır sayısı; R ve L ondalık virgül)",
      latex: "\\text{472} = 47 \\cdot 10^{2}\\,\\Omega, \\quad \\text{4R7} = 4{,}7\\,\\Omega, \\quad \\text{10L0} = 10{,}0\\,\\mathrm{m}\\Omega",
    },
    { label: "EIA-96", latex: "R = \\text{E96}_{n} \\cdot 10^{k}\\,\\Omega, \\quad \\text{01C} = 100 \\cdot 10^{2}\\,\\Omega = 10\\,\\mathrm{k}\\Omega" },
    { label: "Kondansatör kodu", latex: "C = (10 \\cdot d_1 + d_2) \\cdot 10^{n}\\,\\mathrm{pF}, \\quad \\text{104} = 10 \\cdot 10^{4}\\,\\mathrm{pF} = 100\\,\\mathrm{nF}" },
  ],
  references: [REF_IEC60062, REF_VISHAY_20020, REF_TT_TN004, REF_BOURNS_CR, REF_VISHAY_45171, REF_KEMET, REF_IEC60063],
  inputs: INPUTS,
  outputs: OUTPUTS,
  customUi: "renk-kodu",

  validate: (inputs) => {
    if (inputs[ANAHTAR.mod] !== "smd") return [];
    const tip = inputs[ANAHTAR.tip];
    if (tip !== "3" && tip !== "4") return [];
    const d = smdKodDegeri(smdKarakterleri(inputs, tip));
    return "hata" in d ? [{ level: "hata", message: d.hata }] : [];
  },

  compute: (inputs) => {
    const mod = inputs[ANAHTAR.mod] as KodMod;
    if (mod === "renk") return renkHesabi(inputs);
    if (mod === "smd") return smdHesabi(inputs);
    if (mod === "kondansator") return kondansatorHesabi(inputs);
    if (mod === "ters") return tersHesabi(inputs);
    throw new Error(`renk-smd-kondansator-kodlari: bilinmeyen kod türü "${String(mod)}"`);
  },
};
