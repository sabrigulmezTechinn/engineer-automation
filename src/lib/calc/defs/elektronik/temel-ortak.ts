/**
 * Temel elektronik hesaplarının (4.1 LED ön direnci, 4.2 RC/RL zaman sabiti, 4.3 filtre kesim frekansı,
 * 4.12 batarya ömrü) ortak yardımcıları ve kaynak referansları. Yalnızca bu hesaplar kullanır.
 */
import { formatQuantity, fromSI } from "@/lib/units";
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexSpec } from "@/lib/calc/latex";
import type { ComputeInputs, InputSpec, NumberInputSpec, OutputSpec, Reference } from "@/lib/calc/types";
import type { ESeriesId } from "../yardimci/e-serileri";

/** Zorunlu sayı girdisi; yoksa programlama hatasıdır (motor doğrulamadan geçmiş girdi verir). */
export function num(inputs: ComputeInputs, key: string, where: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`${where}: "${key}" sayı değil`);
  return v;
}

/** İsteğe bağlı (boş bırakılabilen veya gizli) sayı girdisi */
export function opt(inputs: ComputeInputs, key: string): number | undefined {
  const v = inputs[key];
  return typeof v === "number" ? v : undefined;
}

type NumericSpec = NumberInputSpec | OutputSpec;

function specOf(specs: readonly (InputSpec | OutputSpec)[], key: string): NumericSpec {
  const s = specs.find((x) => x.key === key);
  if (!s || ("kind" in s && s.kind !== "number")) throw new Error(`temel-ortak: "${key}" sayısal tanımı yok`);
  return s as NumericSpec;
}

/**
 * Bir tanım listesine bağlı LaTeX yazıcı: kartla aynı birim (otomatik birimli boyutlarda otomatik önek,
 * `units` ile sınırlı) ve çıktıda tanımlı hassasiyet (significant/integer).
 */
export function specWriter(specs: readonly (InputSpec | OutputSpec)[]) {
  return (key: string, valueSI: number) => {
    const s = specOf(specs, key);
    const precision =
      !("kind" in s) && s.integer
        ? { decimals: 0 }
        : !("kind" in s) && s.significant !== undefined
          ? { significant: s.significant }
          : undefined;
    return latexSpec(s, valueSI, precision);
  };
}

/** Kontrol mesajlarında (düz metin) bir değeri kartla aynı birim ve biçimle yazar. */
export function specText(specs: readonly (InputSpec | OutputSpec)[], key: string, valueSI: number): string {
  const s = specOf(specs, key);
  const unit = autoOutputUnit(s, valueSI);
  return formatQuantity(fromSI(valueSI, unit), unit);
}

/** Direnç seçiminde sunulan E serileri (E192 bilerek yok: ±%0,1–0,5 direnç bu devrelerde gereksiz). */
export const E_SERI_IDLERI: readonly ESeriesId[] = ["E6", "E12", "E24", "E48", "E96"];

/** Tolerans etiketleri Vishay 31001 eşlemesinden (yalnızca belgede geçenler; bkz. REF.eSerileri). */
export const E_SERI_SECENEKLERI = [
  { value: "E6", label: "E6" },
  { value: "E12", label: "E12 (±%10)" },
  { value: "E24", label: "E24 (±%5, ±%2)" },
  { value: "E48", label: "E48" },
  { value: "E96", label: "E96 (±%1)" },
] satisfies { value: ESeriesId; label: string }[];

/** Select değerini E serisi kimliğine çevirir; listede yoksa programlama hatasıdır. */
export function eSeri(inputs: ComputeInputs, key: string, where: string): ESeriesId {
  const v = inputs[key];
  const id = E_SERI_IDLERI.find((s) => s === v);
  if (!id) throw new Error(`${where}: bilinmeyen E serisi "${String(v)}"`);
  return id;
}

/**
 * Referanslar (yalnızca açılıp okunanlar). Açılan belgeler:
 * - broadcomAn1005: https://docs.broadcom.com/doc/AV02-0871EN
 * - nasaDerating:   https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1201.pdf
 * - eSerileri:      https://www.vishay.com/docs/28372/e-series.pdf (bkz. yardimci/e-serileri.ts)
 * - openstaxRC:     https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits
 * - openstaxRL:     https://openstax.org/books/university-physics-volume-2/pages/14-4-rl-circuits
 * - openstaxRezonans: https://openstax.org/books/university-physics-volume-2/pages/15-5-resonance-in-an-ac-circuit
 * - microchipAn699: https://ww1.microchip.com/downloads/en/AppNotes/00699b.pdf
 * - tiAn092:        https://www.ti.com/lit/an/swra347a/swra347a.pdf
 * - victronPeukert, victronTaban:
 *     https://www.victronenergy.com/media/pg/BMV-700/en/battery-capacity-and-peukert-exponent.html
 *     https://www.victronenergy.com/media/pg/BMV-700/en/all-features-and-settings.html
 */
