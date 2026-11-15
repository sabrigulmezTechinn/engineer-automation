/**
 * 24 V DC güç kaynağı yük hesabı (5.4) testleri. Gerçek birim sistemiyle çalışır.
 * Beklenen değerler elle hesaptır: ΣP = Σ Pᵢ, P_top = ΣP·kₑ·k_r, I = P/24 V.
 * Besleme toleransı (IEC 61131-2, 24 V −%15/+%20 = 20,4–28,8 V) src/config/sinir/otomasyon.ts'ten okunur.
 */
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/config/sinirlar";
import { defaultContext, defaultState, runCalc, visibleInputs } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { gucKaynagi24Vdc, TIPIK_KAYNAK_AKIMLARI } from "./guc-kaynagi-24vdc";

const ctx = defaultContext();
const compute = (inputs: Partial<ComputeInputs>) =>
  gucKaynagi24Vdc.compute({ mod: "guc", ke: 1, kr: 1, ...inputs } as ComputeInputs, ctx);

function state(values: Record<string, [string, string?]>): InputState {
  const s: InputState = { ...defaultState(gucKaynagi24Vdc) };
  for (const [k, [value, unit]] of Object.entries(values)) s[k] = { value, unit: unit ?? s[k]?.unit };
  return s;
}

describe("elle hesaplanmış değerler", () => {
  it("12; 6; 6; 10; 18 W, kₑ = 0,8, k_r = 1,25 → 52 W, 41,6 W, 52 W; 1,7333 A; 2,1667 A → 2,5 A", () => {
    const r = compute({ yukGuc: [12, 6, 6, 10, 18], ke: 0.8, kr: 1.25 });
    expect(r.outputs.pToplam).toBeCloseTo(52, 12);
    expect(r.outputs.pEs).toBeCloseTo(41.6, 12);
    expect(r.outputs.pTasarim).toBeCloseTo(52, 12);
    expect(r.outputs.iEs).toBeCloseTo(41.6 / 24, 12);
    expect(r.outputs.iTasarim).toBeCloseTo(52 / 24, 12);
    expect(r.outputs.iKaynak).toBe(2.5);
    expect(r.outputs.yuklenme).toBeCloseTo(41.6 / 24 / 2.5, 12);
  });

  it("akım modu: 500; 250; 250; 420; 750 mA → ΣI = 2,17 A, ΣP = 52,08 W → 2,5 A", () => {
    const r = compute({ mod: "akim", yukAkim: [0.5, 0.25, 0.25, 0.42, 0.75] });
    expect(r.outputs.pToplam).toBeCloseTo(52.08, 12);
    expect(r.outputs.iTasarim).toBeCloseTo(2.17, 12);
    expect(r.outputs.iKaynak).toBe(2.5);
  });

  it("tam sınırda bir üst değere atlamaz: 48 W · 1,25 = 60 W → 2,5 A → 2,5 A kaynak", () => {
    expect(compute({ yukGuc: [48], kr: 1.25 }).outputs.iKaynak).toBe(2.5);
    expect(compute({ yukGuc: [60.01] }).outputs.iKaynak).toBe(3.2);
  });

  it("listedeki en küçük ve en büyük değerler: 10 W → 0,63 A; 960 W → 40 A", () => {
    expect(compute({ yukGuc: [10] }).outputs.iKaynak).toBe(0.63);
    expect(compute({ yukGuc: [960] }).outputs.iKaynak).toBe(40);
  });

  it("40 A'yı aşan yükte önerilen kaynak gösterilmez, uyarı verilir", () => {
    const r = compute({ yukGuc: [1000] });
    expect(r.outputs.iTasarim).toBeCloseTo(1000 / 24, 12);
    expect(r.outputs).not.toHaveProperty("iKaynak");
    expect(r.outputs).not.toHaveProperty("yuklenme");
    expect(r.checks.filter((c) => c.level === "uyari")).toHaveLength(1);
    expect(r.checks[0].message).toMatch(/40 A/);
  });

  it("tipik kaynak listesi artan sırada", () => {
    for (let i = 1; i < TIPIK_KAYNAK_AKIMLARI.length; i++) {
      expect(TIPIK_KAYNAK_AKIMLARI[i]).toBeGreaterThan(TIPIK_KAYNAK_AKIMLARI[i - 1]);
    }
  });
});

