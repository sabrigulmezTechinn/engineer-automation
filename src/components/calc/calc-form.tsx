"use client";

import { useId, useMemo } from "react";
import { Formula } from "@/components/formula";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";
import { visibleInputs as resolveVisibleInputs } from "@/lib/calc/engine";
import { useCalcState, type CalcStateApi } from "./use-calc-state";
import { getCalc } from "@/lib/calc/registry";
import type {
  CalcDefinition,
  Check,
  CheckLevel,
  InputState,
  NumberInputSpec,
  NumberListInputSpec,
  OutputSpec,
  PresentedOutput,
  SelectInputSpec,
  Step,
} from "@/lib/calc/types";
import { getUnit, unitsFor, type UnitDef } from "@/lib/units";

/*
 * Hesaplama formu (istemci). Hesap tanımları fonksiyon içerdiği için sunucudan prop olarak
 * geçirilemez; bileşen yalnızca slug alır ve tanımı istemcide kayıt defterinden bulur.
 * Her değişiklikte runCalc yeniden çalışır (anlık doğrulama); sonuç durumdan türetilir.
 */

export function CalcForm({ slug }: { slug: string }) {
  const def = getCalc(slug);
  if (!def) {
    return (
      <p role="alert" className="rounded-md border border-hata-line bg-hata-bg px-4 py-3 text-sm text-hata">
        Hesap tanımı bulunamadı: <code className="font-mono">{slug}</code>
      </p>
    );
  }
  return <StandaloneCalcForm key={def.slug} def={def} />;
}

/** Kendi durumunu tutan bağımsız form (testler ve CalcWorkspace dışı kullanım için). */
function StandaloneCalcForm({ def }: { def: CalcDefinition }) {
  const calc = useCalcState(def);
  return <CalcFormView calc={calc} />;
}

// ---------------------------------------------------------------------------
// Yardımcılar

type NumericInputSpec = NumberInputSpec | NumberListInputSpec;
type UnitSpec = Pick<NumericInputSpec | OutputSpec, "dimension" | "units">;

/** Girdi/çıktı için seçilebilir birimler: tanımda `units` varsa onlar, yoksa boyutun tüm birimleri. */
function unitOptions(spec: UnitSpec): UnitDef[] {
  return spec.units && spec.units.length > 0 ? spec.units.map(getUnit) : unitsFor(spec.dimension);
}

function selectValue(def: CalcDefinition, state: InputState, key: string): string | undefined {
  const fromState = state[key]?.value;
  if (fromState !== undefined) return fromState;
  const spec = def.inputs.find((i): i is SelectInputSpec => i.kind === "select" && i.key === key);
  return spec?.default;
}

