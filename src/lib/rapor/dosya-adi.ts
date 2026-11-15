/**
 * PDF dosya adları (saf; sunucu ve istemcide çalışır). `Content-Disposition` başlığında ASCII `filename`
 * ve RFC 5987/6266 `filename*=UTF-8''…` birlikte verilir; istemci indirirken önce `filename*`'ı okur.
 */

const TR_ASCII: Record<string, string> = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

/** Dosya adının en çok uzunluğu (uzantısız) */
const AD_MAX = 80;

/** Görünen ad: denetim karakterleri ve dosya sistemlerinde yasak karakterler atılır, boşluklar sadeleşir. */
function temizAd(ad: string): string {
  return ad
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, AD_MAX)
    .trim();
}

/**
 * ASCII-güvenli dosya adı (uzantısız): Türkçe harfler sadeleşir, aksanlar atılır, diğer karakterler "-" olur.
 * "Gerilim düşümü — Pano 3" → "Gerilim-dusumu-Pano-3". Boş kalırsa "rapor".
 */
export function asciiDosyaAdi(ad: string): string {
  const sade = ad
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_ASCII[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, AD_MAX)
    .replace(/[-.]+$/g, "");
  return sade || "rapor";
}

/** RFC 5987 attr-char dışındaki her şeyi yüzde kodlar (encodeURIComponent `'()*!` bırakır). */
function rfc5987(deger: string): string {
  return encodeURIComponent(deger).replace(/['()*!]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** `Content-Disposition: attachment` başlık değeri, ".pdf" uzantılı. */
export function pdfContentDisposition(ad: string): string {
  const gorunen = temizAd(ad) || "rapor";
  return `attachment; filename="${asciiDosyaAdi(gorunen)}.pdf"; filename*=UTF-8''${rfc5987(`${gorunen}.pdf`)}`;
}

/** `Content-Disposition` başlığından dosya adı (önce `filename*`); bulunamazsa null. */
export function dosyaAdiniCoz(baslik: string | null | undefined): string | null {
  if (!baslik) return null;
  const yildizli = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(baslik);
  if (yildizli) {
    try {
      const ad = temizAd(decodeURIComponent(yildizli[1].trim()));
      if (ad) return ad;
    } catch {
      // Bozuk kodlama: düz filename'e düş
    }
  }
  const duz = /filename\s*=\s*"([^"]*)"/i.exec(baslik) ?? /filename\s*=\s*([^;]+)/i.exec(baslik);
  const ad = duz ? temizAd(duz[1]) : "";
  return ad || null;
}
