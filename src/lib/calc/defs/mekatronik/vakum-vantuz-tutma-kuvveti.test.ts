/**
 * 6.8 Vakum vantuz tutma kuvveti testleri (gerçek birim sistemiyle).
 *
 * Kaynaklı vektörler (Schmalz Vacuum Knowledge):
 * - "Theoretical Holding Force of a Suction Cup": 61,33 kg çelik sac, a = 5 m/s²;
 *   I (S 1,5) → 1363 N, II (μ 0,5, S 1,5) → 1822 N, III (μ 0,5, S 2) → 3633 N.
 *   https://www.schmalz.com/en/support/know-how/vacuum-knowledge/the-vacuum-system-and-its-components/system-design-calculation-example/theoretical-holding-force-of-a-suction-cup
 * - "Design of the Suction Cup": 50 kg plastik levha, P_U 0,4 bar, n 4, S 2; yatay alma d = 8,85 cm,
 *   dikey alma (μ 0,5) d = 12,5 cm.
 *   https://www.schmalz.com/en/support/know-how/vacuum-knowledge/the-vacuum-system-and-its-components/vacuum-suction-cups/design-of-the-suction-cup
 * Schmalz g = 9,81 m/s² ve yuvarlatılmış 1,12 katsayısı kullanır, sonuçları 3–4 basamağa yuvarlar; kod g_n = 9,80665
 * kullanır. Bu yüzden kaynak değerleri %0,2 bağıl toleransla karşılaştırılır (en büyük fark çapta: 88,34 → 88,5 mm);
 * kesin değerler ayrıca elle hesapla (g_n ile) sınanır.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { getUnit } from "@/lib/units";
import { G_N } from "./akiskan-ortak";
import { vakumVantuz as def } from "./vakum-vantuz-tutma-kuvveti";

const ctx = defaultContext();
const BAR = 1e5;

/** |gerçek − beklenen| / beklenen < tol */
function expectRel(actual: number, expected: number, tol: number) {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(tol);
}

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

const SAC = { m: 61.33, a: 5, mu: 0.5, dp: 0.6 * BAR, n: 4 };

describe("yük durumları (Schmalz örneği, 61,33 kg, 5 m/s²)", () => {
  it("I: vantuz yatay, kuvvet dikey, S 1,5 → 1363 N (Schmalz)", () => {
    // Elle (g_n): 61,33 · (9,80665 + 5) · 1,5 = 1362,1378 N
    const r = def.compute({ ...SAC, yuk: "I", S: 1.5 }, ctx);
    expect(r.outputs.FTH).toBeCloseTo(1362.1378, 3);
    expectRel(r.outputs.FTH, 1363, 0.002);
  });

  it("II: vantuz yatay, kuvvet yatay, μ 0,5, S 1,5 → 1822 N (Schmalz)", () => {
    // Elle: 61,33 · (9,80665 + 5/0,5) · 1,5 = 1822,1128 N
    const r = def.compute({ ...SAC, yuk: "II", S: 1.5 }, ctx);
    expect(r.outputs.FTH).toBeCloseTo(1822.1128, 3);
    expectRel(r.outputs.FTH, 1822, 0.002);
  });

  it("III: vantuz dikey, kuvvet dikey, μ 0,5, S 2 → 3633 N (Schmalz)", () => {
    // Elle: (61,33/0,5) · (9,80665 + 5) · 2 = 3632,3674 N
    const r = def.compute({ ...SAC, yuk: "III", S: 2 }, ctx);
    expect(r.outputs.FTH).toBeCloseTo(3632.3674, 3);
    expectRel(r.outputs.FTH, 3633, 0.002);
  });

  it("yük durumu I'de μ kullanılmaz", () => {
    const a = def.compute({ ...SAC, yuk: "I", S: 1.5, mu: 0.1 }, ctx).outputs.FTH;
    const b = def.compute({ ...SAC, yuk: "I", S: 1.5, mu: 0.9 }, ctx).outputs.FTH;
    expect(a).toBe(b);
  });
});

