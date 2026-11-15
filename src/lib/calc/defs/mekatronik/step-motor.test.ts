/**
 * 6.3 Step motor testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır; ilişkiler THK denklem (56) E = 360·S/(Ph·A) ve (57) f = V/S ile çapraz kontrol
 * edilir (https://www.thk.com/eu/en/products/ball_screw/selection/0014/). Gerekli tork Oriental Motor
 * T_M = (T_L + T_a)·S_f, T_a = J·α (https://www.orientalmotor.com/technology/motor-sizing-calculations.html).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { LIMITS } from "@/config/sinirlar";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { stepMotor as def } from "./step-motor";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;
const DEG = Math.PI / 180;

const BASE: ComputeInputs = {
  theta: 1.8 * DEG,
  mikro: 16,
  hizGirdi: "devir",
  n: 300 * RPM,
  mekanizma: "vida",
  Ph: 0.005,
  i: 1,
  TL: 0.2,
  Jr: 0.3e-4,
  JL: 1e-4,
  t: 0.1,
  Sf: 2,
};

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("adım, frekans, çözünürlük", () => {
  it("1,8°, 1/16 mikroadım, 300 dev/dk, vida 5 mm: 3200 adım/devir, 16 kHz, 1,5625 µm, 25 mm/s", () => {
    // Elle: N = 200·16 = 3200; f = 3200·5 dev/s = 16 000 Hz; Δx = 5 mm/3200 = 1,5625 µm; v = 5 dev/s·5 mm = 25 mm/s
    const o = def.compute(BASE, ctx).outputs;
    expect(o.N).toBeCloseTo(3200, 9);
    expect(o.dTheta / DEG).toBeCloseTo(0.1125, 12);
    expect(o.f).toBeCloseTo(16000, 6);
    expect(o.dx).toBeCloseTo(1.5625e-6, 15);
    expect(o.v).toBeCloseTo(0.025, 12);
    // THK (56): E = 360·S/(Ph·A) = 360·0,0015625/5 = 0,1125° ; (57): f = V/S = 25/0,0015625 = 16 000 Hz
    expect((360 * (o.dx * 1000)) / 5).toBeCloseTo(o.dTheta / DEG, 12);
    expect(o.v / o.dx).toBeCloseTo(o.f, 6);
    expect(o).not.toHaveProperty("dPhi");
  });

  it("frekanstan devir, kasnak Ø20 mm, i = 2 (runCalc, varsayılan dışı birimler): 0,9°·8, 40 kHz", () => {
    // Elle: N = 400·8 = 3200; n = 40 000/3200 = 12,5 dev/s = 750 dev/dk; Δx = π·20/(3200·2) = 9,81748 µm;
    // v = (12,5/2)·π·20 = 392,699 mm/s = 23,5619 m/dk
    const r = run(
      {
        theta: { value: "0,9", unit: "deg" },
        mikro: { value: "8", unit: "unitless" },
        hizGirdi: { value: "frekans" },
        f: { value: "40", unit: "kHz" },
        mekanizma: { value: "kasnak" },
        D: { value: "2", unit: "cm" },
        i: { value: "2", unit: "unitless" },
        TL: { value: "15", unit: "Ncm" },
        Jr: { value: "120", unit: "gcm2" },
        JL: { value: "0,5", unit: "kgcm2" },
        t: { value: "250", unit: "ms" },
        Sf: { value: "1,5", unit: "unitless" },
      },
      { v: "m_min", dx: "mm", TM: "Ncm" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.N).toBeCloseTo(3200, 9);
    expect(o.n / RPM).toBeCloseTo(750, 9);
    expect(o.dx * 1e6).toBeCloseTo(9.817477, 6);
    expect(o.v * 60).toBeCloseTo(23.561945, 6);
    // Tork: α = 78,5398/0,25 = 314,159 rad/s²; T_a = (1,2×10⁻⁵ + 5×10⁻⁵)·314,159 = 0,0194779 N·m;
    // T_M = (0,15 + 0,0194779)·1,5 = 0,254217 N·m
    expect(o.alfa).toBeCloseTo(314.159265, 6);
    expect(o.Ta).toBeCloseTo(0.01947787, 8);
    expect(o.TM).toBeCloseTo(0.2542168, 7);
    expect(r.outputs.find((x) => x.key === "TM")?.unit).toBe("Ncm");
  });

  it("döner yük, i = 3: çıkış açısal çözünürlüğü 1,8°/(16·3) = 0,0375°, çıkış 100 dev/dk", () => {
    const o = def.compute({ ...BASE, mekanizma: "dogrudan", i: 3 }, ctx).outputs;
    expect(o.dPhi / DEG).toBeCloseTo(0.0375, 12);
    expect(o.nCikis / RPM).toBeCloseTo(100, 9);
    expect(o).not.toHaveProperty("dx");
  });

  it("adım/devir tam sayı değilse uyarı (0,7° → 514,29)", () => {
    const r = def.compute({ ...BASE, theta: 0.7 * DEG, mikro: 1 }, ctx);
    expect(r.outputs.N).toBeCloseTo(514.2857, 4);
    expect(r.checks.filter((c) => c.level === "uyari")).toHaveLength(1);
    expect(def.compute(BASE, ctx).checks.every((c) => c.level === "ok")).toBe(true);
  });
});

describe("gerekli tork", () => {
  it("T_L 0,2 N·m, J 0,3 + 1 kg·cm², 0 → 300 dev/dk 0,1 s'de, S_f 2: T_a 0,04084 N·m, T_M 0,48168 N·m", () => {
    // Elle: ω = 31,4159 rad/s; α = 314,159 rad/s²; T_a = 1,3×10⁻⁴·314,159 = 0,0408407 N·m;
    // T_M = (0,2 + 0,0408407)·2 = 0,481681 N·m
    const o = def.compute(BASE, ctx).outputs;
    expect(o.alfa).toBeCloseTo(314.159265, 6);
    expect(o.Ta).toBeCloseTo(0.04084070, 8);
    expect(o.TM).toBeCloseTo(0.4816814, 7);
  });

  it("emniyet katsayısının varsayılanı config'teki THK önerisi (2)", () => {
    expect(LIMITS.mekatronikTahrik.stepEmniyetKatsayisi).toBe(2);
    expect(defaultState(def).Sf.value).toBe("2");
  });
});
