"use client";

/**
 * /projeler sayfasında "Yeni proje": satır içi form (ad, açıklama). Oluşturunca proje sayfasına geçilir.
 */
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { projeOlusturAction } from "@/lib/kayit/actions";
import { PROJE_ACIKLAMA_MAX, PROJE_AD_MAX } from "@/lib/kayit/types";
import { eylemCagir } from "./eylem-cagir";
import { ALAN, ETIKET, IslemMesaji } from "./ortak";

export function YeniProje() {
  const router = useRouter();
  const baseId = useId();
  const [acik, setAcik] = useState(false);

  // Activity sayfayı gizleyince form kapansın.
  useLayoutEffect(() => {
    return () => setAcik(false);
  }, []);

  return (
    <div>
      <Button variant="primary" onClick={() => setAcik((a) => !a)} aria-expanded={acik} aria-controls={`${baseId}-form`}>
        Yeni proje
      </Button>
      {acik && (
        <YeniProjeFormu
          id={`${baseId}-form`}
          onVazgec={() => setAcik(false)}
          onOlustu={(id) => {
            setAcik(false);
            router.push(`/projeler/${encodeURIComponent(id)}`);
          }}
        />
      )}
    </div>
  );
}

function YeniProjeFormu({ id, onVazgec, onOlustu }: { id: string; onVazgec: () => void; onOlustu: (id: string) => void }) {
  const adRef = useRef<HTMLInputElement>(null);
  const [ad, setAd] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [hata, setHata] = useState<{ metin: string; alan?: "ad"; girisGerekli?: boolean } | null>(null);
  const [bekliyor, startTransition] = useTransition();

  useEffect(() => {
    adRef.current?.focus();
  }, []);

  function gonder(e: FormEvent) {
    e.preventDefault();
    if (ad.trim() === "") {
      setHata({ metin: "Proje adı boş olamaz.", alan: "ad" });
      adRef.current?.focus();
      return;
    }
    setHata(null);
    startTransition(async () => {
      const s = await eylemCagir(() => projeOlusturAction({ ad, aciklama: aciklama.trim() === "" ? null : aciklama }));
      if (s.ok) onOlustu(s.veri.id);
      else setHata({ metin: s.hata, girisGerekli: s.girisGerekli });
    });
  }

  const adHataId = `${id}-ad-hata`;

  return (
    <form
      id={id}
      onSubmit={gonder}
      noValidate
      aria-label="Yeni proje"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !bekliyor) onVazgec();
      }}
      className="mt-3 max-w-2xl space-y-4 rounded-lg border border-line bg-surface p-4 sm:p-5"
    >
      <div>
        <label htmlFor={`${id}-ad`} className={ETIKET}>
          Proje adı
        </label>
        <input
          ref={adRef}
          id={`${id}-ad`}
          type="text"
          required
          maxLength={PROJE_AD_MAX}
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          aria-invalid={hata?.alan === "ad" ? true : undefined}
          aria-describedby={hata?.alan === "ad" ? adHataId : undefined}
          className={`${ALAN} mt-1.5`}
        />
        {hata?.alan === "ad" && (
          <p id={adHataId} className="mt-1.5 text-xs font-medium text-hata">
            {hata.metin}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-aciklama`} className={ETIKET}>
          Açıklama <span className="font-normal text-muted">(isteğe bağlı)</span>
        </label>
        <textarea
          id={`${id}-aciklama`}
          rows={2}
          maxLength={PROJE_ACIKLAMA_MAX}
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          className={`${ALAN} mt-1.5 resize-y`}
        />
      </div>
      {hata && !hata.alan && (
        <IslemMesaji tur="hata" girisYolu={hata.girisGerekli ? "/projeler" : undefined}>
          {hata.metin}
        </IslemMesaji>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={bekliyor}>
          {bekliyor ? "Oluşturuluyor…" : "Oluştur"}
        </Button>
        <Button variant="ghost" onClick={onVazgec} disabled={bekliyor}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
