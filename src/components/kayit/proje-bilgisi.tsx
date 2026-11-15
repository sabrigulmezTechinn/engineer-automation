"use client";

/**
 * Proje sayfasının başlığı: ad ve açıklama (düzenlenebilir) ve onaylı "Projeyi sil". Silme action'ı başarıda
 * /projeler'e yönlendirir; içindeki hesaplar silinmez, projesiz kayıtlara geçer.
 */
import { useId, useLayoutEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { projeGuncelleAction, projeSilAction } from "@/lib/kayit/actions";
import { PROJE_ACIKLAMA_MAX, PROJE_AD_MAX } from "@/lib/kayit/types";
import { eylemCagir } from "./eylem-cagir";
import { ALAN, ETIKET, IslemMesaji } from "./ortak";

type Mesaj = { tur: "ok" | "hata"; metin: string; girisGerekli?: boolean };

export function ProjeBilgisi({
  proje,
  guncelleme,
}: {
  proje: { id: string; ad: string; aciklama: string | null; hesapSayisi: number };
  /** Biçimlenmiş son güncelleme (sunucuda) */
  guncelleme: string;
}) {
  const baseId = useId();
  const [mod, setMod] = useState<"goster" | "duzenle" | "sil">("goster");
  const [ad, setAd] = useState(proje.ad);
  const [aciklama, setAciklama] = useState(proje.aciklama ?? "");
  const [adHatasi, setAdHatasi] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<Mesaj | null>(null);
  const [bekliyor, startTransition] = useTransition();
  const girisYolu = `/projeler/${proje.id}`;

  useLayoutEffect(() => {
    return () => {
      setMod("goster");
      setMesaj(null);
    };
  }, []);

  function duzenlemeyiAc() {
    setAd(proje.ad);
    setAciklama(proje.aciklama ?? "");
    setAdHatasi(null);
    setMesaj(null);
    setMod("duzenle");
  }

  function kaydet(e: FormEvent) {
    e.preventDefault();
    if (ad.trim() === "") {
      setAdHatasi("Proje adı boş olamaz.");
      return;
    }
    setAdHatasi(null);
    startTransition(async () => {
      const s = await eylemCagir(() => projeGuncelleAction(proje.id, { ad, aciklama: aciklama.trim() === "" ? null : aciklama }));
      if (s.ok) {
        setMod("goster");
        setMesaj({ tur: "ok", metin: "Proje güncellendi." });
      } else {
        setMesaj({ tur: "hata", metin: s.hata, girisGerekli: s.girisGerekli });
      }
    });
  }

  function sil() {
    setMesaj(null);
    startTransition(async () => {
      // Başarıda action /projeler'e yönlendirir (eylemCagir yönlendirmeyi yeniden fırlatır).
      const s = await eylemCagir(() => projeSilAction(proje.id));
      if (!s.ok) setMesaj({ tur: "hata", metin: s.hata, girisGerekli: s.girisGerekli });
    });
  }

  const adHataId = `${baseId}-ad-hata`;

  return (
    <div className="space-y-3">
      {mod === "duzenle" ? (
        <form onSubmit={kaydet} noValidate aria-label="Projeyi düzenle" className="max-w-2xl space-y-4 rounded-lg border border-line bg-surface p-4 sm:p-5">
          <div>
            <label htmlFor={`${baseId}-ad`} className={ETIKET}>
              Proje adı
            </label>
            <input
              id={`${baseId}-ad`}
              type="text"
              required
              maxLength={PROJE_AD_MAX}
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              aria-invalid={adHatasi ? true : undefined}
              aria-describedby={adHatasi ? adHataId : undefined}
              className={`${ALAN} mt-1.5`}
            />
            {adHatasi && (
              <p id={adHataId} className="mt-1.5 text-xs font-medium text-hata">
                {adHatasi}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${baseId}-aciklama`} className={ETIKET}>
              Açıklama <span className="font-normal text-muted">(isteğe bağlı)</span>
            </label>
            <textarea
              id={`${baseId}-aciklama`}
              rows={3}
              maxLength={PROJE_ACIKLAMA_MAX}
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              className={`${ALAN} mt-1.5 resize-y`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={bekliyor}>
              {bekliyor ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button variant="ghost" onClick={() => setMod("goster")} disabled={bekliyor}>
              Vazgeç
            </Button>
          </div>
        </form>
      ) : (
        <header>
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{proje.ad}</h1>
          {proje.aciklama ? (
            <p className="mt-2 max-w-3xl leading-relaxed whitespace-pre-line text-muted">{proje.aciklama}</p>
          ) : null}
          <p className="mt-2 text-sm text-muted">
            {proje.hesapSayisi} kayıtlı hesap · Son güncelleme {guncelleme}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={duzenlemeyiAc} disabled={bekliyor}>
              Adı ve açıklamayı düzenle
            </Button>
            <Button
              variant="ghost"
              className="text-hata hover:text-hata"
              onClick={() => setMod(mod === "sil" ? "goster" : "sil")}
              disabled={bekliyor}
              aria-expanded={mod === "sil"}
            >
              Projeyi sil
            </Button>
          </div>
        </header>
      )}

      {mod === "sil" && (
        <div role="group" aria-label="Projeyi silmeyi onayla" className="max-w-2xl rounded-lg border border-hata-line bg-hata-bg p-4 text-sm">
          <p>
            <span className="font-medium">“{proje.ad}”</span> silinsin mi?{" "}
            {proje.hesapSayisi > 0
              ? `İçindeki ${proje.hesapSayisi} hesap silinmez; projesiz kayıtlara taşınır.`
              : "Projede kayıtlı hesap yok."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="border-hata-line text-hata hover:bg-surface" onClick={sil} disabled={bekliyor}>
              {bekliyor ? "Siliniyor…" : "Evet, projeyi sil"}
            </Button>
            <Button variant="ghost" onClick={() => setMod("goster")} disabled={bekliyor}>
              Vazgeç
            </Button>
          </div>
        </div>
      )}

      <div aria-live="polite">
        {mesaj && (
          <IslemMesaji tur={mesaj.tur} girisYolu={mesaj.girisGerekli ? girisYolu : undefined} className="max-w-2xl">
            {mesaj.metin}
          </IslemMesaji>
        )}
      </div>
    </div>
  );
}
