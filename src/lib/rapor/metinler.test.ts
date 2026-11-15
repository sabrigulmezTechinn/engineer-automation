/**
 * Rapor metinleri sitedekilerle tutarlı mı; tarih biçimi; dosya adları; yedek yazı tipi parçalama.
 */
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as disclaimer from "@/components/disclaimer";
import { asciiDosyaAdi, dosyaAdiniCoz, pdfContentDisposition } from "./dosya-adi";
import { KISA_SORUMLULUK_REDDI, PLATFORM_ADI, TAM_SORUMLULUK_REDDI, TELIF_NOTU, tarihBicimle } from "./metinler";
import { metin, YEDEK_FONT, yedekFontMu } from "./pdf";

function duzMetin(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

describe("metinler — sitedekilerle tutarlılık", () => {
  it("kısa sorumluluk reddi ve telif notu disclaimer.tsx'tekiyle aynı", () => {
    expect(KISA_SORUMLULUK_REDDI).toBe(disclaimer.KISA_SORUMLULUK_REDDI);
    expect(TELIF_NOTU).toBe(disclaimer.TELIF_NOTU);
  });

  it("tam sorumluluk reddi hesap sayfasındaki DisclaimerBox paragrafıyla aynı", () => {
    const kutu = duzMetin(renderToStaticMarkup(createElement(disclaimer.DisclaimerBox)));
    expect(kutu).toContain(TAM_SORUMLULUK_REDDI);
    expect(kutu).toContain(TELIF_NOTU);
  });

  it("platform adı site başlığındaki SITE_NAME ile aynı", () => {
    const kaynak = fs.readFileSync(path.join(process.cwd(), "src/components/site/site-header.tsx"), "utf8");
    expect(/SITE_NAME = "([^"]+)"/.exec(kaynak)?.[1]).toBe(PLATFORM_ADI);
  });
});

describe("tarihBicimle", () => {
  it("Türkçe ay adı ve İstanbul saati (UTC+3); gece yarısını geçince gün de değişir", () => {
    expect(tarihBicimle("2026-11-15T21:30:00Z")).toBe("16 Kasım 2026 00:30");
    expect(tarihBicimle("2026-11-15T20:59:00.000Z")).toBe("15 Kasım 2026 23:59");
    expect(tarihBicimle("2026-01-01T09:05:00Z")).toBe("1 Ocak 2026 12:05");
    expect(tarihBicimle("2026-08-31T21:00:00Z")).toBe("1 Eylül 2026 00:00");
  });

  it("geçersiz tarihte metni olduğu gibi döner", () => {
    expect(tarihBicimle("bozuk")).toBe("bozuk");
  });
});

describe("dosya adları", () => {
  it("ASCII-güvenli ad: Türkçe harfler sadeleşir, diğerleri '-'", () => {
    expect(asciiDosyaAdi("Gerilim düşümü — Pano 3")).toBe("Gerilim-dusumu-Pano-3");
    expect(asciiDosyaAdi("İĞÜŞÖÇ ığüşöç")).toBe("IGUSOC-igusoc");
    expect(asciiDosyaAdi("Crème brûlée")).toBe("Creme-brulee");
    expect(asciiDosyaAdi("../../etc/passwd")).toBe("etc-passwd");
    expect(asciiDosyaAdi("")).toBe("rapor");
    expect(asciiDosyaAdi("😀😀")).toBe("rapor");
    expect(asciiDosyaAdi("a".repeat(200))).toHaveLength(80);
  });

  it("Content-Disposition: attachment, ASCII filename ve RFC 5987 filename*", () => {
    const d = pdfContentDisposition("Ölçüm (1) 'son'*");
    expect(d.startsWith("attachment; ")).toBe(true);
    expect(d).toContain('filename="Olcum-1-son.pdf"');
    expect(d).toContain("filename*=UTF-8''%C3%96l%C3%A7%C3%BCm%20%281%29%20%27son%27.pdf");
    // Başlık enjeksiyonu yok: satır sonu, tırnak ve ters bölü atılır
    const kotu = pdfContentDisposition('a"\r\nX-Kotu: 1\\b');
    expect(kotu).not.toMatch(/[\r\n]/);
    expect(kotu.match(/"/g)).toHaveLength(2);
    expect(kotu).toMatch(/^[\x20-\x7e]+$/);
  });

  it("istemci dosya adını önce filename*'dan çözer", () => {
    expect(dosyaAdiniCoz(pdfContentDisposition("Gerilim düşümü — Pano 3"))).toBe("Gerilim düşümü — Pano 3.pdf");
    expect(dosyaAdiniCoz('attachment; filename="duz.pdf"')).toBe("duz.pdf");
    expect(dosyaAdiniCoz("attachment; filename*=UTF-8''%E0%A4%A; filename=\"yedek.pdf\"")).toBe("yedek.pdf");
    expect(dosyaAdiniCoz(null)).toBeNull();
    expect(dosyaAdiniCoz("inline")).toBeNull();
  });
});

describe("metin — yedek yazı tipi parçalama", () => {
  it("Noto Sans'ta olmayan ok/matematik karakterleri yedek yazı tipine geçer", () => {
    expect(metin("Türkçe ğüşıöç Ω µ²")).toBe("Türkçe ğüşıöç Ω µ²");
    expect(metin("I_b ≤ I_n → ok")).toEqual(["I_b ", { text: "≤", font: YEDEK_FONT }, " I_n ", { text: "→", font: YEDEK_FONT }, " ok"]);
    expect(metin("≥≈")).toEqual([{ text: "≥≈", font: YEDEK_FONT }]);
    expect(metin("")).toBe("");
  });

  it("yedek blokları", () => {
    for (const ch of "→↔≤≥≈∥√∑⌀") expect(yedekFontMu(ch), ch).toBe(true);
    for (const ch of "aİğΩµ°×−·…%‰") expect(yedekFontMu(ch), ch).toBe(false);
  });
});
