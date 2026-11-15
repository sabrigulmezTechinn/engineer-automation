/**
 * Kayıt/proje veri katmanı entegrasyon testi — GERÇEK PostgreSQL veritabanına karşı çalışır.
 * Odak: yetki (her sorgu oturumdaki kullanıcıya göre süzülür; başkasının kaydı "bulunamadi").
 *
 * Hazırlık: scripts/db-setup.sh, .env.local (DATABASE_URL), npm run db:migrate
 * Çalıştırma: npx vitest run src/lib/kayit/islemler.integration.test.ts
 *
 * DATABASE_URL yoksa veya veritabanına ulaşılamazsa test atlanmaz, açıklayıcı bir hatayla başarısız olur.
 * İki kullanıcıyı doğrudan `user` tablosuna ekler; sonunda siler (projeler ve kayıtlar CASCADE ile silinir).
 */
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KAYIT_AD_MAX, KAYIT_NOT_MAX, KayitHatasi, PROJE_AD_MAX, type KayitHataKodu } from "./types";

type DbModule = typeof import("@/db");
type Islemler = typeof import("./islemler");

let dbModule: DbModule;
let k: Islemler;
const kullaniciIdleri: string[] = [];
let A: string;
let B: string;

declare global {
  var __engineerPgPool: import("pg").Pool | undefined;
}

async function kullaniciEkle(etiket: string): Promise<string> {
  const id = crypto.randomUUID();
  kullaniciIdleri.push(id);
  await dbModule.db.insert(dbModule.schema.user).values({
    id,
    name: `Kayıt testi ${etiket}`,
    email: `kayit-entegrasyon-${etiket}-${id}@example.com`,
    emailVerified: true,
  });
  return id;
}

/** Sözün KayitHatasi ile ve beklenen kodla reddedildiğini doğrular. */
async function hataKodu(promise: Promise<unknown>): Promise<KayitHataKodu | "hata-yok" | "baska-hata"> {
  try {
    await promise;
    return "hata-yok";
  } catch (error) {
    return error instanceof KayitHatasi ? error.kod : "baska-hata";
  }
}

/** ohm-yasasi için geçerli bir durum + süzülmesi gereken çöp */
const OHM_GIRDILER = {
  mod: { value: "V-I" },
  V: { value: "230", unit: "V" },
  I: { value: "2,5", unit: "mA" },
  R: { value: "1", unit: "kA" }, // direnç için geçersiz birim → atılır
  fazla: { value: "x" }, // tanımda yok → atılır
};
const OHM_SUZULMUS = { mod: { value: "V-I" }, V: { value: "230", unit: "V" }, I: { value: "2,5", unit: "mA" } };

beforeAll(async () => {
  try {
    process.loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Bu entegrasyon testi gerçek bir veritabanı gerektirir ama DATABASE_URL tanımlı değil. " +
        "Önce `scripts/db-setup.sh` çalıştırın, `.env.example`'ı `.env.local` olarak kopyalayın ve " +
        "`npm run db:migrate` ile tabloları oluşturun.",
    );
  }
  // Ortam değişkenleri yüklendikten SONRA içe aktar (@/db içe aktarılırken DATABASE_URL okunur).
  dbModule = await import("@/db");
  try {
    await dbModule.pool.query('select 1 from "proje" limit 1');
    await dbModule.pool.query('select 1 from "kayitli_hesap" limit 1');
  } catch (error) {
    throw new Error(
      `Veritabanına bağlanılamadı veya kayıt tabloları yok (${(error as Error).message}). ` +
        "`scripts/db-setup.sh` ve `npm run db:migrate` çalıştırın.",
    );
  }
  k = await import("./islemler");
  A = await kullaniciEkle("a");
  B = await kullaniciEkle("b");
});

