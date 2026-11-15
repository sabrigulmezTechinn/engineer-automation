/**
 * Hesap motoru genel API'si. İmzalar sözleşmedir.
 * Sunucu ve istemcide çalışır.
 */
import { LIMITS } from "@/config/sinirlar";
import { formatQuantity, fromSI, getUnit, parseNumber, toSI, unitsFor } from "@/lib/units";
import type { Dimension } from "@/lib/units/types";
import type {
  CalcContext,
  CalcDefinition,
  CalcResult,
  Check,
  ComputeInputs,
  InputSpec,
  InputState,
  NumberInputSpec,
  OutputSpec,
  PresentedOutput,
  RunResult,
  SelectInputSpec,
} from "./types";

/** Kullanıcıya görünen motor mesajları */
export const MESSAGES = {
  required: "Bu alan zorunludur",
  invalidNumber: "Geçerli bir sayı girin",
  invalidUnit: "Bu alan için geçersiz birim",
  integer: "Tam sayı olmalıdır",
  min: (q: string) => `En az ${q} olmalıdır`,
  minExclusive: (q: string) => `${q} değerinden büyük olmalıdır`,
  max: (q: string) => `En fazla ${q} olabilir`,
  invalidOption: "Geçersiz seçim",
  fieldFailed: "Bu alan işlenemedi",
  validateFailed: "Girdiler doğrulanırken beklenmeyen bir hata oluştu",
  computeFailed: "Hesaplama sırasında beklenmeyen bir hata oluştu",
  invalidOutput: (label: string) => `${label} hesaplanamadı: sonuç geçerli bir sayı değil`,
  unexpected: "Beklenmeyen bir hata oluştu",
} as const;

/** Varsayılan bağlam: src/config/sinirlar.ts'teki LIMITS */
export function defaultContext(): CalcContext {
  return { limits: LIMITS };
}

/**
 * Sayıyı giriş kutusu metnine çevirir: 0.85 → "0,85", 1e-7 → "1e-7".
 * `formatNumber` kullanılmaz: o yuvarlar ve binlik ayırıcı ekleyebilir; giriş metni
 * `parseNumber` ile kayıpsız geri okunabilmelidir.
 */
export function numberToInputText(value: number): string {
  return String(value).replace(".", ",");
}

/** Tanımdaki varsayılanlardan başlangıç girdi durumu */
export function defaultState(def: CalcDefinition): InputState {
  const state: InputState = {};
  for (const input of def.inputs) {
    if (input.kind === "number") {
      state[input.key] = {
        value: input.default !== undefined ? numberToInputText(input.default) : "",
        unit: input.defaultUnit,
      };
    } else {
      state[input.key] = { value: input.default };
    }
  }
  return state;
}

/** Select girdisinin çözümlenmiş değeri: state'te yoksa tanımdaki varsayılan. */
function selectValue(input: SelectInputSpec, state: InputState): string {
  return state[input.key]?.value ?? input.default;
}

/**
 * Görünür girdiler. `visibleWhen` denetleyicisi gizliyse bağımlı girdi de gizlidir.
 * Denetleyici yoksa veya select değilse girdi gizli sayılır (kayıt defteri bunu zaten reddeder).
 */
export function visibleInputs(def: CalcDefinition, state: InputState): InputSpec[] {
  const byKey = new Map(def.inputs.map((i) => [i.key, i]));
  const memo = new Map<string, boolean>();

  const isVisible = (input: InputSpec, depth: number): boolean => {
    const cached = memo.get(input.key);
    if (cached !== undefined) return cached;
    let visible = true;
    const cond = input.visibleWhen;
    if (cond) {
      const ctrl = byKey.get(cond.key);
      if (!ctrl || ctrl.kind !== "select" || depth > def.inputs.length) {
        visible = false;
      } else {
        const allowed = Array.isArray(cond.equals) ? cond.equals : [cond.equals];
        visible = isVisible(ctrl, depth + 1) && allowed.includes(selectValue(ctrl, state));
      }
    }
    memo.set(input.key, visible);
    return visible;
  };

  return def.inputs.filter((i) => isVisible(i, 0));
}

