/**
 * KAPSAM 4.5 — Direnç renk kodu, SMD direnç kodu ve kondansatör kodu: kod tabloları, kod çözücüler ve
 * özel arayüzün tek metin kutusu için metin ↔ girdi dönüşümü (saf fonksiyonlar; istemcide de çalışır).
 *
 * KAYNAKLAR (açıldı; tablolar IEC 60062'den kopyalanmadı, üretici belgelerinden alındı):
 * - Renk kodu (rakam, çarpan, tolerans), 4/5/6 bant düzeni, 6. bant TCR renkleri ve çip direnç işaretleri
 *   (3 karakter E24, 4 karakter ≤%1, "R" ve "L" ondalık işaretleri):
 *   Vishay Draloric, "Surface Mount Resistor Marking", belge no. 20020, rev. 25-May-2010:
 *   https://www.vishay.com/doc?20020
 * - Aynı renk kodu (çapraz kontrol; gri ±%0,05 = A yalnızca burada) ve çip direnç kodları (2–3 hane + sıfır sayısı,
 *   "R" ondalık işareti, EIA-96 tablosu): TT Electronics, "Technical Note TN004 — Methods for Marking Values on
 *   Resistors", 09.24:
 *   https://www.ttelectronics.com/TTElectronics/media/ProductFiles/Application-Note/TN004-Methods-for-Marking-Values-on-Resistors.pdf
 * - EIA-96 kod tablosu (01 → 100 … 96 → 976) ve çarpan harfleri (Z 10⁻³, Y 10⁻², X 10⁻¹, A 10⁰ … F 10⁵):
 *   Bourns, "CR Series — Thick Film Chip Resistors", "EIA-96 Marking for CR0603, 1 %" ve "Multipliers":
 *   https://www.bourns.com/docs/product-datasheets/cr.pdf
 *   Harf çelişkisi: TT TN004 "S or Y" = ×0,01, "R or X" = ×0,1, "H or B" = ×10 der; Bourns ise H = 10⁷ verir. İki
 *   kaynağın uyuştuğu Y, X, A–E ile yalnızca Bourns'un verdiği Z ve F kullanılır; R, S, H, G alınmadı (R ayrıca
 *   ondalık işaretiyle karışır). EIA-96 kod n ↔ E96 değeri eşlemesi E_SERIES.E96[n − 1] ile kurulur ve testte
 *   Bourns ile TT tablolarına karşı denetlenir.
 * - Kondansatör işareti: Vishay, "K Series — Radial Leaded MLCC", belge no. 45171, rev. 05-Sep-2025, "Marking"
 *   ("in accordance with EIA 198"): iki anlamlı hane + çarpan hanesi (1 = ×10 … 5 = ×100 000); 100 pF'tan küçükte iki
 *   hane doğrudan pF; tolerans J = %5, K = %10, M = %20. https://www.vishay.com/docs/45171/kseries.pdf
 * - Kondansatör kapasite kodu ve tolerans harfleri (sipariş kodu): KEMET C0G SMD MLCC (C1003_C0G, 2/20/2025)
 *   "Two significant digits and number of zeros. Use 9 for 1.0 – 9.9 pF, Use 8 for 0.5 – .99 pF (2.2 pF = 229,
 *   0.5 pF = 508)"; B = ±0,10 pF, C = ±0,25 pF, D = ±0,5 pF, F = ±%1, G = ±%2, J = ±%5, K = ±%10, M = ±%20:
 *   https://search.kemet.com/download/datasheet/C0805C101J5GACTU
 *   KEMET Y5V SMD MLCC (C1005_Y5V_SMD, 2/20/2025): Z = +%80/−%20:
 *   https://search.kemet.com/download/datasheet/C0805C104Z5VACTU
 *   KEMET X7R SMD MLCC (C1002_X7R, 2026-09-01) örneği "106" = 10 µF (çarpan hanesi 6).
 */
import { E_SERIES } from "../yardimci/e-serileri";

/** m · 10^e; negatif üste bölme kullanılır ki 47 / 10 = 4,7 tam en yakın double olsun. */
export function scaled(m: number, e: number): number {
  return e >= 0 ? m * 10 ** e : m / 10 ** -e;
}

// ---------------------------------------------------------------------------
// Girdi anahtarları (tanım, çözücü ve arayüz aynı adları kullanır)

