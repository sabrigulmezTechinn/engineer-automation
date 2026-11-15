import katex from "katex";
import { cx } from "@/components/ui/cx";

/*
 * LaTeX formül gösterimi. "use client" içermez ve hook kullanmaz: sunucu bileşenlerinde de,
 * istemci bileşenlerinin içinde de (ör. hesap formundaki ara adımlar) aynı şekilde çalışır.
 * LaTeX kaynakları hesap tanımlarından gelir (kullanıcı girdisi değildir); KaTeX çıktıyı ayrıca kaçışlar.
 */

/** Aynı formülü her tuş vuruşunda yeniden derlememek için küçük bir önbellek. */
const cache = new Map<string, string | null>();
const CACHE_LIMIT = 500;

/** LaTeX'i HTML'e çevirir; çözümlenemezse null döner. */
export function renderLatex(latex: string, displayMode = false): string | null {
  const key = `${displayMode ? "d" : "i"}|${latex}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let html: string | null;
  try {
    html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      // Türkçe karakterli alt simgeler (ör. I_{kç}) için konsola uyarı basma.
      strict: "ignore",
      output: "htmlAndMathml",
    });
    // throwOnError: false iken tamamen çözümlenemeyen ifade "katex-error" olarak döner.
    if (html.includes('class="katex-error"')) html = null;
  } catch {
    // throwOnError yalnızca ayrıştırma hatalarını kapsar; diğer hatalar da kaynağı göstermeye düşer.
    html = null;
  }

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, html);
  return html;
}

export interface FormulaProps {
  latex: string;
  /** Blok (ortalanmış, büyük) gösterim. Varsayılan: satır içi. */
  displayMode?: boolean;
  className?: string;
}

export function Formula({ latex, displayMode = false, className }: FormulaProps) {
  const html = renderLatex(latex, displayMode);

  if (html === null) {
    // Hatalı LaTeX: kaynağı olduğu gibi göster ki içerik kaybolmasın.
    return (
      <code
        className={cx(
          "rounded bg-hata-bg px-1.5 py-0.5 font-mono text-[0.85em] text-hata",
          displayMode && "block w-fit max-w-full overflow-x-auto whitespace-pre",
          className,
        )}
        title="Formül gösterilemedi"
        data-formula-error=""
      >
        {latex}
      </code>
    );
  }

  if (displayMode) {
    return (
      <div
        className={cx("formula-display max-w-full overflow-x-auto overflow-y-hidden py-1", className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
