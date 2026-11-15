/**
 * Rapor modeli: gerçek motor ve birim sistemiyle. Sentetik tanım biçim kurallarını, kayıtlı 21 hesap
 * varsayılan durumda modelin üretildiğini ve yalnızca görünen girdileri içerdiğini denetler.
 */
import { describe, expect, it } from "vitest";
import { defaultState, MESSAGES, runCalc, visibleInputs } from "@/lib/calc/engine";
import { allCalcs } from "@/lib/calc/registry";
import type { CalcDefinition, InputState } from "@/lib/calc/types";
import { getUnit } from "@/lib/units";
import { hesapRaporuOlustur } from "./model";

/** U+202F: binlik ayırıcı (ISO 80000-1) */
const NNBSP = " ";

const def: CalcDefinition = {
  id: "9.9",
  slug: "rapor-deneme",
  category: "temel-elektrik",
  title: "Rapor denemesi",
  description: "Biçim kuralları için sentetik hesap.",
  formulas: [{ label: "Ohm", latex: "I = \\frac{V}{R}" }],
  references: [{ standard: "IEC 60050-131", clause: "131-12-04" }],
  inputs: [
    { key: "mod", label: "Mod", kind: "select", default: "a", options: [{ value: "a", label: "Seçenek A → direnç" }, { value: "b", label: "Seçenek B" }] },
    { key: "V", label: "Gerilim", symbol: "V", kind: "number", dimension: "gerilim", defaultUnit: "V", default: 12 },
    { key: "R", label: "Direnç", symbol: "R", kind: "number", dimension: "direnc", defaultUnit: "ohm", units: ["ohm", "kohm"], default: 6, min: 0, minExclusive: true },
    { key: "liste", label: "Dirençler", kind: "numberList", dimension: "direnc", defaultUnit: "kohm", units: ["ohm", "kohm"], default: [10, 22, 47] },
    { key: "oran", label: "Oran", kind: "numberList", dimension: "oran", defaultUnit: "percent", units: ["percent", "fraction"], default: [5, 10], optional: true },
    { key: "gizli", label: "Gizli", kind: "number", dimension: "gerilim", defaultUnit: "V", default: 1, visibleWhen: { key: "mod", equals: "b" } },
    { key: "secimli", label: "İsteğe bağlı", kind: "number", dimension: "gerilim", defaultUnit: "V", optional: true },
  ],
  outputs: [
    { key: "I", label: "Akım", symbol: "I", dimension: "akim", defaultUnit: "A" },
    { key: "P", label: "Güç", symbol: "P", dimension: "guc", defaultUnit: "W", units: ["W", "kW", "hp"] },
  ],
  validate: (inputs) =>
    (inputs.V as number) > 1000 ? [{ level: "hata", message: "Gerilim 1000 V'u aşamaz" }, { level: "uyari", message: "Yüksek gerilim" }] : [],
  compute: (inputs) => {
    const V = inputs.V as number;
    const R = inputs.R as number;
    if (V === 999) throw new Error("bilerek");
    return {
      outputs: { I: V / R, P: (V * V) / R },
      steps: [{ label: "Akım", latex: "I = V/R" }],
      checks: [{ level: V > 100 ? "uyari" : "ok", message: "Gerilim kontrolü", reference: { standard: "IEC 60038" } }],
    };
  },
};

function durum(degisiklik: InputState): InputState {
  return { ...defaultState(def), ...degisiklik };
}

function deger(rapor: ReturnType<typeof hesapRaporuOlustur>, key: string): string | undefined {
  return rapor.girdiler.find((g) => g.key === key)?.deger;
}

