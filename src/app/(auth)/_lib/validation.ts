/**
 * Kimlik doğrulama formlarının sunucu tarafı doğrulaması (zod 4, Türkçe mesajlar).
 * Girdiler `formText` ile kırpılmış olarak gelir; şifreler kırpılmaz.
 */
import * as z from "zod";
import {
  COMPANY_MAX,
  JOB_TITLE_MAX,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/db/user-fields";

export const emailField = z
  .string()
  .min(1, "E-posta adresi gerekli.")
  .pipe(z.email("Geçerli bir e-posta adresi girin."));

export const nameField = z
  .string()
  .min(1, "Ad soyad gerekli.")
  .max(NAME_MAX, `Ad soyad en fazla ${NAME_MAX} karakter olabilir.`);

export const companyField = z.string().max(COMPANY_MAX, `Şirket en fazla ${COMPANY_MAX} karakter olabilir.`);
export const jobTitleField = z.string().max(JOB_TITLE_MAX, `Unvan en fazla ${JOB_TITLE_MAX} karakter olabilir.`);

export const newPasswordField = z
  .string()
  .min(1, "Şifre gerekli.")
  .min(PASSWORD_MIN, `Şifre en az ${PASSWORD_MIN} karakter olmalıdır.`)
  .max(PASSWORD_MAX, `Şifre en fazla ${PASSWORD_MAX} karakter olabilir.`);

const passwordConfirmField = z.string().min(1, "Şifreyi tekrar girin.");

const SIFRELER_ESLESMIYOR = "Şifreler eşleşmiyor.";

export const signUpSchema = z
  .object({
    name: nameField,
    email: emailField,
    password: newPasswordField,
    passwordConfirm: passwordConfirmField,
    company: companyField,
    jobTitle: jobTitleField,
  })
  .refine((d) => !d.passwordConfirm || d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: SIFRELER_ESLESMIYOR,
  });
export type SignUpField = keyof z.input<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Şifre gerekli."),
});
export type SignInField = keyof z.input<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});
export type ForgotPasswordField = keyof z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Sıfırlama bağlantısı geçersiz. Lütfen yeni bir bağlantı isteyin."),
    password: newPasswordField,
    passwordConfirm: passwordConfirmField,
  })
  .refine((d) => !d.passwordConfirm || d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: SIFRELER_ESLESMIYOR,
  });
export type ResetPasswordField = keyof z.input<typeof resetPasswordSchema>;
