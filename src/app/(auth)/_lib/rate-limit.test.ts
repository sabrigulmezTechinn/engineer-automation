import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter, rateLimitMessage } from "./rate-limit";

describe("createRateLimiter", () => {
  const rule = { max: 3, windowSeconds: 60 };

  it("pencere içinde sınırı aşan isteği reddeder, pencere bitince yeniden izin verir", () => {
    let t = 1_000_000;
    const limiter = createRateLimiter({ enabled: true, now: () => t });
    expect(limiter.check("giris:1.2.3.4:a@b.co", rule)).toEqual({ ok: true });
    expect(limiter.check("giris:1.2.3.4:a@b.co", rule)).toEqual({ ok: true });
    expect(limiter.check("giris:1.2.3.4:a@b.co", rule)).toEqual({ ok: true });
    t += 15_000;
    expect(limiter.check("giris:1.2.3.4:a@b.co", rule)).toEqual({ ok: false, retryAfterSeconds: 45 });
    // Farklı anahtar etkilenmez
    expect(limiter.check("giris:1.2.3.4:c@d.co", rule)).toEqual({ ok: true });
    t += 45_000;
    expect(limiter.check("giris:1.2.3.4:a@b.co", rule)).toEqual({ ok: true });
  });

  it("devre dışıyken her isteğe izin verir", () => {
    const limiter = createRateLimiter({ enabled: false });
    for (let i = 0; i < 10; i++) expect(limiter.check("x", rule).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("x-forwarded-for'daki ilk adresi, yoksa x-real-ip'i kullanır", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" }))).toBe("10.0.0.1");
    expect(clientIp(new Headers({ "x-real-ip": "10.0.0.3" }))).toBe("10.0.0.3");
    expect(clientIp(new Headers())).toBe("bilinmiyor");
  });
});

it("rateLimitMessage Türkçe ve süre içerir", () => {
  expect(rateLimitMessage(30)).toBe("Çok fazla deneme yaptınız. Lütfen 30 saniye sonra tekrar deneyin.");
});
