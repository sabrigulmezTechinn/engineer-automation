import { afterEach, describe, expect, it, vi } from "vitest";
import { ohmYasasi } from "./defs/temel-elektrik/ohm-yasasi";
import { CATEGORIES, allCalcs, calcsByCategory, compareCalcIds, getCalc, validateDefinitions } from "./registry";
import type { CalcDefinition, CategoryId } from "./types";

function fakeDef(id: string, slug: string, overrides: Partial<CalcDefinition> = {}): CalcDefinition {
  return {
    id,
    slug,
    category: "temel-elektrik",
    title: slug,
    description: "",
    formulas: [],
    references: [],
    inputs: [{ kind: "number", key: "x", label: "X", dimension: "gerilim", defaultUnit: "V" }],
    outputs: [{ key: "y", label: "Y", dimension: "gerilim", defaultUnit: "V" }],
    compute: () => ({ outputs: {}, steps: [], checks: [] }),
    ...overrides,
  };
}

describe("CATEGORIES", () => {
  it("KAPSAM §4'teki 7 kategori, sırasıyla", () => {
    const ids: CategoryId[] = ["temel-elektrik", "tesisat", "motor", "elektronik", "otomasyon", "mekatronik", "yardimci"];
    expect(CATEGORIES.map((c) => c.id)).toEqual(ids);
    expect(CATEGORIES.map((c) => c.title)).toEqual([
      "Temel elektrik",
      "Elektrik tesisat ve güç",
      "Motor ve sürücü",
      "Elektronik",
      "Otomasyon ve PLC",
      "Mekatronik ve mekanik tahrik",
      "Yardımcı araçlar",
    ]);
    for (const c of CATEGORIES) expect(c.description.length).toBeGreaterThan(0);
  });
});

describe("kayıt defteri", () => {
  it("pilot hesap kayıtlı ve slug ile bulunur", () => {
    expect(allCalcs()).toContain(ohmYasasi);
    expect(getCalc("ohm-yasasi")).toBe(ohmYasasi);
    expect(getCalc("olmayan")).toBeUndefined();
  });

  it("calcsByCategory kategoriye göre süzer", () => {
    expect(calcsByCategory("temel-elektrik")).toContain(ohmYasasi);
    expect(calcsByCategory("motor")).not.toContain(ohmYasasi);
  });

  it("allCalcs KAPSAM numarasına göre sıralı ve dışarıdan değiştirilemez", () => {
    const list = allCalcs();
    const ids = list.map((d) => d.id);
    expect(ids).toEqual([...ids].sort(compareCalcIds));
    list.pop();
    expect(allCalcs().length).toBe(ids.length);
  });

  it("kayıtlı tanımlar doğrulamadan geçer", () => {
    expect(validateDefinitions(allCalcs())).toEqual([]);
  });
});

describe("yüklemede doğrulama", () => {
  afterEach(() => {
    vi.doUnmock("./defs/temel-elektrik/ohm-yasasi");
    vi.resetModules();
  });

  it("hatalı tanım varsa modül yüklenirken fırlatır", async () => {
    vi.resetModules();
    vi.doMock("./defs/temel-elektrik/ohm-yasasi", () => ({
      ohmYasasi: { ...ohmYasasi, inputs: [...ohmYasasi.inputs, ohmYasasi.inputs[1]] },
    }));
    await expect(import("./registry")).rejects.toThrow(/Hesap kayıt defteri geçersiz[\s\S]*yinelenen girdi anahtarı "V"/);
  });
});

describe("compareCalcIds", () => {
  it("bölüm bölüm sayısal sıralar (4.9 < 4.10)", () => {
    expect(["4.10", "1.2", "4.9", "1.10", "1.1", "2.1"].sort(compareCalcIds)).toEqual(["1.1", "1.2", "1.10", "2.1", "4.9", "4.10"]);
  });
});

describe("validateDefinitions", () => {
  it("geçerli tanımlarda sorun yok", () => {
    expect(validateDefinitions([fakeDef("1.1", "a"), fakeDef("1.2", "b")])).toEqual([]);
  });

  it("yinelenen kimlik ve slug", () => {
    const p = validateDefinitions([fakeDef("1.1", "a"), fakeDef("1.1", "b"), fakeDef("1.2", "a")]);
    expect(p).toContain("Yinelenen hesap kimliği: 1.1");
    expect(p).toContain("Yinelenen slug: a");
  });

  it("yinelenen girdi ve çıktı anahtarı", () => {
    const def = fakeDef("1.1", "a", {
      inputs: [
        { kind: "number", key: "x", label: "X", dimension: "gerilim", defaultUnit: "V" },
        { kind: "number", key: "x", label: "X2", dimension: "akim", defaultUnit: "A" },
      ],
      outputs: [
        { key: "y", label: "Y", dimension: "gerilim", defaultUnit: "V" },
        { key: "y", label: "Y2", dimension: "gerilim", defaultUnit: "V" },
      ],
    });
    const p = validateDefinitions([def]);
    expect(p.some((m) => m.includes('yinelenen girdi anahtarı "x"'))).toBe(true);
    expect(p.some((m) => m.includes('yinelenen çıktı anahtarı "y"'))).toBe(true);
  });

  it("biçim, kategori, select ve visibleWhen hataları", () => {
    const def = fakeDef("1-1", "Kötü Slug", {
      category: "yok" as CategoryId,
      inputs: [
        { kind: "select", key: "s", label: "S", options: [{ value: "a", label: "A" }], default: "z" },
        { kind: "number", key: "x", label: "X", dimension: "gerilim", defaultUnit: "V", visibleWhen: { key: "olmayan", equals: "a" } },
        { kind: "number", key: "w", label: "W", dimension: "gerilim", defaultUnit: "V", visibleWhen: { key: "s", equals: ["a", "q"] } },
        { kind: "number", key: "u", label: "U", dimension: "gerilim", defaultUnit: "V", visibleWhen: { key: "x", equals: "a" } },
        { kind: "number", key: "k", label: "K", dimension: "gerilim", defaultUnit: "V", units: ["kV"] },
      ],
    });
    const p = validateDefinitions([def]).join("\n");
    expect(p).toMatch(/kimlik "1\.1" biçiminde olmalı/);
    expect(p).toMatch(/slug küçük harf/);
    expect(p).toMatch(/bilinmeyen kategori "yok"/);
    expect(p).toMatch(/varsayılan "z" seçenekler arasında değil/);
    expect(p).toMatch(/girdi "x": visibleWhen başka bir select/);
    expect(p).toMatch(/visibleWhen değeri "q"/);
    expect(p).toMatch(/girdi "u": visibleWhen başka bir select/);
    expect(p).toMatch(/varsayılan birim "V" birim listesinde değil/);
  });
});
