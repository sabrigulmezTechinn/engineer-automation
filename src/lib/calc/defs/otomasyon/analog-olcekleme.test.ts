/**
 * Analog ölçekleme (5.1) testleri. Gerçek birim sistemiyle çalışır.
 * Beklenen değerler elle hesaptır: y = (x − x₁)·(y₂ − y₁)/(x₂ − x₁) + y₁.
 * NE 43 sınırları: ölçüm 3,8–20,5 mA, arıza ≤ 3,6 mA / ≥ 21 mA (src/config/sinir/otomasyon.ts).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc, visibleInputs } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, InputState } from "@/lib/calc/types";
import { analogOlcekleme, type AnalogMod } from "./analog-olcekleme";

const ctx = defaultContext();
const compute = (mod: AnalogMod, values: Record<string, number>): CalcResult =>
  analogOlcekleme.compute({ mod, y1: 0, y2: 10, ...values }, ctx);
const validate = (mod: AnalogMod, values: Record<string, number>) =>
  analogOlcekleme.validate?.({ mod, y1: 0, y2: 10, ...values }, ctx) ?? [];

/** Varsayılan durumun üzerine girdi yazar: { x_ma: ["3,6", "mA"] } */
function state(mod: AnalogMod, values: Record<string, [string, string?]> = {}): InputState {
  const s: InputState = { ...defaultState(analogOlcekleme), mod: { value: mod } };
  for (const [k, [value, unit]] of Object.entries(values)) s[k] = { value, unit: unit ?? s[k]?.unit };
  return s;
}

describe("elle hesaplanmış değerler", () => {
  it("4-20 mA → mühendislik: 12 mA, 0–10 → 5 (%50)", () => {
    const r = compute("ma-muh", { x_ma: 0.012 });
    expect(r.outputs.y).toBeCloseTo(5, 12);
    expect(r.outputs.oran).toBeCloseTo(0.5, 12);
    expect(r.checks).toEqual([]);
  });

  it("4 mA → y₁, 20 mA → y₂", () => {
    expect(compute("ma-muh", { x_ma: 0.004 }).outputs.y).toBeCloseTo(0, 12);
    expect(compute("ma-muh", { x_ma: 0.02 }).outputs.y).toBeCloseTo(10, 12);
  });

  it("ters etkili ölçek (y₁ = 100, y₂ = 0): 8 mA → 75", () => {
    expect(compute("ma-muh", { x_ma: 0.008, y1: 100, y2: 0 }).outputs.y).toBeCloseTo(75, 12);
  });

  it("negatif alt uç (−50…150 °C): 12 mA → 50", () => {
    expect(compute("ma-muh", { x_ma: 0.012, y1: -50, y2: 150 }).outputs.y).toBeCloseTo(50, 12);
  });

  it("mühendislik → 4-20 mA: 6,5 (0–10) → 14,4 mA", () => {
    const r = compute("muh-ma", { y: 6.5 });
    expect(r.outputs.x_ma).toBeCloseTo(0.0144, 15);
    expect(r.outputs.oran).toBeCloseTo(0.65, 12);
    expect(r.outputs).not.toHaveProperty("y");
  });

  it("0-10 V: 2,5 V, 0–16 bar → 4 bar; tersi 4 bar → 2,5 V", () => {
    expect(compute("v-muh", { x_v: 2.5, y2: 16 }).outputs.y).toBeCloseTo(4, 12);
    expect(compute("muh-v", { y: 4, y2: 16 }).outputs.x_v).toBeCloseTo(2.5, 12);
  });

  it("ham sayım: S7 0–27648, 20736 → 7,5; 12 bit canlı sıfır 819–4095, 2457 → 50 (0–100)", () => {
    expect(compute("ham-muh", { x1_ham: 0, x2_ham: 27648, x_ham: 20736 }).outputs.y).toBeCloseTo(7.5, 12);
    expect(compute("ham-muh", { x1_ham: 819, x2_ham: 4095, x_ham: 2457, y2: 100 }).outputs.y).toBeCloseTo(50, 12);
  });

  it("mühendislik → ham: 25 (0–100), 0–27648 → 6912", () => {
    expect(compute("muh-ham", { x1_ham: 0, x2_ham: 27648, y: 25, y2: 100 }).outputs.x_ham).toBeCloseTo(6912, 9);
  });

  it("ileri ve geri yön birbirinin tersidir", () => {
    const y = compute("ma-muh", { x_ma: 0.0137, y1: -20, y2: 80 }).outputs.y;
    expect(compute("muh-ma", { y, y1: -20, y2: 80 }).outputs.x_ma).toBeCloseTo(0.0137, 15);
  });
});

