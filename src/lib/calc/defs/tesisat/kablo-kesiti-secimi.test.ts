/**
 * 2.1 Kablo kesiti seçimi testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır (k_t = √((θ_maks − θ_ort)/(θ_maks − θ_ref)), I_z = I₀·k_t·k_g·k_ρ) ve
 * katalog değerleri Prysmian sayfalarından (NYY s. 73, YXV s. 89; kablo-verileri.ts). I₂ oranları config'teki
 * kaynaklı değerlerdir (MCB 1,45; gG ≥ 16 A 1,6; kompakt 1,3).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { kabloKesitiSecimi as def } from "./kablo-kesiti-secimi";

const ctx = defaultContext();
const C = (celsius: number) => celsius + 273.15;

/** Katalog NYY, havada 40 °C, tek devre, I_b = 45 A, MCB 50 A (varsayılan örnek) */
const BASE: ComputeInputs = {
  Ib: 45,
  yontem: "katalog_nyy",
  doseme: "hava",
  thetaHava: C(40),
  kGrup: 1,
  koruma: "mcb",
  In: 50,
};

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("sıcaklık düzeltme katsayısı", () => {
  it("zorunlu: PVC (70 °C), ortam 40 °C, referans 30 °C → k_t = √(30/40) = 0,866", () => {
    // Elle: √((70 − 40)/(70 − 30)) = √0,75 = 0,8660254
    const r = def.compute({ ...BASE, yontem: "elle", yalitkan: "pvc", I0: 59, koruma: "yok" }, ctx);
    expect(r.outputs.kt).toBeCloseTo(Math.sqrt(30 / 40), 12);
    expect(r.outputs.kt).toBeCloseTo(0.866, 3);
  });

  it("XLPE toprakta 30 °C (referans 20 °C) → k_t = √(60/70) = 0,92582", () => {
    const r = def.compute(
      { Ib: 100, yontem: "katalog_yxv", doseme: "toprak", thetaToprak: C(30), kGrup: 0.8, kToprak: 1, koruma: "yok" },
      ctx,
    );
    expect(r.outputs.kt).toBeCloseTo(0.92582010, 7);
  });
});

