/**
 * Birim sistemi genel API'si. İmzalar sözleşmedir.
 * Sunucu ve istemcide çalışır: Node veya tarayıcıya özgü bir şey içe aktarılmaz.
 * Sayı biçimlendirme Intl kullanmaz; sunucu ve tarayıcıda aynı metni üretir (hydration uyumu).
 */
import { DIMENSIONS, SI_UNIT_IDS, UNITS } from "./catalog";
import type { Dimension, FormatOptions, UnitDef } from "./types";

export type { Dimension, FormatOptions, UnitDef } from "./types";

const BY_ID: ReadonlyMap<string, UnitDef> = new Map(UNITS.map((u) => [u.id, u] as const));

const BY_DIMENSION: ReadonlyMap<Dimension, readonly UnitDef[]> = new Map(
  DIMENSIONS.map((d) => [d, UNITS.filter((u) => u.dimension === d)] as const),
);

function dimensionUnits(dimension: Dimension): readonly UnitDef[] {
  const list = BY_DIMENSION.get(dimension);
  if (!list) throw new Error(`Bilinmeyen boyut: "${String(dimension)}"`);
  return list;
}

/** Kimliğe göre birim; bilinmeyen kimlikte hata fırlatır. Kimlikler büyük/küçük harf duyarlıdır. */
export function getUnit(id: string): UnitDef {
  const unit = BY_ID.get(id);
  if (!unit) throw new Error(`Bilinmeyen birim: "${String(id)}"`);
  return unit;
}

/** Bir boyutun tüm birimleri, gösterim sırasıyla. Bilinmeyen boyutta hata fırlatır. */
export function unitsFor(dimension: Dimension): UnitDef[] {
  return dimensionUnits(dimension).slice();
}

/** Bir boyutun SI birimi (factor 1, offset 0). Bilinmeyen boyutta hata fırlatır. */
export function siUnit(dimension: Dimension): UnitDef {
  dimensionUnits(dimension);
  return getUnit(SI_UNIT_IDS[dimension]);
}

function unitToSI(value: number, unit: UnitDef): number {
  return value * unit.factor + (unit.offset ?? 0);
}

function unitFromSI(valueSI: number, unit: UnitDef): number {
  // Bölme, 1/factor ile çarpmaya göre gidiş-dönüşte daha az yuvarlama hatası bırakır.
  return (valueSI - (unit.offset ?? 0)) / unit.factor;
}

/** Verilen birimdeki değeri SI'ya çevirir. */
export function toSI(value: number, unitId: string): number {
  return unitToSI(value, getUnit(unitId));
}

/** SI değerini verilen birime çevirir. */
export function fromSI(valueSI: number, unitId: string): number {
  return unitFromSI(valueSI, getUnit(unitId));
}

/** İki birim arasında çevirir; boyutlar farklıysa hata fırlatır. */
export function convert(value: number, fromUnitId: string, toUnitId: string): number {
  const from = getUnit(fromUnitId);
  const to = getUnit(toUnitId);
  if (from.dimension !== to.dimension) {
    throw new Error(
      `Boyut uyuşmazlığı: "${from.id}" (${from.dimension}) birimi "${to.id}" (${to.dimension}) birimine çevrilemez`,
    );
  }
  if (from === to) return value;
  return unitFromSI(unitToSI(value, from), to);
}

// ---------------------------------------------------------------------------
// Sayı okuma
// ---------------------------------------------------------------------------

/** Binlik üçlü gruplar: "1.234", "12.345.678" (ilk grup 1–3 hane, diğerleri tam 3 hane) */
const DOT_GROUPED = /^\d{1,3}(?:\.\d{3})+$/;
/** İşaret, mantis (rakam, nokta, virgül) ve isteğe bağlı üs */
const NUMBER_SHAPE = /^([+-]?)([\d.,]*)(?:[eE]([+-]?\d+))?$/;