describe("hatalı ölçek", () => {
  it("y₁ = y₂ her iki yönde 'hata'", () => {
    for (const mod of ["ma-muh", "muh-ma", "muh-v"] as AnalogMod[]) {
      const c = validate(mod, { x_ma: 0.012, y: 5, y1: 3, y2: 3 });
      expect(c.map((x) => x.level), mod).toEqual(["hata"]);
    }
  });

  it("ham sayımda x₁ = x₂ 'hata'", () => {
    const c = validate("ham-muh", { x1_ham: 100, x2_ham: 100, x_ham: 100 });
    expect(c).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(compute("ham-muh", { x1_ham: 100, x2_ham: 100, x_ham: 100 }).outputs).toEqual({});
  });

  it("runCalc: y₁ = y₂ reddedilir", () => {
    const r = runCalc(analogOlcekleme, state("ma-muh", { y1: ["5"], y2: ["5"] }));
    expect(r.ok).toBe(false);
  });
});

describe("NAMUR NE 43 bölgeleri (runCalc, sınırlar dahil)", () => {
  const levels = (mA: string) => {
    const r = runCalc(analogOlcekleme, state("ma-muh", { x_ma: [mA, "mA"] }));
    return r.ok ? r.result.checks.map((c) => c.level) : ["reddedildi", ...r.checks.map((c) => c.level)];
  };

  it("≤ 3,6 mA ve ≥ 21 mA arıza sinyali: hesap yapılmaz", () => {
    expect(levels("3,6")).toEqual(["reddedildi", "hata"]);
    expect(levels("3,59")).toEqual(["reddedildi", "hata"]);
    expect(levels("0")).toEqual(["reddedildi", "hata"]);
    expect(levels("21")).toEqual(["reddedildi", "hata"]);
    expect(levels("22")).toEqual(["reddedildi", "hata"]);
  });

  it("arıza mesajı NE 43'e atıf yapar ve nedeni açıklar", () => {
    const low = validate("ma-muh", { x_ma: 0.0035 });
    expect(low[0].message).toMatch(/3,5 mA.*NE 43.*kopuk hat/);
    expect(low[0].reference?.standard).toBe("NAMUR NE 43");
    expect(validate("ma-muh", { x_ma: 0.0215 })[0].message).toMatch(/kısa devre/);
  });

  it("3,6–3,8 mA ve 20,5–21 mA geçiş bölgesi: uyarı", () => {
    for (const mA of ["3,61", "3,7", "20,6", "20,99"]) {
      expect(levels(mA), mA).toEqual(["uyari"]);
    }
    const r = compute("ma-muh", { x_ma: 0.0037 });
    expect(r.checks[0].message).toMatch(/ne geçerli|tanımlı bir ölçüm/);
  });

  it("3,8–4 mA ve 20–20,5 mA: ölçüm aralığında, nominal dışında → uyarı, değer uzatılır", () => {
    for (const mA of ["3,8", "3,9", "20,1", "20,5"]) expect(levels(mA), mA).toEqual(["uyari"]);
    const r = compute("ma-muh", { x_ma: 0.0038 });
    expect(r.outputs.y).toBeCloseTo(-0.125, 12); // (3,8 − 4)·10/16
    expect(r.checks[0].message).toMatch(/alt ucunun altında/);
  });

  it("4 mA ve 20 mA tam sınırda uyarı yok", () => {
    expect(levels("4")).toEqual([]);
    expect(levels("20")).toEqual([]);
  });

  it("µA ve A birimleriyle girişte de sınırlar doğru çalışır", () => {
    const ua = runCalc(analogOlcekleme, state("ma-muh", { x_ma: ["3600", "uA"] }));
    expect(ua.ok).toBe(false);
    const a = runCalc(analogOlcekleme, state("ma-muh", { x_ma: ["0,012", "A"] }));
    if (!a.ok) throw new Error(JSON.stringify(a));
    expect(a.result.outputs.y).toBeCloseTo(5, 12);
  });

  it("geri yön: hesaplanan akım arıza bölgesindeyse değer gösterilir, uyarı verilir", () => {
    const ariza = compute("muh-ma", { y: -1.5 }); // 4 − 2,4 = 1,6 mA
    expect(ariza.outputs.x_ma).toBeCloseTo(0.0016, 15);
    expect(ariza.checks).toEqual([expect.objectContaining({ level: "uyari", message: expect.stringMatching(/arıza/) })]);
    expect(compute("muh-ma", { y: -0.25 }).checks[0].message).toMatch(/arıza/); // tam 3,6 mA
    expect(compute("muh-ma", { y: 10.5 }).checks[0].message).toMatch(/ölçüm aralığının .* dışında/); // 20,8 mA
    expect(compute("muh-ma", { y: -0.1 }).checks[0].message).toMatch(/ölçek aralığının/); // 3,84 mA
    expect(compute("muh-ma", { y: 5 }).checks).toEqual([]);
  });
});