afterAll(async () => {
  if (dbModule && kullaniciIdleri.length > 0) {
    await dbModule.db.delete(dbModule.schema.user).where(inArray(dbModule.schema.user.id, kullaniciIdleri));
    // CASCADE: kullanıcıların projeleri ve kayıtları da gitmiş olmalı.
    const kalan = await dbModule.db
      .select({ id: dbModule.schema.kayitliHesap.id })
      .from(dbModule.schema.kayitliHesap)
      .where(inArray(dbModule.schema.kayitliHesap.userId, kullaniciIdleri));
    expect(kalan).toEqual([]);
  }
  await dbModule?.pool.end();
  globalThis.__engineerPgPool = undefined;
});

describe("kayıt/proje veri katmanı + PostgreSQL", () => {
  it("proje oluşturma, listeleme (hesap sayısıyla) ve güncelleme", async () => {
    const p = await k.projeOlustur(A, { ad: "  Fabrika A  ", aciklama: "  " });
    expect(p).toMatchObject({ ad: "Fabrika A", aciklama: null, hesapSayisi: 0 });
    expect(new Date(p.createdAt).toISOString()).toBe(p.createdAt);

    await k.hesapKaydet(A, { hesapSlug: "ohm-yasasi", ad: "Hesap 1", projeId: p.id, girdiler: OHM_GIRDILER });
    await k.hesapKaydet(A, { hesapSlug: "ohm-yasasi", ad: "Hesap 2", projeId: p.id, girdiler: OHM_GIRDILER });

    const liste = await k.projeleriListele(A);
    expect(liste.find((x) => x.id === p.id)).toMatchObject({ ad: "Fabrika A", hesapSayisi: 2 });
    expect(typeof liste[0].hesapSayisi).toBe("number");
    expect(await k.projeGetir(A, p.id)).toMatchObject({ hesapSayisi: 2 });

    const g = await k.projeGuncelle(A, p.id, { aciklama: "Kompanzasyon panosu" });
    expect(g).toMatchObject({ ad: "Fabrika A", aciklama: "Kompanzasyon panosu", hesapSayisi: 2 });
    const g2 = await k.projeGuncelle(A, p.id, { ad: "Fabrika B", aciklama: null });
    expect(g2).toMatchObject({ ad: "Fabrika B", aciklama: null });

    expect(await hataKodu(k.projeOlustur(A, { ad: "   " }))).toBe("gecersiz");
    expect(await hataKodu(k.projeOlustur(A, { ad: "x".repeat(PROJE_AD_MAX + 1) }))).toBe("gecersiz");
    expect(await hataKodu(k.projeGuncelle(A, p.id, { ad: "" }))).toBe("gecersiz");
    expect(await hataKodu(k.projeGuncelle(A, crypto.randomUUID(), { ad: "Yok" }))).toBe("bulunamadi");
  });

  it("hesap kaydetme girdileri süzer; listeleme filtreleri; hesaplariGetir sırayı korur", async () => {
    const p = await k.projeOlustur(A, { ad: "Filtre projesi" });
    const h1 = await k.hesapKaydet(A, {
      hesapSlug: "ohm-yasasi",
      ad: "  Ohm  ",
      notlar: "  ",
      projeId: p.id,
      girdiler: OHM_GIRDILER,
      ciktiBirimleri: { P: "kW", X: "W", V: "A" },
    });
    expect(h1).toMatchObject({
      projeId: p.id,
      hesapSlug: "ohm-yasasi",
      hesapId: "1.1",
      ad: "Ohm",
      notlar: null,
      girdiler: OHM_SUZULMUS,
      ciktiBirimleri: { P: "kW" },
    });
    expect(await k.hesapGetir(A, h1.id)).toEqual(h1);

    const h2 = await k.hesapKaydet(A, { hesapSlug: "ac-guc", ad: "Projesiz AC", girdiler: {} });
    expect(h2.projeId).toBeNull();
    expect(h2.girdiler).toEqual({});
    expect(h2.ciktiBirimleri).toEqual({});

    const projedekiler = await k.hesaplariListele(A, { projeId: p.id });
    expect(projedekiler.map((h) => h.id)).toEqual([h1.id]);
    const projesizler = await k.hesaplariListele(A, { projeId: null });
    expect(projesizler.map((h) => h.id)).toContain(h2.id);
    expect(projesizler.every((h) => h.projeId === null)).toBe(true);
    const hepsi = (await k.hesaplariListele(A)).map((h) => h.id);
    expect(hepsi).toEqual(expect.arrayContaining([h1.id, h2.id]));
    const ohmlar = await k.hesaplariListele(A, { hesapSlug: "ohm-yasasi" });
    expect(ohmlar.every((h) => h.hesapSlug === "ohm-yasasi")).toBe(true);
    expect(ohmlar.map((h) => h.id)).toContain(h1.id);

    const getirilen = await k.hesaplariGetir(A, [h2.id, h1.id, h2.id, crypto.randomUUID()]);
    expect(getirilen.map((h) => h.id)).toEqual([h2.id, h1.id]);
    expect(await k.hesaplariGetir(A, [])).toEqual([]);
  });

  it("geçersiz kayıt girdilerini reddeder", async () => {
    const temel = { hesapSlug: "ohm-yasasi", ad: "Geçerli", girdiler: OHM_GIRDILER };
    expect(await hataKodu(k.hesapKaydet(A, { ...temel, hesapSlug: "boyle-bir-hesap-yok" }))).toBe("gecersiz");
    expect(await hataKodu(k.hesapKaydet(A, { ...temel, ad: "   " }))).toBe("gecersiz");
    expect(await hataKodu(k.hesapKaydet(A, { ...temel, ad: "x".repeat(KAYIT_AD_MAX + 1) }))).toBe("gecersiz");
    expect(await hataKodu(k.hesapKaydet(A, { ...temel, notlar: "x".repeat(KAYIT_NOT_MAX + 1) }))).toBe("gecersiz");
    expect(await hataKodu(k.hesapKaydet(A, { ...temel, projeId: crypto.randomUUID() }))).toBe("bulunamadi");
    const sinirda = await k.hesapKaydet(A, { ...temel, ad: "x".repeat(KAYIT_AD_MAX) });
    expect(sinirda.ad).toHaveLength(KAYIT_AD_MAX);
  });

  it("güncelleme: undefined alana dokunmaz, null temizler; taşıma; girdiler yeniden süzülür", async () => {
    const p1 = await k.projeOlustur(A, { ad: "Taşıma 1" });
    const p2 = await k.projeOlustur(A, { ad: "Taşıma 2" });
    const h = await k.hesapKaydet(A, {
      hesapSlug: "ohm-yasasi",
      ad: "Taşınacak",
      notlar: "Not",
      projeId: p1.id,
      girdiler: OHM_GIRDILER,
      ciktiBirimleri: { P: "kW" },
    });

    const ad = await k.hesapGuncelle(A, h.id, { ad: "Yeni ad" });
    expect(ad).toMatchObject({ ad: "Yeni ad", notlar: "Not", projeId: p1.id, girdiler: OHM_SUZULMUS });

    const tasindi = await k.hesapGuncelle(A, h.id, { projeId: p2.id });
    expect(tasindi.projeId).toBe(p2.id);
    expect((await k.projeGetir(A, p1.id))?.hesapSayisi).toBe(0);
    expect((await k.projeGetir(A, p2.id))?.hesapSayisi).toBe(1);

    const projesiz = await k.hesapGuncelle(A, h.id, { projeId: null, notlar: null });
    expect(projesiz).toMatchObject({ projeId: null, notlar: null, ad: "Yeni ad" });

    const girdi = await k.hesapGuncelle(A, h.id, {
      girdiler: { ...OHM_GIRDILER, V: { value: "400", unit: "kV" }, mod: { value: "olmayan" } },
      ciktiBirimleri: { I: "mA", P: "bilinmeyen" },
    });
    expect(girdi.girdiler).toEqual({ V: { value: "400", unit: "kV" }, I: { value: "2,5", unit: "mA" } });
    expect(girdi.ciktiBirimleri).toEqual({ I: "mA" });
    expect(new Date(girdi.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(h.updatedAt).getTime());

    expect(await hataKodu(k.hesapGuncelle(A, h.id, { ad: "" }))).toBe("gecersiz");
    expect(await hataKodu(k.hesapGuncelle(A, h.id, { projeId: crypto.randomUUID() }))).toBe("bulunamadi");
    expect(await hataKodu(k.hesapGuncelle(A, crypto.randomUUID(), { ad: "Yok" }))).toBe("bulunamadi");
  });

  it("kopyalama: aynı projede '<ad> (kopya)', uzun adda sınır aşılmaz", async () => {
    const p = await k.projeOlustur(A, { ad: "Kopya projesi" });
    const h = await k.hesapKaydet(A, {
      hesapSlug: "ohm-yasasi",
      ad: "Pano 1",
      notlar: "Açıklama",
      projeId: p.id,
      girdiler: OHM_GIRDILER,
      ciktiBirimleri: { P: "kW" },
    });
    const kopya = await k.hesapKopyala(A, h.id);
    expect(kopya.id).not.toBe(h.id);
    expect(kopya).toMatchObject({
      ad: "Pano 1 (kopya)",
      projeId: p.id,
      notlar: "Açıklama",
      hesapSlug: "ohm-yasasi",
      girdiler: h.girdiler,
      ciktiBirimleri: h.ciktiBirimleri,
    });
    expect((await k.projeGetir(A, p.id))?.hesapSayisi).toBe(2);

    const uzun = await k.hesapKaydet(A, { hesapSlug: "ohm-yasasi", ad: "u".repeat(KAYIT_AD_MAX), girdiler: {} });
    const uzunKopya = await k.hesapKopyala(A, uzun.id);
    expect(uzunKopya.ad.length).toBeLessThanOrEqual(KAYIT_AD_MAX);
    expect(uzunKopya.ad.endsWith(" (kopya)")).toBe(true);
    expect(uzunKopya.projeId).toBeNull();
  });

  it("ikinci kullanıcı birincinin projesini ve hesabını okuyamaz, değiştiremez, silemez, kopyalayamaz", async () => {
    const p = await k.projeOlustur(A, { ad: "A'nın projesi", aciklama: "Gizli" });
    const h = await k.hesapKaydet(A, { hesapSlug: "ohm-yasasi", ad: "A'nın hesabı", projeId: p.id, girdiler: OHM_GIRDILER });

    // Okuma
    expect(await k.projeGetir(B, p.id)).toBeNull();
    expect((await k.projeleriListele(B)).map((x) => x.id)).not.toContain(p.id);
    expect(await k.hesapGetir(B, h.id)).toBeNull();
    expect((await k.hesaplariListele(B)).map((x) => x.id)).not.toContain(h.id);
    expect(await k.hesaplariListele(B, { projeId: p.id })).toEqual([]);
    expect(await k.hesaplariListele(B, { hesapSlug: "ohm-yasasi" })).toEqual([]);

    // Yazma
    expect(await hataKodu(k.projeGuncelle(B, p.id, { ad: "Ele geçirildi" }))).toBe("bulunamadi");
    expect(await hataKodu(k.projeSil(B, p.id))).toBe("bulunamadi");
    expect(await hataKodu(k.hesapGuncelle(B, h.id, { ad: "Ele geçirildi" }))).toBe("bulunamadi");
    expect(await hataKodu(k.hesapGuncelle(B, h.id, { projeId: null }))).toBe("bulunamadi");
    expect(await hataKodu(k.hesapGuncelle(B, h.id, { girdiler: {} }))).toBe("bulunamadi");
    expect(await hataKodu(k.hesapSil(B, h.id))).toBe("bulunamadi");
    expect(await hataKodu(k.hesapKopyala(B, h.id))).toBe("bulunamadi");

    // Hiçbir şey değişmedi, B'ye kopya oluşmadı
    expect(await k.projeGetir(A, p.id)).toMatchObject({ ad: "A'nın projesi", aciklama: "Gizli", hesapSayisi: 1 });
    expect(await k.hesapGetir(A, h.id)).toEqual(h);
    expect(await k.hesaplariListele(B)).toEqual([]);
  });

  it("ikinci kullanıcı kendi hesabını birincinin projesine kaydedemez/taşıyamaz; hesaplariGetir başkasınınkini atar", async () => {
    const p = await k.projeOlustur(A, { ad: "A'nın ikinci projesi" });
    const hA = await k.hesapKaydet(A, { hesapSlug: "ohm-yasasi", ad: "A hesabı", projeId: p.id, girdiler: {} });

    expect(
      await hataKodu(k.hesapKaydet(B, { hesapSlug: "ohm-yasasi", ad: "Sızma", projeId: p.id, girdiler: {} })),
    ).toBe("bulunamadi");
    const hB = await k.hesapKaydet(B, { hesapSlug: "ohm-yasasi", ad: "B hesabı", girdiler: {} });
    expect(await hataKodu(k.hesapGuncelle(B, hB.id, { projeId: p.id }))).toBe("bulunamadi");
    expect((await k.hesapGetir(B, hB.id))?.projeId).toBeNull();
    expect(await k.hesaplariListele(A, { projeId: p.id })).toHaveLength(1);
    expect((await k.projeGetir(A, p.id))?.hesapSayisi).toBe(1);

    expect((await k.hesaplariGetir(B, [hA.id, hB.id])).map((h) => h.id)).toEqual([hB.id]);
    expect(await k.hesaplariGetir(B, [hA.id])).toEqual([]);
    expect((await k.hesaplariGetir(A, [hB.id, hA.id])).map((h) => h.id)).toEqual([hA.id]);

    await k.hesapSil(B, hB.id);
  });

  it("proje silinince hesapları projesiz kalır; hesap silme", async () => {
    const p = await k.projeOlustur(A, { ad: "Silinecek proje" });
    const h1 = await k.hesapKaydet(A, { hesapSlug: "ohm-yasasi", ad: "Kalacak 1", projeId: p.id, girdiler: {} });
    const h2 = await k.hesapKaydet(A, { hesapSlug: "ac-guc", ad: "Kalacak 2", projeId: p.id, girdiler: {} });

    await k.projeSil(A, p.id);
    expect(await k.projeGetir(A, p.id)).toBeNull();
    expect(await hataKodu(k.projeSil(A, p.id))).toBe("bulunamadi");
    const kalanlar = await k.hesaplariGetir(A, [h1.id, h2.id]);
    expect(kalanlar.map((h) => [h.id, h.projeId])).toEqual([
      [h1.id, null],
      [h2.id, null],
    ]);
    expect((await k.hesaplariListele(A, { projeId: null })).map((h) => h.id)).toEqual(
      expect.arrayContaining([h1.id, h2.id]),
    );

    await k.hesapSil(A, h1.id);
    expect(await k.hesapGetir(A, h1.id)).toBeNull();
    expect(await hataKodu(k.hesapSil(A, h1.id))).toBe("bulunamadi");
    expect(await k.hesapGetir(A, h2.id)).not.toBeNull();
  });

  it("projedeki hesap kaydedilince projenin güncelleme zamanı ilerler", async () => {
    const p = await k.projeOlustur(A, { ad: "Zaman projesi" });
    await new Promise((r) => setTimeout(r, 15));
    await k.hesapKaydet(A, { hesapSlug: "ohm-yasasi", ad: "Zaman", projeId: p.id, girdiler: {} });
    const sonra = await k.projeGetir(A, p.id);
    expect(new Date(sonra!.updatedAt).getTime()).toBeGreaterThan(new Date(p.updatedAt).getTime());
  });
});
