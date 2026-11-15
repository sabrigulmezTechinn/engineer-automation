/**
 * Rapor modeli (saf; sunucu ve istemcide çalışır). İmza sözleşmedir; gövde Faz 2 işçisi C'nindir.
 */
import { runCalc, splitList, visibleInputs } from "@/lib/calc/engine";
import type {
  CalcDefinition,
  InputSpec,
  InputState,
  NumberInputSpec,
  NumberListInputSpec,
  RunOptions,
} from "@/lib/calc/types";
import { formatNumber, formatQuantity, getUnit, parseNumber, type FormatOptions } from "@/lib/units";
import type { HesapRaporu, RaporGirdisi } from "./types";

/**
 * Girdi değerlerinin biçimi. Kullanıcının yazdığı değer raporda yuvarlanmamalı (12,3456 → "12,3456",
 * "12,35" değil); 12 anlamlı basamak yazılan her değeri kayıpsız, kayan nokta artığı olmadan gösterir.
 * Profildeki anlamlı basamak tercihi yalnızca çıktılara uygulanır.
 */
const GIRDI_BICIMI: FormatOptions = { significant: 12 };

/** Ayrıştırılamayan girdi metni raporda en çok bu uzunlukta gösterilir */
const HAM_METIN_MAX = 60;

/** Boş/girilmemiş değer */
const BOS = "—";

function hamMetin(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t === "") return BOS;
  return t.length > HAM_METIN_MAX ? `${t.slice(0, HAM_METIN_MAX - 1)}…` : t;
}

/** Bilinmeyen birimde bile fırlatmayan birimli biçim */
function birimli(value: number, unitId: string): string {
  try {
    return formatQuantity(value, unitId, GIRDI_BICIMI);
  } catch {
    return `${formatNumber(value, GIRDI_BICIMI)} ${unitId}`;
  }
}

/** Liste değerleri tek birimle: "10; 22; 47 kΩ". "%" gibi önek sembollerde her değer ayrı yazılır. */
function birimliListe(values: number[], unitId: string): string {
  const sayilar = values.map((v) => formatNumber(v, GIRDI_BICIMI));
  let symbol: string;
  try {
    symbol = getUnit(unitId).symbol;
  } catch {
    return `${sayilar.join("; ")} ${unitId}`;
  }
  if (symbol === "-") return sayilar.join("; ");
  // formatQuantity sembolü sayının sonuna boşlukla ekliyorsa liste tek sembolle yazılır.
  if (birimli(1, unitId) === `${formatNumber(1, GIRDI_BICIMI)} ${symbol}`) return `${sayilar.join("; ")} ${symbol}`;
  return values.map((v) => birimli(v, unitId)).join("; ");
}

function sayiDegeri(input: NumberInputSpec, state: InputState): string {
  const entry = state[input.key];
  const text = entry?.value ?? "";
  if (text.trim() === "") return BOS;
  const parsed = parseNumber(text);
  if (parsed === null || !Number.isFinite(parsed)) return hamMetin(text);
  return birimli(parsed, entry?.unit ?? input.defaultUnit);
}

function listeDegeri(input: NumberListInputSpec, state: InputState): string {
  const entry = state[input.key];
  const text = entry?.value ?? "";
  const parts = splitList(text);
  if (parts.length === 0) return BOS;
  const values: number[] = [];
  for (const part of parts) {
    const parsed = parseNumber(part);
    if (parsed === null || !Number.isFinite(parsed)) return hamMetin(text);
    values.push(parsed);
  }
  return birimliListe(values, entry?.unit ?? input.defaultUnit);
}

/** Görünen girdinin biçimlenmiş değeri: sayı → birimli, select → seçenek etiketi */
function girdiDegeri(input: InputSpec, state: InputState): string {
  try {
    if (input.kind === "select") {
      const value = state[input.key]?.value ?? input.default;
      return input.options.find((o) => o.value === value)?.label ?? hamMetin(value);
    }
    return input.kind === "numberList" ? listeDegeri(input, state) : sayiDegeri(input, state);
  } catch {
    return hamMetin(state[input.key]?.value ?? "");
  }
}

/**
 * Bir hesabın rapor modelini üretir: görünür girdiler (biçimlenmiş, birimli), formüller, ara adımlar,
 * çıktılar (options.outputUnits / tercihlerle), kontroller ve referanslar.
 *
 * Başarısız çalıştırmada `hataMesajlari` alan hatalarını ("Etiket: mesaj", tanım sırasıyla) ve hesabı
 * durduran "hata" seviyesindeki kontrolleri içerir; `kontroller` yalnızca geri kalan (uyarı/ok) kontrolleri.
 */
export function hesapRaporuOlustur(
  def: CalcDefinition,
  state: InputState,
  options?: RunOptions & { kayitAdi?: string; notlar?: string | null },
): HesapRaporu {
  const { kayitAdi, notlar, ...runOptions } = options ?? {};
  const gorunur = visibleInputs(def, state);
  const girdiler: RaporGirdisi[] = gorunur.map((input) => ({
    key: input.key,
    label: input.label,
    ...(input.symbol !== undefined ? { symbol: input.symbol } : {}),
    deger: girdiDegeri(input, state),
  }));

  const run = runCalc(def, state, runOptions);
  const ortak = {
    hesapId: def.id,
    hesapSlug: def.slug,
    baslik: def.title,
    aciklama: def.description,
    ...(kayitAdi !== undefined ? { kayitAdi } : {}),
    ...(notlar !== undefined ? { notlar } : {}),
    girdiler,
    formuller: def.formulas,
    referanslar: def.references,
  };

  if (run.ok) {
    return {
      ...ortak,
      adimlar: run.result.steps,
      ciktilar: run.outputs,
      kontroller: run.result.checks,
      basarili: true,
      hataMesajlari: [],
    };
  }

  const alanHatalari = def.inputs
    .filter((input) => run.fieldErrors[input.key] !== undefined)
    .map((input) => `${input.label}: ${run.fieldErrors[input.key]}`);
  // Tanımda olmayan anahtarlı alan hataları (beklenmez) yine de kaybolmasın.
  const bilinen = new Set(def.inputs.map((i) => i.key));
  const digerAlanHatalari = Object.entries(run.fieldErrors)
    .filter(([key]) => !bilinen.has(key))
    .map(([key, message]) => `${key}: ${message}`);
  const hataKontrolleri = run.checks.filter((c) => c.level === "hata").map((c) => c.message);

  return {
    ...ortak,
    adimlar: [],
    ciktilar: [],
    kontroller: run.checks.filter((c) => c.level !== "hata"),
    basarili: false,
    hataMesajlari: [...alanHatalari, ...digerAlanHatalari, ...hataKontrolleri],
  };
}
