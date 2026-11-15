/**
 * 4.1 LED ön direnci testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır (R = V_R/I_F, I = V_R/R_std, P_R = I²·R_std); kaynak örneği Broadcom AN1005
 * (AV02-0871EN) DC Design Example, Step 5: 5 V, V_SAT 0,1 V, V_F 1,95 V, 42 mA → R = 70 Ω, 1/4 W direnç
 * (https://docs.broadcom.com/doc/AV02-0871EN). E serisi komşuları Vishay 28372 tablosundan (yardimci/e-serileri.ts).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { LIMITS } from "@/config/sinirlar";
import type { ComputeInputs, InputState, SelectInputSpec } from "@/lib/calc/types";
import { ledOnDirenci as def } from "./led-on-direnci";

const ctx = defaultContext();

/** Zorunlu test vektörü: 12 V, V_F 3,2 V, 20 mA, n 1, E12 */
const ZORUNLU: ComputeInputs = { Vs: 12, Vf: 3.2, If: 0.02, n: 1, m: 1, Vsat: 0, seri: "E12", k: 2 };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("ön direnç ve standart değer", () => {
  it("zorunlu vektör: 12 V, 3,2 V, 20 mA, n 1, E12 → 440 Ω, standart 470 Ω, 18,72 mA, 0,16477 W", () => {
    // Elle: V_R = 12 − 3,2 = 8,8 V; R = 8,8/0,02 = 440 Ω; E12 üst komşu 470 Ω (390 < 440 < 470);
    // I = 8,8/470 = 0,0187234 A; P_R = 8,8²/470 = 0,164766 W; önerilen anma 2·0,164766 = 0,329532 W
    const o = def.compute(ZORUNLU, ctx).outputs;
    expect(o.VR).toBeCloseTo(8.8, 12);
    expect(o.R).toBeCloseTo(440, 9);
    expect(o.Rstd).toBe(470);
    expect(o.I).toBeCloseTo(0.0187234, 7);
    expect(o.PR).toBeCloseTo(0.16477, 5);
    expect(o.PRmin).toBeCloseTo(0.3295319, 7);
    // η = 3,2/12; P_LED = 3,2 · 0,0187234
    expect(o.eta).toBeCloseTo(0.2666667, 7);
    expect(o.PLED).toBeCloseTo(0.0599149, 7);
  });

  it("aynı vektör runCalc ile, varsayılan dışı birimler (mV, A, mW)", () => {
    const r = run(
      {
        Vs: { value: "12000", unit: "mV" },
        Vf: { value: "3200", unit: "mV" },
        If: { value: "0,02", unit: "A" },
        n: { value: "1", unit: "unitless" },
        seri: { value: "E12" },
        Panma: { value: "500", unit: "mW" },
      },
      { PR: "mW" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.Rstd).toBe(470);
    expect(r.result.outputs.PR).toBeCloseTo(0.164766, 6);
    expect(r.outputs.find((x) => x.key === "PR")?.unit).toBe("mW");
    // 0,5 W ≥ 2·0,1648 W: yeterli
    expect(r.result.checks.filter((c) => c.level === "uyari")).toEqual([]);
    expect(r.result.checks.some((c) => c.message.includes("yeterli"))).toBe(true);
  });

  it("E6, E24, E96'da üst komşu: 440 Ω → 470 / 470 / 442 Ω", () => {
    // E6: 330 < 440 < 470; E24: 430 < 440 < 470; E96: 432 < 440 < 442 → I = 8,8/442 = 19,9095 mA
    expect(def.compute({ ...ZORUNLU, seri: "E6" }, ctx).outputs.Rstd).toBe(470);
    expect(def.compute({ ...ZORUNLU, seri: "E24" }, ctx).outputs.Rstd).toBe(470);
    const o = def.compute({ ...ZORUNLU, seri: "E96" }, ctx).outputs;
    expect(o.Rstd).toBeCloseTo(442, 9);
    expect(o.I).toBeCloseTo(0.01990950, 8);
  });

  it("hesaplanan değer standartsa kendisi seçilir: 12 V, 3 × 3,2 V, 20 mA → 120 Ω (E24), akım 20 mA", () => {
    // Elle: V_R = 12 − 9,6 = 2,4 V; R = 120 Ω (E24'te var); I = 20 mA; P_R = 0,048 W; η = 9,6/12 = %80
    const o = def.compute({ ...ZORUNLU, n: 3, seri: "E24" }, ctx).outputs;
    expect(o.Rstd).toBe(120);
    expect(o.I).toBeCloseTo(0.02, 12);
    expect(o.PR).toBeCloseTo(0.048, 12);
    expect(o.eta).toBeCloseTo(0.8, 12);
  });

  it("Broadcom AN1005: 5 V, V_SAT 0,1 V, V_F 1,95 V, 42 mA → R ≈ 70 Ω; E96'da 71,5 Ω ile 1/4 W yeterli", () => {
    // Elle: R = (5 − 0,1 − 1,95)/0,042 = 70,238 Ω (kaynak: 70 Ω). E96: 69,8 < 70,24 < 71,5 → 71,5 Ω;
    // I = 2,95/71,5 = 41,259 mA; P_R = 2,95²/71,5 = 0,121713 W; 2·P_R = 0,243427 W ≤ 0,25 W (kaynak: "use a 1/4 watt")
    const r = run({
      Vs: { value: "5", unit: "V" },
      Vsat: { value: "100", unit: "mV" },
      Vf: { value: "1,95", unit: "V" },
      If: { value: "42", unit: "mA" },
      n: { value: "1", unit: "unitless" },
      seri: { value: "E96" },
      Panma: { value: "0,25", unit: "W" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.R).toBeCloseTo(70.238095, 5);
    expect(Math.round(o.R)).toBe(70);
    expect(o.Rstd).toBeCloseTo(71.5, 9);
    expect(o.I).toBeCloseTo(0.04125874, 8);
    expect(o.PR).toBeCloseTo(0.1217133, 7);
    expect(o.PRmin).toBeCloseTo(0.2434266, 7);
    expect(r.result.checks.find((c) => c.message.includes("yeterli"))?.level).toBe("ok");
  });
});

describe("güç denetimi ve paralel diziler", () => {
  it("0,25 W direnç: harcanan 0,165 W'ı karşılar ama 2 katsayıyla gereken 0,33 W'ın altında → uyarı", () => {
    const r = def.compute({ ...ZORUNLU, Panma: 0.25 }, ctx);
    const uyari = r.checks.filter((c) => c.level === "uyari");
    expect(uyari).toHaveLength(1);
    expect(uyari[0].message).toContain("emniyet katsayısıyla");
  });

  it("0,1 W direnç: harcanan güç anma gücünü aşar → uyarı", () => {
    const uyari = def.compute({ ...ZORUNLU, Panma: 0.1 }, ctx).checks.filter((c) => c.level === "uyari");
    expect(uyari).toHaveLength(1);
    expect(uyari[0].message).toContain("aşıyor");
  });

  it("anma gücü boşsa denetim yapılmaz", () => {
    const r = def.compute(ZORUNLU, ctx);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
    expect(r.checks.some((c) => c.message.includes("yeterli"))).toBe(false);
  });

  it("4 paralel dizi: toplam akım 4·I, besleme gücü V_s·4·I", () => {
    // Elle: I = 0,0187234 A; I_top = 0,0748936 A; P_top = 12 · 0,0748936 = 0,898723 W
    const r = def.compute({ ...ZORUNLU, m: 4 }, ctx);
    expect(r.outputs.Itop).toBeCloseTo(0.0748936, 7);
    expect(r.outputs.Ptop).toBeCloseTo(0.8987234, 7);
    expect(r.checks.some((c) => c.message.includes("kendi ön direnci"))).toBe(true);
  });

  it("emniyet katsayısının varsayılanı config'teki Broadcom AN1005 değeri (2)", () => {
    expect(LIMITS.elektronikTemel.ledDirencGucKatsayisi).toBe(2);
    expect(defaultState(def).k.value).toBe("2");
  });
});

describe("doğrulama", () => {
  it("n·V_F ≥ V_s → hata (6 V, 2 × 3 V)", () => {
    const r = run({ Vs: { value: "6", unit: "V" }, Vf: { value: "3", unit: "V" }, n: { value: "2", unit: "unitless" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks.some((c) => c.level === "hata")).toBe(true);
  });

  it("sürücü doyma gerilimi de hesaba katılır: 5 V, 3 V, V_sat 2 V → hata", () => {
    const r = run({ Vs: { value: "5", unit: "V" }, Vf: { value: "3", unit: "V" }, n: { value: "1", unit: "unitless" }, Vsat: { value: "2", unit: "V" } });
    expect(r.ok).toBe(false);
  });

  it("her seri seçeneği varsayılan girdilerle hatasız sonuç verir", () => {
    const seri = def.inputs.find((i): i is SelectInputSpec => i.key === "seri" && i.kind === "select");
    if (!seri) throw new Error("seri yok");
    for (const o of seri.options) {
      const r = run({ seri: { value: o.value } });
      if (!r.ok) throw new Error(`${o.value}: ${JSON.stringify(r)}`);
      expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    }
  });
});
