/**
 * Server Action'lar için basit hız sınırlayıcı (bellek içi, sabit pencere).
 *
 * Neden gerekli: better-auth'un kendi hız sınırlaması yalnızca /api/auth/* HTTP isteklerinde
 * çalışır; Server Action'lardan yapılan `auth.api.*` çağrıları onu atlar. Bu sınırlayıcı giriş,
 * kayıt ve e-posta gönderen eylemleri kaba kuvvet ve e-posta yağmuruna karşı korur.
 *
 * better-auth'un varsayılanı gibi yalnızca üretimde (NODE_ENV=production) etkindir.
 * Sınırlama: tek sunucu süreci içindir; birden çok örnekte paylaşılan bir depo (ör. Redis) gerekir.
 */

export interface RateLimitRule {
  /** Pencere içinde izin verilen en fazla istek */
  max: number;
  /** Pencere süresi (saniye) */
  windowSeconds: number;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Eylem başına kurallar */
export const AUTH_RATE_LIMITS = {
  /** IP + e-posta başına: tek hesaba kaba kuvvet denemesini yavaşlatır */
  signIn: { max: 5, windowSeconds: 60 },
  /** IP başına */
  signUp: { max: 5, windowSeconds: 60 },
  /** IP + e-posta başına: aynı adrese e-posta yağmurunu engeller */
  sendEmail: { max: 3, windowSeconds: 60 },
  /** IP başına */
  resetPassword: { max: 10, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export function createRateLimiter({ enabled, now = Date.now }: { enabled: boolean; now?: () => number }) {
  const buckets = new Map<string, { count: number; start: number; windowMs: number }>();

  function sweep(t: number) {
    for (const [key, b] of buckets) if (t - b.start >= b.windowMs) buckets.delete(key);
  }

  return {
    check(key: string, rule: RateLimitRule): RateLimitResult {
      if (!enabled) return { ok: true };
      const t = now();
      const windowMs = rule.windowSeconds * 1000;
      if (buckets.size > 10_000) sweep(t);

      const bucket = buckets.get(key);
      if (!bucket || t - bucket.start >= windowMs) {
        buckets.set(key, { count: 1, start: t, windowMs });
        return { ok: true };
      }
      if (bucket.count >= rule.max) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.start + windowMs - t) / 1000)) };
      }
      bucket.count++;
      return { ok: true };
    },
  };
}

export const authRateLimiter = createRateLimiter({ enabled: process.env.NODE_ENV === "production" });

/** İstemci IP'si (ters vekil başlıklarından; yoksa "bilinmiyor"). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "bilinmiyor";
}

export function rateLimitMessage(retryAfterSeconds: number): string {
  return `Çok fazla deneme yaptınız. Lütfen ${retryAfterSeconds} saniye sonra tekrar deneyin.`;
}