function allowedUnits(spec: NumberInputSpec | OutputSpec): string[] {
  return spec.units ?? unitsFor(spec.dimension).map((u) => u.id);
}

/** Kayan nokta payı: 0,23 kV → 230,00000000000003 V gibi çeviri artıklarını sınır ihlali saymamak için. */
function tolerance(value: number, bound: number): number {
  return 1e-12 * Math.max(Math.abs(value), Math.abs(bound));
}

function boundText(boundSI: number, unit: string): string {
  return formatQuantity(fromSI(boundSI, unit), unit);
}

/** Tek bir sayı girdisini doğrular; SI değeri veya hata mesajı (boş isteğe bağlı alanda null) döner. */
function readNumber(
  input: NumberInputSpec,
  state: InputState,
): { value: number } | { error: string } | null {
  const entry = state[input.key];
  const text = entry?.value ?? "";
  if (text.trim() === "") {
    return input.optional ? null : { error: MESSAGES.required };
  }
  const parsed = parseNumber(text);
  if (parsed === null || !Number.isFinite(parsed)) return { error: MESSAGES.invalidNumber };

  const unit = entry?.unit ?? input.defaultUnit;
  if (!allowedUnits(input).includes(unit)) return { error: MESSAGES.invalidUnit };

  let si = toSI(parsed, unit);
  if (!Number.isFinite(si)) return { error: MESSAGES.invalidNumber };

  if (input.integer) {
    const rounded = Math.round(si);
    if (Math.abs(si - rounded) > tolerance(si, rounded)) return { error: MESSAGES.integer };
    si = rounded;
  }
  if (input.min !== undefined) {
    const tol = tolerance(si, input.min);
    if (input.minExclusive ? si <= input.min + tol : si < input.min - tol) {
      const q = boundText(input.min, unit);
      return { error: input.minExclusive ? MESSAGES.minExclusive(q) : MESSAGES.min(q) };
    }
  }
  if (input.max !== undefined && si > input.max + tolerance(si, input.max)) {
    return { error: MESSAGES.max(boundText(input.max, unit)) };
  }
  return { value: si };
}

function failure(checks: Check[], fieldErrors: Record<string, string> = {}): RunResult {
  return { ok: false, fieldErrors, checks };
}

/** autoUnit verilmemiş çıktılarda otomatik birim seçiminin açık olduğu boyutlar */
const AUTO_UNIT_DIMENSIONS: ReadonlySet<Dimension> = new Set<Dimension>([
  "gerilim",
  "akim",
  "direnc",
  "iletkenlik",
  "guc",
  "reaktif_guc",
  "gorunur_guc",
  "enerji",
  "yuk",
  "frekans",
  "kapasitans",
  "enduktans",
  "zaman",
  "direnc_uzunluk",
  "veri_hizi",
]);

/**
 * Değeri 1 ≤ |değer| < 1000 aralığında gösteren birimi seçer. Adaylar: izin verilen birimlerden
 * ofsetsiz olup çarpanı varsayılan birimin 10³ⁿ katı olanlar (ör. kWh → Wh/MWh; J aday değil).
 * Sıfır, sonlu olmayan değer veya otomatik seçimin kapalı olduğu çıktıda varsayılan birim döner.
 */
export function autoOutputUnit(spec: OutputSpec, valueSI: number): string {
  const enabled = spec.autoUnit ?? AUTO_UNIT_DIMENSIONS.has(spec.dimension);
  if (!enabled || valueSI === 0 || !Number.isFinite(valueSI)) return spec.defaultUnit;
  const base = getUnit(spec.defaultUnit);
  if (base.offset) return spec.defaultUnit;
  const family = allowedUnits(spec)
    .map((id) => getUnit(id))
    .filter((u) => {
      if (u.offset) return false;
      const n = Math.log10(u.factor / base.factor) / 3;
      return Math.abs(n - Math.round(n)) < 1e-9;
    })
    .sort((a, b) => a.factor - b.factor);
  if (family.length === 0) return spec.defaultUnit;
  const abs = Math.abs(valueSI);
  // 4 anlamlı basamağa yuvarlanmış gösterim ölçüt alınır: 0,99996 A "1000 mA" değil "1 A" olur.
  let chosen = family[0];
  for (const u of family) {
    if (Number((abs / u.factor).toPrecision(4)) >= 1) chosen = u;
  }
  return chosen.id;
}

