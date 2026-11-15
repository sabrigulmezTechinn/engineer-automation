/**
 * 3.2 Motor nominal akımı testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır: I = P/(√3·U·cosφ·η), I = P/(U·cosφ·η), I = P/(U·η).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { motorNominalAkimi } from "./motor-nominal-akimi";

const ctx = defaultContext();
const compute = (values: Record<string, number | string>) => motorNominalAkimi.compute(values, ctx);

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(motorNominalAkimi, { ...defaultState(motorNominalAkimi), ...state }, { outputUnits });
}

describe("SI hesap (elle hesap)", () => {
  it("3 faz: 7,5 kW, 400 V, cosφ 0,83, η 0,90 → 14,49 A; P₁ 8,333 kW; S 10,04 kVA", () => {
    // Elle: 7500 / (1,7321·400·0,83·0,90) = 7500 / 517,54 = 14,492 A
    const r = compute({ sistem: "3faz", P: 7500, U: 400, cosphi: 0.83, eta: 0.9 });
    expect(r.outputs.I).toBeCloseTo(14.4917, 4);
    expect(r.outputs.P1).toBeCloseTo(8333.333, 3);
    expect(r.outputs.S).toBeCloseTo(10040.16, 2);
    // S = √3·U·I ile tutarlı
    expect(r.outputs.S).toBeCloseTo(Math.sqrt(3) * 400 * r.outputs.I, 6);
  });

  it("1 faz: 1,5 kW, 230 V, cosφ 0,90, η 0,80 → 9,058 A; S 2,083 kVA", () => {
    // Elle: 1500 / (230·0,9·0,8) = 1500 / 165,6 = 9,0580 A
    const r = compute({ sistem: "1faz", P: 1500, U: 230, cosphi: 0.9, eta: 0.8 });
    expect(r.outputs.I).toBeCloseTo(9.058, 3);
    expect(r.outputs.S).toBeCloseTo(2083.333, 3);
    expect(r.outputs.S).toBeCloseTo(230 * r.outputs.I, 6);
  });

  it("DC: 10 kW, 440 V, η 0,88 → 25,83 A; görünür güç yok", () => {
    // Elle: 10000 / (440·0,88) = 25,826 A
    const r = compute({ sistem: "dc", P: 10000, U: 440, eta: 0.88 });
    expect(r.outputs.I).toBeCloseTo(25.8264, 4);
    expect(r.outputs.P1).toBeCloseTo(11363.636, 3);
    expect(r.outputs).not.toHaveProperty("S");
    expect(r.steps.map((s) => s.label)).toEqual(["Nominal akım", "Giriş gücü"]);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("3 faz: 10 hp, 460 V, cosφ %85, η 0,90 (kesir) → 12,23 A", () => {
    // Elle: 7456,999 / (1,7321·460·0,85·0,90) = 12,2344 A
    const r = run({
      P: { value: "10", unit: "hp" },
      U: { value: "460", unit: "V" },
      cosphi: { value: "85", unit: "percent" },
      eta: { value: "0,9", unit: "fraction" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.I).toBeCloseTo(12.2344, 4);
  });

  it("orta gerilim: 500 kW, 6,3 kV, cosφ 0,88, η %96 → 54,24 A", () => {
    // Elle: 500000 / (1,7321·6300·0,88·0,96) = 54,239 A
    const r = run({
      P: { value: "0,5", unit: "MW" },
      U: { value: "6,3", unit: "kV" },
      cosphi: { value: "0,88", unit: "fraction" },
      eta: { value: "96", unit: "percent" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.I).toBeCloseTo(54.2394, 4);
    expect(r.outputs.find((o) => o.key === "S")).toMatchObject({ unit: "kVA" });
  });

  it("küçük DC motor: 6 W, 12 V, η %75 → 666,7 mA (otomatik birim)", () => {
    // Elle: 6 / (12·0,75) = 0,6667 A
    const r = run({
      sistem: { value: "dc" },
      P: { value: "6", unit: "W" },
      U: { value: "12", unit: "V" },
      eta: { value: "75", unit: "percent" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.I).toBeCloseTo(0.666667, 6);
    expect(r.outputs.find((o) => o.key === "I")).toMatchObject({ unit: "mA", formatted: "666,7 mA" });
  });

  it("η > 1 veya cosφ > 1 alan hatası verir", () => {
    const eta = run({ eta: { value: "101", unit: "percent" } });
    expect(eta.ok).toBe(false);
    if (!eta.ok) expect(Object.keys(eta.fieldErrors)).toEqual(["eta"]);
    const pf = run({ cosphi: { value: "1,05", unit: "fraction" } });
    expect(pf.ok).toBe(false);
    if (!pf.ok) expect(Object.keys(pf.fieldErrors)).toEqual(["cosphi"]);
    const zero = run({ eta: { value: "0", unit: "percent" } });
    expect(zero.ok).toBe(false);
  });

  it("DC modunda cosφ gizlidir ve geçersiz olsa da yok sayılır", () => {
    const r = run({ sistem: { value: "dc" }, cosphi: { value: "5", unit: "fraction" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.inputsSI).not.toHaveProperty("cosphi");
  });
});
