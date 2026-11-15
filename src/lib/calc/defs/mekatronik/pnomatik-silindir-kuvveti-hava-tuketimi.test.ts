/**
 * 6.6 Pnömatik silindir kuvveti ve hava tüketimi testleri (gerçek birim sistemiyle).
 *
 * Kaynaklı vektörler: Festo kataloglarının "Theoretical force at 6 bar, advancing / retracting" satırları
 * (tam N'ye yuvarlanmış):
 * - DSBC, ISO 15552 (2015/11): https://ftp.festo.com/public/PNEUMATIC/SOFTWARE_SERVICE/Documentation/2016/EN/DSBC_EN.PDF
 * - DSNU, ISO 6432 (2012/08): https://ftp.festo.com/public/PNEUMATIC/SOFTWARE_SERVICE/Documentation/2012/EN/DSNU-ISO_EN.PDF
 * Diğer beklenen değerler elle hesaptır: A = πD²/4, F = p·A·η, Q = V·n·(p + 1 bar)/1 bar (ISO 8778: 100 kPa).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { pnomatikSilindir as def } from "./pnomatik-silindir-kuvveti-hava-tuketimi";

const ctx = defaultContext();
const BAR = 1e5;
/** NL/dk → m³/s */
const NL_MIN = 1e-3 / 60;

const CIFT = { etki: "cift", D: 0.05, d: 0.02, p: 6 * BAR, eta: 1, s: 0.1, n: 10 / 60 };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("kuvvet", () => {
  it("zorunlu: ∅50 mm, 6 bar gösterge, η = 1 → itme 1178 N (Festo DSBC-50: 1178 N)", () => {
    // Elle: A = π·0,05²/4 = 1,963495·10⁻³ m²; F = 6·10⁵ · 1,963495·10⁻³ = 1178,097 N
    const r = def.compute(CIFT, ctx);
    expect(r.outputs.A).toBeCloseTo(1.963495e-3, 9);
    expect(r.outputs.Fitme).toBeCloseTo(1178.097, 3);
    expect(Math.round(r.outputs.Fitme)).toBe(1178);
    // Çekme: A_r = π(0,05² − 0,02²)/4 = 1,649336·10⁻³ m² → 989,60 N (Festo DSBC-50: 990 N)
    expect(r.outputs.Ar).toBeCloseTo(1.649336e-3, 9);
    expect(r.outputs.Fcekme).toBeCloseTo(989.6017, 4);
  });

  // Katalog değerleri tam N'ye yuvarlanmış; en büyük fark ∅20'de 188,50 → 189 N (0,504 N).
  const FESTO: [string, number, number, number, number][] = [
    ["DSNU-8", 8, 4, 30, 23],
    ["DSNU-10", 10, 4, 47, 40],
    ["DSNU-12", 12, 6, 68, 51],
    ["DSNU-16", 16, 6, 121, 104],
    ["DSNU-20", 20, 8, 189, 158],
    ["DSNU-25", 25, 10, 295, 247],
    ["DSBC-32", 32, 12, 483, 415],
    ["DSBC-40", 40, 16, 754, 633],
    ["DSBC-50", 50, 20, 1178, 990],
    ["DSBC-63", 63, 20, 1870, 1682],
    ["DSBC-80", 80, 25, 3016, 2721],
    ["DSBC-100", 100, 25, 4712, 4418],
    ["DSBC-125", 125, 32, 7363, 6881],
  ];
  it.each(FESTO)("Festo %s (∅%d/∅%d mm), 6 bar → itme %d N, çekme %d N", (_ad, D, d, itme, cekme) => {
    const r = def.compute({ ...CIFT, D: D / 1000, d: d / 1000 }, ctx);
    expect(Math.abs(r.outputs.Fitme - itme)).toBeLessThan(0.51);
    expect(Math.abs(r.outputs.Fcekme - cekme)).toBeLessThan(0.51);
    // Config'teki katalog çiftiyle eşleşir
    expect(r.checks.some((c) => c.level === "ok" && /mil çapı Festo/.test(c.message))).toBe(true);
  });

  it("verim kuvveti orantılı düşürür (η = %90 → 1060,29 N)", () => {
    // Elle: 1178,097 · 0,9 = 1060,287 N; 989,602 · 0,9 = 890,642 N
    const r = def.compute({ ...CIFT, eta: 0.9 }, ctx);
    expect(r.outputs.Fitme).toBeCloseTo(1060.2875, 3);
    expect(r.outputs.Fcekme).toBeCloseTo(890.6415, 3);
  });
});

