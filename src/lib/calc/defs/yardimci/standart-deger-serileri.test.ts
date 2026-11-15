/**
 * Standart değer serileri (7.2) testleri. Gerçek birim sistemiyle çalışır.
 *
 * Kaynaklar:
 * - Seri içerikleri: Vishay 28372 "Standard Series Values in a Decade … E3 to E192 according to IEC 60063"
 *   (https://www.vishay.com/docs/28372/e-series.pdf). E192'de "920" (9,20) basılıdır; 919 yoktur.
 * - Bağımsız kontrol: E48/E96/E192 değerleri 10^(i/n)'nin 3 anlamlı basamağa yuvarlanmasıdır; tek istisna
 *   E192'de i = 185 (hesap 9,19, resmi değer 9,20). E6–E24'te ise birçok resmi değer formülden farklıdır.
 * - Komşu değer ve sapma beklentileri elle hesaplanmıştır (yorumlarda).
 */
import { describe, expect, it } from "vitest";
import { defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { InputState } from "@/lib/calc/types";
import { E_SERIES, type ESeriesId } from "./e-serileri";
import { standardNeighbours, standartDegerSerileri as def } from "./standart-deger-serileri";

const scale = (id: ESeriesId) => (["E6", "E12", "E24"].includes(id) ? 10 : 100);
const asSet = (id: ESeriesId) => new Set(E_SERIES[id].map((m) => m / scale(id)));

describe("E serisi verisi (IEC 60063, Vishay 28372)", () => {
  it("eleman sayıları 6, 12, 24, 48, 96, 192", () => {
    expect(E_SERIES.E6).toHaveLength(6);
    expect(E_SERIES.E12).toHaveLength(12);
    expect(E_SERIES.E24).toHaveLength(24);
    expect(E_SERIES.E48).toHaveLength(48);
    expect(E_SERIES.E96).toHaveLength(96);
    expect(E_SERIES.E192).toHaveLength(192);
  });

  it("her seri 1,00'da başlar, kesin artan ve dekat içindedir", () => {
    for (const id of Object.keys(E_SERIES) as ESeriesId[]) {
      const v = E_SERIES[id];
      expect(v[0], id).toBe(scale(id));
      for (let i = 1; i < v.length; i++) expect(v[i], `${id}[${i}]`).toBeGreaterThan(v[i - 1]);
      expect(v[v.length - 1], id).toBeLessThan(10 * scale(id));
    }
  });

  it("alt kümeler: E6 ⊂ E12 ⊂ E24 ve E48 ⊂ E96 ⊂ E192", () => {
    const subset = (a: ESeriesId, b: ESeriesId) => [...asSet(a)].every((x) => asSet(b).has(x));
    expect(subset("E6", "E12")).toBe(true);
    expect(subset("E12", "E24")).toBe(true);
    expect(subset("E48", "E96")).toBe(true);
    expect(subset("E96", "E192")).toBe(true);
  });

  it("E24 tarihsel değerleri içerir: 2,7 / 3,0 / 3,3 / 4,3 / 5,1 / 9,1", () => {
    for (const v of [27, 30, 33, 43, 51, 91]) expect(E_SERIES.E24, String(v)).toContain(v);
    // 10^(i/24) yuvarlaması 2,6 / 2,9 / 3,2 / 4,2 verirdi; bunlar seride yoktur.
    for (const v of [26, 29, 32, 42]) expect(E_SERIES.E24).not.toContain(v);
  });

  it("E192'de 9,20 vardır, 9,19 yoktur (Vishay 28372)", () => {
    expect(E_SERIES.E192).toContain(920);
    expect(E_SERIES.E192).not.toContain(919);
  });

  it("E48 ve E96 10^(i/n) üç basamak yuvarlamasıdır; E192'de tek istisna i = 185", () => {
    const formula = (i: number, n: number) => Math.round(100 * 10 ** (i / n));
    for (const [id, n] of [["E48", 48], ["E96", 96]] as const) {
      E_SERIES[id].forEach((v, i) => expect(v, `${id}[${i}]`).toBe(formula(i, n)));
    }
    const diffs = E_SERIES.E192.map((v, i) => [i, v, formula(i, 192)]).filter(([, v, f]) => v !== f);
    expect(diffs).toEqual([[185, 920, 919]]);
  });
});

describe("standardNeighbours (elle hesap)", () => {
  it("dekat geçişi: 9,6 kΩ → E12'de alt 8,2 kΩ, üst ve en yakın 10 kΩ", () => {
    const r = standardNeighbours(9600, "E12");
    expect(r.lower).toBeCloseTo(8200, 9);
    expect(r.upper).toBeCloseTo(10000, 9);
    expect(r.nearest).toBeCloseTo(10000, 9);
  });

  it("alt dekada geçiş: 950 Ω → E12'de alt 820 Ω, üst 1 kΩ, en yakın 1 kΩ", () => {
    const r = standardNeighbours(950, "E12");
    expect(r.lower).toBeCloseTo(820, 9);
    expect(r.upper).toBeCloseTo(1000, 9);
    expect(r.nearest).toBeCloseTo(1000, 9);
  });

  it("standart değer kendisine eşlenir (kayan nokta artığına rağmen)", () => {
    for (const x of [4.7e3, 4700.000000000001, 4699.999999999999, 47e-12, 3.3e-6, 1e-3]) {
      const r = standardNeighbours(x, "E12");
      expect(r.lower, String(x)).toBeCloseTo(x, 12 - Math.floor(Math.log10(x)));
      expect(r.upper).toBe(r.lower);
      expect(r.nearest).toBe(r.lower);
    }
  });

  it("E24: 5,0 → alt 4,7, üst 5,1, en yakın 5,1", () => {
    const r = standardNeighbours(5.0, "E24");
    expect(r).toEqual({ lower: 4.7, upper: 5.1, nearest: 5.1 });
  });

  it("E96: 9,6 kΩ → alt 9,53 kΩ (en yakın), üst 9,76 kΩ", () => {
    const r = standardNeighbours(9600, "E96");
    expect(r.lower).toBeCloseTo(9530, 9);
    expect(r.upper).toBeCloseTo(9760, 9);
    expect(r.nearest).toBeCloseTo(9530, 9);
  });

  it("E192: 9,19 → alt 9,09, üst 9,20, en yakın 9,20; 9,2 standarttır", () => {
    expect(standardNeighbours(9.19, "E192")).toEqual({ lower: 9.09, upper: 9.2, nearest: 9.2 });
    expect(standardNeighbours(9.2, "E192")).toEqual({ lower: 9.2, upper: 9.2, nearest: 9.2 });
  });

  it("tam ortada eşitlikte üst değer seçilir: E6'da 1,25 → 1,5", () => {
    expect(standardNeighbours(1.25, "E6")).toEqual({ lower: 1, upper: 1.5, nearest: 1.5 });
  });

  it("dekadın sonu: E24'te 9,9 → alt 9,1, üst 10", () => {
    expect(standardNeighbours(9.9, "E24")).toEqual({ lower: 9.1, upper: 10, nearest: 10 });
  });

  it("geçersiz değerde fırlatır", () => {
    expect(() => standardNeighbours(0, "E12")).toThrow();
    expect(() => standardNeighbours(-1, "E12")).toThrow();
  });
});

describe("motor üzerinden (runCalc)", () => {
  const run = (patch: InputState) => {
    const r = runCalc(def, { ...defaultState(def), ...patch });
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r;
  };

  it("varsayılan: 9,6 kΩ E24 → en yakın 10 kΩ, alt 9,1 kΩ, sapma +%4,1667", () => {
    const r = run({});
    expect(r.result.outputs.R_yakin).toBeCloseTo(10000, 9);
    expect(r.result.outputs.R_alt).toBeCloseTo(9100, 9);
    expect(r.result.outputs.R_ust).toBeCloseTo(10000, 9);
    // (10 − 9,6) / 9,6 = 0,041667; (9,1 − 9,6) / 9,6 = −0,052083
    expect(r.result.outputs.sapma_yakin).toBeCloseTo(0.4 / 9.6, 12);
    expect(r.result.outputs.sapma_alt).toBeCloseTo(-0.5 / 9.6, 12);
    expect(r.outputs.find((o) => o.key === "R_yakin")?.formatted).toBe("10 kΩ");
    expect(r.outputs.find((o) => o.key === "sapma_yakin")?.formatted).toBe("%4,167");
    expect(Object.keys(r.result.outputs)).not.toContain("C_yakin");
  });

  it("Ω ile girilen direnç (varsayılan dışı birim): 9600 Ω, E12 → 10 kΩ", () => {
    const r = run({ R: { value: "9600", unit: "ohm" }, seri: { value: "E12" } });
    expect(r.result.outputs.R_yakin).toBeCloseTo(10000, 9);
    expect(r.result.outputs.R_alt).toBeCloseTo(8200, 9);
  });

  it("kondansatör µF ile: 3,3 µF E6'da standarttır; 85 nF E12 → 82 nF", () => {
    const a = run({ bilesen: { value: "kondansator" }, seri: { value: "E6" }, C: { value: "3,3", unit: "uF" } });
    expect(a.result.outputs.C_yakin).toBeCloseTo(3.3e-6, 18);
    expect(a.result.outputs.sapma_yakin).toBe(0);
    expect(a.result.checks).toEqual([expect.objectContaining({ level: "ok" })]);

    const b = run({ bilesen: { value: "kondansator" }, seri: { value: "E12" } });
    expect(b.result.outputs.C_yakin).toBeCloseTo(82e-9, 18);
    expect(b.result.outputs.C_ust).toBeCloseTo(100e-9, 18);
    expect(b.outputs.find((o) => o.key === "C_yakin")?.formatted).toBe("82 nF");
  });

  it("bobin µH ile: 4000 µH, E12 → alt 3,9 mH (en yakın), üst 4,7 mH", () => {
    const r = run({ bilesen: { value: "bobin" }, seri: { value: "E12" }, L: { value: "4000", unit: "uH" } });
    expect(r.result.outputs.L_yakin).toBeCloseTo(3.9e-3, 15);
    expect(r.result.outputs.L_ust).toBeCloseTo(4.7e-3, 15);
  });

  it("47 pF girişi (4,6999…e-11 olsa da) standart kabul edilir", () => {
    const r = run({ bilesen: { value: "kondansator" }, seri: { value: "E6" }, C: { value: "47", unit: "pF" } });
    expect(r.result.outputs.C_ust).toBe(r.result.outputs.C_alt);
    expect(r.result.outputs.sapma_ust).toBeCloseTo(0, 9);
  });

  it("sıfır ve negatif değer alan hatası verir", () => {
    for (const value of ["0", "-1"]) {
      const r = runCalc(def, { ...defaultState(def), R: { value, unit: "kohm" } });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(["R"]);
    }
  });

  it("formüller ve tüm seri/bileşen adımları KaTeX strict'ten geçer", () => {
    for (const f of def.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const seri of ["E6", "E12", "E24", "E48", "E96", "E192"]) {
      for (const bilesen of ["direnc", "kondansator", "bobin"]) {
        const r = run({ seri: { value: seri }, bilesen: { value: bilesen } });
        for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
      }
    }
  });
});
