import { describe, expect, it } from "vitest";
import { defaultState } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import type { CalcDefinition } from "@/lib/calc/types";
import { kaydedilmemisDegisiklikVar } from "./degisiklik";
import { GIRDI_DEGER_MAX, ciktiBirimleriniSuz, girdileriSuz } from "./dogrulama";

/** Süzme kurallarını açıkça denetlemek için küçük, sahte bir tanım */
const def: CalcDefinition = {
  id: "9.9",
  slug: "suzme-deneme",
  category: "yardimci",
  title: "Süzme denemesi",
  description: "Test",
  formulas: [],
  references: [],
  inputs: [
    {
      kind: "select",
      key: "mod",
      label: "Mod",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
      default: "a",
    },
    // units verilmemiş: boyutun tüm birimleri (µV, mV, V, kV)
    { kind: "number", key: "U", label: "Gerilim", dimension: "gerilim", defaultUnit: "V", default: 12 },
    // units kısıtlı: yalnızca A ve mA
    { kind: "number", key: "I", label: "Akım", dimension: "akim", defaultUnit: "A", units: ["A", "mA"], default: 1 },
    { kind: "numberList", key: "L", label: "Liste", dimension: "akim", defaultUnit: "A", default: [1, 2] },
  ],
  outputs: [
    { key: "P", label: "Güç", dimension: "guc", defaultUnit: "W" },
    { key: "R", label: "Direnç", dimension: "direnc", defaultUnit: "ohm", units: ["ohm", "kohm"] },
  ],
  compute: () => ({ outputs: {}, steps: [], checks: [] }),
};

describe("girdileriSuz", () => {
  it("geçerli durumu olduğu gibi bırakır", () => {
    const state = {
      mod: { value: "b" },
      U: { value: "0,4", unit: "kV" },
      I: { value: "20", unit: "mA" },
      L: { value: "1; 2; 3", unit: "mA" },
    };
    expect(girdileriSuz(def, state)).toEqual(state);
  });

  it("tanımda olmayan anahtarları atar", () => {
    expect(girdileriSuz(def, { mod: { value: "a" }, fazla: { value: "1" }, x: { value: "2", unit: "V" } })).toEqual({
      mod: { value: "a" },
    });
  });

  it("seçeneklerde olmayan select değerini atar; select'te birim saklanmaz", () => {
    expect(girdileriSuz(def, { mod: { value: "c" } })).toEqual({});
    expect(girdileriSuz(def, { mod: { value: "b", unit: "V" } })).toEqual({ mod: { value: "b" } });
  });

  it("izinli olmayan birimde girdinin tamamını atar", () => {
    // I yalnızca A/mA kabul eder: kA tanımın kısıtlı listesinde yok
    expect(girdileriSuz(def, { I: { value: "1", unit: "kA" } })).toEqual({});
    // U'nun units listesi yok: boyutun birimleri geçerli, başka boyutun birimi değil
    expect(girdileriSuz(def, { U: { value: "5", unit: "mV" } })).toEqual({ U: { value: "5", unit: "mV" } });
    expect(girdileriSuz(def, { U: { value: "5", unit: "A" } })).toEqual({});
    expect(girdileriSuz(def, { U: { value: "5", unit: "bilinmeyen" } })).toEqual({});
    expect(girdileriSuz(def, { L: { value: "1; 2", unit: "V" } })).toEqual({});
  });

  it("birimi yazılmamış sayı girdisini varsayılan birimle tamamlar", () => {
    expect(girdileriSuz(def, { U: { value: "230" } })).toEqual({ U: { value: "230", unit: "V" } });
  });

  it("metin olmayan ya da çok uzun değerleri atar", () => {
    expect(girdileriSuz(def, { U: { value: 230, unit: "V" } })).toEqual({});
    expect(girdileriSuz(def, { U: { unit: "V" } })).toEqual({});
    expect(girdileriSuz(def, { U: { value: "1", unit: 5 } })).toEqual({});
    expect(girdileriSuz(def, { U: "230" })).toEqual({});
    expect(girdileriSuz(def, { U: null, I: ["1"] })).toEqual({});
    const sinirda = "1".repeat(GIRDI_DEGER_MAX);
    expect(girdileriSuz(def, { U: { value: sinirda, unit: "V" } })).toEqual({ U: { value: sinirda, unit: "V" } });
    expect(girdileriSuz(def, { U: { value: `${sinirda}1`, unit: "V" } })).toEqual({});
  });

  it("boş metin geçerli bir değerdir (isteğe bağlı/boş alan)", () => {
    expect(girdileriSuz(def, { U: { value: "", unit: "V" } })).toEqual({ U: { value: "", unit: "V" } });
  });

  it("nesne olmayan girdide boş durum döner", () => {
    for (const bozuk of [null, undefined, "x", 5, [], true]) expect(girdileriSuz(def, bozuk)).toEqual({});
  });

  it("girdi nesnesindeki fazla alanları atar ve prototip zincirine bakmaz", () => {
    expect(girdileriSuz(def, { U: { value: "1", unit: "V", fazla: "x" } })).toEqual({ U: { value: "1", unit: "V" } });
    const zincir = Object.create({ U: { value: "1", unit: "V" } }) as Record<string, unknown>;
    expect(girdileriSuz(def, zincir)).toEqual({});
    const proto = JSON.parse('{"__proto__": {"value": "a"}, "mod": {"value": "a"}}') as unknown;
    const sonuc = girdileriSuz(def, proto);
    expect(sonuc).toEqual({ mod: { value: "a" } });
    expect(Object.getPrototypeOf(sonuc)).toBe(Object.prototype);
  });

  it("gerçek bir tanımın varsayılan durumu süzmeden değişmeden geçer", () => {
    const ohm = getCalc("ohm-yasasi");
    expect(ohm).toBeDefined();
    const state = defaultState(ohm!);
    expect(girdileriSuz(ohm!, state)).toEqual(state);
  });
});

