/**
 * 4.10 PCB yol genişliği testleri (gerçek birim sistemiyle).
 *
 * Kaynaktaki çözümlü değerler: NextPCB, "PCB Trace Width Calculator: IPC-2221 Guide", "Quick-Reference Table:
 * Trace Width vs. Current" (1 oz bakır, ΔT = 10 °C, 1 oz = 1,378 mil):
 *   https://www.nextpcb.com/blog/pcb-trace-width-calculator-ipc-2221-guide
 *   dış katman: 0,5 A → 4,5 mil; 1 A → 11,8; 2 A → 30,8; 3 A → 53,8; 5 A → 108,9; 10 A → 283,2 mil
 *   iç katman:  1 A → 30,8 mil; 2 A → 80,0; 3 A → 140,0; 5 A → 283,2; 10 A → 736,8 mil
 * DİKKAT: aynı sayfanın düz yazıdaki "Worked Example" adımı hatalıdır (3 A için kesiti 53,8 mil² yazıp yeniden
 * 1,378'e bölüyor); tablodaki 53,8 mil genişliktir. Elle: (3/(0,048·10^0,44))^(1/0,725) = 74,16 mil² → 53,82 mil.
 *
 * Elle hesaplar (k dış 0,048 / iç 0,024, b 0,44, c 0,725; 1 mil = 25,4 µm; 1 oz = 1,378 mil = 35,0012 µm):
 * - Varsayılan 2 A, dış, 10 °C, 1 oz: A = (2/(0,048·10^0,44))^(1/0,725) = 42,393 mil² = 0,027350 mm²,
 *   w = 42,393/1,378 = 30,764 mil = 0,78141 mm.
 *   L = 50 mm, T = 25 + 10 = 35 °C: ρ = 1,7241e-8·(1 + 0,00393·15) = 1,82574e-8 Ω·m (NBS Handbook 100),
 *   R = ρ·L/A = 33,377 mΩ, ΔV = 2·R = 66,754 mV, P = 4·R = 133,51 mW.
 * - 1 mm, dış, 10 °C, 1 oz: A = 1 mm · 35,0012 µm = 54,252 mil², I = 0,048·10^0,44·54,252^0,725 = 2,3916 A.
 * - 20 mil (thou), iç, 20 K, 2 oz: A = 20 · 2,756 = 55,12 mil², I = 0,024·20^0,44·55,12^0,725 = 1,6410 A.
 * - 500 mA, dış, 20 K, özel 70 µm: A = (0,5/(0,048·20^0,44))^(1/0,725) = 4,1131 mil², w = 37,909 µm = 1,4925 mil.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { MIL, pcbYolGenisligi as def } from "./pcb-yol-genisligi";

const ctx = defaultContext();
const OZ = 1.378 * MIL;
const C = (celsius: number) => celsius + 273.15;

const BASE: ComputeInputs = { mod: "genislik", katman: "dis", I: 2, dT: 10, bakir: "1", Ta: C(25) };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

function out(r: ReturnType<typeof run>, key: string) {
  if (!r.ok) throw new Error(JSON.stringify(r));
  const o = r.outputs.find((x) => x.key === key);
  if (!o) throw new Error(`çıktı yok: ${key}`);
  return o;
}

describe("akımdan genişlik", () => {
  it("varsayılan: 2 A, dış katman, 10 °C, 1 oz → 42,393 mil², 30,764 mil = 0,78141 mm", () => {
    const r = def.compute(BASE, ctx);
    expect(r.outputs.A / (MIL * MIL)).toBeCloseTo(42.393, 3);
    expect(r.outputs.A).toBeCloseTo(0.02735031e-6, 12);
    expect(r.outputs.w_gerekli / MIL).toBeCloseTo(30.764, 3);
    expect(r.outputs.w_gerekli).toBeCloseTo(0.78141e-3, 8);
    expect(r.outputs.t_cu).toBeCloseTo(35.0012e-6, 12);
    expect(r.outputs.I_izin).toBeUndefined();
  });

  it.each([
    [0.5, 4.5],
    [1, 11.8],
    [2, 30.8],
    [3, 53.8],
    [5, 108.9],
    [10, 283.2],
  ])("NextPCB tablosu, dış katman: %s A → %s mil", (I, mil) => {
    const r = def.compute({ ...BASE, I }, ctx);
    expect(Math.abs(r.outputs.w_gerekli / MIL - mil)).toBeLessThan(0.05);
  });

  it.each([
    [1, 30.8],
    [2, 80.0],
    [3, 140.0],
    [5, 283.2],
    [10, 736.8],
  ])("NextPCB tablosu, iç katman: %s A → %s mil", (I, mil) => {
    const r = def.compute({ ...BASE, katman: "ic", I }, ctx);
    expect(Math.abs(r.outputs.w_gerekli / MIL - mil)).toBeLessThan(0.05);
  });

  it("iç katman aynı akım için daha geniş yol ister (k yarı)", () => {
    const dis = def.compute(BASE, ctx).outputs.w_gerekli;
    const ic = def.compute({ ...BASE, katman: "ic" }, ctx).outputs.w_gerekli;
    // A ∝ k^(-1/c) → oran 2^(1/0,725) = 2,6018
    expect(ic / dis).toBeCloseTo(2 ** (1 / 0.725), 9);
  });

  it("bakır kalınlığı iki katına çıkınca genişlik yarıya iner (kesit aynı)", () => {
    const a = def.compute(BASE, ctx).outputs;
    const b = def.compute({ ...BASE, bakir: "2" }, ctx).outputs;
    expect(b.A).toBeCloseTo(a.A, 15);
    expect(b.w_gerekli).toBeCloseTo(a.w_gerekli / 2, 12);
    expect(b.t_cu).toBeCloseTo(2 * OZ, 15);
  });

  it("varsayılan dışı birimler (runCalc): 500 mA, 20 K, özel 70 µm → 37,909 µm = 1,4925 thou", () => {
    const r = run(
      { I: { value: "500", unit: "mA" }, dT: { value: "20", unit: "deltaK" }, bakir: { value: "ozel" }, t: { value: "0,07", unit: "mm" } },
      { w_gerekli: "thou" },
    );
    expect(out(r, "w_gerekli").value).toBeCloseTo(1.4925, 4);
    expect(out(r, "w_gerekli").unit).toBe("thou");
    if (!r.ok) throw new Error();
    expect(r.result.outputs.w_gerekli).toBeCloseTo(37.909e-6, 9);
    expect(r.result.outputs.A / (MIL * MIL)).toBeCloseTo(4.1131, 4);
  });
});

describe("genişlikten akım", () => {
  it("1 mm, dış, 10 °C, 1 oz → 54,252 mil², 2,3916 A", () => {
    const r = def.compute({ ...BASE, mod: "akim", w: 1e-3 }, ctx);
    expect(r.outputs.A / (MIL * MIL)).toBeCloseTo(54.252, 3);
    expect(r.outputs.I_izin).toBeCloseTo(2.3916, 4);
    expect(r.outputs.w_gerekli).toBeUndefined();
  });

  it("varsayılan dışı birimler (runCalc): 20 thou, iç katman, 20 K, 2 oz → 1,6410 A", () => {
    const r = run({
      mod: { value: "akim" },
      katman: { value: "ic" },
      w: { value: "20", unit: "thou" },
      dT: { value: "20", unit: "deltaK" },
      bakir: { value: "2" },
    });
    expect(out(r, "I_izin").value).toBeCloseTo(1.641, 3);
    expect(out(r, "I_izin").formatted).toBe("1,641 A");
  });

  it("ZORUNLU gidiş-dönüş: genişlik → akım → genişlik aynı değere döner (her katman, kalınlık, ΔT)", () => {
    for (const katman of ["dis", "ic"]) {
      for (const bakir of ["0.5", "1", "2", "3"]) {
        for (const dT of [5, 10, 45, 100]) {
          for (const w of [0.1e-3, 0.78e-3, 3e-3, 12e-3]) {
            const I = def.compute({ ...BASE, mod: "akim", katman, bakir, dT, w }, ctx).outputs.I_izin;
            const geri = def.compute({ ...BASE, mod: "genislik", katman, bakir, dT, I }, ctx).outputs.w_gerekli;
            expect(geri / w).toBeCloseTo(1, 12);
          }
        }
      }
    }
  });

  it("gidiş-dönüş: akım → genişlik → akım (kaynak tablosundaki 3 A)", () => {
    const w = def.compute({ ...BASE, I: 3 }, ctx).outputs.w_gerekli;
    const I = def.compute({ ...BASE, mod: "akim", w }, ctx).outputs.I_izin;
    expect(I).toBeCloseTo(3, 12);
  });
});

describe("yol direnci, gerilim düşümü, güç kaybı", () => {
  it("varsayılan 50 mm, 25 °C ortam: T = 35 °C, R = 33,377 mΩ, ΔV = 66,754 mV, P = 133,51 mW", () => {
    const r = def.compute({ ...BASE, L: 0.05 }, ctx);
    expect(r.outputs.T_yol).toBeCloseTo(C(35), 9);
    expect(r.outputs.R).toBeCloseTo(0.033377, 6);
    expect(r.outputs.dV).toBeCloseTo(0.066754, 6);
    expect(r.outputs.P).toBeCloseTo(0.13351, 5);
  });

  it("kart gösterimi: varsayılan durum mΩ, mV, mW ile", () => {
    const r = run({});
    expect(out(r, "R").formatted).toBe("33,38 mΩ");
    expect(out(r, "dV").formatted).toBe("66,75 mV");
    expect(out(r, "P").formatted).toBe("133,5 mW");
    expect(out(r, "w_gerekli").formatted).toBe("0,7814 mm");
  });

  it("uzunluk boşsa direnç çıktıları yok, bilgi notu var", () => {
    const r = run({ L: { value: "", unit: "mm" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.R).toBeUndefined();
    expect(r.result.outputs.P).toBeUndefined();
    expect(r.result.checks.some((c) => c.message.includes("yol uzunluğunu"))).toBe(true);
  });

  it("direnç uzunlukla doğru, ortam sıcaklığıyla α₂₀ oranında artar", () => {
    const a = def.compute({ ...BASE, L: 0.05 }, ctx).outputs.R;
    const b = def.compute({ ...BASE, L: 0.1 }, ctx).outputs.R;
    expect(b).toBeCloseTo(2 * a, 12);
    // T = 20 °C'de ρ = ρ₂₀: Ta = 10 °C, ΔT = 10 °C
    const r20 = def.compute({ ...BASE, L: 0.05, Ta: C(10) }, ctx).outputs;
    expect(r20.R).toBeCloseTo((1.7241e-8 * 0.05) / r20.A, 12);
  });
});

describe("geçerlilik aralığı (AdvancedPCB: ≤35 A, ≤0,4 inç, ΔT 10–100 °C, 0,5–3 oz)", () => {
  const uyarilar = (inputs: ComputeInputs) => def.compute(inputs, ctx).checks.filter((c) => c.level === "uyari");

  it("varsayılan aralık içinde: uyarı yok, IPC-2152 bilgi notu var", () => {
    const r = def.compute(BASE, ctx);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
    expect(r.checks.some((c) => c.message.includes("IPC-2152"))).toBe(true);
  });

  it("40 A ve 1 oz → akım ve genişlik uyarısı", () => {
    const u = uyarilar({ ...BASE, I: 40 });
    expect(u.some((c) => c.message.includes("35 A"))).toBe(true);
    expect(u.some((c) => c.message.includes("0,4 inç"))).toBe(true);
    expect(u.every((c) => c.reference?.standard.includes("AdvancedPCB"))).toBe(true);
  });

  it("ΔT 5 °C ve 120 °C → sıcaklık uyarısı; 10 ve 100 °C sınırda uyarı yok", () => {
    expect(uyarilar({ ...BASE, dT: 5 }).some((c) => c.message.includes("10–100 °C"))).toBe(true);
    expect(uyarilar({ ...BASE, dT: 120 }).some((c) => c.message.includes("10–100 °C"))).toBe(true);
    expect(uyarilar({ ...BASE, dT: 10 })).toEqual([]);
    expect(uyarilar({ ...BASE, dT: 100 })).toEqual([]);
  });

  it("özel kalınlık 12 µm ve 140 µm → kalınlık uyarısı; 0,5 ve 3 oz seçenekleri uyarısız", () => {
    expect(uyarilar({ ...BASE, bakir: "ozel", t: 12e-6 }).some((c) => c.message.includes("0,5–3 oz"))).toBe(true);
    expect(uyarilar({ ...BASE, bakir: "ozel", t: 140e-6 }).some((c) => c.message.includes("0,5–3 oz"))).toBe(true);
    expect(uyarilar({ ...BASE, bakir: "0.5", I: 0.5 })).toEqual([]);
    expect(uyarilar({ ...BASE, bakir: "3" })).toEqual([]);
  });
});

describe("seçenekler", () => {
  it("her mod × katman × bakır kombinasyonu hatasız sonuç verir", () => {
    for (const mod of ["genislik", "akim"]) {
      for (const katman of ["dis", "ic"]) {
        for (const bakir of ["0.5", "1", "2", "3", "ozel"]) {
          const r = run({ mod: { value: mod }, katman: { value: katman }, bakir: { value: bakir } });
          if (!r.ok) throw new Error(`${mod}/${katman}/${bakir}: ${JSON.stringify(r)}`);
          expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
        }
      }
    }
  });
});
