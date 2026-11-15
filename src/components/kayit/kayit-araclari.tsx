"use client";

/**
 * Hesap sayfasında kaydetme araçları (Kaydet / Farklı kaydet / proje seçimi / kayıtlı hesap bilgisi).
 * Oturum yoksa "Kaydetmek için giriş yapın" bağlantısı.
 *
 * - Kayıtsız hesap: "Kaydet" satır içi paneli açar; kaydedince /hesaplar/<slug>?kayit=<id> adresine geçilir
 *   (sayfa kayıtla yeniden açılır; geçmişte kayıtsız adresin yerini alır).
 * - Kayıtlı hesap: ad ve proje görünür; "Kaydet" aynı kayda `calc.state` + `calc.outputUnits` yazar;
 *   "Farklı kaydet" yeni kayıt oluşturur (geçmişe eklenir). Kayıtlı durumdan farklıysa "Kaydedilmemiş
 *   değişiklik" göstergesi (karşılaştırma kanonik biçimde: src/lib/kayit/degisiklik.ts).
 * - Proje listesi panel açılınca, kayıtlı hesabın proje adı için de sayfa açılınca server action ile çekilir
 *   (bileşen imzası sabit olduğu için sunucudan prop olarak gelemiyor).
 * - Sayfa Activity ile gizlenince panel ve mesajlar sıfırlanır (geri dönüldüğünde bayat durum kalmasın).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useState, useTransition } from "react";
import { loginPath } from "@/app/(auth)/_lib/redirect";
import type { CalcStateApi } from "@/components/calc/use-calc-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { kayitGuncelleAction, kayitOlusturAction, projeleriGetirAction } from "@/lib/kayit/actions";
import { kaydedilmemisDegisiklikVar } from "@/lib/kayit/degisiklik";
import type { KayitliHesap, Proje } from "@/lib/kayit/types";
import { eylemCagir } from "./eylem-cagir";
import { KaydetPaneli, type KaydetPaneliGirdisi } from "./kaydet-paneli";
import { IslemMesaji, kayitAdresi } from "./ortak";

export function KayitAraclari({ calc, kayit, girisYapildi }: { calc: CalcStateApi; kayit?: KayitliHesap | null; girisYapildi: boolean }) {
  if (!girisYapildi) {
    // Oturumsuz kullanıcıda açık bir kayıt olamaz: dönüş yolu hesabın kendi adresi.
    return (
      <p className="text-sm text-muted">
        <Link
          href={loginPath(`/hesaplar/${calc.def.slug}`)}
          className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Kaydetmek için giriş yapın
        </Link>
      </p>
    );
  }
  return <GirisliAraclar calc={calc} kayit={kayit ?? null} />;
}

type Mesaj = { tur: "ok" | "hata"; metin: string; girisGerekli?: boolean };

function GirisliAraclar({ calc, kayit }: { calc: CalcStateApi; kayit: KayitliHesap | null }) {
  const router = useRouter();
  const panelId = useId();
  const slug = calc.def.slug;

  // Sunucudan gelen kayıt (refresh sonrası yenisi) ya da son başarılı kaydetmenin sonucu.
  const [kayitli, setKayitli] = useState(kayit);
  const [oncekiKayit, setOncekiKayit] = useState(kayit);
  if (kayit !== oncekiKayit) {
    setOncekiKayit(kayit);
    setKayitli(kayit);
  }

  const [panel, setPanel] = useState<null | "yeni" | "farkli">(null);
  const [panelHatasi, setPanelHatasi] = useState<Mesaj | null>(null);
  const [mesaj, setMesaj] = useState<Mesaj | null>(null);
  const [projeler, setProjeler] = useState<Proje[] | null>(null);
  const [projeHatasi, setProjeHatasi] = useState<string | null>(null);
  const [bekliyor, startTransition] = useTransition();

  // Activity sayfayı gizleyince (başka sayfaya geçiş) panel ve mesajlar sıfırlansın.
  useLayoutEffect(() => {
    return () => {
      setPanel(null);
      setPanelHatasi(null);
      setMesaj(null);
    };
  }, []);

  const projeleriYukle = useCallback(async () => {
    const sonuc = await eylemCagir(() => projeleriGetirAction());
    if (sonuc.ok) {
      setProjeler(sonuc.veri);
      setProjeHatasi(null);
    } else {
      setProjeHatasi("Projeler yüklenemedi; kaydı projesiz kaydedebilir ya da yeni proje oluşturabilirsiniz.");
    }
  }, []);

  // Kayıtlı hesabın proje adı için
  const kayitliProjeId = kayitli?.projeId ?? null;
  useEffect(() => {
    if (!kayitliProjeId) return;
    let gecerli = true;
    projeleriGetirAction().then(
      (sonuc) => {
        if (gecerli && sonuc.ok) setProjeler(sonuc.veri);
      },
      () => {}, // proje adı gösterilemezse "Projeyi aç" bağlantısı kalır
    );
    return () => {
      gecerli = false;
    };
  }, [kayitliProjeId]);

  const degisti = useMemo(
    () =>
      kayitli !== null &&
      kaydedilmemisDegisiklikVar(calc.def, kayitli, { state: calc.state, outputUnits: calc.outputUnits }),
    [calc.def, calc.state, calc.outputUnits, kayitli],
  );

  const girisYolu = kayitli ? kayitAdresi(slug, kayitli.id) : `/hesaplar/${slug}`;

  function paneliAc(tur: "yeni" | "farkli") {
    setPanel(tur);
    setPanelHatasi(null);
    setMesaj(null);
    void projeleriYukle();
  }

  function paneliKapat() {
    setPanel(null);
    setPanelHatasi(null);
  }

  function yeniKayit(girdi: KaydetPaneliGirdisi) {
    const farkli = panel === "farkli";
    startTransition(async () => {
      const sonuc = await eylemCagir(() =>
        kayitOlusturAction({
          hesapSlug: slug,
          ad: girdi.ad,
          notlar: girdi.notlar,
          projeId: girdi.projeId,
          yeniProjeAdi: girdi.yeniProjeAdi,
          girdiler: calc.state,
          ciktiBirimleri: calc.outputUnits,
        }),
      );
      if (!sonuc.ok) {
        setPanelHatasi({ tur: "hata", metin: sonuc.hata, girisGerekli: sonuc.girisGerekli });
        return;
      }
      // Gezinmeden önce sıfırla: Activity bu sayfayı korursa geri dönüldüğünde panel açık kalmasın.
      setPanel(null);
      setPanelHatasi(null);
      const adres = kayitAdresi(slug, sonuc.veri.id);
      if (farkli) router.push(adres);
      else router.replace(adres);
    });
  }

  function ayniKayda() {
    if (!kayitli) return;
    setMesaj(null);
    startTransition(async () => {
      const sonuc = await eylemCagir(() =>
        kayitGuncelleAction(kayitli.id, { girdiler: calc.state, ciktiBirimleri: calc.outputUnits }),
      );
      if (sonuc.ok) {
        setKayitli(sonuc.veri);
        setMesaj({ tur: "ok", metin: "Değişiklikler kaydedildi." });
      } else {
        setMesaj({ tur: "hata", metin: sonuc.hata, girisGerekli: sonuc.girisGerekli });
      }
    });
  }

  const panelAcik = panel !== null;
  const projeAdi = kayitliProjeId ? projeler?.find((p) => p.id === kayitliProjeId)?.ad : undefined;

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {kayitli ? (
          <>
            <div className="min-w-0 text-sm">
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                <span className="text-muted">Kayıtlı hesap:</span>
                <span className="font-semibold break-words">{kayitli.ad}</span>
              </p>
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-muted">
                <span>Proje:</span>
                {kayitliProjeId ? (
                  <Link href={`/projeler/${kayitliProjeId}`} className="font-medium text-accent hover:underline">
                    {projeAdi ?? "Projeyi aç"}
                  </Link>
                ) : (
                  <Link href="/projeler#projesiz" className="font-medium text-accent hover:underline">
                    Projesiz
                  </Link>
                )}
              </p>
            </div>
            <span role="status" className="contents">
              {degisti && <Badge tone="uyari">Kaydedilmemiş değişiklik</Badge>}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={ayniKayda} disabled={bekliyor || panelAcik}>
                {bekliyor && !panelAcik ? "Kaydediliyor…" : "Kaydet"}
              </Button>
              <Button
                onClick={() => (panel === "farkli" ? paneliKapat() : paneliAc("farkli"))}
                disabled={bekliyor}
                aria-expanded={panel === "farkli"}
                aria-controls={panelId}
              >
                Farklı kaydet
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="primary"
            onClick={() => (panel === "yeni" ? paneliKapat() : paneliAc("yeni"))}
            disabled={bekliyor}
            aria-expanded={panel === "yeni"}
            aria-controls={panelId}
          >
            Kaydet
          </Button>
        )}
      </div>

      {mesaj && !(mesaj.tur === "ok" && degisti) && (
        <IslemMesaji tur={mesaj.tur} girisYolu={mesaj.girisGerekli ? girisYolu : undefined}>
          {mesaj.metin}
        </IslemMesaji>
      )}

      {panel && (
        <KaydetPaneli
          key={panel}
          id={panelId}
          baslik={panel === "farkli" ? "Farklı kaydet" : "Hesabı kaydet"}
          varsayilanAd={panel === "farkli" && kayitli ? kayitli.ad : calc.def.title}
          varsayilanProjeId={panel === "farkli" && kayitli ? kayitli.projeId : null}
          varsayilanNot={panel === "farkli" && kayitli ? kayitli.notlar : null}
          projeler={projeler}
          projeHatasi={projeHatasi}
          bekliyor={bekliyor}
          hata={panelHatasi?.metin}
          girisYolu={panelHatasi?.girisGerekli ? girisYolu : undefined}
          onKaydet={yeniKayit}
          onVazgec={paneliKapat}
        />
      )}
    </div>
  );
}
