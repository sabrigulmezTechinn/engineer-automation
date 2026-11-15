/**
 * 6.7 Hidrolik silindir ve pompa testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır: A = πD²/4, A_r = π(D² − d²)/4, F = p·A, v = Q/A, P_hid = p·Q, P_motor = p·Q/η_t.
 * Seri anma basınçları standart başlıklarından: ISO 6020-2 "16 MPa (160 bar) series", ISO 6022 "25 MPa (250 bar) series".
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { hidrolikSilindirPompa as def } from "./hidrolik-silindir-pompa";

const ctx = defaultContext();
const BAR = 1e5;
const L_MIN = 1e-3 / 60;

const BASE = { seri: "iso6020_2", D: 0.063, d: 0.036, p: 100 * BAR, Q: 40 * L_MIN, eta: 0.85 };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("silindir ve pompa", () => {
  it("∅63/36 mm, 100 bar, 40 L/dk, η_t %85", () => {
    // Elle: A = π·0,063²/4 = 3,117245·10⁻³ m²; A_r = π(0,063² − 0,036²)/4 = 2,099369·10⁻³ m²;
    // φ = 63²/(63² − 36²) = 3969/2673 = 1,484848; F_itme = 10⁷·3,117245·10⁻³ = 31 172,45 N; F_çekme = 20 993,69 N;
    // Q = 6,666667·10⁻⁴ m³/s → v_itme = 0,213864 m/s, v_çekme = 0,317556 m/s;
    // P_hid = 10⁷·6,666667·10⁻⁴ = 6666,667 W; P_motor = 6666,667/0,85 = 7843,137 W
    const r = def.compute(BASE, ctx);
    const o = r.outputs;
    expect(o.A).toBeCloseTo(3.1172453e-3, 10);
    expect(o.Ar).toBeCloseTo(2.0993693e-3, 10);
    expect(o.phi).toBeCloseTo(3969 / 2673, 12);
    expect(o.Fitme).toBeCloseTo(31172.453, 3);
    expect(o.Fcekme).toBeCloseTo(20993.693, 3);
    expect(o.vitme).toBeCloseTo(0.2138640, 7);
    expect(o.vcekme).toBeCloseTo(0.3175557, 7);
    expect(o.Phid).toBeCloseTo(6666.6667, 4);
    expect(o.Pmotor).toBeCloseTo(7843.1373, 4);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
    expect(r.checks[0]).toMatchObject({ level: "ok", message: expect.stringMatching(/ISO 6020-2.*160 bar/) });
  });

  it("çekme hızı / itme hızı = itme kuvveti / çekme kuvveti = φ", () => {
    const o = def.compute(BASE, ctx).outputs;
    expect(o.vcekme / o.vitme).toBeCloseTo(o.phi, 12);
    expect(o.Fitme / o.Fcekme).toBeCloseTo(o.phi, 12);
  });
});

describe("seri anma basıncı kontrolü", () => {
  it("ISO 6020-2: 160 bar sınırda uyarısız, üstünde uyarı", () => {
    expect(def.compute({ ...BASE, p: 160 * BAR }, ctx).checks.filter((c) => c.level === "uyari")).toEqual([]);
    const over = def.compute({ ...BASE, p: 161 * BAR }, ctx);
    expect(over.checks.filter((c) => c.level === "uyari")).toEqual([
      expect.objectContaining({ message: expect.stringMatching(/160 bar/), reference: expect.objectContaining({ standard: "ISO 6020-2" }) }),
    ]);
  });

  it("ISO 6022: 250 bar sınırda uyarısız, üstünde uyarı; belirtilmemiş seride kontrol yok", () => {
    expect(def.compute({ ...BASE, seri: "iso6022", p: 250 * BAR }, ctx).checks.filter((c) => c.level === "uyari")).toEqual([]);
    const over = def.compute({ ...BASE, seri: "iso6022", p: 260 * BAR }, ctx);
    expect(over.checks.find((c) => c.level === "uyari")?.reference?.standard).toBe("ISO 6022");
    const none = def.compute({ ...BASE, seri: "yok", p: 400 * BAR }, ctx);
    expect(none.checks.map((c) => c.level)).toEqual(["ok"]);
  });

  it("mil çapı piston çapından küçük olmalı", () => {
    expect(def.validate?.({ ...BASE, d: 0.063 }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.compute({ ...BASE, d: 0.07 }, ctx).outputs).toEqual({});
    expect(def.validate?.(BASE, ctx)).toEqual([]);
  });

  it("adımlarda basınç bar, debi L/dk ile (Pa ve m³/s değil)", () => {
    const all = def
      .compute(BASE, ctx)
      .steps.map((s) => s.latex)
      .join(" ");
    expect(all).toContain("100\\,\\mathrm{bar}");
    expect(all).toContain("40\\,\\mathrm{L}/\\mathrm{dk}");
    expect(all).toContain("31{,}17\\,\\mathrm{kN}");
    expect(all).not.toMatch(/\\mathrm{Pa}|\\mathrm{m}\^3/);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("∅10 cm / 5,6 cm, 21 MPa, 2,4 m³/sa, η 0,9 (kesir), ISO 6020-2 → N, mm/s, W ve uyarı", () => {
    // Elle: A = 7,853982·10⁻³ m², A_r = π(0,1² − 0,056²)/4 = 5,390973·10⁻³ m²;
    // F_itme = 21·10⁶·7,853982·10⁻³ = 164 933,6 N; F_çekme = 113 210,4 N;
    // Q = 2,4/3600 = 6,666667·10⁻⁴ m³/s → v_itme = 84,8826 mm/s, v_çekme = 123,6635 mm/s;
    // P_hid = 14 000 W; P_motor = 15 555,56 W; 210 bar > 160 bar → uyarı
    const r = run(
      {
        D: { value: "10", unit: "cm" },
        d: { value: "5,6", unit: "cm" },
        p: { value: "21", unit: "MPa" },
        Q: { value: "2,4", unit: "m3_h" },
        eta: { value: "0,9", unit: "fraction" },
      },
      { Fitme: "N", vitme: "mm_s", vcekme: "mm_s", Pmotor: "W" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.Fitme).toBeCloseTo(164933.614, 2);
    expect(o.Fcekme).toBeCloseTo(113210.433, 2);
    expect(o.vitme).toBeCloseTo(0.0848826, 7);
    expect(o.vcekme).toBeCloseTo(0.1236635, 7);
    expect(o.Phid).toBeCloseTo(14000, 6);
    expect(o.Pmotor).toBeCloseTo(15555.556, 3);
    expect(r.outputs.find((x) => x.key === "vitme")).toMatchObject({ unit: "mm_s", formatted: "84,88 mm/s" });
    expect(r.outputs.find((x) => x.key === "Pmotor")).toMatchObject({ unit: "W" });
    expect(r.result.checks.filter((c) => c.level === "uyari")).toHaveLength(1);
  });

  it("varsayılan durumda kuvvet kN, hız m/s'de kalır", () => {
    const r = run({});
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.find((o) => o.key === "Fitme")).toMatchObject({ unit: "kN", formatted: "31,17 kN" });
    expect(r.outputs.find((o) => o.key === "vitme")).toMatchObject({ unit: "m_s" });
    expect(r.outputs.find((o) => o.key === "A")).toMatchObject({ unit: "cm2" });
  });
});
