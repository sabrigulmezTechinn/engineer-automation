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
import { latexToSvg } from "@/lib/rapor/latex-svg";
import { renderStrict } from "./test-utils/katex";
import type { CalcDefinition, InputState, SelectInputSpec } from "./types";

const calcs = allCalcs();

const KOMBINASYON_MAX = 512;

/** Verilen select girdilerinin tüm değer kombinasyonları (en fazla KOMBINASYON_MAX). */
function product(selects: SelectInputSpec[]): InputState[] {
  let combos: InputState[] = [{}];
  for (const input of selects) {
    const next: InputState[] = [];
    for (const c of combos) for (const o of input.options) next.push({ ...c, [input.key]: { value: o.value } });
    combos = next.slice(0, KOMBINASYON_MAX);
  }
  return combos;
}

/**
 * Select girdilerinin denenecek kombinasyonları; her biri InputState parçası.
 * Tam çarpım KOMBINASYON_MAX'ı aşmıyorsa hepsi. Aşıyorsa (ör. renk bandı seçimleri) kesip ilk seçimleri
 * yitirmek yerine: görünürlüğü yöneten select'lerin (visibleWhen'de adı geçen) tam çarpımı ve bunların her
 * birinde geri kalan her select'in her seçeneği tek tek (diğerleri varsayılanda).
 */
function selectCombinations(def: CalcDefinition): InputState[] {
  const selects = def.inputs.filter((i): i is SelectInputSpec => i.kind === "select");
  const total = selects.reduce((n, s) => n * s.options.length, 1);
  if (total <= KOMBINASYON_MAX) return product(selects);

  const controllerKeys = new Set(def.inputs.flatMap((i) => (i.visibleWhen ? [i.visibleWhen.key] : [])));
  const controllers = selects.filter((s) => controllerKeys.has(s.key));
  const others = selects.filter((s) => !controllerKeys.has(s.key));
  const combos: InputState[] = [];
  for (const base of product(controllers)) {
    combos.push(base);
    for (const s of others) for (const o of s.options) combos.push({ ...base, [s.key]: { value: o.value } });
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

  it("formüller, tüm seçim kombinasyonlarının adımları ve semboller PDF'teki MathJax'ten hatasız geçer", async () => {
    const adimlar = new Set<string>();
    for (const combo of selectCombinations(def)) {
      const r = runCalc(def, { ...defaultState(def), ...combo });
      if (r.ok) for (const s of r.result.steps) adimlar.add(s.latex);
    }
    const latexler = new Set([
      ...def.formulas.map((f) => f.latex),
      ...adimlar,
      ...[...def.inputs, ...def.outputs].flatMap((s) => (s.symbol ? [s.symbol] : [])),
    ]);
    for (const latex of latexler) {
      const svg = await latexToSvg(latex);
      expect(svg.hata, latex).toBe(false);
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
