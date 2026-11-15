"use client";

/**
 * Karşılaştırma raporu (PDF) düğmesi: POST /api/rapor/karsilastirma. İşçi B senaryo paneline ve /karsilastir
 * sayfasına yerleştirir. Tarama verilirse İLK senaryo temel durum olarak taranır (sunucu sözleşmesi).
 */
import { getCalc } from "@/lib/calc/registry";
import type { Senaryo, TaramaAyari } from "@/lib/karsilastirma/types";
import { RAPOR_SENARYO_MAX } from "@/lib/rapor/sinirlar";
import { IndirDugmesi } from "./indir-dugmesi";
import { usePdfIndirme } from "./pdf-indirme";

export function KarsilastirmaRaporDugmesi(props: {
  hesapSlug: string;
  senaryolar: Senaryo[];
  outputUnits?: Record<string, string>;
  tarama?: TaramaAyari;
}) {
  const { hesapSlug, senaryolar, outputUnits, tarama } = props;
  const { mesgul, hata, indir } = usePdfIndirme();
  const fazla = senaryolar.length > RAPOR_SENARYO_MAX;
  const bos = senaryolar.length === 0;

  const onClick = () => {
    const baslik = getCalc(hesapSlug)?.title ?? "Hesap";
    void indir(
      "/api/rapor/karsilastirma",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hesapSlug,
          senaryolar: senaryolar.map((s) => ({ ad: s.ad, state: s.state })),
          ...(outputUnits ? { outputUnits } : {}),
          ...(tarama ? { tarama } : {}),
        }),
      },
      `${baslik} - Karşılaştırma raporu`,
    );
  };

  return (
    <IndirDugmesi
      etiket="Karşılaştırma raporu (PDF)"
      mesgul={mesgul}
      hata={hata}
      onClick={onClick}
      disabled={bos || fazla}
      aciklama={
        fazla
          ? `Raporda en çok ${RAPOR_SENARYO_MAX} senaryo yer alabilir.`
          : bos
            ? "Rapor için en az bir senaryo ekleyin."
            : undefined
      }
    />
  );
}
