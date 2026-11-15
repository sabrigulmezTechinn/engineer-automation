/**
 * 2.4 Kompanzasyon testleri (gerçek birim sistemiyle).
 *
 * Kaynaklı örnek: ENTES "Alçak Gerilim Güç Kondansatörleri" (04.2015) s. 53: 100 kW, 50 kVAr → 111,8 kVA, cos φ 0,894;
 *   33 kVAr kondansatörle 17 kVAr, 101,4 kVA, cos φ 0,986. Elle: tan φ₂ = √(1 − 0,986²)/0,986 = 0,16911;
 *   Q_c = 100·(0,5 − 0,16911) = 33,09 kVAr.
 * Kaynaklı kapasite: aynı katalog s. 55, ENT.CXD-400-10: 10 kVAr, 400 V → 3×66 µF. Elle: 10⁴/(3·2π·50·400²) = 66,31 µF.
 * EPDK sınırları (config, Madde 13): ≥ 50 kVA endüktif %20 / kapasitif %15; < 50 kVA %33 / %20.
 *   cos φ 0,98 → tan = 0,20306 > 0,20 (≥ 50 kVA'da sağlamaz, < 50 kVA'da sağlar). Sınır cos φ = 1/√1,04 = 0,9806.
 * Varsayılan örnek (elle): 250 kW, cos φ 0,75 → 0,99: tan φ₁ = 0,88192, tan φ₂ = 0,14249, Q_c = 184,86 kvar;
 *   kademe kuralı: 50, 50, 50 (kalan 34,86) → 30 (kalan 4,86) → hiçbiri sığmaz → en küçük 5 → toplam 185 kvar;
 *   tan φ_k = 0,88192 − 185/250 = 0,14192 → cos φ_k = 0,99008.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { kompanzasyon as def, selectSteps } from "./kompanzasyon";

const ctx = defaultContext();
const KATALOG = [5e3, 7.5e3, 10e3, 12.5e3, 15e3, 20e3, 25e3, 30e3, 50e3];

function run(state: InputState) {
  const r = runCalc(def, { ...defaultState(def), ...state });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

describe("Q_c = P·(tan φ₁ − tan φ₂)", () => {
  it("ENTES örneği: 100 kW, Q/P = %50 → cos φ₁ 0,894, S₁ 111,8 kVA; hedef 0,986 → Q_c ≈ 33 kVAr, S₂ 101,4 kVA", () => {
    const r = def.compute(
      { P: 100e3, mevcut: "oran", oran1: 0.5, hedefKarakter: "enduktif", cos2: 0.986, sinif: "buyuk", katalog: KATALOG, U: 400, f: 50 },
      ctx,
    );
    expect(r.outputs.cos1).toBeCloseTo(0.8944, 4);
    expect(r.outputs.S1).toBeCloseTo(111803.4, 0);
    expect(r.outputs.Qc).toBeCloseTo(33088.7, 0);
    expect(r.outputs.S2).toBeCloseTo(101420, -1);
    expect(r.outputs.Q1).toBeCloseTo(50e3, 6);
  });

  it("varsayılanlar: 184,86 kvar, önerilen 3×50 + 30 + 5 = 185 kvar, cos φ_k 0,9901", () => {
    const r = run({});
    const o = r.result.outputs;
    expect(o.Qc).toBeCloseTo(184856.2, 0);
    expect(o.Qk).toBeCloseTo(185e3, 6);
    expect(o.cosK).toBeCloseTo(0.99008, 5);
    expect(r.result.checks[0].message).toMatch(/3 × 50 kvar \+ 1 × 30 kvar \+ 1 × 5 kvar = 185 kvar/);
    expect(r.result.checks.filter((c) => c.level === "uyari")).toEqual([]);
  });

  it("kapasitif hedef: tan φ₂ negatif, Q_c büyür", () => {
    // P 100 kW, cos φ₁ 0,8 (tan 0,75), hedef 0,99 kapasitif (tan −0,14249) → Q_c = 100·0,89249 = 89,249 kvar
    const r = def.compute(
      { P: 100e3, mevcut: "cos", cos1: 0.8, hedefKarakter: "kapasitif", cos2: 0.99, sinif: "buyuk", katalog: KATALOG, U: 400, f: 50 },
      ctx,
    );
    expect(r.outputs.Qc).toBeCloseTo(89249.2, 0);
    expect(r.outputs.oran2).toBeCloseTo(0.14249, 5);
  });
});

describe("kademe önerisi kuralı", () => {
  it("kalanı aşmayan en büyük; sığmazsa en küçük", () => {
    expect(selectSteps(184.856, [5, 7.5, 10, 12.5, 15, 20, 25, 30, 50])).toEqual([50, 50, 50, 30, 5]);
    expect(selectSteps(100, [10, 50])).toEqual([50, 50]);
    expect(selectSteps(3, [5, 10])).toEqual([5]);
    expect(selectSteps(12.5, [2.5, 5, 7.5])).toEqual([7.5, 5]);
  });
});

describe("EPDK sınır kontrolü (config: Madde 13)", () => {
  const base = { P: 100e3, mevcut: "cos", cos1: 0.8, hedefKarakter: "enduktif", katalog: KATALOG, U: 400, f: 50 };

  it("hedef 0,98: ≥ 50 kVA'da uyarı (tan 0,2031 > %20, sınır cos φ 0,9806), < 50 kVA'da uygun", () => {
    const big = def.compute({ ...base, cos2: 0.98, sinif: "buyuk" }, ctx);
    const w = big.checks.find((c) => c.level === "uyari" && /Hedef/.test(c.message));
    expect(w?.message).toMatch(/%20,31 > %20/);
    expect(w?.message).toMatch(/0,9806/);
    expect(w?.reference?.clause).toBe("Madde 13, EK-1");
    const small = def.compute({ ...base, cos2: 0.98, sinif: "kucuk" }, ctx);
    expect(small.checks.some((c) => c.level === "uyari" && /Hedef/.test(c.message))).toBe(false);
    expect(ctx.limits.tesisatGuc.epdkReaktif.kucuk.enduktif).toBe(0.33);
  });

  it("aşırı kompanzasyon: 20 kW, cos φ₁ 0,95 → 1,0: Q_c 6,57 kvar, önerilen 5 + 5 = 10 kvar → kapasitif %17,13 > %15", () => {
    // tan φ₁ = 0,32868; 5 (kalan 1,57) → sığmaz → 5; tan φ_k = 0,32868 − 10/20 = −0,17132
    const r = def.compute({ ...base, P: 20e3, cos1: 0.95, cos2: 1, sinif: "buyuk" }, ctx);
    expect(r.outputs.Qc).toBeCloseTo(6573.68, 1);
    expect(r.outputs.Qk).toBeCloseTo(10e3, 6);
    expect(r.outputs.oranK).toBeCloseTo(0.17132, 5);
    const w = r.checks.find((c) => c.level === "uyari");
    expect(w?.message).toMatch(/kapasitif oran %17,13 > %15/);
  });

  it("muaf sınıf: sınır kontrolü yok, bilgi mesajı", () => {
    const r = def.compute({ ...base, cos2: 0.9, sinif: "muaf" }, ctx);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
    expect(r.checks.some((c) => /15 kW/.test(c.message))).toBe(true);
  });

  it("hedef zaten sağlanıyorsa hata (Q_c ≤ 0)", () => {
    expect(def.validate?.({ ...base, cos1: 0.99, cos2: 0.95, sinif: "buyuk" }, ctx)).toEqual([
      expect.objectContaining({ level: "hata" }),
    ]);
  });
});

describe("faz başına kapasite", () => {
  it("10 kvar, 400 V, 50 Hz → 66,31 µF (ENT.CXD-400-10: 3×66 µF)", () => {
    // Q_c = 10 kvar: P 100 kW, oran %60 → hedef tan 0,5 (cos φ₂ = 1/√1,25)
    const r = def.compute(
      { P: 100e3, mevcut: "oran", oran1: 0.6, hedefKarakter: "enduktif", cos2: 1 / Math.sqrt(1.25), sinif: "buyuk", katalog: KATALOG, U: 400, f: 50 },
      ctx,
    );
    expect(r.outputs.Qc).toBeCloseTo(10e3, 6);
    expect(r.outputs.C * 1e6).toBeCloseTo(66.3146, 3);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("0,4 MW, oran 0,6 (kesir), hedef 0,995 kapasitif, katalog var cinsinden, 0,4 kV", () => {
    // Elle: tan φ₂ = −0,100377; Q_c = 400·(0,6 + 0,100377) = 280,151 kvar
    // Kural: 50×5 = 250 (kalan 30,15) → 20 (kalan 10,15) → sığmaz → 20 → 290 kvar; tan φ_k = 0,6 − 0,725 = −0,125
    // C = 280 151/(3·2π·50·400²) = 1857,8 µF
    const r = run({
      P: { value: "0,4", unit: "MW" },
      mevcut: { value: "oran" },
      oran1: { value: "0,6", unit: "fraction" },
      hedefKarakter: { value: "kapasitif" },
      cos2: { value: "0,995" },
      katalog: { value: "20000; 50000", unit: "var" },
      U: { value: "0,4", unit: "kV" },
    });
    const o = r.result.outputs;
    expect(o.Qc).toBeCloseTo(280150.7, 0);
    expect(o.Qk).toBeCloseTo(290e3, 6);
    expect(o.oranK).toBeCloseTo(0.125, 9);
    expect(o.cosK).toBeCloseTo(1 / Math.sqrt(1 + 0.125 ** 2), 9);
    expect(o.C * 1e6).toBeCloseTo(1857.81, 1);
    expect(r.result.checks.filter((c) => c.level === "uyari")).toEqual([]);
  });
});
