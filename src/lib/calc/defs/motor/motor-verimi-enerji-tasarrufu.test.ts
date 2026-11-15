/**
 * 3.5 Motor verimi ve enerji tasarrufu testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır: P₁ = P/η₁, P₂ = P/η₂, ΔE = (P₁ − P₂)·t, ΔC = ΔE·c, t_gö = ΔK/ΔC.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { motorVerimiEnerjiTasarrufu as def } from "./motor-verimi-enerji-tasarrufu";

const ctx = defaultContext();
const H = 3600;
const KWH = 3.6e6;
const TL_PER_KWH = 1 / KWH;

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("SI hesap (elle hesap)", () => {
  it("15 kW, η 0,88 → 0,92, 4000 sa, 3 TL/kWh → 741,1 W, 2964,4 kWh, 8893 TL/yıl", () => {
    // Elle: P₁ = 17 045,45 W; P₂ = 16 304,35 W; ΔP = 741,107 W; ΔE = 741,107·4000 = 2 964 427 Wh;
    // ΔC = 2964,427·3 = 8893,28 TL
    const r = def.compute({ P: 15000, eta1: 0.88, eta2: 0.92, t: 4000 * H, c: 3 * TL_PER_KWH }, ctx);
    expect(r.outputs.P1).toBeCloseTo(17045.4545, 4);
    expect(r.outputs.P2).toBeCloseTo(16304.3478, 4);
    expect(r.outputs.dP).toBeCloseTo(741.1067, 4);
    expect(r.outputs.dE / KWH).toBeCloseTo(2964.4269, 4);
    expect(r.outputs.dC).toBeCloseTo(8893.2806, 4);
    // Fiyat farkı girilmedi: geri ödeme yok, bilgi notu var
    expect(r.outputs).not.toHaveProperty("geriOdeme");
    expect(r.checks).toEqual([expect.objectContaining({ level: "ok" })]);
  });

  it("fiyat farkı 25 000 TL, 6000 sa, 4 TL/kWh → 17 786,6 TL/yıl, 1,406 yıl", () => {
    // Elle: ΔE = 741,107·6000 = 4446,64 kWh; ΔC = 17 786,56 TL; 25 000/17 786,56 = 1,40556 yıl
    const r = def.compute({ P: 15000, eta1: 0.88, eta2: 0.92, t: 6000 * H, c: 4 * TL_PER_KWH, dK: 25000 }, ctx);
    expect(r.outputs.dC).toBeCloseTo(17786.5613, 4);
    expect(r.outputs.geriOdeme).toBeCloseTo(1.405556, 6);
    expect(r.checks).toEqual([]);
  });

  it("yeni motor daha verimli değilse uyarı verir, geri ödeme hesaplanmaz", () => {
    const r = def.compute({ P: 15000, eta1: 0.92, eta2: 0.9, t: 4000 * H, c: 3 * TL_PER_KWH, dK: 10000 }, ctx);
    expect(r.outputs.dP).toBeLessThan(0);
    expect(r.outputs).not.toHaveProperty("geriOdeme");
    expect(r.checks).toEqual([expect.objectContaining({ level: "uyari" })]);
    const same = def.compute({ P: 15000, eta1: 0.9, eta2: 0.9, t: 4000 * H, c: 3 * TL_PER_KWH, dK: 10000 }, ctx);
    expect(same.outputs.dE).toBe(0);
    expect(same.outputs).not.toHaveProperty("geriOdeme");
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("20 hp, η 0,90 → 0,94 (kesir), 250 gün, 350 kr/kWh, 30 000 TL → 4231 kWh, 14 808 TL, 2,026 yıl", () => {
    // Elle: P = 14 914,0 W; P₁ = 16 571,11 W; P₂ = 15 865,95 W; ΔP = 705,154 W;
    // t = 250·24 = 6000 sa; ΔE = 4230,92 kWh; c = 3,5 TL/kWh → ΔC = 14 808,22 TL; 30 000/14 808,22 = 2,02590 yıl
    const r = run({
      P: { value: "20", unit: "hp" },
      eta1: { value: "0,90", unit: "fraction" },
      eta2: { value: "0,94", unit: "fraction" },
      t: { value: "250", unit: "day" },
      c: { value: "350", unit: "krs_kWh" },
      dK: { value: "30000", unit: "TL" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.dP).toBeCloseTo(705.1535, 4);
    expect(o.dE / KWH).toBeCloseTo(4230.9213, 4);
    expect(o.dC).toBeCloseTo(14808.2244, 4);
    expect(o.geriOdeme).toBeCloseTo(2.025901, 6);
    // Kartlar: ΔE kWh'de sabit (autoUnit: false), ΔP W'a iner, para TL'de kalır
    expect(r.outputs.find((x) => x.key === "dE")).toMatchObject({ unit: "kWh", formatted: "4231 kWh" });
    expect(r.outputs.find((x) => x.key === "dP")).toMatchObject({ unit: "W" });
    expect(r.outputs.find((x) => x.key === "dC")).toMatchObject({ unit: "TL" });
  });

  it("tasarruf her büyüklükte kWh'de kalır; kartla adım aynı birimi kullanır", () => {
    // Elle: ΔP = 1500·(1/0,88 − 1/0,92) = 74,11 W; 2000 sa → 148,2 kWh
    const small = run({ P: { value: "1,5", unit: "kW" }, t: { value: "2000", unit: "h" } });
    if (!small.ok) throw new Error(JSON.stringify(small));
    expect(small.outputs.find((x) => x.key === "dE")).toMatchObject({ unit: "kWh", formatted: "148,2 kWh" });
    expect(small.result.steps.find((s) => s.label === "Yıllık enerji tasarrufu")?.latex).toMatch(/148\{,\}2\\,\\mathrm\{kWh\}$/);
    const big = run({ P: { value: "200", unit: "kW" }, t: { value: "8000", unit: "h" } });
    if (!big.ok) throw new Error(JSON.stringify(big));
    // Elle: ΔP = 200 000·(1/0,88 − 1/0,92) = 9881,4 W; 8000 sa → 79 051 kWh (MWh'ye geçmez)
    expect(big.outputs.find((x) => x.key === "dE")).toMatchObject({ unit: "kWh" });
    expect(big.outputs.find((x) => x.key === "dE")?.value).toBeCloseTo(79051.4, 1);
    expect(big.result.steps.find((s) => s.label === "Yıllık enerji tasarrufu")?.latex).toMatch(/\\mathrm\{kWh\}$/);
  });

  it("yılda 8784 saati aşan süre ve %100'ü aşan verim reddedilir", () => {
    const t = run({ t: { value: "8785", unit: "h" } });
    expect(t.ok).toBe(false);
    if (!t.ok) expect(Object.keys(t.fieldErrors)).toEqual(["t"]);
    const eta = run({ eta2: { value: "100,5", unit: "percent" } });
    expect(eta.ok).toBe(false);
    if (!eta.ok) expect(Object.keys(eta.fieldErrors)).toEqual(["eta2"]);
  });

  it("fiyat farkı boşsa geri ödeme kartı gösterilmez", () => {
    const r = run({ dK: { value: "", unit: "TL" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.map((o) => o.key)).not.toContain("geriOdeme");
  });
});