/** useId çıktısını HTML kimliği ve bağlantı parçası olarak güvenle kullanılabilir hale getirir. */
function safeIdPart(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Metin kutusu ve açılır listeler için ortak sınıflar (arka plan rengi her kullanımda ayrıca verilir). */
const CONTROL =
  "h-10 border border-line text-sm text-fg transition-colors focus:relative focus:z-10 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

// ---------------------------------------------------------------------------
// Form

/** Hesap formu ve sonuç paneli; durum dışarıdan (useCalcState) gelir. */
export function CalcFormView({ calc }: { calc: CalcStateApi }) {
  const { def, state, touched, run, setNumberValue, setNumberUnit, setSelectValue, setOutputUnit, reset } = calc;
  const baseId = `hf-${safeIdPart(useId())}`;
  const fieldId = (key: string) => `${baseId}-${key}`;

  const inputUnits = useMemo(() => {
    const map = new Map<string, UnitDef[]>();
    for (const input of def.inputs) if (input.kind !== "select") map.set(input.key, unitOptions(input));
    return map;
  }, [def]);

  const outputSpecs = useMemo(() => new Map(def.outputs.map((o) => [o.key, o])), [def]);
  const outputUnitOptions = useMemo(() => {
    const map = new Map<string, UnitDef[]>();
    for (const output of def.outputs) map.set(output.key, unitOptions(output));
    return map;
  }, [def]);

  const fieldErrors = run.ok ? {} : run.fieldErrors;
  const checks = run.ok ? run.result.checks : run.checks;

  // Motorun çözümü: visibleWhen zincirlerini de izler (denetleyici gizliyse bağımlı da gizli).
  const visibleInputs = resolveVisibleInputs(def, state);
  const labelOf = (key: string) => def.inputs.find((i) => i.key === key)?.label ?? key;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Girdiler</h3>
          <Button variant="ghost" className="-my-1 px-2 text-xs" onClick={reset}>
            Varsayılanlara dön
          </Button>
        </div>

        <form
          noValidate
          onSubmit={(e) => e.preventDefault()}
          className="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-1"
        >
          {visibleInputs.map((input) =>
            input.kind !== "select" ? (
              <NumberField
                key={input.key}
                id={fieldId(input.key)}
                spec={input}
                value={state[input.key]?.value ?? ""}
                unit={state[input.key]?.unit ?? input.defaultUnit}
                units={inputUnits.get(input.key) ?? []}
                error={fieldErrors[input.key]}
                showError={touched.has(input.key) || (state[input.key]?.value ?? "").trim() !== ""}
                onValue={(v) => setNumberValue(input, v)}
                onUnit={(u) => setNumberUnit(input, u)}
              />
            ) : (
              <SelectField
                key={input.key}
                id={fieldId(input.key)}
                spec={input}
                value={selectValue(def, state, input.key) ?? input.default}
                error={fieldErrors[input.key]}
                onValue={(v) => setSelectValue(input, v)}
              />
            ),
          )}
        </form>
      </Card>

      <Card className="p-4 sm:p-5">
        <section aria-labelledby={`${baseId}-sonuc`}>
          <h3 id={`${baseId}-sonuc`} className="font-semibold">
            Sonuç
          </h3>

          <div aria-live="polite" className="mt-4 space-y-4">
            {run.ok ? (
              <OutputCards
                outputs={run.outputs}
                specs={outputSpecs}
                unitOptions={outputUnitOptions}
                onUnit={setOutputUnit}
              />
            ) : (
              <FailedSummary
                errors={Object.entries(fieldErrors)}
                labelOf={labelOf}
                hrefOf={(key) => `#${fieldId(key)}`}
              />
            )}

            {checks.length > 0 && <CheckList checks={checks} />}
          </div>

          {run.ok && run.result.steps.length > 0 && <StepList steps={run.result.steps} />}
        </section>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Girdi alanları

function FieldLabel({ htmlFor, label, symbol, optional }: {
  htmlFor: string;
  label: string;
  symbol?: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted"> (isteğe bağlı)</span>}
      </label>
      {symbol && (
        <span className="shrink-0 text-sm text-muted">
          <Formula latex={symbol} />
        </span>
      )}
    </div>
  );
}

function FieldMessages({ errorId, error, helpId, help }: {
  errorId: string;
  error?: string;
  helpId: string;
  help?: string;
}) {
  return (
    <>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-hata">
          {error}
        </p>
      )}
      {help && (
        <p id={helpId} className="mt-1.5 text-xs text-muted">
          {help}
        </p>
      )}
    </>
  );
}

function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  const list = ids.filter(Boolean);
  return list.length ? list.join(" ") : undefined;
}

/** Negatif değer alabilen girdi: alt sınırı yok veya sıfırın altında */
export function allowsNegative(spec: NumberInputSpec): boolean {
  return spec.min === undefined || spec.min < 0;
}

/** Metnin başındaki eksi işaretini ekler/kaldırır ("12" ↔ "-12"; Unicode eksi de tanınır). */
export function toggleSign(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("-") || trimmed.startsWith("−")) return trimmed.slice(1);
  if (trimmed.startsWith("+")) return `-${trimmed.slice(1)}`;
  return `-${trimmed}`;
}

