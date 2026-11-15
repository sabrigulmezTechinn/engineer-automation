/**
 * Renk/SMD/kondansatör kodları ve PCB yol genişliği (4.5, 4.10) sınır ve varsayılan değerleri (SI). Faz 4 işçisi C bu dosyanın sahibidir.
 * Her değerin yanına kaynağı (standart adı/madde, üretici veri sayfası ve açılan URL) yazılır; kaynağı açılamayan
 * değer buraya girmez, hesapta kullanıcı girdisi olur.
 *
 * 4.5'in kod tabloları (renk bantları, EIA-96 harfleri, kondansatör tolerans harfleri) sınır değil sabit veri olduğu
 * için burada değil, kaynaklarıyla birlikte src/lib/calc/defs/elektronik/kod-ortak.ts'tedir.
 */

/** 1 mil (thou) = 0,001 inç = 25,4 µm (tanım gereği tam), m */
const MIL = 25.4e-6;

export const ELEKTRONIK_KOD_PCB_SINIRLARI = {
  /** 4.10 PCB yol genişliği */
  pcb: {
    /**
     * IPC-2221 eğrilerine uydurulmuş genel formül I = k·ΔT^b·A^c (I: A, ΔT: °C, A: mil²).
     * "k, b, and c are constants resulting from curve fitting to the IPC-2221 curves":
     * iç katman k = 0,024, dış katman k = 0,048; b = 0,44, c = 0,725.
     * Kaynak: AdvancedPCB (eski Advanced Circuits, 4pcb.com) Trace Width Calculator, "Notes" bölümü:
     *   https://www.advancedpcb.com/en-us/tools/trace-width-calculator/
     * Aynı sabitler ve formül: NextPCB, "PCB Trace Width Calculator: IPC-2221 Guide" (Temmuz 2026):
     *   https://www.nextpcb.com/blog/pcb-trace-width-calculator-ipc-2221-guide
     */
    ipc2221: { kDis: 0.048, kIc: 0.024, b: 0.44, c: 0.725 },
    /**
     * Formülün dayandığı IPC-2221 grafiklerinin kapsamı; dışında formül yalnızca dışarı değer verir (ekstrapolasyon).
     * AdvancedPCB SSS: "The original graphs ... (published in IPC-2221) only cover up to 35 Amps, up to 0.4 inches of
     * trace width, from 10 to 100 degrees C of temperature rise, and copper of 0.5 to 3 ounces per square foot."
     * (yukarıdaki AdvancedPCB URL'si). Birimler: A, m, K, oz/ft².
     */
    gecerlilik: {
      maksAkim: 35,
      maksGenislik: 0.4 * 0.0254,
      minSicaklikArtisi: 10,
      maksSicaklikArtisi: 100,
      minBakirOz: 0.5,
      maksBakirOz: 3,
    },
    /**
     * 1 oz/ft² bakırın kalınlığı, m: "Width[mils] = Area[mils^2]/(Thickness[oz]*1.378[mils/oz])" → 1,378 mil = 35,0 µm.
     * Kaynak: AdvancedPCB Trace Width Calculator, "Notes" (yukarıdaki URL). 0,5/2/3 oz bunun katlarıdır.
     */
    ozKalinligi: 1.378 * MIL,
    /**
     * Tavlanmış bakırın 20 °C özdirenci (Uluslararası Tavlanmış Bakır Standardı, IACS): 1,7241 µΩ·cm = 1,7241·10⁻⁸ Ω·m
     * ve 20 °C sıcaklık katsayısı α₂₀ = 0,00393 1/K.
     * Kaynak: NBS Handbook 100 "Copper Wire Tables" (1966), §1.a ve §1.b, s. 2–3:
     *   https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook100.pdf
     * Not: değerler tavlanmış bakır tel içindir; PCB bakır folyosunun üretici değeri farklı olabilir.
     */
    bakirOzdirenci20: 1.7241e-8,
    bakirSicaklikKatsayisi20: 0.00393,
  },
} as const;
