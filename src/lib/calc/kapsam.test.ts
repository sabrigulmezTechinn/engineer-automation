/**
 * Kayıt defterindeki hesap kimlikleri, bitmiş fazların KAPSAM listesiyle birebir aynı olmalı.
 * Her faz birleştiğinde bu liste güncellenir; bir hesabın kategori index'ine eklenmesi unutulursa kırılır.
 */
import { describe, expect, it } from "vitest";
import { allCalcs } from "./registry";

/** Faz 1 sonu: temel elektrik (7), motor (5), otomasyon (7), yardımcı (2) = 21 hesap */
const BEKLENEN = [
  "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7",
  "3.1", "3.2", "3.3", "3.4", "3.5",
  "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7",
  "7.1", "7.2",
];

describe("KAPSAM kapsaması", () => {
  it("kayıtlı hesaplar beklenen kimlik listesiyle birebir aynı", () => {
    expect(allCalcs().map((d) => d.id)).toEqual(BEKLENEN);
  });
});
