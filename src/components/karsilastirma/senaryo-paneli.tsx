"use client";

/**
 * Hesap sayfasında senaryo karşılaştırma paneli: mevcut durumu senaryo olarak ekleme, senaryo tablosu
 * (karsilastirmaOlustur), değer taraması grafiği (taramaYap + cizgiGrafikSvg), karşılaştırma raporu düğmesi.
 * Sözleşme stub'ı: Faz 2 işçisi B bu dosyanın sahibidir.
 *
 * Senaryolar yalnızca bileşen durumunda tutulur (kalıcı değil; kalıcılık kaydetmeyle). Panel kapalıyken içerik
 * hiç oluşturulmaz: formdaki her değişiklikte senaryolar ve tarama yeniden hesaplanmasın. Kimlikler ve adlar
 * tıklamada artan bir sayaçtan gelir (ön üretimde rastgele/zaman değeri kullanılmaz; silinen ad tekrar kullanılmaz).
 */
import { useCallback, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CalcStateApi } from "@/components/calc/use-calc-state";
import { KarsilastirmaRaporDugmesi } from "@/components/rapor/karsilastirma-rapor-dugmesi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";
import type { InputState, RunOptions } from "@/lib/calc/types";
import { SENARYO_SINIRI, karsilastirmaOlustur } from "@/lib/karsilastirma";
import type { Senaryo } from "@/lib/karsilastirma/types";
import { KarsilastirmaTablosu, SenaryoDurumRozeti, senaryoAdi } from "./karsilastirma-tablosu";
import { TaramaPaneli, useTarama } from "./tarama-paneli";

/** Tarama temeli olarak formdaki güncel değerler (senaryo listesinde değil, yalnızca taramada) */
const FORM_TEMELI = "__form__";
const SENARYO_AD_MAX = 80;

function kopyala(state: InputState): InputState {
  return Object.fromEntries(Object.entries(state).map(([k, v]) => [k, { ...v }]));
}

/** Anahtar sırasından bağımsız karşılaştırma için kararlı metin */
function durumImzasi(state: InputState): string {
  return JSON.stringify(
    Object.keys(state)
      .sort()
      .map((k) => [k, state[k].value, state[k].unit ?? null]),
  );
}

export function SenaryoPaneli({ calc }: { calc: CalcStateApi }) {
  const [acik, setAcik] = useState(false);
  const [senaryolar, setSenaryolar] = useState<Senaryo[]>([]);
  // Panel kapatılıp açılınca da sürer: silinen senaryonun adı/kimliği yeniden verilmez.
  const sayac = useRef(0);
  const yeniNo = useCallback(() => ++sayac.current, []);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const icerikId = `senaryo-paneli-${id}`;

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="font-semibold">
        <button
          type="button"
          aria-expanded={acik}
          aria-controls={icerikId}
          onClick={() => setAcik((a) => !a)}
          className="-m-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded p-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={cx("size-4 shrink-0 text-muted transition-transform", acik && "rotate-90")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span>Senaryo karşılaştırma</span>
          {senaryolar.length > 0 && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              {senaryolar.length}
              <span className="sr-only"> senaryo</span>
            </span>
          )}
        </button>
      </h3>
      {!acik && (
        <p className="mt-1 text-sm text-muted">
          Aynı hesabı farklı girdilerle yan yana görün ve bir girdiyi aralıkta tarayın.
        </p>
      )}
      <div id={icerikId} hidden={!acik}>
        {acik && <PanelIcerigi calc={calc} senaryolar={senaryolar} setSenaryolar={setSenaryolar} yeniNo={yeniNo} />}
      </div>
    </Card>
  );
}

