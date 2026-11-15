/**
 * Giriş sonrası yönlendirme yardımcıları (saf fonksiyonlar; sunucu ve proxy'de kullanılır).
 */

/** Varsayılan giriş sonrası hedef */
export const DEFAULT_AFTER_LOGIN = "/";

/**
 * `yonlendir` parametresini yalnızca aynı sitedeki bir yola izin verecek şekilde doğrular
 * (açık yönlendirme / open redirect saldırısına karşı). Geçersizse `null` döner.
 *
 * Kabul: "/" ile başlayan yol. Ret: "//evil.com", "/\\evil.com", "https://...", kontrol karakterleri.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const yol = value.trim();
  if (!yol.startsWith("/")) return null;
  if (yol.startsWith("//") || yol.startsWith("/\\")) return null;
  // Tarayıcılar sekme/satır sonu karakterlerini yoksayar: "/\t/evil.com" → "//evil.com"
  if (/[\u0000-\u001f\u007f\\]/.test(yol)) return null;
  try {
    // Göreli yolu sahte bir kökle çözümleyip kökün değişmediğini doğrula.
    const kok = "http://yerel.invalid";
    const url = new URL(yol, kok);
    if (url.origin !== kok) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Giriş sayfasının adresi; giriş sonrası `hedef` yoluna dönülür. Ör. /giris?yonlendir=/profil */
export function loginPath(hedef?: string | null): string {
  const yol = safeRedirectPath(hedef);
  if (!yol || yol === DEFAULT_AFTER_LOGIN) return "/giris";
  // "/" karakterlerini kodlamadan bırak: /giris?yonlendir=/profil (okunaklı ve geçerli bir sorgu değeri).
  return `/giris?yonlendir=${encodeURIComponent(yol).replace(/%2F/gi, "/")}`;
}
