/**
 * 4.5 kod tabloları ve tek metin kutusu ayrıştırıcısı testleri.
 * Beklenen değerler kaynaklardaki örneklerden (kaynak URL'leri kod-ortak.ts'te):
 * - Bourns CR "EIA-96 Marking for CR0603, 1 %": 01 → 100, 10 → 124, 25 → 178, 48 → 309, 49 → 316, 73 → 562, 96 → 976;
 *   "103 (Value = 10K Ω)", "4422 (Value = 44.2K Ω)", "10C (Value = 12.4K Ω)"; çarpanlar Z 10⁻³ … F 10⁵.
 * - TT TN004: "472 = 4700 ohms", "1331 = 1330 ohms", "330 = 33 ohms", "4R7 = 4.7 ohms", "34R8 = 34.8 ohms", "07B = 1K15";
 *   EIA-96 tablosu: 68 → 499 (A sütunu 499R), 85 → 750 (D sütunu 750K).
 * - Vishay 20020: "10L0 to 91L0" = 0,01–0,091 Ω; "R10 to R91" = 0,1–0,91 Ω; "1R0 to 9R1"; "100 to 910" = 10–91 Ω;
 *   "107 to 917" = 100–910 MΩ; "R100 to R976"; "10R0 to 97R6"; "1006 to 9766" = 100–976 MΩ.
 * - KEMET C0G: "2.2 pF = 229", "0.5 pF = 508"; KEMET X7R örneği "106" (10 µF); Vishay 45171: "104" = 100 nF.
 */
import { describe, expect, it } from "vitest";
import { E_SERIES } from "../yardimci/e-serileri";
import {
  ANAHTAR,
  EIA96_HARF_US,
  anlamliHane,
  bantRenkleri,
  smdKodlari,
  KOND_CARPAN_US,
  eia96Taban,
  kodCoz,
  kodYaz,
  scaled,
  smdKodDegeri,
  type KodTuru,
} from "./kod-ortak";

function smdOhm(kod: string): number {
  const d = smdKodDegeri(Array.from(kod));
  if ("hata" in d) throw new Error(d.hata);
  return scaled(d.m, d.us);
}

describe("EIA-96 tablosu (E_SERIES.E96 ile kurulan eşleme kaynağa karşı)", () => {
  it.each([
    [1, 100],
    [7, 115],
    [10, 124],
    [25, 178],
    [48, 309],
    [49, 316],
    [68, 499],
    [73, 562],
    [85, 750],
    [96, 976],
  ])("kod %s → %s", (kod, taban) => {
    expect(eia96Taban(kod)).toBe(taban);
  });

  it("96 kod E96 serisinin tamamıdır; 0 ve 97 reddedilir", () => {
    expect(Array.from({ length: 96 }, (_, i) => eia96Taban(i + 1))).toEqual([...E_SERIES.E96]);
    expect(() => eia96Taban(0)).toThrow();
    expect(() => eia96Taban(97)).toThrow();
  });

  it("çarpan harfleri (Bourns): Z 10⁻³, Y 10⁻², X 10⁻¹, A 1, B 10, C 10², D 10³, E 10⁴, F 10⁵; H, R, S yok", () => {
    expect(EIA96_HARF_US).toEqual({ Z: -3, Y: -2, X: -1, A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 });
  });

  it("örnekler: 10C = 12,4 kΩ (Bourns), 07B = 1,15 kΩ (TT), 01C = 10 kΩ", () => {
    expect(scaled(eia96Taban(10), EIA96_HARF_US.C)).toBe(12400);
    expect(scaled(eia96Taban(7), EIA96_HARF_US.B)).toBe(1150);
    expect(scaled(eia96Taban(1), EIA96_HARF_US.C)).toBe(10000);
    expect(scaled(eia96Taban(1), EIA96_HARF_US.Y)).toBe(1);
  });
});

