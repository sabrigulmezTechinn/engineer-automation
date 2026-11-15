/**
 * Kayıt/proje veri katmanı (yalnızca sunucu). İmzalar sözleşmedir; gövdeler Faz 2 işçisi A tarafından doldurulur.
 *
 * Kurallar:
 * - Her fonksiyon ilk parametre olarak oturumdaki kullanıcının kimliğini alır ve HER sorgu bu kullanıcıya
 *   göre süzülür (kaydetme ve taşımada hedef proje dahil). Başkasına ait kayıt "bulunamadi" sayılır.
 * - Proje silinince içindeki hesaplar silinmez, projeden çıkarılır (proje_id → NULL; şemada ON DELETE SET NULL).
 * - Kaydedilen girdiler hesap tanımına göre süzülür (src/lib/kayit/dogrulama.ts); bilinmeyen hesap → "gecersiz".
 *
 * Uygulama notları:
 * - Değiştiren sorgular (UPDATE/DELETE) WHERE koşulunda kullanıcı kimliğini de taşır; etkilenen satır yoksa
 *   "bulunamadi" fırlatılır. Önce okuyup sonra yalnızca kimlikle yazan bir yol yoktur.
 * - Güncellemelerde `undefined` alana dokunulmaz, `null` temizler (projeId → projesiz, notlar → boş).
 * - Projedeki bir hesap kaydedilince/taşınınca/silinince projenin `updatedAt` değeri de ilerler (listelerdeki
 *   "son güncelleme" projenin içeriğini yansıtsın).
 */
import { and, count, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { kayitliHesap, proje } from "@/db/schema";
import { getCalc } from "@/lib/calc/registry";
import { ciktiBirimleriniSuz, girdileriSuz } from "./dogrulama";
import {
  KAYIT_AD_MAX,
  KAYIT_NOT_MAX,
  KayitHatasi,
  PROJE_ACIKLAMA_MAX,
  PROJE_AD_MAX,
  type KayitGirdisi,
  type KayitGuncelleme,
  type KayitliHesap,
  type Proje,
  type ProjeGirdisi,
} from "./types";

// ---------------------------------------------------------------------------------------------
// Yardımcılar

const KOPYA_EKI = " (kopya)";

const PROJE_BULUNAMADI = "Proje bulunamadı.";
const KAYIT_BULUNAMADI = "Kayıt bulunamadı.";

const projeBulunamadi = () => new KayitHatasi("bulunamadi", PROJE_BULUNAMADI);
const kayitBulunamadi = () => new KayitHatasi("bulunamadi", KAYIT_BULUNAMADI);

/** Zorunlu ad: kırpılır; boş ya da uzunsa "gecersiz". */
function adDogrula(deger: unknown, max: number, etiket: string): string {
  if (typeof deger !== "string") throw new KayitHatasi("gecersiz", `${etiket} geçersiz.`);
  const ad = deger.trim();
  if (ad === "") throw new KayitHatasi("gecersiz", `${etiket} boş olamaz.`);
  if (ad.length > max) throw new KayitHatasi("gecersiz", `${etiket} en fazla ${max} karakter olabilir.`);
  return ad;
}

/** İsteğe bağlı metin: kırpılır; boşsa null; uzunsa "gecersiz". */
function metinDogrula(deger: unknown, max: number, etiket: string): string | null {
  if (deger === null || deger === undefined) return null;
  if (typeof deger !== "string") throw new KayitHatasi("gecersiz", `${etiket} geçersiz.`);
  const metin = deger.trim();
  if (metin === "") return null;
  if (metin.length > max) throw new KayitHatasi("gecersiz", `${etiket} en fazla ${max} karakter olabilir.`);
  return metin;
}

/** Yabancı anahtar ihlali (ör. hedef proje bu sırada silindi). Drizzle pg hatasını `cause` içinde taşır. */
function yabanciAnahtarIhlali(error: unknown): boolean {
  const kod = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);
  return kod(error) === "23503" || kod((error as { cause?: unknown } | null)?.cause) === "23503";
}

const tarih = (d: Date) => d.toISOString();

const projeKolonlari = {
  id: proje.id,
  ad: proje.ad,
  aciklama: proje.aciklama,
  createdAt: proje.createdAt,
  updatedAt: proje.updatedAt,
};

