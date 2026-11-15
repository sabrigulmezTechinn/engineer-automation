/**
 * 2.6 Trafo seçimi ve yüklenme testleri (gerçek birim sistemiyle). Beklenen değerler elle hesaptır:
 *   Varsayılan liste: ΣP = 75+55+37+30+22+15+11 = 245 kW; k_e 0,8 → P = 196 kW; cos φ 0,85 → S = 196/0,85 = 230,59 kVA;
 *   R10 listesinde ≥ 230,59 olan en küçük değer 250 kVA; β = 0,92235; I_n = 250 000/(√3·400) = 360,84 A;
 *   I = 230 588/(√3·400) = 332,83 A.
 *   Kayıplar P₀ 0,36 kW, P_k 3,25 kW: P_kayıp = 0,36 + 0,92235²·3,25 = 3,1249 kW; η = 196/199,125 = %98,43;
 *   E = 3,1249·8760 = 27 374 kWh.
 *   Karışık cos φ: 100 kW·0,75 + 50 kW·tan(acos 0,6) = 75 + 66,667 = 141,667 kvar; S = √(150² + 141,667²) = 206,32 kVA.
 *   Akımdan: √3·400·1000 = 692,82 kVA → 800 kVA, β = 0,86603.
 * R10 serisi: ISO 3 (https://en.wikipedia.org/wiki/Renard_series).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { trafoSecimiYuklenme as def } from "./trafo-secimi-yuklenme";

const ctx = defaultContext();

function run(state: InputState) {
  const r = runCalc(def, { ...defaultState(def), ...state });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

describe("yük listesinden", () => {
  it("varsayılan: 230,59 kVA → 250 kVA, β %92,24, I_n 360,84 A", () => {
    const r = run({});
    const o = r.result.outputs;
    expect(o.P).toBeCloseTo(196e3, 6);
    expect(o.S).toBeCloseTo(230588.235, 2);
    expect(o.cos).toBeCloseTo(0.85, 12);
    expect(o.Sn).toBe(250e3);
    expect(o.beta).toBeCloseTo(0.922353, 6);
    expect(o.In).toBeCloseTo(360.8439, 3);
    expect(o.Iyuk).toBeCloseTo(332.8254, 3);
    expect(o).not.toHaveProperty("eta");
    expect(r.result.checks[0].message).toMatch(/250 kVA/);
  });

  it("yüke göre ayrı cos φ: S = 206,32 kVA, cos φ 0,7270", () => {
    const r = def.compute(
      { giris: "liste", U: 400, Pliste: [100e3, 50e3], cosListe: [0.8, 0.6], ke: 1, standart: [250e3], kayip: "yok" },
      ctx,
    );
    expect(r.outputs.Q).toBeCloseTo(141666.667, 2);
    expect(r.outputs.S).toBeCloseTo(206323.64, 1);
    expect(r.outputs.cos).toBeCloseTo(0.727013, 6);
  });

  it("cos φ listesi uzunluğu uymazsa hata", () => {
    expect(
      def.validate?.({ giris: "liste", U: 400, Pliste: [1, 2, 3], cosListe: [0.8, 0.9], ke: 1, standart: [1], kayip: "yok" }, ctx),
    ).toEqual([expect.objectContaining({ level: "hata" })]);
  });
});

describe("akımdan ve kayıplar", () => {
  it("400 V, 1000 A → 692,82 kVA → 800 kVA, β %86,60", () => {
    const r = run({ giris: { value: "akim" } });
    expect(r.result.outputs.S).toBeCloseTo(692820.32, 1);
    expect(r.result.outputs.Sn).toBe(800e3);
    expect(r.result.outputs.beta).toBeCloseTo(0.866025, 6);
    expect(r.result.outputs.P).toBeCloseTo(623538.29, 1);
  });

  it("kayıplar: P_kayıp 3,1249 kW, η %98,43, E 27 374 kWh", () => {
    const r = run({ kayip: { value: "var" } });
    const o = r.result.outputs;
    expect(o.Pkayip).toBeCloseTo(3124.889, 2);
    expect(o.eta).toBeCloseTo(0.984307, 6);
    expect(o.E / 3.6e6).toBeCloseTo(27374.02, 1);
  });

  it("listede yeterli güç yoksa uyarı, S_n yok", () => {
    const r = run({ giris: { value: "akim" }, I: { value: "5000" } }); // 3464 kVA > 3150 kVA
    expect(r.result.outputs).not.toHaveProperty("Sn");
    expect(r.result.checks.find((c) => c.level === "uyari")?.message).toMatch(/3,15 MVA/);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("0,4 kV, 1,2 kA, liste MVA, 365 gün", () => {
    // Elle: S = √3·400·1200 = 831,38 kVA → 1 MVA, β = 0,83138; P = 748,25 kW;
    // P_kayıp = 1 + 0,83138²·10,5 = 8,2576 kW; η = 748,25/(748,25 + 8,2576) = 0,98908; E = 8,2576·8760 = 72 336,6 kWh
    const r = run({
      giris: { value: "akim" },
      U: { value: "0,4", unit: "kV" },
      I: { value: "1,2", unit: "kA" },
      cosAkim: { value: "0,9" },
      standart: { value: "0,63; 0,8; 1; 1,25", unit: "MVA" },
      kayip: { value: "var" },
      P0: { value: "1000", unit: "W" },
      Pk: { value: "10,5", unit: "kW" },
      t: { value: "365", unit: "day" },
    });
    const o = r.result.outputs;
    expect(o.S).toBeCloseTo(831384.39, 1);
    expect(o.Sn).toBeCloseTo(1e6, 6);
    expect(o.Pkayip).toBeCloseTo(8257.6, 2);
    expect(o.eta).toBeCloseTo(0.989085, 6);
    expect(o.E / 3.6e6).toBeCloseTo(72336.58, 1);
  });
});