describe("çip direnç kodu (3/4 karakter, R ve L ondalık)", () => {
  it.each([
    ["472", 4700],
    ["103", 10000],
    ["330", 33],
    ["100", 10],
    ["910", 91],
    ["107", 100e6],
    ["917", 910e6],
    ["4R7", 4.7],
    ["1R0", 1],
    ["9R1", 9.1],
    ["R10", 0.1],
    ["R91", 0.91],
    ["1331", 1330],
    ["4422", 44200],
    ["1000", 100],
    ["9766", 976e6],
    ["34R8", 34.8],
    ["10R0", 10],
    ["97R6", 97.6],
    ["1R00", 1],
    ["R100", 0.1],
    ["R976", 0.976],
    ["10L0", 0.01],
    ["91L0", 0.091],
  ])("%s → %s Ω", (kod, ohm) => {
    expect(smdOhm(kod)).toBeCloseTo(ohm, 12);
  });

  it("iki ondalık işareti ya da sonda işaret hatadır", () => {
    expect(smdKodDegeri(["R", "R", "1"])).toHaveProperty("hata");
    expect(smdKodDegeri(["4", "R", "L", "0"])).toHaveProperty("hata");
    expect(smdKodDegeri(["4", "7", "R"])).toHaveProperty("hata");
  });
});

describe("kodCoz — tek metin kutusu", () => {
  it("SMD 3 karakter: 472, 4r7 (küçük harf), R47", () => {
    expect(kodCoz("472", "smd")).toEqual({
      ok: true,
      secimler: { mod: "smd", tip: "3", s3_1: "4", s3_2: "7", s3_3: "2" },
      sayilar: {},
    });
    expect(kodCoz(" 4r7 ", "smd")).toMatchObject({ ok: true, secimler: { tip: "3", s3_1: "4", s3_2: "R", s3_3: "7" } });
    expect(kodCoz("R47", "smd")).toMatchObject({ ok: true, secimler: { s3_1: "R", s3_2: "4", s3_3: "7" } });
  });

  it("SMD 4 karakter: 4702, 47R0, R047, 10L0", () => {
    expect(kodCoz("4702", "smd")).toMatchObject({ ok: true, secimler: { tip: "4", s4_1: "4", s4_2: "7", s4_3: "0", s4_4: "2" } });
    expect(kodCoz("47R0", "smd")).toMatchObject({ ok: true, secimler: { s4_3: "R" } });
    expect(kodCoz("R047", "smd")).toMatchObject({ ok: true, secimler: { s4_1: "R", s4_2: "0", s4_3: "4", s4_4: "7" } });
    expect(kodCoz("10L0", "smd")).toMatchObject({ ok: true, secimler: { s4_3: "L" } });
  });

  it("EIA-96: 01C → kod 1 (sayı girdisi) ve harf C; 10c küçük harfle", () => {
    expect(kodCoz("01C", "smd")).toEqual({
      ok: true,
      secimler: { mod: "smd", tip: "eia96", eia_harf: "C" },
      sayilar: { eia_kod: "1" },
    });
    expect(kodCoz("10c", "smd")).toMatchObject({ ok: true, sayilar: { eia_kod: "10" } });
  });

  it.each(["", "47", "47R", "4R7R", "1L00", "R4R", "00C", "97A", "01H", "01R", "12345", "4K7"])(
    "geçersiz SMD kodu %j Türkçe hata verir",
    (kod) => {
      const r = kodCoz(kod, "smd");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.hata.length).toBeGreaterThan(5);
    },
  );

  it("kondansatör: 104J, 104, 229C, 47J (iki hane = pF), 508", () => {
    expect(kodCoz("104J", "kondansator")).toEqual({
      ok: true,
      secimler: { mod: "kondansator", k1: "1", k2: "0", k3: "4", ktol: "J" },
      sayilar: {},
    });
    expect(kodCoz("104", "kondansator")).toMatchObject({ ok: true, secimler: { k3: "4", ktol: "yok" } });
    expect(kodCoz("229c", "kondansator")).toMatchObject({ ok: true, secimler: { k1: "2", k2: "2", k3: "9", ktol: "C" } });
    expect(kodCoz("47J", "kondansator")).toMatchObject({ ok: true, secimler: { k1: "4", k2: "7", k3: "0", ktol: "J" } });
    expect(kodCoz("508", "kondansator")).toMatchObject({ ok: true, secimler: { k3: "8" } });
  });

  it.each(["", "1", "107", "104Q", "1044", "4R7", "J104", "047", "00"])("geçersiz kondansatör kodu %j", (kod) => {
    expect(kodCoz(kod, "kondansator").ok).toBe(false);
  });

  it("kodYaz(kodCoz(x)) = x (gidiş-dönüş)", () => {
    const cases: [string, KodTuru][] = [
      ["472", "smd"],
      ["4R7", "smd"],
      ["R47", "smd"],
      ["4702", "smd"],
      ["R047", "smd"],
      ["10L0", "smd"],
      ["01C", "smd"],
      ["96F", "smd"],
      ["104J", "kondansator"],
      ["229C", "kondansator"],
      ["104", "kondansator"],
      ["106Z", "kondansator"],
    ];
    for (const [kod, tur] of cases) {
      const r = kodCoz(kod, tur);
      if (!r.ok) throw new Error(`${kod}: ${r.hata}`);
      const values: Record<string, string> = { ...r.secimler, ...r.sayilar };
      expect(kodYaz((k) => values[k], tur)).toBe(kod);
    }
  });

  it("iki haneli kondansatör kodu üç haneli biçimde yazılır: 47J → 470J", () => {
    const r = kodCoz("47J", "kondansator");
    if (!r.ok) throw new Error();
    expect(kodYaz((k) => r.secimler[k], "kondansator")).toBe("470J");
  });

  it("anahtarlar ve kondansatör çarpan haneleri (7 yok)", () => {
    expect(ANAHTAR.s4).toHaveLength(4);
    expect(Object.keys(KOND_CARPAN_US).sort()).toEqual(["0", "1", "2", "3", "4", "5", "6", "8", "9"]);
  });
});

