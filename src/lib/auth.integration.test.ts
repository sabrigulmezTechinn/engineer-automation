/**
 * better-auth entegrasyon testi — GERÇEK PostgreSQL veritabanına karşı çalışır.
 *
 * Hazırlık (bir kez):
 *   scripts/db-setup.sh      # cluster'ı başlatır, kullanıcı + veritabanı oluşturur
 *   cp .env.example .env.local && (BETTER_AUTH_SECRET'ı doldurun)
 *   npm run db:migrate
 * Çalıştırma:
 *   npx vitest run src/lib/auth.integration.test.ts
 *
 * DATABASE_URL yoksa veya veritabanına ulaşılamazsa test atlanmaz, açıklayıcı bir hatayla başarısız olur.
 * Oluşturduğu kullanıcıları (benzersiz e-postalarla) sonunda siler. E-postalar geçici bir klasöre yazılır.
 */
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type AuthModule = typeof import("@/lib/auth");
type DbModule = typeof import("@/db");

let auth: AuthModule["auth"];
let dbModule: DbModule;
let mailDir: string;
const createdEmails: string[] = [];

const PASSWORD = "Gizli-Sifre-123";
const NEW_PASSWORD = "Yeni-Sifre-456";

function uniqueEmail(etiket: string) {
  const email = `entegrasyon-${etiket}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  createdEmails.push(email);
  return email;
}

interface SavedMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  links: string[];
  createdAt: string;
}

/** Geçici e-posta klasöründe alıcıya ve konuya uyan en son e-postayı bekler (en fazla ~3 sn). */
async function waitForMail(to: string, subject: string): Promise<SavedMail> {
  for (let i = 0; i < 30; i++) {
    const files = (await readdir(mailDir)).filter((f) => f.endsWith(".json")).sort();
    const mails: SavedMail[] = await Promise.all(
      files.map(async (f) => JSON.parse(await readFile(path.join(mailDir, f), "utf8")) as SavedMail),
    );
    const match = mails.filter((m) => m.to === to && m.subject === subject).at(-1);
    if (match) return match;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`E-posta bulunamadı: ${to} / "${subject}" (klasör: ${mailDir})`);
}

/** Set-Cookie başlıklarından istek için Cookie başlığı üretir. */
function cookieHeaderFrom(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** auth.api çağrısının hata kodunu döner (APIError.body.code). */
async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as { body?: { code?: string } }).body?.code ?? "BILINMEYEN_HATA";
  }
  return undefined;
}

beforeAll(async () => {
  try {
    process.loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Bu entegrasyon testi gerçek bir veritabanı gerektirir ama DATABASE_URL tanımlı değil. " +
        "Önce `scripts/db-setup.sh` çalıştırın, `.env.example`'ı `.env.local` olarak kopyalayın ve " +
        "`npm run db:migrate` ile tabloları oluşturun.",
    );
  }
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET tanımlı değil (.env.local). Üretmek için: openssl rand -base64 32");
  }

  mailDir = await mkdtemp(path.join(os.tmpdir(), "dev-mail-test-"));
  process.env.DEV_MAIL_DIR = mailDir;

  // Ortam değişkenleri yüklendikten SONRA içe aktar (statik import'lar yukarı taşınır).
  dbModule = await import("@/db");
  try {
    await dbModule.pool.query('select 1 from "user" limit 1');
  } catch (error) {
    throw new Error(
      `Veritabanına bağlanılamadı veya tablolar yok (${(error as Error).message}). ` +
        "`scripts/db-setup.sh` ve `npm run db:migrate` çalıştırın.",
    );
  }
  ({ auth } = await import("@/lib/auth"));
});

afterAll(async () => {
  if (dbModule && createdEmails.length > 0) {
    await dbModule.db.delete(dbModule.schema.user).where(inArray(dbModule.schema.user.email, createdEmails));
  }
  await dbModule?.pool.end();
  globalThis.__engineerPgPool = undefined;
  if (mailDir) await rm(mailDir, { recursive: true, force: true });
});

declare global {
  var __engineerPgPool: import("pg").Pool | undefined;
}

describe("better-auth + PostgreSQL", () => {
  it("Drizzle şeması better-auth yapılandırmasıyla uyumlu", async () => {
    const ctx = await auth.$context;
    expect(ctx.explicitSchemaCheck).toBeTypeOf("function");
    // Uyuşmazlıkta SchemaMismatchError fırlatır.
    await expect(Promise.resolve(ctx.explicitSchemaCheck!())).resolves.toBeUndefined();
  });

  it("kayıt → doğrulama e-postası → doğrulamadan giriş reddi → doğrulama → giriş → profil güncelleme", async () => {
    const email = uniqueEmail("akis");

    // Kayıt: oturum açılmaz, tercih varsayılanları yazılır.
    const signUp = await auth.api.signUpEmail({
      body: {
        name: "Ayşe Yılmaz",
        email,
        password: PASSWORD,
        company: "Örnek Mühendislik A.Ş.",
        jobTitle: "Elektrik Mühendisi",
        callbackURL: "/e-posta-dogrulandi",
      },
    });
    expect(signUp.token).toBeNull();
    expect(signUp.user.emailVerified).toBe(false);
    expect(signUp.user).toMatchObject({
      company: "Örnek Mühendislik A.Ş.",
      jobTitle: "Elektrik Mühendisi",
      unitSystem: "si",
      decimals: 3,
      standardSet: "iec",
    });

    // Doğrulama e-postası
    const mail = await waitForMail(email, "E-posta adresinizi doğrulayın");
    expect(mail.text).toContain("Merhaba Ayşe Yılmaz");
    const verifyLink = mail.links.find((l) => l.includes("/api/auth/verify-email?token="));
    expect(verifyLink).toBeDefined();
    const verifyUrl = new URL(verifyLink!);
    expect(verifyUrl.searchParams.get("callbackURL")).toBe("/e-posta-dogrulandi");

    // Doğrulanmadan giriş
    expect(await errorCode(auth.api.signInEmail({ body: { email, password: PASSWORD } }))).toBe(
      "EMAIL_NOT_VERIFIED",
    );
    // Yanlış şifrede "doğrulanmadı" bilgisi sızmaz
    expect(await errorCode(auth.api.signInEmail({ body: { email, password: "yanlis-sifre" } }))).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );

    // Bağlantıyı aç (route handler üzerinden, tarayıcının yaptığı gibi)
    const verifyResponse = await auth.handler(new Request(verifyLink!));
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers.get("location")).toBe("/e-posta-dogrulandi");
    // autoSignInAfterVerification: doğrulama oturum çerezi de yazar
    expect(cookieHeaderFrom(verifyResponse.headers)).toContain("session_token=");

    // Giriş
    const signIn = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      returnHeaders: true,
    });
    expect(signIn.response.user.emailVerified).toBe(true);
    const cookie = cookieHeaderFrom(signIn.headers);
    expect(cookie).toContain("session_token=");
    const headers = new Headers({ cookie });

    const session = await auth.api.getSession({ headers });
    expect(session?.user.email).toBe(email);

    // Profil güncelleme
    await auth.api.updateUser({
      headers,
      body: {
        name: "Ayşe Y.",
        company: "Yeni Şirket",
        jobTitle: null,
        unitSystem: "imperial",
        decimals: 5,
        standardSet: "ts",
      },
    });
    const updated = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    expect(updated?.user).toMatchObject({
      name: "Ayşe Y.",
      company: "Yeni Şirket",
      jobTitle: null,
      unitSystem: "imperial",
      decimals: 5,
      standardSet: "ts",
    });

    // Sunucu tarafı doğrulayıcılar geçersiz tercihleri Türkçe mesajla reddeder
    await expect(auth.api.updateUser({ headers, body: { decimals: 9 } })).rejects.toMatchObject({
      body: { code: "VALIDATION_ERROR", message: "Anlamlı basamak en fazla 8 olabilir." },
    });
    expect(
      await errorCode(auth.api.updateUser({ headers, body: { unitSystem: "metrik" as "si" } })),
    ).toBe("VALIDATION_ERROR");
    expect(await errorCode(auth.api.updateUser({ headers, body: { standardSet: "xyz" } }))).toBe(
      "VALIDATION_ERROR",
    );

    // Çıkış
    await auth.api.signOut({ headers });
    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it("şifre sıfırlama: e-posta bağlantısı → /sifre-sifirla?token= → yeni şifre, eski oturumlar kapanır", async () => {
    const email = uniqueEmail("sifre");
    await auth.api.signUpEmail({ body: { name: "Mehmet Kaya", email, password: PASSWORD } });
    const verifyMail = await waitForMail(email, "E-posta adresinizi doğrulayın");
    await auth.handler(new Request(verifyMail.links[0]));

    const signIn = await auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
    const oldHeaders = new Headers({ cookie: cookieHeaderFrom(signIn.headers) });
    expect(await auth.api.getSession({ headers: oldHeaders })).not.toBeNull();

    const reset = await auth.api.requestPasswordReset({ body: { email, redirectTo: "/sifre-sifirla" } });
    expect(reset.status).toBe(true);

    const mail = await waitForMail(email, "Şifre sıfırlama isteği");
    const resetLink = mail.links.find((l) => l.includes("/api/auth/reset-password/"));
    expect(resetLink).toBeDefined();

    // Bağlantı token ile /sifre-sifirla sayfasına yönlendirir
    const redirect = await auth.handler(new Request(resetLink!));
    expect(redirect.status).toBe(302);
    const location = new URL(redirect.headers.get("location")!, "http://localhost:3000");
    expect(location.pathname).toBe("/sifre-sifirla");
    const token = location.searchParams.get("token");
    expect(token).toBeTruthy();

    // Kısa şifre reddedilir
    expect(await errorCode(auth.api.resetPassword({ body: { token: token!, newPassword: "kisa" } }))).toBe(
      "PASSWORD_TOO_SHORT",
    );

    const result = await auth.api.resetPassword({ body: { token: token!, newPassword: NEW_PASSWORD } });
    expect(result.status).toBe(true);

    // Token tek kullanımlık
    expect(
      await errorCode(auth.api.resetPassword({ body: { token: token!, newPassword: NEW_PASSWORD } })),
    ).toBe("INVALID_TOKEN");
    // Eski oturum kapatıldı
    expect(await auth.api.getSession({ headers: oldHeaders })).toBeNull();
    // Eski şifre geçersiz, yeni şifre geçerli
    expect(await errorCode(auth.api.signInEmail({ body: { email, password: PASSWORD } }))).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );
    const newSignIn = await auth.api.signInEmail({ body: { email, password: NEW_PASSWORD } });
    expect(newSignIn.token).toBeTruthy();

    // Geçersiz token bağlantısı hata koduyla sayfaya döner
    const bad = await auth.handler(
      new Request("http://localhost:3000/api/auth/reset-password/gecersiz?callbackURL=%2Fsifre-sifirla"),
    );
    const badLocation = new URL(bad.headers.get("location")!, "http://localhost:3000");
    expect(badLocation.pathname).toBe("/sifre-sifirla");
    expect(badLocation.searchParams.get("error")).toBe("INVALID_TOKEN");
  });

  it("kayıtlı e-postayla tekrar kayıt aynı yanıtı verir ve hesap sahibine bilgi e-postası gider", async () => {
    const email = uniqueEmail("tekrar");
    await auth.api.signUpEmail({ body: { name: "Zeynep Demir", email, password: PASSWORD } });

    const again = await auth.api.signUpEmail({ body: { name: "Başka Biri", email, password: "baska-sifre-123" } });
    expect(again.token).toBeNull();
    const mail = await waitForMail(email, "Bu e-posta ile zaten bir hesabınız var");
    expect(mail.text).toContain("Merhaba Zeynep Demir");
    expect(mail.links.some((l) => l.endsWith("/sifremi-unuttum"))).toBe(true);
  });

  it("geçersiz kayıt girdilerini reddeder", async () => {
    expect(
      await errorCode(
        auth.api.signUpEmail({ body: { name: "Kısa", email: uniqueEmail("kisa"), password: "1234567" } }),
      ),
    ).toBe("PASSWORD_TOO_SHORT");
    expect(
      await errorCode(
        auth.api.signUpEmail({
          body: { name: "Ondalık", email: uniqueEmail("ondalik"), password: PASSWORD, decimals: 9 },
        }),
      ),
    ).toBe("VALIDATION_ERROR");
  });

  it("geçersiz doğrulama bağlantısı hata koduyla /e-posta-dogrulandi sayfasına döner", async () => {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/verify-email?token=bozuk&callbackURL=%2Fe-posta-dogrulandi"),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/e-posta-dogrulandi?error=INVALID_TOKEN");
  });
});