export const ANAHTAR = {
  mod: "mod",
  bant: "bant",
  rakam: ["b1", "b2", "b3"],
  carpan: "carpan",
  tol: "tol",
  tcr: "tcr",
  tip: "tip",
  s3: ["s3_1", "s3_2", "s3_3"],
  s4: ["s4_1", "s4_2", "s4_3", "s4_4"],
  eiaKod: "eia_kod",
  eiaHarf: "eia_harf",
  kond: ["k1", "k2", "k3"],
  kTol: "ktol",
} as const;

export type KodMod = "renk" | "smd" | "kondansator";
export type BantSayisi = "4" | "5" | "6";
export type SmdTip = "3" | "4" | "eia96";

// ---------------------------------------------------------------------------
// Renk kodu (Vishay 20020; TT TN004)

export type Renk =
  | "siyah"
  | "kahverengi"
  | "kirmizi"
  | "turuncu"
  | "sari"
  | "yesil"
  | "mavi"
  | "mor"
  | "gri"
  | "beyaz"
  | "altin"
  | "gumus"
  | "yok";

export const RENK_ADI: Record<Renk, string> = {
  siyah: "Siyah",
  kahverengi: "Kahverengi",
  kirmizi: "Kırmızı",
  turuncu: "Turuncu",
  sari: "Sarı",
  yesil: "Yeşil",
  mavi: "Mavi",
  mor: "Mor",
  gri: "Gri",
  beyaz: "Beyaz",
  altin: "Altın",
  gumus: "Gümüş",
  yok: "Yok",
};

/** Rakam bantları: renk → rakam (siyah 0 … beyaz 9) */
export const RAKAM: Readonly<Partial<Record<Renk, number>>> = {
  siyah: 0,
  kahverengi: 1,
  kirmizi: 2,
  turuncu: 3,
  sari: 4,
  yesil: 5,
  mavi: 6,
  mor: 7,
  gri: 8,
  beyaz: 9,
};

/** Rakam renkleri, rakam sırasıyla */
export const RAKAM_RENKLERI: readonly Renk[] = ["siyah", "kahverengi", "kirmizi", "turuncu", "sari", "yesil", "mavi", "mor", "gri", "beyaz"];

/** Çarpan bandı: renk → 10 üssü (gümüş 10⁻², altın 10⁻¹, siyah 10⁰ … beyaz 10⁹) */
export const CARPAN_US: Readonly<Partial<Record<Renk, number>>> = {
  gumus: -2,
  altin: -1,
  siyah: 0,
  kahverengi: 1,
  kirmizi: 2,
  turuncu: 3,
  sari: 4,
  yesil: 5,
  mavi: 6,
  mor: 7,
  gri: 8,
  beyaz: 9,
};

/** Tolerans bandı: renk → (kesir, harf). "Yok" = bant yok (±%20). Gri ±%0,05 yalnızca TT TN004'te. */
export const TOLERANS: Readonly<Partial<Record<Renk, { tol: number; harf: string }>>> = {
  kahverengi: { tol: 0.01, harf: "F" },
  kirmizi: { tol: 0.02, harf: "G" },
  yesil: { tol: 0.005, harf: "D" },
  mavi: { tol: 0.0025, harf: "C" },
  mor: { tol: 0.001, harf: "B" },
  gri: { tol: 0.0005, harf: "A" },
  altin: { tol: 0.05, harf: "J" },
  gumus: { tol: 0.1, harf: "K" },
  yok: { tol: 0.2, harf: "M" },
};

/** 6. bant sıcaklık katsayısı (TCR): renk → ±ppm/K (SI: 1/K). Vishay 20020 "Temperature coefficient marking". */
export const TCR: Readonly<Partial<Record<Renk, number>>> = {
  kahverengi: 100e-6,
  kirmizi: 50e-6,
  sari: 25e-6,
  turuncu: 15e-6,
  mavi: 10e-6,
  mor: 5e-6,
};

// ---------------------------------------------------------------------------
// SMD direnç kodları

/** EIA-96 çarpan harfleri → 10 üssü (Bourns CR; Y, X, A–E TT TN004 ile aynı) */
export const EIA96_HARF_US: Readonly<Record<string, number>> = {
  Z: -3,
  Y: -2,
  X: -1,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
};

