/**
 * Faz 2 — kaydetme ve projeler (KAPSAM §3.3). İşçi A'nın arayüzü birleştirilince ana oturum doldurur.
 *
 * Yazılacak adımlar (öneri):
 *   - girisliBaglam(t) ile oturumlu bağlam (yeni kayıt/giriş harcamaz; çıkış YAPMAYIN, oturum paylaşılıyor)
 *   - hesap sayfasında isim vererek kaydet, proje seç/oluştur
 *   - projeler sayfasında kaydın görünmesi; ?kayit=<id> ile açılınca girdilerin geri gelmesi
 *   - düzenle → kaydet, kopyala; başka kullanıcının kaydı "bulunamadı" (404)
 *   - oturumsuz: kaydetme düğmesi yerine "Kaydetmek için giriş yapın" bağlantısı
 */
// import { girisliBaglam } from "../yardimcilar.mjs";

const senaryo = {
  ad: "kaydetme-projeler",
  aciklama: "Faz 2: hesap kaydetme, projeler, kayıtlı hesabı açma/kopyalama",

  async calistir(t) {
    t.atla("Faz 2 kaydetme/projeler arayüzü birleştirilince eklenecek");
  },
};

export default senaryo;
