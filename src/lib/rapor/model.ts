/**
 * Rapor modeli (saf; sunucu ve istemcide çalışır). İmza sözleşmedir; gövde Faz 2 işçisi C'nindir.
 */
import type { CalcDefinition, InputState, RunOptions } from "@/lib/calc/types";
import type { HesapRaporu } from "./types";

/**
 * Bir hesabın rapor modelini üretir: görünür girdiler (biçimlenmiş, birimli), formüller, ara adımlar,
 * çıktılar (options.outputUnits / tercihlerle), kontroller ve referanslar.
 */
export function hesapRaporuOlustur(
  def: CalcDefinition,
  state: InputState,
  options?: RunOptions & { kayitAdi?: string; notlar?: string | null },
): HesapRaporu {
  throw new Error(`rapor.hesapRaporuOlustur(${def.slug}, ${Object.keys(state).length}, ${options?.kayitAdi}): henüz uygulanmadı (Faz 2 işçisi C)`);
}
