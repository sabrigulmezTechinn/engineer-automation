/**
 * 2.3 Sigorta / şalter seçimi testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır: I_b ≤ I_n ≤ I_z, I₂ = k₂·I_n ≤ 1,45·I_z (IEC 60364-4-43). Oranlar ve seriler
 * config'teki kaynaklı değerlerdir: MCB k₂ = 1,45 ve anlık açma B 3–5, C 5–10, D 10–20·I_n (Hager Tablo 2);
 * gG k₂ = 1,6 (I_n ≥ 16 A, Enel GSCL004 Tablo 6); kompakt k₂ = 1,3 (Schneider FA369327);
 * MCB serisi Lovato P1MB...P, gG serisi Legrand F00189EN/06.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { sigortaSalterSecimi as def } from "./sigorta-salter-secimi";

const ctx = defaultContext();

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("minyatür devre kesici (IEC 60898-1)", () => {
  it("I_b 45 A, I_z 51 A, C eğrisi → 50 A; I₂ 72,5 A ≤ 73,95 A; anlık açma 250–500 A", () => {
    // Elle: seride 45'ten büyük ilk değer 50 A; 50 ≤ 51; I₂ = 1,45·50 = 72,5 ≤ 1,45·51 = 73,95; C: 5·50 … 10·50
    const r = def.compute({ Ib: 45, Iz: 51, koruma: "mcb", egri: "C" }, ctx);
    expect(r.outputs.In).toBe(50);
    expect(r.outputs.I2).toBeCloseTo(72.5, 9);
    expect(r.outputs.I2sinir).toBeCloseTo(73.95, 9);
    expect(r.outputs.ImMin).toBeCloseTo(250, 9);
    expect(r.outputs.ImMax).toBeCloseTo(500, 9);
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("B ve D eğrilerinin anlık açma bölgesi (20 A: B 60–100 A, D 200–400 A)", () => {
    const b = def.compute({ Ib: 18, Iz: 24, koruma: "mcb", egri: "B" }, ctx);
    expect(b.outputs.In).toBe(20);
    expect([b.outputs.ImMin, b.outputs.ImMax]).toEqual([60, 100]);
    const d = def.compute({ Ib: 18, Iz: 24, koruma: "mcb", egri: "D" }, ctx);
    expect([d.outputs.ImMin, d.outputs.ImMax]).toEqual([200, 400]);
  });

  it("I_b 22 A, I_z 25 A → 25 A (MCB'de I₂ = 1,45·I_n olduğundan I₂ ≤ 1,45·I_z, I_n ≤ I_z ile aynı)", () => {
    const r = def.compute({ Ib: 22, Iz: 25, koruma: "mcb", egri: "C" }, ctx);
    expect(r.outputs.In).toBe(25);
    expect(r.outputs.I2).toBeCloseTo(36.25, 9);
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("seri yetmezse uyarı (I_b 70 A > 63 A)", () => {
    const r = def.compute({ Ib: 70, Iz: 90, koruma: "mcb", egri: "C" }, ctx);
    expect(r.outputs).not.toHaveProperty("In");
    expect(r.checks).toEqual([expect.objectContaining({ level: "uyari", message: expect.stringMatching(/en büyük değeri \(63 A\)/) })]);
  });

  it("kullanıcının seçtiği I_n denetlenir: 63 A > I_z 51 A → uyarı", () => {
    const r = def.compute({ Ib: 45, Iz: 51, koruma: "mcb", egri: "C", InSecim: 63 }, ctx);
    expect(r.outputs.In).toBe(63);
    expect(r.checks.filter((c) => c.level === "uyari").length).toBeGreaterThanOrEqual(1);
    expect(r.checks.some((c) => /kablonun akım taşıma kapasitesini aşıyor/.test(c.message))).toBe(true);
  });
});

describe("gG sigorta (IEC 60269)", () => {
  it("I_b 45 A, I_z 51 A: 50 A'da I₂ = 80 A > 73,95 A, 63 A > I_z → uygun değer yok", () => {
    const r = def.compute({ Ib: 45, Iz: 51, koruma: "gG" }, ctx);
    expect(r.outputs).not.toHaveProperty("In");
    expect(r.outputs.I2sinir).toBeCloseTo(73.95, 9);
    expect(r.checks).toEqual([expect.objectContaining({ level: "uyari", message: expect.stringMatching(/birlikte sağlayan anma akımı yok/) })]);
  });

  it("I_b 45 A, I_z 60 A → 50 A (I₂ = 1,6·50 = 80 A ≤ 1,45·60 = 87 A)", () => {
    const r = def.compute({ Ib: 45, Iz: 60, koruma: "gG" }, ctx);
    expect(r.outputs.In).toBe(50);
    expect(r.outputs.I2).toBeCloseTo(80, 9);
    expect(r.outputs.I2sinir).toBeCloseTo(87, 9);
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("I_b 22 A, I_z 25 A: MCB 25 A seçerken gG'de 25 A'nın I₂'si (40 A) 36,25 A'yı aşar → uygun değer yok", () => {
    const r = def.compute({ Ib: 22, Iz: 25, koruma: "gG" }, ctx);
    expect(r.outputs).not.toHaveProperty("In");
    // Seri yalnızca NH: kullanıcı başka gövdeye yönlendirilir
    expect(r.checks[0].message).toMatch(/NH bıçaklı/);
  });

  it("seride olmayan 20 A (ör. D tipi) denetlenebilir: I_b 18 A, I_z 24 A → I₂ = 32 A ≤ 34,8 A", () => {
    // Elle: I₂ = 1,6·20 = 32; 1,45·24 = 34,8; 18 ≤ 20 ≤ 24
    const r = def.compute({ Ib: 18, Iz: 24, koruma: "gG", InSecim: 20 }, ctx);
    expect(r.outputs.In).toBe(20);
    expect(r.outputs.I2).toBeCloseTo(32, 9);
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("I_n = 16 A sınırı 1,6 bandına dahil (Enel Tablo 6: 16 ≤ I_n)", () => {
    const r = def.compute({ Ib: 12, Iz: 20, koruma: "gG" }, ctx);
    // Elle: seride 12'den büyük ilk değer 16 A; I₂ = 1,6·16 = 25,6 ≤ 1,45·20 = 29
    expect(r.outputs.In).toBe(16);
    expect(r.outputs.I2).toBeCloseTo(25.6, 9);
  });

  it("I_n < 16 A, oran girilmemiş → I₂ denetlenemez uyarısı; oran 1,75 girilince I₂ = 17,5 A", () => {
    const a = def.compute({ Ib: 9, Iz: 14.5, koruma: "gG", InSecim: 10 }, ctx);
    expect(a.outputs.In).toBe(10);
    expect(a.outputs).not.toHaveProperty("I2");
    expect(a.checks.some((c) => c.level === "uyari" && /I₂ doğrulanamadı/.test(c.message))).toBe(true);

    // Elle: I₂ = 1,75·10 = 17,5 ≤ 1,45·14,5 = 21,025
    const b = def.compute({ Ib: 9, Iz: 14.5, koruma: "gG", InSecim: 10, k2: 1.75 }, ctx);
    expect(b.outputs.I2).toBeCloseTo(17.5, 9);
    expect(b.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });
});

describe("kompakt şalter (IEC 60947-2)", () => {
  it("I_b 180 A, I_z 200 A, I_r 190 A → I₂ 247 A ≤ 290 A; ayar aralığı 180–200 A", () => {
    // Elle: I₂ = 1,3·190 = 247; 1,45·200 = 290; I_r,maks = min(200, 290/1,3 = 223,08) = 200
    const r = def.compute({ Ib: 180, Iz: 200, koruma: "kompakt", Ir: 190 }, ctx);
    expect(r.outputs.I2).toBeCloseTo(247, 9);
    expect(r.outputs.I2sinir).toBeCloseTo(290, 9);
    expect(r.outputs.IrMin).toBe(180);
    expect(r.outputs.IrMax).toBe(200);
    expect(r.outputs).not.toHaveProperty("In");
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("I_b > I_z → ayar aralığı yok uyarısı", () => {
    const r = def.compute({ Ib: 210, Iz: 200, koruma: "kompakt", Ir: 205 }, ctx);
    expect(r.outputs).not.toHaveProperty("IrMin");
    expect(r.checks.some((c) => c.level === "uyari" && /Uygun ayar aralığı yok/.test(c.message))).toBe(true);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("sınır: I_b 0,021 kA, I_z 0,025 kA → I_n = I_z = 25 A seçilir", () => {
    // Elle: seride 21 A'dan büyük ilk değer 25 A = I_z; MCB'de I₂ = 1,45·25 = 1,45·I_z
    const r = run({ Ib: { value: "0,021", unit: "kA" }, Iz: { value: "0,025", unit: "kA" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.In).toBe(25);
    expect(r.result.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("sınır: denetlenen I_n 0,051 kA = I_z 51 A → koşul sağlanır", () => {
    const r = run({ Ib: { value: "45", unit: "A" }, Iz: { value: "51", unit: "A" }, InSecim: { value: "0,051", unit: "kA" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.In).toBeCloseTo(51, 9);
    expect(r.result.checks.filter((c) => c.level !== "ok")).toEqual([]);
  });

  it("kompakt: I_r 0,19 kA, I_b 180 A, I_z 0,2 kA; I₂ kA biriminde", () => {
    const r = run(
      {
        koruma: { value: "kompakt" },
        Ib: { value: "180", unit: "A" },
        Iz: { value: "0,2", unit: "kA" },
        Ir: { value: "0,19", unit: "kA" },
      },
      { I2: "kA" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.I2).toBeCloseTo(247, 9);
    expect(r.outputs.find((o) => o.key === "I2")).toMatchObject({ unit: "kA", formatted: "0,247 kA" });
  });
});