/**
 * Kullanıcı girdisini sayıya çevirir. Geçersiz veya boş girdide null döner.
 *
 * Kurallar:
 * - Baş/son boşluk kırpılır; aradaki boşluklar (normal, NBSP, ince boşluk vb.) binlik ayırıcı
 *   sayılıp yok sayılır ("1 234,5" → 1234,5). Unicode eksi (−) "-" gibi okunur; baştaki "+" kabul edilir.
 * - Ayırıcı kuralları yalnızca mantise uygulanır; üs `[eE][+-]?rakamlar` biçimindedir ("1,5e-3", "2E6").
 * - Hem "." hem "," varsa: "." binlik, "," ondalıktır ("1.234,5" → 1234,5). Virgül tek olmalı ve tüm
 *   noktalardan sonra gelmeli; noktalı kısım üçlü gruplardan oluşmalı ("1,234.5" ve "1.23,4" geçersiz).
 * - Yalnızca "," varsa: tek virgül ondalıktır ("1,5"); birden çok virgül geçersizdir ("1,2,3").
 * - Yalnızca "." varsa: tek nokta ondalıktır ("1.5" → 1,5; "1.000" → 1, mühendisler noktayı ondalık
 *   için yazar). Birden çok nokta binliktir ("1.000.000" → 1e6); gruplar üçlü değilse geçersizdir.
 * - Tam kısmı veya ondalık kısmı boş olabilir: ",5" ve ".5" → 0,5; "5," → 5. En az bir rakam gerekir.
 * - Boş, "abc", "NaN", "Infinity", "0x10" ve sonucu sonlu olmayan girdiler ("1e999") → null.
 * - "-0" → 0 (negatif sıfır döndürülmez).
 */
export function parseNumber(text: string): number | null {
  if (typeof text !== "string") return null;
  const compact = text.replace(/\s+/g, "").replace(/−/g, "-");
  const match = NUMBER_SHAPE.exec(compact);
  if (!match) return null;
  const [, sign, mantissa, exponent] = match;
  if (!/\d/.test(mantissa)) return null;

  const hasDot = mantissa.indexOf(".") !== -1;
  const commaParts = mantissa.split(",");
  if (commaParts.length > 2) return null;

  let normalized: string;
  if (commaParts.length === 2) {
    const [intPart, fracPart] = commaParts;
    if (fracPart.indexOf(".") !== -1) return null;
    if (hasDot && !DOT_GROUPED.test(intPart)) return null;
    normalized = `${intPart.replace(/\./g, "")}.${fracPart}`;
  } else if (hasDot && mantissa.indexOf(".") !== mantissa.lastIndexOf(".")) {
    if (!DOT_GROUPED.test(mantissa)) return null;
    normalized = mantissa.replace(/\./g, "");
  } else {
    normalized = mantissa;
  }

  const result = Number(`${sign}${normalized}${exponent !== undefined ? `e${exponent}` : ""}`);
  if (!Number.isFinite(result)) return null;
  return result === 0 ? 0 : result;
}

// ---------------------------------------------------------------------------
// Sayı biçimlendirme
// ---------------------------------------------------------------------------

/** Ondalık basamak dizisi: değer = d₁,d₂d₃… × 10^exp. Boş `digits` sıfır demektir. */
interface Digits {
  digits: string;
  exp: number;
}

/** Pozitif sonlu sayının en kısa ondalık gösterimi (ör. 2.675 → "2675", exp 0). */
function decompose(abs: number): Digits {
  const [mantissa, exp] = abs.toExponential().split("e");
  return { digits: mantissa.replace(".", ""), exp: Number(exp) };
}

/**
 * İlk `keep` anlamlı basamağa yarım-yukarı yuvarlar (en kısa ondalık gösterim üzerinde, böylece
 * 2.675 → 2,68 olur). 9'ların eldesi üssü artırır (9,9996 → 10). Sondaki sıfırlar atılır.
 */
function roundDigits(d: Digits, keep: number): Digits {
  if (keep >= d.digits.length) return d;
  if (keep < 0) return { digits: "", exp: d.exp };
  const head = d.digits.slice(0, keep).split("");
  if (d.digits.charAt(keep) >= "5") {
    let i = head.length - 1;
    while (i >= 0 && head[i] === "9") {
      head[i] = "0";
      i--;
    }
    if (i < 0) return { digits: "1", exp: d.exp + 1 };
    head[i] = String(Number(head[i]) + 1);
  }
  return { digits: head.join("").replace(/0+$/, ""), exp: d.exp };
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

function superscript(n: number): string {
  return String(n)
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");
}

function clampInt(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)));
}

