/**
 * 3.1 Güç–tork–devir testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır: ω = 2π·n/60, T = P/ω. Mühendislik formları (9550, 5252, 716,2)
 * yalnızca karşılaştırma içindir; SI sonucu bunların yuvarlatılmamış halleriyle (60000/2π, 33000/2π,
 * 75·60/2π) aynıdır.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { gucTorkDevir, type GtdMode } from "./guc-tork-devir";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;

const compute = (mod: GtdMode, values: Record<string, number>) => gucTorkDevir.compute({ mod, ...values }, ctx);

function run(state: InputState, outputUnits?: Record<string, string>) {
  const r = runCalc(gucTorkDevir, { ...defaultState(gucTorkDevir), ...state }, { outputUnits });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

describe("SI hesap (elle hesap)", () => {
  it("7,5 kW, 1450 dev/dk → 49,39 N·m", () => {
    // Elle: ω = 2π·1450/60 = 151,844 rad/s; T = 7500/151,844 = 49,393 N·m.
    // 9550·7,5/1450 = 49,397 N·m: 9550 yuvarlatılmış katsayı olduğu için 2. ondalıkta ayrışır.
    const r = compute("P-n", { P: 7500, n: 1450 * RPM });
    expect(r.outputs.T).toBeCloseTo(49.3929, 4);
    expect(r.outputs.T).toBeCloseTo(49.39, 2);
    expect(r.outputs.P).toBe(7500);
    expect(r.outputs.n).toBeCloseTo(151.8436, 4);
  });

  it("T-n: 100 N·m, 150 rad/s → 15 kW", () => {
    const r = compute("T-n", { T: 100, n: 150 });
    expect(r.outputs.P).toBeCloseTo(15000, 9);
  });

  it("P-T: 15 kW, 100 N·m → 150 rad/s = 1432,39 dev/dk", () => {
    // Elle: ω = 15000/100 = 150 rad/s; n = 150·60/(2π) = 1432,394 dev/dk
    const r = compute("P-T", { P: 15000, T: 100 });
    expect(r.outputs.n).toBeCloseTo(150, 12);
    expect(r.outputs.n / RPM).toBeCloseTo(1432.394, 3);
  });

  it("üç mod aynı çalışma noktasında tutarlı", () => {
    const P = 7500;
    const w = 1450 * RPM;
    const T = P / w;
    for (const [mod, v] of [
      ["P-n", { P, n: w }],
      ["T-n", { T, n: w }],
      ["P-T", { P, T }],
    ] as [GtdMode, Record<string, number>][]) {
      const r = compute(mod, v);
      expect(r.outputs.P, mod).toBeCloseTo(P, 9);
      expect(r.outputs.T, mod).toBeCloseTo(T, 9);
      expect(r.outputs.n, mod).toBeCloseTo(w, 9);
    }
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("10 hp, 1750 dev/dk → 30,01 lbf·ft (= 40,69 N·m)", () => {
    // Elle: 10 hp = 7456,999 W; ω = 183,260 rad/s; T = 40,691 N·m = 30,012 lbf·ft.
    // Karşılaştırma: 5252·10/1750 = 30,012 lbf·ft.
    const r = run(
      { mod: { value: "P-n" }, P: { value: "10", unit: "hp" }, n: { value: "1750", unit: "rpm" } },
      { T: "lbfft" },
    );
    expect(r.result.outputs.T).toBeCloseTo(40.6909, 4);
    const T = r.outputs.find((o) => o.key === "T");
    expect(T?.unit).toBe("lbfft");
    expect(T?.value).toBeCloseTo(30.012, 3);
  });

  it("10 kgf·m, 1000 dev/dk → 13,96 PS (= 10,27 kW)", () => {
    // Elle: P = 10·9,80665·(1000·2π/60) = 10 269,5 W = 13,9626 PS. Karşılaştırma: 10·1000/716,2 = 13,963 PS.
    const r = run(
      { mod: { value: "T-n" }, T: { value: "10", unit: "kgfm" }, n: { value: "1000", unit: "rpm" } },
      { P: "PS" },
    );
    expect(r.result.outputs.P).toBeCloseTo(10269.5, 1);
    expect(r.outputs.find((o) => o.key === "P")?.value).toBeCloseTo(13.9626, 4);
    // Kullanıcı birim seçmezse kW (otomatik birim aynı ailede kalır)
    const r2 = run({ mod: { value: "T-n" }, T: { value: "10", unit: "kgfm" }, n: { value: "1000", unit: "rpm" } });
    expect(r2.outputs.find((o) => o.key === "P")).toMatchObject({ unit: "kW" });
  });

  it("15 kW, 100 N·m → 1432 dev/dk; rad/s ile istenince 150 rad/s", () => {
    const state: InputState = { mod: { value: "P-T" }, P: { value: "15", unit: "kW" }, T: { value: "100", unit: "Nm" } };
    expect(run(state).outputs.find((o) => o.key === "n")).toMatchObject({ unit: "rpm", formatted: "1432 dev/dk" });
    expect(run(state, { n: "rad_s" }).outputs.find((o) => o.key === "n")?.value).toBeCloseTo(150, 9);
  });

  it("devir rad/s veya dev/s ile girilebilir", () => {
    const r = run({ mod: { value: "T-n" }, T: { value: "0,1", unit: "kNm" }, n: { value: "150", unit: "rad_s" } });
    expect(r.result.outputs.P).toBeCloseTo(15000, 9);
    const r2 = run({ mod: { value: "P-n" }, P: { value: "7,5", unit: "kW" }, n: { value: "25", unit: "rps" } });
    expect(r2.result.outputs.T).toBeCloseTo(7500 / (50 * Math.PI), 9);
  });

  it("sıfır veya negatif girdiler alan hatası verir", () => {
    const r = runCalc(gucTorkDevir, { ...defaultState(gucTorkDevir), n: { value: "0", unit: "rpm" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(["n"]);
  });
});

describe("adımlar", () => {
  it("devir adımlarda dev/dk ile, açısal hız rad/s ile yazılır", () => {
    const steps = compute("P-n", { P: 7500, n: 1450 * RPM }).steps;
    expect(steps.map((s) => s.label)).toEqual(["Açısal hız", "Tork"]);
    expect(steps[0].latex).toContain("1450\\,\\mathrm{dev}/\\mathrm{dk}");
    expect(steps[0].latex).toContain("151{,}8\\,\\mathrm{rad}/\\mathrm{s}");
    expect(steps[1].latex).toContain("7{,}5\\,\\mathrm{kW}");
    expect(steps[1].latex).toContain("49{,}39\\,\\mathrm{N}\\cdot \\mathrm{m}");
  });
});
