/**
 * IEC 60063 E serileri (bir dekat).
 *
 * KAYNAK — değerler elle yazılmadı; aşağıdaki belgeden betikle çıkarıldı:
 *   Vishay, "Standard Series Values in a Decade for Resistances and Capacitances, E3 to E192,
 *   according to IEC 60063", belge no. 28372, rev. 22-Aug-12.
 *   https://www.vishay.com/docs/28372/e-series.pdf
 * Çapraz kontrol (birebir aynı): Vishay Dale "Standard Electronic Decade Value Tables",
 *   belge no. 31001 (E12, E24, E96, E192), https://www.vishay.com/docs/31001/dectable.pdf ve
 *   Wikipedia "E series of preferred numbers" listeleri (IEC 60063:2015'e dayanır).
 * IEC 60063:2015'in tabloları ücretlidir (Tablo 1: iki anlamlı basamaklı seriler, Tablo 2: üç anlamlı
 * basamaklı seriler); burada standart metni değil, üretici belgesindeki sayılar kullanılmıştır.
 *
 * Gösterim: E6–E24 iki anlamlı basamak (10 → 1,0), E48–E192 üç anlamlı basamak (100 → 1,00) olarak
 * tam sayı tutulur; böylece 4,7 × 10³ gibi değerler kayan nokta artığı olmadan üretilir.
 * E6–E24 10^(i/n) yuvarlaması DEĞİLDİR (ör. 2,7 / 3,3 / 4,7 / 8,2); E192'de 9,20 (hesapla 9,19) resmi değerdir.
 */

export type ESeriesId = "E6" | "E12" | "E24" | "E48" | "E96" | "E192";

/** Seri adı → bir dekattaki tam sayı mantisler (E6–E24: ×10, E48–E192: ×100). */
export const E_SERIES: Readonly<Record<ESeriesId, readonly number[]>> = {
  E6: [
    10, 15, 22, 33, 47, 68,
  ],
  E12: [
    10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82,
  ],
  E24: [
    10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30,
    33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91,
  ],
  E48: [
    100, 105, 110, 115, 121, 127, 133, 140, 147, 154, 162, 169, 178, 187, 196, 205,
    215, 226, 237, 249, 261, 274, 287, 301, 316, 332, 348, 365, 383, 402, 422, 442,
    464, 487, 511, 536, 562, 590, 619, 649, 681, 715, 750, 787, 825, 866, 909, 953,
  ],
  E96: [
    100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143,
    147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210,
    215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309,
    316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453,
    464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665,
    681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976,
  ],
  E192: [
    100, 101, 102, 104, 105, 106, 107, 109, 110, 111, 113, 114, 115, 117, 118, 120,
    121, 123, 124, 126, 127, 129, 130, 132, 133, 135, 137, 138, 140, 142, 143, 145,
    147, 149, 150, 152, 154, 156, 158, 160, 162, 164, 165, 167, 169, 172, 174, 176,
    178, 180, 182, 184, 187, 189, 191, 193, 196, 198, 200, 203, 205, 208, 210, 213,
    215, 218, 221, 223, 226, 229, 232, 234, 237, 240, 243, 246, 249, 252, 255, 258,
    261, 264, 267, 271, 274, 277, 280, 284, 287, 291, 294, 298, 301, 305, 309, 312,
    316, 320, 324, 328, 332, 336, 340, 344, 348, 352, 357, 361, 365, 370, 374, 379,
    383, 388, 392, 397, 402, 407, 412, 417, 422, 427, 432, 437, 442, 448, 453, 459,
    464, 470, 475, 481, 487, 493, 499, 505, 511, 517, 523, 530, 536, 542, 549, 556,
    562, 569, 576, 583, 590, 597, 604, 612, 619, 626, 634, 642, 649, 657, 665, 673,
    681, 690, 698, 706, 715, 723, 732, 741, 750, 759, 768, 777, 787, 796, 806, 816,
    825, 835, 845, 856, 866, 876, 887, 898, 909, 920, 931, 942, 953, 965, 976, 988,
  ],
};

/** Mantis tam sayısının basamak ölçeği: E6–E24 → 10 (2 anlamlı basamak), E48–E192 → 100 (3 anlamlı basamak). */
export function seriesScale(id: ESeriesId): 10 | 100 {
  return id === "E6" || id === "E12" || id === "E24" ? 10 : 100;
}
