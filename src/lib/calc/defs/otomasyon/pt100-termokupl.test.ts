/**
 * PT100/PT1000 ve termokupl (5.3) testleri. Gerçek birim sistemiyle çalışır.
 *
 * RTD beklenen değerleri elle hesaptır (IEC 60751 Callendar–Van Dusen, A = 3,9083e-3, B = −5,775e-7,
 * C = −4,183e-12), ör. 100 °C: 100·(1 + 0,39083 − 0,005775) = 138,5055 Ω.
 *
 * Termokupl beklenen değerleri NIST ITS-90 tablolarından alınmıştır (0 °C referans uç, mV, 3 ondalık):
 * https://its90.nist.gov/downloadFiles/type_k.tab.txt (type_j, type_t, type_e, type_n, type_r, type_s, type_b aynı yolda).
 * Tablo 0,001 mV'a yuvarlandığı için ileri yönde ±0,0005 mV; ters yönde ±0,0005 mV / (dE/dt) tolerans
 * kullanılır (dE/dt tablodaki ±1 °C komşu değerlerden, %10 payla, en az 0,02 °C).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc, visibleInputs } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import {
  pt100Termokupl,
  rtdDirenc,
  rtdSicaklik,
  tcEmf,
  tcSicaklik,
  tcSicaklikAraligi,
  tcTersPolinom,
  type SensorMod,
} from "./pt100-termokupl";
import { NIST_TERMOKUPL, type TermokuplTipi } from "./termokupl-nist";

const ctx = defaultContext();
const K0 = 273.15;
const compute = (inputs: Partial<ComputeInputs>) =>
  pt100Termokupl.compute({ r0Secim: "100", tcTip: "K", Ts: K0, ...inputs } as ComputeInputs, ctx);
const validate = (inputs: Partial<ComputeInputs>) =>
  pt100Termokupl.validate?.({ r0Secim: "100", tcTip: "K", Ts: K0, ...inputs } as ComputeInputs, ctx) ?? [];

function state(mod: SensorMod, values: Record<string, [string, string?]> = {}): InputState {
  const s: InputState = { ...defaultState(pt100Termokupl), mod: { value: mod } };
  for (const [k, [value, unit]] of Object.entries(values)) s[k] = { value, unit: unit ?? s[k]?.unit };
  return s;
}

describe("RTD — IEC 60751 (elle hesap)", () => {
  it("zorunlu noktalar: Pt100 100 °C → 138,5055 Ω; −100 °C → 60,2558 Ω; 0 °C → 100 Ω", () => {
    expect(rtdDirenc(100, 100)).toBeCloseTo(138.5055, 10);
    // 100·(1 − 0,39083 − 0,005775 + (−4,183e-12)·(−200)·(−1e6)) = 100·0,6025584
    expect(rtdDirenc(100, -100)).toBeCloseTo(60.25584, 10);
    expect(rtdDirenc(100, 0)).toBe(100);
  });

  it("aralık uçları: −200 °C → 18,52008 Ω; 850 °C → 390,481125 Ω; Pt1000 100 °C → 1385,055 Ω", () => {
    expect(rtdDirenc(100, -200)).toBeCloseTo(18.52008, 10);
    expect(rtdDirenc(100, 850)).toBeCloseTo(390.481125, 9);
    expect(rtdDirenc(1000, 100)).toBeCloseTo(1385.055, 9);
  });

  it("ters yön: 138,5055 Ω → 100 °C; 60,25584 Ω → −100 °C; 100 Ω → 0 °C", () => {
    expect(rtdSicaklik(100, 138.5055)).toBeCloseTo(100, 9);
    expect(rtdSicaklik(100, 60.25584)).toBeCloseTo(-100, 9);
    expect(rtdSicaklik(100, 100)).toBe(0);
    expect(rtdSicaklik(1000, 1385.055)).toBeCloseTo(100, 9);
  });

  it("gidiş-dönüş −200…850 °C boyunca tutarlı (Pt100 ve Pt1000)", () => {
    for (let t = -200; t <= 850; t += 12.5) {
      expect(rtdSicaklik(100, rtdDirenc(100, t)), String(t)).toBeCloseTo(t, 9);
      expect(rtdSicaklik(1000, rtdDirenc(1000, t)), String(t)).toBeCloseTo(t, 9);
    }
  });

  it("compute: sıcaklık K olarak girer, direnç Ω; direnç → sıcaklık K döner", () => {
    expect(compute({ mod: "rtd-tr", T: K0 + 100 }).outputs.R).toBeCloseTo(138.5055, 9);
    expect(compute({ mod: "rtd-rt", R: 60.25584 }).outputs.T).toBeCloseTo(K0 - 100, 9);
    expect(compute({ mod: "rtd-tr", r0Secim: "1000", T: K0 + 100 }).outputs.R).toBeCloseTo(1385.055, 8);
    expect(compute({ mod: "rtd-tr", r0Secim: "ozel", R0: 500, T: K0 + 100 }).outputs.R).toBeCloseTo(692.5275, 9);
  });

  it("−200…850 °C dışı 'hata'; uçlar kabul edilir", () => {
    expect(validate({ mod: "rtd-tr", T: K0 - 200.1 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate({ mod: "rtd-tr", T: K0 + 850.1 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate({ mod: "rtd-tr", T: K0 + 850 })).toEqual([]);
    expect(validate({ mod: "rtd-tr", T: K0 - 200 })).toEqual([]);
    expect(validate({ mod: "rtd-rt", R: 18.5 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate({ mod: "rtd-rt", R: 390.5 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate({ mod: "rtd-rt", R: 390.481125 })).toEqual([]);
  });
});

/** [t (°C), E (mV, NIST tablosu), ters yön toleransı (°C)]; tolerans null → ters fonksiyon aralığı dışında */
const NIST_NOKTALARI: Record<TermokuplTipi, [number, number, number | null][]> = {
  K: [[-270, -6.458, null], [-200, -5.891, 0.04], [-100, -3.554, 0.02], [25, 1.0, 0.02], [100, 4.096, 0.02], [127, 5.206, 0.02], [500, 20.644, 0.02], [1000, 41.276, 0.02], [1372, 54.886, 0.02]],
  J: [[-210, -8.095, 0.03], [-200, -7.89, 0.03], [-100, -4.633, 0.02], [25, 1.277, 0.02], [100, 5.269, 0.02], [500, 27.393, 0.02], [760, 42.919, 0.02], [800, 45.494, 0.02], [1200, 69.553, 0.02]],
  T: [[-270, -6.258, null], [-200, -5.603, 0.04], [-100, -3.379, 0.02], [25, 0.992, 0.02], [100, 4.279, 0.02], [400, 20.872, 0.02]],
  E: [[-270, -9.835, null], [-200, -8.825, 0.03], [-100, -5.237, 0.02], [25, 1.495, 0.02], [100, 6.319, 0.02], [500, 37.005, 0.02], [1000, 76.373, 0.02]],
  N: [[-270, -4.345, null], [-200, -3.99, 0.06], [-100, -2.407, 0.03], [25, 0.659, 0.03], [100, 2.774, 0.02], [600, 20.613, 0.02], [1000, 36.256, 0.02], [1300, 47.513, 0.02]],
  R: [[-50, -0.226, 0.19], [25, 0.141, 0.1], [100, 0.647, 0.08], [1000, 10.506, 0.05], [1100, 11.85, 0.05], [1600, 18.849, 0.04], [1700, 20.222, 0.05], [1768, 21.101, 0.05]],
  S: [[-50, -0.236, 0.14], [25, 0.143, 0.1], [100, 0.646, 0.08], [1000, 9.587, 0.05], [1100, 10.757, 0.05], [1600, 16.777, 0.05], [1700, 17.947, 0.05], [1768, 18.693, 0.05]],
  B: [[0, 0.0, null], [25, -0.002, null], [250, 0.291, 0.19], [300, 0.431, 0.19], [600, 1.792, 0.1], [1000, 4.834, 0.07], [1500, 10.099, 0.05], [1820, 13.82, 0.05]],
};