describe("hesapRaporuOlustur — sentetik tanım", () => {
  it("varsayılan durumda başarılı model; tanım alanları ve çalıştırma sonucu taşınır", () => {
    const rapor = hesapRaporuOlustur(def, defaultState(def));
    expect(rapor.basarili).toBe(true);
    expect(rapor.hataMesajlari).toEqual([]);
    expect(rapor).toMatchObject({ hesapId: "9.9", hesapSlug: "rapor-deneme", baslik: "Rapor denemesi", aciklama: def.description });
    expect(rapor.formuller).toEqual(def.formulas);
    expect(rapor.referanslar).toEqual(def.references);
    expect(rapor.adimlar).toEqual([{ label: "Akım", latex: "I = V/R" }]);
    expect(rapor.kontroller).toEqual([{ level: "ok", message: "Gerilim kontrolü", reference: { standard: "IEC 60038" } }]);
    expect(rapor.ciktilar.map((c) => c.formatted)).toEqual(["2 A", "24 W"]);
    expect(rapor).not.toHaveProperty("kayitAdi");
  });

  it("yalnızca görünen girdiler, tanım sırasıyla; sembol varsa taşınır", () => {
    const rapor = hesapRaporuOlustur(def, defaultState(def));
    expect(rapor.girdiler.map((g) => g.key)).toEqual(["mod", "V", "R", "liste", "oran", "secimli"]);
    expect(rapor.girdiler.find((g) => g.key === "V")).toEqual({ key: "V", label: "Gerilim", symbol: "V", deger: "12 V" });
    expect(rapor.girdiler.find((g) => g.key === "mod")).not.toHaveProperty("symbol");
    const b = hesapRaporuOlustur(def, durum({ mod: { value: "b" } }));
    expect(b.girdiler.map((g) => g.key)).toContain("gizli");
  });

  it("sayılar yazılan metin değil, ayrıştırılıp biçimlenmiş değer olarak gelir (yuvarlanmadan)", () => {
    const rapor = hesapRaporuOlustur(
      def,
      durum({ V: { value: "1.000.000", unit: "V" }, R: { value: "12,3456", unit: "kohm" } }),
    );
    expect(deger(rapor, "V")).toBe(`1${NNBSP}000${NNBSP}000 V`);
    expect(deger(rapor, "R")).toBe("12,3456 kΩ");
    expect(deger(hesapRaporuOlustur(def, durum({ R: { value: "1e-7", unit: "ohm" } })), "R")).toBe("1×10⁻⁷ Ω");
    expect(deger(hesapRaporuOlustur(def, durum({ R: { value: " 0.85 ", unit: "ohm" } })), "R")).toBe("0,85 Ω");
  });

  it("select girdisi seçeneğin etiketiyle; liste girdisi tek birimle", () => {
    const rapor = hesapRaporuOlustur(def, defaultState(def));
    expect(deger(rapor, "mod")).toBe("Seçenek A → direnç");
    expect(deger(rapor, "liste")).toBe("10; 22; 47 kΩ");
    // "%" önek sembolü: her değer ayrı
    expect(deger(rapor, "oran")).toBe("%5; %10");
    const liste = hesapRaporuOlustur(def, durum({ liste: { value: "1.5\n2,25;;3", unit: "ohm" } }));
    expect(deger(liste, "liste")).toBe("1,5; 2,25; 3 Ω");
  });

  it("boş isteğe bağlı girdi '—'", () => {
    expect(deger(hesapRaporuOlustur(def, defaultState(def)), "secimli")).toBe("—");
  });

  it("geçersiz girdide başarısız model: alan etiketi + mesaj, ham metin gösterilir, sonuç yok", () => {
    const rapor = hesapRaporuOlustur(def, durum({ R: { value: "abc", unit: "ohm" }, liste: { value: "10; x", unit: "kohm" } }));
    expect(rapor.basarili).toBe(false);
    expect(rapor.hataMesajlari).toEqual([
      `Direnç: ${MESSAGES.invalidNumber}`,
      `Dirençler: ${MESSAGES.listItem(2, MESSAGES.invalidNumber)}`,
    ]);
    expect(deger(rapor, "R")).toBe("abc");
    expect(deger(rapor, "liste")).toBe("10; x");
    expect(rapor.ciktilar).toEqual([]);
    expect(rapor.adimlar).toEqual([]);
    expect(rapor.formuller).toEqual(def.formulas);
  });

  it("sınır ihlali mesajı alan etiketiyle", () => {
    const rapor = hesapRaporuOlustur(def, durum({ R: { value: "0", unit: "ohm" } }));
    expect(rapor.basarili).toBe(false);
    expect(rapor.hataMesajlari).toHaveLength(1);
    expect(rapor.hataMesajlari[0]).toMatch(/^Direnç: .*büyük olmalıdır$/);
  });

  it("çapraz alan (validate) hatası hataMesajlari'na, kalan uyarılar kontroller'e", () => {
    const rapor = hesapRaporuOlustur(def, durum({ V: { value: "2000", unit: "V" } }));
    expect(rapor.basarili).toBe(false);
    expect(rapor.hataMesajlari).toEqual(["Gerilim 1000 V'u aşamaz"]);
    expect(rapor.kontroller).toEqual([{ level: "uyari", message: "Yüksek gerilim" }]);
  });

  it("compute istisnasında motorun mesajı", () => {
    const rapor = hesapRaporuOlustur(def, durum({ V: { value: "999", unit: "V" } }));
    expect(rapor.basarili).toBe(false);
    expect(rapor.hataMesajlari).toEqual([MESSAGES.computeFailed]);
  });

  it("çıktı birimi seçimi, tercih edilen birim ve anlamlı basamak uygulanır", () => {
    const state = durum({ R: { value: "7", unit: "ohm" } });
    const varsayilan = hesapRaporuOlustur(def, state);
    expect(varsayilan.ciktilar.find((c) => c.key === "I")?.formatted).toBe("1,714 A");
    const secenekli = hesapRaporuOlustur(def, state, { significant: 6, outputUnits: { I: "mA" }, preferredUnits: { guc: "hp" } });
    expect(secenekli.ciktilar.find((c) => c.key === "I")?.formatted).toBe("1714,29 mA");
    expect(secenekli.ciktilar.find((c) => c.key === "P")?.unit).toBe("hp");
    // Tercih girdileri yuvarlamaz
    expect(deger(secenekli, "R")).toBe("7 Ω");
  });

  it("kayıt adı ve notlar modele girer", () => {
    const rapor = hesapRaporuOlustur(def, defaultState(def), { kayitAdi: "Pano 3", notlar: null });
    expect(rapor.kayitAdi).toBe("Pano 3");
    expect(rapor.notlar).toBeNull();
  });

  it("bilinmeyen birim veya bozuk durum fırlatmaz", () => {
    expect(() => hesapRaporuOlustur(def, durum({ R: { value: "5", unit: "yok-boyle-birim" } }))).not.toThrow();
    const rapor = hesapRaporuOlustur(def, durum({ R: { value: "5", unit: "yok-boyle-birim" }, mod: { value: "zzz" } }));
    expect(rapor.basarili).toBe(false);
    expect(deger(rapor, "R")).toBe("5 yok-boyle-birim");
    expect(deger(rapor, "mod")).toBe("zzz");
    expect(() => hesapRaporuOlustur(def, {})).not.toThrow();
  });

  it("çok uzun ayrıştırılamayan metin kısaltılır", () => {
    const rapor = hesapRaporuOlustur(def, durum({ R: { value: "x".repeat(500), unit: "ohm" } }));
    const d = deger(rapor, "R") ?? "";
    expect(d.length).toBeLessThanOrEqual(60);
    expect(d.endsWith("…")).toBe(true);
  });
});

