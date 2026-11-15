/**
 * Birim kataloğu: her boyutun birimleri, gösterim sırasıyla (önce SI ve önekli katları küçükten
 * büyüğe, ardından diğerleri).
 *
 * SI = değer · factor + offset. Her boyutun SI birimi `SI_UNIT_IDS` içinde açıkça belirtilir
 * (factor 1, offset yok). "factor 1 olan birim" tek başına yeterli değildir: ör. sıcaklık farkında
 * K ve °C, ısıl dirençte K/W ve °C/W ikisi de factor 1'dir.
 *
 * Kimlik kuralları (kimlikler kayıtlı hesaplarda saklanır; değiştirilmez, silinmez):
 * - Yalnızca ASCII harf, rakam ve "_": µ → "u", ² → "2", ³ → "3", Ω → "ohm", ° → "deg".
 * - Çarpım bitişik yazılır ("Nm", "kgm2"); bölme "_" ile yazılır ("m_s", "L_min", "K_W").
 *   İstisna: özdirençte okunurluk için "ohm_m" (Ω·m) ve "ohm_mm2_m" (Ω·mm²/m); buradaki ilk "_" çarpımdır.
 *   Bu yüzden birim uzunluk başına dirençte bölme "_per_" ile yazılır: "ohm_per_m" (Ω/m), "ohm_per_km" (Ω/km).
 * - Kimlikler büyük/küçük harf duyarlıdır (SI önekleri gibi): "mW" ≠ "MW", "mohm" ≠ "Mohm", "ms" ≠ "mS".
 * - Bir kimlik yalnızca bir boyutta bulunur: gram "g", yerçekimi ivmesi "gn"; mutlak sıcaklık "K"/"degC",
 *   sıcaklık farkı "deltaK"/"deltaDegC".
 * - "mil" kimliği bilerek yoktur (Türkçede kara mili, İngilizcede thou demektir): "mi" ve "thou" kullanılır.
 */
import type { Dimension, UnitDef } from "./types";

const PI = Math.PI;
/** Standart yerçekimi ivmesi g_n, m/s² (tanım gereği tam) */
const G_N = 9.80665;
/** Pound-kuvvet, N (tam: 0,45359237 kg · g_n) */
const LBF = 4.4482216152605;
const INCH = 0.0254;
const FOOT = 0.3048;

type Def = Omit<UnitDef, "dimension">;

function group(dimension: Dimension, defs: Def[]): UnitDef[] {
  return defs.map((d) => ({ ...d, dimension }));
}

