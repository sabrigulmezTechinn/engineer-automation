/**
 * Otomasyon ve PLC sınır değerleri. Tüm değerler SI'dır (akım: A).
 */
export const OTOMASYON_SINIRLARI = {
  /** NAMUR NE 43: 4-20 mA sinyalinde ölçüm aralığı ve arıza bölgeleri */
  namurNe43: {
    /** Geçerli ölçüm alt sınırı (3,8 mA) */
    olcumAlt: 3.8e-3,
    /** Geçerli ölçüm üst sınırı (20,5 mA) */
    olcumUst: 20.5e-3,
    /** Bu değer ve altı arıza sinyali (≤ 3,6 mA) */
    arizaAlt: 3.6e-3,
    /** Bu değer ve üstü arıza sinyali (≥ 21 mA) */
    arizaUst: 21.0e-3,
  },
  /**
   * 4-20 mA döngü yük direnci hesabında (5.6) varsayılan en büyük döngü akımı: 22 mA.
   * NE 43 arıza eşiği 21 mA'dır, ancak vericiler üst alarmda 21–23 mA sürebilir; bu yüzden
   * tasarımda tipik olarak 22 mA alınır. Hesapta girdi olarak gösterilir, kullanıcı verici
   * veri sayfasına göre değiştirebilir.
   */
  donguTasarimAkimi: 22e-3,
} as const;
