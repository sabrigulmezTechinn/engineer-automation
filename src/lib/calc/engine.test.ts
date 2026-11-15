import { describe, expect, it, vi } from "vitest";
import { LIMITS } from "@/config/sinirlar";
import { MESSAGES, defaultContext, defaultState, numberToInputText, runCalc, visibleInputs } from "./engine";
import type { CalcDefinition, CalcResult, InputState, RunResult } from "./types";

vi.mock("@/lib/units", () => import("@/lib/calc/test-utils/units-mock"));

/** Motor testleri için örnek tanım: girdilerin toplamını ve çarpımını hesaplar. */
function makeDef(overrides: Partial<CalcDefinition> = {}): CalcDefinition {
  return {
    id: "9.1",
    slug: "deneme",
    category: "yardimci",
    title: "Deneme",
    description: "Motor testi",
    formulas: [],
    references: [],
    inputs: [
      {
        kind: "select",
        key: "tip",
        label: "Tip",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ],
        default: "a",
      },
      { kind: "number", key: "v", label: "Gerilim", dimension: "gerilim", defaultUnit: "V", default: 12, min: 1, max: 230 },
      {
        kind: "number",
        key: "i",
        label: "Akım",
        dimension: "akim",
        defaultUnit: "A",
        default: 0.5,
        optional: true,
        visibleWhen: { key: "tip", equals: ["a", "b"] },
      },
      {
        kind: "number",
        key: "r",
        label: "Direnç",
        dimension: "direnc",
        defaultUnit: "ohm",
        units: ["ohm", "kohm"],
        min: 0,
        minExclusive: true,
        visibleWhen: { key: "tip", equals: "b" },
      },
      { kind: "number", key: "n", label: "Adet", dimension: "boyutsuz", defaultUnit: "adet", default: 1, integer: true, min: 1, max: 10 },
    ],
    outputs: [
      { key: "p", label: "Güç", symbol: "P", dimension: "guc", defaultUnit: "W" },
      { key: "akim", label: "Akım", symbol: "I", dimension: "akim", defaultUnit: "A" },
      { key: "toplam", label: "Toplam", dimension: "boyutsuz", defaultUnit: "adet" },
    ],
    compute: (inputs) => {
      const v = inputs.v as number;
      const i = (inputs.i as number | undefined) ?? 0;
      const n = inputs.n as number;
      return { outputs: { p: v * i * n, akim: i, toplam: n }, steps: [], checks: [{ level: "ok", message: "hesap" }] };
    },
    ...overrides,
  };
}

function state(overrides: InputState = {}): InputState {
  return { tip: { value: "a" }, v: { value: "12", unit: "V" }, i: { value: "0,5", unit: "A" }, n: { value: "2", unit: "adet" }, ...overrides };
}

