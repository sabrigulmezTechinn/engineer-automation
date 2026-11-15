/**
 * Hesap kayıt defteri. İmzalar sözleşmedir; W2 doldurur ve pilot hesabı (1.1) ekler.
 * Yeni hesaplar `src/lib/calc/defs/<kategori>/<slug>.ts` altında tanımlanır ve buraya eklenir.
 */
import type { CalcDefinition, CategoryId, CategoryMeta } from "./types";

const TODO = (name: string): never => {
  throw new Error(`calc.${name}: henüz uygulanmadı (W2)`);
};

export const CATEGORIES: CategoryMeta[] = [];

export function allCalcs(): CalcDefinition[] {
  return TODO("allCalcs");
}

export function getCalc(slug: string): CalcDefinition | undefined {
  return TODO(`getCalc(${slug})`);
}

export function calcsByCategory(category: CategoryId): CalcDefinition[] {
  return TODO(`calcsByCategory(${category})`);
}
