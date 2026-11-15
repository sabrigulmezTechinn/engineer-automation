/**
 * 4.12 Batarya ömrü testleri (gerçek birim sistemiyle).
 * Beklenen değerler elle hesaptır. Kaynak örnekleri:
 * - TI SWRA347a (AN092) §5.5 (https://www.ti.com/lit/an/swra347a/swra347a.pdf): [(1000 ms − 2,675 ms)·0,001 mA +
 *   2,675 ms·8,2463 mA]/1000 ms = 0,0230 mA; 230 mAh / 0,024 mA = 9583 h ≈ 400 gün.
 * - Victron BMV-700 kılavuzu §8 (https://www.victronenergy.com/media/pg/BMV-700/en/battery-capacity-and-peukert-exponent.html):
 *   C5 = 75 Ah, C20 = 100 Ah örneği; Peukert C_p = Iⁿ·t. Üs n = log(20/5)/log(15/5) = log 4/log 3 elle.
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import { LIMITS } from "@/config/sinirlar";
import { latexToSvg } from "@/lib/rapor/latex-svg";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import type { ComputeInputs, InputState, SelectInputSpec } from "@/lib/calc/types";
import { bataryaOmru as def } from "./batarya-omru";

const ctx = defaultContext();
const AH = 3600;
const H = 3600;

const PEUKERT: ComputeInputs = { profil: "sabit", peukert: "var", C: 100 * AH, I: 10, d: 1, k: 1.2, H: 20 * H };

function run(state: InputState, outputUnits?: Record<string, string>) {
  return runCalc(def, { ...defaultState(def), ...state }, { outputUnits });
}

describe("Peukert", () => {
  it("100 Ah, H 20 h, k 1,2, 10 A → 20·0,5^1,2 = 8,7055 h (naif 10 h)", () => {
    // Elle: C/(I·H) = 100/(10·20) = 0,5; t = 20 · 0,5^1,2 = 20 · 0,4352753 = 8,705506 h
    const o = def.compute(PEUKERT, ctx).outputs;
    expect(o.t / H).toBeCloseTo(8.7055, 4);
    expect(o.tNaif / H).toBeCloseTo(10, 12);
    // Kullanılabilir kapasite 10 A · 8,7055 h = 87,055 Ah
    expect(o.Ckul / AH).toBeCloseTo(87.05506, 5);
  });

  it("5 A (anma akımı C/H) → tam 20 h", () => {
    const o = def.compute({ ...PEUKERT, I: 5 }, ctx).outputs;
    expect(o.t / H).toBeCloseTo(20, 12);
  });

  it("Victron örneği: C20 = 100 Ah, k = log4/log3 → 15 A'de 5 h (C5 = 75 Ah) (runCalc, Ah ve A)", () => {
    // Elle: k = ln 4/ln 3 = 1,2618595; t = 20·(100/(15·20))^k = 20·(1/3)^k = 20/4 = 5 h; C_kul = 15·5 = 75 Ah
    const k = Math.log(4) / Math.log(3);
    const r = run(
      {
        peukert: { value: "var" },
        C: { value: "100", unit: "Ah" },
        I: { value: "15", unit: "A" },
        k: { value: String(k).replace(".", ","), unit: "unitless" },
        H: { value: "20", unit: "h" },
      },
      { Ckul: "Ah" },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs.t / H).toBeCloseTo(5, 9);
    expect(r.result.outputs.Ckul / AH).toBeCloseTo(75, 9);
    expect(r.outputs.find((x) => x.key === "Ckul")?.unit).toBe("Ah");
    expect(r.result.checks.some((c) => c.message.includes("kaba bir yaklaşım"))).toBe(true);
  });

  it("kullanılabilir oran süreye uygulanır: d %80 → 0,8·8,7055 = 6,9644 h", () => {
    // Elle: t = d·H·(C/(I·H))^k = 0,8 · 20 · 0,5^1,2 = 6,964405 h (d·C üssün içinde olsaydı 20·0,4^1,2 = 6,66 h olurdu)
    const o = def.compute({ ...PEUKERT, d: 0.8 }, ctx).outputs;
    expect(o.t / H).toBeCloseTo(6.964405, 6);
    expect(o.tNaif / H).toBeCloseTo(8, 12);
  });

  it("anma akımının altında Peukert ömrü Peukert'sizden uzun verir → uyarı", () => {
    // Elle: 1 A, k 1,25: t = 20·5^1,25 = 149,535 h > naif 100 h
    const r = def.compute({ ...PEUKERT, I: 1, k: 1.25 }, ctx);
    expect(r.outputs.t / H).toBeCloseTo(149.5349, 4);
    expect(r.checks.filter((c) => c.level === "uyari")).toHaveLength(1);
    expect(def.compute(PEUKERT, ctx).checks.filter((c) => c.level === "uyari")).toEqual([]);
  });

  it("uyarı kullanılabilir orandan bağımsızdır: d %50, 1 A → 74,767 h (naif 50 h), yine uyarı", () => {
    // Elle: t = 0,5 · 149,5349 = 74,767 h; t_naif = 0,5·100/1 = 50 h (C_kul = 74,8 Ah < 100 Ah olsa da dışdeğerleme)
    const r = def.compute({ ...PEUKERT, I: 1, k: 1.25, d: 0.5 }, ctx);
    expect(r.outputs.t / H).toBeCloseTo(74.76744, 4);
    expect(r.outputs.tNaif / H).toBeCloseTo(50, 12);
    expect(r.checks.filter((c) => c.level === "uyari")).toHaveLength(1);
  });

  it("Peukert varsayılanları config'ten: k 1,25 (Victron kurşun-asit ortalaması), H 20 h", () => {
    expect(LIMITS.elektronikTemel.peukertUssuKursunAsit).toBe(1.25);
    expect(LIMITS.elektronikTemel.peukertAnmaSuresi).toBe(72000);
    const s = defaultState(def);
    expect(s.k.value).toBe("1,25");
    expect(s.H.value).toBe("20");
  });
});

describe("görev döngüsü", () => {
  it("20 mA 100 ms / 10 s, uyku 5 µA → I_ort = 204,95 µA; 2000 mAh ile 9758,5 h (runCalc)", () => {
    // Elle: I_ort = (20 mA·0,1 s + 0,005 mA·9,9 s)/10 s = (2 + 0,0495)/10 mA = 0,20495 mA;
    // t = 2000/0,20495 = 9758,478 h = 406,603 gün; D = %1
    const r = run({
      profil: { value: "dongu" },
      C: { value: "2000", unit: "mAh" },
      Ia: { value: "20", unit: "mA" },
      ta: { value: "100", unit: "ms" },
      Is: { value: "5", unit: "uA" },
      T: { value: "10", unit: "s" },
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = r.result.outputs;
    expect(o.Iort).toBeCloseTo(204.95e-6, 12);
    expect(o.D).toBeCloseTo(0.01, 12);
    expect(o.t / H).toBeCloseTo(9758.5, 1);
    expect(o.tGun / 86400).toBeCloseTo(406.6032, 4);
    const t = r.outputs.find((x) => x.key === "t");
    const tGun = r.outputs.find((x) => x.key === "tGun");
    expect(t?.unit).toBe("h");
    expect(tGun?.unit).toBe("day");
  });

  it("TI AN092 §5.5: 8,2463 mA 2,675 ms, uyku 1 µA, periyot 1000 ms → 0,0230 mA", () => {
    // Elle: [(1000 − 2,675)·0,001 + 2,675·8,2463]/1000 = 0,02305618 mA (kaynak: 0,0230 mA)
    const o = def.compute(
      { profil: "dongu", peukert: "yok", C: 230 * 3.6, Ia: 8.2463e-3, ta: 2.675e-3, Is: 1e-6, T: 1, d: 1 },
      ctx,
    ).outputs;
    // Kaynak sonucu 0,0230 mA olarak kesmiş (0,023056): 3 ondalık basamakta karşılaştırılır
    expect(o.Iort * 1e3).toBeCloseTo(0.023, 3);
    expect(o.Iort).toBeCloseTo(2.3056177e-5, 11);
  });

  it("TI AN092: 230 mAh / 0,024 mA = 9583 h ≈ 400 gün", () => {
    // Elle: 230/0,024 = 9583,33 h = 399,31 gün
    const o = def.compute({ profil: "sabit", peukert: "yok", C: 230 * 3.6, I: 0.024e-3, d: 1 }, ctx).outputs;
    expect(o.t / H).toBeCloseTo(9583.33, 2);
    expect(Math.round(o.tGun / 86400 / 10) * 10).toBe(400);
  });

  it("aktif süre periyottan büyükse hata; akımlar sıfırsa hata", () => {
    const r1 = run({ profil: { value: "dongu" }, ta: { value: "20", unit: "s" }, T: { value: "10", unit: "s" } });
    expect(r1.ok).toBe(false);
    const r2 = run({ profil: { value: "dongu" }, Ia: { value: "0", unit: "mA" }, Is: { value: "0", unit: "uA" } });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.checks.some((c) => c.level === "hata")).toBe(true);
  });
});

describe("öz deşarj ve kullanılabilir oran", () => {
  it("2000 mAh, 100 µA, yıllık %2 öz deşarj → I_öz = 4,566 µA, ömür 19126,6 h", () => {
    // Elle: I_öz = 0,02·2000 mAh/8760 h = 0,00456621 mA; I = 0,10456621 mA; t = 2000/0,10456621 = 19126,64 h
    const r = def.compute({ profil: "sabit", peukert: "yok", C: 2000 * 3.6, I: 100e-6, d: 1, oz: 0.02 }, ctx);
    expect(r.outputs.Ioz).toBeCloseTo(4.56621e-6, 11);
    expect(r.outputs.Itop).toBeCloseTo(104.56621e-6, 11);
    expect(r.outputs.t / H).toBeCloseTo(19126.64, 1);
    expect(r.checks.some((c) => c.message.includes("Öz deşarj"))).toBe(true);
  });

  it("öz deşarjlı adımlar (her profil × Peukert) KaTeX strict ve MathJax'ten geçer (runCalc, varsayılan dışı birimler)", async () => {
    // all-calcs bu dalı görmez (öz deşarj varsayılanda boş)
    for (const profil of ["sabit", "dongu"]) {
      for (const peukert of ["yok", "var"]) {
        const r = run({
          profil: { value: profil },
          peukert: { value: peukert },
          C: { value: "2,4", unit: "Ah" },
          oz: { value: "0,03", unit: "fraction" },
        });
        if (!r.ok) throw new Error(JSON.stringify(r));
        expect(r.result.outputs).toHaveProperty("Ioz");
        for (const s of r.result.steps) {
          expect(() => renderStrict(s.latex), s.latex).not.toThrow();
          expect((await latexToSvg(s.latex)).hata, s.latex).toBe(false);
        }
      }
    }
  });

  it("öz deşarj boşsa I_öz verilmez; varsayılan durumda ömür 2000 mAh/100 mA = 20 h", () => {
    const r = run({});
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.result.outputs).not.toHaveProperty("Ioz");
    expect(r.result.outputs.t / H).toBeCloseTo(20, 12);
    expect(r.result.checks.some((c) => c.message.includes("%100"))).toBe(true);
  });

  it("d %50 (kurşun-asit deşarj tabanı) ömrü yarıya indirir", () => {
    const o = def.compute({ profil: "sabit", peukert: "yok", C: 100 * AH, I: 5, d: 0.5 }, ctx).outputs;
    expect(o.t / H).toBeCloseTo(10, 12);
  });
});

describe("seçim kombinasyonları", () => {
  it("her profil × Peukert seçeneği varsayılan girdilerle hatasız sonuç verir", () => {
    const selects = def.inputs.filter((i): i is SelectInputSpec => i.kind === "select");
    let combos: InputState[] = [{}];
    for (const s of selects) combos = combos.flatMap((c) => s.options.map((o) => ({ ...c, [s.key]: { value: o.value } })));
    expect(combos).toHaveLength(4);
    for (const combo of combos) {
      const r = run(combo);
      if (!r.ok) throw new Error(`${JSON.stringify(combo)}: ${JSON.stringify(r)}`);
      expect(r.result.checks.filter((c) => c.level === "hata")).toEqual([]);
    }
  });
});
