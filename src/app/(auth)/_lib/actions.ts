"use server";
/**
 * Kimlik doğrulama Server Action'ları. better-auth'u sunucuda `auth.api.*` ile çağırır;
 * oturum çerezlerini `nextCookies` eklentisi yazar. `redirect()` try/catch dışında çağrılır
 * (Next.js yönlendirmeyi bir istisna fırlatarak yapar).
 *
 * `auth.api.*` çağrıları better-auth'un hız sınırlamasını atladığı için her eylem
 * `authRateLimiter` ile ayrıca sınırlanır (bkz. ./rate-limit.ts).
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, EMAIL_VERIFIED_PATH, RESET_PASSWORD_PATH } from "@/lib/auth";
import {
  authErrorCode,
  authErrorMessage,
  fieldErrorsOf,
  formPassword,
  formText,
  type FormState,
} from "./form";
import { AUTH_RATE_LIMITS, authRateLimiter, clientIp, rateLimitMessage, type RateLimitRule } from "./rate-limit";
import { DEFAULT_AFTER_LOGIN, safeRedirectPath } from "./redirect";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordField,
  type ResetPasswordField,
  type SignInField,
  type SignUpField,
} from "./validation";

/** Hız sınırı aşıldıysa kullanıcıya gösterilecek mesajı, aşılmadıysa `null` döner. */
function rateLimited(requestHeaders: Headers, eylem: string, rule: RateLimitRule, email?: string): string | null {
  const key = [eylem, clientIp(requestHeaders), email?.toLowerCase()].filter(Boolean).join(":");
  const result = authRateLimiter.check(key, rule);
  return result.ok ? null : rateLimitMessage(result.retryAfterSeconds);
}

/* ----------------------------------------------------------------------------------------------
 * Kayıt
 * -------------------------------------------------------------------------------------------- */

export type SignUpState = FormState<SignUpField> & { email?: string };

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const values = {
    name: formText(formData, "name"),
    email: formText(formData, "email"),
    company: formText(formData, "company"),
    jobTitle: formText(formData, "jobTitle"),
  };
  const parsed = signUpSchema.safeParse({
    ...values,
    password: formPassword(formData, "password"),
    passwordConfirm: formPassword(formData, "passwordConfirm"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lütfen işaretli alanları düzeltin.",
      fieldErrors: fieldErrorsOf<SignUpField>(parsed.error),
      values,
    };
  }

  const { name, email, password, company, jobTitle } = parsed.data;
  const requestHeaders = await headers();
  const limitMessage = rateLimited(requestHeaders, "kayit", AUTH_RATE_LIMITS.signUp);
  if (limitMessage) return { status: "error", message: limitMessage, values };

  try {
    await auth.api.signUpEmail({
      headers: requestHeaders,
      body: {
        name,
        email,
        password,
        // Boş bırakılan isteğe bağlı alanlar gönderilmez (veritabanında NULL kalır).
        ...(company ? { company } : {}),
        ...(jobTitle ? { jobTitle } : {}),
        callbackURL: EMAIL_VERIFIED_PATH,
      },
    });
  } catch (error) {
    const code = authErrorCode(error);
    const message = authErrorMessage(error);
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      return { status: "error", fieldErrors: { password: [message] }, values };
    }
    if (code === "INVALID_EMAIL") {
      return { status: "error", fieldErrors: { email: [message] }, values };
    }
    return { status: "error", message, values };
  }

  // Not: e-posta zaten kayıtlıysa better-auth da başarılı yanıt verir (hesap varlığı sızdırılmaz);
  // hesap sahibine ayrıca bilgilendirme e-postası gider.
  return { status: "success", email };
}

/* ----------------------------------------------------------------------------------------------
 * Giriş
 * -------------------------------------------------------------------------------------------- */

