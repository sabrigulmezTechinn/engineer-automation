"use client";

/**
 * Hesap sayfasının durumu: girdiler (InputState), kullanıcının seçtiği çıktı birimleri, dokunulan alanlar
 * ve runCalc sonucu. CalcWorkspace bu hook'u bir kez çağırır; form (CalcFormView ya da özel arayüz),
 * kaydetme araçları, senaryo paneli ve rapor düğmesi aynı nesneyi paylaşır.
 *
 * Kaydedilen ve karşılaştırılan şey `state` + `outputUnits`'tir (düz JSON). Sonuç her zaman durumdan türetilir.
 */
import { useCallback, useMemo, useState } from "react";
import { defaultState, runCalc } from "@/lib/calc/engine";
import type {
  CalcDefinition,
  InputState,
  NumberInputSpec,
  NumberListInputSpec,
  RunOptions,
  RunResult,
  SelectInputSpec,
} from "@/lib/calc/types";

/** Kullanıcı tercihlerinden gelen runCalc seçenekleri (profil: anlamlı basamak, birim sistemi) */
export type CalcTercihleri = Pick<RunOptions, "significant" | "preferredUnits">;

/** Kayıtlı bir hesaptan ya da senaryodan başlangıç durumu */
export interface CalcBaslangic {
  state?: InputState;
  outputUnits?: Record<string, string>;
}

/** runCalc sözleşmeye göre fırlatmaz; yine de bir tanım hatası tüm sayfayı düşürmesin. */
export function safeRun(def: CalcDefinition, state: InputState, options: RunOptions): RunResult {
  try {
    return runCalc(def, state, options);
  } catch (error) {
    console.error(`runCalc(${def.id}) beklenmeyen hata`, error);
    return {
      ok: false,
      fieldErrors: {},
      checks: [{ level: "hata", message: "Hesap çalıştırılırken beklenmeyen bir hata oluştu." }],
    };
  }
}

/** Kayıtlı/başlangıç durumunu tanımın varsayılanlarıyla birleştirir (tanıma sonradan eklenen girdiler için). */
export function initialState(def: CalcDefinition, init?: CalcBaslangic): InputState {
  return init?.state ? { ...defaultState(def), ...init.state } : defaultState(def);
}

export function useCalcState(def: CalcDefinition, init?: CalcBaslangic, tercihler?: CalcTercihleri) {
  const [state, setState] = useState<InputState>(() => initialState(def, init));
  const [outputUnits, setOutputUnits] = useState<Record<string, string>>(() => init?.outputUnits ?? {});
  // Boş ve henüz dokunulmamış zorunlu alanlarda hata metni gösterme (özet panelinde yine listelenir).
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());

  const significant = tercihler?.significant;
  const preferredUnits = tercihler?.preferredUnits;
  const run = useMemo(
    () => safeRun(def, state, { outputUnits, significant, preferredUnits }),
    [def, state, outputUnits, significant, preferredUnits],
  );

  const markTouched = useCallback(
    (key: string) => setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key))),
    [],
  );

  const setNumberValue = useCallback(
    (spec: NumberInputSpec | NumberListInputSpec, value: string) => {
      setState((prev) => ({ ...prev, [spec.key]: { unit: spec.defaultUnit, ...prev[spec.key], value } }));
      markTouched(spec.key);
    },
    [markTouched],
  );

  /** Birim değişince sayı korunur: kullanıcı yazdığı değerin birimini seçer. */
  const setNumberUnit = useCallback((spec: NumberInputSpec | NumberListInputSpec, unit: string) => {
    setState((prev) => ({ ...prev, [spec.key]: { value: prev[spec.key]?.value ?? "", unit } }));
  }, []);

  const setSelectValue = useCallback((spec: SelectInputSpec, value: string) => {
    setState((prev) => ({ ...prev, [spec.key]: { value } }));
  }, []);

  const setOutputUnit = useCallback((key: string, unit: string) => {
    setOutputUnits((prev) => ({ ...prev, [key]: unit }));
  }, []);

  /** Durumu tümüyle değiştirir (ör. bir senaryoyu forma yüklemek) */
  const replace = useCallback(
    (next: CalcBaslangic) => {
      setState(initialState(def, next));
      setOutputUnits(next.outputUnits ?? {});
      setTouched(new Set());
    },
    [def],
  );

  const reset = useCallback(() => replace({}), [replace]);

  return {
    def,
    state,
    outputUnits,
    touched,
    run,
    tercihler,
    setNumberValue,
    setNumberUnit,
    setSelectValue,
    setOutputUnit,
    markTouched,
    replace,
    reset,
  };
}

export type CalcStateApi = ReturnType<typeof useCalcState>;
