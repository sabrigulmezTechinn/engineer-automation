/**
 * 6.6–6.9 (pnömatik, hidrolik, vakum, rulman) hesaplarının ortak yardımcıları (yalnızca bu hesaplar kullanır).
 */
import type { ComputeInputs } from "@/lib/calc/types";

/** Mekatronik kategorisinde tek kopya: tahrik-ortak.ts */
export { G_N, num } from "./tahrik-ortak";

/** İsteğe bağlı veya gizli olabilen sayı girdisi; yoksa undefined. */
export function optNum(inputs: ComputeInputs, key: string): number | undefined {
  const v = inputs[key];
  return typeof v === "number" ? v : undefined;
}

/** Çapı D olan dairenin alanı: π·D²/4 */
export function daireAlani(D: number): number {
  return (Math.PI * D * D) / 4;
}
