/**
 * Tesisat 2.4–2.8 (kompanzasyon, kısa devre, trafo, topraklama, pano ısı) hesaplarının ortak yardımcıları.
 * Yalnızca bu hesaplar kullanır (2.1–2.3 kendi yardımcılarını kullanır).
 */
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexNum } from "@/lib/calc/latex";
import type { ComputeInputs, OutputSpec } from "@/lib/calc/types";
import { formatQuantity, fromSI } from "@/lib/units";

/** Zorunlu sayı girdisi; yoksa programlama hatasıdır (motor doğrulamadan geçmiş girdi verir). */
export function num(inputs: ComputeInputs, key: string, where: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`${where}: "${key}" sayı değil`);
  return v;
}

/** İsteğe bağlı veya gizli olabilen sayı girdisi; yoksa undefined. */
export function optNum(inputs: ComputeInputs, key: string): number | undefined {
  const v = inputs[key];
  return typeof v === "number" ? v : undefined;
}

/** Zorunlu liste girdisi (SI değerler). */
export function numList(inputs: ComputeInputs, key: string, where: string): number[] {
  const v = inputs[key];
  if (!Array.isArray(v)) throw new Error(`${where}: "${key}" liste değil`);
  return v;
}

/** Tanımın çıktı listesinden anahtarla spec bulur (adımlarda latexSpec için). */
export function specOf(outputs: OutputSpec[], key: string): OutputSpec {
  const s = outputs.find((o) => o.key === key);
  if (!s) throw new Error(`çıktı tanımı yok: ${key}`);
  return s;
}

/** Kontrol mesajları düz metindir: değeri kartlarla aynı kural ve birimle yazar (ör. "14,12 kA"). */
export function qText(spec: Pick<OutputSpec, "dimension" | "defaultUnit" | "units" | "autoUnit">, valueSI: number): string {
  const unit = autoOutputUnit(spec, valueSI);
  return formatQuantity(fromSI(valueSI, unit), unit);
}

/** Boyutsuz katsayılar (cos φ, c, κ) adımlarda düz sayı olarak yazılır. */
export const qNum = (x: number) => latexNum(x);

/** -0 → 0 (gösterimde "−0" çıkmasın). */
export const n0 = (x: number) => (x === 0 ? 0 : x);
