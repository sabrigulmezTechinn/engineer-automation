/**
 * Kablo hesaplarının (2.1, 2.2) veri tabloları. Değerler kamuya açık üretici kataloglarından ve NBS tablolarından
 * birebir alınmıştır (KAPSAM §5.1: IEC 60364-5-52 tabloları gömülmez). Tablolar katalogdaki birimlerle
 * (mm², Ω/km, A) yazılır; hesapta `katalogSatiriSI` ile SI'ya çevrilir.
 */

/** Katalogdaki bir satır: kesit, 20 °C'de iletken DC direnci (en çok) ve akım taşıma kapasiteleri */
export interface KatalogSatiri {
  /** Nominal kesit, mm² */
  kesitMm2: number;
  /** 20 °C'de iletken DC direnci (en çok), Ω/km */
  r20OhmKm: number;
  /** Toprakta akım taşıma kapasitesi, A */
  toprakA: number;
  /** Havada akım taşıma kapasitesi, A */
  havaA: number;
}

export interface KabloKatalogu {
  /** Hesaptaki seçim değeri */
  id: "nyy" | "yxv";
  ad: string;
  yalitkan: "pvc" | "xlpe";
  url: string;
  /** Katalogdaki sayfa ve tablo */
  sayfa: string;
  /** Katalogdaki referans koşulları notu (aynen) */
  referansNotu: string;
  /** Kesite göre artan sırada */
  satirlar: readonly KatalogSatiri[];
}

const PRYSMIAN_NOTU =
  "Akım taşıma kapasiteleri toprak sıcaklığı 20 ºC, hava sıcaklığı 30 ºC, 1 Km/W ve 0,7 yük faktörü için hesaplanmıştır.";

/**
 * Prysmian YVV-U / YVV-R / NYY 0,6/1 kV (TS IEC 60502-1), bakır iletken, PVC yalıtkan, 4 damarlı.
 * Katalog s. 73 "Teknik Özellikler — 4 Damarlı / 4 Cores" tablosu (PDF s. 4), sütunlar: 20 °C'de İletken DA Direnci,
 * Akım Taşıma Kapasitesi Toprakta / Havada. Değerler sayfa görüntüsünden okundu.
 * https://tr.prysmian.com/sites/tr.prysmian.com/files/media/products/YVV-U_YVV-R_NYY.pdf
 */
export const PRYSMIAN_NYY_4D: KabloKatalogu = {
  id: "nyy",
  ad: "Prysmian YVV-U/YVV-R/NYY 0,6/1 kV, Cu/PVC, 4 damarlı",
  yalitkan: "pvc",
  url: "https://tr.prysmian.com/sites/tr.prysmian.com/files/media/products/YVV-U_YVV-R_NYY.pdf",
  sayfa: "s. 73, 4 damarlı tablo",
  referansNotu: PRYSMIAN_NOTU,
  satirlar: [
    { kesitMm2: 1.5, r20OhmKm: 12.1, toprakA: 27, havaA: 19.5 },
    { kesitMm2: 2.5, r20OhmKm: 7.41, toprakA: 36, havaA: 25 },
    { kesitMm2: 4, r20OhmKm: 4.61, toprakA: 47, havaA: 34 },
    { kesitMm2: 6, r20OhmKm: 3.08, toprakA: 59, havaA: 43 },
    { kesitMm2: 10, r20OhmKm: 1.83, toprakA: 79, havaA: 59 },
    { kesitMm2: 16, r20OhmKm: 1.15, toprakA: 102, havaA: 79 },
    { kesitMm2: 25, r20OhmKm: 0.727, toprakA: 133, havaA: 106 },
    { kesitMm2: 35, r20OhmKm: 0.524, toprakA: 159, havaA: 129 },
    { kesitMm2: 50, r20OhmKm: 0.387, toprakA: 188, havaA: 157 },
    { kesitMm2: 70, r20OhmKm: 0.268, toprakA: 232, havaA: 199 },
    { kesitMm2: 95, r20OhmKm: 0.193, toprakA: 280, havaA: 246 },
    { kesitMm2: 120, r20OhmKm: 0.153, toprakA: 318, havaA: 285 },
    { kesitMm2: 150, r20OhmKm: 0.124, toprakA: 359, havaA: 326 },
    { kesitMm2: 185, r20OhmKm: 0.0991, toprakA: 406, havaA: 374 },
    { kesitMm2: 240, r20OhmKm: 0.0754, toprakA: 473, havaA: 445 },
    { kesitMm2: 300, r20OhmKm: 0.0601, toprakA: 535, havaA: 511 },
    { kesitMm2: 400, r20OhmKm: 0.047, toprakA: 613, havaA: 597 },
  ],
};

/**
 * Prysmian YXV-U / YXV-R / YE3V / 2XY 0,6/1 kV (TS IEC 60502-1), bakır iletken, XLPE yalıtkan, 4 damarlı.
 * Katalog s. 89 "Teknik Özellikler — 4 Damarlı / 4 Cores" tablosu (PDF s. 4). Değerler sayfa görüntüsünden okundu.
 * https://tr.prysmian.com/sites/tr.prysmian.com/files/media/products/YXV-U_YXV-R_YE3V_2XY.pdf
 */
