/**
 * AC güç (1.4) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır: S = √3·U·I (3 faz) / U·I (1 faz), P = S·cos φ, Q = S·sin φ.
 * cos φ = 0,8 → sin φ = 0,6, φ = 36,8699°; cos φ = 0,85 → sin φ = √0,2775 = 0,526783.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, ComputeInputs, InputState, RunResult } from "@/lib/calc/types";
import { acGuc, type AcFaz, type AcKarakter, type AcMod } from "./ac-guc";

const ctx = defaultContext();
const DEG = Math.PI / 180;

function compute(faz: AcFaz, mod: AcMod, karakter: AcKarakter, values: Record<string, number>): CalcResult {
  return acGuc.compute({ faz, mod, karakter, ...values }, ctx);
}

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

describe("gerilim, akım ve cos φ biliniyor (elle hesap)", () => {
  it("3 faz 400 V, 10 A, cos φ 0,8 endüktif → P = 5542,6 W, Q = 4156,9 var, S = 6928,2 VA, φ = 36,87°", () => {
    const r = compute("3", "U-I", "enduktif", { U3: 400, I: 10, cosphi: 0.8 });
    expect(Object.keys(r.outputs).sort()).toEqual(["P", "Q", "S", "phi"]);
    expect(r.outputs.P).toBeCloseTo(5542.56, 2);
    expect(r.outputs.Q).toBeCloseTo(4156.92, 2);
    expect(r.outputs.S).toBeCloseTo(6928.2, 1);
    expect(r.outputs.phi / DEG).toBeCloseTo(36.8699, 4);
    expect(r.checks[0].message).toMatch(/dengeli/);
  });

  it("kapasitif yükte φ ve Q negatif, P ve S aynı", () => {
    const r = compute("3", "U-I", "kapasitif", { U3: 400, I: 10, cosphi: 0.8 });
    expect(r.outputs.P).toBeCloseTo(5542.56, 2);
    expect(r.outputs.Q).toBeCloseTo(-4156.92, 2);
    expect(r.outputs.phi / DEG).toBeCloseTo(-36.8699, 4);
  });

  it("1 faz 230 V, 10 A, cos φ 0,8 → P = 1840 W, Q = 1380 var, S = 2300 VA", () => {
    const r = compute("1", "U-I", "enduktif", { U1: 230, I: 10, cosphi: 0.8 });
    expect(r.outputs.P).toBeCloseTo(1840, 9);
    expect(r.outputs.Q).toBeCloseTo(1380, 9);
    expect(r.outputs.S).toBeCloseTo(2300, 9);
  });

  it("güç üçgeni: S² = P² + Q² ve Q = S·sin φ (her iki karakterde)", () => {
    for (const karakter of ["enduktif", "kapasitif"] as const) {
      const r = compute("3", "U-I", karakter, { U3: 690, I: 123, cosphi: 0.37 });
      expect(Math.hypot(r.outputs.P, r.outputs.Q)).toBeCloseTo(r.outputs.S, 6);
      expect(r.outputs.Q).toBeCloseTo(r.outputs.S * Math.sin(r.outputs.phi), 6);
    }
  });

  it("cos φ = 0 (saf reaktif): P = 0, Q = S, φ = 90°", () => {
    const r = compute("1", "U-I", "enduktif", { U1: 230, I: 2, cosphi: 0 });
    expect(r.outputs.P).toBeCloseTo(0, 9);
    expect(r.outputs.Q).toBeCloseTo(460, 9);
    expect(r.outputs.phi / DEG).toBeCloseTo(90, 9);
  });

  it("cos φ = 1 kapasitif seçimde φ ve Q negatif sıfır olmaz", () => {
    const r = compute("3", "U-I", "kapasitif", { U3: 400, I: 10, cosphi: 1 });
    expect(Object.is(r.outputs.phi, -0)).toBe(false);
    expect(Object.is(r.outputs.Q, -0)).toBe(false);
    expect(r.outputs.Q).toBe(0);
  });
});

describe("aktif güç, gerilim ve cos φ biliniyor (elle hesap)", () => {
  it("3 faz 11 kW, 400 V, cos φ 0,85 → I = 11000/(√3·400·0,85) = 18,679 A, S = 12 941 VA, Q = P·tan φ = 11000·0,619744 = 6817,19 var", () => {
    const r = compute("3", "P-U", "enduktif", { U3: 400, P: 11000, cosphi: 0.85 });
    expect(Object.keys(r.outputs).sort()).toEqual(["I", "Q", "S", "phi"]);
    expect(r.outputs.I).toBeCloseTo(18.679, 3);
    expect(r.outputs.S).toBeCloseTo(12941.18, 2);
    expect(r.outputs.Q).toBeCloseTo(6817.19, 1);
  });

  it("1 faz 2 kW, 230 V, cos φ 0,9 → I = 2000/207 = 9,6618 A", () => {
    const r = compute("1", "P-U", "kapasitif", { U1: 230, P: 2000, cosphi: 0.9 });
    expect(r.outputs.I).toBeCloseTo(2000 / 207, 9);
    expect(r.outputs.Q).toBeLessThan(0);
  });

  it("iki mod aynı devrede tutarlıdır", () => {
    const ui = compute("3", "U-I", "enduktif", { U3: 400, I: 10, cosphi: 0.8 });
    const pu = compute("3", "P-U", "enduktif", { U3: 400, P: ui.outputs.P, cosphi: 0.8 });
    expect(pu.outputs.I).toBeCloseTo(10, 9);
    expect(pu.outputs.Q).toBeCloseTo(ui.outputs.Q, 6);
    expect(pu.outputs.S).toBeCloseTo(ui.outputs.S, 6);
  });

  it("cos φ = 0 iken validate 'hata' verir ve compute sonuç üretmez", () => {
    const inputs: ComputeInputs = { faz: "3", mod: "P-U", karakter: "enduktif", U3: 400, P: 1000, cosphi: 0 };
    expect(acGuc.validate?.(inputs, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(acGuc.compute(inputs, ctx).outputs).toEqual({});
    expect(acGuc.validate?.({ ...inputs, mod: "U-I", I: 1 }, ctx)).toEqual([]);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan: 3 faz 400 V, 10 A, 0,8 → 5,543 kW gösterilir", () => {
    const r = ok(runCalc(acGuc, defaultState(acGuc)));
    expect(r.outputs.find((o) => o.key === "P")).toMatchObject({ unit: "kW" });
    expect(r.result.outputs.P).toBeCloseTo(5542.56, 2);
    expect(r.outputs.find((o) => o.key === "phi")).toMatchObject({ unit: "deg" });
    expect(r.outputs.find((o) => o.key === "phi")?.value).toBeCloseTo(36.87, 2);
  });

  it("varsayılan dışı birimler: 0,4 kV ve 10 000 mA → 5542,6 W; 5500 W, 0,4 kV → 9,923 A", () => {
    const s = defaultState(acGuc);
    const r1 = ok(runCalc(acGuc, { ...s, U3: { value: "0,4", unit: "kV" }, I: { value: "10000", unit: "mA" } }));
    expect(r1.result.outputs.P).toBeCloseTo(5542.56, 2);

    const pu: InputState = { ...s, mod: { value: "P-U" }, U3: { value: "0,4", unit: "kV" }, P: { value: "5500", unit: "W" } };
    const r2 = ok(runCalc(acGuc, pu));
    // 5500 / (√3·400·0,8) = 5500/554,256 = 9,9232 A
    expect(r2.result.outputs.I).toBeCloseTo(9.9232, 4);
  });

  it("tek fazda U1 kullanılır, U3 gizlidir; cos φ > 1 alan hatası verir", () => {
    const s = defaultState(acGuc);
    const r = ok(runCalc(acGuc, { ...s, faz: { value: "1" }, U3: { value: "x", unit: "V" } }));
    expect(r.inputsSI).toMatchObject({ U1: 230 });
    expect(r.inputsSI).not.toHaveProperty("U3");
    expect(r.result.outputs.P).toBeCloseTo(1840, 9);

    const bad = runCalc(acGuc, { ...s, cosphi: { value: "1,2", unit: "unitless" } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fieldErrors)).toEqual(["cosphi"]);
  });

  it("aktif güç modunda cos φ = 0 'hata' ile reddedilir", () => {
    const r = runCalc(acGuc, { ...defaultState(acGuc), mod: { value: "P-U" }, cosphi: { value: "0", unit: "unitless" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].level).toBe("hata");
  });
});

describe("adımlar", () => {
  it("3 fazda √3 çarpanı ve fazlar arası gerilim yazılır", () => {
    const steps = compute("3", "U-I", "enduktif", { U3: 400, I: 10, cosphi: 0.8 }).steps;
    expect(steps.find((s) => s.label === "Aktif güç")?.latex).toBe(
      "P = \\sqrt{3} \\cdot U \\cdot I \\cdot \\cos\\varphi = \\sqrt{3} \\cdot 400\\,\\mathrm{V} \\cdot 10\\,\\mathrm{A} \\cdot 0{,}8 = 5{,}543\\,\\mathrm{kW}",
    );
    const one = compute("1", "U-I", "enduktif", { U1: 230, I: 10, cosphi: 0.8 }).steps;
    expect(one.find((s) => s.label === "Aktif güç")?.latex).not.toContain("sqrt");
  });

  it("tüm mod ve karakterlerde adımlar ve formüller KaTeX strict'ten geçer", () => {
    for (const f of acGuc.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const faz of ["1", "3"] as const) {
      for (const karakter of ["enduktif", "kapasitif"] as const) {
        const ui = compute(faz, "U-I", karakter, { U1: 230, U3: 400, I: 0.002, cosphi: 0.35 });
        const pu = compute(faz, "P-U", karakter, { U1: 230, U3: 400, P: 2.2e6, cosphi: 1 });
        for (const s of [...ui.steps, ...pu.steps]) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
      }
    }
  });
});
