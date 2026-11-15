/**
 * Kayıt defterindeki hesap kimlikleri, bitmiş fazların KAPSAM listesiyle birebir aynı olmalı.
 * Her faz birleştiğinde bu liste güncellenir; bir hesabın kategori index'ine eklenmesi unutulursa kırılır.
 */
import { describe, expect, it } from "vitest";
import { allCalcs } from "./registry";

/**
 * Tüm kapsam (Faz 4 sonu): temel elektrik (7), tesisat (8), motor (5), elektronik (12), otomasyon (7), mekatronik (9),
 * yardımcı (2) = 50 hesap
 */
const BEKLENEN = [
  "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7",
  "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8",
  "3.1", "3.2", "3.3", "3.4", "3.5",
  "4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12",
  "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7",
  "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9",
  "7.1", "7.2",
];

describe("KAPSAM kapsaması", () => {
  it("kayıtlı hesaplar beklenen kimlik listesiyle birebir aynı", () => {
    expect(allCalcs().map((d) => d.id)).toEqual(BEKLENEN);
  });
});