describe("termokupl — NIST ITS-90 tabloları", () => {
  it("zorunlu noktalar: K 100 °C → 4,096 mV; J 100 → 5,269; T 100 → 4,279; K 500 → 20,644", () => {
    const yakin = (tip: TermokuplTipi, t: number, e: number) =>
      expect(Math.abs(tcEmf(tip, t) - e), `${tip} ${t}`).toBeLessThanOrEqual(0.0005);
    yakin("K", 100, 4.096);
    yakin("J", 100, 5.269);
    yakin("T", 100, 4.279);
    yakin("K", 500, 20.644);
  });

  it("zorunlu noktalar ters yönde ±0,05 °C", () => {
    expect(Math.abs(tcSicaklik("K", 4.096) - 100)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(tcSicaklik("J", 5.269) - 100)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(tcSicaklik("T", 4.279) - 100)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(tcSicaklik("K", 20.644) - 500)).toBeLessThanOrEqual(0.05);
  });

  it.each(Object.keys(NIST_NOKTALARI) as TermokuplTipi[])("%s tipi: her alt aralıkta ileri ve ters yön tabloyla uyumlu", (tip) => {
    for (const [t, e, tol] of NIST_NOKTALARI[tip]) {
      expect(Math.abs(tcEmf(tip, t) - e), `${tip} ${t} °C → E`).toBeLessThanOrEqual(0.0005 + 1e-9);
      if (tol !== null) expect(Math.abs(tcSicaklik(tip, e) - t), `${tip} ${e} mV → t`).toBeLessThanOrEqual(tol);
    }
  });

  it.each(Object.keys(NIST_TERMOKUPL) as TermokuplTipi[])(
    "%s tipi: NIST ters polinomları referans fonksiyonunu NIST'in verdiği hata aralığında izler (sütunlar doğru okunmuş)",
    (tip) => {
      const ters = NIST_TERMOKUPL[tip].ters;
      const hata = Math.max(...ters.map((r) => Math.max(Math.abs(r.errMin), Math.abs(r.errMax)))) + 0.002;
      for (let t = ters[0].tMin; t <= ters[ters.length - 1].tMax; t += 5) {
        const e = tcEmf(tip, t);
        expect(Math.abs(tcTersPolinom(tip, e) - t), `${tip} ${t} °C`).toBeLessThanOrEqual(hata);
        expect(tcSicaklik(tip, e), `${tip} ${t} °C`).toBeCloseTo(t, 6);
      }
    },
  );

  it("K tipinde 0 °C üstündeki üstel terim dahil: 0 °C'de iki aralık sürekli", () => {
    const { a0, a1, a2 } = NIST_TERMOKUPL.K.ustel ?? { a0: 0, a1: 0, a2: 0 };
    const pozitif = NIST_TERMOKUPL.K.referans[1].c[0] + a0 * Math.exp(a1 * a2 * a2);
    expect(Math.abs(pozitif)).toBeLessThan(1e-5);
    expect(Math.abs(tcEmf("K", 1e-9) - tcEmf("K", -1e-9))).toBeLessThan(1e-5);
  });

  it("geçerlilik aralıkları NIST'tekiyle aynı", () => {
    expect(tcSicaklikAraligi("K")).toEqual({ tMin: -270, tMax: 1372 });
    expect(tcSicaklikAraligi("B")).toEqual({ tMin: 0, tMax: 1820 });
    expect(tcSicaklikAraligi("R")).toEqual({ tMin: -50, tMax: 1768.1 });
  });
});