/**
 * Sayıyı Türkçe biçimde metne çevirir: ondalık virgül, binlik nokta ("1.234,5"). NaN/Infinity → "—".
 *
 * - Varsayılan: 4 anlamlı basamak (`significant`), sondaki gereksiz sıfırlar atılır (1,5 → "1,5").
 * - `decimals` verilirse sabit ondalık basamak (1,5 → "1,50"); `significant` yok sayılır.
 * - Yuvarlama ondalık yarım-yukarıdır ve sayının en kısa ondalık yazımına uygulanır (2,675 → "2,68").
 * - Yuvarlanmış değer |v| ≥ 1e9 ya da 0 < |v| < 1e-4 ise bilimsel gösterim: "1,5×10⁻⁶". Eşik iki
 *   modda da geçerlidir; `decimals` verilmişse mantise uygulanır (1e-6 → "1,00×10⁻⁶", "0,00" değil).
 * - Sıfıra yuvarlanan negatif değerler ve -0 işaretsiz yazılır ("0", "0,00").
 *
 * Gösterim içindir; çıktıyı giriş alanına geri yazmayın: parseNumber tek noktayı ondalık okur,
 * bu yüzden 1235 → "1.235" → 1,235 olur.
 */
export function formatNumber(value: number, options?: FormatOptions): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const decimals =
    options?.decimals !== undefined && Number.isFinite(options.decimals)
      ? clampInt(options.decimals, 0, 20)
      : undefined;
  const significant =
    options?.significant !== undefined && Number.isFinite(options.significant)
      ? clampInt(options.significant, 1, 21)
      : 4;

  if (value === 0) return decimals ? `0,${"0".repeat(decimals)}` : "0";

  const exact = decompose(Math.abs(value));
  let rounded: Digits;
  let scientific: boolean;
  if (decimals === undefined) {
    rounded = roundDigits(exact, significant);
    scientific = rounded.exp >= 9 || rounded.exp <= -5;
  } else {
    const plain = roundDigits(exact, exact.exp + 1 + decimals);
    // Küçük değerlerde sabit ondalık sıfıra yuvarlayacağından eşik yuvarlanmamış değere bakar.
    scientific = exact.exp <= -5 || (plain.digits !== "" && plain.exp >= 9);
    rounded = scientific ? roundDigits(exact, 1 + decimals) : plain;
  }

  const sign = value < 0 && rounded.digits !== "" ? "-" : "";

  if (scientific) {
    const mantissa = rounded.digits.padEnd(1 + (decimals ?? 0), "0");
    const frac = mantissa.slice(1);
    return `${sign}${mantissa.charAt(0)}${frac ? `,${frac}` : ""}×10${superscript(rounded.exp)}`;
  }

  let intPart: string;
  let fracPart: string;
  if (rounded.digits === "") {
    intPart = "0";
    fracPart = "";
  } else if (rounded.exp >= 0) {
    intPart = rounded.digits.slice(0, rounded.exp + 1).padEnd(rounded.exp + 1, "0");
    fracPart = rounded.digits.slice(rounded.exp + 1);
  } else {
    intPart = "0";
    fracPart = "0".repeat(-rounded.exp - 1) + rounded.digits;
  }
  fracPart = fracPart.padEnd(decimals ?? 0, "0");
  return `${sign}${groupThousands(intPart)}${fracPart ? `,${fracPart}` : ""}`;
}

/** Türkçe yazımda sayıdan önce gelen semboller: "%3,5", "‰2" */
const PREFIX_SYMBOLS = new Set(["%", "‰"]);
/** Sayıya bitişik yazılan semboller: "30°", "5′" */
const ATTACHED_SYMBOLS = new Set(["°", "′"]);

/**
 * Değer + birim sembolü, ör. "1,5 kV" (araya normal boşluk). İstisnalar:
 * - "%" ve "‰" Türkçe kurala göre sayıdan önce yazılır: "%3,5", "-%2".
 * - Açı derecesi ve dakikası bitişik yazılır: "30°".
 * - Sembolü "-" olan birimlerde (boyutsuz, kesir) yalnızca sayı yazılır.
 * - Değer NaN/Infinity ise yalnızca "—" döner. Bilinmeyen birimde hata fırlatır.
 */
export function formatQuantity(value: number, unitId: string, options?: FormatOptions): string {
  const { symbol } = getUnit(unitId);
  const num = formatNumber(value, options);
  if (num === "—" || symbol === "-") return num;
  if (PREFIX_SYMBOLS.has(symbol)) {
    return num.charAt(0) === "-" ? `-${symbol}${num.slice(1)}` : `${symbol}${num}`;
  }
  if (ATTACHED_SYMBOLS.has(symbol)) return `${num}${symbol}`;
  return `${num} ${symbol}`;
}
