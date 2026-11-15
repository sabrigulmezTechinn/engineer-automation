/**
 * 6.6–6.9 (pnömatik, hidrolik, vakum, rulman) hesaplarının ortak yardımcıları (yalnızca bu hesaplar kullanır).
 */
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

/** Çapı D olan dairenin alanı: π·D²/4 */
export function daireAlani(D: number): number {
  return (Math.PI * D * D) / 4;
}

/** Standart yerçekimi ivmesi g_n, m/s² (tanım gereği tam; birim kataloğundaki "gn" ile aynı) */
export const G_N = 9.80665;
