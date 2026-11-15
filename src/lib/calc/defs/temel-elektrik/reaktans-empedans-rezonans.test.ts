/**
 * Reaktans, empedans, rezonans (1.5) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır:
 *   f = 1 kHz, L = 10 mH, C = 1 µF, R = 10 Ω →
 *   X_L = 2π·1000·0,01 = 62,832 Ω; X_C = 1/(2π·1000·10⁻⁶) = 159,155 Ω; X = −96,323 Ω;
 *   Z = √(10² + 96,323²) = 96,841 Ω; φ = −arctan(9,6323) = −84,073°;
 *   f₀ = 1/(2π·√10⁻⁸) = 1/(2π·10⁻⁴) = 1591,55 Hz; Q = √(0,01/10⁻⁶)/10 = 100/10 = 10; B = f₀/Q = 159,155 Hz.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, InputState, RunResult } from "@/lib/calc/types";
import { reaktansEmpedansRezonans as calc } from "./reaktans-empedans-rezonans";

const ctx = defaultContext();
const DEG = Math.PI / 180;
const compute = (values: Record<string, number>): CalcResult => calc.compute(values, ctx);

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

describe("compute (SI, elle hesap)", () => {
  it("tam seri RLC: f = 1 kHz, 10 mH, 1 µF, 10 Ω", () => {
    const r = compute({ f: 1000, L: 0.01, C: 1e-6, R: 10 });
    expect(Object.keys(r.outputs).sort()).toEqual(["B", "Q", "X", "XC", "XL", "Z", "f0", "phi"].sort());
    expect(r.outputs.XL).toBeCloseTo(62.832, 3);
    expect(r.outputs.XC).toBeCloseTo(159.155, 3);
    expect(r.outputs.X).toBeCloseTo(-96.323, 3);
    expect(r.outputs.Z).toBeCloseTo(96.841, 3);
    expect(r.outputs.phi / DEG).toBeCloseTo(-84.073, 3);
    expect(r.outputs.f0).toBeCloseTo(1591.55, 2);
    expect(r.outputs.Q).toBeCloseTo(10, 9);
    expect(r.outputs.B).toBeCloseTo(159.155, 3);
  });

  it("şebeke frekansında: 50 Hz, 0,1 H → X_L = 10π = 31,416 Ω; 100 µF → X_C = 100/π = 31,831 Ω", () => {
    expect(compute({ f: 50, L: 0.1 }).outputs.XL).toBeCloseTo(10 * Math.PI, 9);
    expect(compute({ f: 50, C: 100e-6 }).outputs.XC).toBeCloseTo(100 / Math.PI, 9);
  });

  it("rezonansta empedans R'ye eşit, faz açısı ~0", () => {
    const f0 = 1 / (2 * Math.PI * Math.sqrt(0.01 * 1e-6));
    const r = compute({ f: f0, L: 0.01, C: 1e-6, R: 10 });
    expect(r.outputs.Z).toBeCloseTo(10, 6);
    expect(r.outputs.phi).toBeCloseTo(0, 6);
  });

  it("yalnız C ve f: X = −X_C, Z = X_C, φ = −90°; girilmeyen L ve R kontrolde belirtilir", () => {
    const r = compute({ f: 50, C: 100e-6 });
    expect(Object.keys(r.outputs).sort()).toEqual(["X", "XC", "Z", "phi"]);
    expect(r.outputs.Z).toBeCloseTo(100 / Math.PI, 9);
    expect(r.outputs.phi / DEG).toBeCloseTo(-90, 9);
    expect(r.checks[0].message).toMatch(/L \(XL = 0\), R \(R = 0\)/);
  });

  it("seri RL: f = 50 Hz, L = 0,1 H, R = 31,416 Ω → Z = 31,416·√2, φ = 45°", () => {
    const r = compute({ f: 50, L: 0.1, R: 10 * Math.PI });
    expect(r.outputs.Z).toBeCloseTo(10 * Math.PI * Math.SQRT2, 9);
    expect(r.outputs.phi / DEG).toBeCloseTo(45, 9);
    expect(r.outputs).not.toHaveProperty("f0");
  });

  it("yalnız L ve C: f₀ = 1/(2π√LC); R yoksa Q hesaplanmaz", () => {
    const r = compute({ L: 0.01, C: 1e-6 });
    expect(Object.keys(r.outputs)).toEqual(["f0"]);
    expect(r.outputs.f0).toBeCloseTo(1591.55, 2);
    expect(r.checks).toEqual([]);
  });

  it("R = 0: Q ve B atlanır, uyarı verilir; tam rezonansta Z = 0 → faz açısı atlanır", () => {
    const q = compute({ L: 0.01, C: 1e-6, R: 0 });
    expect(q.outputs).not.toHaveProperty("Q");
    expect(q.checks).toEqual([expect.objectContaining({ level: "uyari", message: expect.stringMatching(/sonsuz/) })]);

    // f = 1/(2π), L = C = 1 → X_L = X_C = 1 Ω tam olarak
    const z = compute({ f: 1 / (2 * Math.PI), L: 1, C: 1, R: 0 });
    expect(z.outputs.Z).toBe(0);
    expect(z.outputs).not.toHaveProperty("phi");
    expect(z.checks.some((c) => c.level === "uyari" && /tanımsız/.test(c.message))).toBe(true);
  });

  it("yetersiz girdi validate'te 'hata' verir", () => {
    const insufficient: Record<string, number>[] = [{}, { f: 50 }, { f: 50, R: 10 }, { L: 0.01 }, { C: 1e-6, R: 5 }];
    for (const v of insufficient) {
      expect(calc.validate?.(v, ctx), JSON.stringify(v)).toEqual([expect.objectContaining({ level: "hata" })]);
      expect(compute(v).outputs).toEqual({});
    }
    expect(calc.validate?.({ f: 50, L: 0.1 }, ctx)).toEqual([]);
    expect(calc.validate?.({ L: 0.1, C: 1e-6 }, ctx)).toEqual([]);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan: tüm çıktılar; f₀ kHz, B Hz olarak gösterilir", () => {
    const r = ok(runCalc(calc, defaultState(calc)));
    expect(r.outputs.map((o) => o.key)).toEqual(["XL", "XC", "X", "Z", "phi", "f0", "Q", "B"]);
    expect(r.outputs.find((o) => o.key === "f0")).toMatchObject({ unit: "kHz" });
    expect(r.outputs.find((o) => o.key === "f0")?.value).toBeCloseTo(1.59155, 4);
  });

  it("varsayılan dışı birimler: 1000 Hz, 0,01 H, 1000 nF, 0,01 kΩ → aynı sonuçlar", () => {
    const state: InputState = {
      f: { value: "1000", unit: "Hz" },
      L: { value: "0,01", unit: "H" },
      C: { value: "1000", unit: "nF" },
      R: { value: "0,01", unit: "kohm" },
    };
    const r = ok(runCalc(calc, state));
    expect(r.result.outputs.XL).toBeCloseTo(62.832, 3);
    expect(r.result.outputs.XC).toBeCloseTo(159.155, 3);
    expect(r.result.outputs.Q).toBeCloseTo(10, 9);
  });

  it("boş bırakılan alanlar isteğe bağlıdır; yalnız R girilirse 'hata' döner", () => {
    const empty: InputState = {
      f: { value: "", unit: "kHz" },
      L: { value: "", unit: "mH" },
      C: { value: "", unit: "uF" },
      R: { value: "10", unit: "ohm" },
    };
    const r = runCalc(calc, empty);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].level).toBe("hata");

    const bad = runCalc(calc, { ...defaultState(calc), f: { value: "0", unit: "Hz" } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fieldErrors)).toEqual(["f"]);
  });
});

describe("adımlar", () => {
  it("reaktans adımları değerlerle yazılır", () => {
    const steps = compute({ f: 1000, L: 0.01, C: 1e-6, R: 10 }).steps;
    expect(steps[0].latex).toBe("X_L = 2\\pi f L = 2\\pi \\cdot 1\\,\\mathrm{kHz} \\cdot 10\\,\\mathrm{mH} = 62{,}83\\,\\Omega");
    expect(steps.find((s) => s.label === "Kalite faktörü")?.latex).toBe(
      "Q = \\frac{1}{R}\\sqrt{\\frac{L}{C}} = \\frac{1}{10\\,\\Omega}\\sqrt{\\frac{10\\,\\mathrm{mH}}{1\\,\\mu\\mathrm{F}}} = 10",
    );
  });

  it("tüm girdi birleşimlerinde adımlar ve formüller KaTeX strict'ten geçer", () => {
    for (const f of calc.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    const cases: Record<string, number>[] = [
      { f: 1000, L: 0.01, C: 1e-6, R: 10 },
      { f: 50, C: 100e-6 },
      { f: 50, L: 0.1, R: 0 },
      { L: 1e-9, C: 1e-12, R: 0.5 },
      { f: 1 / (2 * Math.PI), L: 1, C: 1, R: 0 },
    ];
    for (const v of cases) for (const s of compute(v).steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });
});
