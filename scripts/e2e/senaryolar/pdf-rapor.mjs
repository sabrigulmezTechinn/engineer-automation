/**
 * Faz 2 — PDF rapor (KAPSAM §3.5). İşçi C'nin düğmeleri birleştirilince ana oturum doldurur.
 *
 * Yazılacak adımlar (öneri); indirilenPdf(page, tıklama): download olayı → dosya → pdftotext metni:
 *   - tek hesap raporu: başlık, kullanıcı/şirket, girdiler, sonuçlar ("5,455 mA" gibi), referanslar, sorumluluk reddi
 *   - proje raporu: projedeki tüm hesaplar tek PDF'te (girisliBaglam(t) ile)
 *   - karşılaştırma raporu: senaryo tablosu
 *
 * Örnek:
 *   const { metin } = await indirilenPdf(page, page.getByRole("button", { name: "PDF rapor" }));
 *   dogrula(metin.includes("Sorumluluk reddi"), "PDF'te sorumluluk reddi yok");
 */
// import { dogrula, girisliBaglam, indirilenPdf } from "../yardimcilar.mjs";

const senaryo = {
  ad: "pdf-rapor",
  aciklama: "Faz 2: tek hesap, proje ve karşılaştırma PDF raporları",

  async calistir(t) {
    t.atla("Faz 2 PDF rapor düğmeleri birleştirilince eklenecek");
  },
};

export default senaryo;
