// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CalcDefinition,
  ComputeInputs,
  InputState,
  NumberInputSpec,
  RunResult,
} from "@/lib/calc/types";
import type { UnitDef } from "@/lib/units";
import { CalcForm } from "./calc-form";

/*
 * Motor, kayıt defteri ve birim sistemi başka işçilerce yazıldığı için burada sahte sürümleri kullanılır.
 * Sahte motor sözleşmedeki davranışı taklit eder: alan hatası → ok:false, aksi halde çıktı + adım + kontrol.
 */
const mocks = vi.hoisted(() => {
  const UNITS: Record<string, UnitDef> = {
    V: { id: "V", symbol: "V", name: "volt", dimension: "gerilim", factor: 1 },
    kV: { id: "kV", symbol: "kV", name: "kilovolt", dimension: "gerilim", factor: 1000 },
    A: { id: "A", symbol: "A", name: "amper", dimension: "akim", factor: 1 },
    mA: { id: "mA", symbol: "mA", name: "miliamper", dimension: "akim", factor: 0.001 },
    ohm: { id: "ohm", symbol: "Ω", name: "ohm", dimension: "direnc", factor: 1 },
    kohm: { id: "kohm", symbol: "kΩ", name: "kiloohm", dimension: "direnc", factor: 1000 },
    mohm: { id: "mohm", symbol: "mΩ", name: "miliohm", dimension: "direnc", factor: 0.001 },
  };

  const def: CalcDefinition = {
    id: "1.1",
    slug: "ohm-deneme",
    category: "temel-elektrik",
    title: "Ohm yasası (deneme)",
    description: "Test için sahte hesap",
    formulas: [{ label: "Ohm yasası", latex: "U = I \\cdot R" }],
    references: [],
    inputs: [
      {
        kind: "select",
        key: "bilinmeyen",
        label: "Hesaplanacak",
        options: [
          { value: "akim", label: "Akımı hesapla" },
          { value: "gerilim", label: "Gerilimi hesapla" },
        ],
        default: "akim",
      },
      {
        kind: "number",
        key: "U",
        label: "Gerilim",
        symbol: "U",
        dimension: "gerilim",
        defaultUnit: "V",
        default: 12,
        visibleWhen: { key: "bilinmeyen", equals: "akim" },
      },
      {
        kind: "number",
        key: "I",
        label: "Akım",
        symbol: "I",
        dimension: "akim",
        defaultUnit: "A",
        default: 2,
        visibleWhen: { key: "bilinmeyen", equals: ["gerilim"] },
      },
      {
        kind: "number",
        key: "R",
        label: "Direnç",
        symbol: "R",
        dimension: "direnc",
        defaultUnit: "ohm",
        units: ["ohm", "kohm"],
        default: 6,
        min: 0,
        minExclusive: true,
        help: "Yük direnci",
      },
    ],
    outputs: [
      { key: "akim", label: "Hesaplanan akım", symbol: "I", dimension: "akim", defaultUnit: "A" },
      { key: "gerilim", label: "Hesaplanan gerilim", symbol: "U", dimension: "gerilim", defaultUnit: "V" },
    ],
    compute: () => ({ outputs: {}, steps: [], checks: [] }),
  };

  // Varsayılanı olmayan zorunlu alan içeren sürüm
  const eksikDef: CalcDefinition = {
    ...def,
    slug: "eksik-deneme",
    inputs: def.inputs.map((i) => (i.key === "R" ? { ...(i as NumberInputSpec), default: undefined } : i)),
  };

  function defaultState(d: CalcDefinition): InputState {
    const state: InputState = {};
    for (const i of d.inputs) {
      state[i.key] =
        i.kind === "select"
          ? { value: i.default }
          : { value: i.default === undefined ? "" : String(i.default), unit: i.defaultUnit };
    }
    return state;
  }

  function runCalc(
    d: CalcDefinition,
    state: InputState,
    options?: { outputUnits?: Record<string, string> },
  ): RunResult {
    const mode = state.bilinmeyen.value;
    const needed = mode === "akim" ? ["U", "R"] : ["I", "R"];
    const fieldErrors: Record<string, string> = {};
    const si: Record<string, number> = {};
    for (const key of needed) {
      const raw = state[key].value.trim().replace(",", ".");
      if (raw === "") {
        fieldErrors[key] = "Bu alan zorunlu.";
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        fieldErrors[key] = "Geçerli bir sayı girin.";
        continue;
      }
      const v = n * UNITS[state[key].unit!].factor;
      if (key === "R" && v <= 0) {
        fieldErrors[key] = "Direnç sıfırdan büyük olmalı.";
        continue;
      }
      si[key] = v;
    }
    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, checks: [] };

    const outKey = mode === "akim" ? "akim" : "gerilim";
    const valueSI = mode === "akim" ? si.U / si.R : si.I * si.R;
    const spec = d.outputs.find((o) => o.key === outKey)!;
    const unit = options?.outputUnits?.[outKey] ?? spec.defaultUnit;
    const value = valueSI / UNITS[unit].factor;
    const checks =
      mode === "akim" && valueSI > 10
        ? [
            {
              level: "uyari" as const,
              message: "Akım 10 A sınırını aşıyor.",
              reference: { standard: "IEC 60050", clause: "Bölüm 131" },
            },
          ]
        : [{ level: "ok" as const, message: "Değer sınır içinde." }];
    const inputsSI: ComputeInputs = { ...si, bilinmeyen: mode };
    return {
      ok: true,
      inputsSI,
      result: {
        outputs: { [outKey]: valueSI },
        steps: [{ label: "Ohm yasası", latex: `${spec.symbol} = ${valueSI}` }],
        checks,
      },
      outputs: [
        {
          key: outKey,
          label: spec.label,
          symbol: spec.symbol,
          value,
          unit,
          formatted: `${value} ${unit}`,
          formattedValue: String(value).replace(".", ","),
        },
      ],
    };
  }

  return {
    UNITS,
    def,
    eksikDef,
    defaultState,
    runCalc: vi.fn(runCalc),
  };
});

