/**
 * Enerji tüketimi ve maliyet (1.6) testleri — gerçek birim sistemiyle.
 * Beklenen değerler elle hesaptır (E = P·k·t·n, M = c·E).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { InputState, RunResult } from "@/lib/calc/types";
import { enerjiMaliyeti } from "./enerji-tuketimi-maliyet";

const ctx = defaultContext();
const KWH = 3.6e6;

function ok(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

describe("compute (SI)", () => {
  it("2 kW, 8 sa/gün, 30 gün, 4 TL/kWh → 480 kWh, 1920 TL (elle hesap)", () => {
    const r = enerjiMaliyeti.compute({ P: 2000, tGun: 8 * 3600, n: 30, c: 4 / KWH }, ctx);
    expect(r.outputs.E / KWH).toBeCloseTo(480, 9);
    expect(r.outputs.M).toBeCloseTo(1920, 9);
    expect(r.outputs.Egun / KWH).toBeCloseTo(16, 9);
    expect(r.outputs.Mgun).toBeCloseTo(64, 9);
  });

  it("yük oranı %50 enerjiyi ve maliyeti yarıya indirir: 240 kWh, 960 TL", () => {
    const r = enerjiMaliyeti.compute({ P: 2000, tGun: 8 * 3600, n: 30, c: 4 / KWH, k: 0.5 }, ctx);
    expect(r.outputs.E / KWH).toBeCloseTo(240, 9);
    expect(r.outputs.M).toBeCloseTo(960, 9);
  });

  it("100 W ampul, günde 5 sa, 365 gün, 2,5 TL/kWh → 182,5 kWh, 456,25 TL (elle hesap)", () => {
    const r = enerjiMaliyeti.compute({ P: 100, tGun: 5 * 3600, n: 365, c: 2.5 / KWH }, ctx);
    expect(r.outputs.E / KWH).toBeCloseTo(182.5, 9);
    expect(r.outputs.M).toBeCloseTo(456.25, 9);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan durum: 480 kWh, 1920 TL; enerji kWh, maliyet TL gösterilir", () => {
    const r = ok(runCalc(enerjiMaliyeti, defaultState(enerjiMaliyeti)));
    expect(r.outputs.find((o) => o.key === "E")).toMatchObject({ unit: "kWh" });
    expect(r.outputs.find((o) => o.key === "E")?.value).toBeCloseTo(480, 9);
    expect(r.outputs.find((o) => o.key === "M")).toMatchObject({ unit: "TL" });
    expect(r.outputs.find((o) => o.key === "M")?.value).toBeCloseTo(1920, 9);
  });

  it("varsayılan dışı birimler: 2000 W, 480 dk, 400 kr/kWh, %50 → 240 kWh, 960 TL", () => {
    const state: InputState = {
      P: { value: "2000", unit: "W" },
      tGun: { value: "480", unit: "min" },
      n: { value: "30", unit: "unitless" },
      c: { value: "400", unit: "krs_kWh" },
      k: { value: "50", unit: "percent" },
    };
    const r = ok(runCalc(enerjiMaliyeti, state));
    expect(r.result.outputs.E).toBeCloseTo(240 * KWH, 3);
    expect(r.result.outputs.M).toBeCloseTo(960, 9);
  });

  it("büyük tüketim MWh'e geçer: 1 MW, 24 sa, 30 gün → 720 MWh", () => {
    const state: InputState = {
      ...defaultState(enerjiMaliyeti),
      P: { value: "1", unit: "MW" },
      tGun: { value: "24", unit: "h" },
    };
    const r = ok(runCalc(enerjiMaliyeti, state));
    expect(r.outputs.find((o) => o.key === "E")).toMatchObject({ unit: "MWh" });
    expect(r.outputs.find((o) => o.key === "E")?.value).toBeCloseTo(720, 9);
  });

  it("geçersiz girdiler alan hatası verir: 25 sa/gün, 0 gün, kesirli gün, %120 yük oranı", () => {
    const s = defaultState(enerjiMaliyeti);
    const cases: [string, InputState][] = [
      ["tGun", { ...s, tGun: { value: "25", unit: "h" } }],
      ["n", { ...s, n: { value: "0", unit: "unitless" } }],
      ["n", { ...s, n: { value: "2,5", unit: "unitless" } }],
      ["k", { ...s, k: { value: "120", unit: "percent" } }],
      ["P", { ...s, P: { value: "-1", unit: "kW" } }],
    ];
    for (const [key, state] of cases) {
      const r = runCalc(enerjiMaliyeti, state);
      expect(r.ok, key).toBe(false);
      if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual([key]);
    }
  });
});

describe("adımlar", () => {
  it("enerji kartla aynı birimde (kWh), süre saatte, fiyat TL/kWh'te yazılır", () => {
    const r = ok(runCalc(enerjiMaliyeti, defaultState(enerjiMaliyeti)));
    const [gun, toplam, maliyet] = r.result.steps;
    expect(gun.latex).toBe(
      "E_{\\text{gün}} = P \\cdot t_{\\text{gün}} = 2\\,\\mathrm{kW} \\cdot 8\\,\\mathrm{sa} = 16\\,\\mathrm{kWh}",
    );
    expect(toplam.latex).toBe("E = E_{\\text{gün}} \\cdot n = 16\\,\\mathrm{kWh} \\cdot 30 = 480\\,\\mathrm{kWh}");
    expect(maliyet.latex).toBe("M = c \\cdot E = 4\\,\\mathrm{TL}/\\mathrm{kWh} \\cdot 480\\,\\mathrm{kWh} = 1920\\,\\mathrm{TL}");
  });

  it("yük oranı girildiyse adımda görünür; tüm adımlar KaTeX strict'ten geçer", () => {
    const r = ok(runCalc(enerjiMaliyeti, { ...defaultState(enerjiMaliyeti), k: { value: "75", unit: "percent" } }));
    expect(r.result.steps[0].latex).toContain("P \\cdot k \\cdot t_{\\text{gün}}");
    expect(r.result.steps[0].latex).toContain("\\%75");
    for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });
});
