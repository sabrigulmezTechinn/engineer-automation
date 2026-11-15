/**
 * Kablo kesiti, gerilim düşümü, koruma (2.1–2.3) sınır ve varsayılan değerleri (SI). Faz 3 işçisi A bu dosyanın sahibidir.
 * Her değerin yanına kaynağı (yönetmelik/standart adı, madde, açılan URL) yazılır; kaynağı açılamayan değer
 * buraya girmez, hesapta kullanıcı girdisi olur.
 *
 * Birimler: oranlar kesir (0,015 = %1,5), sıcaklıklar K, akımlar A.
 *
 * Kaynağı açılamadığı için buraya GİRMEYENLER (hesapta kullanıcı girdisi):
 * - IEC 60364-5-52 Ek G gerilim düşümü değerleri (standart ve güvenilir ikincil kaynak açılamadı).
 * - gG sigortada I_n < 16 A için geleneksel erime akımı oranı (I_f/I_n): açılan kaynaklar yalnızca I_n ≥ 16 A'yı veriyor.
 */
export const TESISAT_KABLO_SINIRLARI = {
  /** İzin verilen yüzde gerilim düşümü (kesir) */
  gerilimDusumu: {
    /**
     * Elektrik İç Tesisleri Yönetmeliği (RG 04.11.1984/18565) Madde 57 (a.3/i): iç tesis hatlarında sürekli en büyük
     * işletme akımı ile işletme gerilimine göre yüzde gerilim düşümü, yapı bağlantı kutusu ile tüketim araçları arasında
     * aydınlatma ve priz devreleri için %1,5'i, motor devreleri için %3'ü geçmemelidir.
     * (a.3/ii): yapı veya yapı kümesi bir transformatörle besleniyorsa transformatör çıkış uçları ile yapı bağlantı
     * kutusu arasındaki gerilim düşümü %5'i geçmemelidir.
     * Kaynak: bu alt bentleri bugünkü haline getiren değişiklik, "Elektrik İç Tesisleri Yönetmeliği'nin Bazı
     * Maddelerinin Değiştirilmesine Dair Yönetmelik" Madde 20, Resmî Gazete 30.11.1995 sayı 22479, s. 18 (taranmış
     * sayfa görsel olarak okundu): https://www.resmigazete.gov.tr/arsiv/22479.pdf
     * Not: yönetmelik mevzuat.gov.tr'de bulunamadı (site araması betikle yükleniyor, MevzuatNo bulunamadı); 1995
     * sonrası değişiklikler resmî bir birleştirilmiş metinde denetlenemedi.
     */
    eityAydinlatmaPriz: 0.015,
    eityMotor: 0.03,
    eityTrafoBaglantiKutusu: 0.05,
    /**
     * Elektrik Kuvvetli Akım Tesisleri Yönetmeliği Madde 58-a/4 "Gerilim düşümü": alçak gerilim tesislerinde gerilim
     * düşümü %5'i aşmamalıdır; kendi transformatörü bulunan tesislerde transformatörlerin AG çıkışından en kritik
     * tüketiciye kadar toplam gerilim düşümü aydınlatma tesislerinde %6,5, motor yüklerinde %8'i aşmamalıdır.
     * DİKKAT: bu yönetmelik Madde 1'de "Elektrik İç Tesisleri Yönetmeliği kapsamındaki tesisler"i kapsamı dışında bırakır.
     * Kaynak: https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=9949&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5
     */
    ekatyAlcakGerilim: 0.05,
    ekatyKendiTrafosuAydinlatma: 0.065,
    ekatyKendiTrafosuMotor: 0.08,
  },
  /**
   * Yalıtkanın izin verilen en yüksek sürekli işletme (iletken) sıcaklığı, K.
   * - PVC 70 °C: Prysmian YVV-U/YVV-R/NYY 0,6/1 kV "İzin verilen işletme sıcaklığı: 70 ºC"
   *   https://tr.prysmian.com/sites/tr.prysmian.com/files/media/products/YVV-U_YVV-R_NYY.pdf
   * - XLPE 90 °C: Prysmian YXV-U/YXV-R/YE3V/2XY 0,6/1 kV "İzin verilen işletme sıcaklığı: 90 ºC"
   *   https://tr.prysmian.com/sites/tr.prysmian.com/files/media/products/YXV-U_YXV-R_YE3V_2XY.pdf
   * - EPR 90 °C: Prysmian FG7R 0,6/1 kV (HEPR yalıtkanlı) "İzin verilen işletme sıcaklığı: 90 ºC"
   *   https://tr.prysmian.com/sites/tr.prysmian.com/files/media/products/FG7R.pdf
   */
  yalitkanMaksSicaklik: {
    pvc: 343.15,
    xlpe: 363.15,
    epr: 363.15,
  },
  /**
   * Akım taşıma kapasitesi değerlerinin referans ortam sıcaklığı, K: havada 30 °C, toprakta 20 °C.
   * Prysmian kataloglarındaki not: "Akım taşıma kapasiteleri toprak sıcaklığı 20 ºC, hava sıcaklığı 30 ºC, 1 Km/W ve
   * 0,7 yük faktörü için hesaplanmıştır." (yukarıdaki iki Prysmian URL'si, s. 73 ve s. 89)
   */
  referansOrtamSicakligi: {
    hava: 303.15,
    toprak: 293.15,
  },
  /** Aşırı akım koruması (2.1, 2.3) */
  koruma: {
    /**
     * IEC 60364-4-43 aşırı yük koruması koordinasyonu: I_b ≤ I_n ≤ I_z ve I₂ ≤ 1,45·I_z.
     * Standart metni açılamadı; kural Hager kataloğunda aynen verilir ("I2 ≤1.45Iz"), PDF s. 67:
     * https://assets1.sc.hager.com/exports/files/19en_imc_catafr_web_289_chapters_446-561.pdf
     */
    asiriYukKatsayisi: 1.45,
    /**
     * Minyatür devre kesici (IEC 60898-1): geleneksel açmama akımı 1,13·I_n, geleneksel açma akımı I₂ = 1,45·I_n.
     * Hager kataloğu Tablo 2 (PDF s. 93, yukarıdaki URL): "It1 1.13 In, It2 1.45 In" (B, C, D eğrileri).
     * Schneider Electric SSS FA369327 de aynı değerleri verir: https://www.se.com/za/en/faqs/FA369327
     */
    mcbI2Katsayisi: 1.45,
    /**
     * Anlık (manyetik) açma bölgesi, I_n'nin katı olarak (AC 50 Hz): Hager kataloğu Tablo 2 (PDF s. 93):
     * B: Irm1 3 In – Irm2 5 In; C: 5 In – 10 In; D: 10 In – 20 In.
     */
    mcbAnlikAcma: {
      B: { min: 3, max: 5 },
      C: { min: 5, max: 10 },
      D: { min: 10, max: 20 },
    },
    /**
     * MCB anma akımları serisi, A: Lovato 2024 kataloğu bölüm 17 "Miniature and residual circuit breakers",
     * P1MB...P (IEC/EN/BS 60898-1) "Available rated current for types" satırı, PDF s. 21 (katalog s. 17-20):
     * https://datasheet.lovatoelectric.com/DOWNLOAD/Catalogue/CATALOGO%20INGLESE%202024/17%20-%20Miniature%20and%20residual%20circuit%20breakers.pdf
     */
    mcbAnmaAkimlari: [1, 1.6, 3, 4, 6, 8, 10, 13, 16, 20, 25, 32, 40, 50, 63],
    /**
     * gG sigorta (IEC 60269), I_n ≥ 16 A: geleneksel erime akımı I_f (= I₂) = 1,6·I_n, geleneksel erimeme akımı 1,25·I_n.
     * Enel GSCL004 "Low Voltage Fuses (NH Knife Blade Fuse System)" Rev. 0, Tablo 6 (s. 14): "16 ≤ In ≤ 63 … 400 ≤ In:
     * Inf 1,25 In, If 1,6 In":
     * https://www.enel.com.br/content/dam/enel-br/normas-t%C3%A9cnicas-rio/normas-corporativas/Global%20Standard%20-%20Low%20Voltage%20Fuses.pdf
     * BEAMA "Guide to low-voltage switch and fusegear devices" s. 9: "Conventional fusing current If … (usually 1.6 x In)"
     * https://www.beama.org.uk/asset/FEAC8E4C-F8BD-4B1D-9251BB1065347271/
     * I_n < 16 A için oran açılan kaynaklarda yok → hesapta kullanıcı girdisi.
     */
    gGI2Katsayisi: 1.6,
    /** gGI2Katsayisi'nin geçerli olduğu en küçük anma akımı (dahil), A — Enel GSCL004 Tablo 6 "16 ≤ In" */
    gGI2KatsayisiAltSinir: 16,
    /**
     * gG bıçaklı (NH) sigorta anma akımları serisi, A: Legrand teknik şartname F00189EN/06 (güncelleme 15.07.2024)
     * "Industrial blade-type cartridge fuses gG type", 2.1 Rated currents:
     * https://assets.legrand.com/pim/NP-FT-GT/F00189EN-06.pdf
     */
    gGAnmaAkimlari: [16, 25, 32, 35, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250],
    /**
     * Kompakt şalter (IEC 60947-2): geleneksel açmama akımı 1,05×, geleneksel açma akımı 1,3× (süre 1 sa).
     * Schneider Electric SSS FA369327 "Standard IEC 60947-2: … Conventional tripping current 1.3 x In":
     * https://www.se.com/za/en/faqs/FA369327
     * Kaynak oranı I_n'e göre verir (sabit ayarlı cihaz); ayarlı şalterde bu oran ayar akımı I_r'ye uygulanır.
     */
    kompaktI2Katsayisi: 1.3,
  },
} as const;
