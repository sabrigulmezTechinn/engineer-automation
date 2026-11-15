"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Formula } from "@/components/formula";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";
import {
  AWG_ID,
  awgName,
  inputKey,
  LINEAR_QUANTITIES,
  type AwgYon,
  type LinearQuantity,
} from "@/lib/calc/defs/yardimci/birim-donusturucu";
import { defaultState, runCalc } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import type {
  CalcDefinition,
  Check,
  CheckLevel,
  InputState,
  NumberInputSpec,
  RunResult,
  SelectInputSpec,
  Step,
} from "@/lib/calc/types";
import { formatQuantity, fromSI, unitsFor, type UnitDef } from "@/lib/units";

/*
 * 7.1 Birim dönüştürücü arayüzü. Durum InputState olarak tutulur ve sonuç runCalc ile alınır; böylece
 * kaydetme, karşılaştırma ve PDF (Faz 2) genel hesaplarla aynı yoldan çalışır. Doğrusal büyüklüklerde
 * hesabın SI çıktısı, o boyuttaki tüm birimlerde tablo olarak gösterilir.
 * Görsel dil ve erişilebilirlik desenleri src/components/calc/calc-form.tsx ile aynıdır.
 */

/** Dönüşüm tablosunda gösterilen anlamlı basamak sayısı (formdaki 4'ten fazla: dönüştürücüde hassasiyet önemli). */
const TABLE_DIGITS = 6;

export function BirimDonusturucu({ slug }: { slug: string }) {
  const def = getCalc(slug);
  if (!def) {
    return (
      <p role="alert" className="rounded-md border border-hata-line bg-hata-bg px-4 py-3 text-sm text-hata">
        Hesap tanımı bulunamadı: <code className="font-mono">{slug}</code>
      </p>
    );
  }
  return <Converter key={def.slug} def={def} />;
}

// ---------------------------------------------------------------------------
// Yardımcılar

function safeRun(def: CalcDefinition, state: InputState): RunResult {
  try {
    return runCalc(def, state);
  } catch (error) {
    console.error(`runCalc(${def.id}) beklenmeyen hata`, error);
    return {
      ok: false,
      fieldErrors: {},
      checks: [{ level: "hata", message: "Hesap çalıştırılırken beklenmeyen bir hata oluştu." }],
    };
  }
}

function safeIdPart(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function selectSpec(def: CalcDefinition, key: string): SelectInputSpec | undefined {
  return def.inputs.find((i): i is SelectInputSpec => i.kind === "select" && i.key === key);
}

function numberSpec(def: CalcDefinition, key: string): NumberInputSpec | undefined {
  return def.inputs.find((i): i is NumberInputSpec => i.kind === "number" && i.key === key);
}

function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  const list = ids.filter(Boolean);
  return list.length ? list.join(" ") : undefined;
}

/** Metnin başındaki eksi işaretini ekler/kaldırır. */
function toggleSign(text: string): string {
  const t = text.trim();
  if (t.startsWith("-") || t.startsWith("−")) return t.slice(1);
  if (t.startsWith("+")) return `-${t.slice(1)}`;
  return `-${t}`;
}

/**
 * ± düğmesi gösterilsin mi: alt sınırı olmayan büyüklükler ve sıcaklık (SI sınırı 0 K olsa da
 * −40 °C gibi negatif değerler geçerlidir).
 */
function allowsNegative(q: LinearQuantity): boolean {
  return q.min === undefined || q.dimension === "sicaklik";
}

const CONTROL =
  "h-10 border border-line text-sm text-fg transition-colors focus:relative focus:z-10 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

const fmt = (valueSI: number, unitId: string) =>
  formatQuantity(fromSI(valueSI, unitId), unitId, { significant: TABLE_DIGITS });

// ---------------------------------------------------------------------------
// Ana bileşen

