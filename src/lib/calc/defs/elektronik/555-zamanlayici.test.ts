/**
 * 555 zamanlayıcı (4.6) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır (ln 2 = 0,693147, ln 3 = 1,098612):
 * - Astable R₁ 1 kΩ, R₂ 10 kΩ, C 100 nF: f = 1/(ln 2·21 kΩ·100 nF) = 1/(0,693147·2,1 ms) = 686,99 Hz; veri sayfasının
 *   1,44 yaklaşımıyla 1,44/(21 kΩ·100 nF) = 685,71 Hz olurdu — test tam değeri bekler. D = 11/21 = %52,381.
 * - Monostable 100 kΩ, 10 µF: t = ln 3·1 s = 1,0986 s (1,1 yaklaşımı 1,1 s verirdi).
 * Formüller TI SLFS022K §6.3.1–6.3.2 (denklem 1–6) ile aynı biçimdedir; sınırlar aynı belgenin §5.3, §5.5 dipnot (1), §6.3.1, §6.3.2'sinden.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, ComputeInputs, InputState, RunResult, SelectInputSpec } from "@/lib/calc/types";
import { rToplamMax, zamanlayici555 } from "./555-zamanlayici";

const ctx = defaultContext();
const calc = (values: ComputeInputs): CalcResult => zamanlayici555.compute({ Vcc: 9, ...values }, ctx);

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

function state(values: Record<string, { value: string; unit?: string }>): InputState {
  return { ...defaultState(zamanlayici555), ...values };
}

const uyarilar = (r: CalcResult) => r.checks.filter((c) => c.level === "uyari");

describe("astable", () => {
  it("ZORUNLU: R₁ 1 kΩ, R₂ 10 kΩ, C 100 nF → f = 686,99 Hz (1,44 ile 685,7 değil), görev %52,381", () => {
    const r = calc({ mod: "astable", R1: 1e3, R2: 10e3, C: 100e-9 });
    expect(r.outputs.f).toBeCloseTo(686.99, 1);
    expect(Math.abs(r.outputs.f - 685.71)).toBeGreaterThan(1);
    expect(r.outputs.D).toBeCloseTo(0.52381, 5);
    // t_H = 0,693147·11 kΩ·100 nF = 762,46 µs; t_L = 0,693147·10 kΩ·100 nF = 693,15 µs; T = 1,4556 ms
    expect(r.outputs.tH).toBeCloseTo(762.46e-6, 8);
    expect(r.outputs.tL).toBeCloseTo(693.15e-6, 8);
    expect(r.outputs.T).toBeCloseTo(1.45561e-3, 8);
    expect(r.outputs.f).toBeCloseTo(1 / r.outputs.T, 9);
    expect(uyarilar(r)).toEqual([]);
    // Diyotsuz devrede görev oranı notu (seviyesi değil içeriği denetlenir)
    expect(r.checks.some((c) => /her zaman %50'nin üzerindedir/.test(c.message))).toBe(true);
  });

  it("eşik ve tetikleme seviyeleri 2/3 ve 1/3 V_CC (9 V → 6 V, 3 V); config oranları ln 2 ve ln 3'ü verir", () => {
    const r = calc({ mod: "astable", R1: 1e3, R2: 10e3, C: 100e-9 });
    expect(r.outputs.Vth).toBeCloseTo(6, 12);
    expect(r.outputs.Vtr).toBeCloseTo(3, 12);
    const { esikOrani, tetikOrani } = ctx.limits.elektronikEntegre.zamanlayici555;
    expect(Math.log((1 - tetikOrani) / (1 - esikOrani))).toBeCloseTo(Math.LN2, 14);
    expect(Math.log(esikOrani / tetikOrani)).toBeCloseTo(Math.LN2, 14);
    expect(Math.log(1 / (1 - esikOrani))).toBeCloseTo(Math.log(3), 14);
  });

  it("frekans > 100 kHz uyarısı (R₁ = R₂ = 1 kΩ, C = 1 nF → 1/(ln 2·3 µs) = 480,9 kHz)", () => {
    const r = calc({ mod: "astable", R1: 1e3, R2: 1e3, C: 1e-9 });
    expect(r.outputs.f).toBeCloseTo(480.9e3, -2);
    expect(uyarilar(r).some((c) => /100 kHz/.test(c.message))).toBe(true);
  });

  it("R₁ + R₂ sınırı: 9 V'ta 3,4 MΩ (5 V değeri), 15 V'ta 10 MΩ; ara değer üretilmez", () => {
    expect(rToplamMax(9, ctx)).toBe(3.4e6);
    expect(rToplamMax(14.9, ctx)).toBe(3.4e6);
    expect(rToplamMax(15, ctx)).toBe(10e6);
    const r9 = calc({ mod: "astable", R1: 2e6, R2: 2e6, C: 1e-6 });
    expect(uyarilar(r9).some((c) => /R₁ \+ R₂ = 4 MΩ/.test(c.message) && /3,4 MΩ/.test(c.message))).toBe(true);
    const r15 = calc({ mod: "astable", R1: 2e6, R2: 2e6, C: 1e-6, Vcc: 15 });
    expect(uyarilar(r15)).toEqual([]);
  });
});

describe("monostable", () => {
  it("ZORUNLU: R 100 kΩ, C 10 µF → t = ln 3·1 s = 1,0986 s (1,1 değil)", () => {
    const r = calc({ mod: "monostable", R: 100e3, C: 10e-6 });
    expect(r.outputs.tw).toBeCloseTo(1.0986, 4);
    expect(Math.abs(r.outputs.tw - 1.1)).toBeGreaterThan(1e-3);
    expect(r.outputs).not.toHaveProperty("f");
    expect(uyarilar(r)).toEqual([]);
  });

  it("10 µs'den kısa darbe uyarısı (1 kΩ, 1 nF → 1,0986 µs)", () => {
    const r = calc({ mod: "monostable", R: 1e3, C: 1e-9 });
    expect(r.outputs.tw).toBeCloseTo(1.0986e-6, 9);
    const c = uyarilar(r).find((x) => /10 µs/.test(x.message));
    expect(c?.reference?.standard).toBe("TI SLFS022K");
  });
});

describe("besleme aralığı (NE555 4,5–16 V)", () => {
  it("3 V ve 18 V uyarı, 4,5 V ve 16 V uyarısız", () => {
    const base = { mod: "monostable", R: 100e3, C: 100e-9 };
    expect(uyarilar(calc({ ...base, Vcc: 3 })).some((c) => /Besleme/.test(c.message))).toBe(true);
    expect(uyarilar(calc({ ...base, Vcc: 18 })).some((c) => /Besleme/.test(c.message))).toBe(true);
    expect(uyarilar(calc({ ...base, Vcc: 4.5 }))).toEqual([]);
    expect(uyarilar(calc({ ...base, Vcc: 16 }))).toEqual([]);
  });
});

describe("ters mod", () => {
  it("astable: f 1 kHz, D %60, C 100 nF, E24 → S = 14,427 kΩ, R₁ = 2,885 kΩ → 3 kΩ, R₂ = 5,771 kΩ → 5,6 kΩ", () => {
    const r = calc({ mod: "astable-tasarim", fHedef: 1000, DHedef: 0.6, C: 100e-9, seri: "E24" });
    // Elle: S = 1/(0,693147·1000·1e-7) = 14 426,95 Ω; R₁ = 0,2·S; R₂ = 0,4·S
    expect(r.outputs.R1h).toBeCloseTo(2885.39, 1);
    expect(r.outputs.R2h).toBeCloseTo(5770.78, 1);
    expect(r.outputs.R1s).toBeCloseTo(3000, 9);
    expect(r.outputs.R2s).toBeCloseTo(5600, 9);
    // Standart değerlerle: f = 1/(0,693147·14,2 kΩ·100 nF) = 1015,98 Hz; D = 8,6/14,2 = %60,563
    expect(r.outputs.f).toBeCloseTo(1015.98, 1);
    expect(r.outputs.D).toBeCloseTo(0.605634, 5);
    expect(r.outputs.fSapma).toBeCloseTo(0.01598, 4);
  });

  it("astable: hesaplanan (yuvarlanmamış) R₁, R₂ hedef f ve D'yi tam verir", () => {
    const r = calc({ mod: "astable-tasarim", fHedef: 2500, DHedef: 0.75, C: 22e-9, seri: "E192" });
    const geri = calc({ mod: "astable", R1: r.outputs.R1h, R2: r.outputs.R2h, C: 22e-9 });
    expect(geri.outputs.f).toBeCloseTo(2500, 9);
    expect(geri.outputs.D).toBeCloseTo(0.75, 12);
  });

  it("monostable: t 100 ms, C 100 nF → R = 910,24 kΩ → E24 910 kΩ → t = 99,974 ms", () => {
    const r = calc({ mod: "monostable-tasarim", tHedef: 0.1, C: 100e-9, seri: "E24" });
    // Elle: R = 0,1/(1,098612·1e-7) = 910 239 Ω; t = 1,098612·910 kΩ·100 nF = 0,0999737 s
    expect(r.outputs.Rh).toBeCloseTo(910239, -1);
    expect(r.outputs.Rs).toBeCloseTo(910e3, 6);
    expect(r.outputs.tw).toBeCloseTo(0.0999737, 7);
    expect(r.outputs.tSapma).toBeCloseTo(-0.000263, 6);
  });

  it("görev oranı %50 ve %100 doğrulama hatası", () => {
    const v = (D: number) => zamanlayici555.validate?.({ mod: "astable-tasarim", Vcc: 9, fHedef: 1000, DHedef: D, C: 1e-7, seri: "E24" }, ctx) ?? [];
    expect(v(0.5)[0]?.level).toBe("hata");
    expect(v(1)[0]?.level).toBe("hata");
    expect(v(0.51)).toEqual([]);
  });
});

describe("motor üzerinden (runCalc)", () => {
  const modes = (zamanlayici555.inputs.find((i) => i.key === "mod") as SelectInputSpec).options.map((o) => o.value);

  it.each(modes)("%s: varsayılan girdilerle hatasız sonuç ve KaTeX strict adımlar", (mod) => {
    const r = ok(runCalc(zamanlayici555, state({ mod: { value: mod } })));
    expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });

  it("varsayılan dışı birimler: R₁ 1000 Ω, R₂ 0,01 MΩ, C 0,1 µF → 687 Hz", () => {
    const r = ok(
      runCalc(
        zamanlayici555,
        state({
          mod: { value: "astable" },
          R1: { value: "1000", unit: "ohm" },
          R2: { value: "0,01", unit: "Mohm" },
          C: { value: "0,1", unit: "uF" },
        }),
      ),
    );
    expect(r.result.outputs.f).toBeCloseTo(686.99, 1);
    expect(r.outputs.find((o) => o.key === "f")?.formatted).toBe("687 Hz");
    expect(r.outputs.find((o) => o.key === "T")).toMatchObject({ unit: "ms" });
  });

  it("varsayılan dışı birimler: monostable R 0,1 MΩ, C 10000 nF; tasarımda hedef 2 s → R = 2/(ln 3·10 µF) = 182,05 kΩ → E24 180 kΩ", () => {
    const m = ok(runCalc(zamanlayici555, state({ mod: { value: "monostable" }, R: { value: "0,1", unit: "Mohm" }, C: { value: "10000", unit: "nF" } })));
    expect(m.result.outputs.tw).toBeCloseTo(1.0986, 4);
    expect(m.outputs.find((o) => o.key === "tw")).toMatchObject({ unit: "s" });
    const t = ok(
      runCalc(
        zamanlayici555,
        state({ mod: { value: "monostable-tasarim" }, tHedef: { value: "2", unit: "s" }, C: { value: "10", unit: "uF" }, seri: { value: "E24" } }),
      ),
    );
    expect(t.result.outputs.Rh).toBeCloseTo(182048, -1);
    expect(t.result.outputs.Rs).toBeCloseTo(180e3, 6);
  });
});

describe("her mod × her E serisi (ters modlar standart değer seçer)", () => {
  const opts = (key: string) => (zamanlayici555.inputs.find((i) => i.key === key) as SelectInputSpec).options.map((o) => o.value);
  const combos = opts("mod").flatMap((mod) => opts("seri").map((seri) => [mod, seri] as const));

  it.each(combos)("%s / %s: varsayılan girdilerle hatasız sonuç", (mod, seri) => {
    const r = ok(runCalc(zamanlayici555, state({ mod: { value: mod }, seri: { value: seri } })));
    expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });
});
