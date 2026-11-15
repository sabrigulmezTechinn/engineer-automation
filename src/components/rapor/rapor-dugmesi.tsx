"use client";

/**
 * Hesap sayfasında "PDF rapor" düğmesi. Kayıtlı ve formda kaydedilmemiş değişiklik yoksa /api/rapor/hesap/[id]
 * (kayıtlı sürüm, notlarıyla); kayıtsızsa ya da form değiştiyse ekrandaki durumla POST /api/rapor/hesap
 * (değişmiş kayıtta başlık yine kaydın adı olur). Profil tercihleri sunucuda oturumdan uygulanır.
 */
import { useMemo } from "react";
import { initialState, type CalcStateApi } from "@/components/calc/use-calc-state";
import type { KayitliHesap } from "@/lib/kayit/types";
import { IndirDugmesi } from "./indir-dugmesi";
import { usePdfIndirme } from "./pdf-indirme";

/** Anahtar sırasından bağımsız JSON (iki düz JSON nesnesini karşılaştırmak için) */
function kararliJson(deger: unknown): string {
  if (Array.isArray(deger)) return `[${deger.map(kararliJson).join(",")}]`;
  if (deger && typeof deger === "object") {
    const nesne = deger as Record<string, unknown>;
    return `{${Object.keys(nesne)
      .filter((k) => nesne[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${kararliJson(nesne[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(deger);
}

export function RaporDugmesi({ calc, kayit }: { calc: CalcStateApi; kayit?: KayitliHesap | null }) {
  const { mesgul, hata, indir } = usePdfIndirme();
  const { def, state, outputUnits } = calc;

  const degismemis = useMemo(() => {
    if (!kayit) return false;
    return (
      kararliJson(state) === kararliJson(initialState(def, { state: kayit.girdiler })) &&
      kararliJson(outputUnits) === kararliJson(kayit.ciktiBirimleri ?? {})
    );
  }, [def, state, outputUnits, kayit]);

  const onClick = () => {
    if (kayit && degismemis) {
      void indir(`/api/rapor/hesap/${encodeURIComponent(kayit.id)}`, { method: "GET" }, kayit.ad);
      return;
    }
    void indir(
      "/api/rapor/hesap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hesapSlug: def.slug,
          girdiler: state,
          ciktiBirimleri: outputUnits,
          ...(kayit ? { ad: kayit.ad } : {}),
        }),
      },
      kayit?.ad ?? def.title,
    );
  };

  return (
    <IndirDugmesi
      etiket="PDF rapor"
      mesgul={mesgul}
      hata={hata}
      onClick={onClick}
      aciklama={kayit && !degismemis ? "Kaydedilmemiş değişiklikler rapora dahil edilir." : undefined}
    />
  );
}
