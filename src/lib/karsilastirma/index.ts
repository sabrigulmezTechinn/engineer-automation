/**
 * Karşılaştırma hesapları (saf; sunucu ve istemcide çalışır). İmzalar sözleşmedir; gövdeler Faz 2 işçisi B'nindir.
 */
import { displayUnit, numberToInputText, outputPrecision, runCalc, splitList, visibleInputs } from "@/lib/calc/engine";
import type {
  CalcDefinition,
  Check,
  CheckLevel,
  InputSpec,
  InputState,
  NumberInputSpec,
  NumberListInputSpec,
  OutputSpec,
  RunOptions,
  RunResult,
  SelectInputSpec,
} from "@/lib/calc/types";
import { MONEY_FORMAT, formatNumber, fromSI, getUnit, parseNumber, toSI, unitsFor, type FormatOptions } from "@/lib/units";
import type { Karsilastirma, KarsilastirmaSatiri, Senaryo, SenaryoDurumu, TaramaAyari, TaramaNoktasi, TaramaSerisi } from "./types";

export type { Karsilastirma, KarsilastirmaSatiri, Senaryo, SenaryoDurumu, TaramaAyari, TaramaNoktasi, TaramaSerisi } from "./types";

/** Arayüzde en çok bu kadar senaryo/kayıt yan yana gösterilir (tablo okunaklı kalsın). */
export const SENARYO_SINIRI = 8;
/** Taramada izin verilen nokta sayısı aralığı */
export const TARAMA_NOKTA_MIN = 2;
export const TARAMA_NOKTA_MAX = 200;

/** Geçersiz tarama ayarı; mesaj kullanıcıya gösterilebilir. */
export class TaramaHatasi extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaramaHatasi";
  }
}

// ---------------------------------------------------------------------------
// Ortak yardımcılar

const SEVIYE_SIRASI: Record<CheckLevel, number> = { ok: 0, uyari: 1, hata: 2 };

/** Kontrollerin en kötü seviyesi ("hata" > "uyari" > "ok"); kontrol yoksa null. */
export function enKotuSeviye(kontroller: readonly Check[]): CheckLevel | null {
  let enKotu: CheckLevel | null = null;
  for (const k of kontroller) {
    if (enKotu === null || SEVIYE_SIRASI[k.level] > SEVIYE_SIRASI[enKotu]) enKotu = k.level;
  }
  return enKotu;
}

type SayisalGirdi = NumberInputSpec | NumberListInputSpec;

/** Girdinin/çıktının izinli birimleri (motorun kuralı: tanımda `units` yoksa boyutun tüm birimleri). */
function izinliBirimler(spec: SayisalGirdi | OutputSpec): string[] {
  return spec.units ?? unitsFor(spec.dimension).map((u) => u.id);
}

/** Gösterilecek birim metni; boyutsuz/kesir gibi sembolü "-" olan birimlerde boş. */
export function birimSembolu(unitId: string): string {
  const { symbol } = getUnit(unitId);
  return symbol === "-" ? "" : symbol;
}

function cikisSembolu(spec: OutputSpec, unitId: string): string {
  return spec.unitLabel ?? birimSembolu(unitId);
}

/**
 * runCalc sonucundan senaryo durumu. Alan hataları da (ör. "Direnç: Bu alan zorunludur") "hata" seviyesinde
 * kontrol olarak eklenir; böylece tablo, tarama ve rapor başarısız senaryoyu aynı yoldan görür.
 */
export function senaryoDurumu(def: CalcDefinition, run: RunResult): SenaryoDurumu {
  if (run.ok) {
    return { ok: true, enKotu: enKotuSeviye(run.result.checks), kontroller: run.result.checks };
  }
  const alanHatalari: Check[] = Object.entries(run.fieldErrors).map(([key, mesaj]) => ({
    level: "hata",
    message: `${def.inputs.find((i) => i.key === key)?.label ?? key}: ${mesaj}`,
  }));
  const kontroller = [...alanHatalari, ...run.checks];
  return { ok: false, enKotu: enKotuSeviye(kontroller), kontroller };
}

function selectDegeri(spec: SelectInputSpec, state: InputState): string {
  return state[spec.key]?.value ?? spec.default;
}

