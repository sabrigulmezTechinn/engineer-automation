import type { CalcDefinition, Reference } from "@/lib/calc/types";
import { compareKapsamId } from "@/components/calc/kapsam";

/** Bir standardın bir hesapta kullanımı */
export interface StandardUsage {
  calc: CalcDefinition;
  reference: Reference;
}

/** Standartlar sayfasında bir satır: standart ve onu kullanan hesaplar */
export interface StandardGroup {
  standard: string;
  title?: string;
  anchor: string;
  usages: StandardUsage[];
}

const TR_ASCII: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i̇: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

function normalizeStandard(standard: string): string {
  return standard.trim().replace(/\s+/g, " ");
}

/** Standart numarasından sayfa içi bağlantı kimliği: "IEC 60364-5-52" → "std-iec-60364-5-52". */
export function standardAnchor(standard: string): string {
  const slug = normalizeStandard(standard)
    .toLocaleLowerCase("tr")
    .replace(/i̇|[çğıöşü]/g, (ch) => TR_ASCII[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `std-${slug || "kaynak"}`;
}

/**
 * Tüm hesapların referanslarını standarda göre gruplar (KAPSAM §3.6).
 * Aynı standart farklı yazımlarla (büyük/küçük harf, boşluk, noktalama) geçse de tek grupta toplanır:
 * gruplama anahtarı bağlantı kimliğinin kendisidir, böylece her grubun kimliği de benzersiz olur.
 * Gruplar standart numarasına göre doğal sırada, kullanımlar KAPSAM numarasına göre sıralanır.
 */
export function groupReferencesByStandard(calcs: readonly CalcDefinition[]): StandardGroup[] {
  const groups = new Map<string, StandardGroup>();

  for (const calc of calcs) {
    for (const reference of calc.references) {
      const standard = normalizeStandard(reference.standard);
      if (!standard) continue;
      // Not: toLocaleLowerCase("tr") "IEC"i "ıec" yapar; anahtar bu yüzden ASCII'ye katlanmış kimliktir.
      const anchor = standardAnchor(standard);
      let group = groups.get(anchor);
      if (!group) {
        group = { standard, title: reference.title, anchor, usages: [] };
        groups.set(anchor, group);
      } else if (!group.title && reference.title) {
        group.title = reference.title;
      }
      group.usages.push({ calc, reference });
    }
  }

  const sorted = [...groups.values()].sort((a, b) =>
    a.standard.localeCompare(b.standard, "tr", { numeric: true, sensitivity: "base" }),
  );
  for (const group of sorted) group.usages.sort((a, b) => compareKapsamId(a.calc.id, b.calc.id));
  return sorted;
}

/** Madde ve notu tek satırda birleştirir: "Ek G · Tablo G.1 ile". */
export function referenceDetail(reference: Reference): string | undefined {
  const parts = [reference.clause, reference.note].filter((p): p is string => Boolean(p?.trim()));
  return parts.length ? parts.join(" · ") : undefined;
}