vi.mock("@/lib/calc/registry", () => ({
  getCalc: (slug: string) =>
    slug === mocks.def.slug ? mocks.def : slug === mocks.eksikDef.slug ? mocks.eksikDef : undefined,
}));

vi.mock("@/lib/calc/engine", () => ({
  defaultState: mocks.defaultState,
  runCalc: mocks.runCalc,
}));

vi.mock("@/lib/units", () => ({
  getUnit: (id: string) => {
    const unit = mocks.UNITS[id];
    if (!unit) throw new Error(`bilinmeyen birim: ${id}`);
    return unit;
  },
  unitsFor: (dimension: string) => Object.values(mocks.UNITS).filter((u) => u.dimension === dimension),
  formatNumber: (value: number) =>
    Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6).replace(".", ",") : "—",
}));

beforeEach(() => {
  // Not: süslü parantez şart; beforeEach'ten dönen fonksiyon test sonrası temizlik olarak çağrılır.
  mocks.runCalc.mockClear();
});
afterEach(cleanup);

function outputValue(key: string): string {
  const card = document.querySelector(`[data-output="${key}"]`);
  if (!card) throw new Error(`çıktı kartı yok: ${key}`);
  return card.querySelector("data")?.textContent ?? "";
}

function lastRunState(): InputState {
  const calls = mocks.runCalc.mock.calls;
  return calls[calls.length - 1][1];
}

