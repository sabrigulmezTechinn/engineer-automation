/**
 * PID ayarı (5.5) testleri. Gerçek birim sistemiyle çalışır.
 *
 * Kaynak: Åström & Hägglund, "Advanced PID Control" (ISA, 2006), §6.2:
 * - Örnek 6.1 (basamak yanıtı): a = 0,218, L = 0,806 → PID: K = 5,50, T_i = 1,61, T_d = 0,403.
 * - Örnek 6.2 (frekans yanıtı): K_u = 8, T_u = 2π/√3 = 3,63 → PID: K = 4,8, T_i = 1,81.
 *   Kitap T_d = 0,44 basar; Tablo 6.2'ye göre 0,125 · 3,6276 = 0,4534 (elle) — test elle hesaba göre yazıldı.
 * Diğer beklentiler Tablo 6.1/6.2 katsayılarıyla elle hesaplanmıştır.
 */
import { describe, expect, it } from "vitest";
import { defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { InputState } from "@/lib/calc/types";
import { pidAyari as def, ZN_RULES } from "./pid-ayari";

function run(patch: InputState = {}) {
  const r = runCalc(def, { ...defaultState(def), ...patch });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

const u = (value: string) => ({ value, unit: "unitless" });
const s = (value: string, unit = "s") => ({ value, unit });

describe("katsayılar (Åström & Hägglund 2006, Tablo 6.1 ve 6.2)", () => {
  it("kapalı çevrim: P 0,5; PI 0,4 / 0,8; PID 0,6 / 0,5 / 0,125", () => {
    expect(ZN_RULES.kapali.P).toEqual({ kp: 0.5, tp: 1.0 });
    expect(ZN_RULES.kapali.PI).toEqual({ kp: 0.4, ti: 0.8, tp: 1.4 });
    expect(ZN_RULES.kapali.PID).toEqual({ kp: 0.6, ti: 0.5, td: 0.125, tp: 0.85 });
  });

  it("açık çevrim: P 1/a; PI 0,9/a, 3L; PID 1,2/a, 2L, L/2", () => {
    expect(ZN_RULES.acik.P).toEqual({ kp: 1, tp: 4 });
    expect(ZN_RULES.acik.PI).toEqual({ kp: 0.9, ti: 3, tp: 5.7 });
    expect(ZN_RULES.acik.PID).toEqual({ kp: 1.2, ti: 2, td: 0.5, tp: 3.4 });
  });
});

describe("kitap örnekleri", () => {
  it("Örnek 6.1: a = 0,218, L = 0,806 s → K_p = 5,50, T_i = 1,61 s, T_d = 0,403 s", () => {
    // K = 1 ve T = L/a seçilerek a = K·L/T = 0,218 elde edilir.
    const r = run({ yontem: { value: "acik" }, K: u("1"), L: s("0,806"), T: s(String(0.806 / 0.218).replace(".", ",")) });
    const o = r.result.outputs;
    expect(o.a).toBeCloseTo(0.218, 12);
    expect(o.Kp).toBeCloseTo(5.5, 2);
    expect(o.Ti).toBeCloseTo(1.61, 2);
    expect(o.Td).toBeCloseTo(0.403, 12);
  });

  it("Örnek 6.2: K_u = 8, T_u = 2π/√3 → K_p = 4,8, T_i = 1,81 s, T_d = 0,4534 s", () => {
    const Tu = (2 * Math.PI) / Math.sqrt(3);
    const r = run({ Ku: u("8"), Tu: s(String(Tu).replace(".", ",")) });
    const o = r.result.outputs;
    expect(o.Kp).toBeCloseTo(4.8, 12);
    expect(o.Ti).toBeCloseTo(1.81, 2);
    expect(o.Td).toBeCloseTo(0.4534, 4);
  });
});

describe("motor üzerinden (runCalc), elle hesap", () => {
  it("varsayılan: kapalı çevrim PID, K_u = 2,5, T_u = 40 s", () => {
    const r = run();
    const o = r.result.outputs;
    expect(o.Kp).toBeCloseTo(1.5, 12); // 0,6 · 2,5
    expect(o.Ti).toBeCloseTo(20, 12); // 0,5 · 40 s
    expect(o.Td).toBeCloseTo(5, 12); // 0,125 · 40 s
    expect(o.Ki).toBeCloseTo(0.075, 12); // 1,5 / 20 s
    expect(o.Kd).toBeCloseTo(7.5, 12); // 1,5 · 5 s
    expect(o.Tp).toBeCloseTo(34, 12); // 0,85 · 40 s
    expect(o).not.toHaveProperty("a");
    expect(r.result.checks).toEqual([expect.objectContaining({ level: "uyari" })]);
    expect(r.result.checks[0].message).toMatch(/çeyrek genlik/);
  });

  it("kapalı çevrim PI: K_p = 1, T_i = 32 s, K_i = 1/32 s⁻¹; türev çıktısı yok", () => {
    const o = run({ tip: { value: "PI" } }).result.outputs;
    expect(o.Kp).toBeCloseTo(1, 12);
    expect(o.Ti).toBeCloseTo(32, 12);
    expect(o.Ki).toBeCloseTo(1 / 32, 12);
    expect(o).not.toHaveProperty("Td");
    expect(o).not.toHaveProperty("Kd");
  });

  it("kapalı çevrim P: yalnız K_p = 1,25 ve T_p = 40 s", () => {
    const o = run({ tip: { value: "P" } }).result.outputs;
    expect(Object.keys(o).sort()).toEqual(["Kp", "Tp"]);
    expect(o.Kp).toBeCloseTo(1.25, 12);
    expect(o.Tp).toBeCloseTo(40, 12);
  });

  it("varsayılan dışı birim: T_u = 0,5 dk = 30 s → T_i = 15 s, T_d = 3,75 s", () => {
    const r = run({ Tu: s("0,5", "min") });
    expect(r.result.outputs.Ti).toBeCloseTo(15, 12);
    expect(r.result.outputs.Td).toBeCloseTo(3.75, 12);
    expect(r.outputs.find((o) => o.key === "Td")?.formatted).toBe("3,75 s");
  });

  it("açık çevrim PID: K = 1,5, L = 5 s, T = 30 s → a = 0,25, K_p = 4,8, T_i = 10 s, T_d = 2,5 s", () => {
    const o = run({ yontem: { value: "acik" } }).result.outputs;
    expect(o.a).toBeCloseTo(0.25, 12);
    expect(o.Kp).toBeCloseTo(4.8, 12);
    expect(o.Ti).toBeCloseTo(10, 12);
    expect(o.Td).toBeCloseTo(2.5, 12);
    expect(o.Ki).toBeCloseTo(0.48, 12);
    expect(o.Kd).toBeCloseTo(12, 12);
    expect(o.Tp).toBeCloseTo(17, 12); // 3,4 · 5 s
  });

  it("açık çevrim PI, ms ve dk birimleriyle: L = 500 ms, T = 0,1 dk, K = 2 → a = 1/6, K_p = 5,4, T_i = 1,5 s", () => {
    const o = run({ yontem: { value: "acik" }, tip: { value: "PI" }, K: u("2"), L: s("500", "ms"), T: s("0,1", "min") }).result
      .outputs;
    expect(o.a).toBeCloseTo((2 * 0.5) / 6, 12);
    expect(o.Kp).toBeCloseTo(0.9 / (1 / 6), 12);
    expect(o.Ti).toBeCloseTo(1.5, 12);
  });

  it("açık çevrim P: K_p = 1/a = 4", () => {
    const o = run({ yontem: { value: "acik" }, tip: { value: "P" } }).result.outputs;
    expect(o.Kp).toBeCloseTo(4, 12);
    expect(o.Tp).toBeCloseTo(20, 12); // 4 · 5 s
  });

  it("sıfır veya negatif parametre alan hatası verir", () => {
    const a = runCalc(def, { ...defaultState(def), Ku: u("0") });
    expect(a.ok).toBe(false);
    const b = runCalc(def, { ...defaultState(def), yontem: { value: "acik" }, L: s("-1") });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(Object.keys(b.fieldErrors)).toEqual(["L"]);
  });

  it("formüller ve tüm yöntem/tip adımları KaTeX strict'ten geçer", () => {
    for (const f of def.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const yontem of ["kapali", "acik"]) {
      for (const tip of ["P", "PI", "PID"]) {
        const r = run({ yontem: { value: yontem }, tip: { value: tip } });
        for (const st of r.result.steps) expect(() => renderStrict(st.latex), st.latex).not.toThrow();
      }
    }
  });
});