describe("hava tüketimi", () => {
  it("çift etkili ∅50/20, s 100 mm, 10 1/dk, 6 bar → 25,29 NL/dk", () => {
    // Elle: (A + A_r)·s = (1963,495 + 1649,336) mm² · 100 mm = 0,3612832 L; oran (6 + 1)/1 = 7;
    // 0,3612832 · 7 · 10 = 25,28982 NL/dk
    const r = def.compute(CIFT, ctx);
    expect(r.outputs.Q / NL_MIN).toBeCloseTo(25.28982, 4);
  });

  it("tek etkili ∅32, yay 30 N, s 50 mm, 20 1/dk, 6 bar → 452,55 N, 5,630 NL/dk (yalnız itme hacmi)", () => {
    // Elle: A = 804,248 mm²; F = 6·10⁵·8,04248·10⁻⁴ − 30 = 452,549 N;
    // Q = 804,248 mm² · 50 mm · 7 · 20 = 5,629734 NL/dk
    const r = def.compute({ etki: "tek", D: 0.032, p: 6 * BAR, eta: 1, Fyay: 30, s: 0.05, n: 20 / 60 }, ctx);
    expect(r.outputs.Fitme).toBeCloseTo(452.5486, 4);
    expect(r.outputs.Q / NL_MIN).toBeCloseTo(5.629734, 5);
    expect(r.outputs).not.toHaveProperty("Fcekme");
    expect(r.outputs).not.toHaveProperty("Ar");
    expect(r.checks.some((c) => /ISO 15552 standart piston çapı\.$/.test(c.message))).toBe(true);
  });

  it("tek etkili, yay kuvveti boş → teorik itme kuvveti ve bilgi notu", () => {
    const r = def.compute({ etki: "tek", D: 0.032, p: 6 * BAR, eta: 1, s: 0.05, n: 20 / 60 }, ctx);
    expect(r.outputs.Fitme).toBeCloseTo(482.5486, 4);
    expect(r.checks.some((c) => /Yay kuvveti girilmedi/.test(c.message))).toBe(true);
  });
});