describe("gerekli vantuz çapı (Schmalz örneği, 50 kg, 0,4 bar, 4 vantuz, S 2, a = 0)", () => {
  it("yatay alma (yük durumu I) → 8,85 cm (Schmalz)", () => {
    // Elle: F_TH = 50·9,80665·2 = 980,665 N; d = √(4·980,665/(π·4·40 000)) = 0,0883396 m
    const r = def.compute({ yuk: "I", m: 50, a: 0, S: 2, dp: 0.4 * BAR, n: 4 }, ctx);
    expect(r.outputs.dGerekli).toBeCloseTo(0.0883396, 7);
    expectRel(r.outputs.dGerekli, 0.0885, 0.002);
    expect(r.outputs).not.toHaveProperty("Fvantuz");
  });

  it("dikey alma (yük durumu III, μ 0,5) → 12,5 cm (Schmalz)", () => {
    // Elle: F_TH = 50/0,5·9,80665·2 = 1961,33 N; d = √(4·1961,33/(π·4·40 000)) = 0,1249311 m
    const r = def.compute({ yuk: "III", m: 50, a: 0, mu: 0.5, S: 2, dp: 0.4 * BAR, n: 4 }, ctx);
    expect(r.outputs.dGerekli).toBeCloseTo(0.1249311, 7);
    expectRel(r.outputs.dGerekli, 0.125, 0.002);
  });
});

