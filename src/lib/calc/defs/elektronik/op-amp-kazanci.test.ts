/**
 * Op-amp kazancı (4.4) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır ya da TI "Analog Engineer's Circuit" notlarındaki çözümlü örneklerdir:
 * - SBOA270C (eviren): R1 = 10 kΩ, R2 = 20 kΩ → G = −2 V/V, NG = 3 V/V; GBP 1,2 MHz → BW = 400 kHz.
 * - SBOA271A (evirmeyen): R1 = 9,09 kΩ (geri besleme), R2 = 1,01 kΩ → G = 10 V/V; GBP 3 MHz → GBP/G = 300 kHz.
 * - SBOA274A (fark): R1 = R2 = 10 kΩ, R3 = R4 = 20 kΩ → G = 2 V/V = 6,02 dB; ±1,25 V fark → ±2,5 V.
 * - SBOA269B (izleyici): bant genişliği birim kazanç bant genişliğidir.
 * - SBOA272C (toplayıcı): R1 = 20,5 kΩ, R2 = 2,05 kΩ, R3 = 20 kΩ; NG = 1 + R3/(R1‖R2) ≈ 11,75 V/V, BW ≈ 102 kHz
 *   (not R1‖R2'yi 1,86 kΩ'a yuvarlar; elle tam hesap R1‖R2 = 20,5·2,05/22,55 = 1,863636 kΩ → NG = 11,7317, BW = 102,29 kHz).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { CalcResult, ComputeInputs, InputState, RunResult, SelectInputSpec } from "@/lib/calc/types";
import { opAmpKazanci } from "./op-amp-kazanci";

const ctx = defaultContext();
const BESLEME = { Vpos: 15, Vneg: -15, payi: 1.5 };
const calc = (values: ComputeInputs): CalcResult => opAmpKazanci.compute({ ...BESLEME, ...values }, ctx);
const validate = (values: ComputeInputs) => opAmpKazanci.validate?.({ ...BESLEME, ...values }, ctx) ?? [];

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

function state(values: Record<string, { value: string; unit?: string }>): InputState {
  return { ...defaultState(opAmpKazanci), ...values };
}

describe("eviren yükselteç", () => {
  it("ZORUNLU: GBW 1 MHz, kazanç −1 (R_f = R_in) → NG = 2, bant genişliği 500 kHz (1 MHz değil)", () => {
    // Elle: A = −10k/10k = −1; NG = 1 + 10k/10k = 2 (|A| değil); f = 1 MHz / 2 = 500 kHz
    const r = calc({ mod: "eviren", Rf: 10e3, Rin: 10e3, Vin: 1, GBW: 1e6 });
    expect(r.outputs.A).toBeCloseTo(-1, 12);
    expect(r.outputs.NG).toBeCloseTo(2, 12);
    expect(r.outputs.BW).toBeCloseTo(500e3, 6);
    expect(Math.abs(r.outputs.BW - 1e6)).toBeGreaterThan(1e5);
    expect(r.outputs.AdB).toBeCloseTo(0, 12);
  });

  it("TI SBOA270C: 10 kΩ / 20 kΩ → −2 V/V, NG 3, GBP 1,2 MHz → 400 kHz; Z_in = 10 kΩ; V_i = −7 V → 14 V", () => {
    const r = calc({ mod: "eviren", Rf: 20e3, Rin: 10e3, Vin: -7, GBW: 1.2e6 });
    expect(r.outputs.A).toBeCloseTo(-2, 12);
    expect(r.outputs.NG).toBeCloseTo(3, 12);
    expect(r.outputs.BW).toBeCloseTo(400e3, 6);
    expect(r.outputs.Zin).toBe(10e3);
    expect(r.outputs.Vout).toBeCloseTo(14, 12);
    // 20·log10(2) = 6,0206 dB (elle)
    expect(r.outputs.AdB).toBeCloseTo(6.0206, 4);
    // 14 V, ±15 V beslemede 1,5 V payla (13,5 V) doyar
    expect(r.checks.find((c) => /pozitif doyum/.test(c.message))?.level).toBe("uyari");
  });

  it("negatif doyum: 100 kΩ / 1 kΩ, 0,2 V → ideal −20 V, alt sınır −13,5 V", () => {
    const r = calc({ mod: "eviren", Rf: 100e3, Rin: 1e3, Vin: 0.2, GBW: 1e6 });
    expect(r.outputs.Vout).toBeCloseTo(-20, 12);
    expect(r.outputs.VoMin).toBeCloseTo(-13.5, 12);
    const c = r.checks.find((x) => /negatif doyum/.test(x.message));
    expect(c?.level).toBe("uyari");
    expect(c?.message).toContain("-13,5 V");
  });

  it("tek besleme (0 V / 5 V, 50 mV pay): pozitif girişte eviren çıkış alt rayda kırpılır", () => {
    const r = opAmpKazanci.compute({ mod: "eviren", Rf: 10e3, Rin: 10e3, Vin: 1, GBW: 1e6, Vpos: 5, Vneg: 0, payi: 0.05 }, ctx);
    expect(r.outputs.Vout).toBeCloseTo(-1, 12);
    expect(r.outputs.VoMin).toBeCloseTo(0.05, 12);
    expect(r.checks.find((c) => /negatif doyum/.test(c.message))?.level).toBe("uyari");
  });

  it("salınım içinde: doyma uyarısı yok", () => {
    const r = calc({ mod: "eviren", Rf: 10e3, Rin: 1e3, Vin: 0.5, GBW: 1e6 });
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
    expect(r.checks.some((c) => /salınım sınırları içinde/.test(c.message))).toBe(true);
  });
});

describe("evirmeyen yükselteç ve izleyici", () => {
  it("ZORUNLU: R_f 9 kΩ, R_g 1 kΩ → 10 V/V (20 dB), GBW 1 MHz → 100 kHz", () => {
    const r = calc({ mod: "evirmeyen", Rf: 9e3, Rg: 1e3, Vin: 0.5, GBW: 1e6 });
    expect(r.outputs.A).toBeCloseTo(10, 12);
    expect(r.outputs.AdB).toBeCloseTo(20, 12);
    expect(r.outputs.NG).toBeCloseTo(10, 12);
    expect(r.outputs.BW).toBeCloseTo(100e3, 6);
    expect(r.outputs.Vout).toBeCloseTo(5, 12);
    expect(r.outputs.Vcm).toBeCloseTo(0.5, 12);
    expect(r.outputs).not.toHaveProperty("Zin");
  });

  it("TI SBOA271A: 9,09 kΩ / 1,01 kΩ → 10 V/V; GBP 3 MHz → 300 kHz; 1 V → 10 V", () => {
    const r = calc({ mod: "evirmeyen", Rf: 9.09e3, Rg: 1.01e3, Vin: 1, GBW: 3e6 });
    expect(r.outputs.A).toBeCloseTo(10, 10);
    expect(r.outputs.BW).toBeCloseTo(300e3, 3);
    expect(r.outputs.Vout).toBeCloseTo(10, 10);
    // Evirmeyen bağlantıda ortak mod = giriş: hatırlatma notu (seviyesi değil içeriği denetlenir)
    expect(r.checks.some((c) => /ortak mod gerilimi 1 V/.test(c.message))).toBe(true);
  });

  it("pozitif doyum: 11 V/V, 2 V → ideal 22 V > 13,5 V", () => {
    const r = calc({ mod: "evirmeyen", Rf: 10e3, Rg: 1e3, Vin: 2, GBW: 1e6 });
    expect(r.outputs.Vout).toBeCloseTo(22, 12);
    expect(r.checks.find((c) => /pozitif doyum/.test(c.message))?.level).toBe("uyari");
  });

  it("TI SBOA269B izleyici: A = NG = 1, bant genişliği = GBW", () => {
    const r = calc({ mod: "izleyici", Vin: -2.5, GBW: 4e6 });
    expect(r.outputs.A).toBe(1);
    expect(r.outputs.NG).toBe(1);
    expect(r.outputs.BW).toBe(4e6);
    expect(r.outputs.Vout).toBe(-2.5);
    expect(r.outputs.AdB).toBe(0);
  });
});

describe("fark yükselteci ve toplayıcı", () => {
  it("TI SBOA274A: R₁ 10 kΩ, R₂ 20 kΩ → 2 V/V = 6,02 dB; V₂ − V₁ = 1,25 V → 2,5 V; NG = 3", () => {
    const r = calc({ mod: "fark", R1: 10e3, R2: 20e3, V1: 0, V2: 1.25, GBW: 1e6 });
    expect(r.outputs.A).toBeCloseTo(2, 12);
    expect(r.outputs.AdB).toBeCloseTo(6.02, 2);
    expect(r.outputs.Vout).toBeCloseTo(2.5, 12);
    expect(r.outputs.NG).toBeCloseTo(3, 12);
    // Elle: V_cm = 1,25·20/30 = 0,8333 V
    expect(r.outputs.Vcm).toBeCloseTo(1.25 * (2 / 3), 12);
    const ters = calc({ mod: "fark", R1: 10e3, R2: 20e3, V1: 1.25, V2: 0, GBW: 1e6 });
    expect(ters.outputs.Vout).toBeCloseTo(-2.5, 12);
  });

  it("TI SBOA272C toplayıcı: NG ≈ 11,75, BW ≈ 102 kHz (GBP 1,2 MHz); çıkış −(2,5·20/20,5 + 0,25·20/2,05) = −4,878 V", () => {
    const r = calc({ mod: "toplayici", Rf: 20e3, Ri: [20.5e3, 2.05e3], Vi: [2.5, 0.25], GBW: 1.2e6 });
    expect(r.outputs.Rpar).toBeCloseTo(1863.636, 2);
    expect(r.outputs.NG).toBeCloseTo(11.7317, 4);
    expect(Math.abs(r.outputs.NG - 11.75)).toBeLessThan(0.02);
    expect(r.outputs.BW).toBeCloseTo(102.29e3, -1);
    expect(Math.abs(r.outputs.BW - 102e3)).toBeLessThan(500);
    expect(r.outputs.Vout).toBeCloseTo(-4.878049, 6);
    // Toplayıcıda tek bir kazanç yoktur
    expect(r.outputs).not.toHaveProperty("A");
    expect(r.outputs).not.toHaveProperty("AdB");
  });

  it("toplayıcı: eşit dirençlerde NG = n + 1 (elle: 3 giriş, 10 kΩ → 4)", () => {
    const r = calc({ mod: "toplayici", Rf: 10e3, Ri: [10e3, 10e3, 10e3], Vi: [1, 0.5, -0.2], GBW: 1e6 });
    expect(r.outputs.NG).toBeCloseTo(4, 12);
    expect(r.outputs.BW).toBeCloseTo(250e3, 6);
    expect(r.outputs.Vout).toBeCloseTo(-1.3, 12);
  });
});

describe("ters mod: hedef kazançtan R_f", () => {
  it("eviren, |A| = 3,3, R_in = 1,5 kΩ → R_f = 4,95 kΩ → E96 en yakın 4,99 kΩ → A = −3,3267, sapma %0,808", () => {
    const r = calc({ mod: "eviren-tasarim", Ahedef: 3.3, Rin: 1.5e3, seri: "E96", Vin: 1, GBW: 1e6 });
    expect(r.outputs.Rfh).toBeCloseTo(4950, 9);
    expect(r.outputs.Rfs).toBeCloseTo(4990, 9);
    expect(r.outputs.A).toBeCloseTo(-4.99 / 1.5, 12);
    expect(r.outputs.sapma).toBeCloseTo((4.99 / 1.5 - 3.3) / 3.3, 12);
    // Gürültü kazancı gerçekleşen R_f ile: 1 + 4,99/1,5 = 4,3267
    expect(r.outputs.NG).toBeCloseTo(1 + 4.99 / 1.5, 12);
    expect(r.outputs.Zin).toBe(1.5e3);
  });

  it("evirmeyen, A = 10, R_g = 1 kΩ → R_f = 9 kΩ → E96: 9,09 kΩ (A = 10,09); E24: 9,1 kΩ (A = 10,1)", () => {
    const e96 = calc({ mod: "evirmeyen-tasarim", Ahedef: 10, Rg: 1e3, seri: "E96", Vin: 0.5, GBW: 1e6 });
    expect(e96.outputs.Rfh).toBeCloseTo(9000, 9);
    expect(e96.outputs.Rfs).toBeCloseTo(9090, 9);
    expect(e96.outputs.A).toBeCloseTo(10.09, 12);
    const e24 = calc({ mod: "evirmeyen-tasarim", Ahedef: 10, Rg: 1e3, seri: "E24", Vin: 0.5, GBW: 1e6 });
    expect(e24.outputs.Rfs).toBeCloseTo(9100, 9);
    expect(e24.outputs.A).toBeCloseTo(10.1, 12);
  });

  it("hesaplanan R_f zaten standartsa kendisi seçilir (|A| = 10, R_in = 1 kΩ → 10 kΩ)", () => {
    const r = calc({ mod: "eviren-tasarim", Ahedef: 10, Rin: 1e3, seri: "E12", Vin: 0.1, GBW: 1e6 });
    expect(r.outputs.Rfs).toBeCloseTo(10e3, 9);
    expect(r.outputs.sapma).toBeCloseTo(0, 12);
  });
});

describe("doğrulama", () => {
  it("evirmeyen tasarımda A ≤ 1 hata", () => {
    expect(validate({ mod: "evirmeyen-tasarim", Ahedef: 1, Rg: 1e3, seri: "E96" }).some((c) => c.level === "hata")).toBe(true);
    expect(validate({ mod: "evirmeyen-tasarim", Ahedef: 1.5, Rg: 1e3, seri: "E96" })).toEqual([]);
  });

  it("toplayıcıda direnç ve gerilim sayısı eşit olmalı", () => {
    const c = validate({ mod: "toplayici", Rf: 10e3, Ri: [10e3, 10e3], Vi: [1, 2, 3] });
    expect(c[0]).toMatchObject({ level: "hata" });
    expect(c[0].message).toMatch(/\(2\).*\(3\)/);
  });

  it("besleme sırası ve ray payı", () => {
    expect(validate({ mod: "izleyici", Vpos: 5, Vneg: 5 })[0]?.level).toBe("hata");
    expect(validate({ mod: "izleyici", Vpos: 5, Vneg: 0, payi: 2.5 })[0]?.message).toMatch(/Ray payı/);
    expect(validate({ mod: "izleyici", Vpos: 5, Vneg: 0, payi: 2.4 })).toEqual([]);
  });
});

describe("motor üzerinden (runCalc)", () => {
  const modes = (opAmpKazanci.inputs.find((i) => i.key === "mod") as SelectInputSpec).options.map((o) => o.value);

  it.each(modes)("%s: varsayılan girdilerle hatasız sonuç ve KaTeX strict adımlar", (mod) => {
    const r = ok(runCalc(opAmpKazanci, state({ mod: { value: mod } })));
    expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    expect(r.result.outputs).toHaveProperty("BW");
    for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });

  it("varsayılan dışı birimler: R_f 0,01 MΩ, R_in 1000 Ω, V_in 250 mV, GBW 3000 kHz, pay 200 mV → −10, −2,5 V, 272,7 kHz", () => {
    const r = ok(
      runCalc(
        opAmpKazanci,
        state({
          mod: { value: "eviren" },
          Rf: { value: "0,01", unit: "Mohm" },
          Rin: { value: "1000", unit: "ohm" },
          Vin: { value: "250", unit: "mV" },
          GBW: { value: "3000", unit: "kHz" },
          payi: { value: "200", unit: "mV" },
        }),
      ),
    );
    expect(r.result.outputs.A).toBeCloseTo(-10, 12);
    expect(r.result.outputs.Vout).toBeCloseTo(-2.5, 12);
    expect(r.result.outputs.VoMax).toBeCloseTo(14.8, 12);
    // Elle: 3 MHz / 11 = 272 727 Hz
    expect(r.result.outputs.BW).toBeCloseTo(3e6 / 11, 6);
    expect(r.outputs.find((o) => o.key === "BW")).toMatchObject({ unit: "kHz", formatted: "272,7 kHz" });
    expect(r.outputs.find((o) => o.key === "A")?.formatted).toBe("-10 V/V");
  });

  it("toplayıcı listeleri mV ve kΩ ile: 500; 250 mV, 10; 5 kΩ, R_f 10 kΩ → −(0,5 + 0,5) = −1 V", () => {
    const r = ok(
      runCalc(
        opAmpKazanci,
        state({
          mod: { value: "toplayici" },
          Ri: { value: "10; 5", unit: "kohm" },
          Vi: { value: "500; 250", unit: "mV" },
        }),
      ),
    );
    expect(r.result.outputs.Vout).toBeCloseTo(-1, 12);
    // Elle: R‖ = 10·5/15 = 3,333 kΩ → NG = 1 + 10/3,333 = 4
    expect(r.result.outputs.NG).toBeCloseTo(4, 12);
  });

  it("liste uzunlukları farklıysa motor validate hatası döner", () => {
    const r = runCalc(opAmpKazanci, state({ mod: { value: "toplayici" }, Vi: { value: "1; 2", unit: "V" } }));
    expect(r.ok).toBe(false);
  });
});
