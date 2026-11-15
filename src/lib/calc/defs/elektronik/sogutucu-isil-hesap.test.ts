/**
 * 4.11 Soğutucu / ısıl hesap — testler (gerçek birim sistemiyle). Beklenen değerler elle hesaptır.
 * Formül: TI SPRA953D Denk. 5, T_J ≅ T_A + (R_θJC + R_θ(CS) + R_θ(SA))·P  https://www.ti.com/lit/pdf/spra953
 * Zorunlu vektör görev brifinginden: T_j,maks 125 °C, T_a 40 °C, P 10 W, R_θjc 1,5 K/W, R_θcs 0,5 K/W → R_θsa ≤ 6,5 K/W.
 * SI: sıcaklık K (125 °C = 398,15 K), ısıl direnç K/W.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState, RunResult } from "@/lib/calc/types";
import { sogutucuIsilHesap as def } from "./sogutucu-isil-hesap";

const ctx = defaultContext();
const K = (c: number) => c + 273.15;

const BASE: ComputeInputs = { mod: "rsa", P: 10, Ta: K(40), Tjmax: K(125), Rjc: 1.5, Rcs: 0.5, Rsa: 4 };

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}
const run = (state: InputState, outputUnits?: Record<string, string>) =>
  runCalc(def, { ...defaultState(def), ...state }, { outputUnits });

describe("gereken soğutucu (R_θsa)", () => {
  it("ZORUNLU: 125 °C, 40 °C, 10 W, 1,5 + 0,5 K/W → R_θsa ≤ 6,5 K/W", () => {
    // Elle: (125 − 40)/10 − 1,5 − 0,5 = 8,5 − 2 = 6,5 K/W
    const r = def.compute(BASE, ctx);
    expect(r.outputs.Rizin).toBeCloseTo(8.5, 12);
    expect(r.outputs.RsaGerekli).toBeCloseTo(6.5, 12);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
  });

  it("hiçbir soğutucu yetmez (P 50 W): R_θsa çıktısı yok; uyarı + ideal soğutucuyla P_maks 42,5 W ve T_j 140 °C", () => {
    // Elle: R_izin = 85/50 = 1,7 K/W; 1,7 − 2 = −0,3 K/W ≤ 0
    // İdeal (R_θsa = 0): P_maks = 85/2 = 42,5 W; T_j = 40 + 50·2 = 140 °C
    const r = def.compute({ ...BASE, P: 50 }, ctx);
    expect(r.outputs.Rizin).toBeCloseTo(1.7, 12);
    expect(r.outputs).not.toHaveProperty("RsaGerekli");
    expect(r.outputs.Pideal).toBeCloseTo(42.5, 10);
    expect(r.outputs.TjIdeal).toBeCloseTo(K(140), 10);
    const w = r.checks.find((c) => c.level === "uyari");
    expect(w?.message).toMatch(/Hiçbir soğutucu yetmez/);
    expect(w?.message).toContain("42,5 W");
    // Hiçbir çıktı negatif ısıl direnç göstermez
    for (const v of Object.values(r.outputs)) expect(v).toBeGreaterThan(0);
  });

  it("tam sıfır sınırı (P 42,5 W → R_θsa = 0): ofset artığı küçük pozitif R_θsa olarak gösterilmez", () => {
    // Elle: 85/42,5 = 2 K/W = R_θjc + R_θcs → R_θsa = 0
    const r = def.compute({ ...BASE, P: 42.5 }, ctx);
    expect(r.outputs).not.toHaveProperty("RsaGerekli");
    expect(r.outputs.Pideal).toBeCloseTo(42.5, 10);
    expect(r.outputs.TjIdeal).toBeCloseTo(K(125), 10);
    expect(r.checks.some((c) => c.level === "uyari" && c.message.includes("sıfır"))).toBe(true);
  });

  it("isteğe bağlı R_θJA: 5 K/W → soğutucusuz T_j 90 °C, sınırın altında (ok)", () => {
    // Elle: 40 + 10·5 = 90 °C ≤ 125 °C
    const r = def.compute({ ...BASE, Rja: 5 }, ctx);
    expect(r.outputs.TjJA).toBeCloseTo(K(90), 10);
    const c = r.checks.find((x) => x.message.includes("Soğutucusuz"));
    expect(c?.level).toBe("ok");
    expect(c?.message).toMatch(/soğutucu gerekmeyebilir/);
  });
});

describe("verilen soğutucuyla T_j", () => {
  it("R_θsa 4 K/W → T_j 100 °C, T_c 85 °C, T_s 80 °C, pay 25 K", () => {
    // Elle: ΣR = 6 K/W; T_j = 40 + 60 = 100 °C; T_c = 40 + 10·4,5 = 85 °C; T_s = 40 + 40 = 80 °C
    const r = def.compute({ ...BASE, mod: "tj" }, ctx);
    expect(r.outputs.Rtop).toBeCloseTo(6, 12);
    expect(r.outputs.Tj).toBeCloseTo(K(100), 10);
    expect(r.outputs.Tc).toBeCloseTo(K(85), 10);
    expect(r.outputs.Ts).toBeCloseTo(K(80), 10);
    expect(r.outputs.pay).toBeCloseTo(25, 10);
    expect(r.checks.find((c) => c.message.includes("altında (pay"))?.level).toBe("ok");
  });

  it("tutarlılık: gereken R_θsa (6,5 K/W) ile T_j tam T_j,maks olur; uyarı yok", () => {
    const r = def.compute({ ...BASE, mod: "tj", Rsa: 6.5 }, ctx);
    expect(r.outputs.Tj).toBeCloseTo(K(125), 10);
    expect(r.checks.filter((c) => c.level === "uyari")).toEqual([]);
  });

  it("R_θsa 8 K/W → T_j 140 °C > 125 °C → uyarı", () => {
    const r = def.compute({ ...BASE, mod: "tj", Rsa: 8 }, ctx);
    expect(r.outputs.Tj).toBeCloseTo(K(140), 10);
    expect(r.outputs.pay).toBeCloseTo(-15, 10);
    expect(r.checks.some((c) => c.level === "uyari" && c.message.includes("aşıyor"))).toBe(true);
  });

  it("R_θJA 40 K/W → soğutucusuz T_j 440 °C, soğutucu gerekli", () => {
    const r = def.compute({ ...BASE, mod: "tj", Rja: 40 }, ctx);
    expect(r.outputs.TjJA).toBeCloseTo(K(440), 10);
    expect(r.checks.some((c) => c.message.includes("soğutucu gerekli"))).toBe(true);
  });
});

describe("izin verilen en büyük güç", () => {
  it("R_θsa 6,5 K/W → P_maks 10 W (zorunlu vektörle tutarlı); R_θsa 4 K/W → 14,1667 W", () => {
    // Elle: 85/8,5 = 10 W; 85/6 = 14,16667 W
    expect(def.compute({ ...BASE, mod: "pmax", Rsa: 6.5 }, ctx).outputs.Pmax).toBeCloseTo(10, 10);
    const r = def.compute({ ...BASE, mod: "pmax" }, ctx);
    expect(r.outputs.Pmax).toBeCloseTo(14.166667, 6);
    expect(r.outputs.Tj).toBeCloseTo(K(125), 10);
  });

  it("R_θJA 40 K/W → soğutucusuz P_maks 2,125 W", () => {
    expect(def.compute({ ...BASE, mod: "pmax", Rja: 40 }, ctx).outputs.PmaxJA).toBeCloseTo(2.125, 12);
  });

  it("negatif °C ortam adımlarda parantezlenir: T_a −20 °C → P_maks = 145/6 W", () => {
    const r = ok(run({ mod: { value: "pmax" }, Ta: { value: "-20", unit: "degC" } }));
    expect(r.result.outputs.Pmax).toBeCloseTo(145 / 6, 10);
    expect(r.result.steps.some((s) => s.latex.includes("(-20\\,{}^\\circ\\mathrm{C})"))).toBe(true);
  });
});

describe("doğrulama ve birimler", () => {
  it("T_a ≥ T_j,maks → hata", () => {
    const r = run({ Ta: { value: "125", unit: "degC" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0].level).toBe("hata");
  });

  it("pmax modunda toplam ısıl direnç 0 → hata", () => {
    const r = run({
      mod: { value: "pmax" },
      Rjc: { value: "0", unit: "K_W" },
      Rcs: { value: "0", unit: "K_W" },
      Rsa: { value: "0", unit: "K_W" },
    });
    expect(r.ok).toBe(false);
  });

  it("varsayılan dışı birimler (runCalc): K, °F, °C/W, mW → R_θsa 6,5 K/W; T_j çıktısı K seçilebilir", () => {
    // 257 °F = 125 °C; 313,15 K = 40 °C
    const r = ok(
      run({
        Ta: { value: "313,15", unit: "K" },
        Tjmax: { value: "257", unit: "degF" },
        P: { value: "10000", unit: "mW" },
        Rjc: { value: "1,5", unit: "degC_W" },
        Rcs: { value: "0,5", unit: "degC_W" },
      }),
    );
    expect(r.result.outputs.RsaGerekli).toBeCloseTo(6.5, 9);
    expect(r.outputs.find((o) => o.key === "RsaGerekli")).toMatchObject({ formatted: "6,5 K/W" });

    const tj = ok(run({ mod: { value: "tj" } }, { Tj: "K" }));
    expect(tj.outputs.find((o) => o.key === "Tj")).toMatchObject({ unit: "K", formatted: "373,2 K" });
    expect(tj.outputs.find((o) => o.key === "Tc")).toMatchObject({ unit: "degC", formatted: "85 °C" });
  });
});
