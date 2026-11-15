/**
 * Kayıtlı durumla hesap sayfasındaki güncel durumun karşılaştırılması ("kaydedilmemiş değişiklik" göstergesi).
 * Saf; istemcide çalışır.
 *
 * İki taraf da kanonik biçime getirilir: tanımın varsayılanlarıyla tamamlanır (sayfa kayıtlı durumu böyle açar)
 * ve girdileriSuz'dan geçirilir. Anahtar sırası önemsizdir: jsonb anahtarları yeniden sıralar ve
 * setNumberValue/setNumberUnit girdileri farklı alan sırasıyla kurar.
 */
import { defaultState } from "@/lib/calc/engine";
import type { CalcDefinition, InputState } from "@/lib/calc/types";
import { ciktiBirimleriniSuz, girdileriSuz } from "./dogrulama";

/** Varsayılanlarla tamamlanmış ve süzülmüş girdi durumu */
export function kanonikGirdiler(def: CalcDefinition, girdiler: InputState): InputState {
  return girdileriSuz(def, { ...defaultState(def), ...girdiler });
}

function girdilerEsit(a: InputState, b: InputState): boolean {
  const anahtarlar = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of anahtarlar) {
    const x = a[key];
    const y = b[key];
    if (!x || !y) return false;
    if (x.value !== y.value || x.unit !== y.unit) return false;
  }
  return true;
}

function birimlerEsit(a: Record<string, string>, b: Record<string, string>): boolean {
  const anahtarlar = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of anahtarlar) if (a[key] !== b[key]) return false;
  return true;
}

/** Güncel girdiler/çıktı birimleri kayıtlı olanlardan farklı mı? */
export function kaydedilmemisDegisiklikVar(
  def: CalcDefinition,
  kayitli: { girdiler: InputState; ciktiBirimleri: Record<string, string> },
  guncel: { state: InputState; outputUnits: Record<string, string> },
): boolean {
  if (!girdilerEsit(kanonikGirdiler(def, kayitli.girdiler), kanonikGirdiler(def, guncel.state))) return true;
  return !birimlerEsit(ciktiBirimleriniSuz(def, kayitli.ciktiBirimleri), ciktiBirimleriniSuz(def, guncel.outputUnits));
}