const ALL: UnitDef[] = [
  ...group("boyutsuz", [{ id: "unitless", symbol: "-", name: "boyutsuz", factor: 1 }]),
  ...group("oran", [
    { id: "fraction", symbol: "-", name: "kesir (0–1)", factor: 1 },
    { id: "percent", symbol: "%", name: "yüzde", factor: 1e-2 },
    { id: "permille", symbol: "‰", name: "binde", factor: 1e-3 },
    { id: "ppm", symbol: "ppm", name: "milyonda bir", factor: 1e-6 },
  ]),
  ...group("gerilim", [
    { id: "uV", symbol: "µV", name: "mikrovolt", factor: 1e-6 },
    { id: "mV", symbol: "mV", name: "milivolt", factor: 1e-3 },
    { id: "V", symbol: "V", name: "volt", factor: 1 },
    { id: "kV", symbol: "kV", name: "kilovolt", factor: 1e3 },
  ]),
  ...group("akim", [
    { id: "uA", symbol: "µA", name: "mikroamper", factor: 1e-6 },
    { id: "mA", symbol: "mA", name: "miliamper", factor: 1e-3 },
    { id: "A", symbol: "A", name: "amper", factor: 1 },
    { id: "kA", symbol: "kA", name: "kiloamper", factor: 1e3 },
  ]),
  ...group("direnc", [
    { id: "mohm", symbol: "mΩ", name: "miliohm", factor: 1e-3 },
    { id: "ohm", symbol: "Ω", name: "ohm", factor: 1 },
    { id: "kohm", symbol: "kΩ", name: "kiloohm", factor: 1e3 },
    { id: "Mohm", symbol: "MΩ", name: "megaohm", factor: 1e6 },
  ]),
  ...group("iletkenlik", [
    { id: "mS", symbol: "mS", name: "milisiemens", factor: 1e-3 },
    { id: "S", symbol: "S", name: "siemens", factor: 1 },
  ]),
  ...group("guc", [
    { id: "mW", symbol: "mW", name: "miliwatt", factor: 1e-3 },
    { id: "W", symbol: "W", name: "watt", factor: 1 },
    { id: "kW", symbol: "kW", name: "kilowatt", factor: 1e3 },
    { id: "MW", symbol: "MW", name: "megawatt", factor: 1e6 },
    // 75 kgf·m/s = 75 · 9,80665 W (tam)
    { id: "PS", symbol: "PS", name: "metrik beygir gücü (PS/BG, 735,49875 W)", factor: 75 * G_N },
    // 550 lbf·ft/s (tam)
    { id: "hp", symbol: "hp", name: "mekanik beygir gücü (hp, 745,69987 W)", factor: 550 * LBF * FOOT },
  ]),
  ...group("reaktif_guc", [
    { id: "var", symbol: "var", name: "volt-amper reaktif", factor: 1 },
    { id: "kvar", symbol: "kvar", name: "kilovolt-amper reaktif", factor: 1e3 },
    { id: "Mvar", symbol: "Mvar", name: "megavolt-amper reaktif", factor: 1e6 },
  ]),
  ...group("gorunur_guc", [
    { id: "VA", symbol: "VA", name: "volt-amper", factor: 1 },
    { id: "kVA", symbol: "kVA", name: "kilovolt-amper", factor: 1e3 },
    { id: "MVA", symbol: "MVA", name: "megavolt-amper", factor: 1e6 },
  ]),
  ...group("enerji", [
    { id: "J", symbol: "J", name: "joule", factor: 1 },
    { id: "kJ", symbol: "kJ", name: "kilojoule", factor: 1e3 },
    { id: "MJ", symbol: "MJ", name: "megajoule", factor: 1e6 },
    { id: "Wh", symbol: "Wh", name: "watt-saat", factor: 3600 },
    { id: "kWh", symbol: "kWh", name: "kilowatt-saat", factor: 3.6e6 },
    { id: "MWh", symbol: "MWh", name: "megawatt-saat", factor: 3.6e9 },
  ]),
  ...group("yuk", [
    { id: "C", symbol: "C", name: "coulomb", factor: 1 },
    { id: "mAh", symbol: "mAh", name: "miliamper-saat", factor: 3.6 },
    { id: "Ah", symbol: "Ah", name: "amper-saat", factor: 3600 },
  ]),
  ...group("frekans", [
    { id: "Hz", symbol: "Hz", name: "hertz", factor: 1 },
    { id: "kHz", symbol: "kHz", name: "kilohertz", factor: 1e3 },
    { id: "MHz", symbol: "MHz", name: "megahertz", factor: 1e6 },
  ]),
  ...group("kapasitans", [
    { id: "pF", symbol: "pF", name: "pikofarad", factor: 1e-12 },
    { id: "nF", symbol: "nF", name: "nanofarad", factor: 1e-9 },
    { id: "uF", symbol: "µF", name: "mikrofarad", factor: 1e-6 },
    { id: "mF", symbol: "mF", name: "milifarad", factor: 1e-3 },
    { id: "F", symbol: "F", name: "farad", factor: 1 },
  ]),
  ...group("enduktans", [
    { id: "nH", symbol: "nH", name: "nanohenry", factor: 1e-9 },
    { id: "uH", symbol: "µH", name: "mikrohenry", factor: 1e-6 },
    { id: "mH", symbol: "mH", name: "milihenry", factor: 1e-3 },
    { id: "H", symbol: "H", name: "henry", factor: 1 },
  ]),
  ...group("zaman", [
    { id: "us", symbol: "µs", name: "mikrosaniye", factor: 1e-6 },
    { id: "ms", symbol: "ms", name: "milisaniye", factor: 1e-3 },
    { id: "s", symbol: "s", name: "saniye", factor: 1 },
    { id: "min", symbol: "dk", name: "dakika", factor: 60 },
    { id: "h", symbol: "sa", name: "saat", factor: 3600 },
    { id: "day", symbol: "gün", name: "gün", factor: 86400 },
    // Enerji/maliyet hesaplarında yıl 365 gün = 8760 saat kabul edilir (geri ödeme süresi vb.).
    { id: "yr", symbol: "yıl", name: "yıl (365 gün)", factor: 365 * 86400 },
  ]),
  ...group("uzunluk", [
    { id: "um", symbol: "µm", name: "mikrometre", factor: 1e-6 },
    { id: "mm", symbol: "mm", name: "milimetre", factor: 1e-3 },
    { id: "cm", symbol: "cm", name: "santimetre", factor: 1e-2 },
    { id: "m", symbol: "m", name: "metre", factor: 1 },
    { id: "km", symbol: "km", name: "kilometre", factor: 1e3 },
    // PCB yol genişliği (4.10)
    { id: "thou", symbol: "thou", name: "thou (İng. mil, 0,001 inç)", factor: INCH / 1000 },
    { id: "in", symbol: "inç", name: "inç", factor: INCH },
    { id: "ft", symbol: "ft", name: "fit (ayak)", factor: FOOT },
    { id: "mi", symbol: "mi", name: "mil (kara mili, 1609,344 m)", factor: 1609.344 },
  ]),
  ...group("alan", [
    { id: "mm2", symbol: "mm²", name: "milimetrekare", factor: 1e-6 },
    { id: "cm2", symbol: "cm²", name: "santimetrekare", factor: 1e-4 },
    { id: "m2", symbol: "m²", name: "metrekare", factor: 1 },
  ]),
  ...group("hacim", [
    { id: "cm3", symbol: "cm³", name: "santimetreküp", factor: 1e-6 },
    { id: "L", symbol: "L", name: "litre", factor: 1e-3 },
    { id: "m3", symbol: "m³", name: "metreküp", factor: 1 },
  ]),
  ...group("kutle", [
    { id: "g", symbol: "g", name: "gram", factor: 1e-3 },
    { id: "kg", symbol: "kg", name: "kilogram", factor: 1 },
    { id: "t", symbol: "t", name: "ton", factor: 1e3 },
  ]),
  ...group("sicaklik", [
    { id: "K", symbol: "K", name: "kelvin", factor: 1 },
    { id: "degC", symbol: "°C", name: "santigrat derece", factor: 1, offset: 273.15 },
    // °F → K: (°F + 459,67) · 5/9
    { id: "degF", symbol: "°F", name: "fahrenhayt derece", factor: 5 / 9, offset: (459.67 * 5) / 9 },
  ]),
  ...group("sicaklik_farki", [
    { id: "deltaK", symbol: "K", name: "kelvin (fark)", factor: 1 },
    { id: "deltaDegC", symbol: "°C", name: "santigrat derece (fark)", factor: 1 },
    { id: "deltaDegF", symbol: "°F", name: "fahrenhayt derece (fark)", factor: 5 / 9 },
  ]),
  ...group("basinc", [
    { id: "Pa", symbol: "Pa", name: "paskal", factor: 1 },
    { id: "kPa", symbol: "kPa", name: "kilopaskal", factor: 1e3 },
    { id: "MPa", symbol: "MPa", name: "megapaskal", factor: 1e6 },
    { id: "mbar", symbol: "mbar", name: "milibar", factor: 100 },
    { id: "bar", symbol: "bar", name: "bar", factor: 1e5 },
    // Geleneksel mmHg: 13,5951 g/cm³ · g_n · 1 mm (760 mmHg ≈ 1 atm, tam eşit değil)
    { id: "mmHg", symbol: "mmHg", name: "milimetre cıva", factor: 133.322387415 },
    { id: "psi", symbol: "psi", name: "inç kare başına pound-kuvvet", factor: LBF / (INCH * INCH) },
    { id: "atm", symbol: "atm", name: "standart atmosfer", factor: 101325 },
  ]),
  ...group("kuvvet", [
    { id: "N", symbol: "N", name: "newton", factor: 1 },
    { id: "kN", symbol: "kN", name: "kilonewton", factor: 1e3 },
    { id: "kgf", symbol: "kgf", name: "kilogram-kuvvet", factor: G_N },
  ]),
  ...group("tork", [
    // mN·m, kgf·cm: step/servo motor veri sayfaları (6.3, 6.4)
    { id: "mNm", symbol: "mN·m", name: "milinewton-metre", factor: 1e-3 },
    { id: "Ncm", symbol: "N·cm", name: "newton-santimetre", factor: 1e-2 },
    { id: "Nm", symbol: "N·m", name: "newton-metre", factor: 1 },
    { id: "kNm", symbol: "kN·m", name: "kilonewton-metre", factor: 1e3 },
    { id: "kgfcm", symbol: "kgf·cm", name: "kilogram-kuvvet-santimetre", factor: G_N / 100 },
    { id: "kgfm", symbol: "kgf·m", name: "kilogram-kuvvet-metre", factor: G_N },
    { id: "lbfin", symbol: "lbf·in", name: "pound-kuvvet-inç", factor: LBF * INCH },
    { id: "lbfft", symbol: "lbf·ft", name: "pound-kuvvet-fit", factor: LBF * FOOT },
  ]),
  ...group("aci", [
    { id: "rad", symbol: "rad", name: "radyan", factor: 1 },
    { id: "deg", symbol: "°", name: "derece", factor: PI / 180 },
    // açı dakikası: redüktör boşluğu (6.1, 6.4)
    { id: "arcmin", symbol: "′", name: "açı dakikası", factor: PI / 10800 },
    // tam tur: enkoder ve vidalı mil hesapları (5.2, 6.2)
    { id: "rev", symbol: "dev", name: "devir (tam tur)", factor: 2 * PI },
  ]),
  ...group("acisal_hiz", [
    { id: "rad_s", symbol: "rad/s", name: "radyan/saniye", factor: 1 },
    { id: "rpm", symbol: "dev/dk", name: "devir/dakika", factor: (2 * PI) / 60 },
    { id: "rps", symbol: "dev/s", name: "devir/saniye", factor: 2 * PI },
  ]),
  ...group("acisal_ivme", [
    { id: "rad_s2", symbol: "rad/s²", name: "radyan/saniye²", factor: 1 },
    // dev/dk/s: sürücü rampaları (6.4)
    { id: "rpm_s", symbol: "dev/dk/s", name: "devir/dakika/saniye", factor: (2 * PI) / 60 },
  ]),
  ...group("hiz", [
    // mm/s: doğrusal eksen ve konveyör (6.2, 6.5)
    { id: "mm_s", symbol: "mm/s", name: "milimetre/saniye", factor: 1e-3 },
    { id: "m_s", symbol: "m/s", name: "metre/saniye", factor: 1 },
    { id: "m_min", symbol: "m/dk", name: "metre/dakika", factor: 1 / 60 },
    { id: "km_h", symbol: "km/sa", name: "kilometre/saat", factor: 1 / 3.6 },
  ]),
  ...group("ivme", [
    // mm/s²: servo boyutlandırma (6.4)
    { id: "mm_s2", symbol: "mm/s²", name: "milimetre/saniye²", factor: 1e-3 },
    { id: "m_s2", symbol: "m/s²", name: "metre/saniye²", factor: 1 },
    { id: "gn", symbol: "g", name: "yerçekimi ivmesi (g = 9,80665 m/s²)", factor: G_N },
  ]),
  ...group("debi", [
    { id: "m3_s", symbol: "m³/s", name: "metreküp/saniye", factor: 1 },
    { id: "m3_h", symbol: "m³/sa", name: "metreküp/saat", factor: 1 / 3600 },
    { id: "L_s", symbol: "L/s", name: "litre/saniye", factor: 1e-3 },
    { id: "L_min", symbol: "L/dk", name: "litre/dakika", factor: 1e-3 / 60 },
    // Normal litre: normal koşullara indirgenmiş hava hacmi (ISO 8778). Çarpan litreyle aynıdır;
    // normal koşula indirgeme hesabın işidir (6.6).
    { id: "NL_min", symbol: "NL/dk", name: "normal litre/dakika", factor: 1e-3 / 60 },
  ]),
  ...group("atalet", [
    { id: "gcm2", symbol: "g·cm²", name: "gram-santimetrekare", factor: 1e-7 },
    { id: "kgcm2", symbol: "kg·cm²", name: "kilogram-santimetrekare", factor: 1e-4 },
    { id: "kgm2", symbol: "kg·m²", name: "kilogram-metrekare", factor: 1 },
  ]),
  ...group("ozdirenc", [
    { id: "ohm_m", symbol: "Ω·m", name: "ohm-metre", factor: 1 },
    { id: "ohm_mm2_m", symbol: "Ω·mm²/m", name: "ohm-milimetrekare/metre", factor: 1e-6 },
  ]),
  ...group("direnc_uzunluk", [
    // Ω·m (özdirenç) ile karışmasın diye bu boyutta bölme "_per_" ile yazılır.
    { id: "ohm_per_m", symbol: "Ω/m", name: "ohm/metre", factor: 1 },
    { id: "mohm_per_m", symbol: "mΩ/m", name: "miliohm/metre", factor: 1e-3 },
    // Kablo üretici katalogları iletken direncini Ω/km verir (2.2, 2.5, 5.7).
    { id: "ohm_per_km", symbol: "Ω/km", name: "ohm/kilometre", factor: 1e-3 },
  ]),
  ...group("veri_hizi", [
    { id: "bit_s", symbol: "bit/s", name: "bit/saniye", factor: 1 },
    { id: "kbit_s", symbol: "kbit/s", name: "kilobit/saniye", factor: 1e3 },
    { id: "Mbit_s", symbol: "Mbit/s", name: "megabit/saniye", factor: 1e6 },
    // RS485/UART'ta sembol başına bir bit taşındığı için baud = bit/s kabul edilir (5.7).
    { id: "Bd", symbol: "Bd", name: "baud", factor: 1 },
  ]),
  ...group("para", [
    { id: "TL", symbol: "TL", name: "Türk lirası", factor: 1 },
    { id: "krs", symbol: "kr", name: "kuruş", factor: 1e-2 },
  ]),
  ...group("enerji_fiyati", [
    // Kanonik birim TL/J (maliyet = fiyat · enerji düz SI çarpımı olsun); arayüzde TL/kWh kullanılır.
    { id: "TL_kWh", symbol: "TL/kWh", name: "lira/kilovatsaat", factor: 1 / 3.6e6 },
    { id: "krs_kWh", symbol: "kr/kWh", name: "kuruş/kilovatsaat", factor: 1e-2 / 3.6e6 },
    { id: "TL_MWh", symbol: "TL/MWh", name: "lira/megavatsaat", factor: 1 / 3.6e9 },
    { id: "TL_J", symbol: "TL/J", name: "lira/joule", factor: 1 },
  ]),
  ...group("seviye_db", [
    // Logaritmik oran. dBm, dBV gibi referanslı seviyeler bilerek kardeş birim değildir:
    // convert onları dB'ye eşit sayardı. Referanslar hesap içinde (1.7) ele alınır.
    { id: "dB", symbol: "dB", name: "desibel", factor: 1 },
  ]),
  ...group("isil_direnc", [
    { id: "K_W", symbol: "K/W", name: "kelvin/watt", factor: 1 },
    // Soğutucu veri sayfaları °C/W verir (4.11); K/W ile aynı değer.
    { id: "degC_W", symbol: "°C/W", name: "santigrat derece/watt", factor: 1 },
  ]),
  ...group("isi_transfer_katsayisi", [
    { id: "W_m2K", symbol: "W/(m²·K)", name: "watt/(metrekare·kelvin)", factor: 1 },
  ]),
];

