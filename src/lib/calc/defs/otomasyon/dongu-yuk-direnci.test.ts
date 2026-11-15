/**
 * 4-20 mA döngü yük direnci (5.6) testleri. Gerçek birim sistemiyle çalışır.
 * Beklenen değerler elle hesaplanmıştır (R_maks = (V_s − V_min)/I_maks; kablo ρ·2L/A veya r·2L).
 * NE 43 sınırları ve 22 mA varsayılanı src/config/sinir/otomasyon.ts'ten gelir.
 */
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/config/sinirlar";
import { defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { InputState } from "@/lib/calc/types";
import { donguYukDirenci as def } from "./dongu-yuk-direnci";

function run(patch: InputState = {}) {
  const r = runCalc(def, { ...defaultState(def), ...patch });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

describe("varsayılan akım config'ten gelir", () => {
  it("giriş kutusunda tam '22' mA görünür ve config değerine eşittir", () => {
    expect(LIMITS.otomasyon.donguTasarimAkimi).toBe(22e-3);
    expect(defaultState(def).I_maks).toEqual({ value: "22", unit: "mA" });
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan: 24 V, 12 V, 22 mA, 250 Ω + 300 m 0,75 mm² bakır", () => {
    const r = run();
    const o = r.result.outputs;
    expect(o.R_maks).toBeCloseTo(12 / 0.022, 9); // 545,45 Ω
    expect(o.R_kablo).toBeCloseTo((0.017241 * 600) / 0.75, 9); // 13,793 Ω
    expect(o.R_yuk).toBeCloseTo(250 + 13.7928, 9);
    expect(o.pay).toBeCloseTo(12 / 0.022 - 263.7928, 9); // 281,66 Ω
    expect(o.V_t).toBeCloseTo(24 - 0.022 * 263.7928, 9); // 18,197 V
    expect(r.result.checks).toEqual([expect.objectContaining({ level: "ok" })]);
  });

  it("bilinen örnek: 24 V, 12 V, 20 mA → 600 Ω; 20 mA < 21 mA olduğu için NE 43 uyarısı", () => {
    const r = run({ I_maks: { value: "20", unit: "mA" }, kablo: { value: "yok" } });
    expect(r.result.outputs.R_maks).toBeCloseTo(600, 9);
    expect(r.result.outputs).not.toHaveProperty("R_kablo");
    expect(r.result.outputs.R_yuk).toBeCloseTo(250, 9);
    const warn = r.result.checks.find((c) => c.level === "uyari");
    expect(warn?.message).toMatch(/arıza eşiğinin/);
    expect(warn?.reference?.standard).toBe("NAMUR NE 43");
  });

  it("varsayılan dışı birimler: 0,022 A, dirençler kΩ, kablo 1 km ve 24,5 Ω/km", () => {
    const r = run({
      I_maks: { value: "0,022", unit: "A" },
      R_list: { value: "0,25; 0,1", unit: "kohm" },
      kablo: { value: "ohm_km" },
      L: { value: "1", unit: "km" },
    });
    const o = r.result.outputs;
    expect(o.R_maks).toBeCloseTo(545.4545, 3);
    expect(o.R_kablo).toBeCloseTo(49, 9); // 24,5 Ω/km · 2 · 1 km
    expect(o.R_yuk).toBeCloseTo(399, 9); // 250 + 100 + 49
    expect(o.pay).toBeCloseTo(545.4545 - 399, 3);
  });

  it("aşırı yük: 600 Ω > R(20,5 mA) = 585,4 Ω → hata", () => {
    const r = run({ R_list: { value: "600", unit: "ohm" }, kablo: { value: "yok" } });
    expect(r.result.outputs.pay).toBeCloseTo(545.4545 - 600, 3);
    expect(r.result.outputs.V_t).toBeCloseTo(24 - 0.022 * 600, 9); // 10,8 V < 12 V
    const c = r.result.checks.find((x) => x.level === "hata");
    expect(c?.message).toMatch(/aşıyor/);
  });

  it("yalnız arıza bölgesinde yetersiz: 560 Ω (545,5 < 560 ≤ 585,4) → uyarı", () => {
    const r = run({ R_list: { value: "560", unit: "ohm" }, kablo: { value: "yok" } });
    const c = r.result.checks;
    expect(c.map((x) => x.level)).toEqual(["uyari"]);
    expect(c[0].message).toMatch(/üst arıza sinyali sürülemez/);
    expect(c[0].message).toContain("585,4 Ω"); // 12 V / 20,5 mA
  });

  it("besleme ≤ V_min 'hata' ile reddedilir", () => {
    const r = runCalc(def, { ...defaultState(def), V_s: { value: "12", unit: "V" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].level).toBe("hata");
  });

  it("negatif direnç ve sıfır akım alan hatası verir", () => {
    const a = runCalc(def, { ...defaultState(def), R_list: { value: "250; -5", unit: "ohm" } });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(Object.keys(a.fieldErrors)).toEqual(["R_list"]);
    const b = runCalc(def, { ...defaultState(def), I_maks: { value: "0", unit: "mA" } });
    expect(b.ok).toBe(false);
  });

  it("formüller ve tüm kablo modlarının adımları KaTeX strict'ten geçer", () => {
    for (const f of def.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const kablo of ["yok", "ozdirenc", "ohm_km"]) {
      for (const R of ["250", "250; 50; 10", "2000"]) {
        const r = run({ kablo: { value: kablo }, R_list: { value: R, unit: "ohm" } });
        for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
      }
    }
  });
});
