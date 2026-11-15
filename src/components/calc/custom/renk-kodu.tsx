"use client";

/*
 * 4.5 Direnç renk kodu / SMD / kondansatör kodları arayüzü (CalcDefinition.customUi = "renk-kodu").
 * Kural: durum InputState'tir ve sonuç runCalc'tan gelir (calc.run); bu bileşen yalnızca gösterimdir, böylece
 * kaydetme, karşılaştırma ve PDF genel yoldan çalışır. Üstteki panel:
 * - renk bantları kipinde bantlı direnç çizimi (SVG) ve her bant için renk örnekleriyle seçim (radyo grubu);
 * - SMD/kondansatör kipinde tek metin kutusu: yazılan kod (472, 4R7, 01C, 104J) saf `kodCoz` ile ayrıştırılır ve
 *   alttaki select/sayı girdilerine calc.setSelectValue / calc.setNumberValue ile yazılır.
 * Altında genel form (CalcFormView) tüm girdileri, sonuç kartlarını, kontrolleri ve adımları gösterir.
 */
import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";
import { visibleInputs } from "@/lib/calc/engine";
import { ANAHTAR, kodCoz, kodYaz, type KodTuru, type Renk } from "@/lib/calc/defs/elektronik/kod-ortak";
import { getCalc } from "@/lib/calc/registry";
import type { CalcDefinition, NumberInputSpec, SelectInputSpec } from "@/lib/calc/types";
import { CalcFormView } from "../calc-form";
import { useCalcState, type CalcStateApi } from "../use-calc-state";

/** CalcWorkspace içinde: durum dışarıdan (useCalcState) gelir. */
export function RenkKodu({ calc }: { calc: CalcStateApi }) {
  return (
    <div className="space-y-6">
      <KodPaneli calc={calc} />
      <CalcFormView calc={calc} />
    </div>
  );
}

/** Kendi durumunu tutan bağımsız kullanım (testler için). */
export function RenkKoduBagimsiz({ slug }: { slug: string }) {
  const def = getCalc(slug);
  if (!def) {
    return (
      <p role="alert" className="rounded-md border border-hata-line bg-hata-bg px-4 py-3 text-sm text-hata">
        Hesap tanımı bulunamadı: <code className="font-mono">{slug}</code>
      </p>
    );
  }
  return <Bagimsiz key={def.slug} def={def} />;
}

function Bagimsiz({ def }: { def: CalcDefinition }) {
  const calc = useCalcState(def);
  return <RenkKodu calc={calc} />;
}

// ---------------------------------------------------------------------------
// Yardımcılar

/**
 * Çizimdeki bant renkleri (yalnızca gösterim; standart renk değerleri değildir). "yok" bant çizilmez.
 */
export const RENK_GORUNUM: Record<Renk, string> = {
  siyah: "#1c1917",
  kahverengi: "#7b4a24",
  kirmizi: "#dc2626",
  turuncu: "#f97316",
  sari: "#facc15",
  yesil: "#16a34a",
  mavi: "#2563eb",
  mor: "#7c3aed",
  gri: "#8b8b8b",
  beyaz: "#f5f5f4",
  altin: "#c8a43a",
  gumus: "#b8bcc2",
  yok: "transparent",
};

