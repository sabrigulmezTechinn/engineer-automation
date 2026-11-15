/**
 * Dişli/kayış, vidalı mil, step, servo, kremayer/konveyör (6.1–6.5) sınır ve varsayılan değerleri (SI). Faz 3 işçisi C bu dosyanın sahibidir.
 * Her değerin yanına kaynağı (yönetmelik/standart adı, madde, açılan URL) yazılır; kaynağı açılamayan değer
 * buraya girmez, hesapta kullanıcı girdisi olur.
 */
export const MEKATRONIK_TAHRIK_SINIRLARI = {
  /**
   * 6.2 Vidalı mil: THK bilyalı vida seçim kriterleri (üretici kataloğu, kamuya açık).
   * - Kritik devir, denklem (7): N₁ = 60·λ₁²/(2π·ℓb²) · √(E·10³·I/(γ·A)) · 0,8
   *   https://www.thk.com/eu/en/products/ball_screw/selection/0007/
   * - Burkulma yükü, denklem (5): P₁ = η₁·π²·E·I/ℓa² · 0,5 (THK'deki η₁ yataklama katsayısıdır; verimle
   *   karışmasın diye hesapta n_b ile gösterilir)
   *   İzin verilen çekme/basma yükü, denklem (6): P₂ = σ·(π/4)·d₁²
   *   https://www.thk.com/eu/en/products/ball_screw/selection/0006/
   * Katalog değerleri mm–N–kg biriminde verilir; burada SI'ya çevrilmiştir (E: 2,06×10⁵ N/mm² = 2,06×10¹¹ Pa,
   * γ: 7,85×10⁻⁶ kg/mm³ = 7850 kg/m³, σ: 147 MPa). I = π·d₁⁴/64, A = π·d₁²/4, d₁: diş dibi (minör) çapı.
   */
  vidaliMil: {
    /** Mil malzemesinin elastisite modülü (Young modülü), Pa */
    elastisiteModulu: 2.06e11,
    /** Mil malzemesinin yoğunluğu, kg/m³ */
    yogunluk: 7850,
    /** İzin verilen çekme/basma gerilmesi, Pa (denklem 6) */
    izinGerilme: 147e6,
    /** Kritik devir sonucuna uygulanan emniyet katsayısı (denklem 7) */
    kritikDevirEmniyet: 0.8,
    /** Burkulma yükü sonucuna uygulanan emniyet katsayısı (denklem 5) */
    burkulmaEmniyet: 0.5,
    /** Kritik devir için yataklama katsayısı λ₁ (denklem 7 tablosu) */
    kritikYataklama: {
      "sabit-serbest": 1.875,
      "destekli-destekli": 3.142,
      "sabit-destekli": 3.927,
      "sabit-sabit": 4.73,
    },
    /** Burkulma için yataklama katsayısı n_b (THK'de η₁; denklem 5 tablosu; THK destekli–destekli değeri vermez) */
    burkulmaYataklama: {
      "sabit-serbest": 0.25,
      "sabit-destekli": 2,
      "sabit-sabit": 4,
    },
  },
  /**
   * 6.3 Step motor: hesaplanan torkun emniyet için iki katı alınması önerisi.
   * THK, "Studying the Driving Motor — When Using a Stepping Motor": "Although the torque varies depending on
   * the motors, normally the calculated torque should be doubled to ensure safety."
   * https://www.thk.com/eu/en/products/ball_screw/selection/0014/
   * Hesapta girdi olarak gösterilir; kullanıcı motorun hız–tork eğrisine göre değiştirebilir.
   */
  stepEmniyetKatsayisi: 2,
  /**
   * 6.4 Servo: yük ataletinin (motora yansıyan) motor ataletine oranı için tipik üst sınır.
   * THK, "Studying the Driving Motor — Inertial Moment", denklem (55) J_M = J/C: "It is normally between 3 to 10.
   * However, it varies depending on the motor and the driver. Check the specific value in the catalog by the motor
   * manufacturer." https://www.thk.com/eu/en/products/ball_screw/selection/0014/
   * Değer motor serisine göre değişir (ör. Panasonic MINAS A6 MHMF5AZL1U2M için "30 times or less":
   * https://industry.panasonic.com/global/en/products/motor/fa-motor/ac-servo/number/mhmf5azl1u2m); bu yüzden
   * hesapta girdi olarak gösterilir, varsayılanı THK aralığının üst ucudur.
   */
  servoAtaletOrani: {
    /** THK tipik aralığının alt ucu */
    tipikAlt: 3,
    /** THK tipik aralığının üst ucu; girdinin varsayılanı */
    tipikUst: 10,
  },
} as const;

export type VidaYataklamaKritik = keyof typeof MEKATRONIK_TAHRIK_SINIRLARI.vidaliMil.kritikYataklama;
export type VidaYataklamaBurkulma = keyof typeof MEKATRONIK_TAHRIK_SINIRLARI.vidaliMil.burkulmaYataklama;