describe("seçilen vantuz kontrolü", () => {
  it("varsayılan: 20 kg, 5 m/s², S 2, 0,6 bar, 4 × ∅60 mm → yeterli, S_gerçek 2,29", () => {
    // Elle: F_TH = 20·14,80665·2 = 592,266 N; d_gerekli = √(4·592,266/(π·4·60 000)) = 56,054 mm;
    // F_v = 60 000·π·0,03² = 169,646 N; F_toplam = 678,584 N; S_gerçek = 2·678,584/592,266 = 2,29148;
    // F_izin = n·Δp·A/S = 678,584/2 = 339,292 N ≥ F_TH/S = m·(g + a) = 20·14,80665 = 296,133 N
    const r = def.compute({ yuk: "I", m: 20, a: 5, S: 2, dp: 0.6 * BAR, n: 4, dv: 0.06 }, ctx);
    expect(r.outputs.FTH).toBeCloseTo(592.266, 3);
    expect(r.outputs.dGerekli).toBeCloseTo(0.0560542, 7);
    expect(r.outputs.Fvantuz).toBeCloseTo(169.646, 3);
    expect(r.outputs.Ftoplam).toBeCloseTo(678.584, 3);
    expect(r.outputs.Sgercek).toBeCloseTo(2.291484, 6);
    expect(r.outputs.Fizin).toBeCloseTo(339.292, 3);
    expect(r.steps.some((s) => s.latex.includes("339{,}3\\,\\mathrm{N} \\geq \\frac{F_{\\text{TH}}}{S} = 296{,}1\\,\\mathrm{N}"))).toBe(true);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
    expect(r.checks[0].message).toMatch(/yeterli.*678,6 N.*592,3 N.*2,29/);
  });

  it("gerekli çaptaki vantuzla gerçek emniyet katsayısı tam S olur", () => {
    const base = { yuk: "II", m: 12, a: 3, mu: 0.4, S: 2.5, dp: 0.7 * BAR, n: 3 };
    const d = def.compute(base, ctx).outputs.dGerekli;
    expect(def.compute({ ...base, dv: d }, ctx).outputs.Sgercek).toBeCloseTo(2.5, 12);
  });

  it("çap küçükse uyarı; S < 1,5 ise Schmalz uyarısı", () => {
    const small = def.compute({ yuk: "I", m: 20, a: 5, S: 2, dp: 0.6 * BAR, n: 4, dv: 0.05 }, ctx);
    expect(small.checks.filter((c) => c.level === "uyari")).toEqual([
      expect.objectContaining({ message: expect.stringMatching(/yetersiz/) }),
    ]);
    // Elle: F_izin = 4·60 000·π·0,025²/2 = 235,619 N < F_TH/S = 296,133 N
    expect(small.outputs.Fizin).toBeCloseTo(235.619, 3);
    expect(small.steps.some((s) => s.latex.includes("< \\frac{F_{\\text{TH}}}{S}"))).toBe(true);
    const lowS = def.compute({ yuk: "I", m: 20, a: 5, S: 1.2, dp: 0.6 * BAR, n: 4 }, ctx);
    expect(lowS.checks.filter((c) => c.level === "uyari")).toEqual([
      expect.objectContaining({ message: expect.stringMatching(/1,5/), reference: expect.objectContaining({ standard: "Schmalz Vacuum Knowledge" }) }),
    ]);
    expect(def.compute({ yuk: "I", m: 20, a: 5, S: 1.5, dp: 0.6 * BAR, n: 4 }, ctx).checks.filter((c) => c.level === "uyari")).toEqual([]);
  });

  it("adımlarda vakum bar, çap mm, kütle kg ile", () => {
    const all = def
      .compute({ yuk: "II", m: 20, a: 5, mu: 0.5, S: 2, dp: 0.6 * BAR, n: 4, dv: 0.06 }, ctx)
      .steps.map((s) => s.latex)
      .join(" ");
    expect(all).toContain("0{,}6\\,\\mathrm{bar}");
    expect(all).toContain("60\\,\\mathrm{mm}");
    expect(all).toContain("20\\,\\mathrm{kg}");
    expect(all).toContain("9{,}807\\,\\mathrm{m}/\\mathrm{s}^2");
    expect(all).not.toMatch(/\\mathrm{Pa}/);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("0,05 t, 0,5 g, yük durumu II (μ 0,4), S 2,5, 700 mbar, 6 × 8 cm → yetersiz uyarısı", () => {
    // Elle: a = 0,5·9,80665 = 4,903325 m/s²; F_TH = 50·(9,80665 + 4,903325/0,4)·2,5 = 2758,1203 N;
    // d_gerekli = √(4·2758,12/(π·6·70 000)) = 91,4402 mm; F_v = 70 000·π·0,04² = 351,8584 N;
    // F_toplam = 2111,1503 N < F_TH → S_gerçek = 2,5·2111,15/2758,12 = 1,913577; F_izin = 2111,1503/2,5 = 844,4601 N
    const r = run(
      {
        yuk: { value: "II" },
        m: { value: "0,05", unit: "t" },
        a: { value: "0,5", unit: "gn" },
        mu: { value: "0,4", unit: "unitless" },
        S: { value: "2,5", unit: "unitless" },
        dp: { value: "700", unit: "mbar" },
        n: { value: "6", unit: "unitless" },
        dv: { value: "8", unit: "cm" },
      },
      { FTH: "kN", dGerekli: "cm" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.FTH).toBeCloseTo(2758.1203, 3);
    expect(o.dGerekli).toBeCloseTo(0.0914402, 7);
    expect(o.Fvantuz).toBeCloseTo(351.8584, 3);
    expect(o.Ftoplam).toBeCloseTo(2111.1503, 3);
    expect(o.Sgercek).toBeCloseTo(1.913577, 6);
    expect(o.Fizin).toBeCloseTo(844.4601, 3);
    expect(r.outputs.find((x) => x.key === "FTH")).toMatchObject({ unit: "kN" });
    expect(r.outputs.find((x) => x.key === "dGerekli")).toMatchObject({ unit: "cm", formatted: "9,144 cm" });
    expect(r.result.checks.filter((c) => c.level === "uyari")).toHaveLength(1);
  });

  it("vantuz çapı boş bırakılabilir; vantuz sayısı tam sayı olmalı", () => {
    const r = run({ dv: { value: "", unit: "mm" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.map((o) => o.key)).toEqual(["FTH", "dGerekli"]);
    const bad = run({ n: { value: "2,5", unit: "unitless" } });
    expect(bad.ok).toBe(false);
  });

  it("vakum atmosfer basıncını aşamaz", () => {
    expect(run({ dp: { value: "1,1", unit: "bar" } }).ok).toBe(false);
  });

  it("g_n sabiti birim kataloğundaki g biriminin çarpanıyla aynı", () => {
    expect(G_N).toBe(getUnit("gn").factor);
  });
});
