/**
 * 2.5 Kısa devre akımı testleri (gerçek birim sistemiyle).
 *
 * Kaynaklı örnek: Schneider Electric Cahier Technique n° 158, §3.5 Problem 1 (s. 28–29):
 *   20 kV, I″kQ = 10 kA (S″kQ = √3·20·10 = 346,41 MVA), c_Q = 1,1, R_Q/X_Q = 0,1; trafo 400 kVA, 410 V, u_k %4,
 *   P_krT 4,6 kW, K_T (c_maks = 1,05); kablo 2 × (3×185 Al), 4 m, 0,208 + j0,068 Ω/km; U_n = 400 V, c = 1,05.
 *   CT158 sonuçları: Z_Qt = 0,534 mΩ; Z_TLV = 16,81 mΩ, R_TLV = 4,83 mΩ, X_TLV = 16,10 mΩ; x_T = 0,03831; K_T = 0,975;
 *   Z_k = (5,18 + j16,37) mΩ; I″_k = 14,12 kA; R/X = 0,316 → κ = 1,4; i_p = 27,96 kA (κ = 1,4 yuvarlanmış ile).
 * Zorunlu elle hesap: yalnızca trafo, c = 1, R ihmal → I_k = I_n/u_k; 1000 kVA, 400 V, u_k %6:
 *   I_n = 10⁶/(√3·400) = 1443,38 A; Z_T = 0,06·400²/10⁶ = 9,6 mΩ; I_k = 400/(√3·0,0096) = 24 056 A.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { kisaDevreAkimi as def } from "./kisa-devre-akimi";

const ctx = defaultContext();

function run(state: InputState) {
  const r = runCalc(def, { ...defaultState(def), ...state });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

/** Zorunlu test girdileri: yalnızca trafo, c = 1, R_T ihmal, K_T yok */
const SADECE_TRAFO: InputState = {
  hesap: { value: "ozel" },
  cOzel: { value: "1" },
  Un: { value: "400", unit: "V" },
  SrT: { value: "1000", unit: "kVA" },
  UrT: { value: "400", unit: "V" },
  uk: { value: "6", unit: "percent" },
  PkrT: { value: "" },
  kT: { value: "uygulama" },
  sebeke: { value: "yok" },
  kablo: { value: "yok" },
};

describe("zorunlu test: yalnızca trafo, c = 1, R ihmal → I_k = I_n/u_k", () => {
  it("1000 kVA, 400 V, u_k %6 → I_n = 1443,4 A, I_k = 24,06 kA", () => {
    const o = run(SADECE_TRAFO).result.outputs;
    expect(o.IrT).toBeCloseTo(1443.3757, 3);
    expect(o.Ik3).toBeCloseTo(24056.261, 2);
    expect(o.Ik3).toBeCloseTo(o.IrT / 0.06, 6);
    expect(o.Zk).toBeCloseTo(0.0096, 12);
    expect(o.Rk).toBe(0);
    // R = 0 → κ = 1,02 + 0,98 = 2; i_p = 2·√2·I_k = 68 041 A
    expect(o.kappa).toBeCloseTo(2, 12);
    expect(o.ip).toBeCloseTo(2 * Math.SQRT2 * 24056.261, 1);
    // I″k2 = √3/2 · I″k3 = 20 833 A; S″k = √3·400·24 056 = 16,667 MVA (= S_rT/u_k)
    expect(o.Ik2).toBeCloseTo(20833.333, 2);
    expect(o.Sk).toBeCloseTo(1e6 / 0.06, 0);
    expect(o).not.toHaveProperty("KT");
    expect(o).not.toHaveProperty("Ik1");
  });

  it("faz-toprak: yalnızca Dyn trafo (Z₀T = Z_T) → I″k1 = I″k3", () => {
    const o = run({ ...SADECE_TRAFO, fazToprak: { value: "var" } }).result.outputs;
    expect(o.Ik1).toBeCloseTo(o.Ik3, 6);
  });
});

