/**
 * Uçtan uca test: gerçek birim sistemiyle (mock yok) motor + kayıt defteri + pilot hesap.
 *
 * Not: Birim sistemi (W1) birleşene kadar `@/lib/units` stub'dır ve fırlattığı için bu dosya
 * başarısız olur; bu beklenen durumdur, atlanmamalıdır.
 * Biçim ayrıntısına (bilimsel gösterim eşiği, boşluk karakteri) bağlanılmaz; yalnız sözleşmenin
 * garanti ettiği şeyler denetlenir.
 */
import { describe, expect, it } from "vitest";
import { getUnit, siUnit } from "@/lib/units";
import { defaultState, runCalc } from "./engine";
import { allCalcs } from "./registry";
import { ohmYasasi } from "./defs/temel-elektrik/ohm-yasasi";
import { renderStrict } from "./test-utils/katex";
import type { InputState, RunResult } from "./types";

function expectOk(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

describe("Ohm yasası, gerçek birimlerle", () => {
  it("12 V ve 2 kΩ → 6 mA", () => {
    const state: InputState = {
      mod: { value: "V-R" },
      V: { value: "12", unit: "V" },
      R: { value: "2", unit: "kohm" },
    };
    const r = expectOk(runCalc(ohmYasasi, state, { outputUnits: { I: "mA" } }));
    expect(r.inputsSI).toEqual({ mod: "V-R", V: 12, R: 2000 });

    const I = r.outputs.find((o) => o.key === "I");
    expect(I?.unit).toBe("mA");
    expect(I?.value).toBeCloseTo(6, 9);
    expect(I?.formatted).toMatch(/^6\s*mA$/);

    const P = r.outputs.find((o) => o.key === "P");
    expect(P?.unit).toBe("W");
    expect(P?.value).toBeCloseTo(0.072, 12);
  });

  it("ondalık virgülle girilen değer doğru okunur", () => {
    const r = expectOk(
      runCalc(ohmYasasi, {
        mod: { value: "P-V" },
        P: { value: "0,1", unit: "kW" },
        V: { value: "230", unit: "V" },
      }),
    );
    expect(r.result.outputs.R).toBeCloseTo(529, 9);
    expect(r.result.outputs.I).toBeCloseTo(0.4348, 4);
  });

  it("varsayılan durum geçerli bir hesap üretir", () => {
    expectOk(runCalc(ohmYasasi, defaultState(ohmYasasi)));
  });

  it("adımlar gerçek sayı biçimiyle KaTeX'te hatasız işlenir", () => {
    const cases: InputState[] = [
      { mod: { value: "V-R" }, V: { value: "12", unit: "V" }, R: { value: "2", unit: "kohm" } },
      { mod: { value: "V-I" }, V: { value: "-12", unit: "V" }, I: { value: "-2", unit: "A" } },
      { mod: { value: "I-R" }, I: { value: "1e-9", unit: "A" }, R: { value: "1e9", unit: "ohm" } },
      { mod: { value: "P-I" }, P: { value: "12345678", unit: "W" }, I: { value: "0,0003", unit: "A" } },
      { mod: { value: "P-R" }, P: { value: "50", unit: "W" }, R: { value: "2", unit: "ohm" } },
    ];
    for (const state of cases) {
      const r = expectOk(runCalc(ohmYasasi, state));
      for (const s of r.result.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
    }
  });
});

describe("kayıtlı hesapların birim kimlikleri", () => {
  it("her girdi/çıktı birimi gerçek birim sisteminde var ve boyutu doğru", () => {
    for (const def of allCalcs()) {
      const specs = [...def.inputs.flatMap((i) => (i.kind === "number" ? [i] : [])), ...def.outputs];
      for (const spec of specs) {
        const where = `${def.slug}.${spec.key}`;
        for (const id of [spec.defaultUnit, ...(spec.units ?? [])]) {
          expect(getUnit(id).dimension, `${where}: ${id}`).toBe(spec.dimension);
        }
        expect(() => siUnit(spec.dimension), where).not.toThrow();
      }
    }
  });
});
