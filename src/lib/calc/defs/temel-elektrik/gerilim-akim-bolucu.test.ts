/**
 * Gerilim ve akım bölücü (1.3) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır (Vₒ = Vᵢ·R₂/(R₁+R₂), I₁ = I·R₂/(R₁+R₂)).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, InputState, RunResult } from "@/lib/calc/types";
import { gerilimAkimBolucu } from "./gerilim-akim-bolucu";

const ctx = defaultContext();
const voltage = (values: Record<string, number>): CalcResult => gerilimAkimBolucu.compute({ mod: "gerilim", ...values }, ctx);
const current = (values: Record<string, number>): CalcResult => gerilimAkimBolucu.compute({ mod: "akim", ...values }, ctx);

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

function expectOutputs(result: CalcResult, expected: Record<string, number>, digits = 9) {
  expect(Object.keys(result.outputs).sort()).toEqual(Object.keys(expected).sort());
  for (const [k, v] of Object.entries(expected)) expect(result.outputs[k], k).toBeCloseTo(v, digits);
}

describe("gerilim bölücü (elle hesap)", () => {
  it("yüksüz: 12 V, 10 kΩ, 5 kΩ → 4 V, 0,8 mA, P₁ = 6,4 mW, P₂ = 3,2 mW", () => {
    const r = voltage({ Vi: 12, R1: 10e3, R2: 5e3 });
    expectOutputs(r, { Vo: 4, Id: 0.8e-3, P1: 6.4e-3, P2: 3.2e-3 }, 12);
    expect(r.checks[0].message).toMatch(/yüksüz/);
  });

  it("yüklü: R_L = 5 kΩ → R₂∥R_L = 2,5 kΩ, Vₒ = 2,4 V, I₁ = 0,96 mA, I_L = 0,48 mA, P₁ = 9,216 mW, P₂ = 1,152 mW, düşüş %40", () => {
    const r = voltage({ Vi: 12, R1: 10e3, R2: 5e3, RL: 5e3 });
    expectOutputs(
      r,
      {
        Vo: 4,
        Id: 0.8e-3,
        P1: 6.4e-3,
        P2: 3.2e-3,
        R2L: 2500,
        VoL: 2.4,
        I1L: 0.96e-3,
        IL: 0.48e-3,
        P1L: 9.216e-3,
        P2L: 1.152e-3,
        dusus: 0.4,
      },
      12,
    );
    // Yük bağlanınca R₁'in gücü artar, R₂'ninki azalır; akımlar düğümde dengelenir
    expect(r.outputs.P1L).toBeGreaterThan(r.outputs.P1);
    expect(r.outputs.P2L).toBeLessThan(r.outputs.P2);
    expect(r.outputs.I1L).toBeCloseTo(r.outputs.IL + r.outputs.VoL / 5e3, 15);
    expect(r.checks[0].message).toMatch(/R₁ için yüklü/);
  });

  it("negatif giriş işareti korur, güçler pozitif kalır; Vᵢ = 0 iken düşüş atlanır", () => {
    const r = voltage({ Vi: -12, R1: 10e3, R2: 5e3 });
    expect(r.outputs.Vo).toBeCloseTo(-4, 12);
    expect(r.outputs.P1).toBeCloseTo(6.4e-3, 12);
    const z = voltage({ Vi: 0, R1: 10e3, R2: 5e3, RL: 5e3 });
    expect(z.outputs).not.toHaveProperty("dusus");
    expect(Object.is(z.outputs.Vo, -0)).toBe(false);
  });
});

describe("akım bölücü (elle hesap)", () => {
  it("10 mA, 1 kΩ ∥ 4 kΩ → I₁ = 8 mA, I₂ = 2 mA, V = 8 V", () => {
    const r = current({ I: 10e-3, R1: 1e3, R2: 4e3 });
    expectOutputs(r, { I1: 8e-3, I2: 2e-3, Vp: 8 }, 12);
    expect(r.outputs.I1 + r.outputs.I2).toBeCloseTo(10e-3, 15);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan: 12 V, 10 kΩ, 4,7 kΩ → 3,837 V (12·4,7/14,7)", () => {
    const r = ok(runCalc(gerilimAkimBolucu, defaultState(gerilimAkimBolucu)));
    expect(r.result.outputs.Vo).toBeCloseTo((12 * 4.7) / 14.7, 12);
    expect(r.outputs.find((o) => o.key === "Id")).toMatchObject({ unit: "uA" });
  });

  it("varsayılan dışı birimler: 24 V, 1 MΩ, 100 000 Ω, R_L = 1 MΩ → 2,1818 V yüksüz, 2 V yüklü", () => {
    const state: InputState = {
      mod: { value: "gerilim" },
      Vi: { value: "24", unit: "V" },
      R1: { value: "1", unit: "Mohm" },
      R2: { value: "100000", unit: "ohm" },
      RL: { value: "1", unit: "Mohm" },
    };
    const r = ok(runCalc(gerilimAkimBolucu, state));
    // 24·0,1/1,1 = 2,1818 V; R₂∥R_L = 1/11 MΩ → 24·(1/11)/(1 + 1/11) = 24/12 = 2 V
    expect(r.result.outputs.Vo).toBeCloseTo(24 / 11, 12);
    expect(r.result.outputs.R2L).toBeCloseTo(1e6 / 11, 6);
    expect(r.result.outputs.VoL).toBeCloseTo(2, 12);
  });

  it("akım bölücü, varsayılan dışı birimler: 0,5 A, 10 Ω ∥ 40 Ω → 0,4 A ve 0,1 A", () => {
    const state: InputState = {
      mod: { value: "akim" },
      I: { value: "0,5", unit: "A" },
      R1: { value: "10", unit: "ohm" },
      R2: { value: "0,04", unit: "kohm" },
    };
    const r = ok(runCalc(gerilimAkimBolucu, state));
    expect(r.result.outputs.I1).toBeCloseTo(0.4, 12);
    expect(r.result.outputs.I2).toBeCloseTo(0.1, 12);
    expect(r.result.outputs).not.toHaveProperty("Vo");
  });

  it("akım modunda gizli Vᵢ ve R_L yok sayılır; R = 0 alan hatası verir", () => {
    const s = defaultState(gerilimAkimBolucu);
    const r = ok(runCalc(gerilimAkimBolucu, { ...s, mod: { value: "akim" }, Vi: { value: "x", unit: "V" }, RL: { value: "1", unit: "kohm" } }));
    expect(r.inputsSI).not.toHaveProperty("Vi");
    expect(r.inputsSI).not.toHaveProperty("RL");
    const bad = runCalc(gerilimAkimBolucu, { ...s, R2: { value: "0", unit: "kohm" } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fieldErrors)).toEqual(["R2"]);
  });
});

describe("adımlar", () => {
  it("yüksüz çıkış gerilimi adımı değerlerle yazılır", () => {
    expect(voltage({ Vi: 12, R1: 10e3, R2: 5e3 }).steps[0].latex).toBe(
      "V_o = V_i \\cdot \\frac{R_2}{R_1 + R_2} = 12\\,\\mathrm{V} \\cdot \\frac{5\\,\\mathrm{k}\\Omega}{10\\,\\mathrm{k}\\Omega + 5\\,\\mathrm{k}\\Omega} = 4\\,\\mathrm{V}",
    );
  });

  it("tüm modların adımları ve formüller KaTeX strict'ten geçer", () => {
    for (const f of gerilimAkimBolucu.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    const results = [
      voltage({ Vi: 12, R1: 10e3, R2: 5e3, RL: 5e3 }),
      voltage({ Vi: -5, R1: 1, R2: 1e6, RL: 0.1 }),
      current({ I: -2e-3, R1: 1e3, R2: 2.2e3 }),
    ];
    for (const r of results) {
      expect(r.steps.length).toBeGreaterThan(0);
      for (const s of r.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });
});