function expectOk(r: RunResult): Extract<RunResult, { ok: true }> {
  if (!r.ok) throw new Error(`ok bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

function expectFail(r: RunResult): Extract<RunResult, { ok: false }> {
  if (r.ok) throw new Error(`hata bekleniyordu: ${JSON.stringify(r)}`);
  return r;
}

describe("defaultContext", () => {
  it("sinirlar.ts'teki LIMITS'i döner", () => {
    expect(defaultContext()).toEqual({ limits: LIMITS });
    expect(defaultContext().limits).toBe(LIMITS);
  });
});

describe("defaultState", () => {
  it("sayı girdilerinde Türkçe metin ve varsayılan birim, select'te varsayılan değer", () => {
    expect(defaultState(makeDef())).toEqual({
      tip: { value: "a" },
      v: { value: "12", unit: "V" },
      i: { value: "0,5", unit: "A" },
      r: { value: "", unit: "ohm" },
      n: { value: "1", unit: "adet" },
    });
  });

  it("numberToInputText yuvarlamaz ve parseNumber ile geri okunabilir kalır", () => {
    expect(numberToInputText(0.85)).toBe("0,85");
    expect(numberToInputText(12345.678)).toBe("12345,678");
    expect(numberToInputText(1e-7)).toBe("1e-7");
    expect(numberToInputText(-2.5)).toBe("-2,5");
  });

  it("varsayılan durum geçerli bir hesap üretir", () => {
    expectOk(runCalc(makeDef(), defaultState(makeDef())));
  });
});

describe("visibleWhen", () => {
  it("gizli girdi doğrulanmaz ve compute'a gitmez", () => {
    const r = expectOk(runCalc(makeDef(), state({ r: { value: "abc", unit: "ohm" } })));
    expect(r.inputsSI).not.toHaveProperty("r");
    expect(r.inputsSI).toEqual({ tip: "a", v: 12, i: 0.5, n: 2 });
  });

  it("select değeri eşleşince girdi görünür ve doğrulanır", () => {
    const f = expectFail(runCalc(makeDef(), state({ tip: { value: "b" }, r: { value: "abc", unit: "ohm" } })));
    expect(f.fieldErrors).toEqual({ r: MESSAGES.invalidNumber });
  });

  it("equals dizisi desteklenir; eşleşmeyen değerde girdi gizlenir", () => {
    const keys = (tip: string) => visibleInputs(makeDef(), state({ tip: { value: tip } })).map((i) => i.key);
    expect(keys("a")).toEqual(["tip", "v", "i", "n"]);
    expect(keys("b")).toEqual(["tip", "v", "i", "r", "n"]);
    expect(keys("c")).toEqual(["tip", "v", "n"]);
  });

  it("state'te olmayan select için varsayılan değere göre karar verilir", () => {
    const s = state();
    delete s.tip;
    const r = expectOk(runCalc(makeDef(), s));
    expect(r.inputsSI.tip).toBe("a");
    expect(r.inputsSI.i).toBe(0.5);
  });

  it("denetleyicisi gizli olan girdi de gizlidir (zincir)", () => {
    const def = makeDef({
      inputs: [
        ...makeDef().inputs,
        {
          kind: "select",
          key: "alt",
          label: "Alt",
          options: [{ value: "x", label: "X" }],
          default: "x",
          visibleWhen: { key: "tip", equals: "b" },
        },
        { kind: "number", key: "z", label: "Z", dimension: "gerilim", defaultUnit: "V", visibleWhen: { key: "alt", equals: "x" } },
      ],
    });
    const keys = (tip: string) => visibleInputs(def, state({ tip: { value: tip } })).map((i) => i.key);
    expect(keys("a")).not.toContain("z");
    expect(keys("b")).toContain("z");
  });
});

describe("zorunlu / isteğe bağlı", () => {
  it("boş zorunlu alan hata verir (boş metin, yalnız boşluk, eksik kayıt)", () => {
    expect(expectFail(runCalc(makeDef(), state({ v: { value: "", unit: "V" } }))).fieldErrors).toEqual({ v: MESSAGES.required });
    expect(expectFail(runCalc(makeDef(), state({ v: { value: "   ", unit: "V" } }))).fieldErrors).toEqual({ v: MESSAGES.required });
    const s = state();
    delete s.v;
    expect(expectFail(runCalc(makeDef(), s)).fieldErrors).toEqual({ v: MESSAGES.required });
  });

  it("boş isteğe bağlı alan atlanır ve compute'a gitmez", () => {
    const r = expectOk(runCalc(makeDef(), state({ i: { value: "", unit: "A" } })));
    expect(r.inputsSI).not.toHaveProperty("i");
  });

  it("alan hatası varsa checks boştur ve validate/compute çalışmaz", () => {
    const validate = vi.fn(() => []);
    const compute = vi.fn((): CalcResult => ({ outputs: {}, steps: [], checks: [] }));
    const f = expectFail(runCalc(makeDef({ validate, compute }), state({ v: { value: "x", unit: "V" }, n: { value: "", unit: "adet" } })));
    expect(f).toEqual({ ok: false, fieldErrors: { v: MESSAGES.invalidNumber, n: MESSAGES.required }, checks: [] });
    expect(validate).not.toHaveBeenCalled();
    expect(compute).not.toHaveBeenCalled();
  });
});

describe("sayı ve birim", () => {
  it("geçersiz sayı ve sonsuz değer reddedilir", () => {
    for (const value of ["abc", "1,2,3", "1e999"]) {
      expect(expectFail(runCalc(makeDef(), state({ v: { value, unit: "V" } }))).fieldErrors).toEqual({ v: MESSAGES.invalidNumber });
    }
  });

  it("ondalık virgül ve birim çevirisi uygulanır", () => {
    const r = expectOk(runCalc(makeDef(), state({ v: { value: "0,1", unit: "kV" }, i: { value: "250", unit: "mA" } })));
    expect(r.inputsSI.v).toBeCloseTo(100, 12);
    expect(r.inputsSI.i).toBeCloseTo(0.25, 12);
  });

  it("birim verilmemişse varsayılan birim kullanılır", () => {
    const r = expectOk(runCalc(makeDef(), state({ v: { value: "12" } })));
    expect(r.inputsSI.v).toBe(12);
  });

  it("units listesi dışındaki birim reddedilir", () => {
    // Listede yalnız "kohm" var; "ohm" aynı boyutta olsa da reddedilmeli
    const def = makeDef();
    const r = def.inputs.find((i) => i.key === "r");
    if (r?.kind === "number") r.units = ["kohm"];
    const f = expectFail(runCalc(def, state({ tip: { value: "b" }, r: { value: "5", unit: "ohm" } })));
    expect(f.fieldErrors).toEqual({ r: MESSAGES.invalidUnit });
  });

  it("units verilmemişse boyut dışındaki veya bilinmeyen birim reddedilir", () => {
    expect(expectFail(runCalc(makeDef(), state({ v: { value: "5", unit: "A" } }))).fieldErrors).toEqual({ v: MESSAGES.invalidUnit });
    expect(expectFail(runCalc(makeDef(), state({ v: { value: "5", unit: "yok" } }))).fieldErrors).toEqual({ v: MESSAGES.invalidUnit });
  });
});

describe("sınırlar", () => {
  it("integer: kesirli değer reddedilir, tam sayı geçer", () => {
    expect(expectFail(runCalc(makeDef(), state({ n: { value: "2,5", unit: "adet" } }))).fieldErrors).toEqual({ n: MESSAGES.integer });
    expect(expectOk(runCalc(makeDef(), state({ n: { value: "3", unit: "adet" } }))).inputsSI.n).toBe(3);
  });

  it("min: sınır, girdinin seçili birimiyle gösterilir", () => {
    expect(expectFail(runCalc(makeDef(), state({ v: { value: "0,5", unit: "V" } }))).fieldErrors).toEqual({ v: "En az 1 V olmalıdır" });
    expect(expectFail(runCalc(makeDef(), state({ v: { value: "0,0005", unit: "kV" } }))).fieldErrors).toEqual({
      v: "En az 0,001 kV olmalıdır",
    });
    expect(expectOk(runCalc(makeDef(), state({ v: { value: "1", unit: "V" } }))).inputsSI.v).toBe(1);
  });

  it("max: sınır seçili birimle gösterilir; kayan nokta artığı ihlal sayılmaz", () => {
    // 0,23 kV → 230,00000000000003 V; max 230 V'u aşmış sayılmamalı
    expect(expectOk(runCalc(makeDef(), state({ v: { value: "0,23", unit: "kV" } }))).inputsSI.v).toBeCloseTo(230, 9);
    expect(expectFail(runCalc(makeDef(), state({ v: { value: "0,231", unit: "kV" } }))).fieldErrors).toEqual({
      v: "En fazla 0,23 kV olabilir",
    });
    expect(expectFail(runCalc(makeDef(), state({ n: { value: "11", unit: "adet" } }))).fieldErrors).toEqual({ n: "En fazla 10 olabilir" });
  });

  it("minExclusive: tam sınır reddedilir, çok küçük pozitif değer geçer", () => {
    const s = (value: string, unit: string) => state({ tip: { value: "b" }, r: { value, unit } });
    expect(expectFail(runCalc(makeDef(), s("0", "ohm"))).fieldErrors).toEqual({ r: "0 Ω değerinden büyük olmalıdır" });
    expect(expectFail(runCalc(makeDef(), s("0", "kohm"))).fieldErrors).toEqual({ r: "0 kΩ değerinden büyük olmalıdır" });
    expect(expectFail(runCalc(makeDef(), s("-1", "ohm"))).fieldErrors).toEqual({ r: "0 Ω değerinden büyük olmalıdır" });
    expect(expectOk(runCalc(makeDef(), s("1e-9", "ohm"))).inputsSI.r).toBe(1e-9);
  });
});

describe("select", () => {
  it("seçenekler dışındaki değer hata verir", () => {
    expect(expectFail(runCalc(makeDef(), state({ tip: { value: "z" } }))).fieldErrors).toEqual({ tip: MESSAGES.invalidOption });
  });
});

describe("validate", () => {
  it("'hata' seviyesi varsa compute çalışmaz ve tüm validate check'leri döner", () => {
    const compute = vi.fn((): CalcResult => ({ outputs: {}, steps: [], checks: [] }));
    const checks = [
      { level: "uyari" as const, message: "dikkat" },
      { level: "hata" as const, message: "olmaz" },
    ];
    const f = expectFail(runCalc(makeDef({ validate: () => checks, compute }), state()));
    expect(f).toEqual({ ok: false, fieldErrors: {}, checks });
    expect(compute).not.toHaveBeenCalled();
  });

  it("uyarı ve ok check'leri sonuç check'lerinin başına eklenir", () => {
    const r = expectOk(
      runCalc(
        makeDef({
          validate: () => [
            { level: "uyari", message: "v1" },
            { level: "ok", message: "v2" },
          ],
        }),
        state(),
      ),
    );
    expect(r.result.checks.map((c) => c.message)).toEqual(["v1", "v2", "hesap"]);
  });

  it("validate fırlatırsa genel hata check'i döner", () => {
    const f = expectFail(
      runCalc(
        makeDef({
          validate: () => {
            throw new Error("boom");
          },
        }),
        state(),
      ),
    );
    expect(f.checks).toEqual([{ level: "hata", message: MESSAGES.validateFailed }]);
  });

  it("validate ve compute doğrulanmış SI girdileri ve bağlamı alır", () => {
    const validate = vi.fn(() => []);
    const compute = vi.fn((): CalcResult => ({ outputs: {}, steps: [], checks: [] }));
    const ctx = { limits: LIMITS };
    runCalc(makeDef({ validate, compute }), state({ v: { value: "0,012", unit: "kV" } }), { ctx });
    expect(validate).toHaveBeenCalledWith({ tip: "a", v: 12, i: 0.5, n: 2 }, ctx);
    expect(compute).toHaveBeenCalledWith({ tip: "a", v: 12, i: 0.5, n: 2 }, ctx);
  });
});

describe("compute", () => {
  it("fırlatırsa runCalc fırlatmaz, genel Türkçe hata check'i döner", () => {
    const thrower = (e: unknown) => () => {
      throw e;
    };
    for (const e of [new Error("internal detail"), "string hata", undefined]) {
      const f = expectFail(runCalc(makeDef({ validate: () => [{ level: "uyari", message: "v" }], compute: thrower(e) }), state()));
      expect(f.fieldErrors).toEqual({});
      expect(f.checks).toEqual([
        { level: "uyari", message: "v" },
        { level: "hata", message: MESSAGES.computeFailed },
      ]);
    }
  });

  it("NaN ve Infinity çıktıları atılır ve 'hata' check'ine çevrilir", () => {
    const def = makeDef({
      compute: () => ({ outputs: { p: Number.NaN, akim: Number.POSITIVE_INFINITY, toplam: 3 }, steps: [], checks: [] }),
    });
    const r = expectOk(runCalc(def, state()));
    expect(r.result.outputs).toEqual({ toplam: 3 });
    expect(r.outputs.map((o) => o.key)).toEqual(["toplam"]);
    expect(r.result.checks).toEqual([
      { level: "hata", message: MESSAGES.invalidOutput("Güç") },
      { level: "hata", message: MESSAGES.invalidOutput("Akım") },
    ]);
  });
});

describe("çıktı gösterimi", () => {
  it("varsayılan birimle biçimlenir, tanım sırasını izler ve sembolü taşır", () => {
    const r = expectOk(runCalc(makeDef(), state()));
    expect(r.outputs).toEqual([
      { key: "p", label: "Güç", symbol: "P", value: 12, unit: "W", formatted: "12 W" },
      { key: "akim", label: "Akım", symbol: "I", value: 0.5, unit: "A", formatted: "0,5 A" },
      { key: "toplam", label: "Toplam", value: 2, unit: "adet", formatted: "2" },
    ]);
  });

  it("outputUnits ile seçilen birim kullanılır", () => {
    const r = expectOk(runCalc(makeDef(), state(), { outputUnits: { akim: "mA", p: "kW" } }));
    expect(r.outputs.find((o) => o.key === "akim")).toMatchObject({ value: 500, unit: "mA", formatted: "500 mA" });
    expect(r.outputs.find((o) => o.key === "p")).toMatchObject({ value: 0.012, unit: "kW", formatted: "0,012 kW" });
    // Sonuç (CalcResult) SI'da kalır
    expect(r.result.outputs.akim).toBe(0.5);
  });

  it("çıktıya ait olmayan birim istenirse varsayılan birime düşülür", () => {
    const r = expectOk(runCalc(makeDef(), state(), { outputUnits: { akim: "V", p: "yok" } }));
    expect(r.outputs.find((o) => o.key === "akim")?.unit).toBe("A");
    expect(r.outputs.find((o) => o.key === "p")?.unit).toBe("W");
  });

  it("sonuçta olmayan çıktı atlanır", () => {
    const def = makeDef({ compute: () => ({ outputs: { akim: 1 }, steps: [], checks: [] }) });
    expect(expectOk(runCalc(def, state())).outputs.map((o) => o.key)).toEqual(["akim"]);
  });
});

describe("hiçbir zaman fırlatmaz", () => {
  it("birim sistemi fırlatsa bile sonuç döner", () => {
    const def = makeDef({
      outputs: [{ key: "p", label: "Güç", dimension: "guc", defaultUnit: "bilinmeyen-birim" }],
    });
    const f = expectFail(runCalc(def, state()));
    expect(f.checks).toEqual([{ level: "hata", message: MESSAGES.unexpected }]);
  });

  it("girdi işlenirken fırlayan hata alan hatasına çevrilir", () => {
    const def = makeDef({
      inputs: [{ kind: "number", key: "v", label: "V", dimension: "gerilim", defaultUnit: "V", units: ["V", "hayali"] }],
    });
    const f = expectFail(runCalc(def, { v: { value: "1", unit: "hayali" } }));
    expect(f.fieldErrors).toEqual({ v: MESSAGES.fieldFailed });
  });
});