type ProjeSatiri = { id: string; ad: string; aciklama: string | null; createdAt: Date; updatedAt: Date };

function projeyeCevir(satir: ProjeSatiri, hesapSayisi: number): Proje {
  return {
    id: satir.id,
    ad: satir.ad,
    aciklama: satir.aciklama,
    createdAt: tarih(satir.createdAt),
    updatedAt: tarih(satir.updatedAt),
    hesapSayisi,
  };
}

const hesapKolonlari = {
  id: kayitliHesap.id,
  projeId: kayitliHesap.projeId,
  hesapSlug: kayitliHesap.hesapSlug,
  hesapId: kayitliHesap.hesapId,
  ad: kayitliHesap.ad,
  notlar: kayitliHesap.notlar,
  girdiler: kayitliHesap.girdiler,
  ciktiBirimleri: kayitliHesap.ciktiBirimleri,
  createdAt: kayitliHesap.createdAt,
  updatedAt: kayitliHesap.updatedAt,
};

type HesapSatiri = Omit<KayitliHesap, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date };

function hesabaCevir(satir: HesapSatiri): KayitliHesap {
  return { ...satir, createdAt: tarih(satir.createdAt), updatedAt: tarih(satir.updatedAt) };
}

/** Proje sorgusu: kullanıcının projeleri ve (yalnızca o kullanıcının) hesap sayıları, tek sorguda. */
function projeSorgusu(kosul: SQL | undefined) {
  return db
    .select({ ...projeKolonlari, hesapSayisi: count(kayitliHesap.id) })
    .from(proje)
    .leftJoin(kayitliHesap, and(eq(kayitliHesap.projeId, proje.id), eq(kayitliHesap.userId, proje.userId)))
    .where(kosul)
    .groupBy(proje.id);
}

/** Hedef proje kullanıcıya ait değilse (ya da yoksa) "bulunamadi" fırlatır. */
async function projeSahibiMi(userId: string, projeId: string): Promise<void> {
  const [satir] = await db
    .select({ id: proje.id })
    .from(proje)
    .where(and(eq(proje.userId, userId), eq(proje.id, projeId)))
    .limit(1);
  if (!satir) throw projeBulunamadi();
}

/** Projelerin "son güncelleme" zamanını ilerletir (içerikleri değişti). */
async function projeleriDokun(userId: string, projeIdleri: Array<string | null | undefined>): Promise<void> {
  const idler = [...new Set(projeIdleri.filter((id): id is string => typeof id === "string"))];
  if (idler.length === 0) return;
  await db
    .update(proje)
    .set({ updatedAt: new Date() })
    .where(and(eq(proje.userId, userId), inArray(proje.id, idler)));
}

// ---------------------------------------------------------------------------------------------
// Projeler

export async function projeleriListele(userId: string): Promise<Proje[]> {
  const satirlar = await projeSorgusu(eq(proje.userId, userId)).orderBy(desc(proje.updatedAt), desc(proje.id));
  return satirlar.map((s) => projeyeCevir(s, Number(s.hesapSayisi)));
}

export async function projeGetir(userId: string, id: string): Promise<Proje | null> {
  const [satir] = await projeSorgusu(and(eq(proje.userId, userId), eq(proje.id, id))).limit(1);
  return satir ? projeyeCevir(satir, Number(satir.hesapSayisi)) : null;
}

export async function projeOlustur(userId: string, girdi: ProjeGirdisi): Promise<Proje> {
  const ad = adDogrula(girdi.ad, PROJE_AD_MAX, "Proje adı");
  const aciklama = metinDogrula(girdi.aciklama, PROJE_ACIKLAMA_MAX, "Proje açıklaması");
  const [satir] = await db
    .insert(proje)
    .values({ id: crypto.randomUUID(), userId, ad, aciklama })
    .returning(projeKolonlari);
  return projeyeCevir(satir, 0);
}

