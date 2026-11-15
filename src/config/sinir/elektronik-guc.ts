/**
 * Transistör/MOSFET, buck/boost, soğutucu (4.8, 4.9, 4.11) sınır ve varsayılan değerleri (SI). Faz 4 işçisi D bu dosyanın sahibidir.
 * Her değerin yanına kaynağı (standart adı/madde, üretici veri sayfası ve açılan URL) yazılır; kaynağı açılamayan
 * değer buraya girmez, hesapta kullanıcı girdisi olur.
 */
export const ELEKTRONIK_GUC_SINIRLARI = {
  /**
   * 4.9: bobin dalgalanma akımı için önerilen aralık, bobin (ortalama) akımının kesri olarak: %20–%40.
   * - Buck: TI SLVA477C "Basic Calculation of a Buck Converter's Power Stage", Denk. (6) ΔI_L = (0,2…0,4)·I_OUT(max)
   *   https://www.ti.com/lit/an/slva477c/slva477c.pdf
   * - Boost: TI SLVA372D "Basic Calculation of a Boost Converter's Power Stage", Denk. (6)
   *   ΔI_L = (0,2…0,4)·I_OUT(max)·V_OUT/V_IN  https://www.ti.com/lit/an/slva372d/slva372d.pdf
   * Uygulama notları bunu "iyi bir tahmin" olarak verir; aralık dışı değer hata değil, uyarıdır.
   */
  dalgalanmaOrani: {
    min: 0.2,
    max: 0.4,
  },
} as const;