describe("0-10 V ve ham sayım aralık dışı", () => {
  it("0–10 V dışındaki gerilim uyarı verir ama hesaplanır", () => {
    const r = compute("v-muh", { x_v: 10.5 });
    expect(r.outputs.y).toBeCloseTo(10.5, 12);
    expect(r.checks.map((c) => c.level)).toEqual(["uyari"]);
    expect(compute("v-muh", { x_v: -0.2 }).checks.map((c) => c.level)).toEqual(["uyari"]);
    expect(compute("v-muh", { x_v: 0 }).checks).toEqual([]);
    expect(compute("muh-v", { y: 11 }).checks.map((c) => c.level)).toEqual(["uyari"]);
  });

  it("ham değer x₁…x₂ dışında uyarı (ters sıralı aralıkta da)", () => {
    expect(compute("ham-muh", { x1_ham: 0, x2_ham: 27648, x_ham: 30000 }).checks.map((c) => c.level)).toEqual(["uyari"]);
    expect(compute("ham-muh", { x1_ham: 27648, x2_ham: 0, x_ham: 100 }).checks).toEqual([]);
    expect(compute("muh-ham", { x1_ham: 0, x2_ham: 27648, y: 12 }).checks.map((c) => c.level)).toEqual(["uyari"]);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan durum: 12 mA, 0–10 → 5", () => {
    const r = runCalc(analogOlcekleme, defaultState(analogOlcekleme));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.y).toBeCloseTo(5, 12);
    expect(r.result.checks).toEqual([]);
  });

  it("varsayılan dışı birimler: 7500 mV → 7,5; geri yönde akım A cinsinden gösterilir", () => {
    const v = runCalc(analogOlcekleme, state("v-muh", { x_v: ["7500", "mV"] }));
    if (!v.ok) throw new Error(JSON.stringify(v));
    expect(v.result.outputs.y).toBeCloseTo(7.5, 12);

    const ma = runCalc(analogOlcekleme, state("muh-ma", { y: ["6,5"] }), { outputUnits: { x_ma: "A" } });
    if (!ma.ok) throw new Error(JSON.stringify(ma));
    expect(ma.outputs.find((o) => o.key === "x_ma")).toMatchObject({ unit: "A", value: expect.closeTo(0.0144, 12) });
  });

  it("sinyal akımı kartı otomatik birime geçmez (0,5 mA, 500 µA değil)", () => {
    const r = runCalc(analogOlcekleme, state("muh-ma", { y: ["-2,1875"] })); // 4 − 3,5 = 0,5 mA
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.find((o) => o.key === "x_ma")).toMatchObject({ unit: "mA", value: expect.closeTo(0.5, 12) });
  });
});

describe("tanım", () => {
  it("her mod yalnızca kendi girdilerini gösterir", () => {
    const expected: Record<AnalogMod, string[]> = {
      "ma-muh": ["x_ma", "y1", "y2"],
      "muh-ma": ["y", "y1", "y2"],
      "v-muh": ["x_v", "y1", "y2"],
      "muh-v": ["y", "y1", "y2"],
      "ham-muh": ["x1_ham", "x2_ham", "x_ham", "y1", "y2"],
      "muh-ham": ["x1_ham", "x2_ham", "y", "y1", "y2"],
    };
    for (const [mod, keys] of Object.entries(expected) as [AnalogMod, string[]][]) {
      const visible = visibleInputs(analogOlcekleme, state(mod))
        .filter((i) => i.kind !== "select")
        .map((i) => i.key)
        .sort();
      expect(visible, mod).toEqual([...keys].sort());
    }
  });

  it("referanslar NAMUR NE 43'ü içerir", () => {
    expect(analogOlcekleme.id).toBe("5.1");
    expect(analogOlcekleme.references.map((r) => r.standard)).toContain("NAMUR NE 43");
  });

  it("tüm modların adımları KaTeX strict'ten geçer (negatif değerler dahil)", () => {
    const cases: [AnalogMod, Record<string, number>][] = [
      ["ma-muh", { x_ma: 0.012 }],
      ["ma-muh", { x_ma: 0.0039, y1: -50, y2: -10 }],
      ["muh-ma", { y: -3, y1: -5, y2: 5 }],
      ["v-muh", { x_v: -0.5 }],
      ["muh-v", { y: 4, y2: 16 }],
      ["ham-muh", { x1_ham: -27648, x2_ham: 27648, x_ham: -100 }],
      ["muh-ham", { x1_ham: 0, x2_ham: 4095, y: 1e-7 }],
    ];
    for (const [mod, values] of cases) {
      const steps = compute(mod, values).steps;
      expect(steps.length).toBe(2);
      for (const s of steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });

  it("adım değerleri yerine konmuş olarak yazılır", () => {
    expect(compute("ma-muh", { x_ma: 0.012 }).steps[0].latex).toBe(
      "y = \\frac{(x - x_1)\\,(y_2 - y_1)}{x_2 - x_1} + y_1 = " +
        "\\frac{(12\\,\\mathrm{mA} - 4\\,\\mathrm{mA}) \\cdot (10 - 0)}{20\\,\\mathrm{mA} - 4\\,\\mathrm{mA}} + 0 = 5",
    );
  });
});