export const REF = {
  broadcomAn1005: {
    standard: "Broadcom Application Note 1005 (AV02-0871EN)",
    title: "Operational Considerations for LED Lamps and Display Devices",
    clause: "Current Limiting, denklem (4); DC Design Example, Step 5",
    note: "R = (V_CC − V_SAT − V_F)/I_PEAK (denklem belgede görsel olarak verilir; değişken listesinden ve çözümlü örnekten: 5 V, V_SAT 0,1 V, V_F 1,95 V, 42 mA → 70 Ω). Direnç anma gücü harcanan gücün 2 katı olmalıdır.",
  },
  nasaDerating: {
    standard: "NASA GSFC PD-ED-1201",
    title: "EEE Parts Derating",
    clause: "Tablo 1",
    note: "Dirençte en çok anma gücünün %60'ı (güç emniyet katsayısı ≈ 1,67); NASA uzay uçuşu programları için karşılaştırma değeri.",
  },
  eSerileri: {
    standard: "IEC 60063",
    title: "Preferred number series for resistors and capacitors",
    note: "Seri değerleri Vishay belge no. 28372'den (bkz. 7.2 Standart değer serileri). Tolerans–seri ilişkisi Vishay 31001: ±%10 → E12, ±%2/±%5 → E24, ±%1 → E96.",
  },
  openstaxRC: {
    standard: "OpenStax University Physics Volume 2",
    title: "RC Circuits",
    clause: "§10.5",
    note: "V_C(t) = ε(1 − e^(−t/τ)), τ = RC; t = τ'da yük en büyük değerin 1 − e⁻¹ = 0,632 katı; deşarjda q(t) = Q·e^(−t/τ).",
  },
  openstaxRL: {
    standard: "OpenStax University Physics Volume 2",
    title: "RL Circuits",
    clause: "§14.4, denklem 14.24 ve 14.25",
    note: "I(t) = (ε/R)(1 − e^(−t/τ_L)), τ_L = L/R; kaynak ayrılınca I(t) = (ε/R)·e^(−t/τ_L).",
  },
  openstaxRezonans: {
    standard: "OpenStax University Physics Volume 2",
    title: "Resonance in an AC Circuit",
    clause: "§15.5, denklem 15.17",
    note: "ω₀ = 1/√(LC), f₀ = ω₀/(2π).",
  },
  microchipAn699: {
    standard: "Microchip AN699 (DS00699B)",
    title: "Anti-Aliasing, Analog Filters for Data Acquisition Systems",
    clause: "Passive Filters, Figure 8",
    note: "Pasif RC alçak geçiren: V_OUT/V_IN = 1/(1 + sRC), f_c = 1/(2πRC), 20 dB/dekat. Örnek: 1 kHz ve 0,1 µF için 1,59 kΩ.",
  },
  tiAn092: {
    standard: "Texas Instruments SWRA347a (Application Note AN092)",
    title: "Measuring Bluetooth Low Energy Power Consumption",
    clause: "§5.5 Formulas and Calculations",
    note: "I_ort = [(T − t_aktif)·I_uyku + t_aktif·I_aktif]/T; ömür = kapasite/I_ort (230 mAh / 0,024 mA = 9583 h).",
  },
  victronPeukert: {
    standard: "Victron Energy BMV-700 kılavuzu",
    title: "Battery capacity and Peukert exponent",
    clause: "§8; §7.2.6 Peukert exponent",
    note: "C_p = Iⁿ·t; ideal batarya n = 1,00; kurşun-asit için kabul edilebilir ortalama 1,25. Peukert üssü gerçeğin kaba bir yaklaşımıdır; çok yüksek akımlarda batarya tahminden de az kapasite verir.",
  },
  victronTaban: {
    standard: "Victron Energy BMV-700 kılavuzu",
    title: "Discharge floor",
    clause: "§7.2.3",
    note: "Kurşun-asit akülerde deşarj tabanı %50 önerilir (kullanılabilir kapasite oranı %50); lityumda daha düşük.",
  },
} satisfies Record<string, Reference>;