describe("ters yön yardımcıları", () => {
  it("anlamliHane: 4750 → 48·10² (2 hane), 475·10 (3 hane); 9960 → 10·10³; 0,47 → 47·10⁻²", () => {
    expect(anlamliHane(4750, 2)).toEqual({ m: 48, us: 2, deger: 4800 });
    expect(anlamliHane(4750, 3)).toEqual({ m: 475, us: 1, deger: 4750 });
    expect(anlamliHane(9960, 2)).toEqual({ m: 10, us: 3, deger: 10000 });
    expect(anlamliHane(0.47, 2)).toEqual({ m: 47, us: -2, deger: 0.47 });
    expect(anlamliHane(1e15, 2)).toMatchObject({ m: 10, us: 14 });
    expect(anlamliHane(1e-3, 3)).toMatchObject({ m: 100, us: -5 });
  });

  it("bantRenkleri: 47·10² → sarı, mor, kırmızı; 10⁻³ çarpanının rengi yok", () => {
    expect(bantRenkleri(47, 2)).toEqual(["sari", "mor", "kirmizi"]);
    expect(bantRenkleri(470, -2)).toEqual(["sari", "mor", "siyah", "gumus"]);
    expect(bantRenkleri(47, -3)).toBeNull();
  });

  it("smdKodlari gidiş-dönüş: üretilen her kod çözüldüğünde aynı değeri verir (E24 ve E96, 0,01 Ω – 976 MΩ)", () => {
    let sayac = 0;
    for (const [seri, olcek] of [
      [E_SERIES.E24, 10],
      [E_SERIES.E96, 100],
    ] as const) {
      for (let us = -4; us <= 9; us++) {
        for (const m of seri) {
          const R = scaled(m, us) / olcek;
          if (R < 0.01 || R > 976e6) continue;
          const k = smdKodlari(R);
          for (const kod of [k.uc, k.dort]) {
            if (kod === null) continue;
            expect(smdOhm(kod) / R, kod).toBeCloseTo(1, 12);
            sayac++;
          }
          if (k.eia96) {
            const r = kodCoz(k.eia96, "smd");
            if (!r.ok) throw new Error(r.hata);
            const deger = scaled(eia96Taban(Number(r.sayilar.eia_kod)), EIA96_HARF_US[r.secimler.eia_harf]);
            expect(deger / R, k.eia96).toBeCloseTo(1, 12);
            sayac++;
          }
        }
      }
    }
    expect(sayac).toBeGreaterThan(1000);
  });
});
