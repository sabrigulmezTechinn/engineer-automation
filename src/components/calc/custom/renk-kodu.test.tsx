// @vitest-environment jsdom
/**
 * 4.5 renk kodu arayüzü testleri. Gerçek kayıt defteri, motor ve birim sistemiyle çalışır; runCalc yalnızca
 * sarmalanır (sonucun runCalc'tan ve InputState'ten geldiğini doğrulamak için).
 * Beklenen değerler: Sarı–Mor–Kırmızı–Altın = 4,7 kΩ ±%5; Sarı–Mor–Turuncu = 47 kΩ (Vishay 20020 renk kodu);
 * 4R7 = 4,7 Ω (TT TN004); 01C = 100·10² = 10 kΩ (Bourns EIA-96); 229C = 2,2 pF ±0,25 pF (KEMET C0G).
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCalc } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import type { InputState } from "@/lib/calc/types";
import { useCalcState } from "../use-calc-state";
import { CustomCalc } from "./index";
import { RENK_GORUNUM, RenkKoduBagimsiz as RenkKodu } from "./renk-kodu";

vi.mock("@/lib/calc/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/calc/engine")>();
  return { ...actual, runCalc: vi.fn(actual.runCalc) };
});

const runCalcMock = vi.mocked(runCalc);
const SLUG = "renk-smd-kondansator-kodlari";

beforeEach(() => {
  runCalcMock.mockClear();
});
afterEach(cleanup);

function lastState(): InputState {
  const calls = runCalcMock.mock.calls;
  return calls[calls.length - 1][1];
}

/** Üstteki görsel panel (genel form aynı etiketleri tekrarladığı için sorgular bu bölgeyle sınırlanır). */
function panel() {
  return within(screen.getByRole("region", { name: "Kod görseli" }));
}

function ozet(): string {
  return document.querySelector("[data-ozet]")?.textContent ?? "";
}

function bantlar(): string[] {
  return Array.from(document.querySelectorAll("[data-direnc] [data-bant]")).map((el) => el.getAttribute("data-renk") ?? "");
}

function sonucKarti(key: string): string {
  return document.querySelector(`[data-output="${key}"] data`)?.textContent ?? "";
}