describe("doğrulama ve kontroller", () => {
  it("mil çapı piston çapından küçük olmalı (yalnız çift etkili)", () => {
    expect(def.validate?.({ ...CIFT, d: 0.05 }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.compute({ ...CIFT, d: 0.06 }, ctx).outputs).toEqual({});
    expect(def.validate?.(CIFT, ctx)).toEqual([]);
  });

  it("tek etkilide yay kuvveti basınç kuvvetini aşamaz", () => {
    const tek = { etki: "tek", D: 0.032, p: 6 * BAR, eta: 1, s: 0.05, n: 1 };
    expect(def.validate?.({ ...tek, Fyay: 500 }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.validate?.({ ...tek, Fyay: 100 }, ctx)).toEqual([]);
  });

  it("10 bar'ın üstü ISO 15552/6432 serisi uyarısı; tam 10 bar uyarısız", () => {
    const over = def.compute({ ...CIFT, p: 12 * BAR }, ctx);
    expect(over.checks.filter((c) => c.level === "uyari")).toEqual([
      expect.objectContaining({ message: expect.stringMatching(/10 bar/), reference: expect.objectContaining({ standard: "ISO 15552" }) }),
    ]);
    expect(def.compute({ ...CIFT, p: 10 * BAR }, ctx).checks.filter((c) => c.level === "uyari")).toEqual([]);
    // ∅8–25 mm silindirde referans ISO 6432
    const small = def.compute({ ...CIFT, D: 0.02, d: 0.008, p: 12 * BAR }, ctx);
    expect(small.checks.find((c) => c.level === "uyari")?.reference?.standard).toBe("ISO 6432");
  });

  it("katalog karşılaştırması: mil farklı ve standart dışı çap bilgi düzeyinde", () => {
    const rod = def.compute({ ...CIFT, d: 0.025 }, ctx);
    expect(rod.checks.some((c) => c.level === "bilgi" && /Festo DSBC kataloğunda mil çapı 20 mm \(girilen 25 mm\)/.test(c.message))).toBe(true);
    const odd = def.compute({ ...CIFT, D: 0.055 }, ctx);
    expect(odd.checks.some((c) => c.level === "bilgi" && /katalog listesindeki çaplardan biri değil.*8, 10, 12, 16, 20, 25 mm.*32, 40, 50, 63, 80, 100, 125 mm.*125 mm üstü/.test(c.message))).toBe(true);
    expect(odd.checks.every((c) => c.level === "ok" || c.level === "bilgi")).toBe(true);
  });

  it("adımlarda basınç bar, çap mm, alan cm² ile yazılır (Pa değil)", () => {
    const r = def.compute(CIFT, ctx);
    const all = r.steps.map((s) => s.latex).join(" ");
    expect(all).toContain("6\\,\\mathrm{bar}");
    expect(all).toContain("1\\,\\mathrm{bar}");
    expect(all).toContain("50\\,\\mathrm{mm}");
    expect(all).toContain("19{,}63\\,\\mathrm{cm}^2");
    expect(all).toContain("1178\\,\\mathrm{N}");
    expect(all).not.toMatch(/\\mathrm{Pa}/);
    expect(all).toContain("\\mathrm{NL}/\\mathrm{dk}");
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("∅2,5 in / 0,8 in, 87 psi, η %90, s 0,3 m, 0,25 Hz → kN ve mm² ile", () => {
    // Elle: D = 63,5 mm, d = 20,32 mm; p = 87 psi = 599 843,88 Pa;
    // A = 3166,922 mm², A_r = 2842,629 mm²; F_itme = 599 843,88·3,166922·10⁻³·0,9 = 1709,693 N;
    // F_çekme = 1534,620 N; oran = (5,998439 + 1)/1 = 6,998439;
    // Q = (3166,922 + 2842,629) mm² · 300 mm · 15 1/dk · 6,998439 = 189,2586 NL/dk
    const r = run(
      {
        D: { value: "2,5", unit: "in" },
        d: { value: "0,8", unit: "in" },
        p: { value: "87", unit: "psi" },
        eta: { value: "90", unit: "percent" },
        s: { value: "0,3", unit: "m" },
        n: { value: "0,25", unit: "Hz" },
      },
      { Fitme: "kN", A: "mm2" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.A).toBeCloseTo(3166.9217e-6, 10);
    expect(o.Ar).toBeCloseTo(2842.629e-6, 9);
    expect(o.Fitme).toBeCloseTo(1709.6928, 3);
    expect(o.Fcekme).toBeCloseTo(1534.6202, 3);
    expect(o.Q / NL_MIN).toBeCloseTo(189.2586, 3);
    expect(r.outputs.find((x) => x.key === "Fitme")).toMatchObject({ unit: "kN" });
    expect(r.outputs.find((x) => x.key === "A")).toMatchObject({ unit: "mm2" });
    expect(r.outputs.find((x) => x.key === "Q")).toMatchObject({ unit: "NL_min" });
  });

  it("varsayılan durum: çıktılar otomatik birim değiştirmez (N, cm², NL/dk)", () => {
    const r = run({});
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.map((o) => [o.key, o.unit])).toEqual([
      ["A", "cm2"],
      ["Ar", "cm2"],
      ["Fitme", "N"],
      ["Fcekme", "N"],
      ["Q", "NL_min"],
    ]);
    expect(r.outputs.find((o) => o.key === "Fitme")?.formatted).toBe("1178 N");
  });

  it("tek etkili seçilince mil çapı gizli ve doğrulanmaz", () => {
    const r = run({ etki: { value: "tek" }, d: { value: "999", unit: "mm" } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.map((o) => o.key)).toEqual(["A", "Fitme", "Q"]);
  });
});
