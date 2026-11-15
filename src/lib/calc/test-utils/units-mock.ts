/**
 * Testler için küçük sahte birim sistemi (`@/lib/units` yerine).
 *
 * Kullanım (yol takma adla verilmeli; göreli yol alt klasörlerden kırılır):
 *   vi.mock("@/lib/units", () => import("@/lib/calc/test-utils/units-mock"));
 *
 * Gerçek birim sistemi (W1) birleşene kadar motor ve hesap testleri bununla çalışır.
 * Biçimlendirme gerçeğine benzetilmiştir ama aynısı değildir: testler biçim ayrıntısına
 * (bilimsel gösterim eşiği, boşluk karakteri) bağlanmamalıdır.
 */
import type { Dimension, FormatOptions, UnitDef } from "@/lib/units/types";

const UNITS: UnitDef[] = [
  { id: "V", symbol: "V", name: "volt", dimension: "gerilim", factor: 1 },
  { id: "kV", symbol: "kV", name: "kilovolt", dimension: "gerilim", factor: 1e3 },
  { id: "mV", symbol: "mV", name: "milivolt", dimension: "gerilim", factor: 1e-3 },
  { id: "A", symbol: "A", name: "amper", dimension: "akim", factor: 1 },
  { id: "mA", symbol: "mA", name: "miliamper", dimension: "akim", factor: 1e-3 },
  { id: "ohm", symbol: "Ω", name: "ohm", dimension: "direnc", factor: 1 },
  { id: "kohm", symbol: "kΩ", name: "kiloohm", dimension: "direnc", factor: 1e3 },
  { id: "W", symbol: "W", name: "vat", dimension: "guc", factor: 1 },
  { id: "kW", symbol: "kW", name: "kilovat", dimension: "guc", factor: 1e3 },
  { id: "F", symbol: "F", name: "farad", dimension: "kapasitans", factor: 1 },
  { id: "uF", symbol: "µF", name: "mikrofarad", dimension: "kapasitans", factor: 1e-6 },
  { id: "m2", symbol: "m²", name: "metrekare", dimension: "alan", factor: 1 },
  { id: "mm2", symbol: "mm²", name: "milimetrekare", dimension: "alan", factor: 1e-6 },
  { id: "K", symbol: "K", name: "kelvin", dimension: "sicaklik", factor: 1 },
  { id: "degC", symbol: "°C", name: "santigrat derece", dimension: "sicaklik", factor: 1, offset: 273.15 },
  { id: "rad", symbol: "rad", name: "radyan", dimension: "aci", factor: 1 },
  { id: "deg", symbol: "°", name: "derece", dimension: "aci", factor: Math.PI / 180 },
  { id: "kesir", symbol: "-", name: "kesir", dimension: "oran", factor: 1 },
  { id: "yuzde", symbol: "%", name: "yüzde", dimension: "oran", factor: 0.01 },
  { id: "binde", symbol: "‰", name: "binde", dimension: "oran", factor: 0.001 },
  { id: "adet", symbol: "", name: "adet", dimension: "boyutsuz", factor: 1 },
  { id: "rad_s", symbol: "rad/s", name: "radyan/saniye", dimension: "acisal_hiz", factor: 1 },
  { id: "rpm", symbol: "dev/dk", name: "devir/dakika", dimension: "acisal_hiz", factor: (2 * Math.PI) / 60 },
  { id: "ohm_m", symbol: "Ω·m", name: "ohm metre", dimension: "ozdirenc", factor: 1 },
  { id: "W_m2K", symbol: "W/(m²·K)", name: "vat/(metrekare·kelvin)", dimension: "isi_transfer_katsayisi", factor: 1 },
  { id: "s", symbol: "s", name: "saniye", dimension: "zaman", factor: 1 },
  { id: "sa", symbol: "sa", name: "saat", dimension: "zaman", factor: 3600 },
];

const BY_ID = new Map(UNITS.map((u) => [u.id, u]));

export function getUnit(id: string): UnitDef {
  const u = BY_ID.get(id);
  if (!u) throw new Error(`mock: bilinmeyen birim "${id}"`);
  return u;
}

export function unitsFor(dimension: Dimension): UnitDef[] {
  return UNITS.filter((u) => u.dimension === dimension);
}

export function siUnit(dimension: Dimension): UnitDef {
  const u = UNITS.find((x) => x.dimension === dimension && x.factor === 1 && !x.offset);
  if (!u) throw new Error(`mock: "${dimension}" için SI birimi yok`);
  return u;
}

export function toSI(value: number, unitId: string): number {
  const u = getUnit(unitId);
  return value * u.factor + (u.offset ?? 0);
}

export function fromSI(valueSI: number, unitId: string): number {
  const u = getUnit(unitId);
  return (valueSI - (u.offset ?? 0)) / u.factor;
}

export function convert(value: number, fromUnitId: string, toUnitId: string): number {
  if (getUnit(fromUnitId).dimension !== getUnit(toUnitId).dimension) {
    throw new Error("mock: boyutlar farklı");
  }
  return fromSI(toSI(value, fromUnitId), toUnitId);
}

export function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
  return Number(t);
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
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
};

/** Türkçe biçim; |x| < 1e-3 veya |x| ≥ 1e9 için "1,5×10⁻⁶" bilimsel gösterimi. */
export function formatNumber(value: number, options?: FormatOptions): string {
  if (!Number.isFinite(value)) return "—";
  if (options?.decimals !== undefined) return value.toFixed(options.decimals).replace(".", ",");
  const sig = options?.significant ?? 4;
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs < 1e-3 || abs >= 1e9) {
    const [m, e] = value.toExponential(sig - 1).split("e");
    const mant = String(Number(m)).replace(".", ",");
    const exp = String(Number(e))
      .split("")
      .map((c) => SUPERSCRIPT[c] ?? c)
      .join("");
    return `${mant}×10${exp}`;
  }
  return String(Number(value.toPrecision(sig))).replace(".", ",");
}

/** Sembolsüz ("" veya "-"), önde (%), bitişik (°) ve boşluklu yerleşim. */
export function formatQuantity(value: number, unitId: string, options?: FormatOptions): string {
  const sym = getUnit(unitId).symbol;
  const num = formatNumber(value, options);
  if (num === "—" || sym === "" || sym === "-") return num;
  if (sym === "%" || sym === "‰") return num.startsWith("-") ? `-${sym}${num.slice(1)}` : `${sym}${num}`;
  if (sym === "°" || sym === "′") return `${num}${sym}`;
  return `${num} ${sym}`;
}

// Derleme zamanı denetimi: sağlanan her fonksiyon gerçek API'deki imzayla aynı olmalı.
// Partial: gerçek modül yeni yardımcılar dışa açtığında bu dosya derlemeyi bozmasın.
void ({
  getUnit,
  unitsFor,
  siUnit,
  toSI,
  fromSI,
  convert,
  parseNumber,
  formatNumber,
  formatQuantity,
} satisfies Partial<typeof import("@/lib/units")>);
