"use client";

/**
 * Hesap sayfasının çalışma alanı: tek bir useCalcState durumu; form (genel ya da özel arayüz), kaydetme araçları,
 * rapor düğmesi ve senaryo paneli bu durumu paylaşır. Kayıtlı hesap açıldığında (`kayit`) durum ondan başlar;
 * bileşen kayıt kimliğiyle anahtarlanır (başka kayda geçişte durum sıfırlansın).
 */
import { getCalc } from "@/lib/calc/registry";
import type { CalcDefinition } from "@/lib/calc/types";
import type { KayitliHesap } from "@/lib/kayit/types";
import { CalcFormView } from "./calc-form";
import { CustomCalc } from "./custom";
import { useCalcState, type CalcTercihleri } from "./use-calc-state";
import { KayitAraclari } from "@/components/kayit/kayit-araclari";
import { RaporDugmesi } from "@/components/rapor/rapor-dugmesi";
import { SenaryoPaneli } from "@/components/karsilastirma/senaryo-paneli";

export function CalcWorkspace({
  slug,
  kayit,
  tercihler,
  girisYapildi = false,
  yedek = false,
}: {
  slug: string;
  kayit?: KayitliHesap | null;
  tercihler?: CalcTercihleri;
  girisYapildi?: boolean;
  /**
   * Suspense yedeği: istek verisi (oturum, ?kayit=, tercihler) gelene kadar gösterilen etkileşimsiz form.
   * Gerçek çalışma alanı gelince bu ağaç atılır; kullanıcı bu arada yazarsa değer kaybolmasın diye denetimler
   * devre dışıdır ve kaydetme/rapor/senaryo bölümleri çizilmez.
   */
  yedek?: boolean;
}) {
  const def = getCalc(slug);
  if (!def) {
    return (
      <p role="alert" className="rounded-md border border-hata-line bg-hata-bg px-4 py-3 text-sm text-hata">
        Hesap tanımı bulunamadı: <code className="font-mono">{slug}</code>
      </p>
    );
  }
  if (yedek) return <Yedek def={def} />;
  return (
    <Workspace key={kayit?.id ?? def.slug} def={def} kayit={kayit ?? null} tercihler={tercihler} girisYapildi={girisYapildi} />
  );
}

function Yedek({ def }: { def: CalcDefinition }) {
  const calc = useCalcState(def);
  return (
    <fieldset disabled aria-busy="true" className="min-w-0 opacity-70">
      <legend className="sr-only">Hesap yükleniyor</legend>
      {def.customUi ? <CustomCalc id={def.customUi} calc={calc} /> : <CalcFormView calc={calc} />}
    </fieldset>
  );
}

function Workspace({
  def,
  kayit,
  tercihler,
  girisYapildi,
}: {
  def: CalcDefinition;
  kayit: KayitliHesap | null;
  tercihler?: CalcTercihleri;
  girisYapildi: boolean;
}) {
  const calc = useCalcState(
    def,
    kayit ? { state: kayit.girdiler, outputUnits: kayit.ciktiBirimleri } : undefined,
    tercihler,
  );

  return (
    <div className="space-y-6">
      {/* Mobilde alt alta (kayıt bilgisi tam genişlik), geniş ekranda yan yana: kayıt araçları solda, rapor sağda. */}
      <div className="flex flex-col gap-3 empty:hidden sm:flex-row sm:items-start sm:justify-between">
        <KayitAraclari calc={calc} kayit={kayit} girisYapildi={girisYapildi} />
        <RaporDugmesi calc={calc} kayit={kayit} />
      </div>
      {def.customUi ? <CustomCalc id={def.customUi} calc={calc} /> : <CalcFormView calc={calc} />}
      <SenaryoPaneli calc={calc} />
    </div>
  );
}