describe("<CalcForm>", () => {
  it("varsayılan değerlerle sonucu gösterir, girdi değişince günceller", () => {
    render(<CalcForm slug="ohm-deneme" />);
    expect(outputValue("akim")).toBe("2");

    fireEvent.change(screen.getByLabelText("Gerilim"), { target: { value: "24" } });
    expect(outputValue("akim")).toBe("4");

    // Türkçe ondalık virgül: bileşen ham metni motora iletir, ayrıştırma motorun işidir.
    fireEvent.change(screen.getByLabelText("Gerilim"), { target: { value: "1,5" } });
    expect(lastRunState().U.value).toBe("1,5");
    expect(outputValue("akim")).toBe("0,25");
  });

  it("girdiyi etiketiyle, yardım metniyle ve ondalık klavyeyle bağlar", () => {
    render(<CalcForm slug="ohm-deneme" />);
    const input = screen.getByLabelText("Direnç") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("text");
    expect(input.inputMode).toBe("decimal");
    expect(input.value).toBe("6");

    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).not.toBe("");
    const help = document.getElementById(describedBy.split(" ")[0]);
    expect(help?.textContent).toBe("Yük direnci");

    // Birim seçimi: tanımdaki `units` listesi, seçenek metni birim sembolü
    const unitSelect = screen.getByLabelText("Direnç birimi") as HTMLSelectElement;
    expect([...unitSelect.options].map((o) => o.textContent)).toEqual(["Ω", "kΩ"]);
    // `units` verilmeyen girdide boyutun tüm birimleri
    const voltSelect = screen.getByLabelText("Gerilim birimi") as HTMLSelectElement;
    expect([...voltSelect.options].map((o) => o.value)).toEqual(["V", "kV"]);
  });

  it("geçersiz girdide hatayı alanın altında gösterir ve erişilebilir biçimde bağlar", () => {
    render(<CalcForm slug="ohm-deneme" />);
    const input = screen.getByLabelText("Direnç");

    fireEvent.change(input, { target: { value: "abc" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const ids = (input.getAttribute("aria-describedby") ?? "").split(" ");
    const errorEl = ids.map((id) => document.getElementById(id)).find((el) => el?.textContent === "Geçerli bir sayı girin.");
    expect(errorEl).toBeTruthy();

    // Sonuç paneli: hesap yapılamadı + hatalı alana bağlantı
    expect(screen.getByText("Sonuç hesaplanamadı.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Direnç" });
    expect(link.getAttribute("href")).toBe(`#${input.id}`);
    expect(document.querySelector('[data-output="akim"]')).toBeNull();

    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.getAllByText("Direnç sıfırdan büyük olmalı.").length).toBeGreaterThan(0);

    fireEvent.change(input, { target: { value: "3" } });
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByText("Sonuç hesaplanamadı.")).toBeNull();
    expect(outputValue("akim")).toBe("4");
  });

  it("boş ve dokunulmamış zorunlu alanda satır içi hata göstermez, özette listeler", () => {
    render(<CalcForm slug="eksik-deneme" />);
    const input = screen.getByLabelText("Direnç");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByText("Sonuç hesaplanamadı.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Direnç" })).toBeTruthy();
    expect(screen.getAllByText(/Bu alan zorunlu\./)).toHaveLength(1);

    // Kullanıcı alana dokunup boş bırakırsa hata alanın altında da görünür.
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByText(/Bu alan zorunlu\./)).toHaveLength(2);
  });

  it("visibleWhen'e göre alanları gizler ve gösterir", () => {
    render(<CalcForm slug="ohm-deneme" />);
    expect(screen.getByLabelText("Gerilim")).toBeTruthy();
    expect(screen.queryByLabelText("Akım")).toBeNull();

    const radio = screen.getByRole("radio", { name: "Gerilimi hesapla" }) as HTMLInputElement;
    expect(screen.getByRole("group", { name: "Hesaplanacak" })).toBeTruthy();
    fireEvent.click(radio);

    expect(radio.checked).toBe(true);
    expect(screen.queryByLabelText("Gerilim")).toBeNull();
    expect(screen.getByLabelText("Akım")).toBeTruthy();
    expect(lastRunState().bilinmeyen.value).toBe("gerilim");
    expect(outputValue("gerilim")).toBe("12");
  });

  it("çıktı birimi değişince motoru outputUnits ile çalıştırır", () => {
    render(<CalcForm slug="ohm-deneme" />);
    const select = screen.getByLabelText("Hesaplanan akım birimi") as HTMLSelectElement;
    expect(select.value).toBe("A");

    fireEvent.change(select, { target: { value: "mA" } });
    const calls = mocks.runCalc.mock.calls;
    expect(calls[calls.length - 1][2]).toEqual({ outputUnits: { akim: "mA" } });
    expect(outputValue("akim")).toBe("2000");
    expect((screen.getByLabelText("Hesaplanan akım birimi") as HTMLSelectElement).value).toBe("mA");
  });

  it("girdi birimi değişince yazılan sayı korunur, birim durumu güncellenir", () => {
    render(<CalcForm slug="ohm-deneme" />);
    fireEvent.change(screen.getByLabelText("Direnç birimi"), { target: { value: "kohm" } });
    expect((screen.getByLabelText("Direnç") as HTMLInputElement).value).toBe("6");
    expect(lastRunState().R).toEqual({ value: "6", unit: "kohm" });
    expect(outputValue("akim")).toBe("0,002");
  });

  it("durum kontrollerini seviyesine ve referansına göre gösterir", () => {
    render(<CalcForm slug="ohm-deneme" />);
    const okItem = document.querySelector('[data-level="ok"]') as HTMLElement;
    expect(okItem.textContent).toContain("Uygun:");

    fireEvent.change(screen.getByLabelText("Gerilim"), { target: { value: "120" } });
    const warn = document.querySelector('[data-level="uyari"]') as HTMLElement;
    expect(warn).toBeTruthy();
    expect(warn.textContent).toContain("Uyarı:");
    expect(warn.textContent).toContain("Akım 10 A sınırını aşıyor.");
    expect(within(warn).getByText("IEC 60050")).toBeTruthy();
    expect(warn.textContent).toContain("Bölüm 131");
  });

  it("sonuç bölgesini aria-live ile duyurur ve ara adımları KaTeX ile gösterir", () => {
    const { container } = render(<CalcForm slug="ohm-deneme" />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.querySelector('[data-output="akim"]')).toBeTruthy();

    const stepsHeading = screen.getByText("Ara adımlar");
    const steps = stepsHeading.parentElement as HTMLElement;
    expect(steps.textContent).toContain("Ohm yasası");
    expect(steps.querySelector(".katex-display")).toBeTruthy();
  });

  it("varsayılanlara dön düğmesi durumu sıfırlar", () => {
    render(<CalcForm slug="ohm-deneme" />);
    fireEvent.change(screen.getByLabelText("Gerilim"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "Varsayılanlara dön" }));
    expect((screen.getByLabelText("Gerilim") as HTMLInputElement).value).toBe("12");
    expect(outputValue("akim")).toBe("2");
  });

  it("bilinmeyen slug için Türkçe hata mesajı gösterir", () => {
    render(<CalcForm slug="olmayan-hesap" />);
    expect(screen.getByRole("alert").textContent).toContain("Hesap tanımı bulunamadı");
  });
});
