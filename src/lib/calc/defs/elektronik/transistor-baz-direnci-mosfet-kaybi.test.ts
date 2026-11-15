/**
 * 4.8 Transistör baz direnci, MOSFET kaybı — testler (gerçek birim sistemiyle).
 * Kaynaklar:
 * - Görev brifingi elle hesap vektörleri: I_rms 10 A, R_DS(on) 10 mΩ, k_T 1 → 1 W; 48 V, 10 A, t_r + t_f 40 ns, 100 kHz → 0,96 W;
 *   Q_g 50 nC, 10 V, 100 kHz → 0,05 W; BJT I_C 100 mA, β_min 100, ODF 2 → I_B 2 mA; 5 V, 0,7 V → R_B 2150 Ω.
 * - ROHM AEK59-D1-0065-2 Rev. 003, hesap örneği: 12 V, 3 A, t_r 4 ns, t_f 6 ns, 2 MHz → P_SW = 360 mW;
 *   I_O 3 A, R_ON-H 100 mΩ, V_O/V_IN = 5/12 → P_ON-H = 375 mW; Q_g 1 nC + 1 nC, 5 V, 2 MHz → 20 mW (tek MOSFET 10 mW).
 *   https://fscdn.rohm.com/en/products/databook/applinote/ic/power/switching_regulator/power_loss_appli-e.pdf
 * - Wolfspeed PRD-03043 Rev. 2, Denk. 3–4: E_sw,on 17,162 µJ, E_sw,off 4,7822 µJ, 100 kHz → 1,716 W + 0,478 W = 2,194 W.
 * - E serisi komşuları: IEC 60063 (Vishay 28372) — E24'te 2,0/2,2; E12'de 1,8/2,2; E96'da 215 standart değerdir.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState, RunResult } from "@/lib/calc/types";
import { transistorBazDirenciMosfetKaybi as def } from "./transistor-baz-direnci-mosfet-kaybi";

const ctx = defaultContext();

const BJT: ComputeInputs = { mod: "bjt", Vin: 5, VBE: 0.7, IC: 0.1, beta: 100, odf: 2, VCEsat: 0.2, seri: "E24" };
const MOS: ComputeInputs = {
  mod: "mosfet",
  Irms: 10,
  RDS: 0.01,
  kT: 1,
  yontem: "vi",
  VDS: 48,
  ID: 10,
  tr: 20e-9,
  tf: 20e-9,
  fs: 100e3,
  Qg: 50e-9,
  VGS: 10,
};

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

const run = (state: InputState, outputUnits?: Record<string, string>) =>
  runCalc(def, { ...defaultState(def), ...state }, { outputUnits });

describe("BJT baz direnci", () => {
  it("ZORUNLU: I_C 100 mA, β_min 100, ODF 2 → I_B 2 mA; 5 V, 0,7 V → R_B 2150 Ω", () => {
    // Elle: I_B = 2·0,1/100 = 2 mA; R_B = 4,3/0,002 = 2150 Ω
    const r = def.compute(BJT, ctx);
    expect(r.outputs.IB).toBeCloseTo(2e-3, 15);
    expect(r.outputs.RB).toBeCloseTo(2150, 9);
  });

  it("E24: güvenli yön alt komşu 2,0 kΩ → I_B,g 2,15 mA, ODF_g 2,15, β_F 46,51, P_RB 9,245 mW, P_T 21,505 mW", () => {
    // Elle: I_B,g = 4,3/2000 = 2,15 mA; ODF_g = 2,15e-3·100/0,1 = 2,15; β_F = 0,1/2,15e-3 = 46,5116
    // P_RB = 4,3²/2000 = 9,245 mW; P_C = 0,2·0,1 = 20 mW; P_BE = 0,7·2,15e-3 = 1,505 mW
    const r = def.compute(BJT, ctx);
    expect(r.outputs.RBstd).toBe(2000);
    expect(r.outputs.IBg).toBeCloseTo(2.15e-3, 15);
    expect(r.outputs.odfG).toBeCloseTo(2.15, 12);
    expect(r.outputs.betaF).toBeCloseTo(46.511628, 5);
    expect(r.outputs.PRB).toBeCloseTo(9.245e-3, 14);
    expect(r.outputs.PC).toBeCloseTo(0.02, 15);
    expect(r.outputs.PBE).toBeCloseTo(1.505e-3, 15);
    expect(r.outputs.PT).toBeCloseTo(21.505e-3, 14);
    // Güvenli yön: gerçekleşen baz akımı gerekenden az olamaz
    expect(r.outputs.IBg).toBeGreaterThanOrEqual(r.outputs.IB);
    expect(r.steps.some((s) => s.latex.includes("E24 alt komşu"))).toBe(true);
  });

  it("E96'da 2150 Ω standart değer: kendisi seçilir; E12'de alt komşu 1,8 kΩ", () => {
    const e96 = def.compute({ ...BJT, seri: "E96" }, ctx);
    expect(e96.outputs.RBstd).toBeCloseTo(2150, 9);
    expect(e96.outputs.IBg).toBeCloseTo(2e-3, 15);
    expect(e96.steps.some((s) => s.latex.includes("E96 serisinde standart değer"))).toBe(true);
    const e12 = def.compute({ ...BJT, seri: "E12" }, ctx);
    expect(e12.outputs.RBstd).toBe(1800);
    // Elle: 4,3/1800 = 2,388889 mA
    expect(e12.outputs.IBg).toBeCloseTo(2.388889e-3, 9);
  });

  it("V_CE(sat) koşulu notu zorlanmış kazancı yazar (seviye değil içerik)", () => {
    const r = def.compute(BJT, ctx);
    expect(r.checks.some((c) => c.message.includes("β_F = 46,51") && c.reference?.standard.includes("P2N2222A"))).toBe(true);
  });

  it("varsayılan dışı birimler (runCalc): 5000 mV, 700 mV, 0,1 A, 200 mV", () => {
    const r = ok(
      run({
        Vin: { value: "5000", unit: "mV" },
        VBE: { value: "700", unit: "mV" },
        IC: { value: "0,1", unit: "A" },
        VCEsat: { value: "200", unit: "mV" },
      }),
    );
    expect(r.result.outputs.RB).toBeCloseTo(2150, 9);
    expect(r.result.outputs.RBstd).toBe(2000);
    expect(r.outputs.find((o) => o.key === "RB")).toMatchObject({ unit: "kohm", formatted: "2,15 kΩ" });
    expect(r.outputs.find((o) => o.key === "IB")).toMatchObject({ unit: "mA" });
  });

  it("V_in ≤ V_BE(sat) → hata (hesap yapılmaz)", () => {
    const r = run({ Vin: { value: "0,7", unit: "V" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].level).toBe("hata");
  });
});

describe("MOSFET kayıpları", () => {
  it("ZORUNLU: iletim 1 W, anahtarlama 0,96 W, kapı 0,05 W", () => {
    // Elle: 10²·0,01·1 = 1 W; ½·48·10·40e-9·100e3 = 0,96 W; 50e-9·10·100e3 = 0,05 W
    const r = def.compute(MOS, ctx);
    expect(r.outputs.Pcond).toBeCloseTo(1, 12);
    expect(r.outputs.Esw).toBeCloseTo(9.6e-6, 15);
    expect(r.outputs.Psw).toBeCloseTo(0.96, 12);
    expect(r.outputs.Pgate).toBeCloseTo(0.05, 12);
    // MOSFET kaybı kapı sürmeyi içermez (SLUA618A: kapı gücü sürücüde harcanır); toplam ayrı
    expect(r.outputs.Pmos).toBeCloseTo(1.96, 12);
    expect(r.outputs.Ptop).toBeCloseTo(2.01, 12);
  });

  it("k_T sıcaklık düzeltmesi iletim kaybını ölçekler: k_T 1,5 → 1,5 W, R_DS(on),T 15 mΩ", () => {
    const r = def.compute({ ...MOS, kT: 1.5 }, ctx);
    expect(r.outputs.RDSsicak).toBeCloseTo(0.015, 15);
    expect(r.outputs.Pcond).toBeCloseTo(1.5, 12);
  });

  it("ROHM örneği: 12 V, 3 A, 4 + 6 ns, 2 MHz → 360 mW; I_rms² = 9·5/12, 100 mΩ → 375 mW; 1 nC, 5 V, 2 MHz → 10 mW", () => {
    const r = def.compute(
      { ...MOS, Irms: Math.sqrt((9 * 5) / 12), RDS: 0.1, VDS: 12, ID: 3, tr: 4e-9, tf: 6e-9, fs: 2e6, Qg: 1e-9, VGS: 5 },
      ctx,
    );
    expect(r.outputs.Psw).toBeCloseTo(0.36, 12);
    expect(r.outputs.Pcond).toBeCloseTo(0.375, 12);
    // ROHM iki MOSFET için 20 mW verir (Q_gH + Q_gL = 2 nC); tek MOSFET 10 mW
    expect(r.outputs.Pgate).toBeCloseTo(0.01, 12);
  });

  it("enerji yöntemi, Wolfspeed örneği: 17,162 µJ + 4,7822 µJ, 100 kHz → 2,194 W", () => {
    const r = def.compute({ ...MOS, yontem: "enerji", Eon: 17.162e-6, Eoff: 4.7822e-6 }, ctx);
    expect(r.outputs.Esw).toBeCloseTo(21.9442e-6, 15);
    expect(r.outputs.Psw).toBeCloseTo(2.19442, 9);
    expect(Number(r.outputs.Psw.toFixed(3))).toBe(2.194);
    expect(r.checks.some((c) => c.message.includes("E_on ve E_off"))).toBe(true);
  });

  it("kapı gücü notu MOSFET kaybına katılmadığını söyler", () => {
    const r = def.compute(MOS, ctx);
    expect(r.checks.some((c) => c.message.includes("Kapı sürme gücü MOSFET'te değil") && c.reference?.standard === "TI SLUA618A")).toBe(true);
  });

  it("varsayılan dışı birimler (runCalc): Ω, µs, µC, MHz, mJ", () => {
    const r = ok(
      run({
        mod: { value: "mosfet" },
        Irms: { value: "10000", unit: "mA" },
        RDS: { value: "0,01", unit: "ohm" },
        kT: { value: "1", unit: "unitless" },
        tr: { value: "0,02", unit: "us" },
        tf: { value: "0,02", unit: "us" },
        fs: { value: "0,1", unit: "MHz" },
        Qg: { value: "0,05", unit: "uC" },
      }),
    );
    expect(r.result.outputs.Pcond).toBeCloseTo(1, 12);
    expect(r.result.outputs.Psw).toBeCloseTo(0.96, 12);
    expect(r.result.outputs.Pgate).toBeCloseTo(0.05, 12);
    expect(r.outputs.find((o) => o.key === "Pgate")).toMatchObject({ unit: "mW", formatted: "50 mW" });
    expect(r.outputs.find((o) => o.key === "Esw")).toMatchObject({ unit: "uJ" });

    const e = ok(
      run({
        mod: { value: "mosfet" },
        yontem: { value: "enerji" },
        Eon: { value: "0,017162", unit: "mJ" },
        Eoff: { value: "0,0047822", unit: "mJ" },
      }),
    );
    expect(e.result.outputs.Psw).toBeCloseTo(2.19442, 9);
  });
});