function Converter({ def }: { def: CalcDefinition }) {
  const baseId = `bd-${safeIdPart(useId())}`;
  const fieldId = (key: string) => `${baseId}-${key}`;

  const [state, setState] = useState<InputState>(() => defaultState(def));
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const run = useMemo(() => safeRun(def, state), [def, state]);

  const fieldErrors = run.ok ? {} : run.fieldErrors;
  const checks = run.ok ? run.result.checks : run.checks;

  const buyuklukSpec = selectSpec(def, "buyukluk");
  const yonSpec = selectSpec(def, "awg_yon");
  const awgNoSpec = selectSpec(def, "awg_no");
  const buyukluk = state.buyukluk?.value ?? buyuklukSpec?.default ?? "";
  const yon = (state.awg_yon?.value ?? yonSpec?.default) as AwgYon;
  const quantity = LINEAR_QUANTITIES.find((q) => q.id === buyukluk);
  const isAwg = buyukluk === AWG_ID;

  const setValue = (spec: NumberInputSpec, value: string) => {
    setState((prev) => ({ ...prev, [spec.key]: { unit: spec.defaultUnit, ...prev[spec.key], value } }));
    setTouched((prev) => (prev.has(spec.key) ? prev : new Set(prev).add(spec.key)));
  };
  const setUnit = (spec: NumberInputSpec, unit: string) => {
    // Birim değişince sayı korunur: kullanıcı yazdığı değerin birimini seçer (genel formla aynı).
    setState((prev) => ({ ...prev, [spec.key]: { value: prev[spec.key]?.value ?? "", unit } }));
  };
  const setSelect = (key: string, value: string) => setState((prev) => ({ ...prev, [key]: { value } }));
  const reset = () => {
    setState(defaultState(def));
    setTouched(new Set());
  };

  const labelOf = (key: string) => def.inputs.find((i) => i.key === key)?.label ?? key;

  const renderNumber = (key: string, negative: boolean) => {
    const spec = numberSpec(def, key);
    if (!spec) return null;
    const text = state[key]?.value ?? "";
    return (
      <NumberField
        id={fieldId(key)}
        spec={spec}
        value={text}
        unit={state[key]?.unit ?? spec.defaultUnit}
        units={unitsFor(spec.dimension)}
        error={touched.has(key) || text.trim() !== "" ? fieldErrors[key] : undefined}
        negative={negative}
        onValue={(v) => setValue(spec, v)}
        onUnit={(u) => setUnit(spec, u)}
      />
    );
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Girdiler</h3>
          <Button variant="ghost" className="-my-1 px-2 text-xs" onClick={reset}>
            Varsayılanlara dön
          </Button>
        </div>

        <form noValidate onSubmit={(e) => e.preventDefault()} className="mt-4 grid grid-cols-1 gap-y-5">
          {buyuklukSpec && (
            <SelectField
              id={fieldId("buyukluk")}
              spec={buyuklukSpec}
              value={buyukluk}
              onValue={(v) => setSelect("buyukluk", v)}
            />
          )}

          {quantity && renderNumber(inputKey(quantity.id), allowsNegative(quantity))}

          {isAwg && yonSpec && (
            <SegmentedField
              id={fieldId("awg_yon")}
              spec={yonSpec}
              value={yon}
              onValue={(v) => setSelect("awg_yon", v)}
            />
          )}
          {isAwg && yon === "awg-mm2" && awgNoSpec && (
            <SelectField
              id={fieldId("awg_no")}
              spec={awgNoSpec}
              value={state.awg_no?.value ?? awgNoSpec.default}
              onValue={(v) => setSelect("awg_no", v)}
            />
          )}
          {isAwg && yon === "mm2-awg" && renderNumber("awg_kesit", false)}
        </form>
      </Card>

      <Card className="p-4 sm:p-5">
        <section aria-labelledby={`${baseId}-sonuc`}>
          <h3 id={`${baseId}-sonuc`} className="font-semibold">
            Sonuç
          </h3>

          <div aria-live="polite" className="mt-4 space-y-4">
            {!run.ok ? (
              <FailedSummary errors={Object.entries(fieldErrors)} labelOf={labelOf} hrefOf={(k) => `#${fieldId(k)}`} />
            ) : quantity ? (
              <ConversionTable
                quantity={quantity}
                valueSI={run.result.outputs[quantity.id]}
                inputUnit={state[inputKey(quantity.id)]?.unit ?? quantity.defaultUnit}
              />
            ) : isAwg && yon === "awg-mm2" ? (
              <AwgSize outputs={run.result.outputs} awg={Number(state.awg_no?.value ?? awgNoSpec?.default)} />
            ) : isAwg ? (
              <AwgNearest outputs={run.result.outputs} />
            ) : null}

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

function FieldMessages({ errorId, error, helpId, help }: { errorId: string; error?: string; helpId: string; help?: string }) {
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

function NumberField({ id, spec, value, unit, units, error, negative, onValue, onUnit }: {
  id: string;
  spec: NumberInputSpec;
  value: string;
  unit: string;
  units: UnitDef[];
  error?: string;
  negative: boolean;
  onValue: (value: string) => void;
  onUnit: (unit: string) => void;
}) {
  const errorId = `${id}-hata`;
  const helpId = `${id}-yardim`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {spec.label}
        </label>
        {spec.symbol && (
          <span className="shrink-0 text-sm text-muted">
            <Formula latex={spec.symbol} />
          </span>
        )}
      </div>
      <div className="mt-1.5 flex">
        <input
          id={id}
          name={spec.key}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(error && errorId, spec.help && helpId)}
          className={cx(
            CONTROL,
            "min-w-0 flex-1 rounded-l-md bg-surface px-3 font-mono tabular-nums",
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
            )}
          >
            ±
          </button>
        )}
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
      </div>
      <FieldMessages errorId={errorId} error={error} helpId={helpId} help={spec.help} />
    </div>
  );
}

