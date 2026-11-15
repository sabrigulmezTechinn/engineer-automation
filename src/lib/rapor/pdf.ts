/**
 * pdfmake ile PDF üretimi (yalnızca sunucu). Yazı tipi Noto Sans (SIL OFL 1.1, fonts/OFL.txt);
 * Türkçe harfleri, Ω, µ, üst simge rakamları ve binlik ayırıcı U+202F'yi içerir.
 *
 * Noto Sans ok ve matematik işleç bloklarını (→ ↔ ≤ ≥ ≈ ∥ √ ∑ …) içermez. pdfmake yazı tipi yedeği
 * (fallback) yapmadığından düz metin `metin()` ile parçalanır: bu bloklardaki karakterler Noto Sans Math
 * (OFL 1.1) ile yazılır. Formüller yine SVG'dir (latex-svg.ts).
 *
 * Yazı tipleri pdfmake'in sanal dosya sistemine yüklenir; URL ve yerel dosya erişimi kapalıdır.
 */
import fs from "node:fs";
import path from "node:path";
import pdfmake from "pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

const FONT_DIR = path.join(process.cwd(), "src/lib/rapor/fonts");
const FONT_FILES = {
  normal: "NotoSans-Regular.ttf",
  bold: "NotoSans-Bold.ttf",
  italics: "NotoSans-Italic.ttf",
  bolditalics: "NotoSans-Bold.ttf",
} as const;
/** Matematik/ok karakterleri için yedek yazı tipi (tek ağırlık; kalın metinde de bu kullanılır) */
const MATH_FILE = "NotoSansMath-Regular.woff";

/** Varsayılan ve yedek yazı tipi aileleri (pdfmake `font` adları) */
export const ANA_FONT = "NotoSans";
export const YEDEK_FONT = "NotoSansMath";

/** pdfmake 0.3 çalışma anında `virtualfs` sunar; @types/pdfmake 0.3.3 bunu tanımlamaz. */
const vfs = (pdfmake as unknown as { virtualfs: { writeFileSync(name: string, data: Buffer): void } }).virtualfs;

let ready = false;

function setup(): void {
  if (ready) return;
  for (const file of new Set([...Object.values(FONT_FILES), MATH_FILE])) {
    vfs.writeFileSync(file, fs.readFileSync(path.join(FONT_DIR, file)));
  }
  pdfmake.setFonts({
    [ANA_FONT]: { ...FONT_FILES },
    [YEDEK_FONT]: { normal: MATH_FILE, bold: MATH_FILE, italics: MATH_FILE, bolditalics: MATH_FILE },
  });
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(() => false);
  ready = true;
}

/** Belge tanımından PDF baytları üretir; varsayılan yazı tipi Noto Sans. */
export async function renderPdf(doc: TDocumentDefinitions): Promise<Buffer> {
  setup();
  const output = pdfmake.createPdf({
    ...doc,
    defaultStyle: { font: ANA_FONT, fontSize: 10, ...doc.defaultStyle },
  });
  return output.getBuffer();
}

/** MathJax ex ölçüsünü punto genişliğine çevirir (1 ex ≈ 0,442 em, NewCM). */
export function exToPt(ex: number, fontSize: number): number {
  return ex * 0.442 * fontSize;
}

/**
 * Noto Sans'ta olmayan, Noto Sans Math'te olan Unicode blokları: oklar, matematik işleçleri, çeşitli teknik
 * semboller, geometrik şekiller, ek oklar/matematik sembolleri ve matematiksel harf-rakamlar.
 */
const YEDEK_ARALIKLAR: readonly (readonly [number, number])[] = [
  [0x2190, 0x23ff],
  [0x25a0, 0x25ff],
  [0x27c0, 0x27ff],
  [0x2900, 0x2aff],
  [0x1d400, 0x1d7ff],
];

/** Bu aralıklarda olup Noto Sans'ta bulunan karakterler: U+2212 eksi işareti, U+25CC noktalı daire */
const ANA_FONTTA_OLANLAR: ReadonlySet<number> = new Set([0x2212, 0x25cc]);

/** Karakter yedek yazı tipiyle mi yazılmalı */
export function yedekFontMu(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return !ANA_FONTTA_OLANLAR.has(cp) && YEDEK_ARALIKLAR.some(([a, b]) => cp >= a && cp <= b);
}

/** Yedek aralıklar (testlerde yazı tipi kapsamıyla karşılaştırmak için) */
export const YEDEK_UNICODE_ARALIKLARI = YEDEK_ARALIKLAR;

/**
 * Düz metni pdfmake satır içi parçalarına böler: yedek bloklardaki karakterler Noto Sans Math ile.
 * Yedek karakter yoksa metnin kendisi döner (pdfmake `text` alanına doğrudan verilebilir).
 */
export function metin(s: string): string | Content[] {
  const parcalar: Content[] = [];
  let tampon = "";
  let yedekTampon = "";
  const bosalt = () => {
    if (tampon) parcalar.push(tampon);
    if (yedekTampon) parcalar.push({ text: yedekTampon, font: YEDEK_FONT });
    tampon = "";
    yedekTampon = "";
  };
  for (const ch of s) {
    if (yedekFontMu(ch)) {
      if (tampon) bosalt();
      yedekTampon += ch;
    } else {
      if (yedekTampon) bosalt();
      tampon += ch;
    }
  }
  bosalt();
  if (parcalar.length === 0) return "";
  if (parcalar.length === 1 && typeof parcalar[0] === "string") return parcalar[0];
  return parcalar;
}