export type SignInState = FormState<SignInField> & {
  /** E-posta doğrulanmamışsa: "tekrar gönder" formunda kullanılacak adres */
  unverifiedEmail?: string;
};

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const values = { email: formText(formData, "email") };
  const parsed = signInSchema.safeParse({ ...values, password: formPassword(formData, "password") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf<SignInField>(parsed.error), values };
  }

  const requestHeaders = await headers();
  const limitMessage = rateLimited(requestHeaders, "giris", AUTH_RATE_LIMITS.signIn, parsed.data.email);
  if (limitMessage) return { status: "error", message: limitMessage, values };

  try {
    await auth.api.signInEmail({
      headers: requestHeaders,
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: formData.get("rememberMe") === "on",
      },
    });
  } catch (error) {
    const message = authErrorMessage(error);
    if (authErrorCode(error) === "EMAIL_NOT_VERIFIED") {
      return { status: "error", message, values, unverifiedEmail: parsed.data.email };
    }
    return { status: "error", message, values };
  }

  redirect(safeRedirectPath(formData.get("yonlendir")) ?? DEFAULT_AFTER_LOGIN);
}

/* ----------------------------------------------------------------------------------------------
 * Doğrulama e-postasını tekrar gönder
 * -------------------------------------------------------------------------------------------- */

export type ResendVerificationState = FormState<"email">;

export async function resendVerificationAction(
  _prev: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  const values = { email: formText(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf<"email">(parsed.error), values };
  }
  const requestHeaders = await headers();
  const limitMessage = rateLimited(requestHeaders, "dogrulama", AUTH_RATE_LIMITS.sendEmail, parsed.data.email);
  if (limitMessage) return { status: "error", message: limitMessage, values };

  try {
    await auth.api.sendVerificationEmail({
      headers: requestHeaders,
      body: { email: parsed.data.email, callbackURL: EMAIL_VERIFIED_PATH },
    });
  } catch (error) {
    return { status: "error", message: authErrorMessage(error), values };
  }
  return {
    status: "success",
    message: `Hesabınız henüz doğrulanmamışsa ${parsed.data.email} adresine yeni bir doğrulama bağlantısı gönderdik.`,
    values,
  };
}

/* ----------------------------------------------------------------------------------------------
 * Şifremi unuttum
 * -------------------------------------------------------------------------------------------- */

export type ForgotPasswordState = FormState<ForgotPasswordField>;

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const values = { email: formText(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf<ForgotPasswordField>(parsed.error), values };
  }
  const requestHeaders = await headers();
  const limitMessage = rateLimited(requestHeaders, "sifremi-unuttum", AUTH_RATE_LIMITS.sendEmail, parsed.data.email);
  if (limitMessage) return { status: "error", message: limitMessage, values };

  try {
    await auth.api.requestPasswordReset({
      headers: requestHeaders,
      body: { email: parsed.data.email, redirectTo: RESET_PASSWORD_PATH },
    });
  } catch (error) {
    return { status: "error", message: authErrorMessage(error), values };
  }
  // Hesap olsun ya da olmasın aynı yanıt (hesap varlığı sızdırılmaz).
  return {
    status: "success",
    message: `${parsed.data.email} adresiyle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderdik. Bağlantı 1 saat geçerlidir.`,
    values,
  };
}

/* ----------------------------------------------------------------------------------------------
 * Şifre sıfırlama (e-postadaki bağlantıdan gelen token ile)
 * -------------------------------------------------------------------------------------------- */

export type ResetPasswordState = FormState<ResetPasswordField>;

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formText(formData, "token"),
    password: formPassword(formData, "password"),
    passwordConfirm: formPassword(formData, "passwordConfirm"),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf<ResetPasswordField>(parsed.error);
    return { status: "error", message: fieldErrors.token?.[0], fieldErrors };
  }
  const requestHeaders = await headers();
  const limitMessage = rateLimited(requestHeaders, "sifre-sifirla", AUTH_RATE_LIMITS.resetPassword);
  if (limitMessage) return { status: "error", message: limitMessage };

  try {
    await auth.api.resetPassword({
      headers: requestHeaders,
      body: { token: parsed.data.token, newPassword: parsed.data.password },
    });
  } catch (error) {
    const code = authErrorCode(error);
    const message = authErrorMessage(error);
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      return { status: "error", fieldErrors: { password: [message] } };
    }
    return { status: "error", message };
  }
  return {
    status: "success",
    message: "Şifreniz güncellendi. Güvenliğiniz için açık oturumlarınız kapatıldı; yeni şifrenizle giriş yapabilirsiniz.",
  };
}
