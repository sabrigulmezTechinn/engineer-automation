/**
 * Kayıt/proje veri katmanı (yalnızca sunucu). İmzalar sözleşmedir; gövdeler Faz 2 işçisi A tarafından doldurulur.
 *
 * Kurallar:
 * - Her fonksiyon ilk parametre olarak oturumdaki kullanıcının kimliğini alır ve HER sorgu bu kullanıcıya
 *   göre süzülür (kaydetme ve taşımada hedef proje dahil). Başkasına ait kayıt "bulunamadi" sayılır.
 * - Proje silinince içindeki hesaplar silinmez, projeden çıkarılır (proje_id → NULL; şemada ON DELETE SET NULL).
 * - Kaydedilen girdiler hesap tanımına göre süzülür (src/lib/kayit/dogrulama.ts); bilinmeyen hesap → "gecersiz".
 */
import type { KayitGirdisi, KayitGuncelleme, KayitliHesap, Proje, ProjeGirdisi } from "./types";

const TODO = (name: string): never => {
  throw new Error(`kayit.${name}: henüz uygulanmadı (Faz 2 işçisi A)`);
};

export async function projeleriListele(userId: string): Promise<Proje[]> {
  return TODO(`projeleriListele(${userId})`);
}

export async function projeGetir(userId: string, id: string): Promise<Proje | null> {
  return TODO(`projeGetir(${userId}, ${id})`);
}

export async function projeOlustur(userId: string, girdi: ProjeGirdisi): Promise<Proje> {
  return TODO(`projeOlustur(${userId}, ${girdi.ad})`);
}

export async function projeGuncelle(userId: string, id: string, girdi: Partial<ProjeGirdisi>): Promise<Proje> {
  return TODO(`projeGuncelle(${userId}, ${id}, ${JSON.stringify(girdi)})`);
}

/** Projeyi siler; içindeki hesaplar projesiz kalır. */
export async function projeSil(userId: string, id: string): Promise<void> {
  return TODO(`projeSil(${userId}, ${id})`);
}

/**
 * Kayıtlı hesaplar, son güncellenen önce. `projeId: null` projesizleri, verilmezse hepsini listeler;
 * `hesapSlug` verilirse yalnızca o hesap türünü (karşılaştırma için).
 */
export async function hesaplariListele(
  userId: string,
  filtre?: { projeId?: string | null; hesapSlug?: string },
): Promise<KayitliHesap[]> {
  return TODO(`hesaplariListele(${userId}, ${JSON.stringify(filtre)})`);
}

export async function hesapGetir(userId: string, id: string): Promise<KayitliHesap | null> {
  return TODO(`hesapGetir(${userId}, ${id})`);
}

/** Verilen kimliklerden kullanıcıya ait olanlar, verilen sırayla (karşılaştırma ve raporlar için). */
export async function hesaplariGetir(userId: string, ids: string[]): Promise<KayitliHesap[]> {
  return TODO(`hesaplariGetir(${userId}, ${ids.join(",")})`);
}

export async function hesapKaydet(userId: string, girdi: KayitGirdisi): Promise<KayitliHesap> {
  return TODO(`hesapKaydet(${userId}, ${girdi.hesapSlug})`);
}

export async function hesapGuncelle(userId: string, id: string, guncelleme: KayitGuncelleme): Promise<KayitliHesap> {
  return TODO(`hesapGuncelle(${userId}, ${id}, ${Object.keys(guncelleme).join(",")})`);
}

/** Aynı projede "<ad> (kopya)" adıyla yeni kayıt */
export async function hesapKopyala(userId: string, id: string): Promise<KayitliHesap> {
  return TODO(`hesapKopyala(${userId}, ${id})`);
}

export async function hesapSil(userId: string, id: string): Promise<void> {
  return TODO(`hesapSil(${userId}, ${id})`);
}
