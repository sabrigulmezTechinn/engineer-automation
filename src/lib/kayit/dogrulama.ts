/**
 * Kaydedilecek/raporlanacak girdi durumunun hesap tanımına göre süzülmesi (saf; sunucu ve istemcide çalışır).
 * İmzalar sözleşmedir; gövdeler Faz 2 işçisi A tarafından doldurulur.
 *
 * Kurallar: yalnızca tanımdaki girdi anahtarları kalır; değerler metin (en çok 1000 karakter); birimler yalnızca
 * o girdinin izinli birimlerinden; select değerleri yalnızca seçenekler arasından. Geçersiz parçalar atılır
 * (hata fırlatılmaz) — yüklendiğinde eksikler tanımın varsayılanlarıyla tamamlanır.
 */
import type { CalcDefinition, InputState } from "@/lib/calc/types";

const TODO = (name: string): never => {
  throw new Error(`kayit.${name}: henüz uygulanmadı (Faz 2 işçisi A)`);
};

export function girdileriSuz(def: CalcDefinition, girdiler: unknown): InputState {
  return TODO(`girdileriSuz(${def.slug}, ${typeof girdiler})`);
}

export function ciktiBirimleriniSuz(def: CalcDefinition, birimler: unknown): Record<string, string> {
  return TODO(`ciktiBirimleriniSuz(${def.slug}, ${typeof birimler})`);
}
