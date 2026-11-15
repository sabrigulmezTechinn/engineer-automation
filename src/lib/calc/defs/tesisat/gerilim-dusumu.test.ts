/**
 * 2.2 Gerilim düşümü testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır:
 *   3 faz ΔU = √3·I·L·(R·cosφ + X·sinφ), %ΔU = ΔU/U; 1 faz ΔU = 2·I·L·(R·cosφ + X·sinφ), %ΔU = ΔU/U₀;
 *   R_θ = ρ₂₀(1 + α₂₀(θ − 20))/A, ρ₂₀ ve α₂₀ NBS Handbook 100 (Cu) ve 109 (Al).
 * Sınırlar: EİTY Md. 57 (a.3) %1,5 / %3 / %5 (RG 30.11.1995/22479), EKATY Md. 58-a/4 %5 / %6,5 / %8.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { gerilimDusumu as def } from "./gerilim-dusumu";

const ctx = defaultContext();
const C = (celsius: number) => celsius + 273.15;

/** 400 V, 45 A, 80 m, cosφ 0,85, NYY 10 mm² (R 1,83 Ω/km), X 0,09456 Ω/km, EİTY motor sınırı */
const UC_FAZ: ComputeInputs = {
  sistem: "uc_faz",
  U_ll: 400,
  I: 45,
  L: 80,
  cosphi: 0.85,
  rKaynak: "katalog",
  R_km: 1.83e-3,
  X_km: 0.09456e-3,
  sinir: "eity_motor",
};

/** 230 V, 16 A, 30 m, cosφ 1, Cu 2,5 mm² 70 °C, X = 0, EİTY aydınlatma sınırı */
const TEK_FAZ: ComputeInputs = {
  sistem: "tek_faz",
  U_ph: 230,
  I: 16,
  L: 30,
  cosphi: 1,
  rKaynak: "malzeme",
  iletken: "cu",
  A: 2.5e-6,
  thetaIsletme: C(70),
  X_km: 0,
  sinir: "eity_aydinlatma",
};

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("üç fazlı", () => {
  it("zorunlu: 400 V, 45 A, 80 m, cosφ 0,85, R 1,83 Ω/km, X 0,09456 Ω/km → ΔU 10,010 V (%2,502)", () => {
    // Elle: sinφ = √(1 − 0,85²) = 0,526783; R·cosφ + X·sinφ = 1,5555 + 0,049813 = 1,605313 mΩ/m;
    // ΔU = √3·45·80·1,605313e-3 = 10,00974 V; %ΔU = 10,00974/400 = %2,50243; U_yük = 389,990 V
    const r = def.compute(UC_FAZ, ctx);
    expect(r.outputs.dU).toBeCloseTo(10.009739, 5);
    expect(r.outputs.dUyuzde).toBeCloseTo(0.0250243464, 9);
    expect(r.outputs.Uyuk).toBeCloseTo(389.990261, 5);
    expect(r.outputs).not.toHaveProperty("R");
    expect(r.checks).toEqual([expect.objectContaining({ level: "ok", message: expect.stringMatching(/%2,502.*%3/) })]);
  });

  it("aynı hat EİTY aydınlatma sınırında (%1,5) uyarı ve yönetmelik referansı", () => {
    const r = def.compute({ ...UC_FAZ, sinir: "eity_aydinlatma" }, ctx);
    const w = r.checks.find((c) => c.level === "uyari");
    expect(w?.message).toMatch(/%2,502.*%1,5/);
    expect(w?.reference?.clause).toMatch(/Madde 57/);
  });

  it("alüminyum 95 mm², 90 °C, 150 A, 200 m, cosφ 0,9, X 0,08 Ω/km → R 0,38144 Ω/km, ΔU 19,650 V (%4,913)", () => {
    // Elle: R = 0,028264·(1 + 0,00403·70)/95 = 0,381445 Ω/km; sinφ = 0,435890;
    // ΔU = √3·150·200·(0,381445e-3·0,9 + 0,08e-3·0,435890) = 19,65038 V; %ΔU = 4,91259 %
    const r = def.compute(
      {
        ...UC_FAZ,
        I: 150,
        L: 200,
        cosphi: 0.9,
        rKaynak: "malzeme",
        iletken: "al",
        A: 95e-6,
        thetaIsletme: C(90),
        X_km: 0.08e-3,
        sinir: "ekaty_ag",
      },
      ctx,
    );
    expect(r.outputs.R).toBeCloseTo(0.381444994e-3, 12);
    expect(r.outputs.dU).toBeCloseTo(19.650377, 5);
    expect(r.outputs.dUyuzde).toBeCloseTo(0.0491259430, 9);
    // %4,91 ≤ %5 (EKATY)
    expect(r.checks[0]).toMatchObject({ level: "ok" });
    expect(r.checks[0].reference?.clause).toMatch(/58-a\/4/);
  });
});