function safeIdPart(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function selectSpec(def: CalcDefinition, key: string): SelectInputSpec | undefined {
  return def.inputs.find((i): i is SelectInputSpec => i.kind === "select" && i.key === key);
}

function numberSpec(def: CalcDefinition, key: string): NumberInputSpec | undefined {
  return def.inputs.find((i): i is NumberInputSpec => i.kind === "number" && i.key === key);
}

/** Girdinin güncel değeri: durumda yoksa select varsayılanı ya da sayı varsayılanı (metin). */
function currentValue(calc: CalcStateApi, key: string): string | undefined {
  const fromState = calc.state[key]?.value;
  if (fromState !== undefined) return fromState;
  const spec = calc.def.inputs.find((i) => i.key === key);
  if (!spec) return undefined;
  if (spec.kind === "select") return spec.default;
  return spec.kind === "number" && spec.default !== undefined ? String(spec.default) : undefined;
}

/** Bant girdileri, çizimdeki soldan sağa sırasıyla */
const BANT_ANAHTARLARI = [...ANAHTAR.rakam, ANAHTAR.carpan, ANAHTAR.tol, ANAHTAR.tcr];

// ---------------------------------------------------------------------------
// Panel

function KodPaneli({ calc }: { calc: CalcStateApi }) {
  const baseId = `rk-${safeIdPart(useId())}`;
  const mod = currentValue(calc, ANAHTAR.mod);
  const titleId = `${baseId}-baslik`;

  return (
    <Card className="p-4 sm:p-5">
      <section aria-labelledby={titleId}>
        <h3 id={titleId} className="font-semibold">
          Kod görseli
        </h3>
        <div className="mt-4">
          {mod === "renk" ? (
            <RenkBantlari calc={calc} baseId={baseId} />
          ) : mod === "smd" || mod === "kondansator" ? (
            // Kip değişince metin kutusunun taslağı sıfırlansın.
            <KodKutusu key={mod} calc={calc} tur={mod} baseId={baseId} />
          ) : null}
        </div>
        <Ozet calc={calc} />
      </section>
    </Card>
  );
}

/** Hesabın sonucundan kısa özet (değer ve tolerans); sonuç calc.run'dan gelir. */
function Ozet({ calc }: { calc: CalcStateApi }) {
  const { run } = calc;
  if (!run.ok) return null;
  const find = (key: string) => run.outputs.find((o) => o.key === key);
  const value = find("R") ?? find("C");
  if (!value) return null;
  const tol = find("tol") ?? find("tolC") ?? find("tolCabs");
  return (
    <p className="mt-4 text-sm text-muted" data-ozet>
      <span className="sr-only">Sonuç: </span>
      <span className="text-xl font-semibold tracking-tight text-fg tabular-nums">{value.formatted}</span>
      {tol && <span className="ml-2 tabular-nums">±{tol.formatted}</span>}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Renk bantları

function RenkBantlari({ calc, baseId }: { calc: CalcStateApi; baseId: string }) {
  const visible = new Set(visibleInputs(calc.def, calc.state).map((i) => i.key));
  const bantlar = BANT_ANAHTARLARI.flatMap((key) => {
    const spec = selectSpec(calc.def, key);
    if (!spec || !visible.has(key)) return [];
    const value = currentValue(calc, key) ?? spec.default;
    return [{ key, spec, value: value as Renk }];
  });

  return (
    <div className="space-y-5">
      <DirencCizimi bantlar={bantlar.map((b) => ({ key: b.key, renk: b.value, label: b.spec.options.find((o) => o.value === b.value)?.label ?? b.value }))} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {bantlar.map((b) => (
          <BantSecici
            key={b.key}
            id={`${baseId}-${b.key}`}
            spec={b.spec}
            value={b.value}
            onValue={(v) => calc.setSelectValue(b.spec, v)}
          />
        ))}
      </div>
    </div>
  );
}

/** Bantlı direnç çizimi: rakam ve çarpan bantları solda, tolerans (ve TCR) bandı aralıklı olarak sağda. */
function DirencCizimi({ bantlar }: { bantlar: { key: string; renk: Renk; label: string }[] }) {
  const solda = bantlar.filter((b) => b.key !== ANAHTAR.tol && b.key !== ANAHTAR.tcr);
  const sagda = bantlar.filter((b) => (b.key === ANAHTAR.tol || b.key === ANAHTAR.tcr) && b.renk !== "yok");
  const etiket = bantlar.filter((b) => b.renk !== "yok").map((b) => b.label).join(", ");
  return (
    <svg
      viewBox="0 0 260 80"
      role="img"
      aria-label={`Direnç çizimi: ${etiket}`}
      className="mx-auto block h-auto w-full max-w-md"
      data-direnc
    >
      <line x1="0" y1="40" x2="260" y2="40" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
      <rect x="44" y="16" width="172" height="48" rx="20" fill="#e7d3aa" stroke="#b9a27a" strokeWidth="1.5" />
      {solda.map((b, i) => (
        <rect key={b.key} x={68 + i * 20} y="16" width="11" height="48" fill={RENK_GORUNUM[b.renk]} stroke="#00000033" data-bant={b.key} data-renk={b.renk}>
          <title>{b.label}</title>
        </rect>
      ))}
      {sagda.map((b, i) => (
        <rect key={b.key} x={164 + i * 20} y="16" width={b.key === ANAHTAR.tol ? 14 : 11} height="48" fill={RENK_GORUNUM[b.renk]} stroke="#00000033" data-bant={b.key} data-renk={b.renk}>
          <title>{b.label}</title>
        </rect>
      ))}
    </svg>
  );
}

/** Bir bandın renk seçimi: renk örnekli radyo grubu (erişilebilir ad seçenek etiketidir, ör. "Sarı (4)"). */
function BantSecici({ id, spec, value, onValue }: {
  id: string;
  spec: SelectInputSpec;
  value: string;
  onValue: (value: string) => void;
}) {
  const selected = spec.options.find((o) => o.value === value);
  return (
    <fieldset id={id}>
      <legend className="flex w-full items-baseline justify-between gap-2 text-sm font-medium">
        <span>{spec.label}</span>
        <span className="font-normal text-muted" aria-hidden="true">
          {selected?.label}
        </span>
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {spec.options.map((o) => {
          const renk = o.value as Renk;
          return (
            <label
              key={o.value}
              title={o.label}
              className={cx(
                "inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-line transition-shadow",
                "has-[:checked]:ring-2 has-[:checked]:ring-accent has-[:checked]:ring-offset-2 has-[:checked]:ring-offset-surface",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={id}
                value={o.value}
                checked={value === o.value}
                onChange={() => onValue(o.value)}
                aria-label={o.label}
              />
              <span
                aria-hidden="true"
                className={cx("block size-6 rounded-full", renk === "yok" && "border border-dashed border-line-strong")}
                style={{ background: RENK_GORUNUM[renk] ?? "transparent" }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// SMD / kondansatör kodu

const KOD_METNI: Record<KodTuru, { label: string; help: string }> = {
  smd: { label: "SMD kodu", help: "Örnekler: 472, 4R7, R47, 4702, 47R0, 10L0, EIA-96 01C." },
  kondansator: { label: "Kondansatör kodu", help: "Örnekler: 104J, 104, 229C, 47J (iki hane = pF)." },
};

function KodKutusu({ calc, tur, baseId }: { calc: CalcStateApi; tur: KodTuru; baseId: string }) {
  // Yazılırken kullanıcının metni gösterilir; geçerli kod girdilere yazılır. Odak bırakılınca (geçerliyse)
  // gösterim girdilerden yeniden üretilir. Böylece genel formdan yapılan değişiklik de kutuya yansır.
  const [taslak, setTaslak] = useState<string | null>(null);
  const kod = kodYaz((key) => currentValue(calc, key), tur);
  const cozum = taslak === null ? null : kodCoz(taslak, tur);
  const hata = cozum && !cozum.ok ? cozum.hata : undefined;
  const id = `${baseId}-kod`;
  const errorId = `${id}-hata`;
  const helpId = `${id}-yardim`;

  const onChange = (text: string) => {
    setTaslak(text);
    const r = kodCoz(text, tur);
    if (!r.ok) return;
    for (const [key, value] of Object.entries(r.secimler)) {
      const spec = selectSpec(calc.def, key);
      if (spec) calc.setSelectValue(spec, value);
    }
    for (const [key, value] of Object.entries(r.sayilar)) {
      const spec = numberSpec(calc.def, key);
      if (spec) calc.setNumberValue(spec, value);
    }
  };

  return (
    <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {KOD_METNI[tur].label}
        </label>
        <input
          id={id}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={taslak ?? kod}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (!hata) setTaslak(null);
          }}
          aria-invalid={hata ? true : undefined}
          aria-describedby={hata ? `${errorId} ${helpId}` : helpId}
          className={cx(
            "mt-1.5 h-12 w-full rounded-md border border-line bg-surface px-3 font-mono text-2xl tracking-widest text-fg uppercase tabular-nums",
            "transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none",
            "aria-[invalid=true]:border-hata aria-[invalid=true]:ring-hata/25",
          )}
        />
        {hata && (
          <p id={errorId} className="mt-1.5 text-xs font-medium text-hata">
            {hata}
          </p>
        )}
        <p id={helpId} className="mt-1.5 text-xs text-muted">
          {KOD_METNI[tur].help} Yazılan kod alttaki girdilere aktarılır.
        </p>
      </div>
      {tur === "smd" ? <CipCizimi kod={kod} /> : <KondansatorCizimi kod={kod} />}
    </div>
  );
}

function CipCizimi({ kod }: { kod: string }) {
  return (
    <svg viewBox="0 0 200 90" role="img" aria-label={`SMD direnç çizimi: ${kod}`} className="mx-auto block h-auto w-full max-w-[16rem]" data-cip>
      <rect x="10" y="15" width="180" height="60" rx="4" fill="#d6d3d1" />
      <rect x="34" y="15" width="132" height="60" fill="#1c1917" />
      <text x="100" y="54" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="28" fill="#f5f5f4" letterSpacing="3">
        {kod}
      </text>
    </svg>
  );
}

function KondansatorCizimi({ kod }: { kod: string }) {
  return (
    <svg viewBox="0 0 200 110" role="img" aria-label={`Kondansatör çizimi: ${kod}`} className="mx-auto block h-auto w-full max-w-[14rem]" data-kondansator>
      <line x1="80" y1="70" x2="80" y2="110" stroke="#9ca3af" strokeWidth="4" />
      <line x1="120" y1="70" x2="120" y2="110" stroke="#9ca3af" strokeWidth="4" />
      <ellipse cx="100" cy="45" rx="62" ry="40" fill="#d97706" />
      <text x="100" y="54" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="26" fill="#1c1917" letterSpacing="2">
        {kod}
      </text>
    </svg>
  );
}