function NumberField({ id, spec, value, unit, units, error, showError, onValue, onUnit }: {
  id: string;
  spec: NumericInputSpec;
  value: string;
  unit: string;
  units: UnitDef[];
  error?: string;
  showError: boolean;
  onValue: (value: string) => void;
  onUnit: (unit: string) => void;
}) {
  const visibleError = showError ? error : undefined;
  const errorId = `${id}-hata`;
  const helpId = `${id}-yardim`;
  const hasUnitControl = units.length > 1 || (units.length === 1 && units[0].symbol !== "");
  const isList = spec.kind === "numberList";
  // ± yalnızca tek değerde: listede işaret her elemana ayrı yazılır.
  const negative = !isList && allowsNegative(spec);
  const help = spec.help ?? (isList ? "Değerleri noktalı virgülle (;) ayırın." : undefined);

  return (
    <div>
      <FieldLabel htmlFor={id} label={spec.label} symbol={spec.symbol} optional={spec.optional} />
      <div className="mt-1.5 flex">
        <input
          id={id}
          name={spec.key}
          type="text"
          // Ondalık tuş takımında ";" yok: listede tam klavye açılır.
          inputMode={isList ? "text" : "decimal"}
          autoComplete="off"
          spellCheck={false}
          placeholder={isList ? "ör. 10; 22; 47" : spec.optional ? "Boş bırakılabilir" : undefined}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          aria-invalid={visibleError ? true : undefined}
          aria-describedby={describedBy(visibleError && errorId, help && helpId)}
          className={cx(
            CONTROL,
            "min-w-0 flex-1 bg-surface px-3 font-mono tabular-nums",
            hasUnitControl ? "rounded-l-md" : "rounded-md",
            negative && !hasUnitControl && "pointer-coarse:rounded-r-none",
            "aria-[invalid=true]:border-hata aria-[invalid=true]:ring-hata/25",
          )}
        />
        {negative && (
          // Telefonların ondalık tuş takımında eksi tuşu yok (iOS); yalnızca dokunmatik ekranda gösterilir.
          <button
            type="button"
            onClick={() => onValue(toggleSign(value))}
            aria-label={`${spec.label}: işareti değiştir`}
            className={cx(
              CONTROL,
              "-ml-px hidden w-11 shrink-0 items-center justify-center bg-surface-muted font-mono text-base pointer-coarse:inline-flex",
              !hasUnitControl && "rounded-r-md",
            )}
          >
            ±
          </button>
        )}
        {units.length > 1 ? (
          <select
            aria-label={`${spec.label} birimi`}
            value={unit}
            onChange={(e) => onUnit(e.target.value)}
            className={cx(CONTROL, "-ml-px max-w-[8rem] rounded-r-md bg-surface-muted pr-7 pl-2.5")}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id} title={u.name}>
                {u.symbol}
              </option>
            ))}
          </select>
        ) : hasUnitControl ? (
          <span
            className="-ml-px inline-flex h-10 items-center rounded-r-md border border-line bg-surface-muted px-3 text-sm text-muted"
            title={units[0].name}
          >
            {units[0].symbol}
          </span>
        ) : null}
      </div>
      <FieldMessages errorId={errorId} error={visibleError} helpId={helpId} help={help} />
    </div>
  );
}

/** Kısa ve az seçenekli select'ler düğme grubu (radyo), diğerleri açılır liste olarak gösterilir. */
function isSegmented(spec: SelectInputSpec): boolean {
  return spec.options.length <= 4 && spec.options.every((o) => o.label.length <= 18);
}

