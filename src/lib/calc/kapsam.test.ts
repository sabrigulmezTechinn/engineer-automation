/**
 * Kayıt defterindeki hesap kimlikleri, bitmiş fazların KAPSAM listesiyle birebir aynı olmalı.
 * Her faz birleştiğinde bu liste güncellenir; bir hesabın kategori index'ine eklenmesi unutulursa kırılır.
 */
import { describe, expect, it } from "vitest";
import { allCalcs } from "./registry";

/**
 * Faz 3 sonu: temel elektrik (7), tesisat (8), motor (5), otomasyon (7), mekatronik (9), yardımcı (2) = 38 hesap
 */
const BEKLENEN = [
  "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7",
  "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8",
  "3.1", "3.2", "3.3", "3.4", "3.5",
  "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7",
  "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9",
  "7.1", "7.2",
];

describe("KAPSAM kapsaması", () => {
  it("kayıtlı hesaplar beklenen kimlik listesiyle birebir aynı", () => {
    expect(allCalcs().map((d) => d.id)).toEqual(BEKLENEN);
  });
});
