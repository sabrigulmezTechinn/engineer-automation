"use client";

/**
 * /karsilastir sayfasının istemci kısmı: aynı hesap türündeki kayıtlı hesapların karşılaştırma tablosu, isteğe
 * bağlı değer taraması ve karşılaştırma raporu düğmesi. Sunucudan yalnızca düz JSON gelir; hesap tanımı istemcide
 * `getCalc(slug)` ile bulunur.
 */
import Link from "next/link";
import { useId, useMemo } from "react";
import type { CalcTercihleri } from "@/components/calc/use-calc-state";
import { KarsilastirmaRaporDugmesi } from "@/components/rapor/karsilastirma-rapor-dugmesi";
import { Card } from "@/components/ui/card";
import { getCalc } from "@/lib/calc/registry";
import type { CalcDefinition, RunOptions } from "@/lib/calc/types";
import { karsilastirmaOlustur } from "@/lib/karsilastirma";
import type { Senaryo } from "@/lib/karsilastirma/types";
import { KarsilastirmaTablosu, senaryoAdi } from "./karsilastirma-tablosu";
import { TaramaPaneli, useTarama } from "./tarama-paneli";

export interface KayitKarsilastirmaProps {
  hesapSlug: string;
  /** Kayıtlar senaryo olarak (ad = kayıt adı, kayitId dolu) */
  senaryolar: Senaryo[];
  /** Ortak çıktı birimleri (ilk kaydın seçimleri) */
  outputUnits: Record<string, string>;
  tercihler?: CalcTercihleri;
}

export function KayitKarsilastirma(props: KayitKarsilastirmaProps) {
  const def = getCalc(props.hesapSlug);
  if (!def) {
    return (
      <p role="alert" className="rounded-md border border-hata-line bg-hata-bg px-4 py-3 text-sm text-hata">
        Hesap tanımı bulunamadı: <code className="font-mono">{props.hesapSlug}</code>
      </p>
    );
  }
  return <Gorunum def={def} {...props} />;
}

function Gorunum({ def, senaryolar, outputUnits, tercihler }: KayitKarsilastirmaProps & { def: CalcDefinition }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tabloBaslikId = `kayit-tablo-${id}`;
  const significant = tercihler?.significant;
  const preferredUnits = tercihler?.preferredUnits;
  const options = useMemo<RunOptions>(() => ({ outputUnits, significant, preferredUnits }), [outputUnits, significant, preferredUnits]);
  const karsilastirma = useMemo(() => karsilastirmaOlustur(def, senaryolar, options), [def, senaryolar, options]);
  const tarama = useTarama(def, senaryolar, options);

  // Rapordaki tarama ilk kaydı temel alır.
  const raporTaramasi =
    tarama.sonuc.durum === "tamam" && tarama.temel?.id === senaryolar[0]?.id ? tarama.sonuc.ayar : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded border border-transparent bg-accent-soft px-1.5 py-0.5 font-mono text-sm text-accent">{def.id}</span>
        <h2 className="text-lg font-semibold tracking-tight">
          <Link href={`/hesaplar/${def.slug}`} className="hover:underline">
            {def.title}
          </Link>
        </h2>
      </div>

      <Card className="space-y-3 p-4 sm:p-5">
        <h3 id={tabloBaslikId} className="font-semibold">
          {senaryolar.length} kayıt yan yana
        </h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Karşılaştırılan kayıtlar">
          {senaryolar.map((s, i) => (
            <li key={s.id}>
              <Link href={`/hesaplar/${def.slug}?kayit=${encodeURIComponent(s.kayitId ?? s.id)}`} className="text-accent hover:underline">
                {senaryoAdi(s.ad, i)}
              </Link>
              <span className="sr-only"> kaydını hesap sayfasında aç</span>
            </li>
          ))}
        </ul>
        <KarsilastirmaTablosu karsilastirma={karsilastirma} baslikId={tabloBaslikId} />
      </Card>

      <Card className="p-4 sm:p-5">
        <TaramaPaneli def={def} temeller={senaryolar} tarama={tarama} options={options} />
        {tarama.sonuc.durum === "tamam" && !raporTaramasi && (
          <p className="mt-2 text-xs text-muted">
            Karşılaştırma raporuna eklenen tarama ilk kaydı ({senaryoAdi(senaryolar[0]?.ad ?? "", 0)}) temel alır; bu
            grafik rapora eklenmez.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3 empty:hidden">
        <KarsilastirmaRaporDugmesi hesapSlug={def.slug} senaryolar={senaryolar} outputUnits={outputUnits} tarama={raporTaramasi} />
      </div>
    </div>
  );
}
