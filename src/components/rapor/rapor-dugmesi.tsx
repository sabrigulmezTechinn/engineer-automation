"use client";

/**
 * Hesap sayfasında "PDF rapor" düğmesi. Kayıtlıysa /api/rapor/hesap/[id], değilse mevcut durumla POST /api/rapor/hesap.
 * Sözleşme stub'ı: Faz 2 işçisi C bu dosyanın sahibidir.
 */
import type { CalcStateApi } from "@/components/calc/use-calc-state";
import type { KayitliHesap } from "@/lib/kayit/types";

export function RaporDugmesi({ calc, kayit }: { calc: CalcStateApi; kayit?: KayitliHesap | null }) {
  void calc;
  void kayit;
  return null;
}
