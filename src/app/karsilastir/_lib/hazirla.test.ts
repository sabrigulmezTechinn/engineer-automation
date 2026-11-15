/**
 * /karsilastir sunucu hazırlığı: kimlik ayıklama ve kayıtların senaryolara çevrilmesi.
 * Veri katmanı (işçi A) sahte: hesaplariGetir yalnızca kullanıcıya ait kayıtları döner (sözleşme).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KayitliHesap } from "@/lib/kayit/types";
import { kayitKarsilastirmasiHazirla, kayitKimlikleriniAyikla } from "./hazirla";

const mocks = vi.hoisted(() => ({ hesaplariGetir: vi.fn() }));
vi.mock("@/lib/kayit/islemler", () => ({ hesaplariGetir: mocks.hesaplariGetir }));

function kayit(id: string, ek: Partial<KayitliHesap> = {}): KayitliHesap {
  return {
    id,
    projeId: null,
    hesapSlug: "ohm-yasasi",
    hesapId: "1.1",
    ad: `Kayıt ${id}`,
    notlar: null,
    girdiler: { mod: { value: "V-R" }, V: { value: "12", unit: "V" }, R: { value: "6", unit: "ohm" } },
    ciktiBirimleri: {},
    createdAt: "2026-11-15T10:00:00.000Z",
    updatedAt: "2026-11-15T10:00:00.000Z",
    ...ek,
  };
}

beforeEach(() => {
  mocks.hesaplariGetir.mockReset();
});

describe("kayitKimlikleriniAyikla", () => {
  it("boş, virgüllü, tekrarlı ve dizi parametreler", () => {
    expect(kayitKimlikleriniAyikla(undefined)).toEqual({ durum: "bos" });
    expect(kayitKimlikleriniAyikla(" , ,")).toEqual({ durum: "bos" });
    expect(kayitKimlikleriniAyikla("a, b ,a,,c")).toEqual({ durum: "tamam", kimlikler: ["a", "b", "c"] });
    expect(kayitKimlikleriniAyikla(["a,b", "c", "b"])).toEqual({ durum: "tamam", kimlikler: ["a", "b", "c"] });
    expect(kayitKimlikleriniAyikla("3f1c2b7e-1d2a-4c55-9e0b-123456789abc")).toEqual({
      durum: "tamam",
      kimlikler: ["3f1c2b7e-1d2a-4c55-9e0b-123456789abc"],
    });
  });

  it("en çok 8 kayıt", () => {
    expect(kayitKimlikleriniAyikla("1,2,3,4,5,6,7,8").durum).toBe("tamam");
    expect(kayitKimlikleriniAyikla("1,2,3,4,5,6,7,8,9")).toEqual({ durum: "fazla" });
  });

  it("biçimi bozuk kimlik sorguya gitmez", () => {
    expect(kayitKimlikleriniAyikla("a;b")).toEqual({ durum: "gecersiz" });
    expect(kayitKimlikleriniAyikla("a,../b")).toEqual({ durum: "gecersiz" });
    expect(kayitKimlikleriniAyikla("x".repeat(101))).toEqual({ durum: "gecersiz" });
  });
});

describe("kayitKarsilastirmasiHazirla", () => {
  it("kayıtları kullanıcı kimliğiyle ister; senaryolar istenen sırada, varsayılanlarla tamamlanır", async () => {
    mocks.hesaplariGetir.mockResolvedValue([
      kayit("b", { ad: "6 mm²", ciktiBirimleri: { I: "A" } }),
      kayit("a", { ad: "4 mm²", ciktiBirimleri: { I: "mA" }, girdiler: { mod: { value: "V-R" }, V: { value: "24", unit: "V" } } }),
    ]);
    const sonuc = await kayitKarsilastirmasiHazirla("kullanici-1", ["a", "b"]);
    expect(mocks.hesaplariGetir).toHaveBeenCalledWith("kullanici-1", ["a", "b"]);
    if (sonuc.durum !== "tamam") throw new Error(sonuc.durum);
    expect(sonuc.hesapSlug).toBe("ohm-yasasi");
    expect(sonuc.senaryolar.map((s) => [s.id, s.ad, s.kayitId])).toEqual([
      ["a", "4 mm²", "a"],
      ["b", "6 mm²", "b"],
    ]);
    // Kayıtta olmayan girdiler tanımın varsayılanlarından (R = 6 Ω, P = 24 W …)
    expect(sonuc.senaryolar[0].state.V).toEqual({ value: "24", unit: "V" });
    expect(sonuc.senaryolar[0].state.R).toEqual({ value: "6", unit: "ohm" });
    expect(sonuc.senaryolar[0].state.P).toEqual({ value: "24", unit: "W" });
    // Ortak çıktı birimleri ilk kaydınki
    expect(sonuc.outputUnits).toEqual({ I: "mA" });
    // Düz JSON (istemci bileşenine geçer)
    expect(JSON.parse(JSON.stringify(sonuc))).toEqual(sonuc);
  });

  it("biri bile eksikse (yok ya da başkasının) bulunamadı; hangisi olduğu söylenmez", async () => {
    mocks.hesaplariGetir.mockResolvedValue([kayit("a")]);
    expect(await kayitKarsilastirmasiHazirla("u", ["a", "baskasinin"])).toEqual({ durum: "bulunamadi" });
    mocks.hesaplariGetir.mockResolvedValue([]);
    expect(await kayitKarsilastirmasiHazirla("u", ["a"])).toEqual({ durum: "bulunamadi" });
  });

  it("farklı hesap türleri açıklayıcı hata verir", async () => {
    mocks.hesaplariGetir.mockResolvedValue([kayit("a"), kayit("b", { hesapSlug: "seri-paralel", hesapId: "1.2" })]);
    expect(await kayitKarsilastirmasiHazirla("u", ["a", "b"])).toEqual({
      durum: "farkliHesap",
      hesaplar: ["Ohm yasası ve güç", "Seri/paralel R, C, L"],
    });
  });

  it("kayıt defterinde olmayan hesap türü bulunamadı sayılır", async () => {
    mocks.hesaplariGetir.mockResolvedValue([kayit("a", { hesapSlug: "kaldirilmis-hesap" })]);
    expect(await kayitKarsilastirmasiHazirla("u", ["a"])).toEqual({ durum: "bulunamadi" });
  });
});
