/**
 * Server action'ların sınır davranışı (veri katmanı ve oturum taklit edilir): oturum zorunluluğu, kullanıcı
 * kimliğinin yalnızca oturumdan alınması, zod doğrulaması, Türkçe hata mesajları, yenileme/yönlendirme.
 * Veri katmanının kendisi islemler.integration.test.ts'te gerçek PostgreSQL ile denenir.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KayitHatasi } from "./types";

const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((yol: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { yol });
  }),
  projeleriListele: vi.fn(),
  projeOlustur: vi.fn(),
  projeGuncelle: vi.fn(),
  projeSil: vi.fn(),
  hesapKaydet: vi.fn(),
  hesapGuncelle: vi.fn(),
  hesapKopyala: vi.fn(),
  hesapSil: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: m.getSession }));
vi.mock("next/cache", () => ({ refresh: m.refresh }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("./islemler", () => ({
  projeleriListele: m.projeleriListele,
  projeOlustur: m.projeOlustur,
  projeGuncelle: m.projeGuncelle,
  projeSil: m.projeSil,
  hesapKaydet: m.hesapKaydet,
  hesapGuncelle: m.hesapGuncelle,
  hesapKopyala: m.hesapKopyala,
  hesapSil: m.hesapSil,
}));

const a = await import("./actions");

const OTURUM = { user: { id: "kullanici-1" }, session: { id: "s" } };
const GIRDILER = { V: { value: "230", unit: "V" } };

beforeEach(() => {
  vi.clearAllMocks();
  m.getSession.mockResolvedValue(OTURUM);
});

describe("kayıt action'ları", () => {
  it("oturum yoksa hiçbir veri işlemi yapılmaz, girisGerekli döner", async () => {
    m.getSession.mockResolvedValue(null);
    const sonuclar = await Promise.all([
      a.projeleriGetirAction(),
      a.kayitOlusturAction({ hesapSlug: "ohm-yasasi", ad: "X", girdiler: {} }),
      a.kayitGuncelleAction("id", { ad: "X" }),
      a.kayitTasiAction("id", null),
      a.kayitKopyalaAction("id"),
      a.kayitSilAction("id"),
      a.projeOlusturAction({ ad: "P" }),
      a.projeGuncelleAction("id", { ad: "P" }),
      a.projeSilAction("id"),
    ]);
    for (const s of sonuclar) expect(s).toMatchObject({ ok: false, girisGerekli: true, hata: expect.stringContaining("giriş") });
    for (const fn of [m.projeleriListele, m.projeOlustur, m.projeGuncelle, m.projeSil, m.hesapKaydet, m.hesapGuncelle, m.hesapKopyala, m.hesapSil]) {
      expect(fn).not.toHaveBeenCalled();
    }
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("oturum okunamazsa (veritabanı hatası) da girisGerekli döner", async () => {
    m.getSession.mockRejectedValue(new Error("bağlantı yok"));
    expect(await a.kayitSilAction("id")).toMatchObject({ ok: false, girisGerekli: true });
  });

  it("kullanıcı kimliği yalnızca oturumdan alınır; gövdedeki fazla alanlar atılır", async () => {
    m.hesapKaydet.mockResolvedValue({ id: "k1" });
    const sonuc = await a.kayitOlusturAction({
      hesapSlug: "ohm-yasasi",
      ad: "  Pano  ",
      userId: "baska-kullanici",
      girdiler: GIRDILER,
      ciktiBirimleri: { P: "kW" },
    });
    expect(sonuc).toEqual({ ok: true, veri: { id: "k1" } });
    expect(m.hesapKaydet).toHaveBeenCalledWith("kullanici-1", {
      hesapSlug: "ohm-yasasi",
      ad: "Pano",
      notlar: null,
      projeId: null,
      girdiler: GIRDILER,
      ciktiBirimleri: { P: "kW" },
    });
    expect(m.refresh).toHaveBeenCalledTimes(1);

    m.hesapGuncelle.mockResolvedValue({ id: "k1" });
    await a.kayitGuncelleAction("k1", { girdiler: GIRDILER, userId: "baska" });
    expect(m.hesapGuncelle).toHaveBeenCalledWith("kullanici-1", "k1", { girdiler: GIRDILER });
  });

  it("yeni proje adı verilirse önce proje oluşturulur ve kayıt oraya yazılır", async () => {
    m.projeOlustur.mockResolvedValue({ id: "p-yeni" });
    m.hesapKaydet.mockResolvedValue({ id: "k1" });
    await a.kayitOlusturAction({
      hesapSlug: "ohm-yasasi",
      ad: "Pano",
      projeId: "yok-sayilir",
      yeniProjeAdi: " Fabrika ",
      girdiler: {},
    });
    expect(m.projeOlustur).toHaveBeenCalledWith("kullanici-1", { ad: "Fabrika" });
    expect(m.hesapKaydet).toHaveBeenCalledWith("kullanici-1", expect.objectContaining({ projeId: "p-yeni" }));
  });

  it("geçersiz kayıt isteğinde proje oluşturulmaz", async () => {
    const bilinmeyen = await a.kayitOlusturAction({ hesapSlug: "yok", ad: "X", yeniProjeAdi: "P", girdiler: {} });
    expect(bilinmeyen).toEqual({ ok: false, hata: "Bilinmeyen hesap türü." });
    const bosAd = await a.kayitOlusturAction({ hesapSlug: "ohm-yasasi", ad: "  ", yeniProjeAdi: "P", girdiler: {} });
    expect(bosAd).toEqual({ ok: false, hata: "Kayıt adı boş olamaz." });
    expect(m.projeOlustur).not.toHaveBeenCalled();
    expect(m.hesapKaydet).not.toHaveBeenCalled();
  });

  it("zod hataları Türkçe mesajla döner", async () => {
    const yapisal = [
      await a.kayitOlusturAction({ hesapSlug: "ohm-yasasi", ad: "X", girdiler: { V: { value: 230 } } }),
      await a.kayitOlusturAction({ hesapSlug: "ohm-yasasi", ad: "X", girdiler: "bozuk" }),
      await a.kayitOlusturAction(null),
      await a.kayitGuncelleAction(42, { ad: "X" }),
      await a.kayitGuncelleAction("k1", { ciktiBirimleri: { P: 1 } }),
      await a.kayitTasiAction("k1", 5),
      await a.kayitSilAction(""),
    ];
    for (const s of yapisal) expect(s).toEqual({ ok: false, hata: "Gönderilen bilgiler geçersiz." });
    expect(await a.projeOlusturAction({ ad: "x".repeat(121) })).toEqual({
      ok: false,
      hata: "Proje adı en fazla 120 karakter olabilir.",
    });
    expect(await a.projeGuncelleAction("p1", { ad: "" })).toEqual({ ok: false, hata: "Proje adı boş olamaz." });
    expect(m.hesapGuncelle).not.toHaveBeenCalled();
    expect(m.hesapSil).not.toHaveBeenCalled();
  });

  it("veri katmanı hataları mesajıyla, beklenmeyen hatalar genel mesajla döner", async () => {
    m.hesapKopyala.mockRejectedValue(new KayitHatasi("bulunamadi", "Kayıt bulunamadı."));
    expect(await a.kayitKopyalaAction("k1")).toEqual({ ok: false, hata: "Kayıt bulunamadı." });

    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    m.hesapSil.mockRejectedValue(new Error("select * from ... şifre"));
    const s = await a.kayitSilAction("k1");
    expect(s.ok).toBe(false);
    expect(!s.ok && s.hata).not.toContain("select");
    expect(konsol).toHaveBeenCalled();
    konsol.mockRestore();
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("taşıma: null projesiz demektir", async () => {
    m.hesapGuncelle.mockResolvedValue({ id: "k1", projeId: null });
    await a.kayitTasiAction("k1", null);
    expect(m.hesapGuncelle).toHaveBeenCalledWith("kullanici-1", "k1", { projeId: null });
    await a.kayitTasiAction("k1", "p2");
    expect(m.hesapGuncelle).toHaveBeenLastCalledWith("kullanici-1", "k1", { projeId: "p2" });
  });

  it("proje silme başarıda /projeler'e yönlendirir, hatada yönlendirmez", async () => {
    m.projeSil.mockResolvedValue(undefined);
    await expect(a.projeSilAction("p1")).rejects.toMatchObject({ yol: "/projeler" });
    expect(m.projeSil).toHaveBeenCalledWith("kullanici-1", "p1");
    // Yönlendirme yanıtı istemci önbelleğini de geçersiz kılsın (geri tuşunda bayat proje sayfası kalmasın).
    expect(m.refresh).toHaveBeenCalledTimes(1);

    m.redirect.mockClear();
    m.refresh.mockClear();
    m.projeSil.mockRejectedValue(new KayitHatasi("bulunamadi", "Proje bulunamadı."));
    expect(await a.projeSilAction("p1")).toEqual({ ok: false, hata: "Proje bulunamadı." });
    expect(m.redirect).not.toHaveBeenCalled();
    expect(m.refresh).not.toHaveBeenCalled();
  });
});
