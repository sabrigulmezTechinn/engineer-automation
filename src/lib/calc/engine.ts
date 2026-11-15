/**
 * Hesap motoru genel API'si. İmzalar sözleşmedir.
 * Sunucu ve istemcide çalışır.
 */
import { LIMITS } from "@/config/sinirlar";
import { MONEY_FORMAT, formatNumber, formatQuantity, fromSI, getUnit, parseNumber, toSI, unitsFor, type FormatOptions } from "@/lib/units";
import { autoOutputUnit } from "./auto-unit";
import type {
  CalcContext,
  CalcDefinition,
  CalcResult,
  Check,
  ComputeInputs,
  InputSpec,
  InputState,
  NumberInputSpec,
  NumberListInputSpec,
  OutputSpec,
  PresentedOutput,
  RunOptions,
  RunResult,
  SelectInputSpec,
} from "./types";

export { AUTO_UNIT_DIMENSIONS, autoOutputUnit } from "./auto-unit";

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
  listMinItems: (n: number) => `En az ${n} değer girin (noktalı virgülle ayırın)`,
  listMaxItems: (n: number) => `En fazla ${n} değer girilebilir`,
  listItem: (i: number, message: string) => `${i}. değer: ${message}`,
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
    } else if (input.kind === "numberList") {
      state[input.key] = {
        value: (input.default ?? []).map(numberToInputText).join("; "),
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

function allowedUnits(spec: NumberInputSpec | NumberListInputSpec | OutputSpec): string[] {
  return spec.units ?? unitsFor(spec.dimension).map((u) => u.id);
}

/** Kayan nokta payı: 0,23 kV → 230,00000000000003 V gibi çeviri artıklarını sınır ihlali saymamak için. */
function tolerance(value: number, bound: number): number {
  return 1e-12 * Math.max(Math.abs(value), Math.abs(bound));
}

function boundText(boundSI: number, unit: string): string {
  return formatQuantity(fromSI(boundSI, unit), unit);
}

/** Sayı ve liste girdilerinin ortak sınır alanları */
type NumericSpec = NumberInputSpec | NumberListInputSpec;

/** Ayrıştırılmış tek bir değeri SI'ya çevirip integer/min/max kontrollerinden geçirir. */
function checkValue(parsed: number, input: NumericSpec, unit: string): { value: number } | { error: string } {
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
  return checkValue(parsed, input, unit);
}

/** Liste metnini parçalarına ayırır: noktalı virgül veya satır sonu; boş parçalar atılır. */
export function splitList(text: string): string[] {
  return text
    .split(/[;\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/** Liste girdisini doğrular; SI değerleri veya hata mesajı (boş isteğe bağlı alanda null) döner. */
function readNumberList(
  input: NumberListInputSpec,
  state: InputState,
): { value: number[] } | { error: string } | null {
  const entry = state[input.key];
  const parts = splitList(entry?.value ?? "");
  if (parts.length === 0) {
    return input.optional ? null : { error: MESSAGES.required };
  }
  const unit = entry?.unit ?? input.defaultUnit;
  if (!allowedUnits(input).includes(unit)) return { error: MESSAGES.invalidUnit };

  const minItems = input.minItems ?? 1;
  const maxItems = input.maxItems ?? 50;
  if (parts.length < minItems) return { error: MESSAGES.listMinItems(minItems) };
  if (parts.length > maxItems) return { error: MESSAGES.listMaxItems(maxItems) };

  const values: number[] = [];
  for (const [i, part] of parts.entries()) {
    const parsed = parseNumber(part);
    if (parsed === null || !Number.isFinite(parsed)) return { error: MESSAGES.listItem(i + 1, MESSAGES.invalidNumber) };
    const r = checkValue(parsed, input, unit);
    if ("error" in r) return { error: MESSAGES.listItem(i + 1, r.error) };
    values.push(r.value);
  }
  return { value: values };
}

function failure(checks: Check[], fieldErrors: Record<string, string> = {}): RunResult {
  return { ok: false, fieldErrors, checks };
}

/** Çıktının gösterim hassasiyeti: tam sayılar ondalıksız, aksi halde anlamlı basamak (varsayılan 4). */
export function outputPrecision(spec: OutputSpec, defaultSignificant?: number): FormatOptions | undefined {
  if (spec.integer) return { decimals: 0 };
  if (spec.significant !== undefined) return { significant: spec.significant };
  if (spec.dimension === "para") return MONEY_FORMAT;
  if (defaultSignificant !== undefined) return { significant: defaultSignificant };
  return undefined;
}

/**
 * Çıktının gösterim birimi. Öncelik: kullanıcının seçimi → tercih edilen birim (imperial vb.) →
 * otomatik önek seçimi. İzinli olmayan birimler yok sayılır.
 */
export function displayUnit(spec: OutputSpec, valueSI: number, options?: RunOptions): string {
  const allowed = allowedUnits(spec);
  const requested = options?.outputUnits?.[spec.key];
  if (requested !== undefined && allowed.includes(requested)) return requested;
  const preferred = options?.preferredUnits?.[spec.dimension];
  if (preferred !== undefined && allowed.includes(preferred)) return preferred;
  return autoOutputUnit(spec, valueSI);
}

function presentOutputs(def: CalcDefinition, outputs: Record<string, number>, options?: RunOptions): PresentedOutput[] {
  const presented: PresentedOutput[] = [];
  for (const spec of def.outputs) {
    if (!(spec.key in outputs)) continue;
    const unit = displayUnit(spec, outputs[spec.key], options);
    const value = fromSI(outputs[spec.key], unit);
    const precision = outputPrecision(spec, options?.significant);
    const formattedValue = formatNumber(value, precision);
    const unitSymbol = spec.unitLabel ?? getUnit(unit).symbol;
    presented.push({
      key: spec.key,
      label: spec.label,
      ...(spec.symbol !== undefined ? { symbol: spec.symbol } : {}),
      value,
      unit,
      unitSymbol,
      formatted: spec.unitLabel !== undefined ? `${formattedValue} ${spec.unitLabel}` : formatQuantity(value, unit, precision),
      formattedValue,
    });
  }
  return presented;
}

/**
 * Girdi durumunu doğrular, SI'ya çevirir, compute'u çalıştırır ve çıktıları gösterime hazırlar.
 * Hiçbir zaman fırlatmaz: hatalar RunResult içinde döner (compute'un fırlattığı hata da dahil).
 * `outputUnits` ile çıktı başına gösterim birimi seçilebilir (anahtar: output key).
 */
export function runCalc(def: CalcDefinition, state: InputState, options?: RunOptions): RunResult {
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
          const r = input.kind === "numberList" ? readNumberList(input, state) : readNumber(input, state);
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
      outputs: presentOutputs(def, outputs, options),
    };
  } catch {
    return failure([{ level: "hata", message: MESSAGES.unexpected }]);
  }
}
