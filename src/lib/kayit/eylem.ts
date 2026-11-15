/**
 * Kayıt/proje server action'larının ortak parçaları: sonuç tipi, istek gövdesi şemaları (zod 4, Türkçe mesajlar)
 * ve hata → kullanıcı mesajı çevirisi. "use server" dosyası yalnızca async fonksiyon dışa aktarabildiği için
 * bunlar ayrı bir modüldedir. Saf modül: istemcide de içe aktarılabilir (tipler için).
 */
import * as z from "zod";
import {
  KAYIT_AD_MAX,
  KAYIT_NOT_MAX,
  KayitHatasi,
  PROJE_ACIKLAMA_MAX,
  PROJE_AD_MAX,
} from "./types";

/** Server action sonucu. `girisGerekli`: oturum yok/sona erdi (istemci giriş bağlantısı gösterir). */
export type EylemSonucu<T = null> = { ok: true; veri: T } | { ok: false; hata: string; girisGerekli?: true };

export const GENEL_HATA = "Beklenmeyen bir hata oluştu. Lütfen biraz sonra tekrar deneyin.";
export const OTURUM_HATASI = "Oturumunuz sona ermiş. Devam etmek için yeniden giriş yapın.";
const GECERSIZ = "Gönderilen bilgiler geçersiz.";

// Yapısal hatalarda zod'un İngilizce varsayılan mesajları yerine genel Türkçe mesaj
const H = { error: GECERSIZ } as const;

const kimlik = z.string(H).trim().min(1, GECERSIZ).max(100, GECERSIZ);

const girdilerSemasi = z.record(
  z.string(H),
  z.object({ value: z.string(H), unit: z.string(H).optional() }, H),
  H,
);
const ciktiBirimleriSemasi = z.record(z.string(H), z.string(H), H);

const kayitAdi = z
  .string(H)
  .trim()
  .min(1, "Kayıt adı boş olamaz.")
  .max(KAYIT_AD_MAX, `Kayıt adı en fazla ${KAYIT_AD_MAX} karakter olabilir.`);
const notlar = z.string(H).trim().max(KAYIT_NOT_MAX, `Not en fazla ${KAYIT_NOT_MAX} karakter olabilir.`).nullable();
const projeAdi = z
  .string(H)
  .trim()
  .min(1, "Proje adı boş olamaz.")
  .max(PROJE_AD_MAX, `Proje adı en fazla ${PROJE_AD_MAX} karakter olabilir.`);
const projeAciklamasi = z
  .string(H)
  .trim()
  .max(PROJE_ACIKLAMA_MAX, `Proje açıklaması en fazla ${PROJE_ACIKLAMA_MAX} karakter olabilir.`)
  .nullable();

export const kimlikSemasi = kimlik;
/** null: projesiz */
export const projeIdSemasi = kimlik.nullable();

/** Yeni kayıt. `yeniProjeAdi` verilirse önce bu adla proje oluşturulur ve kayıt oraya yazılır (projeId yok sayılır). */
export const kayitOlusturSemasi = z.object(
  {
    hesapSlug: kimlik,
    ad: kayitAdi,
    notlar: notlar.optional(),
    projeId: projeIdSemasi.optional(),
    yeniProjeAdi: projeAdi.optional(),
    girdiler: girdilerSemasi,
    ciktiBirimleri: ciktiBirimleriSemasi.optional(),
  },
  H,
);
export type KayitOlusturIstegi = z.input<typeof kayitOlusturSemasi>;

export const kayitGuncelleSemasi = z.object(
  {
    ad: kayitAdi.optional(),
    notlar: notlar.optional(),
    projeId: projeIdSemasi.optional(),
    girdiler: girdilerSemasi.optional(),
    ciktiBirimleri: ciktiBirimleriSemasi.optional(),
  },
  H,
);
export type KayitGuncelleIstegi = z.input<typeof kayitGuncelleSemasi>;

export const projeOlusturSemasi = z.object({ ad: projeAdi, aciklama: projeAciklamasi.optional() }, H);
export type ProjeOlusturIstegi = z.input<typeof projeOlusturSemasi>;

export const projeGuncelleSemasi = z.object({ ad: projeAdi.optional(), aciklama: projeAciklamasi.optional() }, H);
export type ProjeGuncelleIstegi = z.input<typeof projeGuncelleSemasi>;

/** zod sonucunu veri ya da kullanıcıya gösterilecek ilk hata mesajına çevirir. */
export function cozumle<T>(
  sema: z.ZodType<T>,
  deger: unknown,
): { ok: true; veri: T } | { ok: false; hata: string } {
  const sonuc = sema.safeParse(deger);
  if (sonuc.success) return { ok: true, veri: sonuc.data };
  return { ok: false, hata: sonuc.error.issues[0]?.message ?? GECERSIZ };
}

/** Veri katmanı hatası → Türkçe mesaj; beklenmeyen hatalar günlüğe yazılır, ayrıntısı kullanıcıya gösterilmez. */
export function hataSonucu(error: unknown): { ok: false; hata: string } {
  if (error instanceof KayitHatasi) return { ok: false, hata: error.message };
  console.error("Kayıt işlemi beklenmeyen bir hatayla sonuçlandı", error);
  return { ok: false, hata: GENEL_HATA };
}
