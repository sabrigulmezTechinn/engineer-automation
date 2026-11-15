// @vitest-environment jsdom
/**
 * /karsilastir istemci görünümü: kayıtlar sütun, ortak çıktı birimleri ve tercihler uygulanır, tarama ilk kayıttan.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Senaryo, TaramaAyari } from "@/lib/karsilastirma/types";
import { KayitKarsilastirma } from "./kayit-karsilastirma";

vi.mock("@/components/rapor/karsilastirma-rapor-dugmesi", () => ({
  KarsilastirmaRaporDugmesi: (props: { senaryolar: Senaryo[]; outputUnits?: Record<string, string>; tarama?: TaramaAyari }) => (
    <div
      data-testid="rapor"
      data-kayitlar={props.senaryolar.map((s) => s.kayitId).join("|")}
      data-birimler={JSON.stringify(props.outputUnits ?? {})}
      data-tarama={props.tarama ? `${props.tarama.girdiKey}->${props.tarama.ciktiKey}` : ""}
    />
  ),
}));

afterEach(cleanup);

const senaryo = (id: string, ad: string, V: string, R: string): Senaryo => ({
  id,
  ad,
  kayitId: id,
  state: { mod: { value: "V-R" }, V: { value: V, unit: "V" }, R: { value: R, unit: "ohm" } },
});

describe("KayitKarsilastirma", () => {
  it("kayıtları yan yana gösterir, kayıt sayfasına bağlar, ortak birimleri uygular", () => {
    render(
      <KayitKarsilastirma
        hesapSlug="ohm-yasasi"
        senaryolar={[senaryo("k1", "Pano A", "12", "6"), senaryo("k2", "Pano B", "12", "3")]}
        outputUnits={{ I: "mA" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Ohm yasası ve güç" })).toBeTruthy();
    const bag = screen.getByRole("link", { name: /Pano B/ });
    expect(bag.getAttribute("href")).toBe("/hesaplar/ohm-yasasi?kayit=k2");

    const tablo = within(screen.getByRole("region", { name: "2 kayıt yan yana" })).getByRole("table");
    const I = tablo.querySelector('tr[data-satir="cikti:I"]');
    expect([...(I?.querySelectorAll("td") ?? [])].map((td) => td.textContent)).toEqual(["2000", "4000"]);
    expect(I?.getAttribute("data-farkli")).toBe("true");

    const rapor = screen.getByTestId("rapor");
    expect(rapor.getAttribute("data-kayitlar")).toBe("k1|k2");
    expect(rapor.getAttribute("data-birimler")).toBe('{"I":"mA"}');
    expect(rapor.getAttribute("data-tarama")).toBe("V->I");

    // Başka kayıt temel seçilince rapora tarama gitmez
    fireEvent.change(screen.getByLabelText("Temel değerler"), { target: { value: "k2" } });
    expect(screen.getByTestId("rapor").getAttribute("data-tarama")).toBe("");
  });

  it("tercihler (anlamlı basamak) uygulanır", () => {
    render(<KayitKarsilastirma hesapSlug="ohm-yasasi" senaryolar={[senaryo("k1", "A", "10", "3")]} outputUnits={{}} tercihler={{ significant: 3 }} />);
    const I = screen.getAllByRole("table")[0].querySelector('tr[data-satir="cikti:I"]');
    expect(I?.querySelector("td")?.textContent).toBe("3,33");
  });

  it("bilinmeyen hesap türünde hata gösterir", () => {
    render(<KayitKarsilastirma hesapSlug="yok-boyle" senaryolar={[]} outputUnits={{}} />);
    expect(screen.getByRole("alert").textContent).toContain("Hesap tanımı bulunamadı");
  });
});
