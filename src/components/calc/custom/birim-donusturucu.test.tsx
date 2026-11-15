// @vitest-environment jsdom
/**
 * Birim dönüştürücü arayüzü testleri. Gerçek kayıt defteri, motor ve birim sistemiyle çalışır;
 * runCalc yalnızca sarmalanır (çağrıldığını ve InputState aldığını doğrulamak için).
 * Beklenen değerler elle: 1 kW = 1000 W = 1,341022 hp (1 hp = 745,69987 W); 20 °C = 293,15 K = 68 °F;
 * 4/0 AWG = 0,4600 inç = 11,684 mm, A = π/4 · 11,684² = 107,219 mm² (NBS Handbook 100).
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCalc } from "@/lib/calc/engine";
import type { InputState } from "@/lib/calc/types";
import { getCalc } from "@/lib/calc/registry";
import { useCalcState } from "../use-calc-state";
import { BirimDonusturucuBagimsiz as BirimDonusturucu } from "./birim-donusturucu";
import { CustomCalc } from "./index";

vi.mock("@/lib/calc/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/calc/engine")>();
  return { ...actual, runCalc: vi.fn(actual.runCalc) };
});

const runCalcMock = vi.mocked(runCalc);

beforeEach(() => {
  runCalcMock.mockClear();
});
afterEach(cleanup);

function lastState(): InputState {
  const calls = runCalcMock.mock.calls;
  return calls[calls.length - 1][1];
}

function cell(unit: string): string {
  const el = document.querySelector(`[data-unit="${unit}"] data`);
  if (!el) throw new Error(`satır yok: ${unit}`);
  return el.textContent ?? "";
}

describe("<BirimDonusturucu>", () => {
  it("varsayılan: 1 kW tüm güç birimlerinde, sonuç runCalc ve InputState ile alınır", () => {
    render(<BirimDonusturucu slug="birim-donusturucu" />);
    expect(runCalcMock).toHaveBeenCalled();
    expect(runCalcMock.mock.calls[0][0].slug).toBe("birim-donusturucu");
    expect(lastState()).toMatchObject({ buyukluk: { value: "guc" }, x_guc: { value: "1", unit: "kW" } });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Güç: tüm birimlerde")).toBeTruthy();
    expect(cell("W")).toBe("1000 W");
    expect(cell("kW")).toBe("1 kW");
    expect(cell("hp")).toBe("1,34102 hp");
    expect(cell("PS")).toBe("1,35962 PS"); // 1000 / 735,49875
    // Girdi birimi satırı işaretlenir
    expect(document.querySelector('[data-unit="kW"]')?.textContent).toContain("girdi");
  });

  it("değer ve birim değişince tablo güncellenir; birim değişiminde sayı korunur", () => {
    render(<BirimDonusturucu slug="birim-donusturucu" />);
    const input = screen.getByLabelText("Güç") as HTMLInputElement;
    expect(input.inputMode).toBe("decimal");

    fireEvent.change(input, { target: { value: "2" } });
    expect(cell("W")).toBe("2000 W");

    fireEvent.change(screen.getByLabelText("Güç birimi"), { target: { value: "hp" } });
    expect(input.value).toBe("2");
    expect(lastState().x_guc).toEqual({ value: "2", unit: "hp" });
    expect(cell("W")).toBe("1491,4 W"); // 2 · 745,69987
  });

  it("büyüklük değişince ilgili alan ve tablo gelir; geçersiz değer erişilebilir hata verir", () => {
    render(<BirimDonusturucu slug="birim-donusturucu" />);
    fireEvent.change(screen.getByLabelText("Büyüklük"), { target: { value: "sicaklik" } });
    expect(screen.queryByLabelText("Güç")).toBeNull();
    const input = screen.getByLabelText("Sıcaklık") as HTMLInputElement;
    expect(input.value).toBe("20");
    expect(cell("K")).toBe("293,15 K");
    expect(cell("degF")).toBe("68 °F");

    fireEvent.change(input, { target: { value: "-300" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errorId = (input.getAttribute("aria-describedby") ?? "").split(" ")[0];
    expect(document.getElementById(errorId)?.textContent).toMatch(/En az/);
    expect(screen.getByText("Sonuç hesaplanamadı.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sıcaklık" }).getAttribute("href")).toBe(`#${input.id}`);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("AWG → mm²: boyut listesinden 4/0 seçilir, çap ve kesit gösterilir", () => {
    render(<BirimDonusturucu slug="birim-donusturucu" />);
    fireEvent.change(screen.getByLabelText("Büyüklük"), { target: { value: "awg" } });
    expect(screen.getByRole("group", { name: "Dönüşüm yönü" })).toBeTruthy();

    const select = screen.getByLabelText("AWG numarası") as HTMLSelectElement;
    expect(select.value).toBe("14");
    expect(select.options[0].textContent).toBe("4/0 (0000)");
    fireEvent.change(select, { target: { value: "-3" } });
    expect(lastState().awg_no).toEqual({ value: "-3" });

    const cap = document.querySelector('[data-awg="cap"]')?.textContent ?? "";
    expect(cap).toContain("11,684 mm");
    expect(cap).toContain("0,46 inç");
    expect(document.querySelector('[data-awg="alan"]')?.textContent).toContain("107,219 mm²");
    // Ara adımlar KaTeX ile
    expect(screen.getByText("Ara adımlar").parentElement?.querySelector(".katex-display")).toBeTruthy();
  });

  it("mm² → AWG: 2,5 mm² → en yakın 13 AWG, komşular 12 ve 14", () => {
    render(<BirimDonusturucu slug="birim-donusturucu" />);
    fireEvent.change(screen.getByLabelText("Büyüklük"), { target: { value: "awg" } });
    fireEvent.click(screen.getByRole("radio", { name: "mm² → AWG" }));
    expect((screen.getByLabelText("Kesit") as HTMLInputElement).value).toBe("2,5");

    expect(document.querySelector('[data-awg="yakin"]')?.textContent).toContain("13 AWG");
    expect(document.querySelector('[data-awg="buyuk"]')?.textContent).toContain("12 AWG");
    expect(document.querySelector('[data-awg="kucuk"]')?.textContent).toContain("14 AWG");
    expect(document.querySelector('[data-level="bilgi"]')?.textContent).toContain("13 AWG");
  });

  it("sonuç bölgesi aria-live ile duyurulur; varsayılanlara dön durumu sıfırlar", () => {
    const { container } = render(<BirimDonusturucu slug="birim-donusturucu" />);
    expect(container.querySelector('[aria-live="polite"] table')).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Büyüklük"), { target: { value: "uzunluk" } });
    fireEvent.change(screen.getByLabelText("Uzunluk"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "Varsayılanlara dön" }));
    expect((screen.getByLabelText("Büyüklük") as HTMLSelectElement).value).toBe("guc");
    expect((screen.getByLabelText("Güç") as HTMLInputElement).value).toBe("1");
  });

  it("CustomCalc eşlemesi dönüştürücüyü gösterir; bilinmeyen slug Türkçe hata verir", () => {
    function Harness() {
      const calc = useCalcState(getCalc("birim-donusturucu")!);
      return <CustomCalc id="birim-donusturucu" calc={calc} />;
    }
    render(<Harness />);
    expect(screen.getByLabelText("Büyüklük")).toBeTruthy();
    cleanup();
    render(<BirimDonusturucu slug="olmayan" />);
    expect(screen.getByRole("alert").textContent).toContain("Hesap tanımı bulunamadı");
  });
});
