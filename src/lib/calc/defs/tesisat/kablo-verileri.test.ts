/**
 * Katalog tablolarının aktarım denetimi. Örnek satırlar Prysmian sayfa görüntülerinden tekrar okunmuştur
 * (NYY s. 73, YXV s. 89, 4 damarlı tablolar); tablo bütünü kesitle tutarlı artmalıdır.
 */
import { describe, expect, it } from "vitest";
import { PRYSMIAN_NYY_4D, PRYSMIAN_YXV_4D, katalogSatiriSI } from "./kablo-verileri";

const row = (k: typeof PRYSMIAN_NYY_4D, s: number) => k.satirlar.find((r) => r.kesitMm2 === s);

describe("Prysmian katalog tabloları", () => {
  it("NYY örnek satırları (s. 73)", () => {
    expect(row(PRYSMIAN_NYY_4D, 1.5)).toEqual({ kesitMm2: 1.5, r20OhmKm: 12.1, toprakA: 27, havaA: 19.5 });
    expect(row(PRYSMIAN_NYY_4D, 10)).toEqual({ kesitMm2: 10, r20OhmKm: 1.83, toprakA: 79, havaA: 59 });
    expect(row(PRYSMIAN_NYY_4D, 95)).toEqual({ kesitMm2: 95, r20OhmKm: 0.193, toprakA: 280, havaA: 246 });
    expect(row(PRYSMIAN_NYY_4D, 240)).toEqual({ kesitMm2: 240, r20OhmKm: 0.0754, toprakA: 473, havaA: 445 });
  });

  it("YXV örnek satırları (s. 89)", () => {
    expect(row(PRYSMIAN_YXV_4D, 2.5)).toEqual({ kesitMm2: 2.5, r20OhmKm: 7.41, toprakA: 40, havaA: 32 });
    expect(row(PRYSMIAN_YXV_4D, 25)).toEqual({ kesitMm2: 25, r20OhmKm: 0.727, toprakA: 145, havaA: 133 });
    expect(row(PRYSMIAN_YXV_4D, 95)).toEqual({ kesitMm2: 95, r20OhmKm: 0.193, toprakA: 305, havaA: 308 });
    expect(row(PRYSMIAN_YXV_4D, 400)).toEqual({ kesitMm2: 400, r20OhmKm: 0.047, toprakA: 671, havaA: 761 });
  });

  it.each([PRYSMIAN_NYY_4D, PRYSMIAN_YXV_4D])("$id: kesit artarken kapasite artar, direnç azalır", (k) => {
    expect(k.satirlar).toHaveLength(17);
    for (let i = 1; i < k.satirlar.length; i++) {
      const a = k.satirlar[i - 1];
      const b = k.satirlar[i];
      expect(b.kesitMm2).toBeGreaterThan(a.kesitMm2);
      expect(b.toprakA).toBeGreaterThan(a.toprakA);
      expect(b.havaA).toBeGreaterThan(a.havaA);
      expect(b.r20OhmKm).toBeLessThan(a.r20OhmKm);
    }
  });

  it("aynı kesitte XLPE (90 °C) kapasitesi PVC'den (70 °C) büyük; DC direnç aynı", () => {
    for (const p of PRYSMIAN_NYY_4D.satirlar) {
      const x = row(PRYSMIAN_YXV_4D, p.kesitMm2);
      expect(x).toBeDefined();
      expect(x!.toprakA).toBeGreaterThan(p.toprakA);
      expect(x!.havaA).toBeGreaterThan(p.havaA);
      expect(x!.r20OhmKm).toBe(p.r20OhmKm);
    }
  });

  it("SI çevirisi: 10 mm² → 1e-5 m², 1,83 Ω/km → 1,83e-3 Ω/m", () => {
    const s = katalogSatiriSI({ kesitMm2: 10, r20OhmKm: 1.83, toprakA: 79, havaA: 59 });
    expect(s.kesit).toBeCloseTo(1e-5, 15);
    expect(s.r20).toBeCloseTo(1.83e-3, 15);
    expect([s.toprak, s.hava]).toEqual([79, 59]);
  });
});