function presentOutputs(
  def: CalcDefinition,
  outputs: Record<string, number>,
  outputUnits: Record<string, string> | undefined,
): PresentedOutput[] {
  const presented: PresentedOutput[] = [];
  for (const spec of def.outputs) {
    if (!(spec.key in outputs)) continue;
    const requested = outputUnits?.[spec.key];
    // Kullanıcının seçtiği birim önceliklidir; seçilmemişse veya bu çıktıya ait değilse otomatik seçilir.
    const unit =
      requested !== undefined && allowedUnits(spec).includes(requested)
        ? requested
        : autoOutputUnit(spec, outputs[spec.key]);
    const value = fromSI(outputs[spec.key], unit);
    presented.push({
      key: spec.key,
      label: spec.label,
      ...(spec.symbol !== undefined ? { symbol: spec.symbol } : {}),
      value,
      unit,
      formatted: formatQuantity(value, unit),
    });
  }
  return presented;
}

/**
 * Girdi durumunu doğrular, SI'ya çevirir, compute'u çalıştırır ve çıktıları gösterime hazırlar.
 * Hiçbir zaman fırlatmaz: hatalar RunResult içinde döner (compute'un fırlattığı hata da dahil).
 * `outputUnits` ile çıktı başına gösterim birimi seçilebilir (anahtar: output key).
 */
export function runCalc(
  def: CalcDefinition,
  state: InputState,
  options?: { ctx?: CalcContext; outputUnits?: Record<string, string> },
): RunResult {
  try {
    const ctx = options?.ctx ?? defaultContext();

    // (a)–(b) Görünür girdileri doğrula ve SI'ya çevir
    const fieldErrors: Record<string, string> = {};
    const inputsSI: ComputeInputs = {};
    for (const input of visibleInputs(def, state)) {
      try {
        if (input.kind === "select") {
          const value = selectValue(input, state);
          if (input.options.some((o) => o.value === value)) inputsSI[input.key] = value;
          else fieldErrors[input.key] = MESSAGES.invalidOption;
        } else {
          const r = readNumber(input, state);
          if (r === null) continue;
          if ("error" in r) fieldErrors[input.key] = r.error;
          else inputsSI[input.key] = r.value;
        }
      } catch {
        fieldErrors[input.key] = MESSAGES.fieldFailed;
      }
    }

    // (c)
    if (Object.keys(fieldErrors).length > 0) return failure([], fieldErrors);

    // (d) Çapraz alan kontrolleri
    let validateChecks: Check[] = [];
    if (def.validate) {
      try {
        validateChecks = def.validate(inputsSI, ctx);
      } catch {
        return failure([{ level: "hata", message: MESSAGES.validateFailed }]);
      }
      if (validateChecks.some((c) => c.level === "hata")) return failure(validateChecks);
    }

    // (e) Hesap
    let computed: CalcResult;
    try {
      computed = def.compute(inputsSI, ctx);
    } catch {
      return failure([...validateChecks, { level: "hata", message: MESSAGES.computeFailed }]);
    }

    const outputs: Record<string, number> = {};
    const outputChecks: Check[] = [];
    for (const [key, value] of Object.entries(computed.outputs ?? {})) {
      if (typeof value === "number" && Number.isFinite(value)) {
        outputs[key] = value;
      } else {
        const label = def.outputs.find((o) => o.key === key)?.label ?? key;
        outputChecks.push({ level: "hata", message: MESSAGES.invalidOutput(label) });
      }
    }

    const result: CalcResult = {
      outputs,
      steps: computed.steps ?? [],
      checks: [...validateChecks, ...(computed.checks ?? []), ...outputChecks],
    };

    // (f) Gösterim
    return {
      ok: true,
      inputsSI,
      result,
      outputs: presentOutputs(def, outputs, options?.outputUnits),
    };
  } catch {
    return failure([{ level: "hata", message: MESSAGES.unexpected }]);
  }
}
