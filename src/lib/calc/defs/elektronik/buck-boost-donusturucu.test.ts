/**
 * 4.9 Buck / boost dönüştürücü — testler (gerçek birim sistemiyle). Beklenen değerler elle hesaptır; formüller:
 * - Buck: TI SLVA477C Denk. 1 D = V_o/(V_in,maks·η), Denk. 2 ΔI_L = (V_in,maks − V_o)·D/(f_s·L), Denk. 4 I_SW = ΔI_L/2 + I_o,
 *   Denk. 5 L = V_o·(V_in − V_o)/(ΔI_L·f_s·V_in) (tipik V_in), Denk. 6 ΔI_L = r·I_o, Denk. 12 C = ΔI_L/(8·f_s·ΔV_o).
 *   https://www.ti.com/lit/an/slva477c/slva477c.pdf
 * - Boost: TI SLVA372D Denk. 1 D = 1 − V_in,min·η/V_o, Denk. 2 ΔI_L = V_in,min·D/(f_s·L), Denk. 3 I_MAXOUT,
 *   Denk. 4 I_SW = ΔI_L/2 + I_o/(1 − D), Denk. 5 L = V_in·(V_o − V_in)/(ΔI_L·f_s·V_o), Denk. 6 ΔI_L = r·I_o·V_o/V_in,
 *   Denk. 12 C = I_o·D/(f_s·ΔV_o).  https://www.ti.com/lit/an/slva372d/slva372d.pdf
 * Zorunlu vektörler görev brifinginden (η = 1). Buck 12→5 ile boost 5→12 aynı L formül değerini verir (simetri);
 * bu yüzden ikisi ayrıca simetrik olmayan vektörlerle ve η ≠ 1, V_in,min ≠ V_in,tip ≠ V_in,maks durumlarıyla sınanır.
 * Standart değerler E6/E12/E24 (IEC 60063, Vishay 28372): E6 … 6,8 – 10 – 15 – 22 …; E24 … 18 – 20 – 22 …
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState, RunResult } from "@/lib/calc/types";
import { buckBoostDonusturucu as def } from "./buck-boost-donusturucu";

const ctx = defaultContext();

const COMMON = { fs: 500e3, eta: 1, r: 0.3, dVo: 0.02, seri: "E6" };
const buck = (v: Partial<Record<string, number | string>>): ComputeInputs => ({
  mod: "buck",
  buckVinMin: 12,
  buckVin: 12,
  buckVinMaks: 12,
  buckVo: 5,
  Io: 2,
  ...COMMON,
  ...v,
}) as ComputeInputs;
const boost = (v: Partial<Record<string, number | string>>): ComputeInputs => ({
  mod: "boost",
  boostVinMin: 5,
  boostVin: 5,
  boostVinMaks: 5,
  boostVo: 12,
  Io: 1,
  ...COMMON,
  ...v,
}) as ComputeInputs;

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}
const run = (state: InputState) => runCalc(def, { ...defaultState(def), ...state });
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("buck", () => {
  it("ZORUNLU: 12→5 V, f_s 500 kHz, ΔI 0,6 A, η = 1 → L = 9,7222 µH", () => {
    // Elle: L = 5·(12 − 5)/(0,6·500e3·12) = 35/3,6e6 = 9,72222e-6 H (I_o 2 A, r %30 → ΔI 0,6 A)
    const r = def.compute(buck({}), ctx);
    expect(r.outputs.dIh).toBeCloseTo(0.6, 12);
    expect(r.outputs.L).toBeCloseTo(9.722222e-6, 11);
    expect(Number((r.outputs.L * 1e6).toFixed(4))).toBe(9.7222);
  });

  it("aynı vektörde standart L, gerçekleşen dalgalanma, tepe akım, C ve CCM sınırı", () => {
    // Elle (η = 1, tek V_in): D = 5/12 = 0,416667; L_std (E6 üst komşu) = 10 µH
    // ΔI_L = 7·(5/12)/(500e3·10e-6) = 2,916667/5 = 0,583333 A; I_SW = 0,291667 + 2 = 2,291667 A
    // C = 0,583333/(8·500e3·0,02) = 7,291667 µF → E6 10 µF; ΔV_o,g = 20 mV·7,291667/10 = 14,583333 mV; I_o,sınır = 0,291667 A
    const r = def.compute(buck({}), ctx);
    expect(r.outputs.Dvmaks).toBeCloseTo(5 / 12, 12);
    expect(r.outputs.Lstd).toBeCloseTo(10e-6, 15);
    expect(r.outputs.dIL).toBeCloseTo(0.583333, 6);
    expect(r.outputs.ISW).toBeCloseTo(2.291667, 6);
    expect(r.outputs.Cmin).toBeCloseTo(7.291667e-6, 11);
    expect(r.outputs.Cstd).toBeCloseTo(10e-6, 15);
    expect(r.outputs.dVoG).toBeCloseTo(14.583333e-3, 9);
    expect(r.outputs.IoSinir).toBeCloseTo(0.291667, 6);
    expect(r.outputs).not.toHaveProperty("ILmaks");
  });

  it("simetrik olmayan vektör: 24→3,3 V, 1 MHz, I_o 1,25 A, r %40 → L = 5,6925 µH", () => {
    // Elle: ΔI = 0,4·1,25 = 0,5 A; L = 3,3·(24 − 3,3)/(0,5·1e6·24) = 68,31/1,2e7 = 5,6925e-6 H → E6 6,8 µH
    const r = def.compute(buck({ buckVinMin: 24, buckVin: 24, buckVinMaks: 24, buckVo: 3.3, Io: 1.25, r: 0.4, fs: 1e6 }), ctx);
    expect(r.outputs.L).toBeCloseTo(5.6925e-6, 12);
    expect(r.outputs.Lstd).toBeCloseTo(6.8e-6, 15);
  });

  it("η = %90, V_in 10,8/12/13,2 V: D V_in,maks'ta; L tipik V_in'de η'sız; dalgalanma V_in,maks'ta", () => {
    // Elle: D(V_in,maks) = 5/(13,2·0,9) = 0,420875; D(V_in,min) = 5/(10,8·0,9) = 0,514403
    // L = 5·7/(0,3·500e3·12) = 19,4444 µH (η ve V_in,min/maks'tan bağımsız) → E6 22 µH
    // ΔI_L = (13,2 − 5)·0,420875/(500e3·22e-6) = 3,451178/11 = 0,313743 A; I_SW = 1,156872 A
    // C = 0,313743/80000 = 3,921794 µF → E6 4,7 µF; ΔV_o,g = ΔI_L/(8·f_s·C_std) = 0,3137435/18,8 = 16,688484 mV
    const r = def.compute(buck({ buckVinMin: 10.8, buckVinMaks: 13.2, Io: 1, eta: 0.9 }), ctx);
    expect(r.outputs.Dvmaks).toBeCloseTo(0.420875, 6);
    expect(r.outputs.Dvmin).toBeCloseTo(0.514403, 6);
    expect(r.outputs.L).toBeCloseTo(19.444444e-6, 11);
    expect(r.outputs.Lstd).toBeCloseTo(22e-6, 15);
    expect(r.outputs.dIL).toBeCloseTo(0.313743, 6);
    expect(r.outputs.ISW).toBeCloseTo(1.156872, 6);
    expect(r.outputs.Cmin).toBeCloseTo(3.921794e-6, 11);
    expect(r.outputs.Cstd).toBeCloseTo(4.7e-6, 15);
    expect(r.outputs.dVoG).toBeCloseTo(16.688484e-3, 8);
    expect(r.outputs.IoSinir).toBeCloseTo(0.156872, 6);
  });

  it("seri seçimi: L 19,444 µH → E24'te 20 µH", () => {
    const r = def.compute(buck({ buckVinMin: 10.8, buckVinMaks: 13.2, Io: 1, eta: 0.9, seri: "E24" }), ctx);
    expect(r.outputs.Lstd).toBeCloseTo(20e-6, 15);
  });

  it("akım sınırı: I_LIM 5 A → I_MAXOUT = 5 − ΔI_L/2 = 4,843128 A, istenen akımı karşılar (ok)", () => {
    const r = def.compute(buck({ buckVinMin: 10.8, buckVinMaks: 13.2, Io: 1, eta: 0.9, ILIM: 5 }), ctx);
    expect(r.outputs.Imaxout).toBeCloseTo(5 - 0.313743 / 2, 6);
    const c = r.checks.find((x) => x.message.includes("verebileceği en büyük çıkış akımı"));
    expect(c?.level).toBe("ok");
  });

  it("tam yükte DCM → uyarı; dalgalanma oranı %200 öneri dışında → uyarı", () => {
    // Elle: r = 2 → ΔI_h = 2 A; L = 35/(2·500e3·12) = 2,916667 µH → E6 3,3 µH
    // V_in,maks = 24 V: D = 5/24; ΔI_L = 19·(5/24)/(500e3·3,3e-6) = 3,958333/1,65 = 2,398990 A; I_o,sınır = 1,199495 A > I_o = 1 A
    const r = def.compute(buck({ buckVinMaks: 24, Io: 1, r: 2 }), ctx);
    expect(r.outputs.IoSinir).toBeCloseTo(1.199495, 6);
    expect(r.checks.some((c) => c.level === "uyari" && c.message.includes("DCM'de çalışır"))).toBe(true);
    expect(r.checks.some((c) => c.level === "uyari" && c.message.includes("Dalgalanma oranı"))).toBe(true);
  });

  it("dalgalanma oranı %20–%40 içindeyse öneri uyarısı yok", () => {
    const r = def.compute(buck({}), ctx);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
  });

  it("doğrulama: verimle D(V_in,min) ≥ 1 → hata; V_in sırası bozuk → hata", () => {
    const d = run({ buckVinMin: { value: "5,2", unit: "V" } });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.checks.some((c) => c.level === "hata" && c.message.includes("regüle edemez"))).toBe(true);
    const o = run({ buckVinMin: { value: "12,5", unit: "V" } });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.checks.some((c) => c.message.includes("sırasında"))).toBe(true);
  });
});

describe("boost", () => {
  it("ZORUNLU: 5→12 V, I_o 1 A, r %30, η = 1 → I_L 2,4 A, ΔI 0,72 A, L 8,1019 µH (I_o tabanlı 19,44 µH değil)", () => {
    // Elle: D = 1 − 5/12; I_L = I_o/(1 − D) = 12/5 = 2,4 A; ΔI = 0,3·2,4 = 0,72 A
    // L = 5·(12 − 5)/(0,72·500e3·12) = 35/4,32e6 = 8,101852e-6 H; I_o tabanlı: 35/(0,3·500e3·12) = 19,444 µH
    const r = def.compute(boost({}), ctx);
    expect(r.outputs.IL).toBeCloseTo(2.4, 12);
    expect(r.outputs.dIh).toBeCloseTo(0.72, 12);
    expect(r.outputs.L).toBeCloseTo(8.101852e-6, 11);
    expect(Number((r.outputs.L * 1e6).toFixed(4))).toBe(8.1019);
    expect(rel(r.outputs.L, 19.444e-6)).toBeGreaterThan(0.5);
  });

  it("aynı vektörde tepe akım, C ve CCM sınırı", () => {
    // Elle: D = 7/12 = 0,583333; L_std = 10 µH; ΔI_L = 5·0,583333/(500e3·10e-6) = 0,583333 A
    // I_L,maks = 1/(5/12) = 2,4 A; I_SW = 0,291667 + 2,4 = 2,691667 A
    // C = 1·0,583333/(500e3·0,02) = 58,3333 µF → E6 68 µF; ΔV_o,g = 20 mV·58,3333/68 = 17,156863 mV
    // I_o,sınır = (5/12)·0,583333/2 = 0,121528 A
    const r = def.compute(boost({}), ctx);
    expect(r.outputs.Dvmin).toBeCloseTo(7 / 12, 12);
    expect(r.outputs.Lstd).toBeCloseTo(10e-6, 15);
    expect(r.outputs.dIL).toBeCloseTo(0.583333, 6);
    expect(r.outputs.ILmaks).toBeCloseTo(2.4, 12);
    expect(r.outputs.ISW).toBeCloseTo(2.691667, 6);
    expect(r.outputs.Cmin).toBeCloseTo(58.333333e-6, 10);
    expect(r.outputs.Cstd).toBeCloseTo(68e-6, 15);
    expect(r.outputs.dVoG).toBeCloseTo(17.156863e-3, 9);
    expect(r.outputs.IoSinir).toBeCloseTo(0.121528, 6);
  });

  it("simetrik olmayan vektör: 3,6→5 V, I_o 0,5 A, r %40, 1,2 MHz → I_L 0,694444 A, L = 3,024 µH", () => {
    // Elle: I_L = 0,5·5/3,6 = 0,694444 A; ΔI = 0,277778 A; L = 3,6·1,4/(0,277778·1,2e6·5) = 5,04/1,666667e6 = 3,024e-6 H
    const r = def.compute(boost({ boostVinMin: 3.6, boostVin: 3.6, boostVinMaks: 3.6, boostVo: 5, Io: 0.5, r: 0.4, fs: 1.2e6 }), ctx);
    expect(r.outputs.IL).toBeCloseTo(0.694444, 6);
    expect(r.outputs.L).toBeCloseTo(3.024e-6, 12);
    expect(r.outputs.Lstd).toBeCloseTo(3.3e-6, 15);
  });

  it("η = %90, V_in 4,5/5/5,5 V: D ve tepe akım V_in,min'de; L ve dalgalanma tabanı tipik V_in'de η'sız (SLVA372D Denk. 6)", () => {
    // Elle: D(V_in,min) = 1 − 4,5·0,9/12 = 0,6625; D(V_in,maks) = 1 − 5,5·0,9/12 = 0,5875
    // I_L (taban) = 1·12/5 = 2,4 A (η'sız); L = 8,1019 µH → E6 10 µH (η = 1 durumuyla aynı)
    // ΔI_L = 4,5·0,6625/(500e3·10e-6) = 0,59625 A; I_L,maks = 1/0,3375 = 2,962963 A; I_SW = 0,298125 + 2,962963 = 3,261088 A
    // C = 0,6625/(500e3·0,02) = 66,25 µF → E6 68 µF
    // I_o,sınır: V = 4,5 → 0,3375·0,59625/2 = 0,100617; V = 5,5 → D 0,5875, ΔI 0,64625, 0,4125·0,64625/2 = 0,133289 (en büyük;
    //   tepe 2·12/(3·0,9) = 8,89 V aralık dışında)
    // I_LIM 3 A → I_MAXOUT = (3 − 0,298125)·0,3375 = 0,911883 A < 1 A → uyarı
    const r = def.compute(boost({ boostVinMin: 4.5, boostVinMaks: 5.5, eta: 0.9, ILIM: 3 }), ctx);
    expect(r.outputs.Dvmin).toBeCloseTo(0.6625, 12);
    expect(r.outputs.Dvmaks).toBeCloseTo(0.5875, 12);
    expect(r.outputs.IL).toBeCloseTo(2.4, 12);
    expect(r.outputs.L).toBeCloseTo(8.101852e-6, 11);
    expect(r.outputs.dIL).toBeCloseTo(0.59625, 9);
    expect(r.outputs.ILmaks).toBeCloseTo(2.962963, 6);
    expect(r.outputs.ISW).toBeCloseTo(3.261088, 6);
    expect(r.outputs.Cmin).toBeCloseTo(66.25e-6, 12);
    expect(r.outputs.Cstd).toBeCloseTo(68e-6, 15);
    expect(r.outputs.IoSinir).toBeCloseTo(0.133289, 6);
    expect(r.outputs.Imaxout).toBeCloseTo(0.911883, 6);
    expect(r.checks.some((c) => c.level === "uyari" && c.message.includes("en çok 911,9 mA"))).toBe(true);
  });

  it("CCM sınırı aralığın içindeki tepe noktasında: V_in 4–10 V, V_o 12 V, η = 1 → V_in = 8 V'ta", () => {
    // Elle: x = V_in/V_o; I_o,sınır ∝ x²(1 − x), tepe x = 2/3 → V_in = 8 V. L_std ile:
    // D = 1/3, ΔI_L(8 V) = 8·(1/3)/(f_s·L_std); I_o,sınır = (2/3)·ΔI_L/2
    const r = def.compute(boost({ boostVinMin: 4, boostVin: 6, boostVinMaks: 10 }), ctx);
    const Lstd = r.outputs.Lstd;
    const expected = ((2 / 3) * ((8 * (1 / 3)) / (500e3 * Lstd))) / 2;
    expect(r.outputs.IoSinir).toBeCloseTo(expected, 12);
    expect(r.steps.some((s) => s.latex.includes("V_{in} = 8\\,\\mathrm{V}"))).toBe(true);
  });

  it("doğrulama: V_o ≤ V_in,maks → hata", () => {
    const r = run({ mod: { value: "boost" }, boostVinMaks: { value: "12", unit: "V" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks.some((c) => c.level === "hata" && c.message.includes("gerilimi düşüremez"))).toBe(true);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan durum: buck 12 V → 5 V, L 19,444 µH → E6 22 µH, kartta µH", () => {
    const r = ok(run({}));
    expect(r.result.outputs.L).toBeCloseTo(19.444444e-6, 11);
    expect(r.outputs.find((o) => o.key === "L")).toMatchObject({ unit: "uH", formatted: "19,444 µH" });
    expect(r.outputs.find((o) => o.key === "Cstd")).toMatchObject({ unit: "uF" });
  });

  it("varsayılan dışı birimler: mV, mA, MHz, V (ΔV_o), kesir (η, r)", () => {
    const r = ok(
      run({
        mod: { value: "boost" },
        boostVinMin: { value: "5000", unit: "mV" },
        boostVin: { value: "5000", unit: "mV" },
        boostVinMaks: { value: "5000", unit: "mV" },
        boostVo: { value: "12", unit: "V" },
        Io: { value: "1000", unit: "mA" },
        fs: { value: "0,5", unit: "MHz" },
        eta: { value: "1", unit: "fraction" },
        r: { value: "0,3", unit: "fraction" },
        dVo: { value: "0,02", unit: "V" },
      }),
    );
    expect(r.result.outputs.L).toBeCloseTo(8.101852e-6, 11);
    expect(r.result.outputs.Cmin).toBeCloseTo(58.333333e-6, 10);
  });
});
