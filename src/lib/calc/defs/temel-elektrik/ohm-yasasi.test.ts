/**
 * Ohm yasası (1.1) testleri.
 * Sayısal doğrulamalar compute'u doğrudan SI değerlerle çağırır ve yalnız `outputs`'a bakar.
 * Adımlar (steps) compute içinde üretildiği ve sayı biçimlendirmesi gerektirdiği için birim
 * sistemi sahte modülle değiştirilir; adım metni testleri sayısal testlerden ayrıdır.
 */
import { describe, expect, it, vi } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, ComputeInputs } from "@/lib/calc/types";
import { ohmYasasi, type OhmMode } from "./ohm-yasasi";

vi.mock("@/lib/units", () => import("@/lib/calc/test-utils/units-mock"));

const ctx = defaultContext();
const compute = (mod: OhmMode, values: Record<string, number>): CalcResult => ohmYasasi.compute({ mod, ...values }, ctx);
const validate = (mod: OhmMode, values: Record<string, number>) => ohmYasasi.validate?.({ mod, ...values } as ComputeInputs, ctx) ?? [];

function expectOutputs(result: CalcResult, expected: Record<string, number>, digits = 9) {
  expect(Object.keys(result.outputs).sort()).toEqual(Object.keys(expected).sort());
  for (const [k, v] of Object.entries(expected)) expect(result.outputs[k], k).toBeCloseTo(v, digits);
}

describe("ders kitabı değerleri (her mod)", () => {
  it("V-I: 12 V, 2 A → 6 Ω, 24 W", () => {
    expectOutputs(compute("V-I", { V: 12, I: 2 }), { V: 12, I: 2, R: 6, P: 24 });
  });

  it("V-R: 12 V, 6 Ω → 2 A, 24 W; 10 V, 1 kΩ → 10 mA, 0,1 W", () => {
    expectOutputs(compute("V-R", { V: 12, R: 6 }), { V: 12, I: 2, R: 6, P: 24 });
    expectOutputs(compute("V-R", { V: 10, R: 1000 }), { V: 10, I: 0.01, R: 1000, P: 0.1 });
  });

  it("I-R: 2 A, 6 Ω → 12 V, 24 W; 20 mA, 250 Ω → 5 V, 0,1 W", () => {
    expectOutputs(compute("I-R", { I: 2, R: 6 }), { V: 12, I: 2, R: 6, P: 24 });
    expectOutputs(compute("I-R", { I: 0.02, R: 250 }), { V: 5, I: 0.02, R: 250, P: 0.1 });
  });

  it("P-V: 230 V, 100 W → 0,4348 A, 529 Ω", () => {
    const r = compute("P-V", { P: 100, V: 230 });
    expectOutputs(r, { V: 230, I: 100 / 230, R: 529, P: 100 });
    expect(r.outputs.I).toBeCloseTo(0.4348, 4);
  });

  it("P-I: 24 W, 2 A → 12 V, 6 Ω", () => {
    expectOutputs(compute("P-I", { P: 24, I: 2 }), { V: 12, I: 2, R: 6, P: 24 });
  });

  it("P-R: 50 W, 2 Ω → 10 V, 5 A (pozitif kök, 'ok' check'i)", () => {
    const r = compute("P-R", { P: 50, R: 2 });
    expectOutputs(r, { V: 10, I: 5, R: 2, P: 50 });
    expect(r.checks).toEqual([expect.objectContaining({ level: "ok" })]);
    expect(r.checks[0].message).toMatch(/pozitif/);
  });

  it("her mod aynı devre için tutarlı sonuç verir", () => {
    const devre = { V: 12, I: 2, R: 6, P: 24 };
    const modes: [OhmMode, Record<string, number>][] = [
      ["V-I", { V: 12, I: 2 }],
      ["V-R", { V: 12, R: 6 }],
      ["I-R", { I: 2, R: 6 }],
      ["P-V", { P: 24, V: 12 }],
      ["P-I", { P: 24, I: 2 }],
      ["P-R", { P: 24, R: 6 }],
    ];
    for (const [mod, values] of modes) expectOutputs(compute(mod, values), devre);
  });
});

