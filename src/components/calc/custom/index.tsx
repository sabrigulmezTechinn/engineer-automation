"use client";

/**
 * Genel form yerine özel arayüzle gösterilen hesaplar (CalcDefinition.customUi).
 * Özel arayüzler de durumunu InputState olarak tutar ve sonucu runCalc ile alır; böylece
 * kaydetme, karşılaştırma ve PDF (Faz 2) genel hesaplarla aynı yoldan çalışır.
 */
import type { CustomUiId } from "@/lib/calc/types";
import type { CalcStateApi } from "../use-calc-state";
import { BirimDonusturucu } from "./birim-donusturucu";
import { RenkKodu } from "./renk-kodu";

export function CustomCalc({ id, calc }: { id: CustomUiId; calc: CalcStateApi }) {
  switch (id) {
    case "birim-donusturucu":
      return <BirimDonusturucu calc={calc} />;
    case "renk-kodu":
      return <RenkKodu calc={calc} />;
  }
}
