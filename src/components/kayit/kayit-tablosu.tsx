"use client";

/**
 * Projedeki (ya da projesiz) kayıtlı hesaplar tablosu: ad, hesap no + başlık, güncelleme, işlemler
 * (Aç, Kopyala, Taşı, Sil — taşıma ve silme satırın altında onaylanır). Aynı hesap türünden 2+ kayıt seçilince
 * "Karşılaştır" bağlantısı /karsilastir?kayitlar=<id>,<id>,… üretir; farklı türler seçiliyse düğme pasif ve açıklamalı.
 *
 * Satırlar sunucuda hazırlanır (hesap başlığı ve tarih metni): hesap tanımları istemci paketine girmesin,
 * tarih sunucu/istemcide aynı metinle gösterilsin. İşlemlerden sonra action'lar refresh() ile listeyi yeniler.
 */
import Link from "next/link";
import { Fragment, useId, useLayoutEffect, useState, useTransition, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { kayitKopyalaAction, kayitSilAction, kayitTasiAction } from "@/lib/kayit/actions";
import { eylemCagir } from "./eylem-cagir";
import { ALAN, IslemMesaji, kayitAdresi } from "./ortak";

export interface KayitSatiri {
  id: string;
  ad: string;
  notlar: string | null;
  hesapSlug: string;
  /** KAPSAM numarası */
  hesapId: string;
  hesapBaslik: string;
  /** Biçimlenmiş güncelleme zamanı (sunucuda) */
  guncelleme: string;
  guncellemeIso: string;
}

export interface ProjeSecenegi {
  id: string;
  ad: string;
}

/** Karşılaştırma sayfasının adresi (sayfa işçi B'nin) */
export function karsilastirmaAdresi(ids: string[]): string {
  return `/karsilastir?kayitlar=${ids.map(encodeURIComponent).join(",")}`;
}

/** Seçime göre karşılaştırma durumu */
export function karsilastirmaDurumu(secilenler: KayitSatiri[]): { uygun: true } | { uygun: false; neden: string } {
  if (new Set(secilenler.map((s) => s.hesapSlug)).size > 1) {
    return {
      uygun: false,
      neden: "Seçilen kayıtlar farklı hesap türlerinden. Yalnızca aynı türden kayıtlar karşılaştırılabilir.",
    };
  }
  if (secilenler.length < 2) {
    return { uygun: false, neden: "Karşılaştırmak için aynı hesap türünden en az 2 kayıt seçin." };
  }
  return { uygun: true };
}

type Mesaj = { tur: "ok" | "hata"; metin: string; girisGerekli?: boolean };
type SatirIslemi = { id: string; tur: "sil" | "tasi" };

export function KayitTablosu({
  kayitlar,
  projeler,
  projeId,
  girisYolu,
  bos,
}: {
  kayitlar: KayitSatiri[];
  /** Kullanıcının tüm projeleri (taşıma hedefleri) */
  projeler: ProjeSecenegi[];
  /** Tablonun bulunduğu proje; null: projesiz kayıtlar */
  projeId: string | null;
  /** Oturum sona ererse giriş sonrası dönülecek yol */
  girisYolu: string;
  bos: ReactNode;
}) {
  const baseId = useId();
  const [secimSirasi, setSecimSirasi] = useState<string[]>([]);
  const [islem, setIslem] = useState<SatirIslemi | null>(null);
  const [tasiHedef, setTasiHedef] = useState("");
  const [mesaj, setMesaj] = useState<Mesaj | null>(null);
  const [bekleyenId, setBekleyenId] = useState<string | null>(null);
  const [bekliyor, startTransition] = useTransition();

  // Activity sayfayı gizleyince onay satırları ve mesajlar sıfırlansın.
  useLayoutEffect(() => {
    return () => {
      setIslem(null);
      setMesaj(null);
    };
  }, []);

  const byId = new Map(kayitlar.map((k) => [k.id, k]));
  // Silinen/taşınan kayıtlar seçimden düşer.
  const secilenler = secimSirasi.flatMap((id) => byId.get(id) ?? []);
  const durum = karsilastirmaDurumu(secilenler);
  const hedefler: Array<{ id: string; ad: string }> = [
    ...(projeId !== null ? [{ id: "", ad: "Projesiz kayıtlar" }] : []),
    ...projeler.filter((p) => p.id !== projeId),
  ];

  function secimDegistir(id: string, secili: boolean) {
    setSecimSirasi((onceki) => (secili ? [...onceki.filter((x) => x !== id), id] : onceki.filter((x) => x !== id)));
  }

  function islemAc(sonraki: SatirIslemi | null) {
    setIslem(sonraki);
    setMesaj(null);
    if (sonraki?.tur === "tasi") setTasiHedef(hedefler[0]?.id ?? "");
  }

  function calistir(id: string, cagri: () => Promise<Mesaj>) {
    setBekleyenId(id);
    setMesaj(null);
    startTransition(async () => {
      const sonuc = await cagri();
      setMesaj(sonuc);
      if (sonuc.tur === "ok") setIslem(null);
      setBekleyenId(null);
    });
  }

  const kopyala = (k: KayitSatiri) =>
    calistir(k.id, async () => {
      const s = await eylemCagir(() => kayitKopyalaAction(k.id));
      return s.ok
        ? { tur: "ok", metin: `“${s.veri.ad}” oluşturuldu.` }
        : { tur: "hata", metin: s.hata, girisGerekli: s.girisGerekli };
    });

  const tasi = (k: KayitSatiri) =>
    calistir(k.id, async () => {
      const hedefAd = hedefler.find((h) => h.id === tasiHedef)?.ad ?? "Projesiz kayıtlar";
      const s = await eylemCagir(() => kayitTasiAction(k.id, tasiHedef === "" ? null : tasiHedef));
      return s.ok
        ? { tur: "ok", metin: `“${k.ad}” taşındı: ${hedefAd}.` }
        : { tur: "hata", metin: s.hata, girisGerekli: s.girisGerekli };
    });

  const sil = (k: KayitSatiri) =>
    calistir(k.id, async () => {
      const s = await eylemCagir(() => kayitSilAction(k.id));
      return s.ok
        ? { tur: "ok", metin: `“${k.ad}” silindi.` }
        : { tur: "hata", metin: s.hata, girisGerekli: s.girisGerekli };
    });

  const aciklamaId = `${baseId}-karsilastir`;

  return (
    <div className="space-y-3">
      <div aria-live="polite">
        {mesaj && (
          <IslemMesaji tur={mesaj.tur} girisYolu={mesaj.girisGerekli ? girisYolu : undefined}>
            {mesaj.metin}
          </IslemMesaji>
        )}
      </div>

      {kayitlar.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface px-4 py-6 text-sm text-muted">
          {bos}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {durum.uygun ? (
              <Link href={karsilastirmaAdresi(secilenler.map((s) => s.id))} className={buttonClass("primary")}>
                Karşılaştır ({secilenler.length})
              </Link>
            ) : (
              <button type="button" aria-disabled="true" aria-describedby={aciklamaId} className={buttonClass("secondary", "cursor-not-allowed opacity-60")}>
                Karşılaştır
              </button>
            )}
            <p id={aciklamaId} className="text-sm text-muted" aria-live="polite">
              {durum.uygun ? `${secilenler.length} kayıt seçildi: ${secilenler[0].hesapId} ${secilenler[0].hesapBaslik}` : durum.neden}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs text-muted">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2 font-medium">
                    <span className="sr-only">Karşılaştırmak için seç</span>
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Ad
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Hesap
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                    Güncelleme
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {kayitlar.map((k) => {
                  const satirBekliyor = bekliyor && bekleyenId === k.id;
                  const acikIslem = islem?.id === k.id ? islem.tur : null;
                  return (
                    <Fragment key={k.id}>
                      <tr className={acikIslem ? "bg-surface-muted/60" : undefined}>
                        <td className="px-3 py-2.5 align-top">
                          <input
                            type="checkbox"
                            checked={secimSirasi.includes(k.id)}
                            onChange={(e) => secimDegistir(k.id, e.target.checked)}
                            aria-label={`Karşılaştırmak için seç: ${k.ad}`}
                            className="mt-0.5 size-4 accent-accent"
                          />
                        </td>
                        <td className="max-w-[16rem] px-3 py-2.5 align-top">
                          <Link href={kayitAdresi(k.hesapSlug, k.id)} className="font-medium break-words hover:text-accent hover:underline">
                            {k.ad}
                          </Link>
                          {k.notlar && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{k.notlar}</p>}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="flex items-baseline gap-2">
                            <Badge tone="accent" mono>
                              <span className="sr-only">Kapsam no </span>
                              {k.hesapId}
                            </Badge>
                            <span>{k.hesapBaslik}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap text-muted tabular-nums">
                          <time dateTime={k.guncellemeIso}>{k.guncelleme}</time>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Link href={kayitAdresi(k.hesapSlug, k.id)} className={buttonClass("ghost", "px-2 py-1")} aria-label={`Aç: ${k.ad}`}>
                              Aç
                            </Link>
                            <Button variant="ghost" className="px-2 py-1" onClick={() => kopyala(k)} disabled={bekliyor} aria-label={`Kopyala: ${k.ad}`}>
                              {satirBekliyor && !acikIslem ? "Kopyalanıyor…" : "Kopyala"}
                            </Button>
                            {hedefler.length > 0 && (
                              <Button
                                variant="ghost"
                                className="px-2 py-1"
                                onClick={() => islemAc(acikIslem === "tasi" ? null : { id: k.id, tur: "tasi" })}
                                disabled={bekliyor}
                                aria-expanded={acikIslem === "tasi"}
                                aria-label={`Taşı: ${k.ad}`}
                              >
                                Taşı
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-hata hover:text-hata"
                              onClick={() => islemAc(acikIslem === "sil" ? null : { id: k.id, tur: "sil" })}
                              disabled={bekliyor}
                              aria-expanded={acikIslem === "sil"}
                              aria-label={`Sil: ${k.ad}`}
                            >
                              Sil
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {acikIslem && (
                        <tr className="bg-surface-muted/60">
                          <td colSpan={5} className="px-3 pt-1 pb-3">
                            {acikIslem === "sil" ? (
                              <div role="group" aria-label={`Silmeyi onayla: ${k.ad}`} className="flex flex-wrap items-center gap-2">
                                <p className="text-sm">
                                  <span className="font-medium">“{k.ad}”</span> kalıcı olarak silinsin mi?
                                </p>
                                <Button
                                  className="border-hata-line text-hata hover:bg-hata-bg"
                                  onClick={() => sil(k)}
                                  disabled={bekliyor}
                                >
                                  {satirBekliyor ? "Siliniyor…" : "Evet, sil"}
                                </Button>
                                <Button variant="ghost" onClick={() => islemAc(null)} disabled={bekliyor}>
                                  Vazgeç
                                </Button>
                              </div>
                            ) : (
                              <form
                                aria-label={`Taşı: ${k.ad}`}
                                className="flex flex-wrap items-end gap-2"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  tasi(k);
                                }}
                              >
                                <div className="min-w-0">
                                  <label htmlFor={`${baseId}-tasi-${k.id}`} className="block text-xs font-medium text-muted">
                                    Taşınacak yer
                                  </label>
                                  <select
                                    id={`${baseId}-tasi-${k.id}`}
                                    value={tasiHedef}
                                    onChange={(e) => setTasiHedef(e.target.value)}
                                    className={`${ALAN} mt-1 h-9 max-w-[18rem] py-1`}
                                  >
                                    {hedefler.map((h) => (
                                      <option key={h.id} value={h.id}>
                                        {h.ad}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <Button type="submit" variant="primary" disabled={bekliyor}>
                                  {satirBekliyor ? "Taşınıyor…" : "Taşı"}
                                </Button>
                                <Button variant="ghost" onClick={() => islemAc(null)} disabled={bekliyor}>
                                  Vazgeç
                                </Button>
                              </form>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
