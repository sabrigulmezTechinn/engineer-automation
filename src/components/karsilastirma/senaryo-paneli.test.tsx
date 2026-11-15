// @vitest-environment jsdom
/**
 * Senaryo paneli: gerçek Ohm yasası tanımı, gerçek useCalcState ve hesap formu ile.
 * Rapor düğmesi (işçi C) sahte: aldığı özellikleri veri öznitelikleriyle gösterir.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalcFormView } from "@/components/calc/calc-form";
import { useCalcState, type CalcTercihleri } from "@/components/calc/use-calc-state";
import { ohmYasasi } from "@/lib/calc/defs/temel-elektrik/ohm-yasasi";
import type { Senaryo, TaramaAyari } from "@/lib/karsilastirma/types";
import { SenaryoPaneli } from "./senaryo-paneli";

vi.mock("@/components/rapor/karsilastirma-rapor-dugmesi", () => ({
  KarsilastirmaRaporDugmesi: (props: { hesapSlug: string; senaryolar: Senaryo[]; outputUnits?: Record<string, string>; tarama?: TaramaAyari }) => (
    <div
      data-testid="rapor"
      data-slug={props.hesapSlug}
      data-senaryolar={props.senaryolar.map((s) => s.ad).join("|")}
      data-birimler={JSON.stringify(props.outputUnits ?? {})}
      data-tarama={props.tarama ? `${props.tarama.girdiKey}->${props.tarama.ciktiKey} ${props.tarama.baslangic}..${props.tarama.bitis} ${props.tarama.birim} ${props.tarama.noktaSayisi}` : ""}
    />
  ),
}));

afterEach(cleanup);

/** Form denetiminin değeri (jest-dom kullanılmıyor) */
const deger = (el: Element | null) => (el as HTMLInputElement | HTMLSelectElement | null)?.value;

function Deneme({ tercihler }: { tercihler?: CalcTercihleri }) {
  const calc = useCalcState(ohmYasasi, undefined, tercihler);
  return (
    <>
      <CalcFormView calc={calc} />
      <SenaryoPaneli calc={calc} />
    </>
  );
}

