/**
 * 2.7 Topraklama direnci testleri (gerçek birim sistemiyle).
 *
 * d yarıçap mı çap mı? Dwight (1936) formülü R = ρ/(2πL)·[ln(4L/a) − 1] yarıçap a ile yazılır. Kaynak:
 *   https://eepower.com/technical-articles/how-to-improve-resistance-to-ground/ ("a = rod radius";
 *   "Dwight's formulas use the radius (a = d/2)") ve aynı makalenin örnekleri: ρ = 10 000 Ω·cm, L = 300 cm:
 *   d = 1,270 cm → ≈ 35 Ω; a = 0,794 cm → 34 Ω; a = 0,953 cm → 33 Ω; a = 0,953 cm, L = 600/900/1200 cm → 18/13/10 Ω.
 *   Bu sayılar yalnızca yarıçap yorumuyla çıkar (d = 12,7 mm'yi a yerine koymak 31,0 Ω verir).
 * Zorunlu test (elle): ρ = 100 Ω·m, L = 3 m, 16 mm çap → a = 8 mm: 100/(6π)·[ln(1500) − 1] = 33,49 Ω.
 *   16 mm'yi a yerine (yani KAPSAM'daki ln(4L/d) − 1'e çap olarak) koymak 29,82 Ω verir: yanlış.
 * Yönetmelik Ek-K (−1 terimi yok, d çap): 100/(6π)·ln(750) = 35,12 Ω.
 * Diğer elle hesaplar: şerit ρ/(πL)·ln(2L/d) = 100/(20π)·ln(2666,7) = 12,555 Ω; halka aynı uzunlukta aynı değer
 * (D = 20/π = 6,3662 m); kare levha 100/2,2 = 45,45 Ω; daire levha 100/2 = 50 Ω; gözlü D = 20 m → 2,5 Ω.
 * TT (Yönetmelik Çizelge-12 değerleri): IΔn 300 mA, U_L 50 V → 166 Ω; S tipi 300 mA → 83 Ω; U_L 25 V, 500 mA → 50 Ω;
 * Çizelge-11 altındaki örnek: I_a = 120 A → R_A = 50/120 = 0,417 Ω.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { topraklamaDirenci as def } from "./topraklama-direnci";

const ctx = defaultContext();

function run(state: InputState) {
  const r = runCalc(def, { ...defaultState(def), ...state });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

const ROD = { tip: "cubuk", formul: "dwight", rho: 100, L: 3, d: 0.016, tt: "yok" };

describe("çubuk: d yarıçap mı çap mı (zorunlu test)", () => {
  it("ρ 100 Ω·m, L 3 m, 16 mm çap → Dwight 33,49 Ω (yarıçap 8 mm); 29,82 Ω değil", () => {
    const r = def.compute(ROD, ctx);
    expect(r.outputs.R).toBeCloseTo(33.4927, 3);
    expect(Math.abs(r.outputs.R - 29.8154)).toBeGreaterThan(3);
  });

  it("varsayılan girdiler bu örnektir", () => {
    expect(run({ tt: { value: "yok" } }).result.outputs.R).toBeCloseTo(33.4927, 3);
  });

  it("eepower örnekleri (yarıçap yorumu): 35 / 34 / 33 Ω; uzunlukla 18 / 13 / 10 Ω", () => {
    const R = (L: number, d: number) => def.compute({ ...ROD, L, d }, ctx).outputs.R;
    expect(Math.round(R(3, 0.0127))).toBe(35); // 34,72
    expect(Math.round(R(3, 0.01588))).toBe(34); // 33,53
    expect(Math.round(R(3, 0.01906))).toBe(33); // 32,56
    expect(Math.round(R(6, 0.01906))).toBe(18); // 18,12
    expect(Math.round(R(9, 0.01906))).toBe(13); // 12,80
    expect(Math.round(R(12, 0.01906))).toBe(10); // 9,98
  });

  it("Yönetmelik Ek-K formülü: 35,12 Ω", () => {
    expect(def.compute({ ...ROD, formul: "yonetmelik" }, ctx).outputs.R).toBeCloseTo(35.1206, 3);
  });
});

describe("diğer topraklayıcılar", () => {
  it("paralel: 4 çubuk, η = 0,8 → 33,49/3,2 = 10,47 Ω", () => {
    const r = def.compute({ ...ROD, tip: "paralel", n: 4, eta: 0.8 }, ctx);
    expect(r.outputs.R1).toBeCloseTo(33.4927, 3);
    expect(r.outputs.R).toBeCloseTo(10.4665, 3);
    expect(r.checks.some((c) => /iki katı/.test(c.message))).toBe(true);
  });

  it("şerit ve halka (20 m, d = 15 mm): 12,555 Ω; halka çapı 6,366 m", () => {
    const s = def.compute({ tip: "serit", rho: 100, Lyatay: 20, dYatay: 0.015, tt: "yok" }, ctx);
    const h = def.compute({ tip: "halka", rho: 100, Lyatay: 20, dYatay: 0.015, tt: "yok" }, ctx);
    expect(s.outputs.R).toBeCloseTo(12.5551, 3);
    expect(h.outputs.R).toBeCloseTo(12.5551, 3);
    expect(h.outputs.Dhalka).toBeCloseTo(6.3662, 4);
  });

  it("levha ve gözlü: kare 45,45 Ω, daire 50 Ω, gözlü 2,5 Ω", () => {
    expect(def.compute({ tip: "levhaKare", rho: 100, Slevha: 1, tt: "yok" }, ctx).outputs.R).toBeCloseTo(45.4545, 3);
    expect(def.compute({ tip: "levhaDaire", rho: 100, Dlevha: 1, tt: "yok" }, ctx).outputs.R).toBeCloseTo(50, 9);
    expect(def.compute({ tip: "gozlu", rho: 100, Dgozlu: 20, tt: "yok" }, ctx).outputs.R).toBeCloseTo(2.5, 9);
  });
});

describe("TT sistem koşulu (Yönetmelik Madde 8-a4/ii, Çizelge-12)", () => {
  it("RCD 300 mA, U_L 50 V → 166,7 Ω; 33,49 Ω sağlar", () => {
    const r = def.compute({ ...ROD, tt: "rcd", UL: "50", IdN: 0.3 }, ctx);
    expect(r.outputs.RAmaks).toBeCloseTo(166.667, 2);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
  });

  it("S tipi 300 mA → 83,3 Ω; U_L 25 V, 500 mA → 50 Ω", () => {
    expect(def.compute({ ...ROD, tt: "rcdS", UL: "50", IdN: 0.3 }, ctx).outputs.RAmaks).toBeCloseTo(83.333, 2);
    expect(def.compute({ ...ROD, tt: "rcd", UL: "25", IdN: 0.5 }, ctx).outputs.RAmaks).toBeCloseTo(50, 9);
  });

  it("aşırı akım düzeni I_a = 120 A → 0,417 Ω; 33,49 Ω sağlamaz → uyarı + referans", () => {
    const r = def.compute({ ...ROD, tt: "ia", UL: "50", Ia: 120 }, ctx);
    expect(r.outputs.RAmaks).toBeCloseTo(0.41667, 4);
    const w = r.checks.find((c) => c.level === "uyari");
    expect(w?.message).toMatch(/sağlanmıyor/);
    expect(w?.reference?.clause).toMatch(/8-a4/);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("L = 300 cm, d = 0,625 inç (5/8″) → 33,53 Ω; RCD 0,03 A", () => {
    const r = run({
      L: { value: "300", unit: "cm" },
      d: { value: "0,625", unit: "in" },
      tt: { value: "rcd" },
      IdN: { value: "0,03", unit: "A" },
    });
    expect(r.result.outputs.R).toBeCloseTo(33.5343, 3);
    expect(r.result.outputs.RAmaks).toBeCloseTo(1666.67, 1);
  });
});

describe("doğrulama", () => {
  it("çubuk boyu çapa göre çok kısa → hata", () => {
    expect(def.validate?.({ ...ROD, L: 0.005, d: 0.016 }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.validate?.({ ...ROD, formul: "yonetmelik", L: 0.003, d: 0.016 }, ctx)).toEqual([
      expect.objectContaining({ level: "hata" }),
    ]);
    expect(def.validate?.({ tip: "serit", rho: 100, Lyatay: 0.005, dYatay: 0.015, tt: "yok" }, ctx)).toEqual([
      expect.objectContaining({ level: "hata" }),
    ]);
    expect(def.validate?.(ROD, ctx)).toEqual([]);
  });
});
