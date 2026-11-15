/**
 * Testler için: LaTeX'in KaTeX tarafından hatasız ve LaTeX'e sadık biçimde (strict) işlendiğini doğrular.
 * Geçersiz LaTeX'te veya matematik kipinde Unicode metin gibi uyumsuzlukta fırlatır.
 */
import katex from "katex";

export function renderStrict(latex: string): string {
  return katex.renderToString(latex, { throwOnError: true, strict: "error" });
}
