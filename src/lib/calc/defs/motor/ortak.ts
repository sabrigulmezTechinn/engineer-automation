/**
 * Motor ve sürücü hesaplarının ortak yardımcıları (yalnızca bu klasör kullanır).
 */
import { latexNum, latexQty } from "@/lib/calc/latex";
import type { ComputeInputs } from "@/lib/calc/types";

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

/** Devir hızı adımlarda dev/dk ile yazılır (kartlarla aynı); latexAuto mekanik boyutta rad/s'ye düşerdi. */
export const qRpm = (omegaSI: number) => latexQty(omegaSI, "rpm");
/** Açısal hız rad/s ile */
export const qOmega = (omegaSI: number) => latexQty(omegaSI, "rad_s");
/** Oran (verim, cosφ) adımlarda kesir olarak yazılır: 0,9 */
export const qFrac = (x: number) => latexNum(x);
