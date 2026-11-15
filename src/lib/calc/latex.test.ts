import { describe, expect, it, vi } from "vitest";
import { latexNum, latexOperand, latexQty, latexSI, latexUnit, latexUnitSymbol, numberTextToLatex } from "./latex";
import { renderStrict } from "./test-utils/katex";

vi.mock("@/lib/units", () => import("@/lib/calc/test-utils/units-mock"));

describe("numberTextToLatex", () => {
  it.each([
    ["1,5", "1{,}5"],
    ["-1,5", "-1{,}5"],
    ["\u22121,5", "-1{,}5"], // Unicode eksi
    ["230", "230"],
    ["1000", "1000"], // "10" ile başlasa da üs değildir
    ["10", "10"],
    ["1.234,5", "1.234{,}5"], // nokta binlik ayırıcı
    ["1\u00a0234,5", "1\\,234{,}5"], // bölünmez boşluk
    ["1\u202f234,5", "1\\,234{,}5"], // dar bölünmez boşluk
    ["1,5×10⁻⁶", "1{,}5 \\times 10^{-6}"],
    ["1,5 × 10⁻⁶", "1{,}5 \\times 10^{-6}"],
    ["-2,25×10¹²", "-2{,}25 \\times 10^{12}"],
    ["1,5·10⁻³", "1{,}5 \\times 10^{-3}"],
    ["1,5×10^-6", "1{,}5 \\times 10^{-6}"],
    ["1,5×10⁺⁶", "1{,}5 \\times 10^{6}"],
    ["10⁻⁹", "10^{-9}"],
    ["1,5e-6", "1{,}5 \\times 10^{-6}"],
    ["1,5E+06", "1{,}5 \\times 10^{6}"],
    ["—", "\\text{—}"],
    ["", ""],
  ])("%j → %j", (input, expected) => {
    expect(numberTextToLatex(input)).toBe(expected);
  });

  it("üretilen her biçim KaTeX'te hatasız işlenir", () => {
    for (const t of ["1,5", "1\u00a0234,5", "1,5×10⁻⁶", "1,5e-6", "—", "10⁻⁹"]) {
      expect(() => renderStrict(numberTextToLatex(t))).not.toThrow();
    }
  });
});

describe("latexNum", () => {
  it("formatNumber çıktısını LaTeX'e çevirir", () => {
    expect(latexNum(1.5)).toBe("1{,}5");
    expect(latexNum(-0.25)).toBe("-0{,}25");
    expect(latexNum(1.5e-6)).toBe("1{,}5 \\times 10^{-6}");
    expect(latexNum(2 / 3, { decimals: 2 })).toBe("0{,}67");
    expect(latexNum(Number.NaN)).toBe("\\text{—}");
  });
});

describe("latexUnitSymbol", () => {
  it.each([
    ["kV", "\\mathrm{kV}"],
    ["Ω", "\\Omega"],
    ["kΩ", "\\mathrm{k}\\Omega"],
    ["\u2126", "\\Omega"], // ohm işareti
    ["µF", "\\mu\\mathrm{F}"], // mikro işareti
    ["\u03bcF", "\\mu\\mathrm{F}"], // Yunan mü
    ["mm²", "\\mathrm{mm}^2"],
    ["m³/s", "\\mathrm{m}^3/\\mathrm{s}"],
    ["s⁻¹", "\\mathrm{s}^{-1}"],
    ["°C", "{}^\\circ\\mathrm{C}"],
    ["°", "{}^\\circ"],
    ["%", "\\%"],
    ["‰", "{\\%_0}"],
    ["Ω·m", "\\Omega\\cdot \\mathrm{m}"],
    ["W/(m²·K)", "\\mathrm{W}/(\\mathrm{m}^2\\cdot \\mathrm{K})"],
    ["dev/dk", "\\mathrm{dev}/\\mathrm{dk}"],
    ["kg·m²", "\\mathrm{kg}\\cdot \\mathrm{m}^2"],
    ["şş", "\\text{şş}"], // ASCII dışı harfler metin kipinde
  ])("%j → %j", (symbol, expected) => {
    expect(latexUnitSymbol(symbol)).toBe(expected);
  });

  it("tüm semboller KaTeX'te strict kipte hatasız işlenir", () => {
    for (const s of ["kV", "kΩ", "µF", "mm²", "m³/s", "s⁻¹", "°C", "°", "%", "‰", "Ω·m", "W/(m²·K)", "dev/dk", "saat", "çğış"]) {
      expect(() => renderStrict(`1\\,${latexUnitSymbol(s)}`), s).not.toThrow();
    }
  });
});

