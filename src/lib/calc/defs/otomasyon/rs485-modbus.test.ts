/**
 * RS485 / Modbus (5.7) testleri. Gerçek birim sistemiyle çalışır.
 *
 * Beklenen değerler elle hesaplanmıştır:
 * - Modbus over Serial Line V1.02 §2.5.1: RTU karakteri 11 bit (8E1, 8O1, 8N2); 8N1 10 bittir.
 * - §2.5.1.1: Bd ≤ 19200 için t1,5 = 1,5·t_c, t3,5 = 3,5·t_c; Bd > 19200 için 750 µs ve 1,750 ms.
 * - TI SLLA272D §9: L_kılavuz = min(1200 m, 10^7 / Bd).
 */
import { describe, expect, it } from "vitest";
import { defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { InputState } from "@/lib/calc/types";
import { guidelineLength, modbusTiming, rs485Modbus as def } from "./rs485-modbus";

function run(patch: InputState = {}) {
  const r = runCalc(def, { ...defaultState(def), ...patch });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

describe("zamanlayıcılar (Modbus §2.5.1.1)", () => {
  it("19200 Bd, 11 bit: t_c = 572,92 µs, t1,5 = 859,375 µs, t3,5 = 2005,2 µs (hesaplanır)", () => {
    const t = modbusTiming(19200, 11);
    expect(t.tChar).toBeCloseTo(11 / 19200, 15); // 5,7291667e-4 s
    expect(t.t15).toBeCloseTo(8.59375e-4, 15);
    expect(t.t35).toBeCloseTo(2.0052083e-3, 9);
    expect(t.fixed).toBe(false);
  });

  it("38400 Bd: t_c = 286,46 µs; t1,5 = 750 µs ve t3,5 = 1,75 ms sabit", () => {
    const t = modbusTiming(38400, 11);
    expect(t.tChar).toBeCloseTo(2.8645833e-4, 11);
    expect(t.t15).toBe(750e-6);
    expect(t.t35).toBe(1.75e-3);
    expect(t.fixed).toBe(true);
  });

  it("sınır: 19200 Bd hesaplanır, 19201 Bd sabit değer kullanır", () => {
    expect(modbusTiming(19200, 11).fixed).toBe(false);
    expect(modbusTiming(19201, 11).fixed).toBe(true);
  });

  it("9600 Bd: t_c = 1,1458 ms, t3,5 = 4,0104 ms", () => {
    const t = modbusTiming(9600, 11);
    expect(t.tChar).toBeCloseTo(1.1458333e-3, 9);
    expect(t.t35).toBeCloseTo(4.0104167e-3, 9);
  });
});

describe("kılavuz uzunluk (TI SLLA272D §9)", () => {
  it("min(1200 m, 10^7/Bd)", () => {
    expect(guidelineLength(1200)).toBe(1200); // 10^7/1200 = 8333 m > 1200 m
    expect(guidelineLength(9600)).toBeCloseTo(1041.6667, 3);
    expect(guidelineLength(19200)).toBeCloseTo(520.8333, 3);
    expect(guidelineLength(115200)).toBeCloseTo(86.8056, 3);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan: 19200 Bd 8E1, 8 + 25 bayt → çevrim 440/19200 s = 22,917 ms", () => {
    const r = run();
    const o = r.result.outputs;
    expect(o.t_c).toBeCloseTo(11 / 19200, 15);
    expect(o.T_istek).toBeCloseTo((8 * 11) / 19200, 15); // 4,5833 ms
    expect(o.T_yanit).toBeCloseTo((25 * 11) / 19200, 15); // 14,323 ms
    // (8 + 25 + 3,5 + 3,5) · 11 / 19200 = 440 / 19200
    expect(o.T_cevrim).toBeCloseTo(440 / 19200, 15);
    expect(o.f_cevrim).toBeCloseTo(19200 / 440, 9); // 43,636 Hz
    expect(o.L_kilavuz).toBeCloseTo(1e7 / 19200, 9);
    expect(r.outputs.find((x) => x.key === "t_c")?.formatted).toBe("572,9 µs");
    expect(r.outputs.find((x) => x.key === "T_cevrim")?.formatted).toBe("22,92 ms");
    // 300 m < 520,8 m → uygun; sonlandırma bilgisi her zaman
    const levels = r.result.checks.map((c) => c.level);
    expect(levels).toEqual(["ok", "ok"]);
    expect(r.result.checks[0].message).toMatch(/kılavuz sınırı/);
    expect(r.result.checks[1].message).toMatch(/150 Ω.*120 Ω/);
  });

  it("varsayılan dışı birimler: 19,2 kbit/s, işlem süresi 5 ms, kablo 1 km", () => {
    const r = run({
      baud: { value: "19,2", unit: "kbit_s" },
      t_islem: { value: "5", unit: "ms" },
      L: { value: "1", unit: "km" },
    });
    expect(r.result.outputs.t_c).toBeCloseTo(11 / 19200, 15);
    expect(r.result.outputs.T_cevrim).toBeCloseTo(440 / 19200 + 5e-3, 15); // 27,917 ms
    // 1000 m > 520,8 m → uyarı
    const warn = r.result.checks.find((c) => c.level === "uyari");
    expect(warn?.message).toMatch(/aşıyor/);
    expect(warn?.reference?.standard).toBe("TI SLLA272D");
  });

  it("kablo uzunluğu fit ile: 1000 ft = 304,8 m, 19200 Bd'de uygun", () => {
    const r = run({ L: { value: "1000", unit: "ft" } });
    expect(r.result.checks.some((c) => c.level === "uyari")).toBe(false);
  });

  it("38400 Bd: sabit zamanlayıcılar ve bilgi notu; çevrim = 33·t_c + 2·1,75 ms", () => {
    const r = run({ baud: { value: "38400", unit: "Bd" } });
    expect(r.result.outputs.t15).toBe(750e-6);
    expect(r.result.outputs.t35).toBe(1.75e-3);
    // 33 · 11/38400 + 3,5e-3 = 9,453125e-3 + 3,5e-3
    expect(r.result.outputs.T_cevrim).toBeCloseTo(12.953125e-3, 15);
    expect(r.result.checks.some((c) => c.message.includes("750 µs"))).toBe(true);
    // 300 m > 10^7/38400 = 260,4 m → uyarı
    expect(r.result.checks.some((c) => c.level === "uyari")).toBe(true);
  });

  it("8N1: 10 bit, standart dışı uyarısı (Modbus §2.5.1)", () => {
    const r = run({ baud: { value: "9600", unit: "Bd" }, cerceve: { value: "8N1" } });
    expect(r.result.outputs.t_c).toBeCloseTo(10 / 9600, 15);
    const warn = r.result.checks.find((c) => c.level === "uyari");
    expect(warn?.message).toMatch(/2 dur biti/);
    expect(warn?.reference?.clause).toBe("§2.5.1");
  });

  it("8O1 ve 8N2 de 11 bittir", () => {
    for (const cerceve of ["8O1", "8N2"]) {
      expect(run({ cerceve: { value: cerceve } }).result.outputs.t_c).toBeCloseTo(11 / 19200, 15);
    }
  });

  it("32'den fazla cihaz uyarı verir, 32 vermez (Modbus §3.4.1)", () => {
    expect(run({ n_cihaz: { value: "32", unit: "unitless" } }).result.checks.some((c) => c.level === "uyari")).toBe(false);
    const r = run({ n_cihaz: { value: "40", unit: "unitless" } });
    expect(r.result.checks.find((c) => c.level === "uyari")?.reference?.clause).toBe("§3.4.1");
  });

  it("kablo uzunluğu boşsa uzunluk kontrolü yapılmaz, kılavuz değer yine verilir", () => {
    const r = run({ L: { value: "", unit: "m" } });
    expect(r.result.checks.map((c) => c.level)).toEqual(["ok"]);
    expect(r.result.outputs.L_kilavuz).toBeCloseTo(520.8333, 3);
  });

  it("çerçeve uzunluğu 4–256 bayt ve tam sayı olmalı (Modbus §2.5.1)", () => {
    for (const value of ["3", "257", "8,5"]) {
      const r = runCalc(def, { ...defaultState(def), n_istek: { value, unit: "unitless" } });
      expect(r.ok, value).toBe(false);
      if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(["n_istek"]);
    }
    expect(run({ n_yanit: { value: "256", unit: "unitless" } }).result.outputs.T_yanit).toBeCloseTo((256 * 11) / 19200, 15);
  });

  it("baud sıfır olamaz", () => {
    const r = runCalc(def, { ...defaultState(def), baud: { value: "0", unit: "Bd" } });
    expect(r.ok).toBe(false);
  });

  it("formüller ve adımlar KaTeX strict'ten geçer", () => {
    for (const f of def.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const baud of ["1200", "9600", "19200", "38400", "115200"]) {
      for (const cerceve of ["8E1", "8N1"]) {
        const r = run({ baud: { value: baud, unit: "Bd" }, cerceve: { value: cerceve }, t_islem: { value: "2", unit: "ms" } });
        for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
      }
    }
  });
});
