"use client";

/**
 * Hesap sayfasında kaydetme araçları (Kaydet / Farklı kaydet / proje seçimi / kayıtlı hesap bilgisi).
 * Sözleşme stub'ı: Faz 2 işçisi A bu dosyanın sahibidir. Oturum yoksa "Kaydetmek için giriş yapın" bağlantısı.
 */
import type { CalcStateApi } from "@/components/calc/use-calc-state";
import type { KayitliHesap } from "@/lib/kayit/types";

export function KayitAraclari({ calc, kayit, girisYapildi }: { calc: CalcStateApi; kayit?: KayitliHesap | null; girisYapildi: boolean }) {
  void calc;
  void kayit;
  void girisYapildi;
  return null;
}
