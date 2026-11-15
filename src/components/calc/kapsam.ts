import type { CalcDefinition, CategoryId, CategoryMeta } from "@/lib/calc/types";

/**
 * KAPSAM numaralarını sayısal olarak karşılaştırır: "4.2" < "4.10".
 * (Metin sıralaması "4.10"u "4.2"den önce koyardı.)
 */
export function compareKapsamId(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (Number.isNaN(x) || Number.isNaN(y)) return a.localeCompare(b, "tr", { numeric: true });
    if (x !== y) return x - y;
  }
  return 0;
}

/** Hesapları KAPSAM numarasına göre sıralanmış yeni bir dizi olarak döner. */
export function sortByKapsamId<T extends Pick<CalcDefinition, "id">>(calcs: readonly T[]): T[] {
  return [...calcs].sort((a, b) => compareKapsamId(a.id, b.id));
}

/** Kategori kimliğinden kategori bilgisine. */
export function categoryMeta(
  categories: readonly CategoryMeta[],
  id: CategoryId,
): CategoryMeta | undefined {
  return categories.find((c) => c.id === id);
}
