import { describe, expect, it } from "vitest";
import { loginPath, safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("aynı sitedeki yolları kabul eder", () => {
    expect(safeRedirectPath("/profil")).toBe("/profil");
    expect(safeRedirectPath("/hesap/ohm-yasasi?u=1#sonuc")).toBe("/hesap/ohm-yasasi?u=1#sonuc");
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("açık yönlendirme denemelerini reddeder", () => {
    for (const kotu of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "http:/evil.com",
      "evil.com",
      "javascript:alert(1)",
      "/\t/evil.com",
      "/\n/evil.com",
      "\t//evil.com",
      "",
      "   ",
    ]) {
      expect(safeRedirectPath(kotu), kotu).toBeNull();
    }
  });

  it("metin olmayan değerleri reddeder", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath(["/profil"])).toBeNull();
  });
});

describe("loginPath", () => {
  it("dönüş yolunu okunaklı biçimde ekler", () => {
    expect(loginPath("/profil")).toBe("/giris?yonlendir=/profil");
    expect(loginPath("/profil?sekme=tercihler")).toBe("/giris?yonlendir=/profil%3Fsekme%3Dtercihler");
  });

  it("geçersiz veya varsayılan hedefte parametre eklemez", () => {
    expect(loginPath("/")).toBe("/giris");
    expect(loginPath("//evil.com")).toBe("/giris");
    expect(loginPath(undefined)).toBe("/giris");
  });

  it("üretilen adres tekrar çözümlendiğinde aynı yolu verir", () => {
    const url = new URL(loginPath("/profil?sekme=tercihler"), "http://localhost");
    expect(safeRedirectPath(url.searchParams.get("yonlendir"))).toBe("/profil?sekme=tercihler");
  });
});
