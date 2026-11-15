/**
 * Birim sistemi sözleşmesi.
 *
 * Her birim, ait olduğu boyutun SI birimine doğrusal bir dönüşümle bağlanır:
 *   SI değeri = değer · factor + offset
 * Yalnızca sayı içerdiği için birim tanımları serileştirilebilir ve istemcide de kullanılabilir.
 * Doğrusal olmayan dönüşümler (ör. AWG ↔ mm²) birim değil, ayrı bir hesaptır (7.1).
 */

export type Dimension =
  | "boyutsuz"
  | "oran" // yüzde, ppm gibi; SI karşılığı 1 (kesir)
  | "gerilim"
  | "akim"
  | "direnc"
  | "iletkenlik"
  | "guc" // aktif güç, W
  | "reaktif_guc" // var
  | "gorunur_guc" // VA
  | "enerji"
  | "yuk" // elektrik yükü / batarya kapasitesi, C (Ah da bu boyutta)
  | "frekans"
  | "kapasitans"
  | "enduktans"
  | "zaman"
  | "uzunluk"
  | "alan"
  | "hacim"
  | "kutle"
  | "sicaklik" // mutlak sıcaklık, K (°C, °F ofsetli)
  | "sicaklik_farki" // K (°C farkı ile aynı, ofsetsiz)
  | "basinc"
  | "kuvvet"
  | "tork"
  | "aci"
  | "acisal_hiz" // rad/s (rpm burada)
  | "hiz"
  | "ivme"
  | "acisal_ivme"
  | "debi" // hacimsel debi, m³/s
  | "atalet" // kütle atalet momenti, kg·m²
  | "ozdirenc" // Ω·m
  | "direnc_uzunluk" // birim uzunluk başına direnç, Ω/m (kablo katalogları Ω/km verir)
  | "veri_hizi" // bit/s (RS485/Modbus)
  | "para" // TL (fiziksel birim değil; maliyet hesapları için)
  | "enerji_fiyati" // kanonik TL/J; arayüzde TL/kWh
  | "seviye_db" // dB (logaritmik oran; tek birim, dönüştürülmez)
  | "isil_direnc" // K/W
  | "isi_transfer_katsayisi"; // W/(m²·K)

export interface UnitDef {
  /** Kararlı kimlik; kayıtlı hesaplarda saklanır, değiştirilmez. ör. "kV", "mm2", "rpm" */
  id: string;
  /** Gösterim sembolü, ör. "kV", "mm²", "dev/dk" */
  symbol: string;
  /** Türkçe ad, ör. "kilovolt" */
  name: string;
  dimension: Dimension;
  /** SI = değer · factor + offset */
  factor: number;
  offset?: number;
}

export interface FormatOptions {
  /** Sabit ondalık basamak sayısı. Verilmezse `significant` kullanılır. */
  decimals?: number;
  /** Anlamlı basamak sayısı (varsayılan 4). */
  significant?: number;
}