describe("işaret ve sıfır kenar durumları", () => {
  it("V-I: negatif gerilim ve akım birlikte → pozitif direnç ve güç", () => {
    expectOutputs(compute("V-I", { V: -12, I: -2 }), { V: -12, I: -2, R: 6, P: 24 });
  });

  it("V-I: zıt işaretli gerilim ve akım validate'te 'hata' verir", () => {
    const checks = validate("V-I", { V: 12, I: -2 });
    expect(checks).toHaveLength(1);
    expect(checks[0].level).toBe("hata");
    expect(checks[0].message).toMatch(/zıt işaretli/);
    // compute doğrudan çağrılsa da anlamsız sonuç üretmez
    expect(compute("V-I", { V: 12, I: -2 }).outputs).toEqual({});
  });

  it("V-I: I = 0 → R atlanır ve uyarı verilir; P = 0", () => {
    for (const V of [0, 12]) {
      const r = compute("V-I", { V, I: 0 });
      expectOutputs(r, { V, I: 0, P: 0 });
      expect(r.outputs).not.toHaveProperty("R");
      expect(r.checks).toEqual([expect.objectContaining({ level: "uyari" })]);
      expect(r.checks[0].message).toMatch(/tanımsız/);
    }
  });

  it("V-I: V = 0, I ≠ 0 → R = 0 (kısa devre uyarısı)", () => {
    const r = compute("V-I", { V: 0, I: -2 });
    expectOutputs(r, { V: 0, I: -2, R: 0, P: 0 });
    expect(Object.is(r.outputs.R, -0)).toBe(false);
    expect(Object.is(r.outputs.P, -0)).toBe(false);
    expect(r.checks).toEqual([expect.objectContaining({ level: "uyari" })]);
    expect(r.checks[0].message).toMatch(/kısa devre/);
  });

  it("V-R ve I-R: negatif işaret korunur, güç pozitif kalır", () => {
    expectOutputs(compute("V-R", { V: -12, R: 6 }), { V: -12, I: -2, R: 6, P: 24 });
    expectOutputs(compute("I-R", { I: -2, R: 6 }), { V: -12, I: -2, R: 6, P: 24 });
    expectOutputs(compute("V-R", { V: 0, R: 6 }), { V: 0, I: 0, R: 6, P: 0 });
  });

  it("P-V: V = 0 'hata'; negatif V → negatif I, pozitif R", () => {
    expect(validate("P-V", { P: 100, V: 0 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate("P-V", { P: 0, V: 0 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expectOutputs(compute("P-V", { P: 24, V: -12 }), { V: -12, I: -2, R: 6, P: 24 });
  });

  it("P-V: P = 0 → I = 0, R atlanır ve uyarı verilir", () => {
    const r = compute("P-V", { P: 0, V: -12 });
    expectOutputs(r, { V: -12, I: 0, P: 0 });
    expect(Object.is(r.outputs.I, -0)).toBe(false);
    expect(r.checks).toEqual([expect.objectContaining({ level: "uyari" })]);
  });

  it("P-I: I = 0 'hata'; P = 0 → V = 0, R = 0 (kısa devre uyarısı)", () => {
    expect(validate("P-I", { P: 10, I: 0 })).toEqual([expect.objectContaining({ level: "hata" })]);
    const r = compute("P-I", { P: 0, I: -2 });
    expectOutputs(r, { V: 0, I: -2, R: 0, P: 0 });
    expect(Object.is(r.outputs.V, -0)).toBe(false);
    expect(r.checks[0].message).toMatch(/kısa devre/);
    expectOutputs(compute("P-I", { P: 24, I: -2 }), { V: -12, I: -2, R: 6, P: 24 });
  });

  it("P-R: P = 0 → V = 0, I = 0", () => {
    expectOutputs(compute("P-R", { P: 0, R: 10 }), { V: 0, I: 0, R: 10, P: 0 });
  });

  it("geçerli girdilerde validate boş döner", () => {
    expect(validate("V-I", { V: 12, I: 2 })).toEqual([]);
    expect(validate("V-I", { V: 0, I: 2 })).toEqual([]);
    expect(validate("P-R", { P: 50, R: 2 })).toEqual([]);
  });
});

describe("adımlar (steps)", () => {
  it("seçilen moda göre değerler yerine konur", () => {
    expect(compute("V-R", { V: 12, R: 6 }).steps).toEqual([
      { label: "Akım", latex: "I = \\frac{V}{R} = \\frac{12\\,\\mathrm{V}}{6\\,\\Omega} = 2\\,\\mathrm{A}" },
      { label: "Güç", latex: "P = \\frac{V^2}{R} = \\frac{(12\\,\\mathrm{V})^2}{6\\,\\Omega} = 24\\,\\mathrm{W}" },
    ]);
    const pr = compute("P-R", { P: 50, R: 2 }).steps;
    expect(pr.map((s) => s.label)).toEqual(["Gerilim (pozitif kök)", "Akım (pozitif kök)"]);
    expect(pr[0].latex).toBe("V = \\sqrt{P \\cdot R} = \\sqrt{50\\,\\mathrm{W} \\cdot 2\\,\\Omega} = 10\\,\\mathrm{V}");
  });

  it("negatif çarpanlar parantezlenir", () => {
    const vi_ = compute("V-I", { V: -12, I: -2 }).steps;
    expect(vi_.find((s) => s.label === "Güç")?.latex).toBe(
      "P = V \\cdot I = (-12\\,\\mathrm{V}) \\cdot (-2\\,\\mathrm{A}) = 24\\,\\mathrm{W}",
    );
    const ir = compute("I-R", { I: -2, R: 6 }).steps;
    expect(ir[1].latex).toBe("P = I^2 \\cdot R = (-2\\,\\mathrm{A})^2 \\cdot 6\\,\\Omega = 24\\,\\mathrm{W}");
  });

  it("tanımsız direnç için adım üretilmez", () => {
    expect(compute("V-I", { V: 12, I: 0 }).steps.map((s) => s.label)).toEqual(["Güç"]);
    expect(compute("P-V", { P: 0, V: 12 }).steps.map((s) => s.label)).toEqual(["Akım"]);
  });

  it("tüm formüller ve tüm modların adımları KaTeX'te strict kipte hatasız işlenir", () => {
    for (const f of ohmYasasi.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    const cases: [OhmMode, Record<string, number>][] = [
      ["V-I", { V: 12, I: 2 }],
      ["V-I", { V: -12, I: -2 }],
      ["V-I", { V: 0, I: 0 }],
      ["V-R", { V: -12, R: 6 }],
      ["V-R", { V: 1e-6, R: 1e9 }],
      ["I-R", { I: -0.002, R: 4700 }],
      ["P-V", { P: 100, V: -230 }],
      ["P-I", { P: 2e10, I: 3e-4 }],
      ["P-R", { P: 50, R: 2 }],
    ];
    for (const [mod, values] of cases) {
      const steps = compute(mod, values).steps;
      expect(steps.length).toBeGreaterThan(0);
      for (const s of steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });
});

describe("tanım", () => {
  it("formüller, referans ve kimlik", () => {
    expect(ohmYasasi.id).toBe("1.1");
    expect(ohmYasasi.slug).toBe("ohm-yasasi");
    expect(ohmYasasi.category).toBe("temel-elektrik");
    expect(ohmYasasi.formulas.map((f) => f.latex)).toEqual([
      "V = I \\cdot R",
      "P = V \\cdot I",
      "P = I^2 \\cdot R",
      "P = \\frac{V^2}{R}",
    ]);
    expect(ohmYasasi.references[0]).toMatchObject({ standard: "IEC 60050", clause: expect.stringMatching(/131/) });
  });

  it("her mod tam olarak iki sayı girdisini gösterir", () => {
    const modes = ohmYasasi.inputs.find((i) => i.key === "mod");
    if (modes?.kind !== "select") throw new Error("mod select olmalı");
    for (const { value } of modes.options) {
      const visible = ohmYasasi.inputs
        .filter((i) => i.kind === "number")
        .filter((i) => {
          const eq = i.visibleWhen?.equals;
          return Array.isArray(eq) ? eq.includes(value) : eq === value;
        })
        .map((i) => i.key)
        .sort();
      expect(visible, value).toEqual(value.split("-").sort());
    }
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan durum geçerlidir ve 2 A, 24 W verir", () => {
    const r = runCalc(ohmYasasi, defaultState(ohmYasasi));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.I).toBeCloseTo(2, 12);
    expect(r.result.outputs.P).toBeCloseTo(24, 12);
  });

  it("R = 0 ve negatif P alan hatası verir", () => {
    const s = defaultState(ohmYasasi);
    const r0 = runCalc(ohmYasasi, { ...s, R: { value: "0", unit: "ohm" } });
    expect(r0.ok).toBe(false);
    if (!r0.ok) expect(Object.keys(r0.fieldErrors)).toEqual(["R"]);

    const rp = runCalc(ohmYasasi, { ...s, mod: { value: "P-R" }, P: { value: "-1", unit: "W" } });
    expect(rp.ok).toBe(false);
    if (!rp.ok) expect(Object.keys(rp.fieldErrors)).toEqual(["P"]);
  });

  it("gizli girdiler yok sayılır; birimli giriş SI'ya çevrilir", () => {
    const r = runCalc(
      ohmYasasi,
      {
        mod: { value: "V-R" },
        V: { value: "12", unit: "V" },
        R: { value: "2", unit: "kohm" },
        I: { value: "geçersiz", unit: "A" },
        P: { value: "", unit: "W" },
      },
      { outputUnits: { I: "mA" } },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.inputsSI).toEqual({ mod: "V-R", V: 12, R: 2000 });
    expect(r.outputs.find((o) => o.key === "I")).toMatchObject({ unit: "mA", formatted: "6 mA" });
  });

  it("zıt işaret 'hata' check'iyle reddedilir", () => {
    const r = runCalc(ohmYasasi, {
      mod: { value: "V-I" },
      V: { value: "12", unit: "V" },
      I: { value: "-2", unit: "A" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].level).toBe("hata");
  });
});
