"use client";

/**
 * Karşılaştırma raporu (PDF) düğmesi. Sözleşme stub'ı: Faz 2 işçisi C'nin; işçi B senaryo paneline ve
 * /karsilastir sayfasına yerleştirir.
 */
import type { Senaryo, TaramaAyari } from "@/lib/karsilastirma/types";

export function KarsilastirmaRaporDugmesi(props: {
  hesapSlug: string;
  senaryolar: Senaryo[];
  outputUnits?: Record<string, string>;
  tarama?: TaramaAyari;
}) {
  void props;
  return null;
}
