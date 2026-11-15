"use client";

/**
 * Hesap sayfasında "Kaydet" / "Farklı kaydet" paneli: ad (zorunlu), proje seçimi (mevcut projeler, "Yeni proje…",
 * "Projesiz") ve not. Satır içi paneldir (modal değil); Esc ya da "Vazgeç" ile kapanır, açılınca ad alanına odaklanır.
 * Gönderimi üst bileşen yapar (`onKaydet`); hata metni dönerse panelde gösterilir.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { KAYIT_AD_MAX, KAYIT_NOT_MAX, PROJE_AD_MAX, type Proje } from "@/lib/kayit/types";
import { ALAN, ETIKET, IslemMesaji } from "./ortak";

export const YENI_PROJE = "__yeni__";
const PROJESIZ = "";

export interface KaydetPaneliGirdisi {
  ad: string;
  notlar: string | null;
  /** null: projesiz */
  projeId: string | null;
  /** Verilirse bu adla yeni proje oluşturulup kayıt oraya yazılır */
  yeniProjeAdi?: string;
}

export function KaydetPaneli({
  id,
  baslik,
  varsayilanAd,
  varsayilanProjeId,
  varsayilanNot,
  projeler,
  projeHatasi,
  bekliyor,
  hata,
  girisYolu,
  onKaydet,
  onVazgec,
}: {
  id: string;
  baslik: string;
  varsayilanAd: string;
  varsayilanProjeId: string | null;
  varsayilanNot?: string | null;
  /** null: yükleniyor */
  projeler: Proje[] | null;
  projeHatasi?: string | null;
  bekliyor: boolean;
  hata?: string | null;
  /** Oturum sona erdiyse giriş bağlantısının dönüş yolu */
  girisYolu?: string;
  onKaydet: (girdi: KaydetPaneliGirdisi) => void;
  onVazgec: () => void;
}) {
  const baseId = useId();
  const adRef = useRef<HTMLInputElement>(null);
  const yeniProjeRef = useRef<HTMLInputElement>(null);
  const [ad, setAd] = useState(varsayilanAd);
  const [proje, setProje] = useState(varsayilanProjeId ?? PROJESIZ);
  const [yeniProjeAdi, setYeniProjeAdi] = useState("");
  const [notlar, setNotlar] = useState(varsayilanNot ?? "");
  const [alanHatasi, setAlanHatasi] = useState<{ alan: "ad" | "proje"; metin: string } | null>(null);

  useEffect(() => {
    // Paneli açan öğe (Kaydet / Farklı kaydet düğmesi): panel kapanınca odak ona geri verilir (Esc, Vazgeç).
    const acan = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    adRef.current?.focus();
    adRef.current?.select();
    return () => {
      // Odak kaldırılan panelle birlikte gövdeye düştüyse geri ver; kullanıcı başka yere geçtiyse dokunma.
      const aktif = document.activeElement;
      if (acan?.isConnected && (aktif === null || aktif === document.body)) acan.focus();
    };
  }, []);

  function gonder(e: FormEvent) {
    e.preventDefault();
    if (bekliyor) return;
    if (ad.trim() === "") {
      setAlanHatasi({ alan: "ad", metin: "Kayıt adı boş olamaz." });
      adRef.current?.focus();
      return;
    }
    if (proje === YENI_PROJE && yeniProjeAdi.trim() === "") {
      setAlanHatasi({ alan: "proje", metin: "Yeni projenin adını yazın." });
      yeniProjeRef.current?.focus();
      return;
    }
    setAlanHatasi(null);
    onKaydet({
      ad: ad.trim(),
      notlar: notlar.trim() === "" ? null : notlar.trim(),
      projeId: proje === YENI_PROJE || proje === PROJESIZ ? null : proje,
      yeniProjeAdi: proje === YENI_PROJE ? yeniProjeAdi.trim() : undefined,
    });
  }

  const adHataId = `${baseId}-ad-hata`;
  const projeHataId = `${baseId}-proje-hata`;
  const projeIpucuId = `${baseId}-proje-ipucu`;
  // Kayıtlı projesi listede yoksa (liste yüklenmedi ya da bu arada silindi) seçim yine görünsün.
  const secimListedeYok = proje !== PROJESIZ && proje !== YENI_PROJE && !projeler?.some((p) => p.id === proje);

  return (
    <section
      id={id}
      aria-labelledby={`${baseId}-baslik`}
      className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !bekliyor) {
          e.stopPropagation();
          onVazgec();
        }
      }}
    >
      <h3 id={`${baseId}-baslik`} className="font-semibold">
        {baslik}
      </h3>
      <form onSubmit={gonder} noValidate className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${baseId}-ad`} className={ETIKET}>
            Kayıt adı
          </label>
          <input
            ref={adRef}
            id={`${baseId}-ad`}
            name="ad"
            type="text"
            required
            maxLength={KAYIT_AD_MAX}
            value={ad}
            onChange={(e) => setAd(e.target.value)}
            aria-invalid={alanHatasi?.alan === "ad" ? true : undefined}
            aria-describedby={alanHatasi?.alan === "ad" ? adHataId : undefined}
            className={`${ALAN} mt-1.5`}
          />
          {alanHatasi?.alan === "ad" && (
            <p id={adHataId} className="mt-1.5 text-xs font-medium text-hata">
              {alanHatasi.metin}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${baseId}-proje`} className={ETIKET}>
            Proje
          </label>
          <select
            id={`${baseId}-proje`}
            name="proje"
            value={proje}
            onChange={(e) => {
              setProje(e.target.value);
              if (alanHatasi?.alan === "proje") setAlanHatasi(null);
            }}
            aria-describedby={projeler === null || projeHatasi ? projeIpucuId : undefined}
            className={`${ALAN} mt-1.5 h-[2.375rem]`}
          >
            <option value={PROJESIZ}>Projesiz</option>
            {secimListedeYok && <option value={proje}>Mevcut proje</option>}
            {projeler?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ad}
              </option>
            ))}
            <option value={YENI_PROJE}>Yeni proje…</option>
          </select>
          {(projeler === null || projeHatasi) && (
            <p id={projeIpucuId} className="mt-1.5 text-xs text-muted">
              {projeHatasi ?? "Projeleriniz yükleniyor…"}
            </p>
          )}
        </div>

        {proje === YENI_PROJE && (
          <div className="sm:col-span-2">
            <label htmlFor={`${baseId}-yeni-proje`} className={ETIKET}>
              Yeni proje adı
            </label>
            <input
              ref={yeniProjeRef}
              id={`${baseId}-yeni-proje`}
              name="yeniProjeAdi"
              type="text"
              required
              maxLength={PROJE_AD_MAX}
              value={yeniProjeAdi}
              onChange={(e) => setYeniProjeAdi(e.target.value)}
              aria-invalid={alanHatasi?.alan === "proje" ? true : undefined}
              aria-describedby={alanHatasi?.alan === "proje" ? projeHataId : undefined}
              className={`${ALAN} mt-1.5`}
            />
            {alanHatasi?.alan === "proje" && (
              <p id={projeHataId} className="mt-1.5 text-xs font-medium text-hata">
                {alanHatasi.metin}
              </p>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor={`${baseId}-not`} className={ETIKET}>
            Not <span className="font-normal text-muted">(isteğe bağlı)</span>
          </label>
          <textarea
            id={`${baseId}-not`}
            name="notlar"
            rows={2}
            maxLength={KAYIT_NOT_MAX}
            value={notlar}
            onChange={(e) => setNotlar(e.target.value)}
            className={`${ALAN} mt-1.5 resize-y`}
          />
        </div>

        {hata && (
          <IslemMesaji tur="hata" girisYolu={girisYolu} className="sm:col-span-2">
            {hata}
          </IslemMesaji>
        )}

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" variant="primary" disabled={bekliyor} aria-disabled={bekliyor}>
            {bekliyor ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <Button onClick={onVazgec} disabled={bekliyor}>
            Vazgeç
          </Button>
        </div>
      </form>
    </section>
  );
}
