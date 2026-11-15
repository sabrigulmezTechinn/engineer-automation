/**
 * 6.9 Rulman ömrü (ISO 281) testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır: L₁₀ = (C/P)^p (bilyeli 3, makaralı 10/3), L₁₀h = 10⁶/(60·n)·L₁₀, L_n = a₁·L₁₀.
 * a₁ değerleri: SKF Rolling bearings catalogue, Tablo 3, s. 90 (ISO 281 ile uyumlu):
 *   https://www.skf.com/binaries/pub12/Images/0901d196802809de-Rolling-bearings---17000_1-EN_tcm_12-121486.pdf
 *   %90 → 1, %95 → 0,64, %96 → 0,55, %97 → 0,47, %98 → 0,37, %99 → 0,25
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { rulmanOmru as def } from "./rulman-omru";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;
const HOUR = 3600;
const KN = 1e3;

const BASE = { tip: "bilyeli", yuk: "dogrudan", C: 25 * KN, P: 2.5 * KN, n: 1500 * RPM, R: "90" };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("temel anma ömrü", () => {
  it("zorunlu: C/P = 10, bilyeli, 1500 dev/dk → L₁₀ = 1000 milyon devir, L₁₀h = 11 111 sa", () => {
    // Elle: 10³ = 1000; 10⁶/(60·1500)·1000 = 11 111,1 sa = 4,0·10⁷ s
    const r = def.compute(BASE, ctx);
    expect(r.outputs.L10).toBeCloseTo(1000, 9);
    expect(r.outputs.L10h).toBeCloseTo(4.0e7, 2);
    expect(r.outputs.L10h / HOUR).toBeCloseTo(11111.111, 3);
    expect(r.outputs.a1).toBe(1);
    expect(r.outputs.Ln).toBeCloseTo(1000, 9);
  });

  it("zorunlu (kart): runCalc ile '1000 milyon devir' ve '11 111 sa'", () => {
    const r = run({});
    if (!r.ok) throw new Error(JSON.stringify(r));
    const L10 = r.outputs.find((o) => o.key === "L10");
    const L10h = r.outputs.find((o) => o.key === "L10h");
    expect(L10).toMatchObject({ unitSymbol: "milyon devir", formatted: "1000 milyon devir" });
    // Binlik ayırıcı U+202F
    expect(L10h).toMatchObject({ unit: "h", formatted: "11 111 sa" });
    expect(r.outputs.map((o) => o.key)).toEqual(["L10", "L10h", "a1", "Ln", "Lnh"]);
  });

  it("makaralı: C/P = 10, 1500 dev/dk → 10^(10/3) = 2154,43 milyon devir, 23 938,2 sa", () => {
    // Elle: 10^(10/3) = 2154,4347; 10⁶/90 000·2154,4347 = 23 938,163 sa
    const r = def.compute({ ...BASE, tip: "makarali" }, ctx);
    expect(r.outputs.L10).toBeCloseTo(2154.4347, 4);
    expect(r.outputs.L10h / HOUR).toBeCloseTo(23938.163, 3);
  });

  it("ömür devirle ters orantılı, milyon devir devirden bağımsız", () => {
    const a = def.compute(BASE, ctx).outputs;
    const b = def.compute({ ...BASE, n: 3000 * RPM }, ctx).outputs;
    expect(b.L10).toBe(a.L10);
    expect(b.L10h).toBeCloseTo(a.L10h / 2, 6);
  });
});

describe("güvenilirlik düzeltmesi (a₁, SKF Tablo 3)", () => {
  const A1: [string, number][] = [
    ["90", 1],
    ["95", 0.64],
    ["96", 0.55],
    ["97", 0.47],
    ["98", 0.37],
    ["99", 0.25],
  ];
  it.each(A1)("%%%s → a₁ = %d", (R, a1) => {
    const r = def.compute({ ...BASE, R }, ctx);
    expect(r.outputs.a1).toBe(a1);
    expect(r.outputs.Ln).toBeCloseTo(1000 * a1, 9);
    expect(r.outputs.Lnh / HOUR).toBeCloseTo(11111.111 * a1, 2);
  });

  it("%99: L₁ = 250 milyon devir, 2777,8 sa; adımlarda düzeltme gösterilir", () => {
    const r = def.compute({ ...BASE, R: "99" }, ctx);
    expect(r.outputs.Ln).toBeCloseTo(250, 9);
    expect(r.outputs.Lnh / HOUR).toBeCloseTo(2777.778, 3);
    expect(r.steps.some((s) => s.latex.includes("0{,}25 \\cdot 1000\\,\\text{milyon devir} = 250\\,\\text{milyon devir}"))).toBe(true);
    // %90'da düzeltme adımı yok
    expect(def.compute(BASE, ctx).steps).toHaveLength(2);
  });
});

describe("eşdeğer yük X·F_r + Y·F_a", () => {
  it("F_r 3 kN, F_a 1 kN, X 0,56, Y 1,8 (keyfi girdiler), C 25 kN, 3000 dev/dk → P 3,48 kN, 2059,73 sa", () => {
    // Elle: P = 0,56·3 + 1,8·1 = 3,48 kN; (25/3,48)³ = 370,7510; 10⁶/(60·3000)·370,751 = 2059,728 sa
    const r = def.compute({ ...BASE, yuk: "xy", Fr: 3 * KN, Fa: 1 * KN, X: 0.56, Y: 1.8, n: 3000 * RPM }, ctx);
    expect(r.outputs.P).toBeCloseTo(3480, 9);
    expect(r.outputs.L10).toBeCloseTo(370.751, 3);
    expect(r.outputs.L10h / HOUR).toBeCloseTo(2059.728, 3);
    expect(r.checks.some((c) => /X ve Y/.test(c.message))).toBe(true);
  });

  it("eşdeğer yük sıfırsa hata (yalnız X·F_r + Y·F_a modunda)", () => {
    const zero = { ...BASE, yuk: "xy", Fr: 0, Fa: 2 * KN, X: 1, Y: 0 };
    expect(def.validate?.(zero, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.compute(zero, ctx).outputs).toEqual({});
    expect(def.validate?.(BASE, ctx)).toEqual([]);
  });

  it("doğrudan modda P çıktısı yok", () => {
    expect(def.compute(BASE, ctx).outputs).not.toHaveProperty("P");
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("C 30 700 N, P 4200 N, makaralı, 25 dev/s, %95 → 757,93 / 485,08 milyon devir, 8421,5 / 5389,7 sa", () => {
    // Elle: (30 700/4200)^(10/3) = 757,9321; 25 dev/s = 1500 dev/dk → 10⁶/90 000·757,9321 = 8421,467 sa;
    // a₁ = 0,64 → 485,0765 milyon devir, 5389,739 sa
    const r = run({
      tip: { value: "makarali" },
      C: { value: "30700", unit: "N" },
      P: { value: "4200", unit: "N" },
      n: { value: "25", unit: "rps" },
      R: { value: "95" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.L10).toBeCloseTo(757.9321, 4);
    expect(o.L10h / HOUR).toBeCloseTo(8421.467, 3);
    expect(o.a1).toBe(0.64);
    expect(o.Ln).toBeCloseTo(485.0765, 4);
    expect(o.Lnh / HOUR).toBeCloseTo(5389.739, 3);
    expect(r.outputs.find((x) => x.key === "Lnh")).toMatchObject({ unit: "h", formatted: "5390 sa" });
  });

  it("X·F_r + Y·F_a: N ve rad/s ile", () => {
    // Elle: P = 1·2000 + 2·500 = 3000 N; (25 000/3000)³ = 578,7037; ω = 100 rad/s → n = 954,93 dev/dk;
    // L₁₀h = 578,7037·10⁶·2π/100 s = 3,636 103·10⁷ s = 10 100,285 sa
    const r = run(
      {
        yuk: { value: "xy" },
        Fr: { value: "2000", unit: "N" },
        Fa: { value: "500", unit: "N" },
        X: { value: "1", unit: "unitless" },
        Y: { value: "2", unit: "unitless" },
        n: { value: "100", unit: "rad_s" },
      },
      { P: "N" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.P).toBeCloseTo(3000, 9);
    expect(r.result.outputs.L10).toBeCloseTo(578.7037, 4);
    expect(r.result.outputs.L10h / HOUR).toBeCloseTo(10100.285, 3);
    expect(r.outputs.find((x) => x.key === "P")).toMatchObject({ unit: "N", formatted: "3000 N" });
  });
});