describe("tek fazlı", () => {
  it("zorunlu: 230 V, 16 A, 30 m, Cu 2,5 mm² 70 °C, cosφ 1 → R 8,2515 Ω/km, ΔU 7,921 V (%3,444) → EİTY %1,5 uyarı", () => {
    // Elle: R = 0,017241·(1 + 0,00393·50)/2,5 = 8,2515426 Ω/km; ΔU = 2·16·30·8,2515426e-3 = 7,921481 V;
    // %ΔU = 7,921481/230 = %3,44412; U_yük = 222,0785 V
    const r = def.compute(TEK_FAZ, ctx);
    expect(r.outputs.R).toBeCloseTo(8.2515426e-3, 10);
    expect(r.outputs.dU).toBeCloseTo(7.921481, 5);
    expect(r.outputs.dUyuzde).toBeCloseTo(0.0344412213, 9);
    expect(r.outputs.Uyuk).toBeCloseTo(222.078519, 5);
    expect(r.checks[0]).toMatchObject({ level: "uyari" });
    expect(r.checks[0].message).toMatch(/%3,444.*%1,5/);
    // ρ₂₀/A notu
    expect(r.checks[1]).toMatchObject({ level: "bilgi" });
  });

  it("tek faz ile üç faz aynı R, X, I, L için 2/√3 oranında ΔU verir", () => {
    const tri = def.compute(UC_FAZ, ctx).outputs.dU;
    const mono = def.compute({ ...UC_FAZ, sistem: "tek_faz", U_ph: 230 }, ctx).outputs.dU;
    expect(mono / tri).toBeCloseTo(2 / Math.sqrt(3), 12);
  });

  it("kullanıcı tanımlı sınır (%4): %3,444 sınır içinde", () => {
    const r = def.compute({ ...TEK_FAZ, sinir: "kullanici", sinirKullanici: 0.04 }, ctx);
    expect(r.checks[0]).toMatchObject({ level: "ok" });
    expect(r.checks[0].message).toMatch(/kullanıcı tanımlı/);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("0,4 kV, 0,045 kA, 0,08 km, R 1,83 mΩ/m, X 0,09456 mΩ/m → ΔU 10,01 V; yüzde kesir olarak", () => {
    const r = run(
      {
        U_ll: { value: "0,4", unit: "kV" },
        I: { value: "0,045", unit: "kA" },
        L: { value: "0,08", unit: "km" },
        R_km: { value: "1,83", unit: "mohm_per_m" },
        X_km: { value: "0,09456", unit: "mohm_per_m" },
      },
      { dUyuzde: "fraction" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.dU).toBeCloseTo(10.009739, 5);
    expect(r.outputs.find((o) => o.key === "dUyuzde")).toMatchObject({ unit: "fraction" });
    expect(r.outputs.find((o) => o.key === "dU")).toMatchObject({ unit: "V", formatted: "10,01 V" });
  });

  it("tek faz, 158 °F (= 70 °C) işletme sıcaklığı ve 98,425 ft (= 30 m) → ΔU 7,921 V", () => {
    // 98,425 ft = 30,0000 m (0,3048 m/ft); elle ΔU yukarıdaki gibi 7,9215 V
    const r = run({
      sistem: { value: "tek_faz" },
      I: { value: "16", unit: "A" },
      L: { value: "98,425197", unit: "ft" },
      cosphi: { value: "1" },
      rKaynak: { value: "malzeme" },
      A: { value: "2,5", unit: "mm2" },
      thetaIsletme: { value: "158", unit: "degF" },
      X_km: { value: "0", unit: "ohm_per_km" },
      sinir: { value: "eity_aydinlatma" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.dU).toBeCloseTo(7.921481, 4);
    expect(r.outputs.find((o) => o.key === "R")).toMatchObject({ unit: "ohm_per_km" });
  });

  it("kullanıcı tanımlı sınır seçilip boş bırakılırsa alan hatası", () => {
    const r = run({ sinir: { value: "kullanici" }, sinirKullanici: { value: "", unit: "percent" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors).toHaveProperty("sinirKullanici");
  });
});

describe("sınır seçenekleri", () => {
  it("seçenek etiketleri config değerlerini gösterir", () => {
    const sel = def.inputs.find((i) => i.key === "sinir");
    if (sel?.kind !== "select") throw new Error("sinir select değil");
    const labels = sel.options.map((o) => o.label);
    expect(labels).toContain("EİTY Md. 57: aydınlatma ve priz devresi (%1,5)");
    expect(labels).toContain("EİTY Md. 57: motor devresi (%3)");
    expect(labels).toContain("EKATY Md. 58: kendi trafosu, aydınlatma toplamı (%6,5)");
    expect(labels).toContain("EKATY Md. 58: kendi trafosu, motor toplamı (%8)");
  });
});
