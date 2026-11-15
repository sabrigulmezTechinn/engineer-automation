/**
 * Hesap motoru genel API'si. İmzalar sözleşmedir; gövdeler W2 tarafından doldurulur.
 * Sunucu ve istemcide çalışır.
 */
import type { CalcContext, CalcDefinition, InputState, RunResult } from "./types";

const TODO = (name: string): never => {
  throw new Error(`calc.${name}: henüz uygulanmadı (W2)`);
};

/** Varsayılan bağlam: src/config/sinirlar.ts'teki LIMITS */
export function defaultContext(): CalcContext {
  return TODO("defaultContext");
}

/** Tanımdaki varsayılanlardan başlangıç girdi durumu */
export function defaultState(def: CalcDefinition): InputState {
  return TODO(`defaultState(${def.id})`);
}

/**
 * Girdi durumunu doğrular, SI'ya çevirir, compute'u çalıştırır ve çıktıları gösterime hazırlar.
 * Hiçbir zaman fırlatmaz: hatalar RunResult içinde döner (compute'un fırlattığı hata da dahil).
 * `outputUnits` ile çıktı başına gösterim birimi seçilebilir (anahtar: output key).
 */
export function runCalc(
  def: CalcDefinition,
  state: InputState,
  options?: { ctx?: CalcContext; outputUnits?: Record<string, string> },
): RunResult {
  return TODO(`runCalc(${def.id}, ${JSON.stringify(state)}, ${JSON.stringify(options?.outputUnits)})`);
}
