/**
 * Senaryo kaydı: çalıştırma sırası buradaki sıradır. Yeni senaryo dosyası buraya eklenir.
 * Kimlik doğrulama erken çalışır: BETTER_AUTH_URL uyuşmazlığı gibi kurulum hataları baştan yakalanır ve
 * son oturumu, girisliBaglam kullanan sonraki senaryolarla paylaşılır.
 */
import genelSayfalar from "./genel-sayfalar.mjs";
import hesapSayfalari from "./hesap-sayfalari.mjs";
import karsilastirma from "./karsilastirma.mjs";
import kaydetmeProjeler from "./kaydetme-projeler.mjs";
import kimlikDogrulama from "./kimlik-dogrulama.mjs";
import ohmYasasi from "./ohm-yasasi.mjs";
import pdfRapor from "./pdf-rapor.mjs";

export const SENARYOLAR = [
  genelSayfalar,
  kimlikDogrulama,
  ohmYasasi,
  hesapSayfalari,
  kaydetmeProjeler,
  karsilastirma,
  pdfRapor,
];
