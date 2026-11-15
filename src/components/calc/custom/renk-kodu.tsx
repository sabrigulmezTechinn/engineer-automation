"use client";

/*
 * 4.5 Direnç renk kodu / SMD / kondansatör kodları arayüzü (CalcDefinition.customUi = "renk-kodu").
 * Faz 4 ortak zemini: şimdilik genel formu gösterir. Sahibi Faz 4 işçisi C'dir; bant renklerini gösteren
 * direnç çizimi gibi görsel öğeler burada eklenir. Kural: durum InputState'tir ve sonuç runCalc'tan gelir
 * (calc.run); bu bileşen yalnızca gösterimdir, böylece kaydetme, karşılaştırma ve PDF genel yoldan çalışır.
 */
import type { CalcStateApi } from "../use-calc-state";
import { CalcFormView } from "../calc-form";

export function RenkKodu({ calc }: { calc: CalcStateApi }) {
  return <CalcFormView calc={calc} />;
}
