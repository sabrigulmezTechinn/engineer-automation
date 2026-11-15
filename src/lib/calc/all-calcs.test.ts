/**
 * Kayıtlı HER hesap için otomatik denetim (gerçek birim sistemiyle). Yeni hesap eklendiğinde
 * ayrıca bir şey yazmadan bu testlerden geçer:
 * - varsayılan girdiler geçerli bir sonuç üretir ("hata" seviyesinde kontrol yok),
 * - formüller, ara adımlar ve girdi/çıktı sembolleri KaTeX'ten strict kipte hatasız geçer,
 * - girdi/çıktı birimleri katalogda vardır ve boyutları tutar,
 * - en az bir standart/kaynak referansı vardır.
 */
import { describe, expect, it } from "vitest";
import { getUnit } from "@/lib/units";
import { defaultState, runCalc } from "./engine";
import { allCalcs } from "./registry";
import { renderStrict } from "./test-utils/katex";
import type { CalcDefinition, InputState } from "./types";

const calcs = allCalcs();

/** Select girdilerinin tüm değer kombinasyonları (en fazla 512); her biri InputState parçası. */
function selectCombinations(def: CalcDefinition): InputState[] {
  let combos: InputState[] = [{}];
  for (const input of def.inputs) {
    if (input.kind !== "select") continue;
    const next: InputState[] = [];
    for (const c of combos) for (const o of input.options) next.push({ ...c, [input.key]: { value: o.value } });
    combos = next.slice(0, 512);
  }
  return combos;
}

describe.each(calcs.map((d) => [`${d.id} ${d.slug}`, d] as const))("%s", (_name, def) => {
  it("varsayılan girdilerle geçerli sonuç üretir", () => {
    const r = runCalc(def, defaultState(def));
    if (!r.ok) throw new Error(`varsayılan durum başarısız: ${JSON.stringify(r)}`);
    expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    expect(r.outputs.length).toBeGreaterThan(0);
  });

  it("formüller ve ara adımlar KaTeX strict'ten geçer", () => {
    for (const f of def.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    const r = runCalc(def, defaultState(def));
    if (r.ok) for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });

  it("tüm seçim kombinasyonlarında çalışır; başarılı her kombinasyonun adımları KaTeX strict'ten geçer", () => {
    const combos = selectCombinations(def);
    let okCount = 0;
    for (const combo of combos) {
      const state = { ...defaultState(def), ...combo };
      const r = runCalc(def, state);
      if (!r.ok) continue;
      okCount++;
      expect(r.result.checks.filter((c) => c.level === "hata"), JSON.stringify(combo)).toEqual([]);
      for (const s of r.result.steps) expect(() => renderStrict(s.latex), `${JSON.stringify(combo)}: ${s.latex}`).not.toThrow();
    }
    expect(okCount, "en az bir kombinasyon geçerli sonuç vermeli").toBeGreaterThan(0);
  });

  it("girdi ve çıktı sembolleri KaTeX strict'ten geçer", () => {
    for (const spec of [...def.inputs, ...def.outputs]) {
      if (spec.symbol) expect(() => renderStrict(spec.symbol as string), `${spec.key}: ${spec.symbol}`).not.toThrow();
    }
  });

  it("birimler katalogda var ve boyutları tutuyor", () => {
    for (const spec of [...def.inputs, ...def.outputs]) {
      if ("kind" in spec && spec.kind === "select") continue;
      const numeric = spec as { key: string; dimension: string; defaultUnit: string; units?: string[] };
      for (const id of [numeric.defaultUnit, ...(numeric.units ?? [])]) {
        expect(getUnit(id).dimension, `${numeric.key}: ${id}`).toBe(numeric.dimension);
      }
    }
  });

  it("en az bir referans içerir", () => {
    expect(def.references.length).toBeGreaterThan(0);
  });
});
