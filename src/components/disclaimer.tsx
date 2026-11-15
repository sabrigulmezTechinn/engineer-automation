import { cx } from "@/components/ui/cx";

/** Kısa sorumluluk reddi (KAPSAM §5.2); alt bilgide ve rapor gibi dar alanlarda kullanılır. */
export const KISA_SORUMLULUK_REDDI =
  "Hesaplar bilgi amaçlıdır ve mühendislik kararının yerine geçmez. Sonuçları ilgili standart, yönetmelik ve üretici verileriyle doğrulamak kullanıcının sorumluluğundadır.";

/** Standart telif notu (KAPSAM §5.1). */
export const TELIF_NOTU =
  "Standart adları ve madde numaraları yalnızca referans için verilmiştir. Standart metinleri ve tabloları IEC, ISO, TSE gibi yayıncı kuruluşların telif hakkı altındadır ve bu sitede birebir yayımlanmaz.";

/** Hesap sayfasının sonundaki sorumluluk reddi kutusu. */
export function DisclaimerBox({ className }: { className?: string }) {
  return (
    <aside
      aria-labelledby="sorumluluk-reddi-baslik"
      className={cx("rounded-lg border border-uyari-line bg-uyari-bg px-4 py-3 text-sm", className)}
    >
      <h2 id="sorumluluk-reddi-baslik" className="font-semibold text-uyari">
        Sorumluluk reddi
      </h2>
      <p className="mt-1 text-fg/85">
        Bu hesap, girdiğiniz değerlere ve gösterilen formüllere dayanan bir ön hesaptır; mühendislik
        kararının, proje tasarımının veya yetkili bir mühendisin onayının yerine geçmez. Sonuçları
        ilgili standart, yönetmelik ve üretici verileriyle doğrulayın. Hesap sonuçlarının kullanımından
        doğabilecek zararlardan platform sorumlu tutulamaz.
      </p>
      <p className="mt-2 text-xs text-muted">{TELIF_NOTU}</p>
    </aside>
  );
}