function SelectField({ id, spec, value, error, onValue }: {
  id: string;
  spec: SelectInputSpec;
  value: string;
  error?: string;
  onValue: (value: string) => void;
}) {
  const errorId = `${id}-hata`;
  const helpId = `${id}-yardim`;
  const ariaDescribedBy = describedBy(error && errorId, spec.help && helpId);

  if (isSegmented(spec)) {
    return (
      <fieldset id={id} className="sm:col-span-2 lg:col-span-1" aria-describedby={ariaDescribedBy}>
        <legend className="flex w-full items-baseline justify-between gap-2 text-sm font-medium">
          <span>{spec.label}</span>
          {spec.symbol && (
            <span aria-hidden="true" className="font-normal text-muted">
              <Formula latex={spec.symbol} />
            </span>
          )}
        </legend>
        <div className="mt-1.5 inline-flex max-w-full flex-wrap gap-0.5 rounded-md border border-line bg-surface-muted p-0.5">
          {spec.options.map((option) => (
            <label
              key={option.value}
              className={cx(
                "cursor-pointer rounded px-3 py-1.5 text-sm text-muted transition-colors select-none hover:text-fg",
                "has-[:checked]:bg-surface has-[:checked]:font-medium has-[:checked]:text-fg has-[:checked]:shadow-xs",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={id}
                value={option.value}
                checked={value === option.value}
                onChange={() => onValue(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <FieldMessages errorId={errorId} error={error} helpId={helpId} help={spec.help} />
      </fieldset>
    );
  }

  return (
    <div>
      <FieldLabel htmlFor={id} label={spec.label} symbol={spec.symbol} />
      <select
        id={id}
        name={spec.key}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={ariaDescribedBy}
        className={cx(CONTROL, "mt-1.5 w-full rounded-md bg-surface px-3")}
      >
        {spec.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessages errorId={errorId} error={error} helpId={helpId} help={spec.help} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sonuç paneli

function OutputCards({ outputs, specs, unitOptions, onUnit }: {
  outputs: PresentedOutput[];
  specs: Map<string, OutputSpec>;
  unitOptions: Map<string, UnitDef[]>;
  onUnit: (key: string, unit: string) => void;
}) {
  if (outputs.length === 0) {
    return <p className="text-sm text-muted">Bu girdilerle gösterilecek bir çıktı yok.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {outputs.map((output) => {
        const units = unitOptions.get(output.key) ?? [];
        const spec = specs.get(output.key);
        const symbol = output.symbol ?? spec?.symbol;
        return (
          <li
            key={output.key}
            className="rounded-md border border-line bg-surface-muted/50 px-3.5 py-3"
            data-output={output.key}
          >
            <div className="flex items-baseline justify-between gap-2 text-sm text-muted">
              <span>{output.label}</span>
              {symbol && (
                <span className="shrink-0">
                  <Formula latex={symbol} />
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <data
                value={String(output.value)}
                className="text-2xl font-semibold tracking-tight tabular-nums"
              >
                {output.formattedValue}
              </data>
              {units.length > 1 ? (
                <select
                  aria-label={`${output.label} birimi`}
                  value={output.unit}
                  onChange={(e) => onUnit(output.key, e.target.value)}
                  className="h-7 rounded border border-line bg-surface pr-6 pl-1.5 text-sm text-fg focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id} title={u.name}>
                      {u.symbol}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-muted">{output.unitSymbol}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FailedSummary({ errors, labelOf, hrefOf }: {
  errors: [string, string][];
  labelOf: (key: string) => string;
  hrefOf: (key: string) => string;
}) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface-muted px-3.5 py-3 text-sm">
      <p className="font-medium">Sonuç hesaplanamadı.</p>
      {errors.length > 0 && (
        <>
          <p className="mt-1 text-muted">Şu girdileri kontrol edin:</p>
          <ul className="mt-1.5 space-y-1">
            {errors.map(([key, message]) => (
              <li key={key}>
                <a href={hrefOf(key)} className="font-medium text-accent hover:underline">
                  {labelOf(key)}
                </a>
                : {message}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const LEVELS: Record<CheckLevel, { label: string; box: string; text: string; icon: string }> = {
  ok: { label: "Uygun", box: "border-ok-line bg-ok-bg", text: "text-ok", icon: "M5 12.5l4.5 4.5L19 7.5" },
  uyari: {
    label: "Uyarı",
    box: "border-uyari-line bg-uyari-bg",
    text: "text-uyari",
    icon: "M12 7.5v6M12 17.2v.3",
  },
  hata: { label: "Hata", box: "border-hata-line bg-hata-bg", text: "text-hata", icon: "M7 7l10 10M17 7L7 17" },
};

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">Durum</h4>
      <ul className="mt-2 space-y-2">
        {checks.map((check, i) => {
          const level = LEVELS[check.level];
          const ref = check.reference;
          return (
            <li
              key={`${check.level}-${i}`}
              className={cx("flex gap-2.5 rounded-md border px-3 py-2.5 text-sm", level.box)}
              data-level={check.level}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className={cx("mt-px size-4 shrink-0", level.text)}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d={level.icon} />
              </svg>
              <div className="min-w-0">
                <p>
                  <span className={cx("font-semibold", level.text)}>{level.label}:</span> {check.message}
                </p>
                {ref && (
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>Referans:</span>
                    <Badge mono className="leading-snug [overflow-wrap:anywhere]">
                      {ref.standard}
                    </Badge>
                    {ref.clause && <span>{ref.clause}</span>}
                    {ref.note && <span>· {ref.note}</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="mt-6 border-t border-line pt-4">
      <h4 className="text-sm font-semibold">Ara adımlar</h4>
      <ol className="mt-2 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="rounded-md border border-line px-3.5 py-2.5">
            <p className="text-xs font-medium text-muted">
              <span className="tabular-nums">{i + 1}.</span> {step.label}
            </p>
            <Formula latex={step.latex} displayMode className="mt-1" />
          </li>
        ))}
      </ol>
    </div>
  );
}
