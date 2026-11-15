/**
 * Kayıtlı hesap karşılaştırmasının sunucu tarafı hazırlığı (/karsilastir?kayitlar=<id>,<id>).
 * Kayıtlar yalnızca oturumdaki kullanıcıya göre süzülerek okunur (hesaplariGetir); bulunamayan ya da başkasına ait
 * kayıt ayırt edilmeden "bulunamadı" sayılır. Sonuç istemciye geçebilen düz JSON'dur.
 */
import { defaultState } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import { SENARYO_SINIRI } from "@/lib/karsilastirma";
import type { Senaryo } from "@/lib/karsilastirma/types";
import { hesaplariGetir } from "@/lib/kayit/islemler";

/** Kayıt kimliği biçimi (kayitli_hesap.id metin; uuid/nanoid gibi). Diğerleri sorguya hiç gitmez. */
const KIMLIK = /^[A-Za-z0-9_-]{1,100}$/;

export type KimlikAyiklama =
  | { durum: "tamam"; kimlikler: string[] }
  | { durum: "bos" }
  | { durum: "fazla" }
  | { durum: "gecersiz" };

/**
 * `kayitlar` arama parametresini ayıklar: virgülle ayrılmış ya da tekrarlanan değerler; boşluklar kırpılır,
 * tekrarlar atılır (ilk sıra korunur). En çok SENARYO_SINIRI kayıt.
 */
export function kayitKimlikleriniAyikla(param: string | string[] | undefined): KimlikAyiklama {
  const ham = (Array.isArray(param) ? param : param === undefined ? [] : [param])
    .flatMap((p) => p.split(","))
    .map((p) => p.trim())
    .filter((p) => p !== "");
  const kimlikler = [...new Set(ham)];
  if (kimlikler.length === 0) return { durum: "bos" };
  if (kimlikler.length > SENARYO_SINIRI) return { durum: "fazla" };
  if (!kimlikler.every((k) => KIMLIK.test(k))) return { durum: "gecersiz" };
  return { durum: "tamam", kimlikler };
}

export type KarsilastirmaHazirligi =
  | { durum: "bulunamadi" }
  | { durum: "farkliHesap"; hesaplar: string[] }
  | {
      durum: "tamam";
      hesapSlug: string;
      senaryolar: Senaryo[];
      /** Ortak çıktı birimleri: ilk kaydın seçimleri (girdilerde de ilk senaryonun birimi esas alınır). */
      outputUnits: Record<string, string>;
    };

/**
 * Kayıtları okuyup karşılaştırma senaryolarına çevirir. Kayıtlar aynı hesap türünden olmalıdır.
 * Senaryo durumu, hesap sayfasındaki gibi tanımın varsayılanlarıyla tamamlanır (tanıma sonradan eklenen girdiler).
 */
export async function kayitKarsilastirmasiHazirla(userId: string, kimlikler: string[]): Promise<KarsilastirmaHazirligi> {
  const kayitlar = await hesaplariGetir(userId, kimlikler);
  // Biri bile eksikse (yok ya da başkasının) hangisi olduğu söylenmez.
  if (kayitlar.length !== kimlikler.length || kayitlar.length === 0) return { durum: "bulunamadi" };

  const sluglar = [...new Set(kayitlar.map((k) => k.hesapSlug))];
  if (sluglar.length > 1) {
    return { durum: "farkliHesap", hesaplar: sluglar.map((s) => getCalc(s)?.title ?? s) };
  }
  const def = getCalc(sluglar[0]);
  if (!def) return { durum: "bulunamadi" };

  const sirali = kimlikler.map((k) => kayitlar.find((x) => x.id === k)).filter((x) => x !== undefined);
  if (sirali.length !== kimlikler.length) return { durum: "bulunamadi" };

  return {
    durum: "tamam",
    hesapSlug: def.slug,
    senaryolar: sirali.map((k) => ({
      id: k.id,
      ad: k.ad,
      kayitId: k.id,
      state: { ...defaultState(def), ...k.girdiler },
    })),
    outputUnits: { ...sirali[0].ciktiBirimleri },
  };
}