/** EIA-96 kodu (1–96) → E96 serisinin üç anlamlı haneli değeri (100 … 976) */
export function eia96Taban(kod: number): number {
  if (!Number.isInteger(kod) || kod < 1 || kod > 96) throw new Error(`kod-ortak: EIA-96 kodu 1–96 olmalı (${kod})`);
  return E_SERIES.E96[kod - 1];
}

/** Ondalık işareti: R (Ω), L (mΩ; Vishay 20020 "10L0 to 91L0" = 0,01–0,091 Ω) */
export type OndalikIsareti = "R" | "L";

export interface SmdDegeri {
  /** Anlamlı haneler tam sayı olarak */
  m: number;
  /** Değer = m · 10^us (Ω) */
  us: number;
  /** Kullanılan ondalık işareti; yoksa son hane çarpan (sıfır sayısı) hanesidir */
  isaret: OndalikIsareti | null;
}

/**
 * Çip direnç kodunu (3 ya da 4 karakter) çözer. Ondalık işareti yoksa son karakter sıfır sayısıdır
 * ("472" = 47·10² Ω, "4422" = 442·10² Ω); "R" ondalık virgüldür ("4R7" = 4,7 Ω, "R47" = 0,47 Ω);
 * "L" miliohm ondalık virgülüdür ("10L0" = 10,0 mΩ). Birden çok işaret ya da sonda işaret hatadır.
 */
export function smdKodDegeri(chars: readonly string[]): SmdDegeri | { hata: string } {
  const marks = chars.flatMap((c, i) => (c === "R" || c === "L" ? [i] : []));
  if (marks.length > 1) return { hata: "Kodda yalnızca bir ondalık işareti (R ya da L) olabilir." };
  if (chars.some((c) => !/^[0-9RL]$/.test(c))) return { hata: "Kod yalnızca rakam, R ve L içerebilir." };
  if (marks.length === 0) {
    const m = Number(chars.slice(0, -1).join(""));
    const us = Number(chars[chars.length - 1]);
    return { m, us, isaret: null };
  }
  const i = marks[0];
  if (i === chars.length - 1) return { hata: "Ondalık işareti kodun son karakteri olamaz." };
  const isaret = chars[i] as OndalikIsareti;
  const m = Number(chars.filter((_, j) => j !== i).join(""));
  const us = -(chars.length - 1 - i) - (isaret === "L" ? 3 : 0);
  return { m, us, isaret };
}

// ---------------------------------------------------------------------------
// Kondansatör kodu

/** Çarpan hanesi → 10 üssü (pF cinsinden). 8 = ×0,01, 9 = ×0,1 (KEMET); 7 kaynakta yok, sunulmaz. */
export const KOND_CARPAN_US: Readonly<Record<string, number>> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "8": -2,
  "9": -1,
};

export type KondTolerans =
  | { tur: "mutlak"; deger: number }
  | { tur: "oran"; deger: number }
  | { tur: "asimetrik"; arti: number; eksi: number };

/** Kondansatör tolerans harfleri (KEMET C0G ve Y5V; J/K/M Vishay 45171 ile aynı). Mutlak değerler SI (F). */
export const KOND_TOLERANS: Readonly<Record<string, KondTolerans>> = {
  B: { tur: "mutlak", deger: 0.1e-12 },
  C: { tur: "mutlak", deger: 0.25e-12 },
  D: { tur: "mutlak", deger: 0.5e-12 },
  F: { tur: "oran", deger: 0.01 },
  G: { tur: "oran", deger: 0.02 },
  J: { tur: "oran", deger: 0.05 },
  K: { tur: "oran", deger: 0.1 },
  M: { tur: "oran", deger: 0.2 },
  Z: { tur: "asimetrik", arti: 0.8, eksi: 0.2 },
};

// ---------------------------------------------------------------------------
// Tek metin kutusu: kod metni ↔ girdiler

export type KodTuru = "smd" | "kondansator";

export type KodCozumu =
  | {
      ok: true;
      /** select girdilerine yazılacak değerler (anahtar → seçenek değeri) */
      secimler: Record<string, string>;
      /** sayı girdilerine yazılacak metinler (anahtar → metin) */
      sayilar: Record<string, string>;
    }
  | { ok: false; hata: string };

