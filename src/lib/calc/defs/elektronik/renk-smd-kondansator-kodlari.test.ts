/**
 * 4.5 Direnç renk kodu, SMD ve kondansatör kodları testleri (gerçek birim sistemiyle).
 * Beklenen değerler kaynaklardaki çözümlü örneklerden (URL'ler kod-ortak.ts'te) ve elle hesaptan:
 * - TT TN004 Example 1: 5 bant "4 7 0 x100 1% = 47K 1%" (sarı, mor, siyah, kırmızı, kahverengi).
 * - TT TN004 Example 3: 4 bant "8 2 x1K 5% = 82K 5%" (gri, kırmızı, turuncu, altın).
 * - Vishay 20020: 6. bant kahverengi = ±100 ppm/K, mor = ±5 ppm/K; tolerans renkleri; çip direnç tablosu.
 * - Bourns CR: "10C (Value = 12.4K Ω)", "4422 (Value = 44.2K Ω)", "103 (Value = 10K Ω)".
 * - KEMET C0G: 229 = 2,2 pF, 508 = 0,5 pF; B = ±0,10 pF; Y5V: Z = +%80/−%20. Vishay 45171: 104 = 100 nF, J = %5.
 * Elle: 4,7 kΩ ±%5 → 4465 Ω … 4935 Ω; 47 kΩ ±%1 → 46,53 … 47,47 kΩ; 100 nF Z → 80 … 180 nF.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { ComputeInputs, InputState, SelectInputSpec } from "@/lib/calc/types";
import { renkSmdKondansatorKodlari as def } from "./renk-smd-kondansator-kodlari";

const ctx = defaultContext();

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

function sel(values: Record<string, string>): InputState {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v }]));
}

const RENK: ComputeInputs = { mod: "renk", bant: "4", b1: "sari", b2: "mor", carpan: "kirmizi", tol: "altin" };

function bilgi(checks: { message: string }[], parca: string): string {
  const c = checks.find((x) => x.message.includes(parca));
  if (!c) throw new Error(`mesaj yok: ${parca} — ${JSON.stringify(checks)}`);
  return c.message;
}

describe("renk bantları", () => {
  it("varsayılan 4 bant Sarı–Mor–Kırmızı–Altın = 4,7 kΩ ±%5 → 4465 … 4935 Ω", () => {
    const r = def.compute(RENK, ctx);
    expect(r.outputs.R).toBe(4700);
    expect(r.outputs.tol).toBe(0.05);
    expect(r.outputs.Rmin).toBeCloseTo(4465, 9);
    expect(r.outputs.Rmax).toBeCloseTo(4935, 9);
    expect(r.outputs.tcr).toBeUndefined();
    expect(bilgi(r.checks, "Bantlar")).toBe(
      "Bantlar (soldan sağa): Sarı (4) – Mor (7) – Kırmızı (×100) – Altın (±%5) → 4,7 kΩ ±%5.",
    );
    expect(r.checks.find((c) => c.message.includes("E6 serisinde"))?.level).toBe("ok");
  });

  it("TT TN004 Example 3: 4 bant gri–kırmızı–turuncu–altın = 82 kΩ ±%5", () => {
    const r = def.compute({ ...RENK, b1: "gri", b2: "kirmizi", carpan: "turuncu" }, ctx);
    expect(r.outputs.R).toBe(82000);
    expect(r.outputs.tol).toBe(0.05);
  });

  it("TT TN004 Example 1: 5 bant sarı–mor–siyah–kırmızı–kahverengi = 47 kΩ ±%1", () => {
    const r = def.compute({ ...RENK, bant: "5", b3: "siyah", tol: "kahverengi" }, ctx);
    expect(r.outputs.R).toBe(47000);
    expect(r.outputs.tol).toBe(0.01);
    expect(r.outputs.Rmin).toBeCloseTo(46530, 9);
    expect(r.outputs.Rmax).toBeCloseTo(47470, 9);
  });

  it("6 bant: kahverengi TCR = 100 ppm/K; 1 kΩ (kahverengi–siyah–siyah–kahverengi) ±%0,1 mor", () => {
    const r = def.compute(
      { ...RENK, bant: "6", b1: "kahverengi", b2: "siyah", b3: "siyah", carpan: "kahverengi", tol: "mor", tcr: "kahverengi" },
      ctx,
    );
    expect(r.outputs.R).toBe(1000);
    expect(r.outputs.tol).toBeCloseTo(0.001, 15);
    expect(r.outputs.tcr).toBeCloseTo(100e-6, 15);
    expect(bilgi(r.checks, "Bantlar")).toContain("Kahverengi (100 ppm/K)");
    expect(bilgi(r.checks, "Bantlar")).toContain("±100 ppm/K");
  });

  it("altın ve gümüş çarpan: sarı–mor–altın = 4,7 Ω; kırmızı–kırmızı–gümüş = 0,22 Ω", () => {
    expect(def.compute({ ...RENK, carpan: "altin" }, ctx).outputs.R).toBe(4.7);
    expect(def.compute({ ...RENK, b1: "kirmizi", b2: "kirmizi", carpan: "gumus" }, ctx).outputs.R).toBe(0.22);
  });

  it("tolerans bandı yok → ±%20; beyaz çarpan ×10⁹", () => {
    const r = def.compute({ ...RENK, tol: "yok", carpan: "beyaz" }, ctx);
    expect(r.outputs.tol).toBe(0.2);
    expect(r.outputs.R).toBe(47e9);
    expect(bilgi(r.checks, "Bantlar")).toContain("tolerans bandı yok");
  });

  it("E serisinde olmayan değer → bant yönü uyarısı (TT TN004)", () => {
    // 9,7 kΩ (beyaz–mor–kırmızı) hiçbir E serisinde yok
    const r = def.compute({ ...RENK, b1: "beyaz" }, ctx);
    const u = r.checks.find((c) => c.level === "uyari");
    expect(u?.message).toContain("Bant sırasını kontrol edin");
    expect(u?.reference?.standard).toBe("TT Electronics TN004");
  });

  it("4,75 kΩ (5 bant sarı–mor–yeşil–kahverengi) E96 serisinde (E48'de 464 ve 487 var, 475 yok)", () => {
    const r = def.compute({ ...RENK, bant: "5", b3: "yesil", carpan: "kahverengi" }, ctx);
    expect(r.outputs.R).toBe(4750);
    expect(r.checks.find((c) => c.level === "ok" && c.message.includes("E96 serisinde"))).toBeTruthy();
  });

  it("ilk bantta siyah ve rakam bantlarında altın/gümüş sunulmaz", () => {
    const opts = (key: string) => (def.inputs.find((i) => i.key === key) as SelectInputSpec).options.map((o) => o.value);
    expect(opts("b1")).not.toContain("siyah");
    for (const key of ["b1", "b2", "b3"]) {
      expect(opts(key)).not.toContain("altin");
      expect(opts(key)).not.toContain("gumus");
    }
    expect(opts("b2")).toHaveLength(10);
    expect((def.inputs.find((i) => i.key === "b1") as SelectInputSpec).options[3].label).toBe("Sarı (4)");
  });
});

describe("SMD direnç kodu", () => {
  const SMD: ComputeInputs = { mod: "smd", tip: "3", s3_1: "4", s3_2: "7", s3_3: "2" };

  it("472 = 4,7 kΩ; tolerans çıktısı yok, kod mesajı var", () => {
    const r = def.compute(SMD, ctx);
    expect(r.outputs).toEqual({ R: 4700 });
    expect(bilgi(r.checks, "Kod 472")).toContain("4,7 kΩ");
  });

  it("4R7 = 4,7 Ω, R47 = 0,47 Ω, 103 = 10 kΩ (Bourns)", () => {
    expect(def.compute({ ...SMD, s3_2: "R", s3_3: "7" }, ctx).outputs.R).toBe(4.7);
    expect(def.compute({ ...SMD, s3_1: "R", s3_2: "4", s3_3: "7" }, ctx).outputs.R).toBe(0.47);
    expect(def.compute({ ...SMD, s3_1: "1", s3_2: "0", s3_3: "3" }, ctx).outputs.R).toBe(10000);
  });

  it("4 karakter: 4422 = 44,2 kΩ (Bourns), 34R8 = 34,8 Ω (TT), 10L0 = 10 mΩ (Vishay)", () => {
    const S4 = { mod: "smd", tip: "4" };
    expect(def.compute({ ...S4, s4_1: "4", s4_2: "4", s4_3: "2", s4_4: "2" }, ctx).outputs.R).toBe(44200);
    expect(def.compute({ ...S4, s4_1: "3", s4_2: "4", s4_3: "R", s4_4: "8" }, ctx).outputs.R).toBeCloseTo(34.8, 12);
    expect(def.compute({ ...S4, s4_1: "1", s4_2: "0", s4_3: "L", s4_4: "0" }, ctx).outputs.R).toBeCloseTo(0.01, 15);
  });

  it("EIA-96: 10C = 12,4 kΩ (Bourns), 07B = 1,15 kΩ (TT)", () => {
    expect(def.compute({ mod: "smd", tip: "eia96", eia_kod: 10, eia_harf: "C" }, ctx).outputs.R).toBe(12400);
    expect(def.compute({ mod: "smd", tip: "eia96", eia_kod: 7, eia_harf: "B" }, ctx).outputs.R).toBe(1150);
  });

  it("varsayılan dışı birimler (runCalc): 01C kΩ ile, 10L0 mΩ ile", () => {
    const r = run(sel({ mod: "smd", tip: "eia96" }), { R: "kohm" });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.find((o) => o.key === "R")).toMatchObject({ unit: "kohm", formatted: "10 kΩ" });

    const r2 = run({ ...sel({ mod: "smd", tip: "eia96", eia_harf: "Z" }), eia_kod: { value: "96", unit: "unitless" } }, { R: "mohm" });
    if (!r2.ok) throw new Error(JSON.stringify(r2));
    expect(r2.outputs.find((o) => o.key === "R")).toMatchObject({ unit: "mohm", formatted: "976 mΩ" });
  });

  it("iki ondalık işareti validate'te hata verir", () => {
    const r = run(sel({ mod: "smd", tip: "3", s3_1: "R", s3_2: "R" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.checks[0]).toMatchObject({ level: "hata", message: expect.stringContaining("bir ondalık işareti") });
    const r4 = run(sel({ mod: "smd", tip: "4", s4_1: "R", s4_3: "L" }));
    expect(r4.ok).toBe(false);
  });

  it("EIA-96 kodu 1–96 dışı alan hatası verir", () => {
    const r = run({ ...sel({ mod: "smd", tip: "eia96" }), eia_kod: { value: "97", unit: "unitless" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.eia_kod).toBeTruthy();
  });

  it("000 = 0 Ω köprü; 478 Vishay tablosunun dışında uyarı", () => {
    const r = def.compute({ ...SMD, s3_1: "0", s3_2: "0", s3_3: "0" }, ctx);
    expect(r.outputs.R).toBe(0);
    expect(bilgi(r.checks, "köprü")).toContain("0 Ω");
    const u = def.compute({ ...SMD, s3_3: "8" }, ctx).checks.filter((c) => c.level === "uyari");
    expect(u.some((c) => c.message.includes("107–917"))).toBe(true);
  });
});

describe("kondansatör kodu", () => {
  const K: ComputeInputs = { mod: "kondansator", k1: "1", k2: "0", k3: "4", ktol: "J" };

  it("104J = 100 nF ±%5 → 95 … 105 nF (Vishay 45171)", () => {
    const r = def.compute(K, ctx);
    expect(r.outputs.C).toBeCloseTo(100e-9, 20);
    expect(r.outputs.tolC).toBe(0.05);
    expect(r.outputs.Cmin).toBeCloseTo(95e-9, 20);
    expect(r.outputs.Cmax).toBeCloseTo(105e-9, 20);
    expect(r.outputs.tolCabs).toBeUndefined();
    expect(bilgi(r.checks, "Kod 104J")).toBe("Kod 104J → 100 nF (J: ±%5).");
  });

  it("229C = 2,2 pF ±0,25 pF (KEMET); 508 = 0,5 pF", () => {
    const r = def.compute({ ...K, k1: "2", k2: "2", k3: "9", ktol: "C" }, ctx);
    expect(r.outputs.C).toBeCloseTo(2.2e-12, 25);
    expect(r.outputs.tolCabs).toBeCloseTo(0.25e-12, 25);
    expect(r.outputs.Cmin).toBeCloseTo(1.95e-12, 25);
    expect(r.outputs.Cmax).toBeCloseTo(2.45e-12, 25);
    expect(r.outputs.tolC).toBeUndefined();
    expect(def.compute({ ...K, k1: "5", k2: "0", k3: "8", ktol: "yok" }, ctx).outputs.C).toBeCloseTo(0.5e-12, 25);
  });

  it("106Z = 10 µF +%80/−%20 → 8 … 18 µF; yüzde çıktısı yok", () => {
    const r = def.compute({ ...K, k3: "6", ktol: "Z" }, ctx);
    expect(r.outputs.C).toBeCloseTo(10e-6, 18);
    expect(r.outputs.Cmin).toBeCloseTo(8e-6, 18);
    expect(r.outputs.Cmax).toBeCloseTo(18e-6, 18);
    expect(r.outputs.tolC).toBeUndefined();
    expect(bilgi(r.checks, "Kod 106Z")).toContain("+%80 / −%20");
  });

  it("mutlak tolerans kapasitansı aşarsa en küçük değer 0'a kırpılır ve uyarı verilir", () => {
    // 108D: 0,1 pF ±0,5 pF
    const r = def.compute({ ...K, k3: "8", ktol: "D" }, ctx);
    expect(r.outputs.Cmin).toBe(0);
    expect(r.outputs.Cmax).toBeCloseTo(0.6e-12, 25);
    expect(r.checks.some((c) => c.level === "uyari" && c.message.includes("0 alındı"))).toBe(true);
  });

  it("tolerans harfi yoksa yalnız kapasitans; varsayılan dışı birim (runCalc): 47 pF nF ile", () => {
    const r = run(sel({ mod: "kondansator", k1: "4", k2: "7", k3: "0", ktol: "yok" }), { C: "nF" });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.map((o) => o.key)).toEqual(["C"]);
    expect(r.outputs[0]).toMatchObject({ unit: "nF", formatted: "0,047 nF" });
  });
});

describe("ters yön: değerden koda", () => {
  const T: ComputeInputs = { mod: "ters", Rd: 4700, tol: "altin" };
  const mesaj = (r: { checks: { message: string }[] }, bas: string) => bilgi(r.checks, bas);

  it("4,7 kΩ: 4 bant Sarı–Mor–Kırmızı–Altın (47, n = 2); 5 bant Sarı–Mor–Siyah–Kahverengi (470, n = 1); SMD 472, 4701", () => {
    const r = def.compute(T, ctx);
    expect(r.outputs).toMatchObject({ R4: 4700, h4: 47, n4: 2, sapma4: 0, R5: 4700, h5: 470, n5: 1, sapma5: 0 });
    expect(mesaj(r, "4 bant")).toBe("4 bant (soldan sağa): Sarı (4) – Mor (7) – Kırmızı (×100) – Altın (±%5) → 4,7 kΩ ±%5.");
    expect(mesaj(r, "5 bant")).toBe(
      "5 bant (soldan sağa): Sarı (4) – Mor (7) – Siyah (0) – Kahverengi (×10) – Altın (±%5) → 4,7 kΩ ±%5.",
    );
    // 4,7 E96'da yok (464, 475): EIA-96 kodu yok
    expect(mesaj(r, "SMD kodları")).toBe("SMD kodları: 3 karakter 472; 4 karakter 4701; EIA-96 tam gösterilemez.");
  });

  it("4,75 kΩ: 4 bant 4,8 kΩ'a yuvarlanır (+%1,053); 5 bant 475·10; EIA-96 66B (TT TN004 satır 66: 4K75)", () => {
    const r = def.compute({ ...T, Rd: 4750 }, ctx);
    expect(r.outputs.R4).toBe(4800);
    expect(r.outputs.h4).toBe(48);
    expect(r.outputs.sapma4).toBeCloseTo(50 / 4750, 12);
    expect(r.outputs).toMatchObject({ R5: 4750, h5: 475, n5: 1, sapma5: 0 });
    expect(mesaj(r, "4 bant")).toContain("sapma %1,053");
    expect(mesaj(r, "SMD kodları")).toBe("SMD kodları: 3 karakter tam gösterilemez; 4 karakter 4751; EIA-96 66B.");
  });

  it("12,4 kΩ → EIA-96 10C (Bourns); 1 MΩ → 105, 1004, 01E; Kahverengi–Siyah–Yeşil", () => {
    expect(mesaj(def.compute({ ...T, Rd: 12400 }, ctx), "SMD kodları")).toContain("EIA-96 10C");
    const r = def.compute({ ...T, Rd: 1e6 }, ctx);
    expect(mesaj(r, "SMD kodları")).toBe("SMD kodları: 3 karakter 105; 4 karakter 1004; EIA-96 01E.");
    expect(mesaj(r, "4 bant")).toContain("Kahverengi (1) – Siyah (0) – Yeşil (×100 k)");
  });

  it("0,47 Ω: 4 bant Sarı–Mor–Gümüş; 5 bantla gösterilemez (çarpan 10⁻³ yok); SMD R47, R470", () => {
    const r = def.compute({ ...T, Rd: 0.47 }, ctx);
    expect(r.outputs).toMatchObject({ h4: 47, n4: -2 });
    expect(r.outputs.R5).toBeUndefined();
    expect(mesaj(r, "4 bant")).toContain("Gümüş (×0,01)");
    expect(mesaj(r, "5 bantla gösterilemez")).toBeTruthy();
    expect(mesaj(r, "SMD kodları")).toBe("SMD kodları: 3 karakter R47; 4 karakter R470; EIA-96 tam gösterilemez.");
  });

  it("47,5 mΩ: renk koduyla gösterilemez; 4 karakter 47L5 (Vishay L işareti)", () => {
    const r = def.compute({ ...T, Rd: 0.0475 }, ctx);
    expect(r.outputs.R4).toBeUndefined();
    expect(r.outputs.R5).toBeUndefined();
    expect(mesaj(r, "SMD kodları")).toBe("SMD kodları: 3 karakter tam gösterilemez; 4 karakter 47L5; EIA-96 tam gösterilemez.");
  });

  it("birim çevirisi artığı sapma sayılmaz: 0,23 kΩ ve 470 mΩ girdide sapma tam 0", () => {
    for (const [value, unit] of [
      ["0,23", "kohm"],
      ["470", "mohm"],
    ]) {
      const r = run({ mod: { value: "ters" }, Rd: { value, unit } });
      if (!r.ok) throw new Error(JSON.stringify(r));
      expect(r.result.outputs.sapma4, `${value} ${unit}`).toBe(0);
      expect(r.result.checks.some((c) => c.message.includes("sapma"))).toBe(false);
    }
  });

  it("E serisinde olmayan değer: ters kipte 'kodu kontrol edin' yerine değer uyarısı", () => {
    const u = def.compute({ ...T, Rd: 5000 }, ctx).checks.find((c) => c.level === "uyari");
    expect(u?.message).toContain("standart (E serisi) bir direnç değeri değil");
    expect(u?.message).not.toContain("Kodu kontrol edin");
  });

  it("varsayılan dışı birim (runCalc): 2,2 MΩ girdi, 4 bant değeri kΩ ile", () => {
    const r = run({ mod: { value: "ters" }, Rd: { value: "2,2", unit: "Mohm" } }, { R4: "kohm" });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.find((o) => o.key === "R4")).toMatchObject({ unit: "kohm", formatted: "2200 kΩ" });
    expect(r.outputs.find((o) => o.key === "h4")?.formatted).toBe("22");
    expect(r.outputs.find((o) => o.key === "n4")?.formatted).toBe("5");
  });
});

describe("seçim kombinasyonları (kombinasyon testi 'hata'sız sonuç ister)", () => {
  const selects = def.inputs.filter((i): i is SelectInputSpec => i.kind === "select");
  const controllerKeys = new Set(def.inputs.flatMap((i) => (i.visibleWhen ? [i.visibleWhen.key] : [])));
  const controllers = selects.filter((s) => controllerKeys.has(s.key));
  const others = selects.filter((s) => !controllerKeys.has(s.key));

  it("görünürlüğü yöneten select'ler mod, bant sayısı ve SMD biçimidir", () => {
    expect(controllers.map((s) => s.key)).toEqual(["mod", "bant", "tip"]);
  });

  it("her mod × bant sayısı × SMD biçiminde diğer her select'in her seçeneği geçerli ve hatasız sonuç verir", () => {
    let bases: InputState[] = [{}];
    for (const c of controllers) bases = bases.flatMap((b) => c.options.map((o) => ({ ...b, [c.key]: { value: o.value } })));
    expect(bases).toHaveLength(36);
    let n = 0;
    for (const base of bases) {
      for (const s of [undefined, ...others]) {
        for (const o of s ? s.options : [undefined]) {
          const state = { ...defaultState(def), ...base, ...(s && o ? { [s.key]: { value: o.value } } : {}) };
          const r = runCalc(def, state);
          if (!r.ok) throw new Error(`${JSON.stringify(base)} ${s?.key}=${o?.value}: ${JSON.stringify(r)}`);
          expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
          expect(r.outputs.length).toBeGreaterThan(0);
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(36 * 100);
  });
});
