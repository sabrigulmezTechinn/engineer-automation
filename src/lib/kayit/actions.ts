"use server";

/**
 * Kayıt/proje server action'ları. Her dışa aktarım herkese açık bir POST uç noktasıdır: oturum her birinde
 * yeniden okunur, kullanıcı kimliği yalnızca oturumdan alınır (istemciden gelen hiçbir alan kimlik sayılmaz),
 * gövdeler zod ile doğrulanır, girdiler veri katmanında hesap tanımına göre süzülür.
 *
 * Yenileme: değişikliklerden sonra `refresh()` (next/cache) çağrılır. Bu, mevcut sayfayı aynı yanıtta yeniden
 * oluşturur ve istemcideki dinamik veri önbelleğini (bfcache) geçersiz kılar; daha önce ziyaret edilmiş
 * /projeler gibi sayfalar sonraki gezinmede taze veriyle gelir. Bu sayfalar 'use cache' kullanmadığı için
 * revalidatePath gerekmez. Proje silme kendi sayfasında çağrıldığından /projeler'e yönlendirir (refresh o
 * sayfayı "bulunamadı" olarak yeniden oluştururdu).
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  OTURUM_HATASI,
  cozumle,
  hataSonucu,
  kayitGuncelleSemasi,
  kayitOlusturSemasi,
  kimlikSemasi,
  projeGuncelleSemasi,
  projeIdSemasi,
  projeOlusturSemasi,
  type EylemSonucu,
} from "./eylem";
import {
  hesapGuncelle,
  hesapKaydet,
  hesapKopyala,
  hesapSil,
  projeGuncelle,
  projeOlustur,
  projeSil,
  projeleriListele,
} from "./islemler";
import { getCalc } from "@/lib/calc/registry";
import type { KayitliHesap, Proje } from "./types";

type OturumHatasi = { ok: false; hata: string; girisGerekli: true };

/** Oturumdaki kullanıcının kimliği ya da oturum hatası */
async function kullanici(): Promise<{ userId: string } | OturumHatasi> {
  const session = await getSession().catch(() => null);
  if (!session) return { ok: false, hata: OTURUM_HATASI, girisGerekli: true };
  return { userId: session.user.id };
}

/** Kaydetme panelindeki proje seçimi için kullanıcının projeleri */
export async function projeleriGetirAction(): Promise<EylemSonucu<Proje[]>> {
  const k = await kullanici();
  if ("ok" in k) return k;
  try {
    return { ok: true, veri: await projeleriListele(k.userId) };
  } catch (error) {
    return hataSonucu(error);
  }
}

/** Yeni kayıt (Kaydet / Farklı kaydet). İstenirse önce yeni proje oluşturur. */
export async function kayitOlusturAction(istek: unknown): Promise<EylemSonucu<KayitliHesap>> {
  const k = await kullanici();
  if ("ok" in k) return k;
  const g = cozumle(kayitOlusturSemasi, istek);
  if (!g.ok) return g;
  // Proje oluşturmadan önce kaydın geçerli olduğundan emin ol (başarısız kayıt boş proje bırakmasın).
  if (!getCalc(g.veri.hesapSlug)) return { ok: false, hata: "Bilinmeyen hesap türü." };

  try {
    let projeId = g.veri.projeId ?? null;
    if (g.veri.yeniProjeAdi !== undefined) {
      projeId = (await projeOlustur(k.userId, { ad: g.veri.yeniProjeAdi })).id;
    }
    const kayit = await hesapKaydet(k.userId, {
      hesapSlug: g.veri.hesapSlug,
      ad: g.veri.ad,
      notlar: g.veri.notlar ?? null,
      projeId,
      girdiler: g.veri.girdiler,
      ciktiBirimleri: g.veri.ciktiBirimleri,
    });
    refresh();
    return { ok: true, veri: kayit };
  } catch (error) {
    return hataSonucu(error);
  }
}

