/**
 * Kaydedilecek/raporlanacak girdi durumunun hesap tanımına göre süzülmesi (saf; sunucu ve istemcide çalışır).
 * İmzalar sözleşmedir; gövdeler Faz 2 işçisi A tarafından doldurulur.
 *
 * Kurallar: yalnızca tanımdaki girdi anahtarları kalır; değerler metin (en çok 1000 karakter); birimler yalnızca
 * o girdinin izinli birimlerinden; select değerleri yalnızca seçenekler arasından. Geçersiz parçalar atılır
 * (hata fırlatılmaz) — yüklendiğinde eksikler tanımın varsayılanlarıyla tamamlanır.
 *
 * Kararlar:
 * - Birimi izinli olmayan sayı girdisinin YALNIZCA birimi değil tüm girdisi atılır: değerin anlamı birime bağlıdır
 *   (ör. "5" kV, birim atılsaydı yüklemede varsayılan birimle "5 V" olurdu).
 * - 1000 karakterden uzun değer kırpılmaz, atılır (kırpılmış sayı metni başka bir değer olurdu).
 * - Birimi hiç yazılmamış sayı girdisi motorda olduğu gibi varsayılan birimle tamamlanır (kanonik biçim).
 * - Select girdisinde `unit` alanı saklanmaz.
 * - Gelen nesnenin anahtarları değil tanımın girdileri dolaşılır; `__proto__` gibi anahtarlar sonuca giremez.
 */
import type { CalcDefinition, InputSpec, InputState, OutputSpec } from "@/lib/calc/types";
import { unitsFor } from "@/lib/units";

/** Saklanan bir girdi değerinin en çok uzunluğu (karakter) */
export const GIRDI_DEGER_MAX = 1000;

function nesneMi(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Nesnenin kendi alanı (prototip zincirinden gelenler sayılmaz) */
function kendiAlani(obj: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

function izinliBirimler(spec: Exclude<InputSpec, { kind: "select" }> | OutputSpec): string[] {
  if (spec.units) return spec.units;
  try {
    return unitsFor(spec.dimension).map((u) => u.id);
  } catch {
    return []; // bilinmeyen boyut: hiçbir birim kabul edilmez
  }
}

export function girdileriSuz(def: CalcDefinition, girdiler: unknown): InputState {
  const sonuc: InputState = {};
  if (!nesneMi(girdiler)) return sonuc;

  for (const spec of def.inputs) {
    const giris = kendiAlani(girdiler, spec.key);
    if (!nesneMi(giris)) continue;
    const value = kendiAlani(giris, "value");
    if (typeof value !== "string" || value.length > GIRDI_DEGER_MAX) continue;

    if (spec.kind === "select") {
      if (spec.options.some((o) => o.value === value)) sonuc[spec.key] = { value };
      continue;
    }

    const unit = kendiAlani(giris, "unit");
    if (unit === undefined) {
      sonuc[spec.key] = { value, unit: spec.defaultUnit };
    } else if (typeof unit === "string" && izinliBirimler(spec).includes(unit)) {
      sonuc[spec.key] = { value, unit };
    }
  }
  return sonuc;
}

export function ciktiBirimleriniSuz(def: CalcDefinition, birimler: unknown): Record<string, string> {
  const sonuc: Record<string, string> = {};
  if (!nesneMi(birimler)) return sonuc;

  for (const spec of def.outputs) {
    const unit = kendiAlani(birimler, spec.key);
    if (typeof unit === "string" && izinliBirimler(spec).includes(unit)) sonuc[spec.key] = unit;
  }
  return sonuc;
}
