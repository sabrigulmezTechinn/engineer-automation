/**
 * Ara adım (Step) LaTeX'i için yardımcılar. Çıktı KaTeX ile gösterilir.
 *
 * Sayılar birim sisteminin `formatNumber` biçimiyle (Türkçe, ondalık virgül) yazılır,
 * sonra LaTeX'e uyarlanır. Birim sembolleri dik yazılır: `\mathrm{kV}`, `\mathrm{k}\Omega`.
 */
import { MONEY_FORMAT, formatNumber, fromSI, getUnit, siUnit } from "@/lib/units";
import { autoOutputUnit } from "./auto-unit";
import type { Dimension, FormatOptions } from "@/lib/units";

const SUPERSCRIPT_TO_ASCII: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
  "⁺": "+",
};

const SUPERSCRIPT_CHARS = Object.keys(SUPERSCRIPT_TO_ASCII).join("");

function fromSuperscript(text: string): string {
  return text
    .split("")
    .map((c) => SUPERSCRIPT_TO_ASCII[c] ?? c)
    .join("");
}

/** "1,5" → "1{,}5"; binlik boşlukları (nbsp, ince boşluk dahil) → "\,"; Unicode eksi → "-". */
function mantissaToLatex(text: string): string {
  return text
    .replace(/[−‒–]/g, "-")
    .replace(/,/g, "{,}")
    .replace(/[\s   ]+/g, "\\,");
}

// "1,5×10⁻⁶", "1,5 · 10^-6", "1,5x10^{−6}", "×10⁶" gibi üslü gösterimler
const POWER_OF_TEN = new RegExp(
  `^(.*?)\\s*[×x·⋅*]?\\s*10\\s*\\^?\\s*\\{?\\s*([⁻⁺+\\-\\u2212]?)\\s*([${SUPERSCRIPT_CHARS}0-9]+)\\s*\\}?$`,
);
// "1,5e-6", "1,5E+6"
const E_NOTATION = /^(.+?)[eE]([+\-−]?)(\d+)$/;

/**
 * `formatNumber` çıktısını (veya benzeri Türkçe sayı metnini) LaTeX'e çevirir.
 * Ör. "1,5" → "1{,}5", "1,5×10⁻⁶" → "1{,}5 \times 10^{-6}", "—" → "\text{—}".
 */
export function numberTextToLatex(text: string): string {
  const t = text.trim();
  if (t === "") return "";
  if (/^[—–-]$/.test(t) || /^[+-]?(NaN|Infinity|∞)$/i.test(t)) return "\\text{—}";

  let mantissa = t;
  let exponent: string | null = null;

  const e = E_NOTATION.exec(t);
  const p = e ? null : POWER_OF_TEN.exec(t);
  // "10" tek başına üs değildir; üs kısmı ya üst simge ya da "^" ile gelmeli.
  const isPower = p !== null && (/[×x·⋅*^]/.test(t) || /[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(t));
  if (e) {
    mantissa = e[1];
    exponent = (e[2] === "+" ? "" : e[2] ? "-" : "") + String(Number(e[3]));
  } else if (p && isPower) {
    mantissa = p[1];
    const sign = fromSuperscript(p[2]).replace("−", "-");
    exponent = (sign === "-" ? "-" : "") + String(Number(fromSuperscript(p[3])));
  }

  if (exponent === null) return mantissaToLatex(t);
  const m = mantissaToLatex(mantissa.trim());
  const power = `10^{${exponent}}`;
  if (m === "") return power;
  return `${m} \\times ${power}`;
}

/** Sayıyı Türkçe biçimde LaTeX'e çevirir: 1.5 → "1{,}5", 1.5e-6 → "1{,}5 \times 10^{-6}" (biçim birim sistemine bağlı). */
export function latexNum(value: number, options?: FormatOptions): string {
  return numberTextToLatex(formatNumber(value, options));
}

const GREEK: Record<string, string> = {
  "µ": "\\mu", // mikro işareti
  "μ": "\\mu", // Yunan mü
  "Ω": "\\Omega", // Yunan omega
  "Ω": "\\Omega", // ohm işareti
};

const SPECIAL: Record<string, string> = {
  "·": "\\cdot ",
  "⋅": "\\cdot ",
  "×": "\\times ",
  "/": "/",
  "(": "(",
  ")": ")",
  "-": "-",
  "%": "\\%",
  // KaTeX'te binde işareti yok; yaklaşık gösterim
  "‰": "{\\%_0}",
  "′": "^{\\prime}",
  "″": "^{\\prime\\prime}",
};

/**
 * Birim sembolünü LaTeX'e çevirir: "kV" → "\mathrm{kV}", "kΩ" → "\mathrm{k}\Omega",
 * "µF" → "\mu\mathrm{F}", "mm²" → "\mathrm{mm}^2", "°C" → "{}^\circ\mathrm{C}", "%" → "\%".
 */
export function latexUnitSymbol(symbol: string): string {
  let out = "";
  let word = "";
  const flushWord = () => {
    if (!word) return;
    // ASCII dışı harfler (ş, ğ, ı...) KaTeX'in matematik kipinde desteklenmez; metin kipine alınır.
    out += /^[A-Za-z0-9.]+$/.test(word) ? `\\mathrm{${word}}` : `\\text{${word}}`;
    word = "";
  };

  const chars = Array.from(symbol);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c in SUPERSCRIPT_TO_ASCII) {
      flushWord();
      let sup = "";
      while (i < chars.length && chars[i] in SUPERSCRIPT_TO_ASCII) {
        sup += SUPERSCRIPT_TO_ASCII[chars[i]];
        i++;
      }
      i--;
      out += sup.length === 1 ? `^${sup}` : `^{${sup}}`;
    } else if (c === "°") {
      flushWord();
      // Tabanı olmayan üst simge için boş taban: "°C" → "{}^\circ\mathrm{C}"
      out += out === "" ? "{}^\\circ" : "^\\circ";
    } else if (c in GREEK) {
      flushWord();
      out += GREEK[c];
    } else if (c in SPECIAL) {
      flushWord();
      out += SPECIAL[c];
    } else if (/\s/.test(c)) {
      flushWord();
      out += "\\,";
    } else if (/[\p{L}\p{N}.]/u.test(c)) {
      word += c;
    } else {
      flushWord();
      out += `\\text{${c}}`;
    }
  }
  flushWord();
  return out.trimEnd();
}

