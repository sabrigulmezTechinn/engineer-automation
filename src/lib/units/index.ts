/**
 * Birim sistemi genel API'si. İmzalar sözleşmedir; gövdeler W1 tarafından doldurulur.
 * Sunucu ve istemcide çalışır: Node veya tarayıcıya özgü bir şey içe aktarılmaz.
 */
import type { Dimension, FormatOptions, UnitDef } from "./types";

export type { Dimension, FormatOptions, UnitDef } from "./types";

const TODO = (name: string): never => {
  throw new Error(`units.${name}: henüz uygulanmadı (W1)`);
};

/** Kimliğe göre birim; bilinmeyen kimlikte hata fırlatır. */
export function getUnit(id: string): UnitDef {
  return TODO(`getUnit(${id})`);
}

/** Bir boyutun tüm birimleri, gösterim sırasıyla. */
export function unitsFor(dimension: Dimension): UnitDef[] {
  return TODO(`unitsFor(${dimension})`);
}

/** Bir boyutun SI birimi (factor 1, offset 0). */
export function siUnit(dimension: Dimension): UnitDef {
  return TODO(`siUnit(${dimension})`);
}

/** Verilen birimdeki değeri SI'ya çevirir. */
export function toSI(value: number, unitId: string): number {
  return TODO(`toSI(${value}, ${unitId})`);
}

/** SI değerini verilen birime çevirir. */
export function fromSI(valueSI: number, unitId: string): number {
  return TODO(`fromSI(${valueSI}, ${unitId})`);
}

/** İki birim arasında çevirir; boyutlar farklıysa hata fırlatır. */
export function convert(value: number, fromUnitId: string, toUnitId: string): number {
  return TODO(`convert(${value}, ${fromUnitId}, ${toUnitId})`);
}

/**
 * Kullanıcı girdisini sayıya çevirir. Türkçe ondalık virgülü ("1,5") ve noktayı ("1.5") kabul eder,
 * baştaki/sondaki boşlukları yok sayar, bilimsel gösterimi ("1,5e-3") destekler.
 * Geçersiz veya boş girdide null döner.
 */
export function parseNumber(text: string): number | null {
  return TODO(`parseNumber(${text})`);
}

/** Sayıyı Türkçe biçimde (ondalık virgül) metne çevirir. NaN/Infinity için "—" döner. */
export function formatNumber(value: number, options?: FormatOptions): string {
  return TODO(`formatNumber(${value}, ${JSON.stringify(options)})`);
}

/** Değer + birim sembolü, ör. "1,5 kV". */
export function formatQuantity(value: number, unitId: string, options?: FormatOptions): string {
  return TODO(`formatQuantity(${value}, ${unitId}, ${JSON.stringify(options)})`);
}
