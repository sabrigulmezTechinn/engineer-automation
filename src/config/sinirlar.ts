/**
 * Yönetmelik ve standart sınır değerleri (KAPSAM §5.4).
 * Bu değerler değişebilir; hesap kodunun içine gömülmez, `ctx.limits` ile okunur.
 * Her kategori kendi dosyasında (src/config/sinir/<kategori>.ts) tutulur; değerler SI'dır ve
 * yanlarında kaynakları yazılır. Yeni kategori dosyası eklendiğinde buraya da eklenir.
 */
import { MOTOR_SINIRLARI } from "./sinir/motor";
import { OTOMASYON_SINIRLARI } from "./sinir/otomasyon";
import { TEMEL_ELEKTRIK_SINIRLARI } from "./sinir/temel-elektrik";

export const LIMITS = {
  temelElektrik: TEMEL_ELEKTRIK_SINIRLARI,
  motor: MOTOR_SINIRLARI,
  otomasyon: OTOMASYON_SINIRLARI,
} as const;

export type Limits = typeof LIMITS;
