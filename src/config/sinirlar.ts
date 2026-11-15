/**
 * Yönetmelik ve standart sınır değerleri (KAPSAM §5.4).
 * Bu değerler değişebilir; hesap kodunun içine gömülmez, `ctx.limits` ile okunur.
 * Her kategori kendi dosyasında (src/config/sinir/<kategori>.ts) tutulur; değerler SI'dır ve
 * yanlarında kaynakları yazılır. Yeni kategori dosyası eklendiğinde buraya da eklenir.
 */
import { MEKATRONIK_AKISKAN_SINIRLARI } from "./sinir/mekatronik-akiskan";
import { MEKATRONIK_TAHRIK_SINIRLARI } from "./sinir/mekatronik-tahrik";
import { MOTOR_SINIRLARI } from "./sinir/motor";
import { OTOMASYON_SINIRLARI } from "./sinir/otomasyon";
import { TEMEL_ELEKTRIK_SINIRLARI } from "./sinir/temel-elektrik";
import { TESISAT_GUC_SINIRLARI } from "./sinir/tesisat-guc";
import { TESISAT_KABLO_SINIRLARI } from "./sinir/tesisat-kablo";

export const LIMITS = {
  temelElektrik: TEMEL_ELEKTRIK_SINIRLARI,
  motor: MOTOR_SINIRLARI,
  otomasyon: OTOMASYON_SINIRLARI,
  tesisatKablo: TESISAT_KABLO_SINIRLARI,
  tesisatGuc: TESISAT_GUC_SINIRLARI,
  mekatronikTahrik: MEKATRONIK_TAHRIK_SINIRLARI,
  mekatronikAkiskan: MEKATRONIK_AKISKAN_SINIRLARI,
} as const;

export type Limits = typeof LIMITS;
