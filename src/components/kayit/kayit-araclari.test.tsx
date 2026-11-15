// @vitest-environment jsdom
/**
 * Hesap sayfasında kaydetme araçları: gerçek CalcWorkspace + gerçek kayıt defteri/motor; server action'lar ve
 * yönlendirici taklit edilir. Kayıtla açılan sayfanın kayıtlı durumla geldiği (calisma-alani.tsx → CalcWorkspace
 * → useCalcState) ve kaydedilmemiş değişiklik göstergesi burada denenir.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Activity, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalcWorkspace } from "@/components/calc/calc-workspace";
import type { KayitliHesap, Proje } from "@/lib/kayit/types";

const m = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  kayitOlusturAction: vi.fn(),
  kayitGuncelleAction: vi.fn(),
  projeleriGetirAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: m.replace }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/kayit/actions", () => ({
  kayitOlusturAction: m.kayitOlusturAction,
  kayitGuncelleAction: m.kayitGuncelleAction,
  projeleriGetirAction: m.projeleriGetirAction,
}));
// Diğer işçilerin yuvaları bu testin konusu değil.
vi.mock("@/components/rapor/rapor-dugmesi", () => ({ RaporDugmesi: () => null }));
vi.mock("@/components/karsilastirma/senaryo-paneli", () => ({ SenaryoPaneli: () => null }));

const PROJE: Proje = {
  id: "p-1",
  ad: "Fabrika",
  aciklama: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  hesapSayisi: 1,
};

/** Veritabanından dönmüş gibi: alan sırası karışık (jsonb), R girdisi eksik (varsayılandan gelir) */
const KAYIT: KayitliHesap = {
  id: "k-1",
  projeId: "p-1",
  hesapSlug: "ohm-yasasi",
  hesapId: "1.1",
  ad: "Pano besleme",
  notlar: null,
  girdiler: { V: { unit: "kV", value: "0,4" }, mod: { value: "V-R" } },
  ciktiBirimleri: { I: "mA" },
  createdAt: "2026-11-02T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

function gerilimAlani() {
  const input = screen.getByLabelText("Gerilim") as HTMLInputElement;
  const birim = input.parentElement!.querySelector("select") as HTMLSelectElement;
  return { input, birim };
}

const gosterge = () => screen.queryByText("Kaydedilmemiş değişiklik");

beforeEach(() => {
  vi.clearAllMocks();
  m.projeleriGetirAction.mockResolvedValue({ ok: true, veri: [PROJE] });
});
afterEach(cleanup);

describe("<KayitAraclari> (CalcWorkspace içinde)", () => {
  it("oturum yoksa giriş bağlantısı gösterir (dönüş: hesabın adresi)", () => {
    render(<CalcWorkspace slug="ohm-yasasi" girisYapildi={false} />);
    const link = screen.getByRole("link", { name: "Kaydetmek için giriş yapın" });
    expect(link.getAttribute("href")).toBe("/giris?yonlendir=/hesaplar/ohm-yasasi");
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull();
    expect(m.projeleriGetirAction).not.toHaveBeenCalled();
  });

  it("kayıtla açılan sayfa kayıtlı durumla gelir; değişiklik göstergesi; Kaydet aynı kayda yazar", async () => {
    render(<CalcWorkspace slug="ohm-yasasi" kayit={KAYIT} girisYapildi />);

    // Kayıtlı girdiler ve çıktı birimi forma yüklendi; eksik R varsayılanla tamamlandı.
    const { input, birim } = gerilimAlani();
    expect(input.value).toBe("0,4");
    expect(birim.value).toBe("kV");
    expect((screen.getByLabelText("Direnç") as HTMLInputElement).value).toBe("6");
    expect((screen.getByLabelText("Akım birimi") as HTMLSelectElement).value).toBe("mA");
    // 0,4 kV / 6 Ω = 66,67 A = 66 667 mA
    expect(screen.getByText(/66\s?667/)).toBeTruthy();

    // Kayıt adı ve proje adı görünür; açılışta değişiklik yok.
    expect(screen.getByText("Pano besleme")).toBeTruthy();
    expect((await screen.findByRole("link", { name: "Fabrika" })).getAttribute("href")).toBe("/projeler/p-1");
    expect(gosterge()).toBeNull();

    // Değiştir → gösterge; geri al → kaybolur; birim değiştir → gösterge.
    fireEvent.change(input, { target: { value: "0,5" } });
    expect(gosterge()).not.toBeNull();
    fireEvent.change(input, { target: { value: "0,4" } });
    expect(gosterge()).toBeNull();
    fireEvent.change(birim, { target: { value: "V" } });
    expect(gosterge()).not.toBeNull();

    const kaydedilen = { ...KAYIT, girdiler: { mod: { value: "V-R" }, V: { value: "0,4", unit: "V" }, R: { value: "6", unit: "ohm" } }, ciktiBirimleri: { I: "mA" } };
    m.kayitGuncelleAction.mockResolvedValue({ ok: true, veri: kaydedilen });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await screen.findByText("Değişiklikler kaydedildi.");
    expect(m.kayitGuncelleAction).toHaveBeenCalledWith("k-1", {
      girdiler: expect.objectContaining({ V: { value: "0,4", unit: "V" }, mod: { value: "V-R" } }),
      ciktiBirimleri: { I: "mA" },
    });
    expect(gosterge()).toBeNull();
    expect(m.push).not.toHaveBeenCalled();
    expect(m.replace).not.toHaveBeenCalled();
  });

  it("kayıtsız hesapta Kaydet paneli: yeni projeyle kaydedip kayıt adresine geçer", async () => {
    render(<CalcWorkspace slug="ohm-yasasi" girisYapildi />);
    const ac = screen.getByRole("button", { name: "Kaydet" });
    expect(ac.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(ac);
    expect(ac.getAttribute("aria-expanded")).toBe("true");

    const panel = screen.getByRole("region", { name: "Hesabı kaydet" });
    const ad = within(panel).getByLabelText("Kayıt adı") as HTMLInputElement;
    expect(ad.value).toBe("Ohm yasası ve güç");
    expect(document.activeElement).toBe(ad);

    // Proje listesi action ile geldi.
    const proje = within(panel).getByLabelText("Proje") as HTMLSelectElement;
    await within(panel).findByRole("option", { name: "Fabrika" });
    expect(proje.value).toBe("");

    // Ad boşsa sunucuya gidilmez.
    fireEvent.change(ad, { target: { value: "  " } });
    fireEvent.click(within(panel).getByRole("button", { name: "Kaydet" }));
    expect(within(panel).getByText("Kayıt adı boş olamaz.")).toBeTruthy();
    expect(m.kayitOlusturAction).not.toHaveBeenCalled();

    fireEvent.change(ad, { target: { value: "Motor 1" } });
    fireEvent.change(proje, { target: { value: "__yeni__" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Kaydet" }));
    expect(within(panel).getByText("Yeni projenin adını yazın.")).toBeTruthy();
    fireEvent.change(within(panel).getByLabelText("Yeni proje adı"), { target: { value: "Yeni fabrika" } });
    fireEvent.change(within(panel).getByLabelText(/^Not/), { target: { value: "  ilk deneme " } });

    m.kayitOlusturAction.mockResolvedValue({ ok: true, veri: { ...KAYIT, id: "k-9" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Kaydet" }));

    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/hesaplar/ohm-yasasi?kayit=k-9"));
    expect(m.kayitOlusturAction).toHaveBeenCalledWith({
      hesapSlug: "ohm-yasasi",
      ad: "Motor 1",
      notlar: "ilk deneme",
      projeId: null,
      yeniProjeAdi: "Yeni fabrika",
      girdiler: expect.objectContaining({ mod: { value: "V-R" }, V: { value: "12", unit: "V" } }),
      ciktiBirimleri: {},
    });
    expect(screen.queryByRole("region", { name: "Hesabı kaydet" })).toBeNull();
  });

  it("sunucu hatası panelde gösterilir; oturum sona erdiyse giriş bağlantısı eklenir", async () => {
    render(<CalcWorkspace slug="ohm-yasasi" girisYapildi />);
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    const panel = screen.getByRole("region", { name: "Hesabı kaydet" });

    m.kayitOlusturAction.mockResolvedValue({ ok: false, hata: "Proje bulunamadı." });
    fireEvent.click(within(panel).getByRole("button", { name: "Kaydet" }));
    expect((await within(panel).findByRole("alert")).textContent).toContain("Proje bulunamadı.");

    m.kayitOlusturAction.mockResolvedValue({ ok: false, hata: "Oturumunuz sona ermiş.", girisGerekli: true });
    // Önceki istek bitince düğme "Kaydediliyor…"dan "Kaydet"e döner; tıklamadan önce bekle (yük altında zamanlama).
    fireEvent.click(await within(panel).findByRole("button", { name: "Kaydet" }));
    const giris = await within(panel).findByRole("link", { name: "Giriş yapın" });
    expect(giris.getAttribute("href")).toBe("/giris?yonlendir=/hesaplar/ohm-yasasi");

    m.kayitOlusturAction.mockRejectedValue(new TypeError("Failed to fetch"));
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    fireEvent.click(await within(panel).findByRole("button", { name: "Kaydet" }));
    expect((await within(panel).findByRole("alert")).textContent).toContain("Sunucuya ulaşılamadı");
    konsol.mockRestore();
    expect(m.replace).not.toHaveBeenCalled();
  });

  it("Farklı kaydet yeni kayıt oluşturur ve geçmişe ekleyerek geçer; Esc paneli kapatır", async () => {
    render(<CalcWorkspace slug="ohm-yasasi" kayit={KAYIT} girisYapildi />);
    fireEvent.click(screen.getByRole("button", { name: "Farklı kaydet" }));
    let panel = screen.getByRole("region", { name: "Farklı kaydet" });
    fireEvent.keyDown(within(panel).getByLabelText("Kayıt adı"), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Farklı kaydet" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Farklı kaydet" }));
    panel = screen.getByRole("region", { name: "Farklı kaydet" });
    expect((within(panel).getByLabelText("Kayıt adı") as HTMLInputElement).value).toBe("Pano besleme");
    await within(panel).findByRole("option", { name: "Fabrika" });
    expect((within(panel).getByLabelText("Proje") as HTMLSelectElement).value).toBe("p-1");

    m.kayitOlusturAction.mockResolvedValue({ ok: true, veri: { ...KAYIT, id: "k-2" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/hesaplar/ohm-yasasi?kayit=k-2"));
    expect(m.kayitOlusturAction).toHaveBeenCalledWith(
      expect.objectContaining({ projeId: "p-1", ciktiBirimleri: { I: "mA" }, girdiler: expect.objectContaining({ V: { value: "0,4", unit: "kV" } }) }),
    );
  });

  it("sayfa Activity ile gizlenince açık panel kapanır", async () => {
    const { rerender } = render(
      <Activity mode="visible">
        <CalcWorkspace slug="ohm-yasasi" girisYapildi />
      </Activity>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(screen.getByRole("region", { name: "Hesabı kaydet" })).toBeTruthy();
    await act(async () => {
      rerender(
        <Activity mode="hidden">
          <CalcWorkspace slug="ohm-yasasi" girisYapildi />
        </Activity>,
      );
    });
    await act(async () => {
      rerender(
        <Activity mode="visible">
          <CalcWorkspace slug="ohm-yasasi" girisYapildi />
        </Activity>,
      );
    });
    expect(screen.queryByRole("region", { name: "Hesabı kaydet" })).toBeNull();
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeTruthy();
  });
});
