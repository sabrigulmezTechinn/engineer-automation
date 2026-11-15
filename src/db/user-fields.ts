/**
 * Kullanıcı profil alanları ve varsayılan tercihler (KAPSAM §3.1).
 *
 * Tek kaynak burasıdır: Drizzle şeması (sütun varsayılanları), better-auth `user.additionalFields`
 * (sunucu tarafı doğrulama) ve formlar (seçenek listeleri) bu sabitleri kullanır.
 * Bu dosya veritabanına bağlanmaz; istemci bileşenlerinde de içe aktarılabilir.
 */
import type { DBFieldAttribute } from "better-auth";
import * as z from "zod";

/** Birim sistemi seçenekleri */
export const UNIT_SYSTEMS = [
  { value: "si", label: "SI (metrik)" },
  { value: "imperial", label: "İngiliz (imperial)" },
] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number]["value"];
export const UNIT_SYSTEM_VALUES = UNIT_SYSTEMS.map((s) => s.value) as [UnitSystem, ...UnitSystem[]];

/**
 * Varsayılan standart seti seçenekleri.
 * NOT: Bu liste geçicidir; hesap motoru standart setlerini tanımladığında buradan güncellenmelidir.
 * Veritabanında serbest metin olarak saklandığı için yeni değer eklemek migration gerektirmez.
 */
export const STANDARD_SETS = [
  { value: "iec", label: "IEC (uluslararası)" },
  { value: "ts", label: "TS / TS EN (Türkiye uyarlamaları)" },
] as const;
export type StandardSet = (typeof STANDARD_SETS)[number]["value"];
export const STANDARD_SET_VALUES = STANDARD_SETS.map((s) => s.value) as [StandardSet, ...StandardSet[]];

/** Sonuçlarda gösterilecek ondalık basamak sınırları */
export const DECIMALS_MIN = 0;
export const DECIMALS_MAX = 6;

export const PREFERENCE_DEFAULTS = {
  unitSystem: "si",
  decimals: 3,
  standardSet: "iec",
} as const satisfies { unitSystem: UnitSystem; decimals: number; standardSet: StandardSet };

/** Metin alanı uzunluk sınırları */
export const NAME_MAX = 100;
export const COMPANY_MAX = 150;
export const JOB_TITLE_MAX = 100;

/** Şifre uzunluk kuralları (better-auth yapılandırması ve form doğrulaması ortak kullanır) */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/* ------------------------------------------------------------------------------------------------
 * better-auth doğrulayıcıları: `/api/auth/sign-up/email` ve `/api/auth/update-user` uç noktalarına
 * doğrudan gelen isteklerde de geçersiz değer yazılmasını engeller. Mesajlar Türkçedir.
 * ---------------------------------------------------------------------------------------------- */

const optionalText = (max: number, label: string) =>
  z
    .string({ error: `${label} metin olmalıdır.` })
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .nullable();

const companyValidator = optionalText(COMPANY_MAX, "Şirket");
const jobTitleValidator = optionalText(JOB_TITLE_MAX, "Unvan");
const unitSystemValidator = z.enum(UNIT_SYSTEM_VALUES, "Geçersiz birim sistemi.");
const decimalsValidator = z
  .number({ error: "Ondalık basamak sayı olmalıdır." })
  .int("Ondalık basamak tam sayı olmalıdır.")
  .min(DECIMALS_MIN, `Ondalık basamak en az ${DECIMALS_MIN} olabilir.`)
  .max(DECIMALS_MAX, `Ondalık basamak en fazla ${DECIMALS_MAX} olabilir.`);
const standardSetValidator = z.enum(STANDARD_SET_VALUES, "Geçersiz standart seti.");

/**
 * better-auth `user.additionalFields`. Anahtarlar Drizzle şemasındaki `user` tablosunun
 * sütun özellik adlarıyla birebir aynı olmalıdır (better-auth çalışırken şemayı karşılaştırır).
 *
 * Tercih alanları `required: true` + `defaultValue`: kayıtta gönderilmezse varsayılan yazılır,
 * okunan kullanıcı nesnesinde ise her zaman dolu (null olmayan) tiptedir.
 */
export const userAdditionalFields = {
  company: {
    type: "string",
    required: false,
    validator: { input: companyValidator },
  },
  jobTitle: {
    type: "string",
    required: false,
    validator: { input: jobTitleValidator },
  },
  unitSystem: {
    type: [...UNIT_SYSTEM_VALUES],
    required: true,
    defaultValue: PREFERENCE_DEFAULTS.unitSystem,
    validator: { input: unitSystemValidator },
  },
  decimals: {
    type: "number",
    required: true,
    defaultValue: PREFERENCE_DEFAULTS.decimals,
    validator: { input: decimalsValidator },
  },
  standardSet: {
    type: "string",
    required: true,
    defaultValue: PREFERENCE_DEFAULTS.standardSet,
    validator: { input: standardSetValidator },
  },
} satisfies Record<string, DBFieldAttribute>;
