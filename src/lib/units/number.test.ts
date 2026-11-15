import { describe, expect, it } from "vitest";
import { formatNumber, formatQuantity, parseNumber } from "./index";

describe("parseNumber", () => {
  it.each<[string, number]>([
    // ondalık ayırıcı
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["0,001", 0.001],
    ["42", 42],
    ["-3,25", -3.25],
    ["+5", 5],
    // tek nokta ondalıktır
    ["1.000", 1],
    ["12.345", 12.345],
    // birden çok nokta binliktir
    ["1.000.000", 1e6],
    ["12.345.678", 12345678],
    // nokta ve virgül birlikte: nokta binlik, virgül ondalık
    ["1.234,5", 1234.5],
    ["1.234.567,89", 1234567.89],
    ["1.234,", 1234],
    // boşluklar
    ["  42  ", 42],
    ["1 234,5", 1234.5],
    ["1 234,5", 1234.5],
    ["1 234", 1234],
    ["1 234 567", 1234567],
    ["\t7,5\n", 7.5],
    // Unicode eksi
    ["−5", -5],
    ["−1,5", -1.5],
    ["1,5e−3", 0.0015],
    // bilimsel gösterim
    ["1,5e-3", 0.0015],
    ["1.5e-3", 0.0015],
    ["2E6", 2e6],
    ["1e+3", 1000],
    ["-2,5E2", -250],
    ["1.234,5e3", 1234500],
    // boş tam/ondalık kısım
    [",5", 0.5],
    [".5", 0.5],
    ["5,", 5],
    ["-,25", -0.25],
  ])("%j → %s", (text, expected) => {
    expect(parseNumber(text)).toBe(expected);
  });

  it("-0 yerine 0 döner", () => {
    expect(Object.is(parseNumber("-0"), 0)).toBe(true);
    expect(Object.is(parseNumber("−0,0"), 0)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "abc",
    "1,2,3",
    "1,5,",
    "NaN",
    "Infinity",
    "-Infinity",
    "0x10",
    "1e999",
    "-1e999",
    // virgülden sonra nokta (İngilizce yazım) belirsizdir
    "1,234.5",
    // karışık durumda noktalı kısım üçlü gruplanmalı
    "1.23,4",
    "1.5,",
    // birden çok noktada ilk grup 1–3 hane, diğerleri tam 3 hane
    "1234.567.890",
    "1.2.3",
    "12.34.567",
    "1.000.00",
    // eksik veya bozuk parçalar
    ",",
    ".",
    "-",
    "e5",
    "1e",
    "1e1.5",
    "--5",
    "1-2",
    "5%",
    "1_000",
  ])("%j → null", (text) => {
    expect(parseNumber(text)).toBeNull();
  });

  it("metin olmayan girdi → null", () => {
    expect(parseNumber(undefined as unknown as string)).toBeNull();
    expect(parseNumber(5 as unknown as string)).toBeNull();
  });
});

describe("formatNumber", () => {
  it.each<[number, string]>([
    [0, "0"],
    [-0, "0"],
    [1, "1"],
    [1.5, "1,5"],
    [1.50001, "1,5"],
    [100, "100"],
    [1234, "1.234"],
    [1234.5, "1.235"],
    [-1234.5, "-1.235"],
    [12345.6, "12.350"],
    [123456789, "123.500.000"],
    [1e8, "100.000.000"],
    [1 / 3, "0,3333"],
    [2 / 3, "0,6667"],
    [0.1 + 0.2, "0,3"],
    // en kısa ondalık yazım üzerinden yarım-yukarı yuvarlama
    [1.0005, "1,001"],
    [9.9996, "10"],
    // bilimsel eşik: 1e-4 dahil değil, 1e9 dahil
    [0.0001, "0,0001"],
    [0.00012345, "0,0001235"],
    [9.9e-5, "9,9×10⁻⁵"],
    [1.5e-6, "1,5×10⁻⁶"],
    [-1.5e-6, "-1,5×10⁻⁶"],
    [1e9, "1×10⁹"],
    [1.2345e9, "1,235×10⁹"],
    [-2.5e12, "-2,5×10¹²"],
    [6.02214076e23, "6,022×10²³"],
    [5e-324, "5×10⁻³²⁴"],
    // eşik yuvarlamadan sonra uygulanır; 9'ların eldesi üssü artırır
    [999999999.9, "1×10⁹"],
    [999949999, "999.900.000"],
    [9.99996e-5, "0,0001"],
    [9.99996e-6, "1×10⁻⁵"],
    [9.99996e9, "1×10¹⁰"],
  ])("%s → %j", (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });

  it.each<[number, number, string]>([
    [3.14159, 2, "3,14"],
    [2.5, 2, "2,50"],
    [2.675, 2, "2,68"],
    [1234.5, 0, "1.235"],
    [0.5, 0, "1"],
    [-0.5, 0, "-1"],
    [1234567.891, 2, "1.234.567,89"],
    [999.995, 2, "1.000,00"],
    [9.995, 2, "10,00"],
    [0, 2, "0,00"],
    [-0, 2, "0,00"],
    [-0.001, 2, "0,00"],
    [0.0004, 3, "0,000"],
    [0.0001, 2, "0,00"],
    [7, 3, "7,000"],
    // bilimsel eşik sabit ondalıkta da geçerli; decimals mantise uygulanır
    [1e-6, 2, "1,00×10⁻⁶"],
    [-2.345e-7, 1, "-2,3×10⁻⁷"],
    [1.5e10, 3, "1,500×10¹⁰"],
    [999999999.999, 2, "1,00×10⁹"],
  ])("%s, decimals %s → %j", (value, decimals, expected) => {
    expect(formatNumber(value, { decimals })).toBe(expected);
  });

  it("significant seçeneği", () => {
    expect(formatNumber(1234.5678, { significant: 6 })).toBe("1.234,57");
    expect(formatNumber(2.675, { significant: 3 })).toBe("2,68");
    expect(formatNumber(0.000123456, { significant: 2 })).toBe("0,00012");
    expect(formatNumber(987654, { significant: 1 })).toBe("1.000.000");
    expect(formatNumber(1.5, { significant: 10 })).toBe("1,5");
  });

  it("decimals verilince significant yok sayılır", () => {
    expect(formatNumber(1234.5678, { decimals: 1, significant: 2 })).toBe("1.234,6");
  });

  it("geçersiz seçenekler sınırlanır", () => {
    expect(formatNumber(1.23456, { significant: 0 })).toBe("1");
    expect(formatNumber(1.5, { decimals: -2 })).toBe("2");
    expect(formatNumber(1.25, { decimals: 1.4 })).toBe("1,3");
    expect(formatNumber(1.5, { decimals: Number.NaN })).toBe("1,5");
  });

  it("NaN ve sonsuz → —", () => {
    expect(formatNumber(Number.NaN)).toBe("—");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatNumber(Number.NEGATIVE_INFINITY, { decimals: 2 })).toBe("—");
  });

  it("çok basamaklı biçimlenmiş değerler geri okunabilir", () => {
    // Not: tek binlik gruplu tamsayılar ("1.235") geri okunamaz; parseNumber tek noktayı ondalık sayar.
    for (const v of [1234.5, 1234567.89, -0.0123, 12.5]) {
      expect(parseNumber(formatNumber(v, { significant: 9 }))).toBe(v);
    }
  });
});

