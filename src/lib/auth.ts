/**
 * Kimlik doğrulama (better-auth 1.7) — yalnızca sunucuda içe aktarılır.
 *
 * - E-posta + şifre; e-posta doğrulanmadan oturum açılamaz.
 * - Kayıtta doğrulama e-postası gönderilir; bağlantı açılınca oturum da açılır.
 * - Şifre sıfırlama e-postayla yapılır; sıfırlamada kullanıcının diğer oturumları kapatılır.
 * - `nextCookies` eklentisi, Server Action'larda `auth.api.*` çağrılarının Set-Cookie
 *   başlıklarını Next.js çerez deposuna aktarır (giriş/çıkış çerezleri böyle yazılır).
 *
 * Gerekli ortam değişkenleri: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL (.env.example).
 */
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { PASSWORD_MAX, PASSWORD_MIN, userAdditionalFields } from "@/db/user-fields";
import { dogrulamaEpostasi, mevcutHesapEpostasi, sendEmail, sifreSifirlamaEpostasi } from "@/lib/email";

/** E-posta doğrulama bağlantısı açıldıktan sonra yönlendirilecek sayfa */
export const EMAIL_VERIFIED_PATH = "/e-posta-dogrulandi";
/** Şifre sıfırlama bağlantısı açıldıktan sonra (token ile) yönlendirilecek sayfa */
export const RESET_PASSWORD_PATH = "/sifre-sifirla";

/** E-postalardaki mutlak bağlantılar için uygulamanın kök adresi */
function appUrl(yol: string): string {
  const kok = (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${kok}${yol}`;
}

export const auth = betterAuth({
  appName: "Mühendislik Hesaplama Platformu",
  database: drizzleAdapter(db, {
    provider: "pg",
    // Anahtarlar better-auth model adlarıdır (user, session, account, verification).
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN,
    maxPasswordLength: PASSWORD_MAX,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(sifreSifirlamaEpostasi({ to: user.email, ad: user.name, url }));
    },
    // Kayıtlı e-postayla tekrar kayıt denenirse form yine "e-postanızı kontrol edin" der
    // (numaralandırma koruması); hesap sahibine durumu bu e-postayla bildiririz.
    onExistingUserSignUp: async ({ user }) => {
      await sendEmail(
        mevcutHesapEpostasi({
          to: user.email,
          ad: user.name,
          girisUrl: appUrl("/giris"),
          sifremiUnuttumUrl: appUrl("/sifremi-unuttum"),
        }),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(dogrulamaEpostasi({ to: user.email, ad: user.name, url }));
    },
  },
  user: {
    additionalFields: userAdditionalFields,
  },
  telemetry: { enabled: false },
  // nextCookies her zaman en sonda olmalı (kendinden sonraki eklentilerin çerezlerini göremez).
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];
