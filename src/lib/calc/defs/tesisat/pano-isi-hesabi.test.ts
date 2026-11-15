/**
 * 2.8 Pano ısı hesabı testleri (gerçek birim sistemiyle).
 *
 * Kaynaklı örnek: Schneider Electric muhafaza kataloğu (electrika.com sayfa 691–692): NSYSF20840, H = 2000, W = 800,
 *   D = 400 mm, duvara monte → S = 4,13 m²; P_d = 800 W, K = 5,5, T_e,maks = 35 °C, T_s,maks = 40 °C →
 *   klima P = 800 − 5,5·4,13·(40 − 35) ≈ 690 W. Elle: A = 1,4·0,8·2,4 + 1,8·0,4·2 = 4,128 m²; Q_S = 5,5·4,128·5 = 113,52 W;
 *   Q_K = 686,48 W; fan (net) V = 3,1·686,48/5 = 425,62 m³/h; Rittal biçimi üst sınır 3,1·800/5 = 496 m³/h;
 *   doğal soğutmada ΔT = 800/(5,5·4,128) = 35,24 K → T_i = 70,24 °C.
 * Diğer montaj şekilleri (2000×800×400, elle): serbest 4,768; sıra başı serbest 4,448; sıra başı duvar 3,808;
 *   sıra ortası serbest 4,128; sıra ortası duvar 3,488; üstü kapalı 3,264 m².
 * f katsayısı (Rittal, config): 3,1 … 3,5 m³·K/(W·h).
 */
import { describe, expect, it } from "vitest";
import { defaultContext, defaultState, runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { panoIsiHesabi as def } from "./pano-isi-hesabi";

const ctx = defaultContext();
const M3H = 1 / 3600;
const T0 = 273.15;

const BASE = { montaj: "duvar", H: 2, W: 0.8, D: 0.4, malzeme: "sac", P: 800, Tu: T0 + 35, Ti: T0 + 40, rakim: "r100" };

function run(state: InputState) {
  const r = runCalc(def, { ...defaultState(def), ...state });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

describe("Schneider örneği (varsayılan girdiler)", () => {
  it("A = 4,13 m², klima ≈ 690 W (686,48 W), fan 425,6 m³/h, doğal soğutmada 70,24 °C", () => {
    const r = run({});
    const o = r.result.outputs;
    expect(o.A).toBeCloseTo(4.128, 9);
    expect(o.Qs).toBeCloseTo(113.52, 9);
    expect(o.Qklima).toBeCloseTo(686.48, 9);
    expect(o.V / M3H).toBeCloseTo(425.6176, 6);
    expect(o.dT).toBeCloseTo(35.23608, 5);
    expect(o.TiDogal - T0).toBeCloseTo(70.23608, 5);
    expect(r.result.checks.some((c) => c.level === "uyari" && /Doğal soğutma yetmez/.test(c.message))).toBe(true);
    expect(r.result.checks.some((c) => /üst sınır 496 m³\/sa/.test(c.message))).toBe(true);
  });
});

describe("montaj şekilleri (IEC 890 katsayıları)", () => {
  it.each([
    ["serbest", 4.768],
    ["duvar", 4.128],
    ["sonSerbest", 4.448],
    ["sonDuvar", 3.808],
    ["ortaSerbest", 4.128],
    ["ortaDuvar", 3.488],
    ["ortaDuvarUstKapali", 3.264],
  ])("%s → %f m²", (montaj, area) => {
    expect(def.compute({ ...BASE, montaj }, ctx).outputs.A).toBeCloseTo(area, 9);
  });
});

describe("ısı dengesi durumları", () => {
  it("küçük kayıp: doğal soğutma yeterli, fan ve klima çıktısı yok", () => {
    // 100 W: ΔT = 100/(5,5·4,128) = 4,4045 K → 39,40 °C ≤ 40 °C
    const r = def.compute({ ...BASE, P: 100 }, ctx);
    expect(r.outputs.TiDogal - T0).toBeCloseTo(39.4045, 4);
    expect(r.outputs).not.toHaveProperty("V");
    expect(r.outputs).not.toHaveProperty("Qklima");
    expect(r.checks.some((c) => /Doğal soğutma yeterli/.test(c.message))).toBe(true);
  });

  it("ortam iç sınırdan sıcak (45 °C > 35 °C): fan yok, klima = 800 + 5,5·4,128·10 = 1027,04 W; IEC 61439-1 uyarısı", () => {
    const r = def.compute({ ...BASE, Tu: T0 + 45, Ti: T0 + 35 }, ctx);
    expect(r.outputs.Qklima).toBeCloseTo(1027.04, 9);
    expect(r.outputs).not.toHaveProperty("V");
    expect(r.checks.some((c) => /fan soğutması mümkün değildir/.test(c.message))).toBe(true);
    const w = r.checks.find((c) => c.reference?.standard === "IEC 61439-1");
    expect(w?.level).toBe("uyari");
    expect(w?.message).toMatch(/40 °C/);
  });

  it("yükseklik 750–1000 m: f = 3,5 → 3,5·686,48/5 = 480,54 m³/h", () => {
    expect(def.compute({ ...BASE, rakim: "r1000" }, ctx).outputs.V / M3H).toBeCloseTo(480.536, 6);
  });

  it("IEC 61439-1 bilgi mesajı config değerlerinden", () => {
    const r = def.compute(BASE, ctx);
    const info = r.checks.find((c) => c.reference?.standard === "IEC 61439-1");
    expect(info?.level).toBe("bilgi");
    expect(info?.message).toMatch(/40 °C.*35 °C.*[-−]5 °C.*70 K.*30 K/);
  });
});

describe("varsayılan dışı birimler (runCalc)", () => {
  it("2 m × 80 cm × 400 mm serbest, paslanmaz, 1,2 kW, 303,15 K → 104 °F, 250–500 m", () => {
    // Elle: A = 4,768 m²; k = 3,7; ΔT_izin = 10 K; Q_S = 3,7·4,768·10 = 176,416 W; Q_K = 1023,584 W;
    // V = 3,3·1023,584/10 = 337,78 m³/h; doğal ΔT = 1200/(3,7·4,768) = 68,021 K
    const r = run({
      montaj: { value: "serbest" },
      H: { value: "2", unit: "m" },
      W: { value: "80", unit: "cm" },
      D: { value: "400", unit: "mm" },
      malzeme: { value: "paslanmaz" },
      P: { value: "1,2", unit: "kW" },
      Tu: { value: "303,15", unit: "K" },
      Ti: { value: "104", unit: "degF" },
      rakim: { value: "r500" },
    });
    const o = r.result.outputs;
    expect(o.A).toBeCloseTo(4.768, 9);
    expect(o.Qs).toBeCloseTo(176.416, 6);
    expect(o.Qklima).toBeCloseTo(1023.584, 6);
    expect(o.V / M3H).toBeCloseTo(337.7827, 3);
    expect(o.dT).toBeCloseTo(68.02104, 4);
  });

  it("özel k: 4 W/(m²·K)", () => {
    const r = def.compute({ ...BASE, malzeme: "ozel", kOzel: 4 }, ctx);
    expect(r.outputs.dT).toBeCloseTo(800 / (4 * 4.128), 9);
  });
});
