/**
 * Op-amp, 555, ayarlı regülatör (4.4, 4.6, 4.7) sınır ve varsayılan değerleri (SI). Faz 4 işçisi B bu dosyanın sahibidir.
 * Her değerin yanına kaynağı (standart adı/madde, üretici veri sayfası ve açılan URL) yazılır; kaynağı açılamayan
 * değer buraya girmez, hesapta kullanıcı girdisi olur.
 *
 * 4.4 op-amp kazancı için config değeri yoktur: GBW, besleme ve ray payı op-amp'a özgüdür, kullanıcı girer.
 */
export const ELEKTRONIK_ENTEGRE_SINIRLARI = {
  /**
   * 4.6 — 555 zamanlayıcı. Kaynak: Texas Instruments, "xx555 Precision Timers" (NA555, NE555, SA555, SE555),
   * SLFS022K (Eylül 1973, revizyon Mart 2026). https://www.ti.com/lit/ds/symlink/ne555.pdf
   * Çapraz kontrol: TI "LM555 Timer", SNAS548D (Ocak 2015). https://www.ti.com/lit/ds/symlink/lm555.pdf
   */
  zamanlayici555: {
    /**
     * Eşik (THRES) seviyesi / V_CC: Tablo 6-1 "> 2/3 × VCC" (nominal); §6.3.2 "≅ 0.67 × VCC".
     * LM555 §6.5: "Threshold Voltage 0.667 x VCC".
     */
    esikOrani: 2 / 3,
    /** Tetikleme (TRIG) seviyesi / V_CC: Tablo 6-1 "< 1/3 × VCC" (nominal); §6.3.2 "≅ 0.33 × VCC". */
    tetikOrani: 1 / 3,
    /** Besleme gerilimi aralığı, V: §5.3 Recommended Operating Conditions, NA555/NE555/SA555 4,5–16 V (SE555 18 V). */
    beslemeMin: 4.5,
    beslemeMax: 16,
    /**
     * Zamanlama dirençlerinin (R_A + R_B) en büyük değeri, Ω: §5.5 "THRES current" dipnotu (1): "when VCC = 5V, the
     * maximum value is R = RA + RB ≅ 3.4MΩ, and for VCC = 15V, the maximum value is RA + RB ≅ 10MΩ".
     * Veri sayfası yalnız bu iki noktayı verir; ara değer üretilmez. Hesap V_CC < 15 V için 5 V değerini (5–15 V arasında
     * tutucu; V_CC < 5 V'ta gerçek sınır daha düşüktür), V_CC ≥ 15 V için 15 V değerini kullanır. (LM555 SNAS548D §6.5 dipnot 5 15 V için 20 MΩ verir; daha tutucu olan
     * NE555 değerleri seçildi.)
     */
    rToplamMax: { vccDusuk: 5, rDusuk: 3.4e6, vccYuksek: 15, rYuksek: 10e6 },
    /** Monostable en kısa darbe, s: §6.3.1 "limits the minimum monostable pulse width to 10µs". */
    monostableMinDarbe: 10e-6,
    /** Astable önerilen en yüksek frekans, Hz: §6.3.2 "To reduce distortion, use at maximum frequency of 100kHz or below". */
    astableMaxFrekans: 100e3,
  },
  /**
   * 4.7 — LM317 ayarlı regülatör. Kaynak: Texas Instruments, "LM317 3-Pin Adjustable Regulator", SLVS044Z
   * (Eylül 1997, revizyon Nisan 2025). https://www.ti.com/lit/ds/symlink/lm317.pdf
   */
  lm317: {
    /** Referans gerilimi, V: §6.6 Electrical Characteristics, T_J = 25 °C tipik 1,25 V (tüm koşullarda 1,2–1,3 V). */
    vRef: 1.25,
    vRefMin: 1.2,
    vRefMax: 1.3,
    /** ADJUST ucu akımı, A: §6.6 "Adjustment pin current" tipik 50 µA, en çok 100 µA; §8.2.2 "IADJ is typically 50µA". */
    iAdj: 50e-6,
    iAdjMax: 100e-6,
    /** Minimum yük akımı, A: §6.6 "(VIN − VOUT) = 40V" tipik 3,5 mA, en çok 10 mA; §7.4.3 yük veya geri besleme bunu çekmeli. */
    minYukAkimiTip: 3.5e-3,
    minYukAkimiMax: 10e-3,
    /**
     * Giriş–çıkış farkı, V: §6.3 Recommended Operating Conditions "VI – VO" 3–40 V. Alt sınır bir dropout özelliği değil,
     * önerilen paydır: §7.3.1 "A 3V headroom is recommended", §7.4.2 "requires up to 3V headroom". 40 V aynı zamanda
     * §6.1 Absolute Maximum Ratings'teki giriş–çıkış farkı sınırıdır.
     */
    girisCikisFarkiMin: 3,
    girisCikisFarkiMax: 40,
    /** Çıkış gerilimi aralığı, V: §6.3 "VO Output voltage" 1,25–37 V. */
    cikisGerilimiMin: 1.25,
    cikisGerilimiMax: 37,
    /** Çıkış akımı, A: §6.3 "IO Output current" en çok 1,5 A. */
    cikisAkimiMax: 1.5,
    /**
     * Jonksiyon sıcaklığı üst sınırı, K: §6.3 "TJ Operating virtual junction temperature" 0–125 °C; §8.5.1.1.1 "125°C for
     * the LM317 (new chip)". 125 °C = 398,15 K. (Eski yonga için §6.1 mutlak sınır 150 °C.)
     */
    tjMax: 398.15,
  },
} as const;
