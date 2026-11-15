/**
 * 4.3 RC / LC filtre kesim frekansı testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır (f_c = 1/(2πRC), f_c = R/(2πL), f₀ = 1/(2π√(LC)); 1. derece H = 1/(1 + ju)).
 * Kaynak örnekleri: Microchip AN699 (DS00699B) "1 kHz ... 0,1 µF ... 1,59 kΩ"
 * (https://ww1.microchip.com/downloads/en/AppNotes/00699b.pdf); OpenStax University Physics Volume 2, Example 15.4:
 * L = 3,00 mH, C = 8,00×10⁻⁴ F → f₀ = 1,03×10² Hz
 * (https://openstax.org/books/university-physics-volume-2/pages/15-5-resonance-in-an-ac-circuit).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState, SelectInputSpec } from "@/lib/calc/types";
import { filtreKesimFrekansi as def } from "./filtre-kesim-frekansi";

const ctx = defaultContext();

const FC_RC = 1 / (2 * Math.PI * 10e3 * 10e-9); // 10 kΩ, 10 nF
const RC: ComputeInputs = { mod: "rc", tip: "lp", R: 10e3, C: 10e-9, f: 1000 };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("RC ve RL kesim frekansı", () => {
  it("10 kΩ + 10 nF → 1591,55 Hz, τ = 100 µs", () => {
    // Elle: f_c = 1/(2π · 10⁴ · 10⁻⁸) = 1/(2π · 10⁻⁴) = 1591,549 Hz
    const o = def.compute(RC, ctx).outputs;
    expect(o.fc).toBeCloseTo(1591.55, 2);
    expect(o.tau).toBeCloseTo(1e-4, 15);
  });

  it("alçak geçiren, f = f_c: −3,0103 dB ve −45°", () => {
    // Elle: |H| = 1/√2 = 0,707107; G = 20·log₁₀(1/√2) = −3,0103 dB; φ = −arctan 1 = −π/4
    const o = def.compute({ ...RC, f: FC_RC }, ctx).outputs;
    expect(o.H).toBeCloseTo(0.7071068, 7);
    expect(o.G).toBeCloseTo(-3.0103, 4);
    expect(o.phi).toBeCloseTo(-Math.PI / 4, 12);
  });

  it("yüksek geçiren, f = f_c: −3,0103 dB ve +45°", () => {
    const o = def.compute({ ...RC, tip: "hp", f: FC_RC }, ctx).outputs;
    expect(o.G).toBeCloseTo(-3.0103, 4);
    expect(o.phi).toBeCloseTo(Math.PI / 4, 12);
  });

  it("RL alçak geçiren 100 Ω, 10 mH: f_c = 1591,55 Hz; 10·f_c'de −20,043 dB, −84,29° (runCalc, varsayılan dışı birimler)", () => {
    // Elle: f_c = 100/(2π · 0,01) = 1591,549 Hz; u = 10: G = −10·log₁₀(101) = −20,0432 dB; φ = −arctan 10 = −1,471128 rad
    const r = run(
      {
        mod: { value: "rl" },
        tip: { value: "lp" },
        Rl: { value: "0,1", unit: "kohm" },
        L: { value: "10000", unit: "uH" },
        f: { value: String(10 * FC_RC / 1e3).replace(".", ","), unit: "kHz" },
      },
      { phi: "rad", fc: "kHz" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.fc).toBeCloseTo(1591.549, 3);
    expect(o.G).toBeCloseTo(-20.04321, 5);
    expect(o.phi).toBeCloseTo(-1.4711277, 7);
    expect(r.outputs.find((x) => x.key === "phi")?.unit).toBe("rad");
    expect(r.outputs.find((x) => x.key === "fc")?.unit).toBe("kHz");
  });

  it("yüksek geçiren f_c/10'da: |H| = 0,0995, −20,043 dB, +84,29°", () => {
    // Elle: u = 0,1: |H| = 0,1/√1,01 = 0,0995037; φ = 90° − arctan 0,1 = 1,471128 rad
    const o = def.compute({ ...RC, tip: "hp", f: FC_RC / 10 }, ctx).outputs;
    expect(o.H).toBeCloseTo(0.0995037, 7);
    expect(o.G).toBeCloseTo(-20.04321, 5);
    expect(o.phi).toBeCloseTo(1.4711277, 7);
  });

  it("değerlendirme frekansı boşsa kazanç ve faz verilmez", () => {
    const { f: _f, ...rest } = RC;
    void _f;
    const o = def.compute(rest, ctx).outputs;
    expect(o.fc).toBeCloseTo(1591.55, 2);
    expect(o).not.toHaveProperty("G");
    expect(o).not.toHaveProperty("phi");
  });
});

describe("LC rezonans", () => {
  it("10 mH + 100 nF → f₀ = 5032,9 Hz, Z₀ = 316,23 Ω; rezonans olarak etiketlenir", () => {
    // Elle: f₀ = 1/(2π√(10⁻²·10⁻⁷)) = 1/(2π·3,16228×10⁻⁵) = 5032,92 Hz; Z₀ = √(10⁻²/10⁻⁷) = √10⁵ = 316,228 Ω
    const r = def.compute({ mod: "lc", L: 10e-3, C: 100e-9 }, ctx);
    expect(r.outputs.f0).toBeCloseTo(5032.9, 1);
    expect(r.outputs.Z0).toBeCloseTo(316.2278, 4);
    expect(r.outputs).not.toHaveProperty("fc");
    expect(def.outputs.find((o) => o.key === "f0")?.label).toBe("Rezonans frekansı");
    expect(r.checks.some((c) => c.message.includes("−3 dB kesim frekansı değildir"))).toBe(true);
  });

  it("OpenStax Örnek 15.4: 3,00 mH ve 8,00×10⁻⁴ F → 1,03×10² Hz (runCalc, mF)", () => {
    // Elle: f₀ = 1/(2π√(2,4×10⁻⁶)) = 102,734 Hz
    const r = run({ mod: { value: "lc" }, L: { value: "3", unit: "mH" }, C: { value: "0,8", unit: "mF" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.f0).toBeCloseTo(103, 0);
    expect(r.result.outputs.f0).toBeCloseTo(102.734, 3);
  });
});

describe("ters hesap", () => {
  it("Microchip AN699: 1 kHz ve 0,1 µF → R = 1,59 kΩ; E24'te 1,6 kΩ → 994,72 Hz (−%0,528)", () => {
    // Elle: R = 1/(2π·10³·10⁻⁷) = 1591,55 Ω; E24 komşuları 1,5 k ve 1,6 k → en yakın 1,6 kΩ;
    // f_c = 1/(2π·1600·10⁻⁷) = 994,718 Hz; δ = (994,718 − 1000)/1000 = −0,005282
    const r = run({
      mod: { value: "ters" },
      fHedef: { value: "1000", unit: "Hz" },
      C: { value: "0,1", unit: "uF" },
      seri: { value: "E24" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.R).toBeCloseTo(1591.55, 2);
    expect(Math.round(o.R / 10) * 10).toBe(1590);
    expect(o.Rstd).toBe(1600);
    expect(o.fcStd).toBeCloseTo(994.718, 3);
    expect(o.sapma).toBeCloseTo(-0.0052816, 7);
  });

  it("E96'da en yakın 1,58 kΩ → 1007,31 Hz", () => {
    // Elle: E96 komşuları 1,58 k ve 1,62 k; |1591,55 − 1580| < |1620 − 1591,55| → 1,58 kΩ; f_c = 1/(2π·1,58×10⁻⁴) = 1007,310 Hz
    const o = def.compute({ mod: "ters", tip: "lp", fHedef: 1000, C: 100e-9, seri: "E96" }, ctx).outputs;
    expect(o.Rstd).toBeCloseTo(1580, 9);
    expect(o.fcStd).toBeCloseTo(1007.3098, 3);
  });
});

describe("seçim kombinasyonları", () => {
  it("her mod × tip × seri varsayılan girdilerle hatasız sonuç verir", () => {
    const selects = def.inputs.filter((i): i is SelectInputSpec => i.kind === "select");
    let combos: InputState[] = [{}];
    for (const s of selects) combos = combos.flatMap((c) => s.options.map((o) => ({ ...c, [s.key]: { value: o.value } })));
    expect(combos).toHaveLength(4 * 2 * 5);
    for (const combo of combos) {
      const r = run(combo);
      if (!r.ok) throw new Error(`${JSON.stringify(combo)}: ${JSON.stringify(r)}`);
      expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    }
  });
});
