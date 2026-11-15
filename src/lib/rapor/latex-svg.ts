/**
 * LaTeX → SVG (MathJax 4, NewCM yazı tipi). Yalnızca sunucuda kullanılır (PDF raporları).
 *
 * - SVG'ler yol (path) olarak üretilir (`fontCache: "none"`): PDF'e gömülürken yazı tipi gerekmez.
 * - NewCM yazı tipinin bazı karakter aralıkları (ör. \text{Ölçülen} içindeki Latin genişletilmiş harfler)
 *   dinamik modüllerdir; `mathjax.asyncLoad` ile içe aktarılır ve `handleRetriesFor` ile beklenir.
 *   Bu yüzden paket next.config.ts'te `serverExternalPackages` içindedir (Node çözümlemesi gerekir).
 * - Hatalı LaTeX istisna fırlatmaz; MathJax `merror` düğümü üretir. `hata: true` ile bildirilir.
 */
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";

export interface LatexSvg {
  /** Tam <svg> metni; renkler siyaha sabitlenmiştir */
  svg: string;
  /** Genişlik ve yükseklik, ex biriminde (MathJax ölçüsü) */
  widthEx: number;
  heightEx: number;
  /** MathJax LaTeX'i işleyemedi (merror) */
  hata: boolean;
}

type MathDocument = ReturnType<typeof mathjax.document>;
let cached: { doc: MathDocument; adaptor: ReturnType<typeof liteAdaptor> } | undefined;

function engine() {
  if (!cached) {
    mathjax.asyncLoad = (name: string) => import(/* webpackIgnore: true */ name);
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const doc = mathjax.document("", {
      InputJax: new TeX({ packages: ["base", "ams"] }),
      OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: "none" }),
    });
    cached = { doc, adaptor };
  }
  return cached;
}

function exAttr(svg: string, name: "width" | "height"): number {
  const m = new RegExp(`${name}="([\\d.]+)ex"`).exec(svg);
  return m ? Number(m[1]) : 0;
}

/** LaTeX'i SVG'ye çevirir. `display` blok formül (varsayılan) veya satır içi. */
export async function latexToSvg(latex: string, display = true): Promise<LatexSvg> {
  const { doc, adaptor } = engine();
  const node = await mathjax.handleRetriesFor(() => doc.convert(latex, { display }));
  const raw = adaptor.innerHTML(node);
  const svg = raw.replace(/currentColor/g, "#000000");
  return {
    svg,
    widthEx: exAttr(svg, "width"),
    heightEx: exAttr(svg, "height"),
    hata: /data-mjx-error|<g[^>]*data-mml-node="merror"/.test(raw),
  };
}