/**
 * Girdi değerlerinin gösterim hassasiyeti: senaryolar arasındaki gerçek farklar yuvarlamada kaybolmasın diye
 * çıktılardan yüksek (en az 8 anlamlı basamak; çeviri artıklarını da temizler). Tam sayı girdiler ondalıksız,
 * para iki ondalık.
 */
function girdiHassasiyeti(spec: SayisalGirdi, options?: RunOptions): FormatOptions {
  if (spec.integer) return { decimals: 0 };
  if (spec.dimension === "para") return MONEY_FORMAT;
  return { significant: Math.max(options?.significant ?? 4, 8) };
}

/** Durumdaki birim izinliyse o, birim yazılmamışsa varsayılan; izinsiz birimde null. */
function durumBirimi(spec: SayisalGirdi, state: InputState): string | null {
  const unit = state[spec.key]?.unit ?? spec.defaultUnit;
  return izinliBirimler(spec).includes(unit) ? unit : null;
}

/**
 * Bir senaryodaki sayı/liste girdisinin SI değer(ler)i. Boş alan → "bos"; okunamayan metin veya izinsiz
 * birim → "gecersiz" (tabloda yazılan metin gösterilir).
 */
function girdiSI(spec: SayisalGirdi, state: InputState): number[] | "bos" | "gecersiz" {
  const text = state[spec.key]?.value ?? "";
  const parcalar = spec.kind === "numberList" ? splitList(text) : text.trim() === "" ? [] : [text];
  if (parcalar.length === 0) return "bos";
  const unit = durumBirimi(spec, state);
  if (unit === null) return "gecersiz";
  const degerler: number[] = [];
  for (const parca of parcalar) {
    const n = parseNumber(parca);
    if (n === null) return "gecersiz";
    const si = toSI(n, unit);
    if (!Number.isFinite(si)) return "gecersiz";
    degerler.push(si);
  }
  return degerler;
}

function farkliMi(degerler: (string | null)[]): boolean {
  return new Set(degerler.map((d) => (d === null ? "\u0000" : d))).size > 1;
}

// ---------------------------------------------------------------------------
// Karşılaştırma tablosu

function girdiSatiri(
  spec: InputSpec,
  senaryolar: Senaryo[],
  gorunur: ReadonlySet<string>[],
  options?: RunOptions,
): KarsilastirmaSatiri {
  const temel = {
    tur: "girdi" as const,
    key: spec.key,
    label: spec.label,
    ...(spec.symbol !== undefined ? { symbol: spec.symbol } : {}),
  };

  if (spec.kind === "select") {
    const degerler = senaryolar.map((s, i) => {
      if (!gorunur[i].has(spec.key)) return null;
      const value = selectDegeri(spec, s.state);
      return spec.options.find((o) => o.value === value)?.label ?? value;
    });
    return { ...temel, birim: "", birimSembolu: "", degerler, sayisal: degerler.map(() => null), farkli: farkliMi(degerler) };
  }

  // Ortak birim: girdinin göründüğü ilk senaryonun (izinli) birimi, yoksa tanımın varsayılanı.
  let birim = spec.defaultUnit;
  for (const [i, s] of senaryolar.entries()) {
    if (!gorunur[i].has(spec.key)) continue;
    const unit = durumBirimi(spec, s.state);
    if (unit !== null) {
      birim = unit;
      break;
    }
  }
  const hassasiyet = girdiHassasiyeti(spec, options);
  const bicimle = (si: number) => formatNumber(fromSI(si, birim), hassasiyet);

  const degerler: (string | null)[] = [];
  const sayisal: (number | null)[] = [];
  for (const [i, s] of senaryolar.entries()) {
    if (!gorunur[i].has(spec.key)) {
      degerler.push(null);
      sayisal.push(null);
      continue;
    }
    const si = girdiSI(spec, s.state);
    if (si === "bos") {
      degerler.push(null);
      sayisal.push(null);
    } else if (si === "gecersiz") {
      // Okunamayan değer olduğu gibi gösterilir; senaryo durumu zaten "hata" der.
      degerler.push((s.state[spec.key]?.value ?? "").trim());
      sayisal.push(null);
    } else if (spec.kind === "numberList") {
      degerler.push(si.map(bicimle).join("; "));
      sayisal.push(null);
    } else {
      degerler.push(bicimle(si[0]));
      sayisal.push(fromSI(si[0], birim));
    }
  }
  return { ...temel, birim, birimSembolu: birimSembolu(birim), degerler, sayisal, farkli: farkliMi(degerler) };
}

