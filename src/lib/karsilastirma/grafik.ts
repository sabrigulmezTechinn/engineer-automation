/**
 * Çizgi grafik → bağımsız SVG metni (saf). Web sayfası ve PDF raporu (pdfmake svg düğümü) aynı çıktıyı kullanır.
 * İmza sözleşmedir; gövde Faz 2 işçisi B'nindir.
 *
 * Kurallar: renkler açık değerlerdir (CSS değişkeni yok; PDF'te de çizilsin), viewBox + width/height verilir,
 * metinler Noto Sans/sans-serif, eksen etiketleri birimli; uygun olmayan (uyari/hata) noktalar işaretlenir.
 */
import type { GrafikSecenekleri, TaramaSerisi } from "./types";

export function cizgiGrafikSvg(seri: TaramaSerisi, secenekler?: GrafikSecenekleri): string {
  throw new Error(
    `karsilastirma.cizgiGrafikSvg(${seri.girdiKey} → ${seri.ciktiKey}, ${JSON.stringify(secenekler)}): henüz uygulanmadı (Faz 2 işçisi B)`,
  );
}
