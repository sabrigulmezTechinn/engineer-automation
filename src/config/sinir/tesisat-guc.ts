/**
 * Kompanzasyon, kısa devre, trafo, topraklama, pano ısı (2.4–2.8) sınır ve varsayılan değerleri (SI). Faz 3 işçisi B bu dosyanın sahibidir.
 * Her değerin yanına kaynağı (yönetmelik/standart adı, madde, açılan URL) yazılır; kaynağı açılamayan değer
 * buraya girmez, hesapta kullanıcı girdisi olur.
 */
export const TESISAT_GUC_SINIRLARI = {
  /**
   * EPDK reaktif enerji sınırları (2.4). Oran = reaktif enerji / aktif enerji (fatura dönemi içinde, kVArh/kWh).
   * Kaynak: "Dağıtım Lisansı Sahibi Tüzel Kişiler ve Görevli Tedarik Şirketlerinin Tarife Uygulamalarına İlişkin Usul ve
   * Esaslar" (EPDK 5999-3 sayılı Kurul Kararı, RG 31/12/2015-29579; değişiklikleriyle), Madde 13 (2)–(3) ve EK-1 (B).
   * Açılan belge: EPDK "Son Hali" Word dosyası (dosya tarihi 28/11/2022; 28/04/2022 tarihli 10961 sayılı değişikliği içerir)
   *   https://www.epdk.gov.tr/Detay/Icerik/3-17057/elektrik-piyasasi-tarifeleri-uygulama-usul-ve-esa
   *   https://www.epdk.gov.tr/Detay/DownloadDocument?id=MESSe3sPiW4=
   * Aynı sayfadaki değişiklik kararları arşivinin (https://www.epdk.gov.tr/Detay/DownloadDocument?id=dUdfdvZVIm4=) en yeni
   * kararı 11338 sayılıdır (dosya tarihi 28/11/2022); "Son Hali" bununla aynı tarihlidir. 15/11/2026 itibarıyla daha yeni
   * değişiklik sayfada görünmüyordu.
   * Madde 13 (1): mesken, aydınlatma, tek fazla beslenen tüketiciler ile kurulu gücü 15 kW'a (dâhil) kadar olan kullanıcılara
   * reaktif enerji tarifesi uygulanmaz.
   */
  epdkReaktif: {
    /** Bu kurulu gücün (VA) altı "küçük", üstü ve eşiti "büyük" sınıftır (Madde 13 (2)–(3): 50 kVA). */
    sinifEsigi: 50e3,
    /** Reaktif enerji tarifesi uygulanmayan kurulu güç üst sınırı (W, dâhil) — Madde 13 (1): 15 kW. */
    muafiyetGucu: 15e3,
    /** Kurulu gücü 50 kVA'nın altında: endüktif (çekilen) %33, kapasitif (verilen) %20 — Madde 13 (2). */
    kucuk: { enduktif: 0.33, kapasitif: 0.2 },
    /** Kurulu gücü 50 kVA ve üstünde: endüktif %20, kapasitif %15 — Madde 13 (3). */
    buyuk: { enduktif: 0.2, kapasitif: 0.15 },
  },

  /**
   * Gerilim katsayısı c (2.5), IEC 60909 ("Fig. 25 : Values for voltage factor c (see IEC 60909)").
   * Kaynak: Schneider Electric Cahier Technique n° 158 "Calculation of short-circuit currents", §3.3, s. 25
   *   https://download.se.com/files?p_Doc_Ref=ECT158
   * Not: CT158 IEC 60909'un 2001 baskısına dayanır; 2016 baskısındaki tablo açılamadı (c_min değeri doğrulanamadı).
   */
  gerilimKatsayisi: {
    /** AG (100–1000 V), gerilim toleransı +%6: c_maks = 1,05; c_min = 0,95 */
    ag6: { cMaks: 1.05, cMin: 0.95 },
    /** AG (100–1000 V), gerilim toleransı +%10: c_maks = 1,10; c_min = 0,95 */
    ag10: { cMaks: 1.1, cMin: 0.95 },
    /** OG ve YG (1–550 kV): c_maks = 1,10; c_min = 1,00 — şebeke besleme empedansında (Z_Q) c_Q olarak kullanılır. */
    og: { cMaks: 1.1, cMin: 1.0 },
  },
  /**
   * Şebeke besleme empedansında R_Q/X_Q için varsayılan: 0,1 (X_Q = 0,995·Z_Q).
   * Kaynak: CT158 §3.5 Problem 1, s. 28: "Failing other information, it is assumed that R_Q/X_Q = 0.1".
   */
  sebekeRX: 0.1,

  /**
   * TT sistemlerinde koruma koşulu R_A·I_a ≤ U_L (2.7). Sürekli dokunma gerilimi sınırı U_L (V).
   * Kaynak: Elektrik Tesislerinde Topraklamalar Yönetmeliği (RG 21/08/2001-24500; son değişiklik RG 04/12/2019-30968),
   * Madde 8-a4/ii ("R_A x I_a ≤ 50 V koşulu yerine gelmelidir (50 V = U_L)") ve Çizelge-11/Çizelge-12 (U_L = 50 V ve
   * U_L = 25 V sütunları; seçici (S) hata akımı koruma düzenlerinde R_A = U_L/(2·IΔn)).
   *   https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.10392.doc
   *   https://mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=10392&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5
   */
  dokunmaGerilimi: {
    /** Genel durum: U_L = 50 V */
    normal: 50,
    /** Çizelge-11 ve Çizelge-12'deki düşük sınır: U_L = 25 V */
    dusuk: 25,
  },

  /**
   * Fan debisi katsayısı f, deniz seviyesinden yüksekliğe göre (2.8): V = f·Q/ΔT. Katalogda m³·K/(W·h) birimiyle
   * 3,1 (0–100 m), 3,2 (100–250 m), 3,3 (250–500 m), 3,4 (500–750 m), 3,5 (750–1000 m); burada SI'ya (m³·K/J) çevrilmiş
   * olarak (÷3600) tutulur. Fiziksel karşılığı 1/(ρ_hava·c_p).
   * Kaynak: Rittal "Technical System Catalogue / Climate control", TopTherm fan-and-filter units, Project planning (s. 3-6)
   *   https://www.rittal.de/downloads/eBook/TSH/EN/climate_control/pubData/SEO/Page_7.html
   *   https://static.chipdip.ru/lib/034/DOC021034421.pdf (aynı katalogun PDF'i)
   */
  fanKatsayisi: {
    r100: 3.1 / 3600,
    r250: 3.2 / 3600,
    r500: 3.3 / 3600,
    r750: 3.4 / 3600,
    r1000: 3.5 / 3600,
  },

  /**
   * IEC 61439-1 normal hizmet koşulları ve sıcaklık artışı sınırları (2.8, yalnızca bilgi). Standart metni açılamadı;
   * değerler standarda atıf yapan üretici belgesinden: ABB "Technical Application Papers No.11 — Guidelines to the
   * construction of a low-voltage assembly complying with the Standards IEC 61439 Part 1 and Part 2" (1SDC007110G0203),
   * Tablo 3.1 (iç mekân) ve Tablo 7.1 (sıcaklık artışı sınırları; ortalama ortam sıcaklığı 35 °C'ye kadar geçerli).
   *   https://library.e.abb.com/public/851c5f31e1c142e89adc271788b45bbb/1SDC007110G0203.pdf
   * Sıcaklıklar K (mutlak), artışlar K (fark).
   */
  iec61439: {
    /** İç mekân: ortam sıcaklığı en çok 40 °C */
    ortamMaks: 313.15,
    /** İç mekân: 24 saatlik ortalama ortam sıcaklığı en çok 35 °C */
    ortam24sOrt: 308.15,
    /** İç mekân: ortam sıcaklığı en az −5 °C */
    ortamMin: 268.15,
    /** Dış yalıtılmış iletkenlerin bağlantı uçları: 70 K */
    ucArtis: 70,
    /** Erişilebilir dış muhafaza ve kapaklar, metal yüzey: 30 K */
    metalYuzeyArtis: 30,
  },
} as const;
