/**
 * 6.1 Dişli ve kayış-kasnak oranları testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır:
 *   i = Π z₂/z₁, n₂ = n₁/i, T₂ = T₁·i·η^k; kayış i = d₂/d₁, v = π·d₁·n₁,
 *   β = asin((d₂ − d₁)/2C), θ₁,₂ = π ∓ 2β, L = 2C + (π/2)(D + d) + (D − d)²/(4C) (Gates Formula No. 13),
 *   L_tam = √(4C² − (D − d)²) + (d₁θ₁ + d₂θ₂)/2.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { disliKayisKasnakOranlari as def } from "./disli-kayis-kasnak-oranlari";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;
const DEG = Math.PI / 180;

const GEAR = { tip: "disli", disliGiris: "dis", z1: [20, 18], z2: [60, 54], etaKademe: 0.98, n1: 1450 * RPM, T1: 20 };
const BELT = { tip: "kayis", d1: 0.1, d2: 0.25, C: 0.5, etaKayis: 0.95, n1: 1450 * RPM, T1: 20 };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("dişli", () => {
  it("iki kademe 20/60 · 18/54: i = 9, n₂ = 161,1 dev/dk, η = %96,04, T₂ = 172,872 N·m", () => {
    // Elle: i = 3·3 = 9; n₂ = 1450/9 = 161,111 dev/dk; η_top = 0,98² = 0,9604; T₂ = 20·9·0,9604 = 172,872 N·m;
    // P₁ = 20·151,844 = 3036,87 W; P₂ = 3036,87·0,9604 = 2916,61 W
    const r = def.compute(GEAR, ctx);
    expect(r.outputs.i).toBeCloseTo(9, 12);
    expect(r.outputs.n2 / RPM).toBeCloseTo(161.1111, 4);
    expect(r.outputs.etaTop).toBeCloseTo(0.9604, 12);
    expect(r.outputs.T2).toBeCloseTo(172.872, 9);
    expect(r.outputs.P1).toBeCloseTo(3036.873, 3);
    expect(r.outputs.P2).toBeCloseTo(2916.613, 3);
    expect(r.outputs).not.toHaveProperty("L");
  });

  it("tek kademe, verim %100: T₂ = T₁·i (güç korunur)", () => {
    // Elle: i = 45/15 = 3; T₂ = 10·3 = 30 N·m; P₂ = P₁
    const r = def.compute({ ...GEAR, z1: [15], z2: [45], etaKademe: 1, T1: 10 }, ctx);
    expect(r.outputs.i).toBe(3);
    expect(r.outputs.T2).toBeCloseTo(30, 12);
    expect(r.outputs.P2).toBeCloseTo(r.outputs.P1, 9);
  });

  it("diş sayısı listeleri eşit uzunlukta olmalı", () => {
    expect(def.validate?.({ ...GEAR, z2: [60] }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.validate?.(GEAR, ctx)).toEqual([]);
    expect(def.compute({ ...GEAR, z2: [60] }, ctx).outputs).toEqual({});
  });

  it("kademe oranlarıyla, varsayılan dışı birimler (runCalc): 2,5; 4; 1,2 — 25 dev/s, 500 N·cm, η 0,97", () => {
    // Elle: i = 2,5·4·1,2 = 12; n₂ = 25·60/12 = 125 dev/dk; η_top = 0,97³ = 0,912673; T₂ = 5·12·0,912673 = 54,7604 N·m
    const r = run(
      {
        disliGiris: { value: "oran" },
        oranlar: { value: "2,5; 4; 1,2", unit: "unitless" },
        etaKademe: { value: "0,97", unit: "fraction" },
        n1: { value: "25", unit: "rps" },
        T1: { value: "500", unit: "Ncm" },
      },
      { T2: "kgfm" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.i).toBeCloseTo(12, 12);
    expect(r.result.outputs.n2 / RPM).toBeCloseTo(125, 9);
    expect(r.result.outputs.etaTop).toBeCloseTo(0.912673, 9);
    expect(r.result.outputs.T2).toBeCloseTo(54.76038, 6);
    expect(r.outputs.find((o) => o.key === "T2")?.unit).toBe("kgfm");
  });
});

describe("kayış-kasnak", () => {
  it("d₁ 100, d₂ 250, C 500 mm, 1450 dev/dk: i 2,5, v 7,592 m/s, θ 162,75°/197,25°, L 1561,03 mm", () => {
    // Elle: i = 2,5; n₂ = 580 dev/dk; T₂ = 20·2,5·0,95 = 47,5 N·m; v = π·0,1·1450/60 = 7,59218 m/s;
    // β = asin(150/1000) = 8,6269°; θ₁ = 162,7461°, θ₂ = 197,2539°;
    // L = 1000 + (π/2)·350 + 150²/2000 = 1561,0287 mm (Gates 1,57 ile 1560,75 mm);
    // L_tam = √(1 000 000 − 22 500) + (100·2,84046 + 250·3,44273)/2 = 1561,0500 mm
    const r = def.compute(BELT, ctx);
    const o = r.outputs;
    expect(o.i).toBeCloseTo(2.5, 12);
    expect(o.n2 / RPM).toBeCloseTo(580, 9);
    expect(o.T2).toBeCloseTo(47.5, 12);
    expect(o.v).toBeCloseTo(7.592182, 6);
    expect(o.theta1 / DEG).toBeCloseTo(162.746147, 5);
    expect(o.theta2 / DEG).toBeCloseTo(197.253853, 5);
    expect(o.L * 1000).toBeCloseTo(1561.0287, 3);
    expect(o.Ltam * 1000).toBeCloseTo(1561.05, 3);
    // Gates kataloğundaki 1,57 katsayısıyla fark 0,3 mm'den az
    expect(Math.abs(o.L * 1000 - 1560.75)).toBeLessThan(0.3);
    expect(o).not.toHaveProperty("etaTop");
  });

  it("eşit kasnaklar: θ = 180°, L = L_tam = 2C + π·d", () => {
    // Elle: 2·0,4 + π·0,15 = 1,271239 m
    const r = def.compute({ ...BELT, d1: 0.15, d2: 0.15, C: 0.4 }, ctx);
    expect(r.outputs.theta1 / DEG).toBeCloseTo(180, 12);
    expect(r.outputs.L).toBeCloseTo(1.271239, 6);
    expect(r.outputs.Ltam).toBeCloseTo(1.271239, 6);
  });

  it("hız artırıcı, inç birimleri (runCalc): d₁ 10 inç, d₂ 4 inç, C 20 inç, 600 dev/dk", () => {
    // Elle: d₁ = 254, d₂ = 101,6, C = 508 mm; i = 0,4; n₂ = 1500 dev/dk;
    // β = asin(−152,4/1016) → θ₁ = 197,2539° (büyük kasnak sürücü), θ₂ = 162,7461°;
    // L = 1016 + (π/2)·355,6 + 152,4²/2032 = 1586,0052 mm; L_tam = 1586,0268 mm; v = 62,8319·0,127 = 7,97965 m/s
    const r = run(
      {
        tip: { value: "kayis" },
        d1: { value: "10", unit: "in" },
        d2: { value: "4", unit: "in" },
        C: { value: "20", unit: "in" },
        n1: { value: "600", unit: "rpm" },
      },
      { L: "in" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.i).toBeCloseTo(0.4, 12);
    expect(o.n2 / RPM).toBeCloseTo(1500, 9);
    expect(o.theta1 / DEG).toBeCloseTo(197.253853, 5);
    expect(o.theta2 / DEG).toBeCloseTo(162.746147, 5);
    expect(o.L * 1000).toBeCloseTo(1586.0052, 3);
    expect(o.Ltam * 1000).toBeCloseTo(1586.0268, 3);
    expect(o.v).toBeCloseTo(7.979645, 6);
    expect(r.outputs.find((x) => x.key === "L")?.unit).toBe("in");
  });

  it("kasnaklar çakışıyorsa (C ≤ (d₁ + d₂)/2) hata", () => {
    expect(def.validate?.({ ...BELT, C: 0.175 }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.validate?.({ ...BELT, C: 0.176 }, ctx)).toEqual([]);
    const r = run({ tip: { value: "kayis" }, C: { value: "150", unit: "mm" } });
    expect(r.ok).toBe(false);
  });

  it("adımlar kartla aynı birimi kullanır (mm, dev/dk; Gates boyu 6 anlamlı basamak)", () => {
    const r = run({ tip: { value: "kayis" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const latex = r.result.steps.map((s) => s.latex).join(" ");
    expect(latex).toContain("250\\,\\mathrm{mm}");
    expect(latex).toContain("1561{,}03\\,\\mathrm{mm}");
    expect(latex).toContain("580\\,\\mathrm{dev}/\\mathrm{dk}");
  });
});