function ac() {
  const dugme = screen.getByRole("button", { name: /Senaryo karşılaştırma/ });
  expect(dugme?.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(dugme);
  expect(dugme?.getAttribute("aria-expanded")).toBe("true");
}

const ekle = () => fireEvent.click(screen.getByRole("button", { name: "Mevcut değerleri senaryo olarak ekle" }));
const gerilim = () => screen.getByLabelText("Gerilim") as HTMLInputElement;
const direnc = () => screen.getByLabelText("Direnç") as HTMLInputElement;
const senaryoListesi = () => screen.getByRole("list", { name: "Senaryolar" });
const tablo = () => within(screen.getByRole("region", { name: "Karşılaştırma tablosu" })).getByRole("table");
const satir = (anahtar: string) => {
  const tr = tablo().querySelector(`tr[data-satir="${anahtar}"]`);
  if (!tr) throw new Error(`satır yok: ${anahtar}`);
  return tr as HTMLTableRowElement;
};
const hucreler = (anahtar: string) => [...satir(anahtar).querySelectorAll("td")].map((td) => td.textContent);

describe("SenaryoPaneli", () => {
  it("varsayılan olarak kapalıdır; açılınca boş durum ve ekleme düğmesi görünür", () => {
    render(<Deneme />);
    expect(screen.queryByRole("button", { name: "Mevcut değerleri senaryo olarak ekle" })).toBeNull();
    ac();
    expect(screen.getByText(/Henüz senaryo yok/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Karşılaştırma tablosu" })).toBeNull();
  });

  it("senaryo ekle, değerleri değiştirip ikinciyi ekle: tabloda farklı satırlar vurgulu", () => {
    render(<Deneme />);
    ac();
    ekle();
    const liste = senaryoListesi();
    expect(deger(within(liste).getByLabelText("1. senaryonun adı"))).toBe("Senaryo 1");
    expect(within(liste).getByText("Formdaki değerler")).toBeTruthy();

    fireEvent.change(gerilim(), { target: { value: "24" } });
    ekle();
    expect(deger(within(senaryoListesi()).getByLabelText("2. senaryonun adı"))).toBe("Senaryo 2");

    const basliklar = [...tablo().querySelectorAll("thead th")].map((th) => th.textContent);
    expect(basliklar).toEqual(["Büyüklük", "Senaryo 1", "Senaryo 2"]);

    // V-R modu, R = 6 Ω: 12 V → 2 A, 24 W; 24 V → 4 A, 96 W
    expect(hucreler("girdi:V")).toEqual(["12", "24"]);
    expect(satir("girdi:V")?.getAttribute("data-farkli")).toBe("true");
    expect(within(satir("girdi:V")).getByText(/senaryolar arasında farklı/)).toBeTruthy();
    expect(satir("girdi:R")?.hasAttribute("data-farkli")).toBe(false);
    expect(satir("girdi:mod")?.hasAttribute("data-farkli")).toBe(false);
    expect(hucreler("girdi:mod")).toEqual(["Gerilim ve direnç biliniyor", "Gerilim ve direnç biliniyor"]);
    expect(hucreler("cikti:I")).toEqual(["2", "4"]);
    expect(satir("cikti:I")?.getAttribute("data-farkli")).toBe("true");
    expect(hucreler("cikti:P")).toEqual(["24", "96"]);
    expect(screen.getByText(/Vurgulu 4 satır senaryolar arasında farklı/)).toBeTruthy();

    // "Formdaki değerler" artık 2. senaryoda
    const maddeler = within(senaryoListesi()).getAllByRole("listitem");
    expect(within(maddeler[0]).queryByText("Formdaki değerler")).toBeNull();
    expect(within(maddeler[1]).getByText("Formdaki değerler")).toBeTruthy();
  });

  it("senaryoyu forma yükler; çıktı birimi seçimi korunur ve tabloya da uygulanır", () => {
    render(<Deneme />);
    ac();
    ekle();
    fireEvent.change(gerilim(), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("Akım birimi"), { target: { value: "mA" } });
    ekle();
    expect(hucreler("cikti:I")).toEqual(["2000", "4000"]);

    fireEvent.click(screen.getByRole("button", { name: "Senaryo 1: forma yükle" }));
    expect(deger(gerilim())).toBe("12");
    expect(deger(screen.getByLabelText("Akım birimi"))).toBe("mA");
    expect(hucreler("cikti:I")).toEqual(["2000", "4000"]);
    expect(screen.getByRole("status")?.textContent).toContain("Senaryo 1 forma yüklendi.");
    const maddeler = within(senaryoListesi()).getAllByRole("listitem");
    expect(within(maddeler[0]).getByText("Formdaki değerler")).toBeTruthy();
  });

  it("yeniden adlandırma tablo başlığına yansır; silinen senaryonun adı yeniden verilmez", () => {
    render(<Deneme />);
    ac();
    ekle();
    ekle();
    fireEvent.change(within(senaryoListesi()).getByLabelText("1. senaryonun adı"), { target: { value: "4 mm² kablo" } });
    expect(within(tablo()).getByRole("columnheader", { name: /4 mm² kablo/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "4 mm² kablo: sil" }));
    expect(within(senaryoListesi()).getAllByRole("listitem")).toHaveLength(1);
    expect(deger(within(senaryoListesi()).getByLabelText("1. senaryonun adı"))).toBe("Senaryo 2");

    // Panel kapatılıp açılsa da sayaç sürer
    fireEvent.click(screen.getByRole("button", { name: /Senaryo karşılaştırma/ }));
    fireEvent.click(screen.getByRole("button", { name: /Senaryo karşılaştırma/ }));
    ekle();
    expect(deger(within(senaryoListesi()).getByLabelText("2. senaryonun adı"))).toBe("Senaryo 3");
  });

  it("adı silinen senaryo tabloda ve raporda sıra numarasıyla görünür", () => {
    render(<Deneme />);
    ac();
    ekle();
    ekle();
    fireEvent.change(within(senaryoListesi()).getByLabelText("1. senaryonun adı"), { target: { value: "   " } });
    expect([...tablo().querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Büyüklük", "Senaryo 1", "Senaryo 2"]);
    expect(screen.getByTestId("rapor").getAttribute("data-senaryolar")).toBe("Senaryo 1|Senaryo 2");
  });

  it(`en çok 8 senaryo eklenebilir`, () => {
    render(<Deneme />);
    ac();
    for (let i = 0; i < 8; i++) ekle();
    expect(within(senaryoListesi()).getAllByRole("listitem")).toHaveLength(8);
    expect((screen.getByRole("button", { name: "Mevcut değerleri senaryo olarak ekle" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/En çok 8 senaryo eklenebilir/)).toBeTruthy();
  });

  it("hesaplanamayan ve uyarılı senaryo sütunları ikon + metinle işaretlenir", () => {
    render(<Deneme />);
    ac();
    ekle();
    fireEvent.change(direnc(), { target: { value: "" } });
    ekle();
    const baslik = tablo().querySelector('th[data-senaryo="senaryo-2"]');
    expect(baslik?.getAttribute("data-durum")).toBe("hesaplanamadi");
    expect(baslik?.textContent).toContain("Hesaplanamadı");
    expect(baslik?.querySelector("svg")).not.toBeNull();
    expect(hucreler("girdi:R")).toEqual(["6", "—yok"]);
    expect(hucreler("cikti:I")).toEqual(["2", "—yok"]);
    expect(screen.getByText("Direnç: Bu alan zorunludur")).toBeTruthy();

    // V-I, I = 0 → uyarı
    fireEvent.change(screen.getByLabelText("Bilinen büyüklükler"), { target: { value: "V-I" } });
    fireEvent.change(screen.getByLabelText("Akım"), { target: { value: "0" } });
    ekle();
    const uc = tablo().querySelector('th[data-senaryo="senaryo-3"]');
    expect(uc?.getAttribute("data-durum")).toBe("uyari");
    expect(uc?.textContent).toContain("Uyarı");
  });

  it("çalışma alanının tercihleri (anlamlı basamak) tabloya geçer", () => {
    render(<Deneme tercihler={{ significant: 3 }} />);
    ac();
    fireEvent.change(gerilim(), { target: { value: "10" } });
    fireEvent.change(direnc(), { target: { value: "3" } });
    ekle();
    expect(hucreler("cikti:I")).toEqual(["3,33"]);
  });

  it("değer taraması: varsayılan ilk senaryo temel, grafik çizilir ve rapora iletilir", () => {
    render(<Deneme />);
    ac();
    // Senaryo yokken temel formdaki değerler; rapor düğmesi yok
    expect(screen.queryByTestId("rapor")).toBeNull();
    ekle();

    // V-R modunda ilk sayı girdisi V, çıktı (V dışındaki ilk) I; aralık 12 V'un yarısı–iki katı
    expect(deger(screen.getByLabelText("Değişen girdi"))).toBe("V");
    expect(deger(screen.getByLabelText("Grafikteki çıktı"))).toBe("I");
    expect(deger(screen.getByLabelText("Başlangıç"))).toBe("6");
    expect(deger(screen.getByLabelText("Bitiş"))).toBe("24");
    expect(deger(screen.getByLabelText("Temel değerler"))).toBe("senaryo-1");

    const grafik = screen.getByRole("img", { name: "Akım – Gerilim" });
    expect(grafik.tagName.toLowerCase()).toBe("svg");
    const rapor = screen.getByTestId("rapor");
    expect(rapor?.getAttribute("data-slug")).toBe("ohm-yasasi");
    expect(rapor?.getAttribute("data-senaryolar")).toBe("Senaryo 1");
    expect(rapor?.getAttribute("data-tarama")).toBe("V->I 6..24 V 20");

    // Girdi değişince birim ve aralık temelden dolar
    fireEvent.change(screen.getByLabelText("Değişen girdi"), { target: { value: "R" } });
    expect(deger(screen.getByLabelText("Başlangıç"))).toBe("3");
    expect(deger(screen.getByLabelText("Bitiş"))).toBe("12");
    expect(deger(screen.getByLabelText("Birim"))).toBe("ohm");
    expect(screen.getByTestId("rapor")?.getAttribute("data-tarama")).toBe("R->I 3..12 ohm 20");

    // Değer tablosu
    const degerler = within(screen.getByRole("region", { name: "Tarama değerleri" })).getByRole("table");
    expect(within(degerler).getAllByRole("row")).toHaveLength(21);

    // Formdaki değerler temel seçilince rapora tarama gitmez
    fireEvent.change(screen.getByLabelText("Temel değerler"), { target: { value: "__form__" } });
    expect(screen.getByTestId("rapor")?.getAttribute("data-tarama")).toBe("");
    expect(screen.getByText(/bu grafik rapora eklenmez/)).toBeTruthy();
  });

  it("geçersiz tarama ayarında anlaşılır mesaj gösterir", () => {
    render(<Deneme />);
    ac();
    fireEvent.change(screen.getByLabelText("Başlangıç"), { target: { value: "abc" } });
    expect(screen.getByText("Başlangıç değeri geçerli bir sayı değil.")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Akım/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Başlangıç"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Nokta sayısı"), { target: { value: "500" } });
    expect(screen.getByText(/2 ile 200 arasında/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nokta sayısı"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Bitiş"), { target: { value: "1" } });
    expect(screen.getByText(/farklı olmalıdır/)).toBeTruthy();
  });

  it("taranan girdi temelde gizlenirse açıklama gösterir", async () => {
    render(<Deneme />);
    ac();
    // Temel formdaki değerler (senaryo yok); V seçili. Mod I-R olunca V gizlenir.
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Bilinen büyüklükler"), { target: { value: "I-R" } });
    });
    expect(deger(screen.getByLabelText("Değişen girdi"))).toBe("V");
    expect(screen.getByRole("option", { name: /Gerilim \(bu değerlerde kullanılmıyor\)/ })).toBeTruthy();
    expect(screen.getByText(/"Gerilim" bu girdilerle kullanılmıyor/)).toBeTruthy();
  });
});