/** Her boyutun SI birimi (factor 1, offset yok). Record olduğu için her boyutta tam bir tane bulunur. */
export const SI_UNIT_IDS: Readonly<Record<Dimension, string>> = Object.freeze({
  boyutsuz: "unitless",
  oran: "fraction",
  gerilim: "V",
  akim: "A",
  direnc: "ohm",
  iletkenlik: "S",
  guc: "W",
  reaktif_guc: "var",
  gorunur_guc: "VA",
  enerji: "J",
  yuk: "C",
  frekans: "Hz",
  kapasitans: "F",
  enduktans: "H",
  zaman: "s",
  uzunluk: "m",
  alan: "m2",
  hacim: "m3",
  kutle: "kg",
  sicaklik: "K",
  sicaklik_farki: "deltaK",
  basinc: "Pa",
  kuvvet: "N",
  tork: "Nm",
  aci: "rad",
  acisal_hiz: "rad_s",
  hiz: "m_s",
  ivme: "m_s2",
  acisal_ivme: "rad_s2",
  debi: "m3_s",
  atalet: "kgm2",
  ozdirenc: "ohm_m",
  direnc_uzunluk: "ohm_per_m",
  veri_hizi: "bit_s",
  para: "TL",
  enerji_fiyati: "TL_J",
  seviye_db: "dB",
  isil_direnc: "K_W",
  isi_transfer_katsayisi: "W_m2K",
});

/** Tüm boyutlar */
export const DIMENSIONS: readonly Dimension[] = Object.freeze(Object.keys(SI_UNIT_IDS) as Dimension[]);

/** Tüm birimler; boyut içinde gösterim sırasıyla. Nesneler dondurulmuştur. */
export const UNITS: readonly UnitDef[] = Object.freeze(ALL.map((u) => Object.freeze(u)));