function SelectField({ id, spec, value, onValue }: {
  id: string;
  spec: SelectInputSpec;
  value: string;
  onValue: (value: string) => void;
}) {
  const helpId = `${id}-yardim`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {spec.label}
      </label>
      <select
        id={id}
        name={spec.key}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-describedby={spec.help ? helpId : undefined}
        className={cx(CONTROL, "mt-1.5 w-full rounded-md bg-surface px-3")}
      >
        {spec.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldMessages errorId={`${id}-hata`} helpId={helpId} help={spec.help} />
    </div>
  );
}

/** Az seçenekli select: düğme grubu (radyo), genel formdaki görünümle aynı. */
function SegmentedField({ id, spec, value, onValue }: {
  id: string;
  spec: SelectInputSpec;
  value: string;
  onValue: (value: string) => void;
}) {
  return (
    <fieldset id={id}>
      <legend className="text-sm font-medium">{spec.label}</legend>
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
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Sonuç

const TABLE = "w-full border-collapse text-sm";
const TH = "border-b border-line px-3 py-2 text-left text-xs font-medium text-muted";
const TD = "border-b border-line px-3 py-2";

function ConversionTable({ quantity, valueSI, inputUnit }: { quantity: LinearQuantity; valueSI: number; inputUnit: string }) {
  const units = unitsFor(quantity.dimension);
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className={TABLE} data-conversion={quantity.id}>
        <caption className="px-3 pt-2.5 pb-1 text-left text-sm font-medium">{quantity.label}: tüm birimlerde</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Birim
            </th>
            <th scope="col" className={cx(TH, "text-right")}>
              Değer
            </th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const isInput = u.id === inputUnit;
            return (
              <tr key={u.id} data-unit={u.id} className={cx(isInput && "bg-accent-soft")}>
                <th scope="row" className={cx(TD, "text-left font-normal")}>
                  <span className="text-fg">{u.name}</span>{" "}
                  <span className="text-muted">({u.symbol})</span>
                  {isInput && (
                    <Badge tone="accent" className="ml-2">
                      girdi
                    </Badge>
                  )}
                </th>
                <td className={cx(TD, "text-right font-mono tabular-nums")}>
                  <data value={String(fromSI(valueSI, u.id))}>{fmt(valueSI, u.id)}</data>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, children, name }: { label: string; children: ReactNode; name: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0" data-awg={name}>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-mono tabular-nums">{children}</dd>
    </div>
  );
}

function AwgSize({ outputs, awg }: { outputs: Record<string, number>; awg: number }) {
  const d = outputs.awg_cap;
  const A = outputs.awg_alan;
  if (d === undefined || A === undefined) return null;
  return (
    <div className="rounded-md border border-line">
      <p className="px-3 pt-2.5 pb-1 text-sm font-medium">{awgName(awg)} AWG</p>
      <dl className="text-sm">
        <Row label="Tel çapı" name="cap">
          {fmt(d, "mm")} · {fmt(d, "in")} · {fmt(d, "thou")}
        </Row>
        <Row label="Kesit" name="alan">
          {fmt(A, "mm2")}
        </Row>
      </dl>
    </div>
  );
}

function AwgNearest({ outputs }: { outputs: Record<string, number> }) {
  const rows: { key: string; label: string; n?: number; area?: number }[] = [
    { key: "yakin", label: "En yakın", n: outputs.awg_n, area: outputs.awg_n_alan },
    { key: "buyuk", label: "Bir büyük kesit", n: outputs.awg_buyuk_n, area: outputs.awg_buyuk_alan },
    { key: "kucuk", label: "Bir küçük kesit", n: outputs.awg_kucuk_n, area: outputs.awg_kucuk_alan },
  ];
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className={TABLE}>
        <caption className="px-3 pt-2.5 pb-1 text-left text-sm font-medium">Karşılık gelen AWG boyutları</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              <span className="sr-only">Sıra</span>
            </th>
            <th scope="col" className={TH}>
              Boyut
            </th>
            <th scope="col" className={cx(TH, "text-right")}>
              Kesit
            </th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.n !== undefined && r.area !== undefined)
            .map((r) => (
              <tr key={r.key} data-awg={r.key} className={cx(r.key === "yakin" && "bg-accent-soft")}>
                <th scope="row" className={cx(TD, "text-left font-normal text-muted")}>
                  {r.label}
                </th>
                <td className={cx(TD, "font-medium")}>{awgName(r.n as number)} AWG</td>
                <td className={cx(TD, "text-right font-mono tabular-nums")}>{fmt(r.area as number, "mm2")}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {outputs.awg_sapma !== undefined && (
        <p className="px-3 py-2 text-xs text-muted">
          En yakın boyutun kesit sapması: <span className="font-mono tabular-nums">{formatQuantity(fromSI(outputs.awg_sapma, "percent"), "percent")}</span>
        </p>
      )}
    </div>
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
  uyari: { label: "Uyarı", box: "border-uyari-line bg-uyari-bg", text: "text-uyari", icon: "M12 7.5v6M12 17.2v.3" },
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
                    <Badge mono>{ref.standard}</Badge>
                    {ref.clause && <span>{ref.clause}</span>}
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
