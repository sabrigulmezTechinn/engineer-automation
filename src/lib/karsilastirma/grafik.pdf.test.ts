/**
 * Grafik SVG'sinin pdfmake (svg-to-pdfkit) ile PDF'e çizilebildiğini doğrular: yazı tipi adı (NotoSans) çözülür,
 * desteklenmeyen öğe yüzünden hata çıkmaz. Karşılaştırma raporu (işçi C) aynı SVG'yi kullanır.
 */
import { describe, expect, it } from "vitest";
import { renderPdf } from "@/lib/rapor/pdf";
import { cizgiGrafikSvg } from "./grafik";

describe("cizgiGrafikSvg → pdfmake", () => {
  it("PDF'e çizilir", async () => {
    const svg = cizgiGrafikSvg(
      {
        girdiKey: "R",
        ciktiKey: "I",
        xEtiket: "Direnç",
        yEtiket: "Akım",
        xBirim: "ohm",
        yBirim: "mA",
        xBirimSembolu: "Ω",
        yBirimSembolu: "mA",
        noktalar: [
          { x: 1, y: 12000, seviye: "hata" },
          { x: 2, y: 6000, seviye: "uyari" },
          { x: 3, y: null, seviye: "hata" },
          { x: 4, y: 3000, seviye: null },
          { x: 5, y: 2400, seviye: "ok" },
        ],
      },
      { baslik: "Akım – direnç (ölçü: µ, Ω, ğüşıöç)", genislik: 480, yukseklik: 240 },
    );
    // Not: svg-to-pdfkit, SVG metnindeki yazı tipini belgede daha önce kullanılmış (yüklenmiş) yazı tipinden alır;
    // yalnızca SVG'den oluşan bir belgede NotoSans dosyasını gerçek dosya sisteminde arar ve düşer. Raporlarda
    // grafikten önce her zaman normal metin vardır; test de bunu taklit eder.
    const pdf = await renderPdf({ content: [{ text: "Karşılaştırma raporu", fontSize: 14 }, "Değer taraması", { svg, width: 480 }] });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  }, 30_000);
});
