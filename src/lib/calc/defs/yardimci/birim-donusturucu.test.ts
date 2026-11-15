/**
 * Birim dönüştürücü (7.1) testleri. Gerçek birim sistemiyle çalışır.
 *
 * AWG kaynağı: NBS Handbook 100 "Copper Wire Tables" (1966), §2.2 ve Tablo 10
 * (https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook100.pdf):
 * - No. 0000 = 0,4600 inç (11,684 mm), No. 36 = 0,0050 inç (0,127 mm); ardışık çap oranı 92^(1/39) = 1,122 932 2;
 *   altı numara arası çap oranı 2,0050.
 * - Tablo 10 kesitleri (mm²): 0000 → 107,2; 10 → 5,261; 13 → 2,63; 14 → 2,08; 15 → 1,65; 20 → 0,519.
 *   Tablo, 0,1 mil'e yuvarlanmış çaplardan hesaplandığı için formülle karşılaştırma %1 payla yapılır.
 * Doğrusal dönüşüm beklentileri tanım gereği tam değerlerden elle hesaplanmıştır (yorumlarda).
 */
import { describe, expect, it } from "vitest";
import { defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { InputState } from "@/lib/calc/types";
import { fromSI } from "@/lib/units";
import {
  AWG_MAX,
  AWG_MIN,
  awgArea,
  awgDiameter,
  awgFromArea,
  awgName,
  birimDonusturucu as def,
  LINEAR_QUANTITIES,
  nearestAwg,
} from "./birim-donusturucu";

function run(patch: InputState = {}) {
  const r = runCalc(def, { ...defaultState(def), ...patch });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

const mm = (m: number) => m * 1e3;
const mm2 = (m2: number) => m2 * 1e6;
const relErr = (a: number, b: number) => Math.abs(a - b) / b;

describe("AWG tanımı (NBS Handbook 100 §2.2)", () => {
  it("sabit noktalar: 36 → 0,127 mm; 4/0 (n = −3) → 11,684 mm", () => {
    expect(mm(awgDiameter(36))).toBeCloseTo(0.127, 12);
    expect(mm(awgDiameter(-3))).toBeCloseTo(11.684, 10);
  });

  it("ardışık çap oranı 92^(1/39) = 1,1229322; altı numara arası 2,0050", () => {
    for (const n of [-3, 0, 10, 25, 39]) {
      expect(awgDiameter(n) / awgDiameter(n + 1)).toBeCloseTo(1.1229322, 7);
    }
    expect(awgDiameter(4) / awgDiameter(10)).toBeCloseTo(2.005, 4);
  });

  it("Tablo 10 kesitleriyle %1 içinde uyumlu", () => {
    const table: [number, number][] = [
      [-3, 107.2],
      [10, 5.261],
      [13, 2.63],
      [14, 2.08],
      [15, 1.65],
      [20, 0.519],
    ];
    for (const [n, area] of table) expect(relErr(mm2(awgArea(n)), area), String(n)).toBeLessThan(0.01);
  });

  it("40 AWG çapı 3,1 mil'e yuvarlanır (Tablo 1, 0,1 mil çözünürlük)", () => {
    const mil = awgDiameter(40) / 0.0254 / 1e-3;
    expect(Math.abs(mil - 3.1)).toBeLessThanOrEqual(0.05);
  });

  it("adlar: −3 → 4/0, −2 → 3/0, 0 → 1/0, 14 → 14", () => {
    expect([awgName(-3), awgName(-2), awgName(-1), awgName(0), awgName(14)]).toEqual(["4/0", "3/0", "2/0", "1/0", "14"]);
  });

  it("awgFromArea, awgArea'nın tersidir", () => {
    for (let n = AWG_MIN; n <= AWG_MAX; n++) expect(awgFromArea(awgArea(n))).toBeCloseTo(n, 9);
  });

  it("en yakın AWG: 2,5 mm² → 13 (2,63 mm²); 1,5 mm² → 15 (1,65 mm²); aralık dışı sınırlanır", () => {
    // Tablo 10: 13 → 2,63, 14 → 2,08: 2,5 mm² 13'e daha yakın (hem doğrusal hem oran olarak)
    expect(nearestAwg(2.5e-6)).toMatchObject({ n: 13, clamped: null });
    // 15 → 1,65, 16 → 1,31
    expect(nearestAwg(1.5e-6)).toMatchObject({ n: 15, clamped: null });
    // 120 mm² 4/0'ın (107,2) yarım adım içinde; 150 mm² dışında
    expect(nearestAwg(120e-6)).toMatchObject({ n: -3, clamped: null });
    expect(nearestAwg(150e-6)).toMatchObject({ n: -3, clamped: "buyuk" });
    expect(nearestAwg(1e-10)).toMatchObject({ n: 40, clamped: "kucuk" });
  });
});

describe("doğrusal dönüşümler (runCalc)", () => {
  it("varsayılan: 1 kW → 1000 W; 1,341022 hp (1 hp = 550 lbf·ft/s = 745,69987 W)", () => {
    const r = run();
    expect(r.result.outputs.guc).toBe(1000);
    expect(fromSI(r.result.outputs.guc, "hp")).toBeCloseTo(1.341022, 6);
    expect(fromSI(r.result.outputs.guc, "PS")).toBeCloseTo(1000 / 735.49875, 9);
    expect(Object.keys(r.result.outputs)).toEqual(["guc"]);
  });

  it("sıcaklık: 20 °C → 293,15 K → 68 °F; −40 °C = −40 °F", () => {
    const a = run({ buyukluk: { value: "sicaklik" } });
    expect(a.result.outputs.sicaklik).toBeCloseTo(293.15, 10);
    expect(fromSI(a.result.outputs.sicaklik, "degF")).toBeCloseTo(68, 10);
    const b = run({ buyukluk: { value: "sicaklik" }, x_sicaklik: { value: "-40", unit: "degC" } });
    expect(fromSI(b.result.outputs.sicaklik, "degF")).toBeCloseTo(-40, 10);
  });

  it("mutlak sıfırın altı alan hatası verir; sıcaklık farkı negatif olabilir", () => {
    const r = runCalc(def, { ...defaultState(def), buyukluk: { value: "sicaklik" }, x_sicaklik: { value: "-300", unit: "degC" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(["x_sicaklik"]);
    const d = run({ buyukluk: { value: "sicaklik_farki" }, x_sicaklik_farki: { value: "-18", unit: "deltaDegF" } });
    expect(d.result.outputs.sicaklik_farki).toBeCloseTo(-10, 10); // 18 °F farkı = 10 K
  });

  it("basınç: 100 psi → 6,894757 bar (psi = lbf/in²)", () => {
    const r = run({ buyukluk: { value: "basinc" }, x_basinc: { value: "100", unit: "psi" } });
    expect(fromSI(r.result.outputs.basinc, "bar")).toBeCloseTo(6.894757, 6);
  });

  it("uzunluk: 1 inç = 25,4 mm; açısal hız: 1500 dev/dk = 50π rad/s", () => {
    const a = run({ buyukluk: { value: "uzunluk" }, x_uzunluk: { value: "1", unit: "in" } });
    expect(fromSI(a.result.outputs.uzunluk, "mm")).toBeCloseTo(25.4, 12);
    const b = run({ buyukluk: { value: "acisal_hiz" } });
    expect(b.result.outputs.acisal_hiz).toBeCloseTo(50 * Math.PI, 12);
  });

  it("tork: 10 N·m = 1,019716 kgf·m (kgf = 9,80665 N)", () => {
    const r = run({ buyukluk: { value: "tork" } });
    expect(fromSI(r.result.outputs.tork, "kgfm")).toBeCloseTo(10 / 9.80665, 12);
  });

  it("negatif uzunluk alan hatası verir", () => {
    const r = runCalc(def, { ...defaultState(def), buyukluk: { value: "uzunluk" }, x_uzunluk: { value: "-1", unit: "mm" } });
    expect(r.ok).toBe(false);
  });

  it("her doğrusal büyüklük varsayılanıyla çalışır ve yalnız kendi çıktısını verir", () => {
    for (const q of LINEAR_QUANTITIES) {
      const r = run({ buyukluk: { value: q.id } });
      expect(Object.keys(r.result.outputs), q.id).toEqual([q.id]);
    }
  });
});

describe("AWG (runCalc)", () => {
  it("AWG → mm²: 4/0 → 11,684 mm, 107,22 mm²", () => {
    const r = run({ buyukluk: { value: "awg" }, awg_yon: { value: "awg-mm2" }, awg_no: { value: "-3" } });
    expect(mm(r.result.outputs.awg_cap)).toBeCloseTo(11.684, 10);
    expect(relErr(mm2(r.result.outputs.awg_alan), 107.2)).toBeLessThan(0.001);
  });

  it("mm² → AWG, cm² ile (varsayılan dışı birim): 0,025 cm² = 2,5 mm² → 13 AWG; komşular 12 ve 14", () => {
    const r = run({ buyukluk: { value: "awg" }, awg_yon: { value: "mm2-awg" }, awg_kesit: { value: "0,025", unit: "cm2" } });
    const o = r.result.outputs;
    expect(o.awg_n).toBe(13);
    expect(o.awg_buyuk_n).toBe(12);
    expect(o.awg_kucuk_n).toBe(14);
    expect(relErr(mm2(o.awg_n_alan), 2.63)).toBeLessThan(0.01);
    expect(relErr(mm2(o.awg_kucuk_alan), 2.08)).toBeLessThan(0.01);
    expect(o.awg_sapma).toBeCloseTo((o.awg_n_alan - 2.5e-6) / 2.5e-6, 12);
    expect(o.awg_sapma).toBeGreaterThan(0.04); // (2,63 − 2,5)/2,5 ≈ %5
    expect(o.awg_sapma).toBeLessThan(0.06);
    const ok = r.result.checks.find((c) => c.level === "bilgi");
    expect(ok?.message).toContain("13 AWG");
  });

  it("4/0'dan büyük kesit: 4/0 gösterilir, uyarı verilir, 'bir büyük' çıktısı yoktur", () => {
    const r = run({ buyukluk: { value: "awg" }, awg_yon: { value: "mm2-awg" }, awg_kesit: { value: "150", unit: "mm2" } });
    expect(r.result.outputs.awg_n).toBe(-3);
    expect(r.result.outputs).not.toHaveProperty("awg_buyuk_n");
    expect(r.result.checks[0]).toMatchObject({ level: "uyari" });
    expect(r.result.checks[0].message).toMatch(/kcmil/);
  });

  it("formüller ve tüm modların adımları KaTeX strict'ten geçer", () => {
    for (const f of def.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    const cases: InputState[] = [
      ...LINEAR_QUANTITIES.map((q) => ({ buyukluk: { value: q.id } })),
      { buyukluk: { value: "awg" }, awg_yon: { value: "awg-mm2" }, awg_no: { value: "-3" } },
      { buyukluk: { value: "awg" }, awg_yon: { value: "awg-mm2" }, awg_no: { value: "40" } },
      { buyukluk: { value: "awg" }, awg_yon: { value: "mm2-awg" } },
      { buyukluk: { value: "awg" }, awg_yon: { value: "mm2-awg" }, awg_kesit: { value: "0,0001", unit: "mm2" } },
    ];
    for (const c of cases) {
      for (const s of run(c).result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });
});
