// @vitest-environment jsdom
/**
 * Çizgi grafik testleri: tik hesabı, SVG yapısı (geçerli XML, erişilebilir ad), kaçış ve uç durumlar.
 */
import { describe, expect, it } from "vitest";
import type { TaramaNoktasi, TaramaSerisi } from "./types";
import { GRAFIK_RENKLERI, cizgiGrafikSvg, eksenTikleri, kisalt, tikEtiketi, xmlKacis } from "./grafik";

function seri(noktalar: TaramaNoktasi[], ek: Partial<TaramaSerisi> = {}): TaramaSerisi {
  return {
    girdiKey: "S",
    ciktiKey: "dU",
    xEtiket: "Kesit",
    yEtiket: "Gerilim düşümü",
    xBirim: "mm2",
    yBirim: "percent",
    xBirimSembolu: "mm²",
    yBirimSembolu: "%",
    noktalar,
    ...ek,
  };
}

const n = (x: number, y: number | null, seviye: TaramaNoktasi["seviye"] = null): TaramaNoktasi => ({ x, y, seviye });

function parse(svg: string): Document {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
}

const SVG_NS = "http://www.w3.org/2000/svg";

describe("eksenTikleri", () => {
  it("0–10: adım 2, uçlar dahil", () => {
    expect(eksenTikleri(0, 10)).toEqual({ min: 0, max: 10, adim: 2, tikler: [0, 2, 4, 6, 8, 10], ondalik: 0 });
  });

  it("1,5–25 (6 tik hedefi): adım 5, 0'dan 25'e", () => {
    const t = eksenTikleri(1.5, 25, 6);
    expect(t.adim).toBe(5);
    expect(t.tikler).toEqual([0, 5, 10, 15, 20, 25]);
  });

  it("ondalık adımlarda kayan nokta artığı yok; ondalık basamak adımdan", () => {
    const t = eksenTikleri(0.1, 0.3);
    expect(t.adim).toBe(0.05);
    expect(t.tikler).toEqual([0.1, 0.15, 0.2, 0.25, 0.3]);
    expect(t.ondalik).toBe(2);
    expect(t.tikler.map((v) => tikEtiketi(v, t.ondalik))).toEqual(["0,10", "0,15", "0,20", "0,25", "0,30"]);
  });

  it("negatiften pozitife; -0 yok", () => {
    const t = eksenTikleri(-3, 7);
    expect(t.tikler).toEqual([-4, -2, 0, 2, 4, 6, 8]);
    expect(Object.is(t.tikler[2], -0)).toBe(false);
  });

  it("ters sırada verilen uçlar düzeltilir", () => {
    expect(eksenTikleri(10, 0).tikler).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("düz aralık genişletilir (5 → 4,4–5,6; 0 → −1–1)", () => {
    const bes = eksenTikleri(5, 5);
    expect(bes.min).toBeLessThan(5);
    expect(bes.max).toBeGreaterThan(5);
    expect(bes.tikler).toEqual([4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6]);
    expect(eksenTikleri(0, 0).tikler).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it("sonlu olmayan girdide 0–1", () => {
    const t = eksenTikleri(Number.NaN, Number.POSITIVE_INFINITY);
    expect(t.min).toBe(0);
    expect(t.max).toBe(1);
    expect(t.tikler.every(Number.isFinite)).toBe(true);
  });

  it("büyük değerlerde birbirine yakın tikler ayrı etiketlenir (1000,1 ≠ 1000,2)", () => {
    const t = eksenTikleri(1000, 1000.4);
    const etiketler = t.tikler.map((v) => tikEtiketi(v, t.ondalik));
    expect(new Set(etiketler).size).toBe(etiketler.length);
    expect(etiketler).toContain("1000,1");
    expect(etiketler).toContain("1000,2");
  });

  it("çok küçük adımlarda anlamlı basamakla etiketlenir; binlik ayırıcı U+202F", () => {
    const t = eksenTikleri(0.000001, 0.000005);
    expect(t.ondalik).toBeGreaterThan(4);
    expect(tikEtiketi(t.tikler[1], t.ondalik)).toMatch(/×10⁻⁶$/);
    expect(tikEtiketi(20000, 0)).toBe("20 000");
  });
});

describe("xmlKacis", () => {
  it("özel karakterleri ve geçersiz denetim karakterlerini temizler", () => {
    expect(xmlKacis(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;");
    expect(xmlKacis("a\u0000b\u0007c\td")).toBe("abc\td");
  });
});

describe("cizgiGrafikSvg", () => {
  const normal = seri([n(1.5, 4.2), n(2.5, 2.5), n(4, 1.6), n(6, 1.05), n(10, 0.63)]);

  it("geçerli, bağımsız SVG: xmlns, viewBox, boyut, role=img, title ve desc", () => {
    const svg = cizgiGrafikSvg(normal);
    const doc = parse(svg);
    const kok = doc.documentElement;
    expect(kok.namespaceURI).toBe(SVG_NS);
    expect(kok.localName).toBe("svg");
    expect(kok.getAttribute("width")).toBe("640");
    expect(kok.getAttribute("height")).toBe("320");
    expect(kok.getAttribute("viewBox")).toBe("0 0 640 320");
    expect(kok.getAttribute("role")).toBe("img");
    expect(kok.getAttribute("font-family")).toContain("NotoSans");
    expect(kok.firstElementChild?.localName).toBe("title");
    expect(kok.firstElementChild?.textContent).toBe("Gerilim düşümü – Kesit");
    expect(doc.getElementsByTagName("desc")[0].textContent).toContain("5 nokta");
  });

  it("boyut ve başlık seçenekleri", () => {
    const doc = parse(cizgiGrafikSvg(normal, { genislik: 480, yukseklik: 240, baslik: "Kesit – gerilim düşümü" }));
    expect(doc.documentElement.getAttribute("viewBox")).toBe("0 0 480 240");
    expect(doc.documentElement.firstElementChild?.textContent).toBe("Kesit – gerilim düşümü");
    const metinler = [...doc.getElementsByTagName("text")].map((t) => t.textContent);
    expect(metinler).toContain("Kesit – gerilim düşümü");
  });

  it("birimli eksen etiketleri ve ondalık virgüllü tikler", () => {
    const doc = parse(cizgiGrafikSvg(normal));
    const metinler = [...doc.getElementsByTagName("text")].map((t) => t.textContent);
    expect(metinler).toContain("Kesit (mm²)");
    expect(metinler).toContain("Gerilim düşümü (%)");
    // y: 0,63–4,2 → adım 1 → 0…5; x: 1,5–10 → adım 2 → 0…10
    expect(metinler).toEqual(expect.arrayContaining(["0", "1", "5", "2", "10"]));
    const yEtiket = [...doc.getElementsByTagName("text")].find((t) => t.textContent === "Gerilim düşümü (%)");
    expect(yEtiket?.getAttribute("transform")).toMatch(/^rotate\(-90 /);
    const kesirli = parse(cizgiGrafikSvg(seri([n(0, 0.12), n(1, 0.31)])));
    expect([...kesirli.getElementsByTagName("text")].map((t) => t.textContent)).toContain("0,15");
  });

  it("birimsiz eksen etiketi parantezsiz", () => {
    const doc = parse(cizgiGrafikSvg(seri([n(1, 1), n(2, 2)], { yBirimSembolu: "", yEtiket: "Oran" })));
    const metinler = [...doc.getElementsByTagName("text")].map((t) => t.textContent);
    expect(metinler).toContain("Oran");
    expect(metinler.some((m) => m?.startsWith("Oran ("))).toBe(false);
  });

  it("y = null noktalarda çizgi kırılır", () => {
    const doc = parse(cizgiGrafikSvg(seri([n(1, 1), n(2, 2), n(3, null), n(4, 3), n(5, 4)])));
    const yollar = [...doc.getElementsByTagName("path")];
    expect(yollar).toHaveLength(1);
    const d = yollar[0].getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/L/g)).toHaveLength(2);
    expect(yollar[0].getAttribute("stroke")).toBe(GRAFIK_RENKLERI.seri);
  });

  it("uyarı noktaları sarı üçgen, hata noktaları kırmızı kare; lejantta adlarıyla", () => {
    const doc = parse(cizgiGrafikSvg(seri([n(1, 5, "hata"), n(2, 4, "uyari"), n(3, 3, "ok"), n(4, 2)])));
    const ucgenler = [...doc.getElementsByTagName("polygon")].filter((p) => p.getAttribute("fill") === GRAFIK_RENKLERI.uyari);
    const kareler = [...doc.getElementsByTagName("rect")].filter((r) => r.getAttribute("fill") === GRAFIK_RENKLERI.hata);
    // grafikte bir + lejantta bir
    expect(ucgenler).toHaveLength(2);
    expect(kareler).toHaveLength(2);
    const metinler = [...doc.getElementsByTagName("text")].map((t) => t.textContent);
    expect(metinler).toContain("Uyarı");
    expect(metinler).toContain("Hata");
    // Noktaların ipucu metni seviyeyi yazıyla da söyler
    expect(ucgenler[0].getElementsByTagName("title")[0]?.textContent).toMatch(/\(uyarı\)$/);
    expect(kareler[0].getElementsByTagName("title")[0]?.textContent).toBe("Kesit = 1 mm²; Gerilim düşümü = 5 % (hata)");
    expect(doc.getElementsByTagName("desc")[0].textContent).toContain("1 uyarı, 1 hata");
  });

  it("uyarı/hata yoksa lejantta yalnızca seri", () => {
    const metinler = [...parse(cizgiGrafikSvg(normal)).getElementsByTagName("text")].map((t) => t.textContent);
    expect(metinler).toContain("Gerilim düşümü");
    expect(metinler).not.toContain("Uyarı");
    expect(metinler).not.toContain("Hata");
  });

  it("çok noktada normal işaretler çizilmez, uyarı/hata ve yalnız noktalar çizilir", () => {
    const noktalar = Array.from({ length: 120 }, (_, i) => n(i, i === 60 ? null : i === 59 ? null : Math.sin(i / 10), i === 30 ? "uyari" : null));
    noktalar[61] = n(61, 1);
    noktalar[62] = n(62, null);
    const doc = parse(cizgiGrafikSvg(seri(noktalar)));
    const daireler = [...doc.getElementsByTagName("circle")];
    // yalnız nokta (61) + lejant
    expect(daireler).toHaveLength(2);
    expect([...doc.getElementsByTagName("polygon")]).toHaveLength(2);
  });

  it("metinler kaçışlanır: etiket ve başlıktaki işaretleme çalışmaz", () => {
    const kotu = `<script>alert("x")</script> & 'q'`;
    const svg = cizgiGrafikSvg(seri([n(1, 1), n(2, 2)], { xEtiket: kotu, yBirimSembolu: "<b>" }), { baslik: `Senaryo "1" <img src=x onerror=alert(1)>\u0001` });
    const doc = parse(svg);
    expect(doc.getElementsByTagName("script")).toHaveLength(0);
    expect(doc.getElementsByTagName("img")).toHaveLength(0);
    expect(doc.getElementsByTagName("b")).toHaveLength(0);
    expect(doc.documentElement.firstElementChild?.textContent).toBe(`Senaryo "1" <img src=x onerror=alert(1)>`);
    const metinler = [...doc.getElementsByTagName("text")].map((t) => t.textContent);
    expect(metinler).toContain(`${kotu} (mm²)`);
    expect(svg).not.toContain("<script");
  });

  it("PDF uyumu: CSS sınıfı, stil, değişken ve currentColor yok; arka plan beyaz", () => {
    const svg = cizgiGrafikSvg(seri([n(1, 1, "uyari"), n(2, 2, "hata"), n(3, null)]), { baslik: "B" });
    expect(svg).not.toMatch(/class=|<style|style=|var\(|currentColor/);
    const doc = parse(svg);
    const ilkRect = doc.getElementsByTagName("rect")[0];
    expect(ilkRect.getAttribute("fill")).toBe("#ffffff");
    expect(ilkRect.getAttribute("width")).toBe("640");
  });

  it.each<[string, TaramaNoktasi[]]>([
    ["boş seri", []],
    ["tek nokta", [n(3, 7)]],
    ["düz seri", [n(1, 2), n(2, 2), n(3, 2)]],
    ["hepsi null", [n(1, null, "hata"), n(2, null, "hata")]],
    ["sıfır", [n(0, 0), n(0, 0)]],
    ["sonlu olmayan değer", [n(1, Number.NaN), n(2, 3), n(Number.POSITIVE_INFINITY, 1)]],
  ])("uç durum (%s): geçerli SVG, NaN/Infinity yok", (_ad, noktalar) => {
    const svg = cizgiGrafikSvg(seri(noktalar));
    expect(svg).not.toMatch(/NaN|Infinity/);
    parse(svg);
  });

  it("dar grafikte uzun etiketler kısaltılır, x tikleri seyreltilir; tam metin title/desc'te kalır", () => {
    const uzun = seri(
      Array.from({ length: 21 }, (_, i) => n(10000 + i * 4500, 1500 + i * 30, i > 15 ? "hata" : i > 10 ? "uyari" : null)),
      { xEtiket: "Devir başına sayım (enkoder çözünürlüğü)", yEtiket: "Mühendislik değeri (proses biriminde)", xBirimSembolu: "", yBirimSembolu: "dev/dk" },
    );
    const dar = parse(cizgiGrafikSvg(uzun, { genislik: 320, yukseklik: 220, baslik: "Senaryo 1 temel alınarak çok uzun bir başlık metni" }));
    const metinler = [...dar.getElementsByTagName("text")].map((t) => t.textContent ?? "");
    expect(metinler.filter((m) => m.endsWith("…")).length).toBeGreaterThanOrEqual(3);
    expect(metinler).toContain("Uyarı");
    expect(metinler).toContain("Hata");
    // 10 000–100 000: 320 px'te 0, 50 000, 100 000
    expect(metinler).toEqual(expect.arrayContaining(["0", "50\u202f000", "100\u202f000"]));
    expect(metinler).not.toContain("20\u202f000");
    expect(dar.documentElement.firstElementChild?.textContent).toBe("Senaryo 1 temel alınarak çok uzun bir başlık metni");
    expect(dar.getElementsByTagName("desc")[0].textContent).toContain("Mühendislik değeri (proses biriminde) (dev/dk)");
    // Geniş grafikte kısaltma yok
    const genis = parse(cizgiGrafikSvg(uzun, { genislik: 960, yukseklik: 480 }));
    expect([...genis.getElementsByTagName("text")].some((t) => t.textContent?.endsWith("…"))).toBe(false);
  });

  it("kisalt: sığan metne dokunmaz, sığmayanı üç noktayla keser", () => {
    expect(kisalt("Akım", 11, 100)).toBe("Akım");
    const k = kisalt("Mühendislik değeri (proses biriminde)", 11, 60);
    expect(k.endsWith("…")).toBe(true);
    expect(k.length).toBeLessThan(12);
  });

  it("hesaplanabilen değer yoksa açıklama yazar", () => {
    const doc = parse(cizgiGrafikSvg(seri([n(1, null, "hata"), n(2, null, "hata")])));
    const metinler = [...doc.getElementsByTagName("text")].map((t) => t.textContent);
    expect(metinler).toContain("Bu aralıkta hesaplanabilen değer yok");
    expect(doc.getElementsByTagName("path")).toHaveLength(0);
  });
});