describe("formatQuantity", () => {
  it.each<[number, string, string]>([
    [1.5, "kV", "1,5 kV"],
    [1500, "rpm", "1.500 dev/dk"],
    [2.5, "mm2", "2,5 mm²"],
    [25, "degC", "25 °C"],
    [10, "deltaK", "10 K"],
    [4.7e-6, "F", "4,7×10⁻⁶ F"],
    [3.5, "percent", "%3,5"],
    [-2, "percent", "-%2"],
    [5, "permille", "‰5"],
    [30, "deg", "30°"],
    [5, "arcmin", "5′"],
    [0.85, "unitless", "0,85"],
    [0.5, "fraction", "0,5"],
    [Number.NaN, "kV", "—"],
  ])("%s %s → %j", (value, unitId, expected) => {
    expect(formatQuantity(value, unitId)).toBe(expected);
  });

  it("seçenekler formatNumber'a geçer", () => {
    expect(formatQuantity(1.5, "kV", { decimals: 2 })).toBe("1,50 kV");
    expect(formatQuantity(12.3456, "Nm", { significant: 3 })).toBe("12,3 N·m");
  });

  it("bilinmeyen birimde hata", () => {
    expect(() => formatQuantity(1, "xyz")).toThrow(/Bilinmeyen birim/);
    expect(() => formatQuantity(Number.NaN, "xyz")).toThrow(/Bilinmeyen birim/);
  });
});