// Yerleşim kuralları birim sisteminin formatQuantity'siyle aynıdır, böylece sonuç ve adım tutarlı görünür.
/** Sembolsüz birimler: boş veya "-" (boyutsuz/kesir) */
const NO_SYMBOLS = new Set(["", "-"]);
/** Türkçe yazımda sayının önüne gelen semboller: %50 */
const PREFIX_SYMBOLS = new Set(["%", "‰"]);
/** Sayıya bitişik yazılan semboller (düzlem açı): 45° */
const ATTACHED_SYMBOLS = new Set(["°", "′", "″"]);

/** Birim kimliğinin LaTeX sembolü, ör. "kohm" → "\mathrm{k}\Omega". */
export function latexUnit(unitId: string): string {
  return latexUnitSymbol(getUnit(unitId).symbol);
}

/**
 * SI değeri verilen birime çevirip LaTeX'te değer + birim olarak yazar.
 * Ör. latexQty(1500, "kV") → "1{,}5\,\mathrm{kV}", yüzde → "\%50", açı → "45^\circ".
 */
export function latexQty(valueSI: number, unitId: string, options?: FormatOptions): string {
  const { symbol, dimension } = getUnit(unitId);
  const num = latexNum(fromSI(valueSI, unitId), options ?? (dimension === "para" ? MONEY_FORMAT : undefined));
  if (NO_SYMBOLS.has(symbol)) return num;
  const unit = latexUnitSymbol(symbol);
  if (PREFIX_SYMBOLS.has(symbol)) {
    return num.startsWith("-") ? `-${unit}${num.slice(1)}` : `${unit}${num}`;
  }
  if (ATTACHED_SYMBOLS.has(symbol)) {
    // Sayı tabanı varsa boş tabana gerek yok: "45^\circ". Üslü sayıda çift üst simgeyi önlemek için kalır.
    return num.includes("^") ? `${num}${unit}` : `${num}${unit.replace(/^\{\}/, "")}`;
  }
  return `${num}\\,${unit}`;
}

/** SI değeri boyutun SI birimiyle yazar; birim kimliğini sabitlemeden adım üretmek için. */
export function latexSI(valueSI: number, dimension: Dimension, options?: FormatOptions): string {
  return latexQty(valueSI, siUnit(dimension).id, options);
}

/**
 * SI değeri, çıktı kartlarıyla aynı kuralla otomatik seçilen birimde yazar (0,005455 A → 5,455 mA).
 * Otomatik seçimin kapalı olduğu boyutlarda (mekanik büyüklükler) SI birimiyle yazar.
 */
export function latexAuto(valueSI: number, dimension: Dimension, options?: FormatOptions): string {
  return latexQty(valueSI, autoOutputUnit({ dimension, defaultUnit: siUnit(dimension).id }, valueSI), options);
}

/** latexAuto'nun işlem içi hali: negatif değer parantezlenir. */
export function latexAutoOperand(valueSI: number, dimension: Dimension, options?: FormatOptions): string {
  const s = latexAuto(valueSI, dimension, options);
  return valueSI < 0 ? `(${s})` : s;
}

/** Negatif değerler işlem içinde parantezlenir: (-2\,\mathrm{A}). */
export function latexOperand(valueSI: number, dimension: Dimension, options?: FormatOptions): string {
  const s = latexSI(valueSI, dimension, options);
  return valueSI < 0 ? `(${s})` : s;
}