export const PRYSMIAN_YXV_4D: KabloKatalogu = {
  id: "yxv",
  ad: "Prysmian YXV-U/YXV-R/YE3V/2XY 0,6/1 kV, Cu/XLPE, 4 damarlı",
  yalitkan: "xlpe",
  url: "https://tr.prysmian.com/sites/tr.prysmian.com/files/media/products/YXV-U_YXV-R_YE3V_2XY.pdf",
  sayfa: "s. 89, 4 damarlı tablo",
  referansNotu: PRYSMIAN_NOTU,
  satirlar: [
    { kesitMm2: 1.5, r20OhmKm: 12.1, toprakA: 31, havaA: 24 },
    { kesitMm2: 2.5, r20OhmKm: 7.41, toprakA: 40, havaA: 32 },
    { kesitMm2: 4, r20OhmKm: 4.61, toprakA: 52, havaA: 42 },
    { kesitMm2: 6, r20OhmKm: 3.08, toprakA: 64, havaA: 53 },
    { kesitMm2: 10, r20OhmKm: 1.83, toprakA: 86, havaA: 74 },
    { kesitMm2: 16, r20OhmKm: 1.15, toprakA: 112, havaA: 98 },
    { kesitMm2: 25, r20OhmKm: 0.727, toprakA: 145, havaA: 133 },
    { kesitMm2: 35, r20OhmKm: 0.524, toprakA: 174, havaA: 162 },
    { kesitMm2: 50, r20OhmKm: 0.387, toprakA: 206, havaA: 197 },
    { kesitMm2: 70, r20OhmKm: 0.268, toprakA: 254, havaA: 250 },
    { kesitMm2: 95, r20OhmKm: 0.193, toprakA: 305, havaA: 308 },
    { kesitMm2: 120, r20OhmKm: 0.153, toprakA: 348, havaA: 359 },
    { kesitMm2: 150, r20OhmKm: 0.124, toprakA: 392, havaA: 412 },
    { kesitMm2: 185, r20OhmKm: 0.0991, toprakA: 444, havaA: 475 },
    { kesitMm2: 240, r20OhmKm: 0.0754, toprakA: 517, havaA: 564 },
    { kesitMm2: 300, r20OhmKm: 0.0601, toprakA: 585, havaA: 649 },
    { kesitMm2: 400, r20OhmKm: 0.047, toprakA: 671, havaA: 761 },
  ],
};

export const KABLO_KATALOGLARI = { nyy: PRYSMIAN_NYY_4D, yxv: PRYSMIAN_YXV_4D } as const;

/** Katalog satırının SI karşılığı: kesit m², direnç Ω/m, akımlar A */
export function katalogSatiriSI(s: KatalogSatiri): { kesit: number; r20: number; toprak: number; hava: number } {
  return { kesit: s.kesitMm2 * 1e-6, r20: s.r20OhmKm * 1e-3, toprak: s.toprakA, hava: s.havaA };
}

/**
 * İletken malzemesinin 20 °C'deki özdirenci (Ω·m) ve 20 °C'deki sabit kütle direnç sıcaklık katsayısı (1/K).
 * - Bakır (Uluslararası Tavlanmış Bakır Standardı, IACS): 0,017 241 Ω·mm²/m; α₂₀ = 0,003 93.
 *   NBS Handbook 100 "Copper Wire Tables" (1966) §1.a–b: https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook100.pdf
 * - Alüminyum (EC-H19, %61 IACS, iletken alüminyum): 0,028 264 Ω·mm²/m; α₂₀ = 0,004 03.
 *   NBS Handbook 109 "Aluminum Wire Tables" (1972) Tablo 1: https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook109.pdf
 */
export const ILETKEN_MALZEMELERI = {
  cu: { ad: "Bakır (IACS, tavlanmış)", rho20: 0.017241e-6, alpha20: 0.00393 },
  al: { ad: "Alüminyum (EC-H19, %61 IACS)", rho20: 0.028264e-6, alpha20: 0.00403 },
} as const;

/** Özdirenç ve sıcaklık katsayısının referans sıcaklığı: 20 °C (K) */
export const MALZEME_REFERANS_SICAKLIGI = 293.15;

/**
 * 2.2 için varsayılan endüktif reaktans örneği (Ω/km, 4 anlamlı basamağa yuvarlanmış): Klaus Faber NYY-O 04X10 SW,
 * "Lb specific inductivity" 0,301 mH/km (veri sayfası dbl_nyy.pdf, sürüm 24.03.2017):
 * https://asset.conrad.com/media10/add/160267/c1/-/en/001152584DS02/tehnicni-podatki-1152584-visokonapetostni-kabel-nyy-j-5-x-6-mm-crne-barve-metrsko-blago-faber-kabel.pdf
 * X = 2π·50 Hz·0,301 mH/km = 0,094 56 Ω/km.
 */
export const ORNEK_REAKTANS_NYY_4X10_OHM_KM = 0.09456;
