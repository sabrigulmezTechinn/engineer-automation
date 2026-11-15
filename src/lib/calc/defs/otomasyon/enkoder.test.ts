/**
 * Enkoder hesapları (5.2) testleri. Gerçek birim sistemiyle çalışır.
 * Beklenen değerler elle hesaptır (f = PPR·n/60, Δθ = 360°/(PPR·k), n_maks = 60·f_maks/PPR, Δs = p/(PPR·k)).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc, visibleInputs } from "@/lib/calc/engine";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { ComputeInputs, InputState } from "@/lib/calc/types";
import { enkoder } from "./enkoder";

const ctx = defaultContext();
const RPM = (2 * Math.PI) / 60;
const DEG = Math.PI / 180;
const compute = (inputs: Partial<ComputeInputs>) =>
  enkoder.compute({ ppr: 1024, n: 3000 * RPM, k: "4", dogrusal: "yok", ...inputs } as ComputeInputs, ctx);

function state(values: Record<string, [string, string?]>): InputState {
  const s: InputState = { ...defaultState(enkoder) };
  for (const [k, [value, unit]] of Object.entries(values)) s[k] = { value, unit: unit ?? s[k]?.unit };
  return s;
}

describe("elle hesaplanmış değerler", () => {
  it("1024 PPR, 3000 dev/dk → 51,2 kHz; x4 → 4096 sayım/dev, 0,08789°", () => {
    const r = compute({});
    expect(r.outputs.f).toBeCloseTo(51200, 9); // 1024 · 3000 / 60
    expect(r.outputs.fSayim).toBeCloseTo(204800, 9); // 4 · 51 200
    expect(r.outputs.N).toBe(4096);
    expect(r.outputs.cozunurlukAci / DEG).toBeCloseTo(0.087890625, 12); // 360 / 4096
    expect(r.outputs.cozunurlukAci / DEG).toBeCloseTo(0.08789, 5);
  });

  it("x1 ve x2 çözünürlükleri: 360/1024 = 0,3515625°, 360/2048 = 0,17578125°", () => {
    expect(compute({ k: "1" }).outputs.cozunurlukAci / DEG).toBeCloseTo(0.3515625, 12);
    expect(compute({ k: "2" }).outputs.cozunurlukAci / DEG).toBeCloseTo(0.17578125, 12);
    expect(compute({ k: "2" }).outputs.fSayim).toBeCloseTo(102400, 9);
  });

  it("100 kHz sayıcı sınırı, 1024 PPR → 5859,375 dev/dk", () => {
    const r = compute({ fMaks: 100e3 });
    expect(r.outputs.nMaks / RPM).toBeCloseTo(5859.375, 9); // 60 · 100 000 / 1024
    expect(r.checks).toEqual([]);
  });

  it("sınır aşılırsa uyarı: 6000 dev/dk → 102,4 kHz > 100 kHz", () => {
    const r = compute({ n: 6000 * RPM, fMaks: 100e3 });
    expect(r.outputs.f).toBeCloseTo(102400, 9);
    expect(r.checks).toEqual([expect.objectContaining({ level: "uyari" })]);
    expect(r.checks[0].message).toMatch(/102,4 kHz.*100 kHz/);
  });

  it("tam sınırda (5859,375 dev/dk) uyarı yok", () => {
    expect(compute({ n: 5859.375 * RPM, fMaks: 100e3 }).checks).toEqual([]);
  });

  it("vidalı mil 5 mm, x4: Δs = 5/4096 mm = 1,2207 µm; v = 5 mm · 50 dev/s = 250 mm/s", () => {
    const r = compute({ dogrusal: "vida", hatve: 0.005 });
    expect(r.outputs.cozunurlukDogrusal).toBeCloseTo(0.005 / 4096, 15);
    expect(r.outputs.v).toBeCloseTo(0.25, 12);
  });

  it("kasnak çevresi 200 mm, 500 PPR, x2, 120 dev/dk: Δs = 0,2 mm; v = 400 mm/s", () => {
    const r = compute({ ppr: 500, k: "2", n: 120 * RPM, dogrusal: "kasnak", cevre: 0.2 });
    expect(r.outputs.cozunurlukDogrusal).toBeCloseTo(0.0002, 15);
    expect(r.outputs.v).toBeCloseTo(0.4, 12);
  });

  it("doğrusal hareket yoksa doğrusal çıktılar ve sayıcı sınırı verilmezse n_maks yok", () => {
    const r = compute({});
    expect(r.outputs).not.toHaveProperty("cozunurlukDogrusal");
    expect(r.outputs).not.toHaveProperty("v");
    expect(r.outputs).not.toHaveProperty("nMaks");
  });

  it("n = 0 → f = 0", () => {
    expect(compute({ n: 0 }).outputs.f).toBe(0);
  });
});

describe("motor üzerinden (runCalc)", () => {
  it("varsayılan durum: 51,2 kHz kartı otomatik kHz'e geçer", () => {
    const r = runCalc(enkoder, defaultState(enkoder));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.find((o) => o.key === "f")).toMatchObject({ unit: "kHz", value: expect.closeTo(51.2, 12) });
    expect(r.outputs.find((o) => o.key === "cozunurlukAci")).toMatchObject({ unit: "deg" });
    expect(r.outputs.find((o) => o.key === "cozunurlukDogrusal")).toMatchObject({ unit: "um", value: expect.closeTo(1.220703125, 9) });
  });

  it("varsayılan dışı birimler: 50 dev/s, 100 000 Hz sınır, 0,5 cm hatve; n_maks dev/s cinsinden", () => {
    const r = runCalc(
      enkoder,
      state({ n: ["50", "rps"], fMaks: ["100000", "Hz"], hatve: ["0,5", "cm"] }),
      { outputUnits: { nMaks: "rps", v: "m_min" } },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.f).toBeCloseTo(51200, 9);
    expect(r.outputs.find((o) => o.key === "nMaks")).toMatchObject({ unit: "rps", value: expect.closeTo(97.65625, 9) }); // 100 000 / 1024
    expect(r.outputs.find((o) => o.key === "v")).toMatchObject({ unit: "m_min", value: expect.closeTo(15, 12) }); // 5 mm · 3000 dev/dk
  });

  it("rad/s girişi: 100π rad/s = 3000 dev/dk", () => {
    const r = runCalc(enkoder, state({ n: [String(100 * Math.PI).replace(".", ","), "rad_s"] }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.f).toBeCloseTo(51200, 6);
  });

  it("PPR tam sayı ve ≥ 1 olmalı; sayıcı sınırı boş bırakılabilir", () => {
    const frac = runCalc(enkoder, state({ ppr: ["1024,5"] }));
    expect(frac.ok).toBe(false);
    if (!frac.ok) expect(Object.keys(frac.fieldErrors)).toEqual(["ppr"]);
    expect(runCalc(enkoder, state({ ppr: ["0"] })).ok).toBe(false);
    const bos = runCalc(enkoder, state({ fMaks: [""] }));
    if (!bos.ok) throw new Error(JSON.stringify(bos));
    expect(bos.result.outputs).not.toHaveProperty("nMaks");
  });
});

describe("tanım", () => {
  it("doğrusal hareket seçimine göre girdiler", () => {
    const keys = (dogrusal: string) =>
      visibleInputs(enkoder, { ...defaultState(enkoder), dogrusal: { value: dogrusal } })
        .map((i) => i.key)
        .filter((k) => k === "hatve" || k === "cevre");
    expect(keys("yok")).toEqual([]);
    expect(keys("vida")).toEqual(["hatve"]);
    expect(keys("kasnak")).toEqual(["cevre"]);
  });

  it("adımlar KaTeX strict'ten geçer ve f adımı rpm formunu gösterir", () => {
    const r = compute({ fMaks: 100e3, dogrusal: "vida", hatve: 0.005 });
    expect(r.steps[0].latex).toBe(
      "f = \\frac{\\text{PPR} \\cdot n}{60} = \\frac{1024 \\cdot 3000\\,\\mathrm{dev}/\\mathrm{dk}}{60} = 51{,}2\\,\\mathrm{kHz}",
    );
    for (const f of enkoder.formulas) expect(() => renderStrict(f.latex), f.latex).not.toThrow();
    for (const s of r.steps) expect(() => renderStrict(s.latex), s.latex).not.toThrow();
  });
});
