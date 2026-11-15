"use client";

/**
 * Değer taraması: bir sayı girdisini aralıkta değiştirip bir çıktının eğrisini çizer (taramaYap + cizgiGrafikSvg).
 * Durum `useTarama` hook'undadır; üst bileşen geçerli ayarı (`sonuc.ayar`) karşılaştırma raporuna iletebilir.
 * SVG metni cizgiGrafikSvg'de üretilir ve tüm metinleri kaçışlanmıştır; sayfaya o yüzden doğrudan konabilir.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { outputPrecision, visibleInputs } from "@/lib/calc/engine";
import type { CalcDefinition, CheckLevel, InputState, NumberInputSpec, RunOptions } from "@/lib/calc/types";
import { TARAMA_NOKTA_MAX, TARAMA_NOKTA_MIN, TaramaHatasi, taramaYap } from "@/lib/karsilastirma";
import { cizgiGrafikSvg } from "@/lib/karsilastirma/grafik";
import type { Senaryo, TaramaAyari, TaramaSerisi } from "@/lib/karsilastirma/types";
import { formatNumber, getUnit, parseNumber, unitsFor, type FormatOptions } from "@/lib/units";
import { cx } from "@/components/ui/cx";
import { senaryoAdi } from "./karsilastirma-tablosu";

interface TaramaFormu {
  girdiKey: string;
  ciktiKey: string;
  baslangic: string;
  bitis: string;
  birim: string;
  noktaSayisi: string;
}

export type TaramaSonucu =
  | { durum: "bos"; mesaj: string }
  | { durum: "hata"; mesaj: string }
  | { durum: "tamam"; ayar: TaramaAyari; seri: TaramaSerisi };

const VARSAYILAN_NOKTA = "20";

function izinliBirimler(spec: NumberInputSpec): string[] {
  return spec.units ?? unitsFor(spec.dimension).map((u) => u.id);
}

function sayiGirdisi(def: CalcDefinition, key: string): NumberInputSpec | undefined {
  const spec = def.inputs.find((i) => i.key === key);
  return spec?.kind === "number" ? spec : undefined;
}

/** Giriş kutusuna yazılacak, 4 anlamlı basamağa yuvarlanmış metin ("0,5", "12,5"). Binlik ayırıcı yok. */
function aralikMetni(v: number): string {
  return String(Number(v.toPrecision(4))).replace(".", ",");
}

/** Girdi seçilince birim ve aralık temel değerden doldurulur: değerin yarısından iki katına. */
function girdiyeGore(def: CalcDefinition, temel: Senaryo | undefined, girdiKey: string): Pick<TaramaFormu, "birim" | "baslangic" | "bitis"> {
  const spec = sayiGirdisi(def, girdiKey);
  if (!spec) return { birim: "", baslangic: "", bitis: "" };
  const entry = temel?.state[girdiKey];
  const birim = entry?.unit && izinliBirimler(spec).includes(entry.unit) ? entry.unit : spec.defaultUnit;
  const v = entry ? parseNumber(entry.value) : null;
  if (v === null || v === 0) return { birim, baslangic: "", bitis: "" };
  const [a, b] = v > 0 ? [v / 2, v * 2] : [v * 2, v / 2];
  return { birim, baslangic: aralikMetni(a), bitis: aralikMetni(b) };
}

function ilkForm(def: CalcDefinition, temel: Senaryo | undefined): TaramaFormu {
  const girdiler = temel ? visibleInputs(def, temel.state).filter((i) => i.kind === "number") : [];
  const girdiKey = girdiler[0]?.key ?? "";
  // Girdiyle aynı anahtarlı çıktı (ör. Ohm yasasında R → R) düz bir doğru verir; varsa başkası seçilir.
  const ciktiKey = (def.outputs.find((o) => o.key !== girdiKey) ?? def.outputs[0])?.key ?? "";
  return { girdiKey, ciktiKey, noktaSayisi: VARSAYILAN_NOKTA, ...girdiyeGore(def, temel, girdiKey) };
}

/**
 * Tarama formu ve sonucu. `temeller` taramanın başlayacağı durumlar (senaryolar, kayıtlar ya da formdaki değerler);
 * kullanıcı seçmediyse ilki kullanılır. `options` çalışma alanının çıktı birimleri ve tercihleridir (bellekte
 * tutulmuş olmalı; her değişimde tarama yeniden hesaplanır).
 */