describe("latexQty / latexSI / latexUnit", () => {
  it("SI değeri birime çevirip değer + birim yazar", () => {
    expect(latexQty(1500, "kV")).toBe("1{,}5\\,\\mathrm{kV}");
    expect(latexQty(2000, "kohm")).toBe("2\\,\\mathrm{k}\\Omega");
    expect(latexQty(1.5e-6, "uF")).toBe("1{,}5\\,\\mu\\mathrm{F}");
    expect(latexQty(2.5e-6, "mm2")).toBe("2{,}5\\,\\mathrm{mm}^2");
    expect(latexQty(293.15, "degC")).toBe("20\\,{}^\\circ\\mathrm{C}");
    expect(latexQty(0.005, "mA")).toBe("5\\,\\mathrm{mA}");
  });

  it("düzlem açı derecesinde boşluk ve boş taban kullanılmaz", () => {
    expect(latexQty(Math.PI / 4, "deg")).toBe("45^\\circ");
    // Üslü sayıda çift üst simge oluşmaması için boş taban kalır
    expect(latexQty((1.5e-6 * Math.PI) / 180, "deg")).toBe("1{,}5 \\times 10^{-6}{}^\\circ");
  });

  it("yüzde sayının önüne yazılır (Türkçe), sembolsüz birimde yalnız sayı", () => {
    expect(latexQty(0.5, "yuzde")).toBe("\\%50");
    expect(latexQty(-0.05, "yuzde")).toBe("-\\%5");
    expect(latexQty(0.005, "binde")).toBe("{\\%_0}5");
    expect(latexQty(0.5, "kesir")).toBe("0{,}5"); // sembol "-"
    expect(latexQty(3, "adet")).toBe("3"); // sembol ""
  });

  it("latexSI boyutun SI birimini kullanır", () => {
    expect(latexSI(6, "direnc")).toBe("6\\,\\Omega");
    expect(latexSI(0.006, "akim")).toBe("0{,}006\\,\\mathrm{A}");
    expect(latexUnit("kohm")).toBe("\\mathrm{k}\\Omega");
  });

  it("latexOperand negatif değeri parantezler", () => {
    expect(latexOperand(-2, "akim")).toBe("(-2\\,\\mathrm{A})");
    expect(latexOperand(2, "akim")).toBe("2\\,\\mathrm{A}");
  });

  it("tüm çıktılar KaTeX'te strict kipte hatasız işlenir", () => {
    const all = [
      latexQty(1500, "kV"),
      latexQty(2000, "kohm"),
      latexQty(1.5e-6, "uF"),
      latexQty(2.5e-6, "mm2"),
      latexQty(293.15, "degC"),
      latexQty(Math.PI / 4, "deg"),
      latexQty((1.5e-6 * Math.PI) / 180, "deg"),
      latexQty(0.5, "yuzde"),
      latexQty(-0.05, "yuzde"),
      latexQty(0.005, "binde"),
      latexQty(Number.NaN, "V"),
      latexQty(1, "ohm_m"),
      latexQty(1, "W_m2K"),
      latexQty(100, "rpm"),
      latexOperand(-2e-9, "akim"),
    ];
    for (const l of all) expect(() => renderStrict(l), l).not.toThrow();
  });
});
