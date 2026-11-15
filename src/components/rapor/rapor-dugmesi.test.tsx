// @vitest-environment jsdom
/**
 * Rapor düğmeleri: hangi uç noktaya ne gönderildiği, meşgul durumu, hata mesajı ve indirme dosya adı.
 * fetch ve URL.createObjectURL taklit edilir; hesap tanımı ve useCalcState gerçektir.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalcState } from "@/components/calc/use-calc-state";
import { getCalc } from "@/lib/calc/registry";
import type { KayitliHesap } from "@/lib/kayit/types";
import { pdfContentDisposition } from "@/lib/rapor/dosya-adi";
import { KarsilastirmaRaporDugmesi } from "./karsilastirma-rapor-dugmesi";
import { ProjeRaporDugmesi } from "./proje-rapor-dugmesi";
import { RaporDugmesi } from "./rapor-dugmesi";

const def = getCalc("ohm-yasasi")!;

function Sarmal({ kayit, degistir }: { kayit?: KayitliHesap | null; degistir?: boolean }) {
  const calc = useCalcState(def, kayit ? { state: kayit.girdiler, outputUnits: kayit.ciktiBirimleri } : undefined);
  return (
    <>
      {degistir && (
        <button type="button" onClick={() => calc.setNumberValue(def.inputs[1] as never, "99")}>
          değiştir
        </button>
      )}
      <RaporDugmesi calc={calc} kayit={kayit} />
    </>
  );
}

const KAYIT: KayitliHesap = {
  id: "kayit/1",
  projeId: null,
  hesapSlug: "ohm-yasasi",
  hesapId: "1.1",
  ad: "Aydınlatma hattı",
  notlar: null,
  girdiler: { R: { value: "7", unit: "ohm" } },
  ciktiBirimleri: {},
  createdAt: "",
  updatedAt: "",
};

let fetchMock: ReturnType<typeof vi.fn>;
let indirilen: string[];

function pdfYaniti(ad: string): Response {
  return new Response("%PDF-1.7", {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": pdfContentDisposition(ad) },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  indirilen = [];
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    indirilen.push(this.download);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("RaporDugmesi", () => {
  it("kayıtsız hesap: mevcut durumla POST; meşgulken devre dışı, sonra indirir", async () => {
    let coz!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (coz = r)));
    render(<Sarmal />);
    fireEvent.click(screen.getByRole("button", { name: /PDF rapor/ }));

    const dugme = screen.getByRole("button", { name: /Hazırlanıyor/ });
    expect(dugme).toHaveProperty("disabled", true);
    expect(dugme.getAttribute("aria-busy")).toBe("true");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/rapor/hesap");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const govde = JSON.parse(String(init.body));
    expect(govde).toMatchObject({ hesapSlug: "ohm-yasasi", ciktiBirimleri: {} });
    expect(govde.girdiler.V).toEqual({ value: "12", unit: "V" });
    expect(govde).not.toHaveProperty("ad");

    await act(async () => coz(pdfYaniti("Ohm yasası ve güç")));
    await waitFor(() => expect(indirilen).toEqual(["Ohm yasası ve güç.pdf"]));
    expect(screen.getByRole("button", { name: /PDF rapor/ })).toHaveProperty("disabled", false);
  });

  it("kayıtlı ve değişmemiş: GET /api/rapor/hesap/[id]", async () => {
    fetchMock.mockResolvedValue(pdfYaniti("Aydınlatma hattı"));
    render(<Sarmal kayit={KAYIT} />);
    fireEvent.click(screen.getByRole("button", { name: /PDF rapor/ }));
    await waitFor(() => expect(indirilen).toHaveLength(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/rapor/hesap/kayit%2F1");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("GET");
    expect(screen.queryByText(/Kaydedilmemiş değişiklikler/)).toBeNull();
  });

  it("kayıtlı ama form değişmiş: ekrandaki durumla POST, başlık için kaydın adı", async () => {
    fetchMock.mockResolvedValue(pdfYaniti("Aydınlatma hattı"));
    render(<Sarmal kayit={KAYIT} degistir />);
    fireEvent.click(screen.getByRole("button", { name: "değiştir" }));
    expect(screen.getByText(/Kaydedilmemiş değişiklikler rapora dahil edilir/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /PDF rapor/ }));
    await waitFor(() => expect(indirilen).toHaveLength(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/rapor/hesap");
    expect(JSON.parse(String(init.body))).toMatchObject({ ad: "Aydınlatma hattı" });
  });

  it("sunucu hatasında mesaj gösterilir (role=alert), düğme yeniden kullanılabilir", async () => {
    fetchMock.mockResolvedValue(Response.json({ hata: "Kayıt bulunamadı." }, { status: 404 }));
    render(<Sarmal kayit={KAYIT} />);
    fireEvent.click(screen.getByRole("button", { name: /PDF rapor/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Kayıt bulunamadı."));
    const dugme = screen.getByRole("button", { name: /PDF rapor/ });
    expect(dugme).toHaveProperty("disabled", false);
    expect(dugme.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
    expect(indirilen).toEqual([]);
  });

  it("ağ hatasında Türkçe mesaj", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Sarmal />);
    fireEvent.click(screen.getByRole("button", { name: /PDF rapor/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Sunucuya ulaşılamadı/));
  });
});

describe("Activity (cacheComponents) ile gizlenme", () => {
  it("sayfa gizlenip geri gelince eski hata mesajı kalmaz", async () => {
    fetchMock.mockResolvedValue(Response.json({ hata: "Proje bulunamadı." }, { status: 404 }));
    const { rerender } = render(
      <Activity mode="visible">
        <ProjeRaporDugmesi projeId="p1" />
      </Activity>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Proje raporu/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Proje bulunamadı."));
    rerender(
      <Activity mode="hidden">
        <ProjeRaporDugmesi projeId="p1" />
      </Activity>,
    );
    rerender(
      <Activity mode="visible">
        <ProjeRaporDugmesi projeId="p1" />
      </Activity>,
    );
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(""));
    expect(screen.getByRole("button", { name: /Proje raporu/ })).toHaveProperty("disabled", false);
  });
});

describe("ProjeRaporDugmesi ve KarsilastirmaRaporDugmesi", () => {
  it("proje raporu GET ile indirilir", async () => {
    fetchMock.mockResolvedValue(pdfYaniti("Fabrika A - Proje raporu"));
    render(<ProjeRaporDugmesi projeId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /Proje raporu \(PDF\)/ }));
    await waitFor(() => expect(indirilen).toEqual(["Fabrika A - Proje raporu.pdf"]));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/rapor/proje/p1");
  });

  it("karşılaştırma raporu senaryoları (ad + state) ve taramayı POST eder", async () => {
    fetchMock.mockResolvedValue(pdfYaniti("Ohm"));
    const senaryolar = [
      { id: "a", ad: "A", state: { R: { value: "1", unit: "ohm" } }, kayitId: "k1" },
      { id: "b", ad: "B", state: { R: { value: "2", unit: "ohm" } } },
    ];
    const tarama = { girdiKey: "R", ciktiKey: "I", baslangic: 1, bitis: 10, birim: "ohm", noktaSayisi: 10 };
    render(<KarsilastirmaRaporDugmesi hesapSlug="ohm-yasasi" senaryolar={senaryolar} tarama={tarama} />);
    fireEvent.click(screen.getByRole("button", { name: /Karşılaştırma raporu/ }));
    await waitFor(() => expect(indirilen).toHaveLength(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/rapor/karsilastirma");
    expect(JSON.parse(String(init.body))).toEqual({
      hesapSlug: "ohm-yasasi",
      senaryolar: [
        { ad: "A", state: { R: { value: "1", unit: "ohm" } } },
        { ad: "B", state: { R: { value: "2", unit: "ohm" } } },
      ],
      tarama,
    });
  });

  it("senaryo yoksa ya da 8'den fazlaysa devre dışı ve nedeni yazılı", () => {
    const { rerender } = render(<KarsilastirmaRaporDugmesi hesapSlug="ohm-yasasi" senaryolar={[]} />);
    expect(screen.getByRole("button", { name: /Karşılaştırma raporu/ })).toHaveProperty("disabled", true);
    expect(screen.getByText(/en az bir senaryo/)).toBeTruthy();
    const dokuz = Array.from({ length: 9 }, (_, i) => ({ id: String(i), ad: String(i), state: {} }));
    rerender(<KarsilastirmaRaporDugmesi hesapSlug="ohm-yasasi" senaryolar={dokuz} />);
    expect(screen.getByRole("button", { name: /Karşılaştırma raporu/ })).toHaveProperty("disabled", true);
    expect(screen.getByText(/en çok 8 senaryo/)).toBeTruthy();
  });
});
