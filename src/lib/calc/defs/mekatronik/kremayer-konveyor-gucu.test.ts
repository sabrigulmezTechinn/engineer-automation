/**
 * 6.5 Kremayer-pinyon ve konveyör gücü testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır:
 *   d₀ = m·z (KHK Tablo 4.1), F = 2·T·η/d₀, T = F·d₀/(2η), v = π·d₀·n, P = T·ω;
 *   konveyör F = m·g·(μ·cos α + sin α) + m·a (basitleştirilmiş), P = F·v/η, T_tambur = F·D/2, n = v/(π·D).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { kremayerKonveyorGucu as def } from "./kremayer-konveyor-gucu";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;
const DEG = Math.PI / 180;

const RACK: ComputeInputs = { hesap: "kremayer", modul: 0.002, z: 20, bilinen: "tork", T: 10, n: 100 * RPM, etaK: 1 };
const CONV: ComputeInputs = {
  hesap: "konveyor",
  mKonv: 500,
  mu: 0.05,
  egim: 5 * DEG,
  a: 0.5,
  vBant: 0.5,
  etaKonv: 0.85,
  Dtambur: 0.2,
};

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("kremayer-pinyon", () => {
  it("m 2 mm, z 20, T 10 N·m, η 1: d₀ 40 mm, F = 2T/d₀ = 500 N, v 0,2094 m/s, P 104,72 W", () => {
    // Elle: d₀ = 2·20 = 40 mm; F = 2·10/0,04 = 500 N; v = π·0,04·100/60 = 0,209440 m/s; P = 10·10,47198 = 104,720 W
    const o = def.compute(RACK, ctx).outputs;
    expect(o.d0).toBeCloseTo(0.04, 12);
    expect(o.F).toBeCloseTo(500, 9);
    expect(o.v).toBeCloseTo(0.2094395, 7);
    expect(o.P).toBeCloseTo(104.71976, 5);
    expect(o).not.toHaveProperty("Fsabit");
  });

  it("verim kuvveti düşürür (η 0,95 → 475 N); kuvvetten tork: 500 N → 10,5263 N·m", () => {
    // Elle: 500·0,95 = 475 N; T = 500·0,04/(2·0,95) = 10,526316 N·m; P = 10,526316·10,47198 = 110,2313 W
    expect(def.compute({ ...RACK, etaK: 0.95 }, ctx).outputs.F).toBeCloseTo(475, 9);
    const o = def.compute({ ...RACK, bilinen: "kuvvet", F: 500, etaK: 0.95 }, ctx).outputs;
    expect(o.T).toBeCloseTo(10.526316, 6);
    expect(o.P).toBeCloseTo(110.23132, 5);
  });

  it("varsayılan dışı birimler (runCalc): m 3 mm, z 25, 2 kN, η 0,9, 2 dev/s", () => {
    // Elle: d₀ = 75 mm; T = 2000·0,075/(2·0,9) = 83,3333 N·m; v = 12,56637·0,0375 = 0,471239 m/s = 28,2743 m/dk;
    // P = 83,3333·12,56637 = 1,047198 kW
    const r = run(
      {
        modul: { value: "3", unit: "mm" },
        z: { value: "25", unit: "unitless" },
        bilinen: { value: "kuvvet" },
        F: { value: "2", unit: "kN" },
        n: { value: "2", unit: "rps" },
        etaK: { value: "0,9", unit: "fraction" },
      },
      { v: "m_min", T: "kgfm" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.d0).toBeCloseTo(0.075, 12);
    expect(o.T).toBeCloseTo(83.33333, 5);
    expect(o.v * 60).toBeCloseTo(28.274334, 6);
    expect(o.P).toBeCloseTo(1047.1976, 4);
    expect(r.outputs.find((x) => x.key === "v")?.unit).toBe("m_min");
  });
});

describe("konveyör (basitleştirilmiş)", () => {
  it("500 kg, μ 0,05, 5°, a 0,5 m/s², 0,5 m/s, η 0,85, Ø200: F 671,59/921,59 N, P 395,05/542,11 W", () => {
    // Elle: m·g = 4903,325 N; μ·cos 5° + sin 5° = 0,0498097 + 0,0871557 = 0,1369654; F_sabit = 671,5863 N;
    // F_ivme = 671,5863 + 250 = 921,5863 N; P_sabit = 671,5863·0,5/0,85 = 395,0507 W; P_tepe = 542,1096 W;
    // T_tambur = 921,5863·0,1 = 92,15863 N·m; n = 0,5/(π·0,2)·60 = 47,74648 dev/dk
    const o = def.compute(CONV, ctx).outputs;
    expect(o.Fsabit).toBeCloseTo(671.58625, 4);
    expect(o.Fivme).toBeCloseTo(921.58625, 4);
    expect(o.Psabit).toBeCloseTo(395.05074, 4);
    expect(o.Ptepe).toBeCloseTo(542.10956, 4);
    expect(o.Ttambur).toBeCloseTo(92.158625, 5);
    expect(o.nTambur / RPM).toBeCloseTo(47.746483, 5);
    expect(o).not.toHaveProperty("d0");
  });

  it("yatay ve dikey uç durumlar: α = 0 → F = μ·m·g; α = 90° → F = m·g", () => {
    // Elle: 0,1·1000·9,80665 = 980,665 N; P = 980,665·0,5/0,9 = 544,8139 W; 50·9,80665 = 490,3325 N
    const h = def.compute({ ...CONV, mKonv: 1000, mu: 0.1, egim: 0, a: 0, etaKonv: 0.9, Dtambur: 0.4 }, ctx).outputs;
    expect(h.Fsabit).toBeCloseTo(980.665, 9);
    expect(h.Fivme).toBeCloseTo(980.665, 9);
    expect(h.Psabit).toBeCloseTo(544.81389, 4);
    const v = def.compute({ ...CONV, mKonv: 50, egim: Math.PI / 2, a: 0 }, ctx).outputs;
    expect(v.Fsabit).toBeCloseTo(490.3325, 9);
  });

  it("varsayılan dışı birimler (runCalc): 1 t, μ 0,1, 0 rad, 30 m/dk, η %90, Ø0,4 m", () => {
    // Elle: yukarıdaki yatay durum; tambur torku 980,665·0,2 = 196,133 N·m; n = 0,5/(π·0,4)·60 = 23,87324 dev/dk
    const r = run(
      {
        hesap: { value: "konveyor" },
        mKonv: { value: "1", unit: "t" },
        mu: { value: "0,1", unit: "unitless" },
        egim: { value: "0", unit: "rad" },
        a: { value: "0", unit: "m_s2" },
        vBant: { value: "30", unit: "m_min" },
        etaKonv: { value: "90", unit: "percent" },
        Dtambur: { value: "0,4", unit: "m" },
      },
      { Psabit: "W" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.Fsabit).toBeCloseTo(980.665, 9);
    expect(o.Psabit).toBeCloseTo(544.81389, 4);
    expect(o.Ttambur).toBeCloseTo(196.133, 6);
    expect(o.nTambur / RPM).toBeCloseTo(23.873241, 5);
    expect(r.outputs.find((x) => x.key === "Psabit")?.formatted).toBe("544,8 W");
  });

  it("negatif eğim reddedilir (iniş: yük motoru sürer, P = F·v/η geçersiz)", () => {
    const r = run({ hesap: { value: "konveyor" }, egim: { value: "-5", unit: "deg" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.egim).toBeDefined();
  });

  it("basitleştirilmiş yöntem kontrol mesajında belirtilir (DIN 22101 referanslı)", () => {
    const r = def.compute(CONV, ctx);
    expect(r.checks[0].message).toMatch(/Basitleştirilmiş/);
    expect(r.checks[0].reference?.standard).toMatch(/DIN 22101/);
  });
});
