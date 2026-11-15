// @vitest-environment jsdom
/** Proje sayfasındaki kayıt tablosu: karşılaştırma bağlantısı, onaylı silme, taşıma, kopyalama (action'lar taklit). */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KayitTablosu, karsilastirmaAdresi, type KayitSatiri } from "./kayit-tablosu";

const m = vi.hoisted(() => ({
  kayitKopyalaAction: vi.fn(),
  kayitSilAction: vi.fn(),
  kayitTasiAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/kayit/actions", () => m);

const satir = (id: string, ad: string, hesapSlug: string, hesapId: string, hesapBaslik: string): KayitSatiri => ({
  id,
  ad,
  notlar: null,
  hesapSlug,
  hesapId,
  hesapBaslik,
  guncelleme: "15.11.2026 14:03",
  guncellemeIso: "2026-11-15T11:03:00.000Z",
});

const SATIRLAR = [
  satir("k1", "Pano A", "ohm-yasasi", "1.1", "Ohm yasası ve güç"),
  satir("k2", "Pano B", "ohm-yasasi", "1.1", "Ohm yasası ve güç"),
  satir("k3", "Motor", "ac-guc", "1.4", "AC güç"),
];
const PROJELER = [
  { id: "p1", ad: "Fabrika" },
  { id: "p2", ad: "Depo" },
];

function tablo(projeId: string | null = "p1") {
  return render(
    <KayitTablosu kayitlar={SATIRLAR} projeler={PROJELER} projeId={projeId} girisYolu="/projeler/p1" bos="Boş" />,
  );
}

const sec = (ad: string) => fireEvent.click(screen.getByRole("checkbox", { name: `Karşılaştırmak için seç: ${ad}` }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("<KayitTablosu>", () => {
  it("satırlar: ad, hesap no + başlık, güncelleme; Aç kayıt adresine gider", () => {
    tablo();
    const satirA = screen.getByRole("row", { name: /Pano A/ });
    expect(within(satirA).getByText("Ohm yasası ve güç")).toBeTruthy();
    expect(within(satirA).getByText("15.11.2026 14:03")).toBeTruthy();
    expect(within(satirA).getByRole("link", { name: "Aç: Pano A" }).getAttribute("href")).toBe(
      "/hesaplar/ohm-yasasi?kayit=k1",
    );
  });

  it("karşılaştırma: aynı türden 2+ kayıt seçilince bağlantı, farklı türlerde pasif ve açıklamalı", () => {
    tablo();
    const pasif = () => screen.getByRole("button", { name: "Karşılaştır" });
    expect(pasif().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/en az 2 kayıt seçin/)).toBeTruthy();

    sec("Pano B");
    expect(pasif().getAttribute("aria-disabled")).toBe("true");
    sec("Pano A");
    const link = screen.getByRole("link", { name: "Karşılaştır (2)" });
    expect(link.getAttribute("href")).toBe("/karsilastir?kayitlar=k2,k1");

    sec("Motor");
    expect(screen.queryByRole("link", { name: /Karşılaştır/ })).toBeNull();
    expect(pasif().getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(/farklı hesap türlerinden/)).toBeTruthy();

    sec("Motor");
    expect(screen.getByRole("link", { name: "Karşılaştır (2)" })).toBeTruthy();
  });

  it("silme onay ister; onaylanınca action çağrılır", async () => {
    m.kayitSilAction.mockResolvedValue({ ok: true, veri: null });
    tablo();
    fireEvent.click(screen.getByRole("button", { name: "Sil: Pano A" }));
    expect(m.kayitSilAction).not.toHaveBeenCalled();
    const onay = screen.getByRole("group", { name: "Silmeyi onayla: Pano A" });
    fireEvent.click(within(onay).getByRole("button", { name: "Vazgeç" }));
    expect(screen.queryByRole("group", { name: /Silmeyi onayla/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sil: Pano A" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Silmeyi onayla: Pano A" })).getByRole("button", { name: "Evet, sil" }));
    expect(await screen.findByText("“Pano A” silindi.")).toBeTruthy();
    expect(m.kayitSilAction).toHaveBeenCalledWith("k1");
    expect(screen.queryByRole("group", { name: /Silmeyi onayla/ })).toBeNull();
  });

  it("taşıma: hedefler projesiz + diğer projeler; seçilen hedefe taşır", async () => {
    m.kayitTasiAction.mockResolvedValue({ ok: true, veri: {} });
    tablo("p1");
    fireEvent.click(screen.getByRole("button", { name: "Taşı: Pano B" }));
    const form = screen.getByRole("form", { name: "Taşı: Pano B" });
    const hedef = within(form).getByLabelText("Taşınacak yer") as HTMLSelectElement;
    expect([...hedef.options].map((o) => o.textContent)).toEqual(["Projesiz kayıtlar", "Depo"]);

    fireEvent.change(hedef, { target: { value: "p2" } });
    fireEvent.click(within(form).getByRole("button", { name: "Taşı" }));
    expect(await screen.findByText("“Pano B” taşındı: Depo.")).toBeTruthy();
    expect(m.kayitTasiAction).toHaveBeenCalledWith("k2", "p2");

    fireEvent.click(screen.getByRole("button", { name: "Taşı: Pano A" }));
    fireEvent.click(within(screen.getByRole("form", { name: "Taşı: Pano A" })).getByRole("button", { name: "Taşı" }));
    expect(await screen.findByText("“Pano A” taşındı: Projesiz kayıtlar.")).toBeTruthy();
    expect(m.kayitTasiAction).toHaveBeenLastCalledWith("k1", null);
  });

  it("projesiz tabloda taşıma hedefleri yalnızca projeler", () => {
    tablo(null);
    fireEvent.click(screen.getByRole("button", { name: "Taşı: Motor" }));
    const hedef = within(screen.getByRole("form", { name: "Taşı: Motor" })).getByLabelText("Taşınacak yer") as HTMLSelectElement;
    expect([...hedef.options].map((o) => o.value)).toEqual(["p1", "p2"]);
  });

  it("kopyalama sonucu ve hata mesajları gösterilir", async () => {
    m.kayitKopyalaAction.mockResolvedValueOnce({ ok: true, veri: { ad: "Pano A (kopya)" } });
    tablo();
    fireEvent.click(screen.getByRole("button", { name: "Kopyala: Pano A" }));
    expect(await screen.findByText("“Pano A (kopya)” oluşturuldu.")).toBeTruthy();

    m.kayitKopyalaAction.mockResolvedValueOnce({ ok: false, hata: "Oturumunuz sona ermiş.", girisGerekli: true });
    fireEvent.click(screen.getByRole("button", { name: "Kopyala: Pano B" }));
    const uyari = await screen.findByRole("alert");
    expect(uyari.textContent).toContain("Oturumunuz sona ermiş.");
    expect(within(uyari).getByRole("link", { name: "Giriş yapın" }).getAttribute("href")).toBe(
      "/giris?yonlendir=/projeler/p1",
    );
  });

  it("boş listede açıklama gösterilir", () => {
    render(<KayitTablosu kayitlar={[]} projeler={[]} projeId={null} girisYolu="/projeler" bos="Projesiz kayıt yok." />);
    expect(screen.getByText("Projesiz kayıt yok.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("karşılaştırma adresi kimlikleri kodlar", () => {
    expect(karsilastirmaAdresi(["a b", "c"])).toBe("/karsilastir?kayitlar=a%20b,c");
  });
});
