/**
 * GEÇİCİ: Faz 2 PDF yolu denemesi (pdfmake + MathJax SVG + Noto Sans). Faz 2 raporları gelince silinir.
 */
import type { Content } from "pdfmake/interfaces";
import { latexToSvg } from "@/lib/rapor/latex-svg";
import { exToPt, renderPdf } from "@/lib/rapor/pdf";
import { formatQuantity } from "@/lib/units";

const FORMULLER = [
  "I = \\frac{V}{R} = \\frac{12\\,\\mathrm{V}}{2{,}2\\,\\mathrm{k}\\Omega} = 5{,}455\\,\\mathrm{mA}",
  "V = \\sqrt{P \\cdot R} = \\sqrt{50\\,\\mathrm{W} \\cdot 2\\,\\Omega} = 10\\,\\mathrm{V}",
  "C = 1{,}5\\,\\mu\\mathrm{F} = 1{,}5 \\times 10^{-6}\\,\\mathrm{F}",
  "\\text{Ölçülen değer: } 12\\,340\\,\\mathrm{W}",
];

export async function GET() {
  const formuller: Content[] = [];
  for (const f of FORMULLER) {
    const s = await latexToSvg(f);
    formuller.push({ svg: s.svg, width: exToPt(s.widthEx, 11), margin: [0, 4, 0, 4] });
  }
  const buf = await renderPdf({
    pageSize: "A4",
    pageMargins: [40, 50, 40, 50],
    content: [
      { text: "PDF denemesi — Mühendislik Hesapları", bold: true, fontSize: 16 },
      { text: "Türkçe: ğüşıöçİ ĞÜŞÖÇ · Semboller: Ω µ ² · ×10⁻⁶ ° ‰", margin: [0, 8, 0, 0] },
      { text: `Binlik ayırıcı (U+202F): ${formatQuantity(12340, "W")} · ${formatQuantity(17786.5612, "TL")}`, margin: [0, 4, 0, 8] },
      ...formuller,
      { text: "İtalik metin: Sorumluluk reddi örneği.", italics: true, margin: [0, 8, 0, 0] },
    ],
  });
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="deneme.pdf"' },
  });
}
