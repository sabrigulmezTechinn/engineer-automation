/** Koşullu sınıf adlarını birleştirir: cx("a", koşul && "b") → "a b". */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