describe("(a) katalog yolu", () => {
  it("NYY havada 40 °C, I_b 45 A, MCB 50 A → 10 mm² (I₀ 59 A, I_z 51,10 A)", () => {
    // Elle: gereken I₀ ≥ max(45, 50, 72,5/1,45)/0,86603 = 57,735 A → katalog havada: 6 mm² 43 A yetmez, 10 mm² 59 A
    // I_z = 59·0,86603 = 51,0955 A; I₂ = 1,45·50 = 72,5 A ≤ 1,45·51,0955 = 74,0885 A
    const r = def.compute(BASE, ctx);
    expect(r.outputs.kesit).toBeCloseTo(10e-6, 12);
    expect(r.outputs.I0).toBe(59);
    expect(r.outputs.Iz).toBeCloseTo(51.095499, 5);
    expect(r.outputs.I2).toBeCloseTo(72.5, 9);
    expect(r.outputs.I2sinir).toBeCloseTo(74.088473, 5);
    expect(r.outputs.R20).toBeCloseTo(1.83e-3, 12);
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("aynı devre gG 50 A ile → 16 mm² (I₂ = 80 A, I_z ≥ 80/1,45 = 55,17 A gerekir)", () => {
    // Elle: 10 mm² I_z = 51,10 A → 1,45·51,10 = 74,09 < 80 ✗; 16 mm² I_z = 79·0,86603 = 68,416 A ✓
    const r = def.compute({ ...BASE, koruma: "gG" }, ctx);
    expect(r.outputs.kesit).toBeCloseTo(16e-6, 12);
    expect(r.outputs.I0).toBe(79);
    expect(r.outputs.Iz).toBeCloseTo(68.416007, 5);
    expect(r.outputs.I2).toBeCloseTo(80, 9);
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("koruma yok: yalnızca I_z ≥ I_b (45/0,866 = 51,96 A → 10 mm²)", () => {
    const r = def.compute({ ...BASE, koruma: "yok" }, ctx);
    expect(r.outputs.kesit).toBeCloseTo(10e-6, 12);
    expect(r.outputs).not.toHaveProperty("I2");
    expect(r.outputs).not.toHaveProperty("I2sinir");
  });

  it("YXV toprakta 30 °C, k_g 0,8, I_b 100 A → 25 mm² (I₀ 145 A, I_z 107,40 A)", () => {
    // Elle: k = 0,92582·0,8 = 0,74066; gereken I₀ ≥ 100/0,74066 = 135,02 A → toprakta 16 mm² 112 A yetmez, 25 mm² 145 A
    // I_z = 145·0,74066 = 107,395 A
    const r = def.compute(
      { Ib: 100, yontem: "katalog_yxv", doseme: "toprak", thetaToprak: C(30), kGrup: 0.8, kToprak: 1, koruma: "yok" },
      ctx,
    );
    expect(r.outputs.k).toBeCloseTo(0.74065608, 7);
    expect(r.outputs.kesit).toBeCloseTo(25e-6, 12);
    expect(r.outputs.I0).toBe(145);
    expect(r.outputs.Iz).toBeCloseTo(107.39513, 4);
    // Toprakta katalog değerleri 0,7 yük faktörü içindir: bilgi notu
    expect(r.checks.some((c) => /0,7 yük faktörü \(çevrimsel yük\)/.test(c.message))).toBe(true);
  });

  it("katalogdaki en büyük kesit yetmezse uyarı, kesit çıktısı yok", () => {
    // Elle: 400 mm² havada 597·0,86603 = 517,0 A < 700 A
    const r = def.compute({ ...BASE, Ib: 700, koruma: "yok" }, ctx);
    expect(r.outputs).not.toHaveProperty("kesit");
    expect(r.outputs).not.toHaveProperty("Iz");
    expect(r.outputs.kt).toBeCloseTo(0.8660254, 7);
    const w = r.checks.filter((c) => c.level === "uyari");
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/400 mm².*517 A/);
  });

  it("I_n < I_b ise uyarı (kesit yine kabloya bağlı koşullarla seçilir)", () => {
    const r = def.compute({ ...BASE, In: 40 }, ctx);
    expect(r.outputs.kesit).toBeCloseTo(10e-6, 12);
    expect(r.checks.some((c) => c.level === "uyari" && /tasarım akımından küçük/.test(c.message))).toBe(true);
  });
});

describe("(b) I₀ elle", () => {
  it("EPR, havada 35 °C, k_g 0,7, I₀ 100 A, kompakt I_r 60 A → I_z 67,02 A, I₂ 78 A", () => {
    // Elle: k_t = √((90 − 35)/(90 − 30)) = 0,957427; k = 0,670199; I_z = 67,0199 A;
    // I₂ = 1,3·60 = 78 A ≤ 1,45·67,0199 = 97,179 A; 55 ≤ 60 ≤ 67,02
    const r = def.compute(
      { Ib: 55, yontem: "elle", yalitkan: "epr", I0: 100, doseme: "hava", thetaHava: C(35), kGrup: 0.7, koruma: "kompakt", In: 60 },
      ctx,
    );
    expect(r.outputs.kt).toBeCloseTo(0.95742711, 7);
    expect(r.outputs.Iz).toBeCloseTo(67.019898, 5);
    expect(r.outputs.I2).toBeCloseTo(78, 9);
    expect(r.outputs.I2sinir).toBeCloseTo(97.178851, 5);
    expect(r.outputs).not.toHaveProperty("kesit");
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([]);
    // Kompakt şalterde koruma akımı I_r diye adlandırılır
    expect(r.checks.some((c) => /I_b ≤ I_r ≤ I_z/.test(c.message))).toBe(true);
    expect(r.steps.some((s) => s.latex.includes("I_r = 60"))).toBe(true);
  });

  it("referans sıcaklığı elle verilebilir (25 °C → k_t = √(30/45))", () => {
    const r = def.compute({ ...BASE, yontem: "elle", yalitkan: "pvc", I0: 59, thetaRef: C(25), koruma: "yok" }, ctx);
    expect(r.outputs.kt).toBeCloseTo(Math.sqrt(30 / 45), 12);
  });

  it("I_z < I_b → uyarı", () => {
    const r = def.compute({ ...BASE, yontem: "elle", yalitkan: "pvc", I0: 50, koruma: "yok" }, ctx);
    expect(r.checks.some((c) => c.level === "uyari" && /taşıyamıyor/.test(c.message))).toBe(true);
  });
});

describe("gG sigortada I₂", () => {
  it("I_n < 16 A ve oran girilmemiş → I₂ denetlenemez uyarısı, I₂ çıktısı yok", () => {
    const r = def.compute({ ...BASE, Ib: 9, In: 10, koruma: "gG" }, ctx);
    expect(r.outputs).not.toHaveProperty("I2");
    expect(r.checks.some((c) => c.level === "uyari" && /I₂ doğrulanamadı/.test(c.message))).toBe(true);
  });

  it("I_n < 16 A, veri sayfasından oran 1,75 → I₂ = 17,5 A", () => {
    const r = def.compute({ ...BASE, Ib: 9, In: 10, koruma: "gG", k2: 1.75 }, ctx);
    expect(r.outputs.I2).toBeCloseTo(17.5, 9);
    expect(r.checks.some((c) => /I₂ doğrulanamadı/.test(c.message))).toBe(false);
  });
});

describe("doğrulama", () => {
  it("ortam sıcaklığı θ_maks'a eşit veya büyükse hata", () => {
    expect(def.validate?.({ ...BASE, thetaHava: C(70) }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.validate?.({ ...BASE, thetaHava: C(75) }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.compute({ ...BASE, thetaHava: C(75) }, ctx).outputs).toEqual({});
    // XLPE'de 75 °C geçerli
    expect(def.validate?.({ ...BASE, yontem: "katalog_yxv", thetaHava: C(75) }, ctx)).toEqual([]);
    expect(def.validate?.(BASE, ctx)).toEqual([]);
  });

  it("referans sıcaklığı θ_maks'tan küçük olmalı", () => {
    const bad = { ...BASE, yontem: "elle", yalitkan: "pvc", I0: 59, thetaRef: C(70) };
    expect(def.validate?.(bad, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("104 °F (= 40 °C), I_b 0,045 kA, I_n 0,05 kA → 10 mm², I_z 51,10 A", () => {
    const r = run({
      Ib: { value: "0,045", unit: "kA" },
      thetaHava: { value: "104", unit: "degF" },
      In: { value: "0,05", unit: "kA" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.kt).toBeCloseTo(0.8660254, 7);
    expect(r.result.outputs.kesit).toBeCloseTo(10e-6, 12);
    expect(r.result.outputs.Iz).toBeCloseTo(51.095499, 5);
    expect(r.outputs.find((o) => o.key === "kesit")).toMatchObject({ unit: "mm2", formatted: "10 mm²" });
    expect(r.outputs.find((o) => o.key === "R20")).toMatchObject({ unit: "ohm_per_km" });
  });

  it("elle yol, 313,15 K ortam (= 40 °C), I₀ 0,059 kA → I_z 51,10 A; çıktı mA birimiyle", () => {
    const r = run(
      {
        yontem: { value: "elle" },
        thetaHava: { value: "313,15", unit: "K" },
        I0: { value: "0,059", unit: "kA" },
        koruma: { value: "yok" },
      },
      { Iz: "mA" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.Iz).toBeCloseTo(51.095499, 5);
    expect(r.outputs.find((o) => o.key === "Iz")).toMatchObject({ unit: "mA" });
  });

  it("toprak varsayılanları (25 °C) NYY → 6 mm² (I_z 55,97 A)", () => {
    // Elle: k_t = √(45/50) = 0,948683; gereken I₀ ≥ 50/0,948683 = 52,70 A → toprakta 6 mm² 59 A; I_z = 55,972 A
    const r = run({ doseme: { value: "toprak" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.kesit).toBeCloseTo(6e-6, 12);
    expect(r.result.outputs.Iz).toBeCloseTo(55.972315, 5);
  });
});
