/**
 * PDF raporlarının sabit metinleri (saf). Sorumluluk reddi ve telif notu sitedekiyle aynıdır:
 * kısa sürüm ve telif notu doğrudan `src/components/disclaimer.tsx`'ten gelir; tam sürüm hesap sayfasındaki
 * `DisclaimerBox` paragrafının aynısıdır (metinler.test.ts eşitliği denetler).
 */
import type { CheckLevel } from "@/lib/calc/types";
import { KISA_SORUMLULUK_REDDI, TELIF_NOTU } from "@/components/disclaimer";

export { KISA_SORUMLULUK_REDDI, TELIF_NOTU };

/** Site başlığındaki ad (src/components/site/site-header.tsx `SITE_NAME`) */
export const PLATFORM_ADI = "Mühendislik Hesapları";

/** Tam sorumluluk reddi: hesap sayfasındaki `DisclaimerBox` paragrafı */
export const TAM_SORUMLULUK_REDDI =
  "Bu hesap, girdiğiniz değerlere ve gösterilen formüllere dayanan bir ön hesaptır; mühendislik kararının, proje tasarımının veya yetkili bir mühendisin onayının yerine geçmez. Sonuçları ilgili standart, yönetmelik ve üretici verileriyle doğrulayın. Hesap sonuçlarının kullanımından doğabilecek zararlardan platform sorumlu tutulamaz.";

/** Kontrol seviyelerinin etiketleri (hesap sayfasındaki durum listesiyle aynı) */
export const SEVIYE_ETIKETI: Record<CheckLevel, string> = {
  ok: "Uygun",
  bilgi: "Bilgi",
  uyari: "Uyarı",
  hata: "Hata",
};

export const RAPOR_TURU = {
  hesap: "Hesap raporu",
  proje: "Proje raporu",
  karsilastirma: "Karşılaştırma raporu",
} as const;

const TARIH_BICIMI = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO tarih-saati Türkçe ve İstanbul saatiyle yazar: "15 Kasım 2026 17:24". Geçersizse metni olduğu gibi döner. */
export function tarihBicimle(iso: string): string {
  const tarih = new Date(iso);
  if (Number.isNaN(tarih.getTime())) return iso;
  return TARIH_BICIMI.format(tarih);
}