describe("ciktiBirimleriniSuz", () => {
  it("yalnızca tanımdaki çıktıları ve izinli birimlerini bırakır", () => {
    expect(ciktiBirimleriniSuz(def, { P: "kW", R: "kohm" })).toEqual({ P: "kW", R: "kohm" });
    // R yalnızca ohm/kohm: Mohm atılır; P güç birimi değil: V atılır; X tanımda yok
    expect(ciktiBirimleriniSuz(def, { P: "V", R: "Mohm", X: "W" })).toEqual({});
    expect(ciktiBirimleriniSuz(def, { P: 1000, R: null })).toEqual({});
  });

  it("nesne olmayan girdide boş nesne döner", () => {
    for (const bozuk of [null, undefined, "kW", 5, ["kW"]]) expect(ciktiBirimleriniSuz(def, bozuk)).toEqual({});
  });
});

describe("kaydedilmemisDegisiklikVar", () => {
  const kayitli = {
    girdiler: { I: { unit: "mA", value: "20" }, U: { value: "230", unit: "V" } },
    ciktiBirimleri: { P: "kW" },
  };
  const acilan = { ...defaultState(def), ...kayitli.girdiler };

  it("kayıtla açılan durum (varsayılanlarla tamamlanmış, alan sırası farklı) değişmemiş sayılır", () => {
    expect(
      kaydedilmemisDegisiklikVar(def, kayitli, {
        state: { ...acilan, I: { value: "20", unit: "mA" } },
        outputUnits: { P: "kW" },
      }),
    ).toBe(false);
  });

  it("girdi değeri, birimi, select değeri ya da çıktı birimi değişince değişmiş sayılır", () => {
    const guncel = (state: object, outputUnits: Record<string, string> = { P: "kW" }) =>
      kaydedilmemisDegisiklikVar(def, kayitli, { state: { ...acilan, ...state }, outputUnits });
    expect(guncel({ U: { value: "231", unit: "V" } })).toBe(true);
    expect(guncel({ U: { value: "230", unit: "kV" } })).toBe(true);
    expect(guncel({ mod: { value: "b" } })).toBe(true);
    expect(guncel({}, { P: "W" })).toBe(true);
    expect(guncel({}, {})).toBe(true);
    // Geri alınan değişiklik
    expect(guncel({ U: { value: "230", unit: "V" } })).toBe(false);
  });

  it("geçersiz çıktı birimi seçimi fark sayılmaz (kaydedilmeyecek)", () => {
    expect(
      kaydedilmemisDegisiklikVar(def, kayitli, { state: acilan, outputUnits: { P: "kW", X: "W" } }),
    ).toBe(false);
  });
});
