/** Profil formunun sunucu tarafı doğrulaması (zod 4, Türkçe mesajlar). */
import * as z from "zod";
import { companyField, jobTitleField, nameField } from "@/app/(auth)/_lib/validation";
import { DECIMALS_MAX, DECIMALS_MIN, STANDARD_SET_VALUES, UNIT_SYSTEM_VALUES } from "@/db/user-fields";

const ONDALIK_MESAJI = `Ondalık basamak ${DECIMALS_MIN} ile ${DECIMALS_MAX} arasında bir tam sayı olmalıdır.`;

export const profileSchema = z.object({
  name: nameField,
  company: companyField,
  jobTitle: jobTitleField,
  unitSystem: z.enum(UNIT_SYSTEM_VALUES, "Bir birim sistemi seçin."),
  decimals: z
    .string()
    .regex(/^\d{1,2}$/, ONDALIK_MESAJI)
    .transform(Number)
    .pipe(z.number().int(ONDALIK_MESAJI).min(DECIMALS_MIN, ONDALIK_MESAJI).max(DECIMALS_MAX, ONDALIK_MESAJI)),
  standardSet: z.enum(STANDARD_SET_VALUES, "Bir standart seti seçin."),
});

export type ProfileField = keyof z.input<typeof profileSchema>;