const HATA = {
  bos: "Bir kod yazın.",
  smd: "Tanınmayan SMD kodu. Örnekler: 472, 4R7, R47, 4702, 10L0, 01C.",
  eiaKod: "EIA-96 kodu 01–96 arasında olmalıdır.",
  kond: "Tanınmayan kondansatör kodu (ilk hane 1–9). Örnekler: 104, 104J, 229C, 47J.",
  kondCarpan: "Çarpan hanesi 7 desteklenmiyor (kaynaklarda yok).",
} as const;

/** Kodu normalleştirir: boşlukları atar, büyük harfe çevirir. */
export function kodNormal(metin: string): string {
  return metin.replace(/\s+/g, "").toLocaleUpperCase("en-US");
}

/**
 * Metin kutusuna yazılan kodu ayrıştırır ve alttaki girdilere yazılacak değerleri döner.
 * SMD: "472", "4R7", "R47" → 3 karakter; "4702", "47R0", "R047", "10L0" → 4 karakter; "01C" → EIA-96.
 * Kondansatör: "104", "104J", "229C" ya da 100 pF'tan küçükte iki hane "47", "47J".
 */
export function kodCoz(metin: string, tur: KodTuru): KodCozumu {
  const k = kodNormal(metin);
  if (k === "") return { ok: false, hata: HATA.bos };

  if (tur === "smd") {
    const eia = /^(\d\d)([ZYXABCDEF])$/.exec(k);
    if (eia) {
      const kod = Number(eia[1]);
      if (kod < 1 || kod > 96) return { ok: false, hata: HATA.eiaKod };
      return {
        ok: true,
        secimler: { [ANAHTAR.mod]: "smd", [ANAHTAR.tip]: "eia96", [ANAHTAR.eiaHarf]: eia[2] },
        sayilar: { [ANAHTAR.eiaKod]: String(kod) },
      };
    }
    const chars = Array.from(k);
    const izinli3 = chars.length === 3 && /^[0-9R][0-9R][0-9]$/.test(k);
    const izinli4 = chars.length === 4 && /^[0-9R][0-9R][0-9RL][0-9]$/.test(k);
    if (!izinli3 && !izinli4) return { ok: false, hata: HATA.smd };
    const d = smdKodDegeri(chars);
    if ("hata" in d) return { ok: false, hata: d.hata };
    const keys = izinli3 ? ANAHTAR.s3 : ANAHTAR.s4;
    const secimler: Record<string, string> = { [ANAHTAR.mod]: "smd", [ANAHTAR.tip]: izinli3 ? "3" : "4" };
    keys.forEach((key, i) => (secimler[key] = chars[i]));
    return { ok: true, secimler, sayilar: {} };
  }

  const m = /^([1-9])(\d)(\d)?([BCDFGJKMZ])?$/.exec(k);
  if (!m) return { ok: false, hata: HATA.kond };
  const carpan = m[3] ?? "0";
  if (!(carpan in KOND_CARPAN_US)) return { ok: false, hata: HATA.kondCarpan };
  const [k1, k2, k3] = ANAHTAR.kond;
  return {
    ok: true,
    secimler: { [ANAHTAR.mod]: "kondansator", [k1]: m[1], [k2]: m[2], [k3]: carpan, [ANAHTAR.kTol]: m[4] ?? "yok" },
    sayilar: {},
  };
}

/**
 * Girdilerden kod metnini yazar (metin kutusunun gösterimi). `deger(anahtar)` girdinin güncel değeri
 * (select seçeneği ya da sayı metni); tanımsızsa boş metin döner.
 */
export function kodYaz(deger: (key: string) => string | undefined, tur: KodTuru): string {
  if (tur === "smd") {
    const tip = deger(ANAHTAR.tip);
    if (tip === "eia96") {
      const kod = Number((deger(ANAHTAR.eiaKod) ?? "").replace(",", "."));
      const harf = deger(ANAHTAR.eiaHarf) ?? "";
      if (!Number.isInteger(kod) || kod < 1 || kod > 96) return "";
      return `${String(kod).padStart(2, "0")}${harf}`;
    }
    const keys = tip === "4" ? ANAHTAR.s4 : ANAHTAR.s3;
    return keys.map((key) => deger(key) ?? "").join("");
  }
  const haneler = ANAHTAR.kond.map((key) => deger(key) ?? "").join("");
  const tol = deger(ANAHTAR.kTol);
  return tol && tol !== "yok" ? `${haneler}${tol}` : haneler;
}
