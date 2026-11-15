/**
 * pdfmake ile PDF üretimi (yalnızca sunucu). Yazı tipi Noto Sans (SIL OFL 1.1, fonts/OFL.txt);
 * Türkçe harfleri, Ω, µ, üst simge rakamları ve binlik ayırıcı U+202F'yi içerir. ∑ ve √ içermez:
 * bu karakterler düz metinde değil, SVG formüllerde kullanılmalıdır.
 *
 * Yazı tipleri pdfmake'in sanal dosya sistemine yüklenir; URL ve yerel dosya erişimi kapalıdır.
 */
import fs from "node:fs";
import path from "node:path";
import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

const FONT_DIR = path.join(process.cwd(), "src/lib/rapor/fonts");
const FONT_FILES = {
  normal: "NotoSans-Regular.ttf",
  bold: "NotoSans-Bold.ttf",
  italics: "NotoSans-Italic.ttf",
  bolditalics: "NotoSans-Bold.ttf",
} as const;

/** pdfmake 0.3 çalışma anında `virtualfs` sunar; @types/pdfmake 0.3.3 bunu tanımlamaz. */
const vfs = (pdfmake as unknown as { virtualfs: { writeFileSync(name: string, data: Buffer): void } }).virtualfs;

let ready = false;

function setup(): void {
  if (ready) return;
  for (const file of new Set(Object.values(FONT_FILES))) {
    vfs.writeFileSync(file, fs.readFileSync(path.join(FONT_DIR, file)));
  }
  pdfmake.setFonts({ NotoSans: { ...FONT_FILES } });
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(() => false);
  ready = true;
}

/** Belge tanımından PDF baytları üretir; varsayılan yazı tipi Noto Sans. */
export async function renderPdf(doc: TDocumentDefinitions): Promise<Buffer> {
  setup();
  const output = pdfmake.createPdf({
    ...doc,
    defaultStyle: { font: "NotoSans", fontSize: 10, ...doc.defaultStyle },
  });
  return output.getBuffer();
}

/** MathJax ex ölçüsünü punto genişliğine çevirir (1 ex ≈ 0,442 em, NewCM). */
export function exToPt(ex: number, fontSize: number): number {
  return ex * 0.442 * fontSize;
}
