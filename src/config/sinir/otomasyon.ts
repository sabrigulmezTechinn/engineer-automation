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
  /**
   * IEC 61131-2: 24 V DC besleme geriliminin anma değeri ve çalışma aralığı (−%15 / +%20 → 20,4–28,8 V).
   * Standardın metnine erişilemedi; değerler standarda atıf yapan üretici belgelerinden doğrulandı:
   * - ABB AC500 "Environmental conditions": 24 V DC, 24 V (−15 %, +20 %), kesintiler EN 61131-2'ye göre
   *   https://help.plc.abb.com/environmental_conditions_ac500.html
   * - Eaton MN01219002Z-EN (NZM2), 24 V DC besleme: +20 %/−15 %, izin verilen aralık 20,4–28,8 V DC, IEC/EN 61131-2
   *   https://www.manualslib.com/manual/1955514/Eaton-Nzm2.html?page=76
   * - Parker PAC340: +24 V DC SELV (−15 % / +20 %), gerilim 20,4 V'un altına düşmemeli, "type K to DIN EN 61131-2"
   *   https://www.manualslib.com/manual/2607176/Parker-Pac340.html?page=20
   * Değerler V cinsindendir.
   */
  besleme24V: {
    /** Anma gerilimi */
    anma: 24,
    /** Çalışma aralığı alt sınırı (24 V − %15) */
    min: 20.4,
    /** Çalışma aralığı üst sınırı (24 V + %20) */
    max: 28.8,
  },
} as const;
