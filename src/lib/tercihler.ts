/**
 * Kullanıcı tercihlerinin (profil, KAPSAM §3.1) hesap motoru seçeneklerine çevrilmesi.
 * Saf; sunucu ve istemcide çalışır.
 */
import type { RunOptions } from "@/lib/calc/types";
import type { Dimension } from "@/lib/units/types";

export type BirimSistemi = "si" | "imperial";

export interface KullaniciTercihleri {
  /** Profildeki "anlamlı basamak" (veritabanında `decimals` sütunu) */
  anlamliBasamak: number;
  birimSistemi: BirimSistemi;
}

/**
 * İmperial tercihinde çıktılar için öncelikli birimler. Yalnızca karşılığı açık olan boyutlar:
 * uzunluk (inç mi fit mi), kütle, debi gibi bağlama göre değişenler bilerek yok; onlar SI/otomatik kalır.
 * Bir hesap çıktısının izinli birimleri arasında yoksa yok sayılır (engine.displayUnit).
 */
export const IMPERIAL_BIRIMLER: Partial<Record<Dimension, string>> = {
  guc: "hp",
  tork: "lbfft",
  basinc: "psi",
  sicaklik: "degF",
  sicaklik_farki: "deltaDegF",
};

/** Tercihleri runCalc seçeneklerine çevirir. */
export function runSecenekleri(t: KullaniciTercihleri | null | undefined): Pick<RunOptions, "significant" | "preferredUnits"> {
  if (!t) return {};
  return {
    significant: t.anlamliBasamak,
    ...(t.birimSistemi === "imperial" ? { preferredUnits: IMPERIAL_BIRIMLER } : {}),
  };
}