describe("CT158 Problem 1 (varsayılan girdiler bu örnektir)", () => {
  it("varsayılanlar: I″k = 14,12 kA, κ ≈ 1,40, i_p ≈ 27,96 kA", () => {
    const r = run({});
    const o = r.result.outputs;
    // Elle (CT158 adımları tam hassasiyetle): R_k = 5,1816 mΩ, X_k = 16,3663 mΩ, |Z_k| = 17,1670 mΩ
    expect(o.Rk * 1e3).toBeCloseTo(5.18, 2);
    expect(o.Xk * 1e3).toBeCloseTo(16.37, 2);
    expect(o.KT).toBeCloseTo(0.975, 3);
    expect(o.Ik3 / 1e3).toBeCloseTo(14.12, 1); // CT158: 14,12 kA (elle tam: 14,125 kA)
    expect(Math.abs(o.Ik3 - 14120)).toBeLessThan(10);
    // CT158: 5,18/16,37 = 0,316 (yuvarlanmış empedanslarla); elle tam hassasiyet 0,3166
    expect(Math.abs(o.RX - 0.316)).toBeLessThan(0.001);
    expect(o.kappa).toBeCloseTo(1.4, 2); // elle tam: 1,3991
    // CT158 κ = 1,4 ile 27,96 kA; tam κ ile 27,95 kA
    expect(Math.abs(o.ip - 27960)).toBeLessThan(25);
    expect(o.IrT).toBeCloseTo(400e3 / (Math.sqrt(3) * 410), 6); // 563,3 A
  });

  it("ara empedanslar CT158 ile aynı", () => {
    const r = def.compute(
      {
        hesap: "cmaks",
        tolerans: "6",
        Un: 400,
        SrT: 400e3,
        UrT: 410,
        uk: 0.04,
        PkrT: 4600,
        kT: "uygulama",
        sebeke: "var",
        SkQ: Math.sqrt(3) * 20e3 * 10e3,
        cQ: 1.1,
        RXQ: 0.1,
        kablo: "yok",
        fazToprak: "yok",
      },
      ctx,
    );
    // K_T yok, kablo yok: R_k = R_Q + R_T = 0,0531 + 4,8329 mΩ; X_k = 0,5311 + 16,1003 mΩ
    expect(r.outputs.Rk * 1e3).toBeCloseTo(0.05311 + 4.832875, 4);
    expect(r.outputs.Xk * 1e3).toBeCloseTo(0.53114 + 16.10029, 4);
  });
});

describe("gerilim katsayısı seçimi (config: CT158 Fig. 25)", () => {
  it("c_maks +%10 = 1,10; c_min = 0,95 — akım c ile orantılı", () => {
    const base = { ...SADECE_TRAFO, kT: { value: "uygulama" } };
    const i1 = run({ ...base, hesap: { value: "cmaks" }, tolerans: { value: "10" } }).result.outputs.Ik3;
    const i2 = run({ ...base, hesap: { value: "cmin" }, tolerans: { value: "10" } }).result.outputs.Ik3;
    expect(i1).toBeCloseTo(1.1 * 24056.261, 1);
    expect(i2).toBeCloseTo(0.95 * 24056.261, 1);
    expect(ctx.limits.tesisatGuc.gerilimKatsayisi.ag6.cMaks).toBe(1.05);
  });

  it("kesme kapasitesi mesajı yalnızca c_maks hesabında (c_min/özel c belirleyici değildir)", () => {
    const has = (hesap: string) =>
      run({ ...SADECE_TRAFO, hesap: { value: hesap } }).result.checks.some((c) => /kesme kapasitesi/.test(c.message));
    expect(has("cmaks")).toBe(true);
    expect(has("cmin")).toBe(false);
    expect(has("ozel")).toBe(false);
  });

  it("K_T c_maks'ı tolerans seçiminden alır, hesaplanan c'den değil", () => {
    // Yalnızca trafo, R = 0: x_T = u_k = 0,06; K_T = 0,95·1,10/(1 + 0,036) = 1,00869
    const r = run({ ...SADECE_TRAFO, kT: { value: "uygula" }, tolerans: { value: "10" } });
    expect(r.result.outputs.KT).toBeCloseTo((0.95 * 1.1) / 1.036, 9);
    expect(r.result.outputs.Ik3).toBeCloseTo(24056.261 / ((0.95 * 1.1) / 1.036), 1);
  });
});