describe("IEC 61131-2 besleme toleransı", () => {
  it("config: 24 V, −%15 = 20,4 V, +%20 = 28,8 V", () => {
    const b = LIMITS.otomasyon.besleme24V;
    expect(b.anma).toBe(24);
    expect(b.min).toBeCloseTo(24 * 0.85, 12);
    expect(b.max).toBeCloseTo(24 * 1.2, 12);
  });

  it("yük gerilimi girilmezse aralık bilgisi verilir", () => {
    const r = compute({ yukGuc: [50] });
    const bilgi = r.checks.find((c) => c.reference?.standard === "IEC 61131-2");
    expect(bilgi).toMatchObject({ level: "ok" });
    expect(bilgi?.message).toMatch(/20,4 V.*28,8 V/);
  });

  it("yük gerilimi denetlenir: 20,4 V ve 28,8 V dahil, dışı uyarı", () => {
    const seviye = (u: number) => compute({ yukGuc: [50], uYuk: u }).checks.find((c) => c.reference?.standard === "IEC 61131-2")?.level;
    expect(seviye(21)).toBe("ok");
    expect(seviye(20.4)).toBe("ok");
    expect(seviye(28.8)).toBe("ok");
    expect(seviye(20.3)).toBe("uyari");
    expect(seviye(29)).toBe("uyari");
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan durum: 2,5 A kaynak", () => {
    const r = runCalc(gucKaynagi24Vdc, defaultState(gucKaynagi24Vdc));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.iKaynak).toBe(2.5);
    expect(r.outputs.find((o) => o.key === "iKaynak")).toMatchObject({ unit: "A", formatted: "2,5 A" });
  });

  it("varsayılan dışı birimler: kW listesi, yüzde eşzamanlılık; akımlar mA cinsinden", () => {
    const r = runCalc(
      gucKaynagi24Vdc,
      state({ yukGuc: ["0,012; 0,006; 0,006; 0,01; 0,018", "kW"], ke: ["80", "percent"], kr: ["1,25"] }),
      { outputUnits: { iEs: "mA" } },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.pTasarim).toBeCloseTo(52, 12);
    expect(r.outputs.find((o) => o.key === "iEs")).toMatchObject({ unit: "mA", value: expect.closeTo(1733.333333, 5) });
  });

  it("akım modu A cinsinden giriş: 1,5 + 2 = 3,5 A → 84 W; listede 3,5 A'nın bir üstü 3,83 A", () => {
    const r = runCalc(gucKaynagi24Vdc, state({ mod: ["akim"], yukAkim: ["1,5; 2", "A"], ke: ["1"], kr: ["1"] }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.pToplam).toBeCloseTo(84, 12);
    expect(r.result.outputs.iKaynak).toBe(3.83);
  });

  it("geçersiz katsayılar ve sıfır yük reddedilir", () => {
    const ke = runCalc(gucKaynagi24Vdc, state({ ke: ["1,1"] }));
    expect(ke.ok).toBe(false);
    if (!ke.ok) expect(Object.keys(ke.fieldErrors)).toEqual(["ke"]);
    const kr = runCalc(gucKaynagi24Vdc, state({ kr: ["0,9"] }));
    expect(kr.ok).toBe(false);
    if (!kr.ok) expect(Object.keys(kr.fieldErrors)).toEqual(["kr"]);
    const sifir = runCalc(gucKaynagi24Vdc, state({ yukGuc: ["0; 0", "W"] }));
    expect(sifir.ok).toBe(false);
    if (!sifir.ok) expect(sifir.checks[0].level).toBe("hata");
  });
});

describe("tanım", () => {
  it("yük girişi moduna göre liste girdisi", () => {
    const keys = (mod: string) =>
      visibleInputs(gucKaynagi24Vdc, { ...defaultState(gucKaynagi24Vdc), mod: { value: mod } }).map((i) => i.key);
    expect(keys("guc")).toContain("yukGuc");
    expect(keys("guc")).not.toContain("yukAkim");
    expect(keys("akim")).toContain("yukAkim");
    expect(keys("akim")).not.toContain("yukGuc");
  });

  it("adımlar KaTeX strict'ten geçer (uzun liste kısaltılır)", () => {
    const uzun = compute({ yukGuc: [1, 2, 3, 4, 5, 6, 7, 8], ke: 0.9, kr: 1.2, uYuk: 22 });
    expect(uzun.steps[0].latex).toContain("\\ldots");
    const akim = compute({ mod: "akim", yukAkim: [0.02, 0.5] });
    for (const f of gucKaynagi24Vdc.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const s of [...uzun.steps, ...akim.steps]) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });
});
