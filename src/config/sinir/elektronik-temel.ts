/**
 * LED, RC/RL, filtre, batarya (4.1, 4.2, 4.3, 4.12) sınır ve varsayılan değerleri (SI). Faz 4 işçisi A bu dosyanın sahibidir.
 * Her değerin yanına kaynağı (standart adı/madde, üretici veri sayfası ve açılan URL) yazılır; kaynağı açılamayan
 * değer buraya girmez, hesapta kullanıcı girdisi olur.
 */
export const ELEKTRONIK_TEMEL_SINIRLARI = {
  /**
   * 4.1 LED ön direnci: direnç anma gücü / dirençte harcanan güç (emniyet katsayısı, boyutsuz).
   * Broadcom (Avago) Application Note 1005 "Operational Considerations for LED Lamps and Display Devices",
   * belge AV02-0871EN, DC Design Example, Step 5: "Resistor power rating should be 2x the actual power dissipation".
   * https://docs.broadcom.com/doc/AV02-0871EN
   * (Karşılaştırma: NASA GSFC PD-ED-1201 Tablo 1, dirençte en çok anma gücünün %60'ı ≈ 1,67 katsayı;
   * https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1201.pdf)
   */
  ledDirencGucKatsayisi: 2,
  /**
   * 4.12 Batarya ömrü: Peukert üssünün kurşun-asit akü için ortalama değeri (boyutsuz).
   * Victron Energy BMV-700 kılavuzu, §8 "Battery capacity and Peukert exponent" ve §7.2.6 (ayar 05, varsayılan 1,25):
   * "The default setting in the battery monitor for the Peukert exponent is 1.25. This is an acceptable average value
   * for most lead acid batteries." İdeal batarya 1,00'dır.
   * https://www.victronenergy.com/media/pg/BMV-700/en/battery-capacity-and-peukert-exponent.html
   * https://www.victronenergy.com/media/pg/BMV-700/en/all-features-and-settings.html
   */
  peukertUssuKursunAsit: 1.25,
  /**
   * 4.12 Batarya ömrü: Peukert anma deşarj süresi H, s (C20 → 20 h). Victron BMV-700 kılavuzu §8: anma kapasitesi
   * "usually the 20h discharge rate"; örnek "C20 = 100Ah (5 x 20 = 100)". URL yukarıda.
   */
  peukertAnmaSuresi: 20 * 3600,
} as const;