describe("faz-toprak (basitleştirilmiş döngü)", () => {
  it("⅔·Z_Q + Z_T + Z_L + Z_PE", () => {
    // Elle: Z_Q = 1,1·400²/100 MVA = 1,76 mΩ; X_Q = 1,76/√1,01 = 1,75127 mΩ; R_Q = 0,175127 mΩ
    // Trafo 1000 kVA, 400 V, %6, P_k 10 kW: Z_T = 9,6 mΩ; R_T = 10⁴·400²/10¹² = 1,6 mΩ; X_T = √(9,6² − 1,6²) = 9,46573 mΩ
    // Kablo 50 m, 1 adet, 0,1 + j0,08 Ω/km: R_L = 5 mΩ, X_L = 4 mΩ; PE 0,2 + j0,08 Ω/km: R_PE = 10 mΩ, X_PE = 4 mΩ
    // R = ⅔·0,175127 + 1,6 + 5 + 10 = 16,71675 mΩ; X = ⅔·1,75127 + 9,46573 + 4 + 4 = 18,63324 mΩ; |Z| = 25,03294 mΩ
    // I″k1 = 1·400/(√3·0,02503294) = 9225,4 A
    const r = run({
      hesap: { value: "ozel" },
      cOzel: { value: "1" },
      Un: { value: "400", unit: "V" },
      SrT: { value: "1000", unit: "kVA" },
      UrT: { value: "400", unit: "V" },
      uk: { value: "6", unit: "percent" },
      PkrT: { value: "10", unit: "kW" },
      kT: { value: "uygulama" },
      sebeke: { value: "var" },
      SkQ: { value: "100", unit: "MVA" },
      cQ: { value: "1,1" },
      RXQ: { value: "0,1" },
      kablo: { value: "var" },
      Rkm: { value: "0,1", unit: "ohm_per_km" },
      Xkm: { value: "0,08", unit: "ohm_per_km" },
      L: { value: "50", unit: "m" },
      nParalel: { value: "1" },
      fazToprak: { value: "var" },
      RPEkm: { value: "0,2", unit: "ohm_per_km" },
      XPEkm: { value: "0,08", unit: "ohm_per_km" },
    });
    expect(r.result.outputs.Ik1).toBeCloseTo(9225.4, 0);
    expect(r.result.checks.some((c) => /Dyn bağlı trafo/.test(c.message))).toBe(true);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("0,4 kV, 1,6 MVA, u_k 0,06 (kesir), P_k 17 000 W, şebeke 500 000 kVA, kablo 0,02 km, mΩ/m", () => {
    // Elle: Z_T = 0,06·400²/1,6·10⁶ = 6 mΩ; R_T = 17 000·400²/(1,6·10⁶)² = 1,0625 mΩ; X_T = √(36 − 1,12891) = 5,90518 mΩ
    // Z_Q = 1,1·400²/500·10⁶ = 0,352 mΩ; X_Q = 0,352/√1,01 = 0,350255 mΩ; R_Q = 0,0350255 mΩ
    // Kablo 20 m, 2 adet, 0,05 mΩ/m = 0,05 Ω/km, X 0,08 Ω/km: R_L = 0,5 mΩ, X_L = 0,8 mΩ
    // R_k = 1,59753 mΩ; X_k = 7,05544 mΩ; |Z_k| = 7,23404 mΩ; c = 1,05 → I″k = 1,05·400/(√3·0,00723404) = 33 520 A
    const r = runCalc(
      def,
      {
        ...defaultState(def),
        hesap: { value: "cmaks" },
        tolerans: { value: "6" },
        kT: { value: "uygulama" },
        Un: { value: "0,4", unit: "kV" },
        SrT: { value: "1,6", unit: "MVA" },
        UrT: { value: "0,4", unit: "kV" },
        uk: { value: "0,06", unit: "fraction" },
        PkrT: { value: "17000", unit: "W" },
        SkQ: { value: "500000", unit: "kVA" },
        Rkm: { value: "0,05", unit: "mohm_per_m" },
        Xkm: { value: "0,08", unit: "ohm_per_km" },
        L: { value: "0,02", unit: "km" },
        nParalel: { value: "2" },
      },
      { outputUnits: { Ik3: "A" } },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.Rk * 1e3).toBeCloseTo(1.59753, 4);
    expect(r.result.outputs.Xk * 1e3).toBeCloseTo(7.05544, 4);
    expect(r.result.outputs.Ik3).toBeCloseTo(33520, -1);
    expect(r.outputs.find((o) => o.key === "Ik3")?.unit).toBe("A");
  });
});

describe("doğrulama", () => {
  it("P_krT/S_rT ≥ u_k → hata (X_T tanımsız)", () => {
    const r = runCalc(def, { ...defaultState(def), PkrT: { value: "16", unit: "kW" } }); // 16/400 = %4 = u_k
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].level).toBe("hata");
  });
});
