import { describe, expect, it } from "vitest";
import { DIMENSIONS, SI_UNIT_IDS, UNITS } from "./catalog";
import { convert, fromSI, getUnit, siUnit, toSI, unitsFor } from "./index";
import type { Dimension, UnitDef } from "./types";

/** |gerçek − beklenen| ≤ rel · ölçek (ölçek verilmezse |beklenen|) */
function expectClose(actual: number, expected: number, rel = 1e-12, scale = Math.abs(expected)) {
  const tol = rel * scale;
  expect(
    Math.abs(actual - expected),
    `beklenen ${expected}, gelen ${actual} (tolerans ${tol})`,
  ).toBeLessThanOrEqual(tol);
}

/** Ofsetli birimlerde (sıcaklık) yuvarlama hatası ofset büyüklüğüyle ölçeklenir. */
function offsetScale(u: UnitDef): number {
  return Math.abs((u.offset ?? 0) / u.factor);
}

describe("katalog bütünlüğü", () => {
  it("kimlikler benzersiz", () => {
    const ids = UNITS.map((u) => u.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("kimlikler ASCII harf, rakam ve '_'", () => {
    const bad = UNITS.filter((u) => !/^[A-Za-z0-9_]+$/.test(u.id)).map((u) => u.id);
    expect(bad).toEqual([]);
  });

  it("factor > 0 ve sonlu, offset yoksa ya da sonlu; sembol ve ad dolu", () => {
    for (const u of UNITS) {
      expect(Number.isFinite(u.factor) && u.factor > 0, `${u.id} factor`).toBe(true);
      expect(u.offset === undefined || Number.isFinite(u.offset), `${u.id} offset`).toBe(true);
      expect(u.symbol.length > 0 && u.name.length > 0, `${u.id} sembol/ad`).toBe(true);
    }
  });

  it("her birimin boyutu tanımlı bir boyut", () => {
    for (const u of UNITS) expect(DIMENSIONS, u.id).toContain(u.dimension);
  });

  it("aynı boyutta semboller benzersiz", () => {
    for (const d of DIMENSIONS) {
      const symbols = unitsFor(d).map((u) => u.symbol);
      expect(new Set(symbols).size, d).toBe(symbols.length);
    }
  });

  it("her boyutun tam bir SI birimi var: o boyutta, factor 1, ofsetsiz", () => {
    const siIds = DIMENSIONS.map((d) => SI_UNIT_IDS[d]);
    expect(new Set(siIds).size).toBe(DIMENSIONS.length);
    for (const d of DIMENSIONS) {
      const si = siUnit(d);
      expect(si.id, d).toBe(SI_UNIT_IDS[d]);
      expect(si.dimension, d).toBe(d);
      expect(si.factor, d).toBe(1);
      expect(si.offset ?? 0, d).toBe(0);
      expect(unitsFor(d), d).toContain(si);
    }
  });

  it("birimler dondurulmuş; unitsFor kopya döner", () => {
    expect(Object.isFrozen(getUnit("V"))).toBe(true);
    expect(Object.isFrozen(UNITS)).toBe(true);
    const list = unitsFor("gerilim");
    list.pop();
    expect(unitsFor("gerilim").length).toBe(list.length + 1);
  });

  it("istenen birimlerin hepsi doğru boyutta mevcut", () => {
    const required: Record<Dimension, string[]> = {
      boyutsuz: ["unitless"],
      oran: ["fraction", "percent", "permille", "ppm"],
      gerilim: ["uV", "mV", "V", "kV"],
      akim: ["uA", "mA", "A", "kA"],
      direnc: ["mohm", "ohm", "kohm", "Mohm"],
      iletkenlik: ["S", "mS"],
      guc: ["mW", "W", "kW", "MW", "PS", "hp"],
      reaktif_guc: ["var", "kvar", "Mvar"],
      gorunur_guc: ["VA", "kVA", "MVA"],
      enerji: ["J", "kJ", "MJ", "Wh", "kWh", "MWh"],
      yuk: ["C", "mAh", "Ah"],
      frekans: ["Hz", "kHz", "MHz"],
      kapasitans: ["pF", "nF", "uF", "mF", "F"],
      enduktans: ["nH", "uH", "mH", "H"],
      zaman: ["us", "ms", "s", "min", "h", "day"],
      uzunluk: ["um", "mm", "cm", "m", "km", "in", "ft", "mi", "thou"],
      alan: ["mm2", "cm2", "m2"],
      hacim: ["cm3", "L", "m3"],
      kutle: ["g", "kg", "t"],
      sicaklik: ["K", "degC", "degF"],
      sicaklik_farki: ["deltaK", "deltaDegC"],
      basinc: ["Pa", "kPa", "MPa", "bar", "mbar", "psi", "atm", "mmHg"],
      kuvvet: ["N", "kN", "kgf"],
      tork: ["Nm", "kNm", "Ncm", "kgfm", "lbfft", "lbfin"],
      aci: ["rad", "deg"],
      acisal_hiz: ["rad_s", "rpm", "rps"],
      acisal_ivme: ["rad_s2"],
      hiz: ["m_s", "m_min", "km_h"],
      ivme: ["m_s2", "gn"],
      debi: ["m3_s", "m3_h", "L_min", "L_s", "NL_min"],
      atalet: ["kgm2", "kgcm2", "gcm2"],
      ozdirenc: ["ohm_m", "ohm_mm2_m"],
      direnc_uzunluk: ["ohm_per_m", "mohm_per_m", "ohm_per_km"],
      veri_hizi: ["bit_s", "kbit_s", "Mbit_s", "Bd"],
      isil_direnc: ["K_W"],
      isi_transfer_katsayisi: ["W_m2K"],
    };
    for (const d of DIMENSIONS) {
      for (const id of required[d]) expect(getUnit(id).dimension, id).toBe(d);
    }
  });

  it("her birimin SI çarpanı ve ofseti bağımsız tabloyla aynı", () => {
    // [factor, offset]; katalogdaki sabitlerden türetilmeden elle yazılmış değerler
    const expected: Record<string, [number, number?]> = {
      unitless: [1],
      fraction: [1],
      percent: [0.01],
      permille: [0.001],
      ppm: [1e-6],
      uV: [1e-6],
      mV: [1e-3],
      V: [1],
      kV: [1e3],
      uA: [1e-6],
      mA: [1e-3],
      A: [1],
      kA: [1e3],
      mohm: [1e-3],
      ohm: [1],
      kohm: [1e3],
      Mohm: [1e6],
      mS: [1e-3],
      S: [1],
      mW: [1e-3],
      W: [1],
      kW: [1e3],
      MW: [1e6],
      PS: [735.49875],
      hp: [745.6998715822702],
      var: [1],
      kvar: [1e3],
      Mvar: [1e6],
      VA: [1],
      kVA: [1e3],
      MVA: [1e6],
      J: [1],
      kJ: [1e3],
      MJ: [1e6],
      Wh: [3600],
      kWh: [3.6e6],
      MWh: [3.6e9],
      C: [1],
      mAh: [3.6],
      Ah: [3600],
      Hz: [1],
      kHz: [1e3],
      MHz: [1e6],
      pF: [1e-12],
      nF: [1e-9],
      uF: [1e-6],
      mF: [1e-3],
      F: [1],
      nH: [1e-9],
      uH: [1e-6],
      mH: [1e-3],
      H: [1],
      us: [1e-6],
      ms: [1e-3],
      s: [1],
      min: [60],
      h: [3600],
      day: [86400],
      um: [1e-6],
      mm: [1e-3],
      cm: [0.01],
      m: [1],
      km: [1000],
      thou: [2.54e-5],
      in: [0.0254],
      ft: [0.3048],
      mi: [1609.344],
      mm2: [1e-6],
      cm2: [1e-4],
      m2: [1],
      cm3: [1e-6],
      L: [1e-3],
      m3: [1],
      g: [1e-3],
      kg: [1],
      t: [1000],
      K: [1],
      degC: [1, 273.15],
      degF: [0.5555555555555556, 255.37222222222223],
      deltaK: [1],
      deltaDegC: [1],
      deltaDegF: [0.5555555555555556],
      Pa: [1],
      kPa: [1e3],
      MPa: [1e6],
      mbar: [100],
      bar: [1e5],
      mmHg: [133.322387415],
      psi: [6894.757293168361],
      atm: [101325],
      N: [1],
      kN: [1e3],
      kgf: [9.80665],
      mNm: [1e-3],
      Ncm: [0.01],
      Nm: [1],
      kNm: [1e3],
      kgfcm: [0.0980665],
      kgfm: [9.80665],
      lbfin: [0.1129848290276167],
      lbfft: [1.3558179483314004],
      rad: [1],
      deg: [0.017453292519943295],
      arcmin: [0.0002908882086657216],
      rev: [6.283185307179586],
      rad_s: [1],
      rpm: [0.10471975511965977],
      rps: [6.283185307179586],
      rad_s2: [1],
      rpm_s: [0.10471975511965977],
      mm_s: [1e-3],
      m_s: [1],
      m_min: [0.016666666666666666],
      km_h: [0.2777777777777778],
      mm_s2: [1e-3],
      m_s2: [1],
      gn: [9.80665],
      m3_s: [1],
      m3_h: [0.0002777777777777778],
      L_s: [1e-3],
      L_min: [1.6666666666666667e-5],
      NL_min: [1.6666666666666667e-5],
      gcm2: [1e-7],
      kgcm2: [1e-4],
      kgm2: [1],
      ohm_m: [1],
      ohm_mm2_m: [1e-6],
      ohm_per_m: [1],
      mohm_per_m: [1e-3],
      ohm_per_km: [1e-3],
      bit_s: [1],
      kbit_s: [1e3],
      Mbit_s: [1e6],
      Bd: [1],
      K_W: [1],
      degC_W: [1],
      W_m2K: [1],
    };
    expect(Object.keys(expected).sort()).toEqual(UNITS.map((u) => u.id).sort());
    for (const u of UNITS) {
      const [factor, offset = 0] = expected[u.id];
      expectClose(toSI(0, u.id), offset, 1e-12, Math.max(offset, 1e-300));
      expectClose(toSI(1, u.id) - toSI(0, u.id), factor, 1e-12, Math.max(factor, offset * 1e-3));
    }
  });

  it("beygir gücü birimleri ayrı ve adları açık", () => {
    expect(getUnit("PS").name).toMatch(/metrik/);
    expect(getUnit("hp").name).toMatch(/mekanik/);
    expect(getUnit("NL_min").name).toMatch(/normal/);
  });
});

describe("gidiş-dönüş (katalogdaki her birim)", () => {
  const values = [1, -3.7, 1234.5678, 1e-3];

  it("fromSI(toSI(v)) = v", () => {
    for (const u of UNITS) {
      for (const v of values) {
        expectClose(fromSI(toSI(v, u.id), u.id), v, 1e-12, Math.max(Math.abs(v), offsetScale(u)));
      }
    }
  });

  it("aynı boyuttaki her birim çiftinde convert gidiş-dönüşü", () => {
    for (const d of DIMENSIONS) {
      const units = unitsFor(d);
      for (const a of units) {
        for (const b of units) {
          for (const v of values) {
            const back = convert(convert(v, a.id, b.id), b.id, a.id);
            const scale = Math.max(Math.abs(v), offsetScale(a), offsetScale(b));
            expectClose(back, v, 1e-12, scale);
          }
        }
      }
    }
  });

  it("convert, SI üzerinden toSI/fromSI ile tutarlı", () => {
    for (const u of UNITS) {
      const si = siUnit(u.dimension);
      expectClose(convert(2.5, u.id, si.id), toSI(2.5, u.id));
      expectClose(convert(2.5, si.id, u.id), fromSI(2.5, u.id), 1e-12, Math.max(2.5, offsetScale(u)));
    }
  });
});

describe("bilinen dönüşümler", () => {
  it.each<[number, string, string, number]>([
    // enerji ve yük
    [1, "kWh", "MJ", 3.6],
    [1, "kWh", "J", 3.6e6],
    [1, "MWh", "kWh", 1000],
    [1, "Wh", "kJ", 3.6],
    [1, "mAh", "C", 3.6],
    [2, "Ah", "mAh", 2000],
    // basınç
    [1, "bar", "Pa", 1e5],
    [1, "psi", "Pa", 6894.757293168361],
    [1, "atm", "Pa", 101325],
    [1, "mmHg", "Pa", 133.322387415],
    [1000, "mbar", "bar", 1],
    [1, "MPa", "bar", 10],
    // sıcaklık
    [100, "degC", "K", 373.15],
    [100, "degC", "degF", 212],
    [212, "degF", "K", 373.15],
    [0, "K", "degC", -273.15],
    [-40, "degC", "degF", -40],
    [10, "deltaDegC", "deltaK", 10],
    [18, "deltaDegF", "deltaK", 10],
    // dönme
    [1, "rpm", "rad_s", (2 * Math.PI) / 60],
    [60, "rpm", "rps", 1],
    [180, "deg", "rad", Math.PI],
    [1, "rev", "deg", 360],
    [60, "arcmin", "deg", 1],
    [1, "rpm_s", "rad_s2", (2 * Math.PI) / 60],
    // özdirenç, kuvvet, tork
    [1, "ohm_mm2_m", "ohm_m", 1e-6],
    [0.0175, "ohm_mm2_m", "ohm_m", 1.75e-8],
    [1, "kgf", "N", 9.80665],
    [1, "kgfm", "Nm", 9.80665],
    [1, "kgfcm", "Ncm", 9.80665],
    [1, "lbfft", "Nm", 1.3558179483314004],
    [1, "lbfin", "Nm", 0.1129848290276167],
    [1, "kNm", "Nm", 1000],
    [1, "Nm", "mNm", 1000],
    // güç
    [1, "PS", "W", 735.49875],
    [1, "hp", "W", 745.6998715822702],
    [1, "kW", "W", 1000],
    [1, "MW", "kW", 1000],
    [1, "kvar", "var", 1000],
    [1, "MVA", "kVA", 1000],
    // uzunluk, alan, hacim, kütle
    [1, "in", "mm", 25.4],
    [1, "ft", "in", 12],
    [1000, "thou", "in", 1],
    [1, "mi", "m", 1609.344],
    [1, "km", "m", 1000],
    [1, "cm2", "mm2", 100],
    [1, "m2", "mm2", 1e6],
    [1, "L", "cm3", 1000],
    [1, "m3", "L", 1000],
    [1, "t", "kg", 1000],
    [1, "kg", "g", 1000],
    // hız, ivme, debi, atalet
    [36, "km_h", "m_s", 10],
    [60, "m_min", "m_s", 1],
    [1000, "mm_s", "m_s", 1],
    [1, "gn", "m_s2", 9.80665],
    [1, "m3_h", "L_min", 1000 / 60],
    [60, "L_min", "L_s", 1],
    [1, "NL_min", "L_min", 1],
    [1, "kgcm2", "kgm2", 1e-4],
    [1, "gcm2", "kgm2", 1e-7],
    // elektrik
    [1, "kV", "V", 1000],
    [1, "uV", "mV", 1e-3],
    [1, "kA", "mA", 1e6],
    [1, "Mohm", "kohm", 1000],
    [1, "mohm", "ohm", 1e-3],
    [1, "mS", "S", 1e-3],
    [1, "uF", "nF", 1000],
    [1, "pF", "F", 1e-12],
    [1, "mH", "uH", 1000],
    [1, "MHz", "Hz", 1e6],
    // zaman, oran
    [1, "day", "h", 24],
    [1, "h", "min", 60],
    [1, "ms", "us", 1000],
    [50, "percent", "fraction", 0.5],
    [1, "fraction", "ppm", 1e6],
    [5, "permille", "percent", 0.5],
    [1, "degC_W", "K_W", 1],
  ])("%s %s = %s %s", (value, from, to, expected) => {
    expectClose(convert(value, from, to), expected);
  });

  it("32 °F = 0 °C (sıfır beklentisi, mutlak tolerans)", () => {
    expect(Math.abs(convert(32, "degF", "degC"))).toBeLessThan(1e-12);
  });

  it("toSI / fromSI", () => {
    expect(toSI(1, "kWh")).toBe(3.6e6);
    expect(toSI(25, "degC")).toBeCloseTo(298.15, 12);
    expect(fromSI(298.15, "degC")).toBeCloseTo(25, 12);
    expect(fromSI(1e5, "bar")).toBe(1);
    expectClose(toSI(1, "psi"), 6894.757, 1e-7);
    expectClose(toSI(1, "hp"), 745.69987, 1e-8);
  });

  it("aynı birime çevirmek değeri değiştirmez", () => {
    expect(convert(0.1, "mm", "mm")).toBe(0.1);
    expect(convert(-17.3, "degF", "degF")).toBe(-17.3);
  });
});

describe("hatalar", () => {
  it("bilinmeyen birim", () => {
    expect(() => getUnit("xyz")).toThrow(/Bilinmeyen birim: "xyz"/);
    expect(() => toSI(1, "xyz")).toThrow(/Bilinmeyen birim/);
    expect(() => fromSI(1, "")).toThrow(/Bilinmeyen birim/);
    expect(() => convert(1, "V", "xyz")).toThrow(/Bilinmeyen birim/);
  });

  it("kimlikler büyük/küçük harf duyarlı", () => {
    expect(() => getUnit("KV")).toThrow(/Bilinmeyen birim/);
    expect(getUnit("mW").factor).toBe(1e-3);
    expect(getUnit("MW").factor).toBe(1e6);
    expect(getUnit("mohm").factor).toBe(1e-3);
    expect(getUnit("Mohm").factor).toBe(1e6);
    expect(getUnit("ms").dimension).toBe("zaman");
    expect(getUnit("mS").dimension).toBe("iletkenlik");
  });

  it("convert'te boyut uyuşmazlığı", () => {
    expect(() => convert(1, "kV", "A")).toThrow(/Boyut uyuşmazlığı/);
    expect(() => convert(1, "kV", "A")).toThrow(/gerilim.*akim/);
    // Mutlak sıcaklık ile sıcaklık farkı ayrı boyutlardır.
    expect(() => convert(1, "degC", "deltaK")).toThrow(/Boyut uyuşmazlığı/);
    expect(() => convert(1, "kW", "kVA")).toThrow(/Boyut uyuşmazlığı/);
  });

  it("bilinmeyen boyut", () => {
    expect(() => unitsFor("yok" as Dimension)).toThrow(/Bilinmeyen boyut: "yok"/);
    expect(() => siUnit("yok" as Dimension)).toThrow(/Bilinmeyen boyut/);
    expect(() => siUnit("toString" as Dimension)).toThrow(/Bilinmeyen boyut/);
  });
});
