/**
 * Pnömatik, hidrolik, vakum, rulman (6.6–6.9) sınır ve varsayılan değerleri (SI). Faz 3 işçisi D bu dosyanın sahibidir.
 * Her değerin yanına kaynağı (yönetmelik/standart adı, madde, açılan URL) yazılır; kaynağı açılamayan değer
 * buraya girmez, hesapta kullanıcı girdisi olur.
 */
export const MEKATRONIK_AKISKAN_SINIRLARI = {
  /**
   * ISO 8778:2003 "Pneumatic fluid power — Standard reference atmosphere", §4.1 Tablo 1: standart referans
   * atmosfer (ANR) 100 kPa (1 bar), 20 °C, %65 bağıl nem (ISO 8778:1990 ile aynı). Normal litre (NL) bu
   * koşula indirgenmiş serbest hava hacmidir. Açılan önizleme (§1–4 ve Tablo 1):
   * https://cdn.standards.iteh.ai/samples/26559/a9b11ca8dd0f4437a017aea5deeaab02/ISO-8778-2003.pdf
   */
  iso8778: {
    /** Pa */
    basinc: 100e3,
    /** K (20 °C) */
    sicaklik: 293.15,
    /** kesir */
    bagilNem: 0.65,
  },

  /**
   * ISO 15552 ve ISO 6432 pnömatik silindirleri "1 000 kPa (10 bar) series" (en büyük çalışma basıncı, standart başlığı).
   * - ISO 15552:2018 "Cylinders with detachable mountings, 1 000 kPa (10 bar) series, bores from 32 mm to 320 mm":
   *   https://www.boutique.afnor.org/en-gb/standard/iso-155522018/pneumatic-fluid-power-cylinders-with-detachable-mountings-1-000-kpa-10-bar-/xs026032/125890
   * - ISO 6432:2015 "Single rod cylinders, 1 000 kPa (10 bar) series, bores from 8 mm to 25 mm":
   *   https://www.boutique.afnor.org/en-gb/standard/iso-64322015/pneumatic-fluid-power-single-rod-cylinders-1-000-kpa-10-bar-series-bores-fr/xs022916/123213
   * Pa.
   */
  pnomatikSeriBasinci: 1e6,

  /**
   * Standart pnömatik silindir piston ve mil çapları (m). Telif nedeniyle ISO tablosu değil, standarda uygun
   * üretici kataloglarının kamuya açık değerleri kullanılır. Her çiftin mil çapı, kataloğun "teorik kuvvet, 6 bar,
   * geri dönüş" satırıyla doğrulandı (p·π·(D² − d²)/4).
   * - ISO 6432, Festo DSNU (2012/08), "General technical data" ve boyut tablosu MM sütunu:
   *   https://ftp.festo.com/public/PNEUMATIC/SOFTWARE_SERVICE/Documentation/2012/EN/DSNU-ISO_EN.PDF
   * - ISO 15552, Festo DSBC (2015/11), boyut tablosu MM sütunu:
   *   https://ftp.festo.com/public/PNEUMATIC/SOFTWARE_SERVICE/Documentation/2016/EN/DSBC_EN.PDF
   * ISO 15552 125 mm'nin üstündeki çaplar (160…320) bu katalogda yok; eklenmedi.
   */
  pnomatikKatalogCaplari: [
    { standart: "ISO 6432", katalog: "Festo DSNU", D: 0.008, d: 0.004 },
    { standart: "ISO 6432", katalog: "Festo DSNU", D: 0.01, d: 0.004 },
    { standart: "ISO 6432", katalog: "Festo DSNU", D: 0.012, d: 0.006 },
    { standart: "ISO 6432", katalog: "Festo DSNU", D: 0.016, d: 0.006 },
    { standart: "ISO 6432", katalog: "Festo DSNU", D: 0.02, d: 0.008 },
    { standart: "ISO 6432", katalog: "Festo DSNU", D: 0.025, d: 0.01 },
    { standart: "ISO 15552", katalog: "Festo DSBC", D: 0.032, d: 0.012 },
    { standart: "ISO 15552", katalog: "Festo DSBC", D: 0.04, d: 0.016 },
    { standart: "ISO 15552", katalog: "Festo DSBC", D: 0.05, d: 0.02 },
    { standart: "ISO 15552", katalog: "Festo DSBC", D: 0.063, d: 0.02 },
    { standart: "ISO 15552", katalog: "Festo DSBC", D: 0.08, d: 0.025 },
    { standart: "ISO 15552", katalog: "Festo DSBC", D: 0.1, d: 0.025 },
    { standart: "ISO 15552", katalog: "Festo DSBC", D: 0.125, d: 0.032 },
  ],

  /**
   * Hidrolik silindir serilerinin anma basınçları (Pa), standart başlıklarından:
   * - ISO 6020-2:2015 "Mounting dimensions for single rod cylinders, 16 MPa (160 bar) series — Part 2: Compact series":
   *   https://www.boutique.afnor.org/en-gb/standard/iso-602022015/hydraulic-fluid-power-mounting-dimensions-for-single-rod-cylinders-16-mpa-1/xs022890/123102
   * - ISO 6022:2006 "Mounting dimensions for single rod cylinders, 25 MPa (250 bar) series":
   *   https://iteh.eu/catalog/standards/iso/3f05d452-b26f-4287-b192-0b98a5f2fc05/iso-6022-2006
   * Üreticiler aynı bağlantı ölçülerinde daha yüksek basınç verebilir (ör. katalog anma basıncı); kontrol uyarı düzeyindedir.
   */
  hidrolikSeriBasinci: {
    iso6020_2: 16e6,
    iso6022: 25e6,
  },

  /**
   * Vakum vantuzu emniyet katsayısı S (Schmalz, "Theoretical Holding Force of a Suction Cup"):
   * pürüzsüz ve sızdırmaz iş parçasında en az 1,5; kritik, heterojen, gözenekli, pürüzlü veya yağlı yüzeyde 2,0 ve üstü.
   *   https://www.schmalz.com/en/support/know-how/vacuum-knowledge/the-vacuum-system-and-its-components/system-design-calculation-example/theoretical-holding-force-of-a-suction-cup
   * İş parçası döndürülürken (dönme kuvvetleri) 2,5 ve üstü (Schmalz, "Design of the Suction Cup"):
   *   https://www.schmalz.com/en/support/know-how/vacuum-knowledge/the-vacuum-system-and-its-components/vacuum-suction-cups/design-of-the-suction-cup
   */
  vakumEmniyet: {
    min: 1.5,
    kritikYuzey: 2.0,
    dondurme: 2.5,
  },

  /**
   * Rulman ömrü güvenilirlik düzeltme katsayısı a₁. Anahtar: güvenilirlik %.
   * - SKF Rolling bearings catalogue (PUB BU/P1 17000/1 EN), Tablo 3 "Values for life adjustment factor a1", s. 90
   *   ("values in accordance with ISO 281"):
   *   https://www.skf.com/binaries/pub12/Images/0901d196802809de-Rolling-bearings---17000_1-EN_tcm_12-121486.pdf
   * - Aynı değerler JTEKT (Koyo) SSS, "Life modification factor for reliability a1" ("Citation from JIS B 1518:2013"):
   *   https://www.jtekt.co.jp/products/bearing/en/support/faq/article/002207.php
   */
  rulmanA1: {
    "90": 1,
    "95": 0.64,
    "96": 0.55,
    "97": 0.47,
    "98": 0.37,
    "99": 0.25,
  },
} as const;