export async function projeGuncelle(userId: string, id: string, girdi: Partial<ProjeGirdisi>): Promise<Proje> {
  const degisiklik: Partial<typeof proje.$inferInsert> = { updatedAt: new Date() };
  if (girdi.ad !== undefined) degisiklik.ad = adDogrula(girdi.ad, PROJE_AD_MAX, "Proje adı");
  if (girdi.aciklama !== undefined) {
    degisiklik.aciklama = metinDogrula(girdi.aciklama, PROJE_ACIKLAMA_MAX, "Proje açıklaması");
  }
  const [satir] = await db
    .update(proje)
    .set(degisiklik)
    .where(and(eq(proje.userId, userId), eq(proje.id, id)))
    .returning({ id: proje.id });
  if (!satir) throw projeBulunamadi();
  const guncel = await projeGetir(userId, id);
  if (!guncel) throw projeBulunamadi(); // bu arada silindi
  return guncel;
}

/** Projeyi siler; içindeki hesaplar projesiz kalır. */
export async function projeSil(userId: string, id: string): Promise<void> {
  const silinen = await db
    .delete(proje)
    .where(and(eq(proje.userId, userId), eq(proje.id, id)))
    .returning({ id: proje.id });
  if (silinen.length === 0) throw projeBulunamadi();
}

// ---------------------------------------------------------------------------------------------
// Kayıtlı hesaplar

/**
 * Kayıtlı hesaplar, son güncellenen önce. `projeId: null` projesizleri, verilmezse hepsini listeler;
 * `hesapSlug` verilirse yalnızca o hesap türünü (karşılaştırma için).
 */
export async function hesaplariListele(
  userId: string,
  filtre?: { projeId?: string | null; hesapSlug?: string },
): Promise<KayitliHesap[]> {
  const kosullar: SQL[] = [eq(kayitliHesap.userId, userId)];
  if (filtre?.projeId !== undefined) {
    kosullar.push(filtre.projeId === null ? isNull(kayitliHesap.projeId) : eq(kayitliHesap.projeId, filtre.projeId));
  }
  if (filtre?.hesapSlug !== undefined) kosullar.push(eq(kayitliHesap.hesapSlug, filtre.hesapSlug));

  const satirlar = await db
    .select(hesapKolonlari)
    .from(kayitliHesap)
    .where(and(...kosullar))
    .orderBy(desc(kayitliHesap.updatedAt), desc(kayitliHesap.id));
  return satirlar.map(hesabaCevir);
}

export async function hesapGetir(userId: string, id: string): Promise<KayitliHesap | null> {
  const [satir] = await db
    .select(hesapKolonlari)
    .from(kayitliHesap)
    .where(and(eq(kayitliHesap.userId, userId), eq(kayitliHesap.id, id)))
    .limit(1);
  return satir ? hesabaCevir(satir) : null;
}

/** Verilen kimliklerden kullanıcıya ait olanlar, verilen sırayla (karşılaştırma ve raporlar için). */
export async function hesaplariGetir(userId: string, ids: string[]): Promise<KayitliHesap[]> {
  const benzersiz = [...new Set(ids)];
  if (benzersiz.length === 0) return [];
  const satirlar = await db
    .select(hesapKolonlari)
    .from(kayitliHesap)
    .where(and(eq(kayitliHesap.userId, userId), inArray(kayitliHesap.id, benzersiz)));
  const byId = new Map(satirlar.map((s) => [s.id, hesabaCevir(s)]));
  return benzersiz.flatMap((id) => byId.get(id) ?? []);
}

export async function hesapKaydet(userId: string, girdi: KayitGirdisi): Promise<KayitliHesap> {
  const def = getCalc(girdi.hesapSlug);
  if (!def) throw new KayitHatasi("gecersiz", "Bilinmeyen hesap türü.");
  const ad = adDogrula(girdi.ad, KAYIT_AD_MAX, "Kayıt adı");
  const notlar = metinDogrula(girdi.notlar, KAYIT_NOT_MAX, "Not");
  const projeId = girdi.projeId ?? null;
  if (projeId !== null) await projeSahibiMi(userId, projeId);

  let satir: HesapSatiri;
  try {
    [satir] = await db
      .insert(kayitliHesap)
      .values({
        id: crypto.randomUUID(),
        userId,
        projeId,
        hesapSlug: def.slug,
        hesapId: def.id,
        ad,
        notlar,
        girdiler: girdileriSuz(def, girdi.girdiler),
        ciktiBirimleri: ciktiBirimleriniSuz(def, girdi.ciktiBirimleri ?? {}),
      })
      .returning(hesapKolonlari);
  } catch (error) {
    if (yabanciAnahtarIhlali(error)) throw projeBulunamadi();
    throw error;
  }
  await projeleriDokun(userId, [projeId]);
  return hesabaCevir(satir);
}