export function useTarama(def: CalcDefinition, temeller: Senaryo[], options?: RunOptions) {
  const [temelSecimi, setTemelSecimi] = useState<string | null>(null);
  const temel = temeller.find((t) => t.id === temelSecimi) ?? temeller[0];
  const [form, setForm] = useState<TaramaFormu>(() => ilkForm(def, temel));

  const temelState: InputState | undefined = temel?.state;
  const sayiGirdileri = useMemo(
    () => (temelState ? visibleInputs(def, temelState).filter((i): i is NumberInputSpec => i.kind === "number") : []),
    [def, temelState],
  );

  const sonuc = useMemo((): TaramaSonucu => {
    if (!temel) return { durum: "bos", mesaj: "Taramak için önce bir senaryo ekleyin." };
    if (!form.girdiKey) return { durum: "bos", mesaj: "Bu hesapta taranabilecek bir sayı girdisi yok." };
    if (form.baslangic.trim() === "" || form.bitis.trim() === "") {
      return { durum: "bos", mesaj: "Grafik için başlangıç ve bitiş değerlerini girin." };
    }
    const baslangic = parseNumber(form.baslangic);
    if (baslangic === null) return { durum: "hata", mesaj: "Başlangıç değeri geçerli bir sayı değil." };
    const bitis = parseNumber(form.bitis);
    if (bitis === null) return { durum: "hata", mesaj: "Bitiş değeri geçerli bir sayı değil." };
    const noktaSayisi = /^\s*\d+\s*$/.test(form.noktaSayisi) ? Number(form.noktaSayisi) : Number.NaN;
    const ayar: TaramaAyari = {
      girdiKey: form.girdiKey,
      ciktiKey: form.ciktiKey,
      baslangic,
      bitis,
      birim: form.birim,
      noktaSayisi,
    };
    try {
      const seri = taramaYap(def, temel, ayar, options);
      return { durum: "tamam", ayar, seri };
    } catch (error) {
      return {
        durum: "hata",
        mesaj: error instanceof TaramaHatasi ? error.message : "Tarama yapılırken beklenmeyen bir hata oluştu.",
      };
    }
  }, [def, temel, form, options]);

  const alan = <K extends keyof TaramaFormu>(key: K, value: TaramaFormu[K]) => setForm((f) => ({ ...f, [key]: value }));
  const girdiSec = (girdiKey: string) => setForm((f) => ({ ...f, girdiKey, ...girdiyeGore(def, temel, girdiKey) }));

  return { temel, temelSec: setTemelSecimi, form, alan, girdiSec, sayiGirdileri, sonuc };
}

export type TaramaApi = ReturnType<typeof useTarama>;

const CONTROL =
  "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none";

const SEVIYE_METNI: Record<CheckLevel, string> = { ok: "Uygun", bilgi: "Bilgi", uyari: "Uyarı", hata: "Hata" };

