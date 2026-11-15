/**
 * LM317 / ayarlı regülatör (4.7) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır veya TI LM317 veri sayfası (SLVS044Z) örnekleridir:
 * - Denklem (2): V_o = V_ref·(1 + R₂/R₁) + I_adj·R₂; 240 Ω / 720 Ω, 1,25 V, 50 µA → 5 + 0,036 = 5,036 V.
 * - §8.3.6 Şekil 8-11 (pil şarj devresi): R₁ = 240 Ω, R₂ = 2,4 kΩ, denklem (6) V_OUT = 1,25·(1 + R₂/R₁) = 13,75 V (I_adj'sız).
 * - §8.3.7: sabit akım I = 1,25 V ÷ 24 Ω = 52,08 mA ("50mA" devre); V_I > V_yük + 4,25 V (1,25 V V_REF + 3 V pay).
 * - §6.3/§6.6 sınırları: minimum yük akımı tipik 3,5 mA / en çok 10 mA, V_I − V_O 3–40 V, I_O ≤ 1,5 A, V_O ≤ 37 V, T_J ≤ 125 °C.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, ComputeInputs, InputState, RunResult, SelectInputSpec } from "@/lib/calc/types";
import { lm317AyarliRegulator } from "./lm317-ayarli-regulator";

const ctx = defaultContext();
const T0 = 273.15;
const TEMEL = { Vref: 1.25, Iadj: 50e-6, Vin: 12, Ta: T0 + 25 };
const calc = (values: ComputeInputs): CalcResult => lm317AyarliRegulator.compute({ ...TEMEL, ...values }, ctx);

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

function state(values: Record<string, { value: string; unit?: string }>): InputState {
  return { ...defaultState(lm317AyarliRegulator), ...values };
}

const uyarilar = (r: CalcResult) => r.checks.filter((c) => c.level === "uyari");
const uyariVar = (r: CalcResult, re: RegExp) => uyarilar(r).some((c) => re.test(c.message));

describe("gerilim modu", () => {
  it("ZORUNLU: R₁ 240 Ω, R₂ 720 Ω, V_ref 1,25 V, I_adj 50 µA → 5,036 V (5 V + 36 mV)", () => {
    const r = calc({ mod: "gerilim", R1: 240, R2: 720, Io: 0.5 });
    expect(r.outputs.Vo).toBeCloseTo(5.036, 12);
    expect(r.outputs.Vo0).toBeCloseTo(5, 12);
    expect(r.outputs.dVadj).toBeCloseTo(0.036, 12);
    // Elle: I_R1 = 1,25/240 = 5,2083 mA; P = (12 − 5,036)·0,5 = 3,482 W
    expect(r.outputs.IR1).toBeCloseTo(5.208333e-3, 9);
    expect(r.outputs.dV).toBeCloseTo(6.964, 12);
    expect(r.outputs.P).toBeCloseTo(3.482, 12);
    expect(r.outputs).not.toHaveProperty("Tj");
  });

  it("TI Şekil 8-11: 240 Ω / 2,4 kΩ, I_adj = 0 → 13,75 V", () => {
    const r = calc({ mod: "gerilim", R1: 240, R2: 2400, Iadj: 0, Vin: 20, Io: 0.1 });
    expect(r.outputs.Vo).toBeCloseTo(13.75, 12);
    expect(r.outputs.dVadj).toBe(0);
  });

  it("R₂ = 0 → V_o = V_ref", () => {
    expect(calc({ mod: "gerilim", R1: 240, R2: 0, Io: 0.1 }).outputs.Vo).toBe(1.25);
  });

  it("minimum yük akımı: 240 Ω (5,21 mA < 10 mA) uyarı; 120 Ω (10,42 mA) uygun", () => {
    const r240 = calc({ mod: "gerilim", R1: 240, R2: 720, Io: 0.5 });
    const c = uyarilar(r240).find((x) => /R₁ akımı 5,208 mA/.test(x.message));
    expect(c?.message).toMatch(/tipik 3,5 mA, en çok 10 mA/);
    expect(c?.message).toMatch(/125 Ω/);
    expect(c?.reference?.standard).toBe("TI SLVS044Z");
    const r120 = calc({ mod: "gerilim", R1: 120, R2: 360, Io: 0.5 });
    expect(uyarilar(r120)).toEqual([]);
    expect(r120.checks.find((x) => /R₁ akımı 10,42 mA/.test(x.message))?.level).toBe("ok");
  });

  it("giriş–çıkış farkı: 7 V girişte pay < 3 V uyarısı; 4 V girişte regülasyon yok ve kayıp hesaplanmaz; 50 V'ta > 40 V", () => {
    const base = { mod: "gerilim", R1: 120, R2: 360, Io: 0.5 };
    // Elle: V_o = 1,25·4 + 50 µA·360 Ω = 5,018 V
    const r7 = calc({ ...base, Vin: 7 });
    expect(r7.outputs.dV).toBeCloseTo(1.982, 12);
    expect(uyariVar(r7, /önerdiği 3 V payın altında/)).toBe(true);
    expect(r7.outputs.P).toBeCloseTo(0.991, 12);
    const r4 = calc({ ...base, Vin: 4 });
    expect(uyariVar(r4, /regülatör çalışmaz/)).toBe(true);
    expect(r4.outputs).not.toHaveProperty("P");
    const r50 = calc({ ...base, Vin: 50 });
    expect(uyariVar(r50, /40 V sınırını aşıyor/)).toBe(true);
  });

  it("çıkış akımı > 1,5 A ve çıkış gerilimi > 37 V uyarıları", () => {
    expect(uyariVar(calc({ mod: "gerilim", R1: 120, R2: 360, Io: 2 }), /1,5 A/)).toBe(true);
    // Elle: 1,25·(1 + 7200/240) + 50 µA·7,2 kΩ = 38,75 + 0,36 = 39,11 V
    const r = calc({ mod: "gerilim", R1: 240, R2: 7200, Io: 0.1, Vin: 45 });
    expect(r.outputs.Vo).toBeCloseTo(39.11, 12);
    expect(uyariVar(r, /37 V/)).toBe(true);
  });

  it("jonksiyon sıcaklığı: 3,482 W, 23,5 °C/W, 25 °C → 106,83 °C (uygun), P_max = 4,255 W; 37,9 °C/W → 156,97 °C uyarı", () => {
    const r = calc({ mod: "gerilim", R1: 240, R2: 720, Io: 0.5, RthJA: 23.5 });
    // Elle: 25 + 3,482·23,5 = 106,827 °C; P_max = (125 − 25)/23,5 = 4,2553 W
    expect(r.outputs.Tj - T0).toBeCloseTo(106.827, 9);
    expect(r.outputs.Pmax).toBeCloseTo(4.255319, 6);
    expect(r.checks.find((c) => /Jonksiyon sıcaklığı/.test(c.message))?.level).toBe("ok");
    const sicak = calc({ mod: "gerilim", R1: 240, R2: 720, Io: 0.5, RthJA: 37.9 });
    expect(sicak.outputs.Tj - T0).toBeCloseTo(156.9678, 9);
    expect(uyariVar(sicak, /125 °C sınırını aşıyor/)).toBe(true);
  });
});

describe("hedef gerilim modu", () => {
  it("5 V, R₁ 240 Ω, E96 → R₂ = 3,75/(5,2083 mA + 50 µA) = 713,15 Ω → 715 Ω → V_o = 5,0097 V", () => {
    const r = calc({ mod: "hedef", VoHedef: 5, R1: 240, seri: "E96", Io: 0.5 });
    expect(r.outputs.R2h).toBeCloseTo(713.1537, 3);
    expect(r.outputs.R2s).toBeCloseTo(715, 9);
    // Elle: 1,25·(1 + 715/240) + 50 µA·715 Ω = 4,973958 + 0,03575 = 5,009708 V
    expect(r.outputs.Vo).toBeCloseTo(5.009708, 6);
    expect(r.outputs.VoSapma).toBeCloseTo(0.0019417, 6);
  });

  it("ters formül tam: hesaplanan (yuvarlanmamış) R₂ hedef gerilimi I_adj dahil verir", () => {
    const h = calc({ mod: "hedef", VoHedef: 12, R1: 220, seri: "E192", Io: 0.2, Vin: 18 });
    const g = calc({ mod: "gerilim", R1: 220, R2: h.outputs.R2h, Io: 0.2, Vin: 18 });
    expect(g.outputs.Vo).toBeCloseTo(12, 12);
  });

  it("hedef ≤ V_ref doğrulama hatası", () => {
    const v = (Vh: number) => lm317AyarliRegulator.validate?.({ ...TEMEL, mod: "hedef", VoHedef: Vh, R1: 240, seri: "E96", Io: 0.1 }, ctx) ?? [];
    expect(v(1.25)[0]?.level).toBe("hata");
    expect(v(1.3)).toEqual([]);
  });
});

describe("sabit akım kaynağı", () => {
  it("TI §8.3.7: 1,25 V ÷ 24 Ω = 52,083 mA; R tam standart (E24) olduğunda kendisi seçilir; P_R = 65,1 mW", () => {
    const r = calc({ mod: "akim", Ihedef: 1.25 / 24, Vyuk: 7.2, seri: "E24", Vin: 12 });
    expect(r.outputs.Rh).toBeCloseTo(24, 9);
    expect(r.outputs.Rs).toBeCloseTo(24, 9);
    expect(r.outputs.I).toBeCloseTo(52.0833e-3, 7);
    expect(r.outputs.Iyuk).toBeCloseTo(52.0833e-3 + 50e-6, 7);
    // Elle: 1,25²/24 = 0,065104 W
    expect(r.outputs.PR).toBeCloseTo(0.065104, 6);
    // OUT = 7,2 + 1,25 = 8,45 V; fark 3,55 V ≥ 3 V; P = 3,55·52,083 mA = 0,18490 W
    expect(r.outputs.Vo).toBeCloseTo(8.45, 12);
    expect(r.outputs.P).toBeCloseTo(0.184896, 6);
    expect(uyarilar(r)).toEqual([]);
  });

  it("TI §8.3.7 payı: V_yük + 4,25 V'tan düşük girişte uyarı (7,2 V yük, 11 V giriş → fark 2,55 V)", () => {
    const r = calc({ mod: "akim", Ihedef: 1.25 / 24, Vyuk: 7.2, seri: "E24", Vin: 11 });
    expect(r.outputs.dV).toBeCloseTo(2.55, 12);
    expect(uyariVar(r, /3 V payın altında/)).toBe(true);
  });

  it("standart değer güvenli yönde (üst komşu): 52 mA → R = 24,04 Ω → E24 27 Ω → I = 46,30 mA", () => {
    const r = calc({ mod: "akim", Ihedef: 52e-3, Vyuk: 3, seri: "E24", Vin: 12 });
    expect(r.outputs.Rh).toBeCloseTo(24.0385, 4);
    expect(r.outputs.Rs).toBeCloseTo(27, 9);
    expect(r.outputs.I).toBeCloseTo(46.2963e-3, 7);
    expect(r.outputs.I).toBeLessThan(52e-3);
  });

  it("10 mA'nin altındaki ayar akımı minimum yük akımı uyarısı verir; 2 A > 1,5 A uyarısı", () => {
    expect(uyariVar(calc({ mod: "akim", Ihedef: 5e-3, Vyuk: 2, seri: "E24", Vin: 12 }), /minimum yük akımının/)).toBe(true);
    expect(uyariVar(calc({ mod: "akim", Ihedef: 2, Vyuk: 2, seri: "E24", Vin: 12 }), /1,5 A/)).toBe(true);
  });
});

describe("motor üzerinden (runCalc)", () => {
  const modes = (lm317AyarliRegulator.inputs.find((i) => i.key === "mod") as SelectInputSpec).options.map((o) => o.value);

  it.each(modes)("%s: varsayılan girdilerle hatasız sonuç ve KaTeX strict adımlar", (mod) => {
    const r = ok(runCalc(lm317AyarliRegulator, state({ mod: { value: mod } })));
    expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });

  it("V_ref ve I_adj varsayılanları veri sayfası tipik değerleri (config ile aynı): 1,25 V ve 50 µA", () => {
    const s = defaultState(lm317AyarliRegulator);
    expect(s.Vref).toEqual({ value: "1,25", unit: "V" });
    expect(s.Iadj).toEqual({ value: "50", unit: "uA" });
    expect(ctx.limits.elektronikEntegre.lm317.vRef).toBe(1.25);
    expect(ctx.limits.elektronikEntegre.lm317.iAdj).toBe(50e-6);
  });

  it("varsayılan dışı birimler: R₁ 0,24 kΩ, R₂ 0,72 kΩ, I_o 0,5 A, T_a 298,15 K, R_θJA 23,5 K/W → 5,036 V, T_j 106,8 °C", () => {
    const r = ok(
      runCalc(
        lm317AyarliRegulator,
        state({
          mod: { value: "gerilim" },
          R1: { value: "0,24", unit: "kohm" },
          R2: { value: "0,72", unit: "kohm" },
          Io: { value: "0,5", unit: "A" },
          Ta: { value: "298,15", unit: "K" },
          RthJA: { value: "23,5", unit: "K_W" },
        }),
      ),
    );
    expect(r.result.outputs.Vo).toBeCloseTo(5.036, 12);
    expect(r.result.outputs.Tj).toBeCloseTo(T0 + 106.827, 9);
    expect(r.outputs.find((o) => o.key === "Tj")).toMatchObject({ unit: "degC", formatted: "106,8 °C" });
    expect(r.outputs.find((o) => o.key === "dVadj")).toMatchObject({ unit: "mV" });
  });

  it("varsayılan dışı birimler: akım modu 0,35 A, E96 → 1,25/0,35 = 3,571 Ω → üst komşu 3,65 Ω → 342,47 mA", () => {
    const r = ok(runCalc(lm317AyarliRegulator, state({ mod: { value: "akim" }, Ihedef: { value: "0,35", unit: "A" }, seri: { value: "E96" } })));
    expect(r.result.outputs.Rs).toBeCloseTo(3.65, 12);
    expect(r.result.outputs.I).toBeCloseTo(0.342466, 6);
    expect(r.outputs.find((o) => o.key === "Iyuk")?.formatted).toBe("342,52 mA");
  });
});
