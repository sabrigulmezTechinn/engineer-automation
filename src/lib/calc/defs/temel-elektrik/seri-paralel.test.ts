/**
 * Seri/paralel R, C, L (1.2) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır: seri Σxᵢ, paralel (Σ1/xᵢ)⁻¹; kondansatörde tersi.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, InputState, RunResult } from "@/lib/calc/types";
import { seriParalel, type Baglanti, type Bilesen } from "./seri-paralel";

const ctx = defaultContext();
const KEY: Record<Bilesen, "R" | "C" | "L"> = { direnc: "R", kondansator: "C", bobin: "L" };
const compute = (bilesen: Bilesen, baglanti: Baglanti, values: number[]): CalcResult =>
  seriParalel.compute({ bilesen, baglanti, [KEY[bilesen]]: values }, ctx);

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

describe("compute (SI, elle hesap)", () => {
  it("direnç seri: 100 + 220 + 470 = 790 Ω", () => {
    expect(compute("direnc", "seri", [100, 220, 470]).outputs).toEqual({ Req: expect.closeTo(790, 9) });
  });

  it("direnç paralel: 100 ∥ 220 ∥ 470 = 1/(0,01 + 0,0045455 + 0,0021277) = 59,977 Ω", () => {
    expect(compute("direnc", "paralel", [100, 220, 470]).outputs.Req).toBeCloseTo(59.9768, 3);
  });

  it("iki eşit direnç paralel: 10 kΩ ∥ 10 kΩ = 5 kΩ", () => {
    expect(compute("direnc", "paralel", [10e3, 10e3]).outputs.Req).toBeCloseTo(5000, 9);
  });

  it("kondansatör paralel toplanır: 10 + 22 + 47 = 79 µF", () => {
    expect(compute("kondansator", "paralel", [10e-6, 22e-6, 47e-6]).outputs.Ceq).toBeCloseTo(79e-6, 15);
  });

  it("kondansatör seri: 10 µF + 10 µF → 5 µF; 10, 22, 47 µF → 5,9977 µF", () => {
    expect(compute("kondansator", "seri", [10e-6, 10e-6]).outputs.Ceq).toBeCloseTo(5e-6, 15);
    expect(compute("kondansator", "seri", [10e-6, 22e-6, 47e-6]).outputs.Ceq / 1e-6).toBeCloseTo(5.99768, 4);
  });

  it("bobin seri 1 + 2,2 + 4,7 = 7,9 mH; paralel 1…8 mH → 1/H₈ = 0,36794 mH", () => {
    expect(compute("bobin", "seri", [1e-3, 2.2e-3, 4.7e-3]).outputs.Leq).toBeCloseTo(7.9e-3, 12);
    // H₈ = 1 + 1/2 + … + 1/8 = 761/280 → L = 280/761 mH
    const r = compute("bobin", "paralel", [1, 2, 3, 4, 5, 6, 7, 8].map((x) => x * 1e-3));
    expect(r.outputs.Leq / 1e-3).toBeCloseTo(280 / 761, 9);
  });

  it("yalnız seçilen bileşenin çıktısı döner", () => {
    expect(Object.keys(compute("bobin", "seri", [1, 2]).outputs)).toEqual(["Leq"]);
    expect(Object.keys(compute("kondansator", "seri", [1, 2]).outputs)).toEqual(["Ceq"]);
  });

  it("bobinde karşılıklı endüktans notu, seri kondansatörde gerilim paylaşımı notu verilir", () => {
    expect(compute("bobin", "paralel", [1, 2]).checks).toEqual([
      expect.objectContaining({ level: "ok", message: expect.stringMatching(/karşılıklı endüktans/) }),
    ]);
    expect(compute("kondansator", "seri", [1, 2]).checks[0].message).toMatch(/gerilim/);
    expect(compute("direnc", "seri", [1, 2]).checks).toEqual([]);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan: 100 ∥ 220 ∥ 470 Ω = 59,98 Ω", () => {
    const r = ok(runCalc(seriParalel, defaultState(seriParalel)));
    expect(r.outputs).toHaveLength(1);
    expect(r.outputs[0]).toMatchObject({ key: "Req", unit: "ohm" });
    expect(r.outputs[0].value).toBeCloseTo(59.977, 3);
  });

  it("varsayılan dışı birimler: 4,7 kΩ ∥ 4,7 kΩ = 2,35 kΩ; 100 nF + 220 nF seri = 68,75 nF; µH girişi", () => {
    const s = defaultState(seriParalel);
    const r1 = ok(runCalc(seriParalel, { ...s, R: { value: "4,7; 4,7", unit: "kohm" } }));
    expect(r1.result.outputs.Req).toBeCloseTo(2350, 9);
    expect(r1.outputs[0]).toMatchObject({ unit: "kohm" });

    const caps: InputState = { ...s, bilesen: { value: "kondansator" }, baglanti: { value: "seri" }, C: { value: "100; 220", unit: "nF" } };
    const r2 = ok(runCalc(seriParalel, caps));
    // 100·220/(100+220) = 68,75 nF
    expect(r2.result.outputs.Ceq).toBeCloseTo(68.75e-9, 18);
    expect(r2.outputs[0]).toMatchObject({ unit: "nF" });

    const coils: InputState = { ...s, bilesen: { value: "bobin" }, baglanti: { value: "seri" }, L: { value: "470; 330", unit: "uH" } };
    expect(ok(runCalc(seriParalel, coils)).result.outputs.Leq).toBeCloseTo(800e-6, 15);
  });

  it("tek eleman, sıfır ve negatif değer alan hatası verir", () => {
    const s = defaultState(seriParalel);
    for (const value of ["100", "100; 0", "100; -5"]) {
      const r = runCalc(seriParalel, { ...s, R: { value, unit: "ohm" } });
      expect(r.ok, value).toBe(false);
      if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(["R"]);
    }
  });

  it("gizli listeler doğrulanmaz", () => {
    const s = defaultState(seriParalel);
    const r = ok(runCalc(seriParalel, { ...s, C: { value: "geçersiz", unit: "uF" } }));
    expect(r.inputsSI).not.toHaveProperty("C");
  });
});

describe("adımlar", () => {
  it("paralel dirençte değerler yerine konur", () => {
    expect(compute("direnc", "paralel", [100, 220, 470]).steps[0].latex).toBe(
      "R_{\\text{eş}} = \\left(\\frac{1}{R_{1}} + \\frac{1}{R_{2}} + \\frac{1}{R_{3}}\\right)^{-1} = " +
        "\\left(\\frac{1}{100\\,\\Omega} + \\frac{1}{220\\,\\Omega} + \\frac{1}{470\\,\\Omega}\\right)^{-1} = 59{,}98\\,\\Omega",
    );
  });

  it("uzun liste ⋯ ile kısaltılır; tüm durumlar KaTeX strict'ten geçer", () => {
    const long = compute("bobin", "seri", [1, 2, 3, 4, 5, 6, 7, 8].map((x) => x * 1e-3)).steps[0].latex;
    expect(long).toContain("\\sum_{i=1}^{8} L_i");
    expect(long).toContain("\\cdots");
    const cases: [Bilesen, Baglanti, number[]][] = [
      ["direnc", "seri", [100, 220, 470]],
      ["direnc", "paralel", Array.from({ length: 12 }, (_, i) => (i + 1) * 1000)],
      ["kondansator", "seri", [1e-9, 2.2e-9]],
      ["kondansator", "paralel", [1e-12, 4.7e-12, 1e-6]],
      ["bobin", "paralel", [1e-6, 3.3e-6]],
    ];
    for (const f of seriParalel.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const [b, g, v] of cases) {
      for (const s of compute(b, g, v).steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });
});
