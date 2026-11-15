/**
 * dB dönüşümleri (1.7) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır: 10·log₁₀2 = 3,0103 dB; 10^(3/10) = 1,99526; 20·log₁₀10 = 20 dB;
 * 1 mW = 0 dBm, 1 W = 30 dBm; 1 V = 0 dBV = 120 dBµV; 10 mV = −40 dBV = 80 dBµV.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, InputState, RunResult } from "@/lib/calc/types";
import { dbDonusumleri as calc, type DbMod } from "./db-donusumleri";

const ctx = defaultContext();
const compute = (mod: DbMod, values: Record<string, number>): CalcResult => calc.compute({ mod, ...values }, ctx);

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

describe("oranlar (elle hesap)", () => {
  it("güç oranı → dB: 2 → 3,0103 dB; 10 → 10 dB; 0,5 → −3,0103 dB; 1 → 0 dB", () => {
    expect(compute("guc-db", { oranP: 2 }).outputs.L).toBeCloseTo(3.0103, 4);
    expect(compute("guc-db", { oranP: 10 }).outputs.L).toBeCloseTo(10, 12);
    expect(compute("guc-db", { oranP: 0.5 }).outputs.L).toBeCloseTo(-3.0103, 4);
    expect(Object.is(compute("guc-db", { oranP: 1 }).outputs.L, 0)).toBe(true);
  });

  it("gerilim oranı → dB: 10 → 20 dB; 2 → 6,0206 dB; eşit empedans notu verilir", () => {
    const r = compute("gerilim-db", { oranV: 10 });
    expect(r.outputs).toEqual({ L: expect.closeTo(20, 12) });
    expect(compute("gerilim-db", { oranV: 2 }).outputs.L).toBeCloseTo(6.0206, 4);
    expect(r.checks[0].message).toMatch(/aynı empedans/);
  });

  it("dB → güç oranı: 3 dB ≈ 2 kat (1,99526); −20 dB → 0,01", () => {
    expect(compute("db-guc", { Lp: 3 }).outputs.oranP).toBeCloseTo(1.99526, 5);
    expect(compute("db-guc", { Lp: -20 }).outputs.oranP).toBeCloseTo(0.01, 15);
  });

  it("dB → gerilim oranı: 20 dB → 10; 6 dB → 1,99526", () => {
    expect(compute("db-gerilim", { Lv: 20 }).outputs.oranV).toBeCloseTo(10, 12);
    expect(compute("db-gerilim", { Lv: 6 }).outputs.oranV).toBeCloseTo(1.99526, 5);
  });

  it("dönüşümler birbirinin tersidir", () => {
    for (const x of [1e-6, 0.37, 1, 42, 1e9]) {
      const L = compute("guc-db", { oranP: x }).outputs.L;
      expect(compute("db-guc", { Lp: L }).outputs.oranP / x).toBeCloseTo(1, 12);
      const Lv = compute("gerilim-db", { oranV: x }).outputs.L;
      expect(compute("db-gerilim", { Lv }).outputs.oranV / x).toBeCloseTo(1, 12);
    }
  });
});

describe("referanslı seviyeler (elle hesap)", () => {
  it("güç → dBm: 1 mW = 0 dBm, 1 W = 30 dBm, 1 µW = −30 dBm", () => {
    expect(compute("guc-dbm", { P: 1e-3 }).outputs).toEqual({ dBm: 0 });
    expect(compute("guc-dbm", { P: 1 }).outputs.dBm).toBeCloseTo(30, 12);
    expect(compute("guc-dbm", { P: 1e-6 }).outputs.dBm).toBeCloseTo(-30, 12);
  });

  it("dBm → güç: 0 dBm = 1 mW, 30 dBm = 1 W, 43 dBm ≈ 19,95 W", () => {
    expect(compute("dbm-guc", { Ldbm: 0 }).outputs.P).toBeCloseTo(1e-3, 15);
    expect(compute("dbm-guc", { Ldbm: 30 }).outputs.P).toBeCloseTo(1, 12);
    expect(compute("dbm-guc", { Ldbm: 43 }).outputs.P).toBeCloseTo(19.9526, 4);
  });

  it("gerilim → dBV ve dBµV: 1 V → 0 / 120; 10 mV → −40 / 80; 1 µV → −120 / 0", () => {
    const one = compute("gerilim-dbv", { U: 1 });
    expect(one.outputs).toEqual({ dBV: 0, dBuV: expect.closeTo(120, 12) });
    const ten = compute("gerilim-dbv", { U: 10e-3 });
    expect(ten.outputs.dBV).toBeCloseTo(-40, 12);
    expect(ten.outputs.dBuV).toBeCloseTo(80, 12);
    const micro = compute("gerilim-dbv", { U: 1e-6 });
    expect(micro.outputs.dBV).toBeCloseTo(-120, 12);
    expect(micro.outputs.dBuV).toBeCloseTo(0, 12);
    expect(one.checks[0].message).toMatch(/empedans/);
  });

  it("dBV → gerilim: −20 dBV = 0,1 V = 100 dBµV; dBµV → gerilim: 60 dBµV = 1 mV = −60 dBV", () => {
    const v = compute("dbv-gerilim", { Ldbv: -20 });
    expect(v.outputs.U).toBeCloseTo(0.1, 15);
    expect(v.outputs.dBuV).toBeCloseTo(100, 12);
    const u = compute("dbuv-gerilim", { Ldbuv: 60 });
    expect(u.outputs.U).toBeCloseTo(1e-3, 15);
    expect(u.outputs.dBV).toBeCloseTo(-60, 12);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan: güç oranı 2 → 3,01 dB", () => {
    const r = ok(runCalc(calc, defaultState(calc)));
    expect(r.outputs).toHaveLength(1);
    expect(r.outputs[0]).toMatchObject({ key: "L", unit: "dB" });
    expect(r.outputs[0].value).toBeCloseTo(3.0103, 4);
  });

  it("her mod varsayılan değerleriyle geçerli sonuç verir", () => {
    const mod = calc.inputs.find((i) => i.key === "mod");
    if (mod?.kind !== "select") throw new Error("mod select olmalı");
    for (const { value } of mod.options) {
      const r = ok(runCalc(calc, { ...defaultState(calc), mod: { value } }));
      expect(r.outputs.length, value).toBeGreaterThan(0);
      for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });

  it("varsayılan dışı birimler: 1 W → 30 dBm; 0,001 W → 0 dBm; 1 µV → 0 dBµV; dBm seviyesi dB birimiyle, dBm etiketiyle", () => {
    const s = defaultState(calc);
    const w = ok(runCalc(calc, { ...s, mod: { value: "guc-dbm" }, P: { value: "1", unit: "W" } }));
    expect(w.result.outputs.dBm).toBeCloseTo(30, 12);
    expect(w.outputs[0]).toMatchObject({ unit: "dB", label: expect.stringContaining("dBm") });
    const mw = ok(runCalc(calc, { ...s, mod: { value: "guc-dbm" }, P: { value: "0,001", unit: "W" } }));
    expect(mw.result.outputs.dBm).toBeCloseTo(0, 12);
    const uv = ok(runCalc(calc, { ...s, mod: { value: "gerilim-dbv" }, U: { value: "1", unit: "uV" } }));
    expect(uv.result.outputs.dBuV).toBeCloseTo(0, 12);
  });

  it("dBm → güç sonucu otomatik birimle gösterilir: 20 dBm → 100 mW", () => {
    const r = ok(runCalc(calc, { ...defaultState(calc), mod: { value: "dbm-guc" } }));
    expect(r.outputs[0]).toMatchObject({ key: "P", unit: "mW" });
    expect(r.outputs[0].value).toBeCloseTo(100, 9);
  });

  it("sıfır/negatif oran, güç, gerilim ve ±300 dB dışı seviye alan hatası verir", () => {
    const s = defaultState(calc);
    const cases: [string, InputState][] = [
      ["oranP", { ...s, oranP: { value: "0", unit: "unitless" } }],
      ["oranP", { ...s, oranP: { value: "-2", unit: "unitless" } }],
      ["oranV", { ...s, mod: { value: "gerilim-db" }, oranV: { value: "0", unit: "unitless" } }],
      ["P", { ...s, mod: { value: "guc-dbm" }, P: { value: "0", unit: "mW" } }],
      ["U", { ...s, mod: { value: "gerilim-dbv" }, U: { value: "-1", unit: "V" } }],
      ["Lp", { ...s, mod: { value: "db-guc" }, Lp: { value: "301", unit: "dB" } }],
      ["Ldbm", { ...s, mod: { value: "dbm-guc" }, Ldbm: { value: "-301", unit: "dB" } }],
    ];
    for (const [key, state] of cases) {
      const r = runCalc(calc, state);
      expect(r.ok, `${key} ${state[key].value}`).toBe(false);
      if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual([key]);
    }
  });
});

describe("adımlar", () => {
  it("referanslı seviye adımlarında birim dBm / dBV / dBµV olarak yazılır", () => {
    expect(compute("guc-dbm", { P: 1 }).steps[0].latex).toBe(
      "L_{\\mathrm{dBm}} = 10 \\log_{10}\\frac{P}{1\\,\\mathrm{mW}} = 10 \\log_{10}\\frac{1\\,\\mathrm{W}}{1\\,\\mathrm{mW}} = 30\\,\\mathrm{dBm}",
    );
    const v = compute("gerilim-dbv", { U: 1 }).steps.map((s) => s.latex);
    expect(v[0]).toMatch(/= 0\\,\\mathrm\{dBV\}$/);
    expect(v[1]).toMatch(/= 120\\,\\mathrm\{dB\\mu V\}$/);
  });

  it("uç değerlerde adımlar ve formüller KaTeX strict'ten geçer", () => {
    for (const f of calc.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    const cases: [DbMod, Record<string, number>][] = [
      ["guc-db", { oranP: 1e-12 }],
      ["gerilim-db", { oranV: 3.3e7 }],
      ["db-guc", { Lp: -300 }],
      ["db-gerilim", { Lv: 0.00001 }],
      ["dbm-guc", { Ldbm: 300 }],
      ["dbv-gerilim", { Ldbv: -300 }],
      ["dbuv-gerilim", { Ldbuv: 0 }],
    ];
    for (const [mod, v] of cases) {
      const r = compute(mod, v);
      for (const out of Object.values(r.outputs)) expect(Number.isFinite(out)).toBe(true);
      for (const s of r.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });
});
