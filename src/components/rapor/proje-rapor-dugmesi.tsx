"use client";

/** Proje sayfasında "Proje raporu (PDF)" düğmesi: GET /api/rapor/proje/[id]. İşçi A proje sayfasına yerleştirir. */
import { IndirDugmesi } from "./indir-dugmesi";
import { usePdfIndirme } from "./pdf-indirme";

export function ProjeRaporDugmesi({ projeId }: { projeId: string }) {
  const { mesgul, hata, indir } = usePdfIndirme();
  return (
    <IndirDugmesi
      etiket="Proje raporu (PDF)"
      mesgul={mesgul}
      hata={hata}
      onClick={() => void indir(`/api/rapor/proje/${encodeURIComponent(projeId)}`, { method: "GET" }, "Proje raporu")}
    />
  );
}
