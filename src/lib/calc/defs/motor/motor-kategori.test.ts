/**
 * Motor kategorisinin genel denetimi (gerçek birim sistemiyle). all-calcs.test.ts yalnız varsayılan
 * durumu dener; burada her hesabın TÜM select kombinasyonları varsayılan sayılarla çalıştırılır ve
 * adımlar, formüller, girdi/çıktı sembolleri KaTeX strict'ten geçirilir.
 */
import { describe, expect, it } from "vitest";
import { defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcDefinition, InputState, SelectInputSpec } from "@/lib/calc/types";
import { MOTOR } from ".";

/** Tüm select girdilerinin değer kombinasyonları (gizli olanlar da dahil; motor onları yok sayar). */
function selectCombos(def: CalcDefinition): InputState[] {
  const selects = def.inputs.filter((i): i is SelectInputSpec => i.kind === "select");
  let combos: InputState[] = [{}];
  for (const s of selects) {
    combos = combos.flatMap((c) => s.options.map((o) => ({ ...c, [s.key]: { value: o.value } })));
  }
  return combos;
}

describe("motor kategorisi", () => {
  it("KAPSAM 3.1–3.5 kayıtlı", () => {
    expect(MOTOR.map((d) => d.id).sort()).toEqual(["3.1", "3.2", "3.3", "3.4", "3.5"]);
    for (const d of MOTOR) expect(d.category).toBe("motor");
  });

  describe.each(MOTOR.map((d) => [`${d.id} ${d.slug}`, d] as const))("%s", (_name, def) => {
    it("her select kombinasyonunda varsayılan sayılarla geçerli sonuç ve strict KaTeX adımlar", () => {
      for (const combo of selectCombos(def)) {
        const label = JSON.stringify(combo);
        const r = runCalc(def, { ...defaultState(def), ...combo });
        if (!r.ok) throw new Error(`${label}: ${JSON.stringify(r)}`);
        expect(r.result.checks.filter((c) => c.level === "hata"), label).toEqual([]);
        expect(r.outputs.length, label).toBeGreaterThan(0);
        expect(r.result.steps.length, label).toBeGreaterThan(0);
        for (const s of r.result.steps) expect(() => renderStrict(s.latex), `${label} ${s.latex}`).not.toThrow();
      }
    });

    it("formüller ve semboller strict KaTeX'ten geçer", () => {
      for (const f of def.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
      for (const spec of [...def.inputs, ...def.outputs]) {
        if (spec.symbol) expect(() => renderStrict(spec.symbol as string), spec.symbol).not.toThrow();
      }
    });

    it("compute'un döndürdüğü her çıktı tanımlı ve her tanımlı çıktı en az bir kombinasyonda üretilir", () => {
      const produced = new Set<string>();
      for (const combo of selectCombos(def)) {
        const r = runCalc(def, { ...defaultState(def), ...combo });
        if (!r.ok) continue;
        for (const k of Object.keys(r.result.outputs)) produced.add(k);
      }
      // 3.5'te geri ödeme yalnızca fiyat farkıyla üretilir (varsayılanda var)
      expect([...produced].sort()).toEqual(def.outputs.map((o) => o.key).sort());
    });
  });
});
