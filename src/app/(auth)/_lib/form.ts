/**
 * Form yardımcıları: Server Action durum tipi, FormData okuma, zod hatalarını alan bazında
 * toplama ve better-auth hata kodlarını Türkçe mesajlara çevirme.
 * Saf modül: veritabanına veya Next.js istek API'lerine dokunmaz.
 */
import * as z from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/db/user-fields";

/** Alan adı → hata mesajları */
export type FieldErrors<K extends string = string> = Partial<Record<K, string[]>>;

/**
 * `useActionState` ile kullanılan ortak form durumu.
 * `values`: hata durumunda formu yeniden doldurmak için gönderilen değerler (şifreler hariç);
 * React 19 form eylemi bittikten sonra formu sıfırladığı için gereklidir.
 */
export interface FormState<K extends string = string> {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors<K>;
  values?: Partial<Record<K, string>>;
}

export const initialFormState: FormState = { status: "idle" };

/** FormData'dan kırpılmış metin okur (yoksa ""). */
export function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** FormData'dan şifre okur (kırpılmaz: baştaki/sondaki boşluk şifrenin parçası olabilir). */
export function formPassword(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** zod hatasını alan bazında mesaj listesine çevirir. */
export function fieldErrorsOf<K extends string>(error: z.ZodError): FieldErrors<K> {
  return z.flattenError(error).fieldErrors as FieldErrors<K>;
}

/** Bir alanın ilk hata mesajı */
export function firstError<K extends string>(errors: FieldErrors<K> | undefined, key: K): string | undefined {
  return errors?.[key]?.[0];
}

const GENEL_HATA = "Beklenmeyen bir hata oluştu. Lütfen biraz sonra tekrar deneyin.";

/** better-auth hata kodu → kullanıcıya gösterilecek Türkçe mesaj */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-posta adresi veya şifre hatalı.",
  EMAIL_NOT_VERIFIED:
    "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzdaki doğrulama bağlantısını açın ya da aşağıdan yeni bir bağlantı isteyin.",
  INVALID_EMAIL: "Geçerli bir e-posta adresi girin.",
  PASSWORD_TOO_SHORT: `Şifre en az ${PASSWORD_MIN} karakter olmalıdır.`,
  PASSWORD_TOO_LONG: `Şifre en fazla ${PASSWORD_MAX} karakter olabilir.`,
  INVALID_TOKEN: "Bağlantı geçersiz ya da daha önce kullanılmış. Lütfen yeni bir bağlantı isteyin.",
  TOKEN_EXPIRED: "Bağlantının süresi dolmuş. Lütfen yeni bir bağlantı isteyin.",
  USER_NOT_FOUND: "Bu bilgilere ait bir hesap bulunamadı.",
  USER_ALREADY_EXISTS: "Bu e-posta adresiyle zaten bir hesap var.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Bu e-posta adresiyle zaten bir hesap var.",
  FAILED_TO_CREATE_USER: "Hesap oluşturulamadı. Lütfen tekrar deneyin.",
  FAILED_TO_UPDATE_USER: "Bilgileriniz kaydedilemedi. Lütfen tekrar deneyin.",
  FAILED_TO_CREATE_SESSION: "Oturum açılamadı. Lütfen tekrar deneyin.",
  SESSION_EXPIRED: "Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Bu hesap için şifreyle giriş tanımlı değil.",
};

/**
 * better-auth'un fırlattığı hatayı Türkçe mesaja çevirir. `VALIDATION_ERROR` mesajları zaten
 * Türkçedir (src/db/user-fields.ts doğrulayıcıları). Bilinmeyen hatalar sunucu günlüğüne yazılır.
 */
export function authErrorMessage(error: unknown): string {
  const apiError = error as { status?: unknown; statusCode?: unknown; body?: { code?: unknown; message?: unknown } };
  const code = typeof apiError?.body?.code === "string" ? apiError.body.code : undefined;
  if (code === "VALIDATION_ERROR" && typeof apiError.body?.message === "string") {
    return apiError.body.message;
  }
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  if (apiError?.statusCode === 429 || apiError?.status === "TOO_MANY_REQUESTS") {
    return "Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin.";
  }
  console.error("[kimlik doğrulama] Beklenmeyen hata:", error);
  return GENEL_HATA;
}

/** Hata koduna erişim (ör. EMAIL_NOT_VERIFIED için özel arayüz) */
export function authErrorCode(error: unknown): string | undefined {
  const code = (error as { body?: { code?: unknown } })?.body?.code;
  return typeof code === "string" ? code : undefined;
}
