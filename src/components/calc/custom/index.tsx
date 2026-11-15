"use client";

/**
 * Genel form yerine özel arayüzle gösterilen hesaplar (CalcDefinition.customUi).
 * Özel arayüzler de durumunu InputState olarak tutar ve sonucu runCalc ile alır; böylece
 * kaydetme, karşılaştırma ve PDF (Faz 2) genel hesaplarla aynı yoldan çalışır.
 */
import type { CustomUiId } from "@/lib/calc/types";
import { BirimDonusturucu } from "./birim-donusturucu";

export function CustomCalc({ id, slug }: { id: CustomUiId; slug: string }) {
  switch (id) {
    case "birim-donusturucu":
      return <BirimDonusturucu slug={slug} />;
  }
}