function Alan({ id, etiket, children, className }: { id: string; etiket: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {etiket}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function TaramaPaneli({
  def,
  temeller,
  tarama,
  options,
}: {
  def: CalcDefinition;
  temeller: Senaryo[];
  tarama: TaramaApi;
  /** Değer tablosunda çıktının hassasiyeti (anlamlı basamak tercihi) için */
  options?: RunOptions;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const f = (ad: string) => `tarama-${id}-${ad}`;
  const { temel, form, sonuc, sayiGirdileri } = tarama;
  const secili = sayiGirdisi(def, form.girdiKey);
  const seciliGizli = secili !== undefined && !sayiGirdileri.some((i) => i.key === secili.key);
  const birimler = secili ? izinliBirimler(secili).map(getUnit) : [];
  const ciktiSpec = def.outputs.find((o) => o.key === form.ciktiKey);
  const yHassasiyet = ciktiSpec ? outputPrecision(ciktiSpec, options?.significant) : undefined;

  return (
    <section aria-labelledby={f("baslik")} className="space-y-4">
      <div>
        <h4 id={f("baslik")} className="font-semibold">
          Değer taraması
        </h4>
        <p className="mt-1 text-sm text-muted">
          Bir girdiyi aralık boyunca değiştirip seçilen çıktının nasıl değiştiğini grafikte görün. Diğer girdiler
          temel alınan değerlerde kalır.
        </p>
      </div>

      <form noValidate onSubmit={(e) => e.preventDefault()} className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        {temeller.length > 1 && (
          <Alan id={f("temel")} etiket="Temel değerler" className="col-span-2 sm:col-span-3 lg:col-span-2">
            <select id={f("temel")} className={CONTROL} value={temel?.id ?? ""} onChange={(e) => tarama.temelSec(e.target.value)}>
              {temeller.map((t, i) => (
                <option key={t.id} value={t.id}>
                  {senaryoAdi(t.ad, i)}
                </option>
              ))}
            </select>
          </Alan>
        )}
        <Alan id={f("girdi")} etiket="Değişen girdi" className="col-span-2 sm:col-span-3 lg:col-span-2">
          <select id={f("girdi")} className={CONTROL} value={form.girdiKey} onChange={(e) => tarama.girdiSec(e.target.value)}>
            {sayiGirdileri.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
            {seciliGizli && <option value={secili.key}>{secili.label} (bu değerlerde kullanılmıyor)</option>}
            {!secili && <option value="">—</option>}
          </select>
        </Alan>
        <Alan id={f("cikti")} etiket="Grafikteki çıktı" className="col-span-2 sm:col-span-3 lg:col-span-2">
          <select id={f("cikti")} className={CONTROL} value={form.ciktiKey} onChange={(e) => tarama.alan("ciktiKey", e.target.value)}>
            {def.outputs.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Alan>
        <Alan id={f("baslangic")} etiket="Başlangıç">
          <input
            id={f("baslangic")}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            className={cx(CONTROL, "font-mono tabular-nums")}
            value={form.baslangic}
            onChange={(e) => tarama.alan("baslangic", e.target.value)}
          />
        </Alan>
        <Alan id={f("bitis")} etiket="Bitiş">
          <input
            id={f("bitis")}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            className={cx(CONTROL, "font-mono tabular-nums")}
            value={form.bitis}
            onChange={(e) => tarama.alan("bitis", e.target.value)}
          />
        </Alan>
        <Alan id={f("birim")} etiket="Birim">
          <select
            id={f("birim")}
            className={CONTROL}
            value={form.birim}
            disabled={birimler.length <= 1}
            onChange={(e) => tarama.alan("birim", e.target.value)}
          >
            {birimler.map((u) => (
              <option key={u.id} value={u.id} title={u.name}>
                {u.symbol === "-" ? u.name : u.symbol}
              </option>
            ))}
          </select>
        </Alan>
        <Alan id={f("nokta")} etiket="Nokta sayısı">
          <input
            id={f("nokta")}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className={cx(CONTROL, "font-mono tabular-nums")}
            value={form.noktaSayisi}
            aria-describedby={f("nokta-yardim")}
            onChange={(e) => tarama.alan("noktaSayisi", e.target.value)}
          />
          <p id={f("nokta-yardim")} className="mt-1 text-xs text-muted">
            {TARAMA_NOKTA_MIN}–{TARAMA_NOKTA_MAX}
          </p>
        </Alan>
      </form>

      <div aria-live="polite">
        {sonuc.durum === "tamam" ? (
          <TaramaSonucGorunumu seri={sonuc.seri} yHassasiyet={yHassasiyet} />
        ) : (
          <p
            className={cx(
              "rounded-md border px-3.5 py-3 text-sm",
              sonuc.durum === "hata" ? "border-hata-line bg-hata-bg text-hata" : "border-dashed border-line-strong bg-surface-muted text-muted",
            )}
          >
            {sonuc.mesaj}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Kabın genişliği (10 px'e yuvarlanmış). Grafik bu genişlikte çizilir: SVG ölçeklenerek küçültülürse dar ekranda
 * yazılar okunmaz hale gelir. ResizeObserver yoksa (eski tarayıcı, test ortamı) varsayılan genişlik kalır.
 */
function useKapGenisligi<T extends HTMLElement>(varsayilan: number) {
  const ref = useRef<T>(null);
  const [genislik, setGenislik] = useState(varsayilan);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const gozlemci = new ResizeObserver(([kayit]) => {
      const w = Math.floor(kayit.contentRect.width / 10) * 10;
      if (w > 0) setGenislik(w);
    });
    gozlemci.observe(el);
    return () => gozlemci.disconnect();
  }, []);
  return [ref, genislik] as const;
}

function TaramaSonucGorunumu({ seri, yHassasiyet }: { seri: TaramaSerisi; yHassasiyet?: FormatOptions }) {
  const [kap, genislik] = useKapGenisligi<HTMLDivElement>(640);
  const svg = useMemo(() => {
    const w = Math.max(280, Math.min(genislik, 960));
    return cizgiGrafikSvg(seri, { genislik: w, yukseklik: Math.round(Math.min(340, Math.max(220, w * 0.5))) });
  }, [seri, genislik]);
  const hesaplanmayan = seri.noktalar.filter((p) => p.y === null).length;
  const birimli = (v: string, b: string) => (b ? `${v} ${b}` : v);
  return (
    <div className="space-y-2">
      <div
        ref={kap}
        className="overflow-hidden rounded-md border border-line bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        // Güvenli: SVG cizgiGrafikSvg'de üretilir; tüm metin içerikleri ve öznitelikler xmlKacis ile kaçışlanır.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {hesaplanmayan > 0 && (
        <p className="text-xs text-muted">
          {hesaplanmayan} noktada sonuç hesaplanamadı (girdi sınır dışında ya da bu değerlerle anlamsız); çizgi orada kesilir.
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-accent hover:underline">Değerleri tablo olarak göster</summary>
        <div className="relative mt-2 max-h-72 overflow-auto rounded-md border border-line" tabIndex={0} role="region" aria-label="Tarama değerleri">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-surface-muted">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  {birimli(seri.xEtiket, seri.xBirimSembolu ? `(${seri.xBirimSembolu})` : "")}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  {birimli(seri.yEtiket, seri.yBirimSembolu ? `(${seri.yBirimSembolu})` : "")}
                </th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody>
              {seri.noktalar.map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1 text-right tabular-nums">{formatNumber(p.x, { significant: 6 })}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{p.y === null ? "hesaplanamadı" : formatNumber(p.y, yHassasiyet)}</td>
                  <td className="px-3 py-1">{p.seviye ? SEVIYE_METNI[p.seviye] : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