describe("soğuk uç kompanzasyonu (NIST tabloları)", () => {
  it("K, soğuk uç 25 °C (1,000 mV): 100 °C → 3,096 mV; 3,096 mV → 100 °C", () => {
    const te = compute({ mod: "tc-te", T: K0 + 100, Ts: K0 + 25 });
    expect(Math.abs(te.outputs.E_olcum * 1e3 - 3.096)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(te.outputs.E_soguk * 1e3 - 1.0)).toBeLessThanOrEqual(0.0005);
    expect(Math.abs(te.outputs.E_sicak * 1e3 - 4.096)).toBeLessThanOrEqual(0.0005);

    const et = compute({ mod: "tc-et", E: 3.096e-3, Ts: K0 + 25 });
    expect(Math.abs(et.outputs.T - K0 - 100)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(et.outputs.E_sicak * 1e3 - 4.096)).toBeLessThanOrEqual(0.001);
  });

  it("J, soğuk uç 25 °C (1,277 mV): 500 °C → 27,393 − 1,277 = 26,116 mV", () => {
    const te = compute({ mod: "tc-te", tcTip: "J", T: K0 + 500, Ts: K0 + 25 });
    expect(Math.abs(te.outputs.E_olcum * 1e3 - 26.116)).toBeLessThanOrEqual(0.001);
    const et = compute({ mod: "tc-et", tcTip: "J", E: 26.116e-3, Ts: K0 + 25 });
    expect(Math.abs(et.outputs.T - K0 - 500)).toBeLessThanOrEqual(0.05);
  });

  it("soğuk uç ölçüm noktasından sıcaksa ölçülen EMF negatif olur: K, 0 °C ölçüm, 25 °C soğuk uç → −1,000 mV", () => {
    const te = compute({ mod: "tc-te", T: K0, Ts: K0 + 25 });
    expect(Math.abs(te.outputs.E_olcum * 1e3 + 1.0)).toBeLessThanOrEqual(0.0005);
  });
});

