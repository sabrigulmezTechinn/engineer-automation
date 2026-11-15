/**
 * 3.3 Yol verme akımları testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır. Örnek motor: I_n = 14,5 A, k = 7, T_n = 49,4 N·m, k_T = 2,3
 * → I_D = 101,5 A, T_D = 113,62 N·m.
 * Yıldız-üçgen: sargı gerilimi U/√3 → akım ve tork 1/3. Ototrafo x: hat akımı ve tork x², motor akımı x.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { yolVermeAkimlari, type YolVermeYontemi } from "./yol-verme-akimlari";

const ctx = defaultContext();
const MOTOR = { In: 14.5, k: 7, Tn: 49.4, kT: 2.3 };
const compute = (yontem: YolVermeYontemi, extra: Record<string, number> = {}) =>
  yolVermeAkimlari.compute({ yontem, ...MOTOR, ...extra }, ctx);

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(yolVermeAkimlari, { ...defaultState(yolVermeAkimlari), ...state }, { outputUnits });
}

describe("SI hesap (elle hesap)", () => {
  it("doğrudan: 101,5 A, 113,62 N·m, oranlar %100", () => {
    const r = compute("direkt");
    expect(r.outputs.Ik).toBeCloseTo(101.5, 9);
    expect(r.outputs.IkOran).toBeCloseTo(7, 12);
    expect(r.outputs.Tk).toBeCloseTo(113.62, 9);
    expect(r.outputs.TkOran).toBeCloseTo(2.3, 12);
    expect(r.outputs.akimOrani).toBe(1);
    expect(r.outputs.torkOrani).toBe(1);
    expect(r.outputs).not.toHaveProperty("Imotor");
  });

  it("yıldız-üçgen: 33,83 A, 37,87 N·m, oranlar 1/3", () => {
    const r = compute("yildiz-ucgen");
    expect(r.outputs.Ik).toBeCloseTo(33.8333, 4);
    expect(r.outputs.Tk).toBeCloseTo(37.8733, 4);
    expect(r.outputs.IkOran).toBeCloseTo(7 / 3, 12);
    expect(r.outputs.akimOrani).toBeCloseTo(1 / 3, 12);
    expect(r.outputs.torkOrani).toBeCloseTo(1 / 3, 12);
    expect(r.checks).toEqual([expect.objectContaining({ level: "ok", message: expect.stringMatching(/üçgen bağlı/) })]);
  });

  it("ototrafo %65: hat 42,88 A, motor 65,98 A, tork 48,00 N·m (x² = 0,4225)", () => {
    const r = compute("ototrafo", { x: 0.65 });
    expect(r.outputs.Ik).toBeCloseTo(42.88375, 6);
    expect(r.outputs.Imotor).toBeCloseTo(65.975, 6);
    expect(r.outputs.Tk).toBeCloseTo(48.00445, 6);
    expect(r.outputs.akimOrani).toBeCloseTo(0.4225, 12);
    expect(r.outputs.torkOrani).toBeCloseTo(0.4225, 12);
  });

  it("yumuşak yolverici 3,5·I_n: 50,75 A, tork (3,5/7)²·T_D = 28,405 N·m", () => {
    const r = compute("yumusak", { ks: 3.5 });
    expect(r.outputs.Ik).toBeCloseTo(50.75, 9);
    expect(r.outputs.akimOrani).toBeCloseTo(0.5, 12);
    expect(r.outputs.torkOrani).toBeCloseTo(0.25, 12);
    expect(r.outputs.Tk).toBeCloseTo(28.405, 9);
    expect(r.checks[0].message).toMatch(/yaklaşık/);
  });

  it("yumuşak yolvericide akım sınırı k'dan büyükse 'hata'", () => {
    const checks = yolVermeAkimlari.validate?.({ yontem: "yumusak", ...MOTOR, ks: 8 }, ctx) ?? [];
    expect(checks).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(compute("yumusak", { ks: 8 }).outputs).toEqual({});
    // Sınır k'ya eşitse doğrudan yol verme ile aynı
    const eq = compute("yumusak", { ks: 7 });
    expect(eq.outputs.akimOrani).toBeCloseTo(1, 12);
    // Diğer yöntemlerde ks yok sayılır
    expect(yolVermeAkimlari.validate?.({ yontem: "direkt", ...MOTOR }, ctx)).toEqual([]);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("yıldız-üçgen: I_n 850 mA, T_n 0,5 kgf·m, k 6, k_T 2 → 1,7 A; 0,3333 kgf·m", () => {
    // Elle: I = 0,85·6/3 = 1,7 A; T = 0,5·2/3 kgf·m = 0,33333 kgf·m = 3,26888 N·m
    const r = run(
      {
        yontem: { value: "yildiz-ucgen" },
        In: { value: "850", unit: "mA" },
        k: { value: "6", unit: "unitless" },
        Tn: { value: "0,5", unit: "kgfm" },
        kT: { value: "2", unit: "unitless" },
      },
      { Tk: "kgfm" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.Ik).toBeCloseTo(1.7, 12);
    expect(r.result.outputs.Tk).toBeCloseTo(3.268883, 6);
    expect(r.outputs.find((o) => o.key === "Tk")?.value).toBeCloseTo(1 / 3, 9);
    expect(r.outputs.find((o) => o.key === "akimOrani")).toMatchObject({ unit: "percent", formatted: "%33,33" });
  });

  it("ototrafo kademesi kesir olarak da girilebilir; %100'ü aşamaz", () => {
    const r = run({ yontem: { value: "ototrafo" }, x: { value: "0,8", unit: "fraction" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.akimOrani).toBeCloseTo(0.64, 12);
    const bad = run({ yontem: { value: "ototrafo" }, x: { value: "110", unit: "percent" } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fieldErrors)).toEqual(["x"]);
  });

  it("akım sınırı k'yı aşarsa runCalc reddeder", () => {
    const r = run({ yontem: { value: "yumusak" }, ks: { value: "9", unit: "unitless" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].level).toBe("hata");
  });
});
