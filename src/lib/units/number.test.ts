import { describe, expect, it } from "vitest";
import { formatNumber, formatQuantity, parseNumber } from "./index";

/** Beklenen metinlerde "_" yerine binlik ayırıcı (dar bölünmez boşluk, U+202F) koyar. */
const g = (s: string) => s.replace(/_/g, " ");

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
    // formatNumber'ın bilimsel biçimi
    ["1,5×10⁻⁶", 1.5e-6],
    ["-2,5×10¹²", -2.5e12],
    ["1×10⁹", 1e9],
    ["1,00×10⁻⁶", 1e-6],
    ["6,022×10²³", 6.022e23],
    ["5×10⁻³²⁴", 5e-324],
    ["1,5×10⁺³", 1500],
    ["1,5 × 10⁻⁶", 1.5e-6],
    ["−1,5×10⁻⁶", -1.5e-6],
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
    // bozuk "×10" biçimleri
    "×10⁶",
    "1,5×10",
    "1,5×10⁻",
    "1,5×10⁻⁶⁻",
    "1e3×10⁶",
    "1,5×⁶",
    "1,5×10^6",
    "1,5×10⁹⁹⁹",
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
    // 4 haneli tam kısımlar gruplanmaz, 5 ve üstü U+202F ile gruplanır
    [1234, "1234"],
    [1234.5, "1235"],
    [-1234.5, "-1235"],
    [9999, "9999"],
    [10000, g("10_000")],
    [-12340, g("-12_340")],
    [-12345, g("-12_345")], // tam sayı basamakları atılmaz
    [12345.6, g("12_346")],
    [123456789, g("123_456_789")],
    [1e8, g("100_000_000")],
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
    [999949999, g("999_900_000")],
    [9.99996e-5, "0,0001"],
    [9.99996e-6, "1×10⁻⁵"],
    [9.99996e9, "1×10¹⁰"],
  ])("%s → %j", (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });

  it("binlik ayırıcı nokta değil, dar bölünmez boşluk (U+202F)", () => {
    const text = formatNumber(1234567.5, { significant: 8 });
    expect(text).toBe("1 234 567,5");
    expect(text).not.toContain(".");
  });

  it.each<[number, number, string]>([
    [3.14159, 2, "3,14"],
    [2.5, 2, "2,50"],
    [2.675, 2, "2,68"],
    [1234.5, 0, "1235"],
    [0.5, 0, "1"],
    [-0.5, 0, "-1"],
    [1234567.891, 2, g("1_234_567,89")],
    [999.995, 2, "1000,00"],
    [99999.995, 2, g("100_000,00")],
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
    expect(formatNumber(1234.5678, { significant: 6 })).toBe("1234,57");
    expect(formatNumber(2.675, { significant: 3 })).toBe("2,68");
    expect(formatNumber(0.000123456, { significant: 2 })).toBe("0,00012");
    expect(formatNumber(987654, { significant: 1 })).toBe(g("1_000_000"));
    expect(formatNumber(1.5, { significant: 10 })).toBe("1,5");
  });

  it("decimals verilince significant yok sayılır", () => {
    expect(formatNumber(1234.5678, { decimals: 1, significant: 2 })).toBe("1234,6");
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
});

describe("formatNumber → parseNumber gidiş-dönüşü", () => {
  /** Tekrarlanabilir sözde rastgele üreteç (mulberry32) */
  function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const fixed = [
    0, -0, 1, -1, 0.5, 1234, 1235, 9999, 10000, 12345, -12345.678, 1234567.5, 123456789,
    999999999, 1e9, 1.5e-6, -1.5e-6, 1e-4, 9.99e-5, 0.1 + 0.2, Math.PI, -Math.E, 6.02214076e23,
    1.602176634e-19, 1e308, -1.5e308, Number.MIN_VALUE, Number.EPSILON, Number.MAX_SAFE_INTEGER,
    // Number.MAX_VALUE bilerek yok: gösterim yuvarlaması onu aralık dışına taşır
    // ("1,798×10³⁰⁸" → Infinity → null). Mühendislik değerlerinde karşılaşılmaz.
  ];
  const next = rng(20261115);
  const random = Array.from({ length: 500 }, () => {
    const sign = next() < 0.5 ? -1 : 1;
    const exponent = Math.floor(next() * 61) - 30; // 1e-30 … 1e30
    return sign * (1 + next() * 9) * 10 ** exponent;
  });
  const values = [...fixed, ...random];

  // Sınırlar: yuvarlama payı (0,5 birim / 15. veya 4. basamak) + ikili gösterim için küçük pay
  it("significant 15 ile her sonlu değer geri okunur (göreli hata ≤ 6e-15)", () => {
    for (const x of values) {
      const text = formatNumber(x, { significant: 15 });
      const back = parseNumber(text);
      expect(back, `${x} → ${JSON.stringify(text)}`).not.toBeNull();
      const err = x === 0 ? Math.abs(back as number) : Math.abs((back as number) - x) / Math.abs(x);
      expect(err, `${x} → ${JSON.stringify(text)} → ${back}`).toBeLessThanOrEqual(6e-15);
    }
  });

  it("varsayılan biçim (4 anlamlı basamak) de geri okunur (göreli hata ≤ 5e-4)", () => {
    for (const x of values) {
      const text = formatNumber(x);
      const back = parseNumber(text);
      expect(back, `${x} → ${JSON.stringify(text)}`).not.toBeNull();
      const err = x === 0 ? Math.abs(back as number) : Math.abs((back as number) - x) / Math.abs(x);
      expect(err, `${x} → ${JSON.stringify(text)} → ${back}`).toBeLessThanOrEqual(5.001e-4);
    }
  });

  it("sabit ondalıklı biçim geri okunur", () => {
    for (const x of [1234.5, -98765.4321, 1e-6, 2.5e12, 0.125]) {
      const text = formatNumber(x, { decimals: 3 });
      const back = parseNumber(text) as number;
      expect(Math.abs(back - x) / Math.abs(x), `${x} → ${JSON.stringify(text)}`).toBeLessThanOrEqual(5e-4);
    }
  });
});

describe("formatQuantity", () => {
  it.each<[number, string, string]>([
    [1.5, "kV", "1,5 kV"],
    [1500, "rpm", "1500 dev/dk"],
    [12340, "W", g("12_340 W")],
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
