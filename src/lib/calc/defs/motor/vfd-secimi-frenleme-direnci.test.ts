/**
 * 3.4 VFD seçimi ve frenleme direnci testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır:
 *   I_sürücü ≥ max(I_n, I_kısa/k), R_maks = U_dc²/P_fren, I = U_dc/R_maks,
 *   ΔE = ½J(ω₁² − ω₂²), T = J(ω₁ − ω₂)/t, P_tepe = T·ω₁·η_mek·η_el (doğrusal rampa).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { vfdSecimiFrenlemeDirenci as def } from "./vfd-secimi-frenleme-direnci";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;

const MECH = { hesap: "fren", kaynak: "mekanik", Udc: 750, ED: 0.2, J: 2, n1: 1500 * RPM, n2: 0, tFren: 5, etaMek: 1, etaEl: 1 };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("(a) sürücü akımı", () => {
  it("kısa süreli akım aşırı yük kapasitesi içinde: motor akımı belirleyici", () => {
    // Elle: 21/1,5 = 14 A < 14,5 A → 14,5 A
    const r = def.compute({ hesap: "surucu", In: 14.5, Ikisa: 21, kAsiri: 1.5 }, ctx);
    expect(r.outputs).toEqual({ IsurucuMin: 14.5 });
    expect(r.checks[0].message).toMatch(/nominal akımı belirleyici/);
  });

  it("kısa süreli akım belirleyici: 24 A / 1,5 = 16 A", () => {
    const r = def.compute({ hesap: "surucu", In: 14.5, Ikisa: 24, kAsiri: 1.5 }, ctx);
    expect(r.outputs.IsurucuMin).toBeCloseTo(16, 12);
    expect(r.checks[0].message).toMatch(/Kısa süreli akım belirleyici/);
  });
});

describe("(b) frenleme direnci, güç doğrudan", () => {
  it("750 V, 7,5 kW → R_maks 75 Ω, 10 A; ED %10 → 750 W sürekli", () => {
    // Elle: 750² / 7500 = 75 Ω; 750/75 = 10 A; 7500·0,10 = 750 W
    const r = def.compute({ hesap: "fren", kaynak: "dogrudan", Udc: 750, Pfren: 7500, ED: 0.1 }, ctx);
    expect(r.outputs.Rmaks).toBeCloseTo(75, 9);
    expect(r.outputs.IfrenTepe).toBeCloseTo(10, 9);
    expect(r.outputs.PfrenOrt).toBe(7500);
    expect(r.outputs.Psurekli).toBeCloseTo(750, 9);
    expect(r.outputs).not.toHaveProperty("dE");
    expect(r.checks.map((c) => c.level)).toEqual(["bilgi", "bilgi"]);
  });

  it("R_min > R_maks → uyarı; R_min ≤ R_maks → aralık bilgisi", () => {
    const base = { hesap: "fren", kaynak: "dogrudan", Udc: 750, Pfren: 7500, ED: 0.1 };
    const bad = def.compute({ ...base, Rmin: 80 }, ctx);
    expect(bad.checks.filter((c) => c.level === "uyari")).toHaveLength(1);
    expect(bad.checks.find((c) => c.level === "uyari")?.message).toMatch(/80 Ω.*75 Ω/);
    const ok = def.compute({ ...base, Rmin: 40 }, ctx);
    expect(ok.checks.every((c) => c.level === "ok" || c.level === "bilgi")).toBe(true);
    expect(ok.checks.some((c) => /40 Ω ile 75 Ω/.test(c.message))).toBe(true);
  });
});

describe("(c) frenleme gücü mekanikten", () => {
  it("J 2 kg·m², 1500 → 0 dev/dk, 5 s: ΔE 24,67 kJ, T 62,83 N·m, P 9,870 kW, R_maks 56,99 Ω", () => {
    // Elle: ω₁ = 157,080 rad/s; ΔE = ½·2·157,08² = 24 674 J; T = 2·157,08/5 = 62,832 N·m;
    // P = 62,832·157,08 = 9869,6 W; R = 750²/9869,6 = 56,993 Ω; ortalama = 24 674/5 = 4934,8 W; ED %20 → 986,96 W
    const r = def.compute(MECH, ctx);
    expect(r.outputs.dE).toBeCloseTo(24674.011, 3);
    expect(r.outputs.Tfren).toBeCloseTo(62.83185, 5);
    expect(r.outputs.PfrenTepe).toBeCloseTo(9869.604, 3);
    expect(r.outputs.Rmaks).toBeCloseTo(56.99317, 5);
    expect(r.outputs.PfrenOrt).toBeCloseTo(4934.802, 3);
    expect(r.outputs.Psurekli).toBeCloseTo(986.9604, 4);
    expect(r.outputs.Efren).toBeCloseTo(24674.011, 3);
  });

  it("verim < 1 frenleme gücünü düşürür, R_maks'ı büyütür (η_mek·η_el = 0,9 → 63,33 Ω)", () => {
    // Elle: P = 9869,6·0,9 = 8882,6 W; R = 750²/8882,6 = 63,326 Ω
    const r = def.compute({ ...MECH, etaMek: 1, etaEl: 0.9 }, ctx);
    expect(r.outputs.PfrenTepe).toBeCloseTo(8882.644, 3);
    expect(r.outputs.Rmaks).toBeCloseTo(63.32574, 5);
    expect(r.outputs.Efren).toBeCloseTo(22206.61, 2);
    // ΔE ve yavaşlatma torku mekaniktir, verimden etkilenmez
    expect(r.outputs.dE).toBeCloseTo(24674.011, 3);
    expect(r.outputs.Tfren).toBeCloseTo(62.83185, 5);
    expect(r.outputs.PfrenTepe).toBeLessThan(def.compute(MECH, ctx).outputs.PfrenTepe);
    expect(r.outputs.Rmaks).toBeGreaterThan(def.compute(MECH, ctx).outputs.Rmaks);
  });

  it("son devir ilk devirden küçük olmalı (yalnız mekanik modda)", () => {
    expect(def.validate?.({ ...MECH, n2: MECH.n1 }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.compute({ ...MECH, n2: 2000 * RPM }, ctx).outputs).toEqual({});
    expect(def.validate?.({ hesap: "fren", kaynak: "dogrudan", Udc: 750, Pfren: 7500, ED: 0.1 }, ctx)).toEqual([]);
    expect(def.validate?.({ hesap: "surucu", In: 14.5, Ikisa: 21, kAsiri: 1.5 }, ctx)).toEqual([]);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("mekanik: 5000 kg·cm², 3000 → 1000 dev/dk, 800 ms, 0,78 kV, η %95·%90, ED %25", () => {
    // Elle: J = 0,5 kg·m²; ω₁ = 314,159, ω₂ = 104,720 rad/s;
    // ΔE = ½·0,5·(314,159² − 104,720²) = 21 932,5 J; T = 0,5·209,44/0,8 = 130,900 N·m;
    // P = 130,9·314,159·0,855 = 35 160,5 W; R = 780²/35 160,5 = 17,3035 Ω;
    // E_fren = 21 932,5·0,855 = 18 752,2 J; ortalama = 18 752,2/0,8 = 23 440,3 W; ·0,25 = 5860,08 W
    const r = run(
      {
        hesap: { value: "fren" },
        kaynak: { value: "mekanik" },
        Udc: { value: "0,78", unit: "kV" },
        J: { value: "5000", unit: "kgcm2" },
        n1: { value: "3000", unit: "rpm" },
        n2: { value: "1000", unit: "rpm" },
        tFren: { value: "800", unit: "ms" },
        etaMek: { value: "95", unit: "percent" },
        etaEl: { value: "0,9", unit: "fraction" },
        ED: { value: "25", unit: "percent" },
      },
      { PfrenTepe: "W" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.dE).toBeCloseTo(21932.454, 3);
    expect(o.Tfren).toBeCloseTo(130.8997, 4);
    expect(o.PfrenTepe).toBeCloseTo(35160.466, 3);
    expect(o.Rmaks).toBeCloseTo(17.30353, 5);
    expect(o.Efren).toBeCloseTo(18752.248, 3);
    expect(o.PfrenOrt).toBeCloseTo(23440.31, 2);
    expect(o.Psurekli).toBeCloseTo(5860.078, 3);
    expect(r.outputs.find((x) => x.key === "PfrenTepe")).toMatchObject({ unit: "W" });
    expect(r.outputs.find((x) => x.key === "dE")).toMatchObject({ unit: "kJ", formatted: "21,93 kJ" });
  });

  it("doğrudan: 15 hp, 0,75 kV, R_min 30 Ω → R_maks 50,29 Ω", () => {
    // Elle: 15 hp = 11 185,5 W; R = 750²/11 185,5 = 50,2883 Ω; I = 750/50,2883 = 14,9140 A
    const r = run({
      hesap: { value: "fren" },
      Udc: { value: "0,75", unit: "kV" },
      Pfren: { value: "15", unit: "hp" },
      Rmin: { value: "30", unit: "ohm" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.Rmaks).toBeCloseTo(50.2883, 4);
    expect(r.result.outputs.IfrenTepe).toBeCloseTo(14.914, 4);
    expect(r.result.checks.every((c) => c.level === "ok" || c.level === "bilgi")).toBe(true);
  });

  it("sürücü: I_n 14,5 A, kısa süreli 0,024 kA → 16 A", () => {
    const r = run({ hesap: { value: "surucu" }, Ikisa: { value: "0,024", unit: "kA" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.IsurucuMin).toBeCloseTo(16, 12);
    expect(r.outputs.map((o) => o.key)).toEqual(["IsurucuMin"]);
  });

  it("R_min boş bırakılabilir (isteğe bağlı)", () => {
    const r = run({ hesap: { value: "fren" }, Rmin: { value: "", unit: "ohm" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.inputsSI).not.toHaveProperty("Rmin");
  });
});
