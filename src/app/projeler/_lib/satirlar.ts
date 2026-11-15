/**
 * Kayıtlı hesapları tablo satırlarına çevirir (sunucuda): hesap başlığı kayıt defterinden, tarih Türkiye saatiyle
 * biçimlenir. Böylece hesap tanımları istemci paketine girmez ve tarih metni sunucu/istemcide aynı olur.
 */
import type { KayitSatiri, ProjeSecenegi } from "@/components/kayit/kayit-tablosu";
import { tarihMetni } from "@/components/kayit/ortak";
import { getCalc } from "@/lib/calc/registry";
import type { KayitliHesap, Proje } from "@/lib/kayit/types";

export function satirlaraCevir(kayitlar: KayitliHesap[]): KayitSatiri[] {
  return kayitlar.map((k) => {
    const def = getCalc(k.hesapSlug);
    return {
      id: k.id,
      ad: k.ad,
      notlar: k.notlar,
      hesapSlug: k.hesapSlug,
      hesapId: def?.id ?? k.hesapId,
      hesapBaslik: def?.title ?? "Bilinmeyen hesap",
      guncelleme: tarihMetni(k.updatedAt),
      guncellemeIso: k.updatedAt,
    };
  });
}

export function projeSecenekleri(projeler: Proje[]): ProjeSecenegi[] {
  return projeler.map((p) => ({ id: p.id, ad: p.ad }));
}