describe("termokupl geçerlilik aralığı ('hata')", () => {
  it("sıcaklık → EMF: referans fonksiyonu aralığı dışında", () => {
    expect(validate({ mod: "tc-te", T: K0 + 1372.5 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate({ mod: "tc-te", tcTip: "T", T: K0 + 401 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate({ mod: "tc-te", T: K0 + 1372 })).toEqual([]);
    expect(validate({ mod: "tc-te", tcTip: "B", T: K0 + 100, Ts: K0 - 5 })[0].message).toMatch(/Soğuk uç/);
  });

  it("EMF → sıcaklık: kompanze edilmiş EMF ters fonksiyon aralığı dışında", () => {
    expect(validate({ mod: "tc-et", E: 55e-3 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate({ mod: "tc-et", E: -5.9e-3 })).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(validate({ mod: "tc-et", E: 54.886e-3 })).toEqual([]);
    // B tipinin ters fonksiyonu 250 °C'den (0,291 mV) başlar
    expect(validate({ mod: "tc-et", tcTip: "B", E: 0.2e-3 })).toEqual([expect.objectContaining({ level: "hata" })]);
    // ölçülen EMF aralıkta, soğuk uçla toplam aralık dışında: K 54 mV + E(25 °C) = 55 mV
    expect(validate({ mod: "tc-et", E: 54e-3, Ts: K0 + 25 })[0].message).toMatch(/kompanzasyonlu EMF/);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan durum: Pt100, 100 °C → 138,5 Ω", () => {
    const r = runCalc(pt100Termokupl, defaultState(pt100Termokupl));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.R).toBeCloseTo(138.5055, 9);
    expect(r.outputs.find((o) => o.key === "R")).toMatchObject({ unit: "ohm", formatted: "138,5 Ω" });
  });

  it("varsayılan dışı birimler: 212 °F → 138,5055 Ω; 373,15 K → 138,5055 Ω; 0,1385055 kΩ → 100 °C (K cinsinden 373,15)", () => {
    for (const [value, unit] of [["212", "degF"], ["373,15", "K"]]) {
      const r = runCalc(pt100Termokupl, state("rtd-tr", { T: [value, unit] }));
      if (!r.ok) throw new Error(JSON.stringify(r));
      expect(r.result.outputs.R, unit).toBeCloseTo(138.5055, 9);
    }
    const rt = runCalc(pt100Termokupl, state("rtd-rt", { R: ["0,1385055", "kohm"] }), { outputUnits: { T: "K" } });
    if (!rt.ok) throw new Error(JSON.stringify(rt));
    expect(rt.outputs.find((o) => o.key === "T")).toMatchObject({ unit: "K", value: expect.closeTo(373.15, 9) });
  });

  it("termokupl µV ve °F girişi: 3096 µV, soğuk uç 77 °F (25 °C) → 100 °C ±0,05", () => {
    const r = runCalc(pt100Termokupl, state("tc-et", { E: ["3096", "uV"], Ts: ["77", "degF"] }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(Math.abs(r.result.outputs.T - K0 - 100)).toBeLessThanOrEqual(0.05);
    expect(r.outputs.find((o) => o.key === "T")).toMatchObject({ unit: "degC" });
    expect(r.outputs.find((o) => o.key === "E_sicak")).toMatchObject({ unit: "mV" });
  });

  it("aralık dışı sıcaklık reddedilir", () => {
    const r = runCalc(pt100Termokupl, state("rtd-tr", { T: ["900", "degC"] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].message).toMatch(/−200…850 °C/);
  });
});

describe("tanım", () => {
  it("her mod yalnızca kendi girdilerini gösterir", () => {
    const expected: Record<SensorMod, string[]> = {
      "rtd-tr": ["r0Secim", "T"],
      "rtd-rt": ["r0Secim", "R"],
      "tc-te": ["tcTip", "T", "Ts"],
      "tc-et": ["tcTip", "E", "Ts"],
    };
    for (const [mod, keys] of Object.entries(expected) as [SensorMod, string[]][]) {
      const visible = visibleInputs(pt100Termokupl, state(mod))
        .map((i) => i.key)
        .filter((k) => k !== "mod");
      expect(visible.sort(), mod).toEqual([...keys].sort());
    }
    const ozel = visibleInputs(pt100Termokupl, { ...state("rtd-tr"), r0Secim: { value: "ozel" } }).map((i) => i.key);
    expect(ozel).toContain("R0");
    const tcOzel = visibleInputs(pt100Termokupl, { ...state("tc-te"), r0Secim: { value: "ozel" } }).map((i) => i.key);
    expect(tcOzel).not.toContain("R0");
  });

  it("referanslar IEC 60751, IEC 60584-1 ve NIST'i içerir", () => {
    expect(pt100Termokupl.references.map((r) => r.standard)).toEqual([
      "IEC 60751",
      "IEC 60584-1",
      "NIST ITS-90 Thermocouple Database (SRD 60)",
    ]);
  });

  it("tüm modların adımları KaTeX strict'ten geçer", () => {
    const cases: Partial<ComputeInputs>[] = [
      { mod: "rtd-tr", T: K0 + 100 },
      { mod: "rtd-tr", T: K0 - 100 },
      { mod: "rtd-rt", R: 138.5055 },
      { mod: "rtd-rt", R: 60.25584 },
      { mod: "tc-te", T: K0 + 100, Ts: K0 + 25 },
      { mod: "tc-te", tcTip: "T", T: K0 - 100, Ts: K0 - 10 },
      { mod: "tc-et", E: 3.096e-3, Ts: K0 + 25 },
      { mod: "tc-et", E: -1e-3, Ts: K0 - 20 },
    ];
    for (const f of pt100Termokupl.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const c of cases) {
      const steps = compute(c).steps;
      expect(steps.length).toBeGreaterThan(1);
      for (const s of steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });
});
