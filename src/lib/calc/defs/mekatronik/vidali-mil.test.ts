/**
 * 6.2 Vidalı mil testleri (gerçek birim sistemiyle).
 * Kaynaklar:
 * - THK seçim kriterleri: denklem (48) T = Fa·Ph/(2π·η), (49) J ve ω′, (7) kritik devir, (5) burkulma, (6) P₂
 *   https://www.thk.com/eu/en/products/ball_screw/selection/0013/ , /0007/ , /0006/
 * - THK özellikler sayfası, denklem (3) T = Ph·η₂·Fa/(2π) ve tork örneği (500 kg, μ 0,003, Ph 10 mm, η 0,96 → 24 N·mm)
 *   https://tech.thk.com/en/products/pdf/en_b15_006.pdf
 * - THK çözümlü seçim örneği (High-speed Transfer Equipment): d₁ 17,5 mm, ℓa = ℓb = 1100 mm → P₁ ≈ 15 500 N
 *   (sabit–sabit, η₂ = 20), N₁ ≈ 2180 dev/dk (sabit–destekli, λ₂ = 15,1), P₂ ≈ 35 500 N; J = 3,39×10⁻³ kg·m²
 *   https://tech.thk.com/en/products/pdf/en_b15_069.pdf
 * Katalog sonuçları yuvarlatılmış sabitlerle (λ₂, η₂, 116) hesaplandığından gevşek (%0,5) karşılaştırılır;
 * sıkı beklentiler SI formülle elle hesaptır.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { vidaliMil as def } from "./vidali-mil";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;

const BASE: ComputeInputs = {
  F: 1000,
  Ph: 0.01,
  eta1: 0.9,
  eta2: 0.9,
  hizGirdi: "devir",
  n: 1500 * RPM,
  m: 80,
  t: 0.15,
  d0: 0.02,
  d1: 0.0175,
  L: 1.2,
  yatakKritik: "sabit-destekli",
  lb: 1.1,
  yatakBurkulma: "sabit-sabit",
  la: 1.1,
};

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("tork", () => {
  it("ZORUNLU: 1000 N, hatve 10 mm, η = 0,9 → T = 1,768 N·m", () => {
    // Elle: 1000·0,010/(2π·0,9) = 10/5,654867 = 1,768388 N·m
    const r = def.compute(BASE, ctx);
    expect(r.outputs.T).toBeCloseTo(1.768388, 6);
    expect(Number(r.outputs.T.toFixed(3))).toBe(1.768);
  });

  it("geri tahrik: T = F·Ph·η₂/(2π) = 1,4324 N·m (η₂ = 0,9)", () => {
    // Elle: 1000·0,010·0,9/(2π) = 1,432394 N·m
    expect(def.compute(BASE, ctx).outputs.Tgeri).toBeCloseTo(1.432394, 6);
  });

  it("THK tork örneği: 14,7 N, 10 mm, η 0,96 → 24 N·mm (katalog, yuvarlatılmış)", () => {
    // Elle: 14,7·10/(2π·0,96) = 24,3706 N·mm
    const r = def.compute({ ...BASE, F: 14.7, eta1: 0.96 }, ctx);
    expect(r.outputs.T * 1000).toBeCloseTo(24.3706, 3);
    expect(Math.round(r.outputs.T * 1000)).toBe(24);
  });

  it("THK seçim örneği: 17 N, 40 mm, η 0,9 → T₁ = 120 N·mm", () => {
    // Elle: 17·40/(2π·0,9) = 120,250 N·mm
    const r = def.compute({ ...BASE, F: 17, Ph: 0.04 }, ctx);
    expect(r.outputs.T * 1000).toBeCloseTo(120.2504, 3);
  });
});

describe("hız, atalet, hızlanma", () => {
  it("varsayılan: 1500 dev/dk · 10 mm = 15 m/dk; J = 3,5061×10⁻⁴ kg·m²; T_ivme 0,3672 N·m; F_maks 1133,3 N", () => {
    // Elle: v = 25 dev/s · 0,01 m = 0,25 m/s = 15 m/dk; J_yük = 80·(0,01/2π)² = 2,02642×10⁻⁴;
    // J_s = π·7850·1,2·0,02⁴/32 = 1,47969×10⁻⁴; J = 3,50611×10⁻⁴ kg·m²; α = 157,0796/0,15 = 1047,198 rad/s²;
    // T_ivme = 0,367159 N·m; T_hız = 1,768388 + 0,367159 = 2,135548 N·m; F_maks = 1000 + 80·0,25/0,15 = 1133,333 N
    const o = def.compute(BASE, ctx).outputs;
    expect(o.v * 60).toBeCloseTo(15, 9);
    expect(o.Jyuk).toBeCloseTo(2.026424e-4, 9);
    expect(o.Js).toBeCloseTo(1.479690e-4, 9);
    expect(o.J).toBeCloseTo(3.506114e-4, 9);
    expect(o.alfa).toBeCloseTo(1047.1976, 3);
    expect(o.Tivme).toBeCloseTo(0.3671594, 6);
    expect(o.Thiz).toBeCloseTo(2.1355476, 6);
    expect(o.Fmaks).toBeCloseTo(1133.3333, 3);
  });

  it("THK örneği: 80 kg, hatve 40 mm, mil Ø20 × 1200 mm → J = 3,39×10⁻³ kg·m², ω′ = 1047 rad/s²", () => {
    // THK: J_s = 1,48×10⁻⁴ kg·m² (katalogdaki birim boy ataletinden), J = 3,39×10⁻³ kg·m², ω′ ≈ 1050 rad/s².
    // Elle: J = 80·(0,04/2π)² + 1,47969×10⁻⁴ = 3,390247×10⁻³; ω′ = 2π·1500/(60·0,15) = 1047,198
    const o = def.compute({ ...BASE, Ph: 0.04 }, ctx).outputs;
    expect(o.Js).toBeCloseTo(1.48e-4, 6);
    expect(o.J).toBeCloseTo(3.390247e-3, 8);
    expect(rel(o.J, 3.39e-3)).toBeLessThan(0.005);
    expect(o.alfa).toBeCloseTo(1047.1976, 3);
  });

  it("doğrusal hızdan devir: 0,25 m/s, 10 mm → 1500 dev/dk", () => {
    // n alanı bu modda gizlidir; compute'a gelse bile kullanılmamalı
    const o = def.compute({ ...BASE, hizGirdi: "dogrusal", n: 1, v: 0.25 }, ctx).outputs;
    expect(o.n / RPM).toBeCloseTo(1500, 9);
    expect(o.v).toBeCloseTo(0.25, 12);
  });
});

describe("kritik devir, burkulma, izin verilen yük (THK)", () => {
  it("THK örneği d₁ 17,5 mm, ℓ 1100 mm: N₁ 2182 dev/dk (sabit–destekli), P₁ 15 472 N (sabit–sabit), P₂ 35 358 N", () => {
    // Elle (SI): I = π·0,0175⁴/64, A = π·0,0175²/4, √(E·I/(ρA)) = (d₁/4)·√(E/ρ) = 22,4118 m²/s;
    // N₁ = 0,8·3,927²/1,1²·22,4118 = 228,51 rad/s = 2182,10 dev/dk;
    // P₁ = 0,5·4·π²·2,06×10¹¹·4,60386×10⁻⁹/1,21 = 15 471,54 N; P₂ = 147×10⁶·2,40528×10⁻⁴ = 35 357,64 N
    const o = def.compute(BASE, ctx).outputs;
    expect(o.N1 / RPM).toBeCloseTo(2182.1, 1);
    expect(o.P1).toBeCloseTo(15471.54, 1);
    expect(o.P2).toBeCloseTo(35357.64, 1);
    // Katalog (yuvarlatılmış λ₂ = 15,1, η₂ = 20, 116·d₁²): 2180 dev/dk, 15 500 N, 35 500 N
    expect(rel(o.N1 / RPM, 2180)).toBeLessThan(0.005);
    expect(rel(o.P1, 15500)).toBeLessThan(0.005);
    expect(rel(o.P2, 35500)).toBeLessThan(0.005);
  });

  it("THK örneği d₁ 26,4 mm: N₁ ≈ 3294 dev/dk (katalog), elle 3291,85", () => {
    const o = def.compute({ ...BASE, d0: 0.03, d1: 0.0264 }, ctx).outputs;
    expect(o.N1 / RPM).toBeCloseTo(3291.85, 1);
    expect(rel(o.N1 / RPM, 3294)).toBeLessThan(0.005);
  });

  it("diğer yataklamalar: λ₁ ve η₁ tablosu (aynı mil)", () => {
    // Elle: N₁ ∝ λ₁²: sabit–serbest 497,46; destekli–destekli 1396,90; sabit–sabit 3165,74 dev/dk.
    // P₁ ∝ η₁: sabit–serbest 966,97 N; sabit–destekli 7735,77 N
    const c = (yatakKritik: string) => def.compute({ ...BASE, yatakKritik }, ctx).outputs.N1 / RPM;
    expect(c("sabit-serbest")).toBeCloseTo(497.457, 2);
    expect(c("destekli-destekli")).toBeCloseTo(1396.9, 1);
    expect(c("sabit-sabit")).toBeCloseTo(3165.74, 1);
    const b = (yatakBurkulma: string) => def.compute({ ...BASE, yatakBurkulma }, ctx).outputs.P1;
    expect(b("sabit-serbest")).toBeCloseTo(966.97, 1);
    expect(b("sabit-destekli")).toBeCloseTo(7735.77, 1);
  });

  it("aşımlarda uyarı: devir > N₁, F_maks > P₁", () => {
    const fast = def.compute({ ...BASE, n: 2500 * RPM }, ctx);
    expect(fast.checks.filter((c) => c.level === "uyari")).toHaveLength(1);
    expect(fast.checks.find((c) => c.level === "uyari")?.message).toMatch(/2500 dev\/dk.*2182 dev\/dk/);
    // sabit–serbest burkulma 967 N < F_maks 1133 N
    const weak = def.compute({ ...BASE, yatakBurkulma: "sabit-serbest" }, ctx);
    const w = weak.checks.filter((c) => c.level === "uyari");
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/burkulma/);
    expect(w[0].reference?.clause).toMatch(/\(5\)/);
    expect(def.compute(BASE, ctx).checks.every((c) => c.level === "ok" || c.level === "bilgi")).toBe(true);
  });

  it("çapraz kontroller: d₁ < d₀, açıklıklar mil boyunu aşamaz", () => {
    expect(def.validate?.({ ...BASE, d1: 0.02 }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.validate?.({ ...BASE, la: 1.3 }, ctx)).toEqual([expect.objectContaining({ level: "hata" })]);
    expect(def.validate?.(BASE, ctx)).toEqual([]);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("2,5 kN, 20 mm, %95/0,85, 500 mm/s, 120 kg, 200 ms, Ø32 / d₁ 27,2 mm, 1,5 m; ℓb 1,4 m sabit–sabit, ℓa 0,7 m sabit–destekli", () => {
    // Elle: T = 2500·0,02/(2π·0,95) = 8,37658 N·m; T_geri = 2500·0,02·0,85/(2π) = 6,76409 N·m;
    // n = 0,5/0,02 = 25 dev/s = 1500 dev/dk; J_s = π·7850·1,5·0,032⁴/32 = 12,1216 kg·cm²;
    // J_yük = 120·(0,02/2π)² = 1,215854×10⁻³; J = 2,428016×10⁻³ kg·m²; T_ivme = J·157,08/0,2 = 1,906960 N·m;
    // F_maks = 2500 + 120·0,5/0,2 = 2800 N; N₁ (λ₁ 4,73) = 3037,63 dev/dk; P₁ (η₁ 2) = 111,485 kN; P₂ = 85,4171 kN
    const r = run(
      {
        F: { value: "2,5", unit: "kN" },
        Ph: { value: "20", unit: "mm" },
        eta1: { value: "95", unit: "percent" },
        eta2: { value: "0,85", unit: "fraction" },
        hizGirdi: { value: "dogrusal" },
        v: { value: "500", unit: "mm_s" },
        m: { value: "120", unit: "kg" },
        t: { value: "200", unit: "ms" },
        d0: { value: "32", unit: "mm" },
        d1: { value: "27,2", unit: "mm" },
        L: { value: "1,5", unit: "m" },
        yatakKritik: { value: "sabit-sabit" },
        lb: { value: "1,4", unit: "m" },
        yatakBurkulma: { value: "sabit-destekli" },
        la: { value: "700", unit: "mm" },
      },
      { Js: "kgcm2", P1: "kN" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.T).toBeCloseTo(8.376576, 6);
    expect(o.Tgeri).toBeCloseTo(6.764085, 6);
    expect(o.n / RPM).toBeCloseTo(1500, 9);
    expect(o.Js * 1e4).toBeCloseTo(12.12162, 5);
    expect(o.J).toBeCloseTo(2.428016e-3, 9);
    expect(o.Tivme).toBeCloseTo(1.90696, 5);
    expect(o.Fmaks).toBeCloseTo(2800, 9);
    expect(o.N1 / RPM).toBeCloseTo(3037.63, 1);
    expect(o.P1 / 1000).toBeCloseTo(111.485, 3);
    expect(o.P2 / 1000).toBeCloseTo(85.4171, 3);
    expect(r.outputs.find((x) => x.key === "P1")?.formatted).toMatch(/kN$/);
  });

  it("adımlarda girdiler tanımın varsayılan birimiyle yazılır (10 mm, 1000 N; Pa değil MPa)", () => {
    const r = run({});
    if (!r.ok) throw new Error(JSON.stringify(r));
    const latex = r.result.steps.map((s) => s.latex).join(" ");
    expect(latex).toContain("10\\,\\mathrm{mm}");
    expect(latex).toContain("1000\\,\\mathrm{N}");
    expect(latex).toContain("\\mathrm{MPa}");
    expect(latex).toContain("1{,}768\\,\\mathrm{N}\\cdot \\mathrm{m}");
  });
});