function ciktiSatiri(spec: OutputSpec, runs: RunResult[], options?: RunOptions): KarsilastirmaSatiri | null {
  const siDegerler = runs.map((run) => (run.ok && spec.key in run.result.outputs ? run.result.outputs[spec.key] : null));
  const mevcut = siDegerler.filter((v): v is number => v !== null);
  // Hiçbir senaryoda hesaplanmayan çıktı satırı gösterilmez.
  if (mevcut.length === 0) return null;

  // Satır başına tek birim: kullanıcı seçimi → tercih → en büyük mutlak değere göre otomatik.
  const enBuyuk = mevcut.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  const birim = displayUnit(spec, enBuyuk, options);
  const hassasiyet = outputPrecision(spec, options?.significant);
  const sayisal = siDegerler.map((v) => (v === null ? null : fromSI(v, birim)));
  const degerler = sayisal.map((v) => (v === null ? null : formatNumber(v, hassasiyet)));
  return {
    tur: "cikti",
    key: spec.key,
    label: spec.label,
    ...(spec.symbol !== undefined ? { symbol: spec.symbol } : {}),
    birim,
    birimSembolu: cikisSembolu(spec, birim),
    degerler,
    sayisal,
    farkli: farkliMi(degerler),
  };
}

/**
 * Senaryoları aynı tanımla çalıştırıp satır satır karşılaştırma tablosu üretir. Satır başına ortak birim:
 * kullanıcının `options.outputUnits` seçimi, yoksa tercih edilen birim, yoksa senaryoların değerlerine göre
 * tek bir otomatik birim. Girdi satırlarında senaryoların yazdığı metin ve birimi değil, ortak birime
 * çevrilmiş değer gösterilir.
 *
 * Satırlar: önce en az bir senaryoda görünen girdiler (tanım sırası), sonra en az bir senaryoda hesaplanan
 * çıktılar. Hiçbir zaman fırlatmaz.
 */
export function karsilastirmaOlustur(def: CalcDefinition, senaryolar: Senaryo[], options?: RunOptions): Karsilastirma {
  const runs = senaryolar.map((s) => runCalc(def, s.state, options));
  const gorunur = senaryolar.map((s) => new Set(visibleInputs(def, s.state).map((i) => i.key)));

  const satirlar: KarsilastirmaSatiri[] = [];
  for (const spec of def.inputs) {
    if (!gorunur.some((g) => g.has(spec.key))) continue;
    satirlar.push(girdiSatiri(spec, senaryolar, gorunur, options));
  }
  for (const spec of def.outputs) {
    const satir = ciktiSatiri(spec, runs, options);
    if (satir) satirlar.push(satir);
  }

  return {
    hesapSlug: def.slug,
    hesapId: def.id,
    baslik: def.title,
    senaryolar: senaryolar.map((s, i) => ({ id: s.id, ad: s.ad, durum: senaryoDurumu(def, runs[i]) })),
    satirlar,
  };
}

// ---------------------------------------------------------------------------
// Değer taraması

/** Kayan nokta artıklarını temizler (0,1 + 0,2 → 0,3); 12 anlamlı basamak gösterimde fazlasıyla yeter. */
function temizle(x: number): number {
  const v = Number(x.toPrecision(12));
  return v === 0 ? 0 : v;
}

