/**
 * 4.2 RC / RL zaman sabiti testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır (τ = RC, τ = L/R, üstel şarj/deşarj). Kaynak örnekleri OpenStax University Physics
 * Volume 2: Example 10.9 (§10.5, https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits:
 * 10 mF, 12 V, 10 V eşiği → R = 558,11 Ω için 10,00 s; 10 kΩ için 179,18 s), Example 14.4 ve 14.5
 * (§14.4, https://openstax.org/books/university-physics-volume-2/pages/14-4-rl-circuits: ε = 2,0 V, R = 4,0 Ω,
 * L = 4,0 H → τ = 1,0 s, I(2τ) = 0,43 A, |V_L(2τ)| = 0,27 V; sönümde yarı akıma 0,69 s).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState, SelectInputSpec } from "@/lib/calc/types";
import { rcRlZamanSabiti as def } from "./rc-rl-zaman-sabiti";

const ctx = defaultContext();

const RC_SARJ: ComputeInputs = { mod: "rc", islem: "sarj", R: 10e3, C: 100e-6, t: 1, Vs: 5, xS: 0.9 };
const RL_SARJ: ComputeInputs = { mod: "rl", islem: "sarj", Rl: 4, L: 4, tL: 2, Vs: 2, xS: 0.9 };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("RC", () => {
  it("10 kΩ, 100 µF → τ = 1 s; t = τ'da %63,212; %90'a τ·ln10 = 2,302585 s", () => {
    // Elle: τ = 10⁴ · 10⁻⁴ = 1 s; 1 − e⁻¹ = 0,6321206; v_C = 5 · 0,6321206 = 3,160603 V;
    // i = (5 V/10 kΩ)·e⁻¹ = 0,1839397 mA; t₉₀ = −ln(0,1) = 2,302585 s; 5τ = 5 s; E = ½·10⁻⁴·25 = 1,25 mJ
    const o = def.compute(RC_SARJ, ctx).outputs;
    expect(o.tau).toBeCloseTo(1, 12);
    expect(o.oranS).toBeCloseTo(0.63212, 5);
    expect(o.vC).toBeCloseTo(3.1606028, 7);
    expect(o.iC).toBeCloseTo(1.839397e-4, 10);
    expect(o.tx).toBeCloseTo(2.302585, 6);
    expect(o.t5).toBeCloseTo(5, 12);
    expect(o.Imax).toBeCloseTo(5e-4, 12);
    expect(o.E).toBeCloseTo(1.25e-3, 12);
    expect(o).not.toHaveProperty("iL");
    expect(o).not.toHaveProperty("oranD");
  });

  it("deşarj: V₀ 5 V, τ 1 s, t = 1 s → 1,8394 V (%36,79); %10'a inme τ·ln10", () => {
    // Elle: v_C = 5·e⁻¹ = 1,839397 V; t₁₀ = −ln(0,1) = 2,302585 s
    const o = def.compute({ mod: "rc", islem: "desarj", R: 10e3, C: 100e-6, t: 1, V0: 5, xD: 0.1 }, ctx).outputs;
    expect(o.vC).toBeCloseTo(1.8393972, 7);
    expect(o.oranD).toBeCloseTo(0.3678794, 7);
    expect(o.tx).toBeCloseTo(2.302585, 6);
    expect(o).not.toHaveProperty("oranS");
  });

  it("OpenStax Örnek 10.9: 10 kΩ, 10 mF, 12 V, 10 V eşiği → 179,18 s (runCalc, varsayılan dışı birimler)", () => {
    // Elle: t = −RC·ln(1 − 10/12) = 100·ln 6 = 179,1759 s (kaynak: 179,18 s = 2,98 dk)
    const r = run(
      {
        R: { value: "10000", unit: "ohm" },
        C: { value: "10", unit: "mF" },
        Vs: { value: "12", unit: "V" },
        xS: { value: String(10 / 12).replace(".", ","), unit: "fraction" },
      },
      { tx: "min" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.tx).toBeCloseTo(179.18, 2);
    expect(r.outputs.find((x) => x.key === "tx")?.unit).toBe("min");
    expect((r.outputs.find((x) => x.key === "tx")?.value ?? 0) * 60).toBeCloseTo(179.18, 2);
  });

  it("OpenStax Örnek 10.9: R = 558,11 Ω ile periyot 10,00 s", () => {
    const o = def.compute({ ...RC_SARJ, R: 558.11, C: 10e-3, Vs: 12, xS: 10 / 12 }, ctx).outputs;
    expect(o.tx).toBeCloseTo(10.0, 2);
  });

  it("hedef %100 → hata (kuramsal olarak sonsuz süre)", () => {
    const r = run({ xS: { value: "100", unit: "percent" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks.some((c) => c.level === "hata")).toBe(true);
  });
});

describe("RL", () => {
  it("10 mH, 100 Ω → τ = 100 µs (runCalc, varsayılan dışı birimler)", () => {
    const r = run({
      mod: { value: "rl" },
      L: { value: "10000", unit: "uH" },
      Rl: { value: "0,1", unit: "kohm" },
      tL: { value: "0,1", unit: "ms" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.tau).toBeCloseTo(1e-4, 15);
    const tau = r.outputs.find((x) => x.key === "tau");
    expect(tau?.unit).toBe("us");
    expect(tau?.value).toBeCloseTo(100, 9);
    // t = τ: i = (5 V/100 Ω)(1 − e⁻¹) = 31,606 mA
    expect(r.result.outputs.iL).toBeCloseTo(0.031606028, 9);
  });

  it("OpenStax Örnek 14.4: 2 V, 4 Ω, 4 H → τ 1 s, I(2τ) = 0,43 A, |V_L(2τ)| = 0,27 V, I(∞) = 0,50 A", () => {
    // Elle: I(2τ) = 0,5·(1 − e⁻²) = 0,432332 A; V_L(2τ) = 2·e⁻² = 0,270671 V
    const o = def.compute(RL_SARJ, ctx).outputs;
    expect(o.tau).toBeCloseTo(1, 12);
    expect(o.iL).toBeCloseTo(0.43, 2);
    expect(o.iL).toBeCloseTo(0.4323324, 7);
    expect(o.vL).toBeCloseTo(0.27, 2);
    expect(o.vL).toBeCloseTo(0.2706706, 7);
    expect(o.Imax).toBeCloseTo(0.5, 12);
    // E = ½·4·0,5² = 0,5 J
    expect(o.E).toBeCloseTo(0.5, 12);
  });

  it("OpenStax Örnek 14.5: sönümde akımın yarıya inmesi 0,69 s", () => {
    // Elle: t = −τ·ln 0,5 = 0,693147 s
    const o = def.compute({ mod: "rl", islem: "desarj", Rl: 4, L: 4, tL: 0, V0: 2, xD: 0.5 }, ctx).outputs;
    expect(o.tx).toBeCloseTo(0.69, 2);
    expect(o.tx).toBeCloseTo(0.6931472, 7);
    // t = 0'da akım başlangıç değerinde
    expect(o.iL).toBeCloseTo(0.5, 12);
  });
});

describe("seçim kombinasyonları", () => {
  it("her mod × geçiş varsayılan girdilerle hatasız sonuç verir", () => {
    const selects = def.inputs.filter((i): i is SelectInputSpec => i.kind === "select");
    let combos: InputState[] = [{}];
    for (const s of selects) combos = combos.flatMap((c) => s.options.map((o) => ({ ...c, [s.key]: { value: o.value } })));
    expect(combos).toHaveLength(4);
    for (const combo of combos) {
      const r = run(combo);
      if (!r.ok) throw new Error(`${JSON.stringify(combo)}: ${JSON.stringify(r)}`);
      expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    }
  });
});
