/**
 * 6.4 Servo boyutlandırma testleri (gerçek birim sistemiyle).
 * Kural: i = motor devri / yük devri; J_yük ve T_yük yük milinde, devir motor milinde.
 * Beklenen değerler elle hesaptır; RMS tork THK çözümlü örneğiyle karşılaştırılır
 * (https://tech.thk.com/en/products/pdf/en_b15_069.pdf: T_k 4730, T_t 120, T_g 4490 N·mm; t 0,15/0,85/0,15/2,6 s
 * → T_rms 1305 N·mm; J = 3,39×10⁻³, J_m = 1×10⁻³ kg·m², 1500 dev/dk, ω′ ≈ 1050 rad/s²).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { LIMITS } from "@/config/sinirlar";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { servoBoyutlandirma as def } from "./servo-boyutlandirma";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;

const BASE: ComputeInputs = {
  Jm: 1e-3,
  JL: 0.05,
  i: 5,
  eta: 0.95,
  TL: 20,
  n: 3000 * RPM,
  ta: 0.1,
  tc: 0.5,
  td: 0.1,
  tb: 0.5,
  oranMaks: 10,
};

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("yansıyan atalet ve tork (i ≠ 1, ZORUNLU)", () => {
  it("i = 5: J_yük/i² = 0,002 kg·m² (J/i = 0,01 ve J·i² = 1,25 değil); T_yük/(i·η) = 4,2105 N·m", () => {
    // Elle: J_yük,y = 0,05/25 = 0,002; J_top = 0,001 + 0,002 = 0,003 kg·m²; oran = 2;
    // T_L,m = 20/(5·0,95) = 4,210526 N·m (T/i = 4, T·η/i = 3,8 değil); n_yük = 3000/5 = 600 dev/dk
    const o = def.compute(BASE, ctx).outputs;
    expect(o.JLy).toBeCloseTo(0.002, 12);
    expect(o.JLy).not.toBeCloseTo(0.01, 6);
    expect(o.JLy).not.toBeCloseTo(1.25, 6);
    expect(o.Jtop).toBeCloseTo(0.003, 12);
    expect(o.oran).toBeCloseTo(2, 12);
    expect(o.TLm).toBeCloseTo(4.2105263, 7);
    expect(o.TLm).not.toBeCloseTo(4, 3);
    expect(o.TLm).not.toBeCloseTo(3.8, 3);
    expect(o.nYuk / RPM).toBeCloseTo(600, 9);
  });

  it("trapez profil: α 3141,59 rad/s², T₁ 13,6353, T₂ 4,2105, T₃ −5,2143, T_rms 5,0146 N·m", () => {
    // Elle: ω = 314,1593 rad/s; α = 3141,593 rad/s²; T_a = 0,003·3141,593 = 9,424778 N·m;
    // T₁ = 9,424778 + 4,210526 = 13,635304; T₃ = 4,210526 − 9,424778 = −5,214252;
    // T_rms = √((13,635304²·0,1 + 4,210526²·0,5 + 5,214252²·0,1)/1,2) = 5,014584 N·m; P = 13,635304·314,1593 = 4283,66 W
    const o = def.compute(BASE, ctx).outputs;
    expect(o.alfaA).toBeCloseTo(3141.5927, 3);
    expect(o.Ta).toBeCloseTo(9.424778, 6);
    expect(o.T1).toBeCloseTo(13.635304, 6);
    expect(o.T2).toBeCloseTo(4.210526, 6);
    expect(o.T3).toBeCloseTo(-5.214252, 6);
    expect(o.Trms).toBeCloseTo(5.014584, 6);
    expect(o.Ptepe).toBeCloseTo(4283.657, 3);
  });
});

describe("THK çözümlü örneği", () => {
  it("J 3,39×10⁻³ + J_m 1×10⁻³, 1500 dev/dk, 0,15 s, T_L 120 N·mm: T_rms ≈ 1305 N·mm", () => {
    // Elle (α = 1047,198 rad/s²): T_a = 4,39×10⁻³·1047,198 = 4,597197; T₁ = 4,717197; T₃ = −4,477197;
    // T_rms = √((4,717197²·0,15 + 0,12²·0,85 + 4,477197²·0,15)/3,75) = 1,301981 N·m.
    // THK α'yı 1050 rad/s²'ye yuvarlar (T_k 4730, T_g 4490 N·mm) ve 1305 N·mm bulur; fark %0,3.
    const o = def.compute(
      { Jm: 1e-3, JL: 3.39e-3, i: 1, eta: 1, TL: 0.12, n: 1500 * RPM, ta: 0.15, tc: 0.85, td: 0.15, tb: 2.6, oranMaks: 10 },
      ctx,
    ).outputs;
    expect(o.T1).toBeCloseTo(4.717197, 6);
    expect(o.T3).toBeCloseTo(-4.477197, 6);
    expect(o.Trms).toBeCloseTo(1.301981, 6);
    expect(Math.abs(o.Trms - 1.305) / 1.305).toBeLessThan(0.005);
  });
});

describe("atalet oranı kontrolü", () => {
  it("oran 20 > 10 → uyarı (THK referanslı); 2 < 10 → ok", () => {
    // Elle: 0,5/25 = 0,02 kg·m²; 0,02/0,001 = 20
    const r = def.compute({ ...BASE, JL: 0.5 }, ctx);
    expect(r.outputs.oran).toBeCloseTo(20, 12);
    const w = r.checks.filter((c) => c.level === "uyari");
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/20.*10/);
    expect(w[0].reference?.title).toBe("Studying the Driving Motor");
    expect(def.compute(BASE, ctx).checks.every((c) => c.level === "ok")).toBe(true);
  });

  it("izin verilen oranın varsayılanı config'te (THK: normalde 3–10, üst uç)", () => {
    expect(LIMITS.mekatronikTahrik.servoAtaletOrani.tipikUst).toBe(10);
    expect(defaultState(def).oranMaks.value).toBe("10");
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("12000 g·cm², 0,03 kg·m², i 3, η 0,9, 15 N·m, 30 dev/s, 50 ms / 1 s / 80 ms / 0", () => {
    // Elle: J_yük,y = 0,03/9 = 3,33333×10⁻³; J_top = 4,53333×10⁻³ kg·m²; oran = 2,77778;
    // T_L,m = 15/(3·0,9) = 5,555556; ω = 188,4956 rad/s; T₁ = 4,53333×10⁻³·188,4956/0,05 + 5,555556 = 22,645820;
    // T₃ = 5,555556 − 4,53333×10⁻³·188,4956/0,08 = −5,125859; T_rms = √((22,64582²·0,05 + 5,555556²·1 + 5,125859²·0,08)/1,13)
    // = 7,201758 N·m; P = 22,64582·188,4956 = 4,268636 kW
    const r = run(
      {
        Jm: { value: "12000", unit: "gcm2" },
        JL: { value: "0,03", unit: "kgm2" },
        i: { value: "3", unit: "unitless" },
        eta: { value: "0,9", unit: "fraction" },
        TL: { value: "15", unit: "Nm" },
        n: { value: "30", unit: "rps" },
        ta: { value: "50", unit: "ms" },
        tc: { value: "1", unit: "s" },
        td: { value: "80", unit: "ms" },
        tb: { value: "0", unit: "s" },
      },
      { T1: "Ncm", Jtop: "kgcm2" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.JLy).toBeCloseTo(3.333333e-3, 9);
    expect(o.Jtop).toBeCloseTo(4.533333e-3, 9);
    expect(o.oran).toBeCloseTo(2.777778, 6);
    expect(o.TLm).toBeCloseTo(5.555556, 6);
    expect(o.T1).toBeCloseTo(22.64582, 5);
    expect(o.T3).toBeCloseTo(-5.125859, 6);
    expect(o.Trms).toBeCloseTo(7.201758, 6);
    expect(o.Ptepe).toBeCloseTo(4268.636, 3);
    const t1 = r.outputs.find((x) => x.key === "T1");
    expect(t1?.unit).toBe("Ncm");
    expect(t1?.value).toBeCloseTo(2264.582, 3);
  });
});