/** Tarama ayarını doğrular; geçersizse anlaşılır bir TaramaHatasi fırlatır. */
function taramaGirdisi(def: CalcDefinition, temel: Senaryo, ayar: TaramaAyari): { girdi: NumberInputSpec; cikti: OutputSpec } {
  const spec = def.inputs.find((i) => i.key === ayar.girdiKey);
  if (!spec) throw new TaramaHatasi(`Taranacak girdi bu hesapta yok: "${ayar.girdiKey}".`);
  if (spec.kind !== "number") {
    throw new TaramaHatasi(`"${spec.label}" tek değerli bir sayı girdisi değil; yalnızca sayı girdileri taranabilir.`);
  }
  const cikti = def.outputs.find((o) => o.key === ayar.ciktiKey);
  if (!cikti) throw new TaramaHatasi(`Grafiği çizilecek çıktı bu hesapta yok: "${ayar.ciktiKey}".`);
  if (!visibleInputs(def, temel.state).some((i) => i.key === spec.key)) {
    throw new TaramaHatasi(
      `"${spec.label}" bu girdilerle kullanılmıyor; taramak için önce ilgili seçimi değiştirin ya da başka bir girdi seçin.`,
    );
  }
  if (!izinliBirimler(spec).includes(ayar.birim)) {
    throw new TaramaHatasi(`"${ayar.birim}" birimi "${spec.label}" için geçerli değil.`);
  }
  if (!Number.isInteger(ayar.noktaSayisi) || ayar.noktaSayisi < TARAMA_NOKTA_MIN || ayar.noktaSayisi > TARAMA_NOKTA_MAX) {
    throw new TaramaHatasi(`Nokta sayısı ${TARAMA_NOKTA_MIN} ile ${TARAMA_NOKTA_MAX} arasında bir tam sayı olmalıdır.`);
  }
  if (!Number.isFinite(ayar.baslangic) || !Number.isFinite(ayar.bitis)) {
    throw new TaramaHatasi("Başlangıç ve bitiş geçerli sayılar olmalıdır.");
  }
  if (ayar.baslangic === ayar.bitis) throw new TaramaHatasi("Başlangıç ve bitiş değerleri farklı olmalıdır.");
  return { girdi: spec, cikti };
}

/**
 * Temel durumdan başlayıp bir girdiyi aralıkta değiştirerek bir çıktının serisini üretir.
 * Noktalar eşit aralıklıdır; son nokta tam `bitis`'tir. Hesaplanamayan noktada y = null ve seviye "hata".
 * Tüm seri tek y birimiyle verilir: `options.outputUnits` → tercih → noktaların en büyük mutlak değerine göre otomatik.
 * Geçersiz ayarda TaramaHatasi fırlatır.
 */
export function taramaYap(def: CalcDefinition, temel: Senaryo, ayar: TaramaAyari, options?: RunOptions): TaramaSerisi {
  const { girdi, cikti } = taramaGirdisi(def, temel, ayar);
  const n = ayar.noktaSayisi;
  const { baslangic: a, bitis: b } = ayar;

  const hamNoktalar: { x: number; ySI: number | null; seviye: CheckLevel | null }[] = [];
  for (let i = 0; i < n; i++) {
    const x = i === n - 1 ? b : temizle(a + ((b - a) * i) / (n - 1));
    const state: InputState = { ...temel.state, [girdi.key]: { value: numberToInputText(x), unit: ayar.birim } };
    const run = runCalc(def, state, options);
    if (run.ok) {
      const ySI = cikti.key in run.result.outputs ? run.result.outputs[cikti.key] : null;
      hamNoktalar.push({ x, ySI, seviye: enKotuSeviye(run.result.checks) });
    } else {
      hamNoktalar.push({ x, ySI: null, seviye: "hata" });
    }
  }

  const enBuyuk = hamNoktalar.reduce((m, p) => (p.ySI === null ? m : Math.max(m, Math.abs(p.ySI))), 0);
  const yBirim = displayUnit(cikti, enBuyuk, options);
  const noktalar: TaramaNoktasi[] = hamNoktalar.map((p) => ({
    x: p.x,
    y: p.ySI === null ? null : fromSI(p.ySI, yBirim),
    seviye: p.seviye,
  }));

  return {
    girdiKey: girdi.key,
    ciktiKey: cikti.key,
    xEtiket: girdi.label,
    yEtiket: cikti.label,
    xBirim: ayar.birim,
    yBirim,
    xBirimSembolu: birimSembolu(ayar.birim),
    yBirimSembolu: cikisSembolu(cikti, yBirim),
    noktalar,
  };
}
