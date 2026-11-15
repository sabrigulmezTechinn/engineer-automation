/**
 * Faz 2 — karşılaştırma (KAPSAM §3.4). İşçi B'nin arayüzü birleştirilince ana oturum doldurur.
 *
 * Yazılacak adımlar (öneri):
 *   - hesap sayfasında mevcut durumu senaryo olarak ekle, girdiyi değiştirip ikinci senaryo ekle
 *   - senaryo tablosunda değişen değerlerin vurgulanması, uygun olmayanların işaretlenmesi
 *   - grafik (SVG) çizilir; mobilde (iPhone 13) yatay taşma yok
 *   - kayıtlı hesap karşılaştırması: girisliBaglam(t) ile aynı türden iki kaydı yan yana
 */
// import { girisliBaglam } from "../yardimcilar.mjs";

const senaryo = {
  ad: "karsilastirma",
  aciklama: "Faz 2: senaryo ve kayıtlı hesap karşılaştırması, grafik",

  async calistir(t) {
    t.atla("Faz 2 karşılaştırma arayüzü birleştirilince eklenecek");
  },
};

export default senaryo;