export async function hesapGuncelle(userId: string, id: string, guncelleme: KayitGuncelleme): Promise<KayitliHesap> {
  const mevcut = await hesapGetir(userId, id);
  if (!mevcut) throw kayitBulunamadi();

  const degisiklik: Partial<typeof kayitliHesap.$inferInsert> = { updatedAt: new Date() };
  if (guncelleme.ad !== undefined) degisiklik.ad = adDogrula(guncelleme.ad, KAYIT_AD_MAX, "Kayıt adı");
  if (guncelleme.notlar !== undefined) degisiklik.notlar = metinDogrula(guncelleme.notlar, KAYIT_NOT_MAX, "Not");
  if (guncelleme.girdiler !== undefined || guncelleme.ciktiBirimleri !== undefined) {
    const def = getCalc(mevcut.hesapSlug);
    if (!def) throw new KayitHatasi("gecersiz", "Bu kaydın hesap türü artık mevcut değil.");
    if (guncelleme.girdiler !== undefined) degisiklik.girdiler = girdileriSuz(def, guncelleme.girdiler);
    if (guncelleme.ciktiBirimleri !== undefined) {
      degisiklik.ciktiBirimleri = ciktiBirimleriniSuz(def, guncelleme.ciktiBirimleri);
    }
  }
  if (guncelleme.projeId !== undefined) {
    if (guncelleme.projeId !== null) await projeSahibiMi(userId, guncelleme.projeId);
    degisiklik.projeId = guncelleme.projeId;
  }

  let satir: HesapSatiri | undefined;
  try {
    [satir] = await db
      .update(kayitliHesap)
      .set(degisiklik)
      .where(and(eq(kayitliHesap.userId, userId), eq(kayitliHesap.id, id)))
      .returning(hesapKolonlari);
  } catch (error) {
    if (yabanciAnahtarIhlali(error)) throw projeBulunamadi();
    throw error;
  }
  if (!satir) throw kayitBulunamadi(); // bu arada silindi
  await projeleriDokun(userId, [mevcut.projeId, satir.projeId]);
  return hesabaCevir(satir);
}

/** Aynı projede "<ad> (kopya)" adıyla yeni kayıt */
export async function hesapKopyala(userId: string, id: string): Promise<KayitliHesap> {
  const mevcut = await hesapGetir(userId, id);
  if (!mevcut) throw kayitBulunamadi();
  // Ad sınırı aşılmasın: gerekirse asıl ad kısaltılır, ek korunur.
  const taban = mevcut.ad.slice(0, KAYIT_AD_MAX - KOPYA_EKI.length).trimEnd();

  let satir: HesapSatiri;
  try {
    [satir] = await db
      .insert(kayitliHesap)
      .values({
        id: crypto.randomUUID(),
        userId,
        projeId: mevcut.projeId,
        hesapSlug: mevcut.hesapSlug,
        hesapId: mevcut.hesapId,
        ad: `${taban}${KOPYA_EKI}`,
        notlar: mevcut.notlar,
        girdiler: mevcut.girdiler,
        ciktiBirimleri: mevcut.ciktiBirimleri,
      })
      .returning(hesapKolonlari);
  } catch (error) {
    if (yabanciAnahtarIhlali(error)) throw projeBulunamadi();
    throw error;
  }
  await projeleriDokun(userId, [satir.projeId]);
  return hesabaCevir(satir);
}

export async function hesapSil(userId: string, id: string): Promise<void> {
  const silinen = await db
    .delete(kayitliHesap)
    .where(and(eq(kayitliHesap.userId, userId), eq(kayitliHesap.id, id)))
    .returning({ projeId: kayitliHesap.projeId });
  if (silinen.length === 0) throw kayitBulunamadi();
  await projeleriDokun(userId, [silinen[0].projeId]);
}