describe("<RenkKodu>", () => {
  it("varsayılan: 4 bantlı direnç çizimi, sonuç runCalc'tan (4,7 kΩ ±%5) ve genel form altta", () => {
    render(<RenkKodu slug={SLUG} />);
    expect(runCalcMock).toHaveBeenCalled();
    expect(runCalcMock.mock.calls[0][0].slug).toBe(SLUG);
    expect(lastState()).toMatchObject({ mod: { value: "renk" }, bant: { value: "4" }, b1: { value: "sari" } });

    expect(bantlar()).toEqual(["sari", "mor", "kirmizi", "altin"]);
    const svg = panel().getByRole("img", { name: /Direnç çizimi/ });
    expect(svg.getAttribute("aria-label")).toBe("Direnç çizimi: Sarı (4), Mor (7), Kırmızı (×100), Altın (±%5)");
    expect(document.querySelector('[data-bant="b1"]')?.getAttribute("fill")).toBe(RENK_GORUNUM.sari);
    expect(ozet()).toContain("4,7 kΩ");
    expect(ozet()).toContain("±%5");
    // Genel formun sonuç kartı aynı sonucu gösterir
    expect(sonucKarti("R")).toBe("4,7");
    expect(screen.getByText("Ara adımlar")).toBeTruthy();
  });

  it("bant rengi renk örneğinden seçilir: çarpan turuncu → 47 kΩ; durum InputState'e yazılır", () => {
    render(<RenkKodu slug={SLUG} />);
    const grup = panel().getByRole("group", { name: /Çarpan bandı/ });
    const turuncu = within(grup).getByRole("radio", { name: "Turuncu (×1 k)" }) as HTMLInputElement;
    fireEvent.click(turuncu);
    expect(turuncu.checked).toBe(true);
    expect(lastState().carpan).toEqual({ value: "turuncu" });
    expect(bantlar()).toEqual(["sari", "mor", "turuncu", "altin"]);
    expect(ozet()).toContain("47 kΩ");
    // Genel formdaki açılır liste de aynı durumu gösterir
    expect((screen.getByLabelText("Çarpan bandı", { selector: "select" }) as HTMLSelectElement).value).toBe("turuncu");
  });

  it("ilk bantta siyah sunulmaz; 5 ve 6 bantta 3. rakam ve TCR bantları gelir", () => {
    render(<RenkKodu slug={SLUG} />);
    const ilk = panel().getByRole("group", { name: /1\. bant/ });
    expect(within(ilk).queryByRole("radio", { name: "Siyah (0)" })).toBeNull();
    expect(panel().queryByRole("group", { name: /3\. bant/ })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "6 bant" }));
    expect(panel().getByRole("group", { name: /3\. bant/ })).toBeTruthy();
    expect(panel().getByRole("group", { name: /6\. bant/ })).toBeTruthy();
    expect(bantlar()).toEqual(["sari", "mor", "siyah", "kirmizi", "altin", "kahverengi"]);
    expect(ozet()).toContain("47 kΩ");
    expect(sonucKarti("tcr")).toBe("100");
  });

  it("tolerans bandı 'Yok' seçilince çizimde bant kalmaz, tolerans ±%20", () => {
    render(<RenkKodu slug={SLUG} />);
    const grup = panel().getByRole("group", { name: /Tolerans bandı/ });
    fireEvent.click(within(grup).getByRole("radio", { name: "Yok (±%20)" }));
    expect(bantlar()).toEqual(["sari", "mor", "kirmizi"]);
    expect(ozet()).toContain("±%20");
  });

  it("SMD: tek metin kutusu kodu ayrıştırıp girdilere yazar (4R7, 01C); geçersiz kod durum değiştirmez", () => {
    render(<RenkKodu slug={SLUG} />);
    fireEvent.click(screen.getByRole("radio", { name: "SMD direnç kodu" }));
    const kutu = panel().getByRole("textbox", { name: "SMD kodu" }) as HTMLInputElement;
    expect(kutu.value).toBe("472");
    expect(ozet()).toContain("4,7 kΩ");

    fireEvent.change(kutu, { target: { value: "4r7" } });
    expect(lastState()).toMatchObject({ tip: { value: "3" }, s3_1: { value: "4" }, s3_2: { value: "R" }, s3_3: { value: "7" } });
    expect(ozet()).toContain("4,7 Ω");
    expect(panel().getByRole("img", { name: "SMD direnç çizimi: 4R7" })).toBeTruthy();

    fireEvent.change(kutu, { target: { value: "01C" } });
    expect(lastState()).toMatchObject({ tip: { value: "eia96" }, eia_harf: { value: "C" }, eia_kod: { value: "1" } });
    expect(ozet()).toContain("10 kΩ");
    // Genel formda EIA-96 alanları görünür
    expect((screen.getByLabelText("EIA-96 kodu (ilk iki hane)") as HTMLInputElement).value).toBe("1");

    const onceki = lastState();
    fireEvent.change(kutu, { target: { value: "4K7" } });
    expect(kutu.getAttribute("aria-invalid")).toBe("true");
    const errorId = (kutu.getAttribute("aria-describedby") ?? "").split(" ")[0];
    expect(document.getElementById(errorId)?.textContent).toMatch(/Tanınmayan SMD kodu/);
    expect(lastState()).toEqual(onceki);
    expect(ozet()).toContain("10 kΩ");
  });

  it("odak bırakılınca kutu girdilerden yeniden yazılır; genel formdaki değişiklik kutuya yansır", () => {
    render(<RenkKodu slug={SLUG} />);
    fireEvent.click(screen.getByRole("radio", { name: "SMD direnç kodu" }));
    const kutu = panel().getByRole("textbox", { name: "SMD kodu" }) as HTMLInputElement;
    fireEvent.change(kutu, { target: { value: "r47" } });
    fireEvent.blur(kutu);
    expect(kutu.value).toBe("R47");

    fireEvent.change(screen.getByLabelText("3. karakter", { selector: "select" }), { target: { value: "5" } });
    expect(kutu.value).toBe("R45");
    expect(ozet()).toContain("450 mΩ");
  });

  it("kondansatör: 229C → 2,2 pF ±0,25 pF; tolerans harfi girdiye yazılır", () => {
    render(<RenkKodu slug={SLUG} />);
    fireEvent.click(screen.getByRole("radio", { name: "Kondansatör kodu" }));
    const kutu = panel().getByRole("textbox", { name: "Kondansatör kodu" }) as HTMLInputElement;
    expect(kutu.value).toBe("104J");
    expect(ozet()).toContain("100 nF");

    fireEvent.change(kutu, { target: { value: "229C" } });
    expect(lastState()).toMatchObject({ k1: { value: "2" }, k2: { value: "2" }, k3: { value: "9" }, ktol: { value: "C" } });
    expect(ozet()).toContain("2,2 pF");
    expect(ozet()).toContain("±0,25 pF");
    expect(panel().getByRole("img", { name: "Kondansatör çizimi: 229C" })).toBeTruthy();
  });

  it("varsayılanlara dön paneli de sıfırlar; CustomCalc eşlemesi paneli gösterir; bilinmeyen slug hata verir", () => {
    function Harness() {
      const calc = useCalcState(getCalc(SLUG)!);
      return <CustomCalc id="renk-kodu" calc={calc} />;
    }
    render(<Harness />);
    fireEvent.click(within(panel().getByRole("group", { name: /Çarpan bandı/ })).getByRole("radio", { name: "Siyah (×1)" }));
    expect(ozet()).toContain("47 Ω");
    fireEvent.click(screen.getByRole("button", { name: "Varsayılanlara dön" }));
    expect(ozet()).toContain("4,7 kΩ");
    cleanup();
    render(<RenkKodu slug="olmayan" />);
    expect(screen.getByRole("alert").textContent).toContain("Hesap tanımı bulunamadı");
  });
});