function PanelIcerigi({
  calc,
  senaryolar,
  setSenaryolar,
  yeniNo,
}: {
  calc: CalcStateApi;
  senaryolar: Senaryo[];
  setSenaryolar: Dispatch<SetStateAction<Senaryo[]>>;
  yeniNo: () => number;
}) {
  const { def, state, outputUnits, tercihler } = calc;
  const [bildirim, setBildirim] = useState("");
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tabloBaslikId = `senaryo-tablo-${id}`;

  const significant = tercihler?.significant;
  const preferredUnits = tercihler?.preferredUnits;
  const options = useMemo<RunOptions>(
    () => ({ outputUnits, significant, preferredUnits }),
    [outputUnits, significant, preferredUnits],
  );

  const karsilastirma = useMemo(() => karsilastirmaOlustur(def, senaryolar, options), [def, senaryolar, options]);

  // Tarama temeli: kullanıcı seçmediyse ilk senaryo (rapor da ilk senaryoyu kullanır), senaryo yoksa formdaki değerler.
  const temeller = useMemo<Senaryo[]>(
    () => [...senaryolar, { id: FORM_TEMELI, ad: "Formdaki mevcut değerler", state }],
    [senaryolar, state],
  );
  const tarama = useTarama(def, temeller, options);

  const formImzasi = useMemo(() => durumImzasi(state), [state]);
  const doldu = senaryolar.length >= SENARYO_SINIRI;

  const ekle = () => {
    if (doldu) return;
    const no = yeniNo();
    const ad = `Senaryo ${no}`;
    setSenaryolar((liste) => [...liste, { id: `senaryo-${no}`, ad, state: kopyala(state) }]);
    setBildirim(`${ad} eklendi.`);
  };

  const yeniAd = (sid: string, ad: string) =>
    setSenaryolar((liste) => liste.map((s) => (s.id === sid ? { ...s, ad: ad.slice(0, SENARYO_AD_MAX) } : s)));

  const yukle = (s: Senaryo, i: number) => {
    // Çıktı birimi seçimleri korunur: replace, verilmezse onları sıfırlardı.
    calc.replace({ state: kopyala(s.state), outputUnits });
    setBildirim(`${senaryoAdi(s.ad, i)} forma yüklendi.`);
  };

  const sil = (s: Senaryo, i: number) => {
    setSenaryolar((liste) => liste.filter((x) => x.id !== s.id));
    setBildirim(`${senaryoAdi(s.ad, i)} silindi.`);
  };

  // Rapordaki tarama ilk senaryoyu temel alır; başka bir temel seçiliyse rapora tarama eklenmez.
  const raporTaramasi =
    tarama.sonuc.durum === "tamam" && senaryolar.length > 0 && tarama.temel?.id === senaryolar[0].id
      ? tarama.sonuc.ayar
      : undefined;

  return (
    <div className="mt-4 space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={ekle} disabled={doldu}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Mevcut değerleri senaryo olarak ekle
          </Button>
          <p className="text-xs text-muted">
            {doldu
              ? `En çok ${SENARYO_SINIRI} senaryo eklenebilir; yenisi için birini silin.`
              : "Senaryolar bu sayfada tutulur; kalıcı olması için hesabı kaydedin."}
          </p>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {bildirim}
        </p>

        {senaryolar.length > 0 ? (
          <ul className="divide-y divide-line rounded-md border border-line" aria-label="Senaryolar">
            {senaryolar.map((s, i) => {
              const durum = karsilastirma.senaryolar[i]?.durum;
              const formda = durumImzasi(s.state) === formImzasi;
              const ad = senaryoAdi(s.ad, i);
              return (
                <li key={s.id} data-senaryo={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <input
                    type="text"
                    value={s.ad}
                    maxLength={SENARYO_AD_MAX}
                    onChange={(e) => yeniAd(s.id, e.target.value)}
                    aria-label={`${i + 1}. senaryonun adı`}
                    className="h-9 min-w-0 flex-1 basis-40 rounded-md border border-line bg-surface px-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
                  />
                  {durum && <SenaryoDurumRozeti durum={durum} />}
                  {formda && (
                    <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-xs text-muted">Formdaki değerler</span>
                  )}
                  <span className="ml-auto flex gap-1">
                    <Button variant="secondary" className="px-2.5 text-xs" onClick={() => yukle(s, i)} aria-label={`${ad}: forma yükle`}>
                      Forma yükle
                    </Button>
                    <Button variant="ghost" className="px-2.5 text-xs" onClick={() => sil(s, i)} aria-label={`${ad}: sil`}>
                      Sil
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-line-strong bg-surface-muted px-3.5 py-3 text-sm text-muted">
            Henüz senaryo yok. Formu doldurup “Mevcut değerleri senaryo olarak ekle”ye basın; sonra değerleri değiştirip
            yeni senaryolar ekleyin.
          </p>
        )}
      </div>

      {senaryolar.length > 0 && (
        <div className="space-y-2">
          {/* Başlık, tablonun kaydırılabilir bölgesine (role="region") ad verir. */}
          <h4 id={tabloBaslikId} className="font-semibold">
            Karşılaştırma tablosu
          </h4>
          <KarsilastirmaTablosu karsilastirma={karsilastirma} baslikId={tabloBaslikId} />
        </div>
      )}

      <div className="border-t border-line pt-5">
        <TaramaPaneli def={def} temeller={temeller} tarama={tarama} options={options} />
        {tarama.sonuc.durum === "tamam" && senaryolar.length > 0 && !raporTaramasi && (
          <p className="mt-2 text-xs text-muted">
            Karşılaştırma raporuna eklenen tarama ilk senaryoyu ({senaryoAdi(senaryolar[0].ad, 0)}) temel alır; bu grafik
            rapora eklenmez.
          </p>
        )}
      </div>

      {senaryolar.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 empty:hidden">
          <KarsilastirmaRaporDugmesi hesapSlug={def.slug} senaryolar={senaryolar} outputUnits={outputUnits} tarama={raporTaramasi} />
        </div>
      )}
    </div>
  );
}