describe.each(allCalcs().map((d) => [`${d.id} ${d.slug}`, d] as const))("hesapRaporuOlustur — %s varsayılan", (_ad, d) => {
  it("model üretilir; girdiler görünen girdiler, değerler biçimli; sonuç runCalc ile aynı", () => {
    const state = defaultState(d);
    const rapor = hesapRaporuOlustur(d, state);
    const run = runCalc(d, state);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(rapor.basarili).toBe(true);
    expect(rapor.hataMesajlari).toEqual([]);
    expect(rapor.girdiler.map((g) => g.key)).toEqual(visibleInputs(d, state).map((i) => i.key));
    expect(rapor.ciktilar).toEqual(run.outputs);
    expect(rapor.adimlar).toEqual(run.result.steps);
    expect(rapor.kontroller).toEqual(run.result.checks);
    expect(rapor.formuller).toEqual(d.formulas);
    expect(rapor.referanslar).toEqual(d.references);

    for (const input of visibleInputs(d, state)) {
      const g = rapor.girdiler.find((x) => x.key === input.key);
      expect(g?.label).toBe(input.label);
      const text = state[input.key]?.value ?? "";
      if (input.kind === "select") {
        expect(g?.deger).toBe(input.options.find((o) => o.value === text)?.label);
        continue;
      }
      if (text.trim() === "") {
        expect(g?.deger).toBe("—");
        continue;
      }
      // Ondalık nokta yok (Türkçe virgül), birim sembolü var
      expect(g?.deger, input.key).not.toMatch(/\d\.\d/);
      const symbol = getUnit(state[input.key]?.unit ?? input.defaultUnit).symbol;
      if (symbol !== "-") expect(g?.deger, input.key).toContain(symbol);
    }
  });
});
