/**
 * Karşılaştırma hesapları (saf; sunucu ve istemcide çalışır). İmzalar sözleşmedir; gövdeler Faz 2 işçisi B'nindir.
 */
import type { CalcDefinition, RunOptions } from "@/lib/calc/types";
import type { Karsilastirma, Senaryo, TaramaAyari, TaramaSerisi } from "./types";

export type { Karsilastirma, KarsilastirmaSatiri, Senaryo, SenaryoDurumu, TaramaAyari, TaramaNoktasi, TaramaSerisi } from "./types";

const TODO = (name: string): never => {
  throw new Error(`karsilastirma.${name}: henüz uygulanmadı (Faz 2 işçisi B)`);
};

/**
 * Senaryoları aynı tanımla çalıştırıp satır satır karşılaştırma tablosu üretir. Satır başına ortak birim:
 * kullanıcının `options.outputUnits` seçimi, yoksa tercih edilen birim, yoksa senaryoların değerlerine göre
 * tek bir otomatik birim. Girdi satırlarında senaryoların yazdığı metin ve birimi değil, ortak birime
 * çevrilmiş değer gösterilir.
 */
export function karsilastirmaOlustur(def: CalcDefinition, senaryolar: Senaryo[], options?: RunOptions): Karsilastirma {
  return TODO(`karsilastirmaOlustur(${def.slug}, ${senaryolar.length}, ${JSON.stringify(options?.outputUnits)})`);
}

/** Temel durumdan başlayıp bir girdiyi aralıkta değiştirerek bir çıktının serisini üretir. */
export function taramaYap(def: CalcDefinition, temel: Senaryo, ayar: TaramaAyari, options?: RunOptions): TaramaSerisi {
  return TODO(`taramaYap(${def.slug}, ${temel.id}, ${ayar.girdiKey} → ${ayar.ciktiKey}, ${options?.significant})`);
}