/** Kayıtlı hesabı günceller (Kaydet: girdiler + çıktı birimleri; ad/not; taşıma). */
export async function kayitGuncelleAction(id: unknown, istek: unknown): Promise<EylemSonucu<KayitliHesap>> {
  const k = await kullanici();
  if ("ok" in k) return k;
  const kid = cozumle(kimlikSemasi, id);
  if (!kid.ok) return kid;
  const g = cozumle(kayitGuncelleSemasi, istek);
  if (!g.ok) return g;
  try {
    const kayit = await hesapGuncelle(k.userId, kid.veri, g.veri);
    refresh();
    return { ok: true, veri: kayit };
  } catch (error) {
    return hataSonucu(error);
  }
}

/** Kaydı başka bir projeye ya da projesiz kayıtlara (null) taşır. */
export async function kayitTasiAction(id: unknown, projeId: unknown): Promise<EylemSonucu<KayitliHesap>> {
  const k = await kullanici();
  if ("ok" in k) return k;
  const kid = cozumle(kimlikSemasi, id);
  if (!kid.ok) return kid;
  const pid = cozumle(projeIdSemasi, projeId);
  if (!pid.ok) return pid;
  try {
    const kayit = await hesapGuncelle(k.userId, kid.veri, { projeId: pid.veri });
    refresh();
    return { ok: true, veri: kayit };
  } catch (error) {
    return hataSonucu(error);
  }
}

/** Aynı projede "<ad> (kopya)" */
export async function kayitKopyalaAction(id: unknown): Promise<EylemSonucu<KayitliHesap>> {
  const k = await kullanici();
  if ("ok" in k) return k;
  const kid = cozumle(kimlikSemasi, id);
  if (!kid.ok) return kid;
  try {
    const kayit = await hesapKopyala(k.userId, kid.veri);
    refresh();
    return { ok: true, veri: kayit };
  } catch (error) {
    return hataSonucu(error);
  }
}

export async function kayitSilAction(id: unknown): Promise<EylemSonucu> {
  const k = await kullanici();
  if ("ok" in k) return k;
  const kid = cozumle(kimlikSemasi, id);
  if (!kid.ok) return kid;
  try {
    await hesapSil(k.userId, kid.veri);
    refresh();
    return { ok: true, veri: null };
  } catch (error) {
    return hataSonucu(error);
  }
}

export async function projeOlusturAction(istek: unknown): Promise<EylemSonucu<Proje>> {
  const k = await kullanici();
  if ("ok" in k) return k;
  const g = cozumle(projeOlusturSemasi, istek);
  if (!g.ok) return g;
  try {
    const proje = await projeOlustur(k.userId, g.veri);
    refresh();
    return { ok: true, veri: proje };
  } catch (error) {
    return hataSonucu(error);
  }
}

/** Proje adı/açıklaması */
export async function projeGuncelleAction(id: unknown, istek: unknown): Promise<EylemSonucu<Proje>> {
  const k = await kullanici();
  if ("ok" in k) return k;
  const kid = cozumle(kimlikSemasi, id);
  if (!kid.ok) return kid;
  const g = cozumle(projeGuncelleSemasi, istek);
  if (!g.ok) return g;
  try {
    const proje = await projeGuncelle(k.userId, kid.veri, g.veri);
    refresh();
    return { ok: true, veri: proje };
  } catch (error) {
    return hataSonucu(error);
  }
}

/**
 * Projeyi siler (içindeki hesaplar projesiz kalır) ve başarıda /projeler'e yönlendirir; yalnızca hata
 * durumunda değer döner.
 */
export async function projeSilAction(id: unknown): Promise<EylemSonucu> {
  const k = await kullanici();
  if ("ok" in k) return k;
  const kid = cozumle(kimlikSemasi, id);
  if (!kid.ok) return kid;
  try {
    await projeSil(k.userId, kid.veri);
  } catch (error) {
    return hataSonucu(error);
  }
  // redirect bir denetim akışı istisnası fırlatır: try dışında çağrılmalı.
  redirect("/projeler");
}
