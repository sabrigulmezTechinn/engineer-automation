/**
 * PDF rapor uç noktaları. Oturum, veri katmanı (işçi A), karşılaştırma/grafik (işçi B) ve PDF belgeleri
 * taklit edilir; uç noktaların doğrulama, sahiplik, tercih ve yanıt başlığı davranışı denetlenir.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalcDefinition, InputState } from "@/lib/calc/types";
import type { Karsilastirma, Senaryo, TaramaSerisi } from "@/lib/karsilastirma/types";
import type { KayitliHesap, Proje } from "@/lib/kayit/types";
import type { HesapRaporu, RaporBasligi } from "@/lib/rapor/types";

const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  hesapGetir: vi.fn(),
  projeGetir: vi.fn(),
  hesaplariListele: vi.fn(),
  girdileriSuz: vi.fn((_def: unknown, girdiler: unknown) => girdiler),
  ciktiBirimleriniSuz: vi.fn((_def: unknown, birimler: unknown) => birimler),
  karsilastirmaOlustur: vi.fn(),
  taramaYap: vi.fn(),
  cizgiGrafikSvg: vi.fn(() => "<svg/>"),
  hesapRaporuPdf: vi.fn(async () => Buffer.from("%PDF-1.7 hesap")),
  projeRaporuPdf: vi.fn(async () => Buffer.from("%PDF-1.7 proje")),
  karsilastirmaRaporuPdf: vi.fn(async () => Buffer.from("%PDF-1.7 karsilastirma")),
}));

vi.mock("@/lib/session", () => ({ getSession: m.getSession }));
vi.mock("@/lib/kayit/islemler", () => ({
  hesapGetir: m.hesapGetir,
  projeGetir: m.projeGetir,
  hesaplariListele: m.hesaplariListele,
}));
vi.mock("@/lib/kayit/dogrulama", () => ({ girdileriSuz: m.girdileriSuz, ciktiBirimleriniSuz: m.ciktiBirimleriniSuz }));
vi.mock("@/lib/karsilastirma", () => ({ karsilastirmaOlustur: m.karsilastirmaOlustur, taramaYap: m.taramaYap }));
vi.mock("@/lib/karsilastirma/grafik", () => ({ cizgiGrafikSvg: m.cizgiGrafikSvg }));
vi.mock("@/lib/rapor/belgeler", () => ({
  hesapRaporuPdf: m.hesapRaporuPdf,
  projeRaporuPdf: m.projeRaporuPdf,
  karsilastirmaRaporuPdf: m.karsilastirmaRaporuPdf,
}));

import { POST as hesapPost } from "./hesap/route";
import { GET as hesapGet } from "./hesap/[id]/route";
import { POST as karsilastirmaPost } from "./karsilastirma/route";
import { GET as projeGet } from "./proje/[id]/route";

const KULLANICI = {
  id: "kullanici-1",
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  company: "Örnek A.Ş.",
  jobTitle: "Mühendis",
  decimals: 6,
  unitSystem: "si" as "si" | "imperial",
};

function oturumAc(user: Partial<typeof KULLANICI> = {}) {
  m.getSession.mockResolvedValue({ user: { ...KULLANICI, ...user }, session: { id: "oturum" } });
}

function jsonIstek(url: string, govde: unknown, basliklar: Record<string, string> = {}): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...basliklar },
    body: typeof govde === "string" ? govde : JSON.stringify(govde),
  });
}

/** Content-Length başlığı olmayan akış gövdesi (sınırın okunan baytlara uygulandığını denetlemek için) */
function akisIstegi(url: string, bayt: number): Request {
  const parca = new TextEncoder().encode("x".repeat(16 * 1024));
  let kalan = bayt;
  const govde = new ReadableStream<Uint8Array>({
    pull(denetleyici) {
      if (kalan <= 0) return denetleyici.close();
      const p = parca.subarray(0, Math.min(parca.length, kalan));
      kalan -= p.length;
      denetleyici.enqueue(p);
    },
  });
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: govde,
    duplex: "half",
  } as RequestInit);
}

async function hataMesaji(yanit: Response): Promise<string> {
  const veri = (await yanit.json()) as { hata?: unknown };
  expect(typeof veri.hata).toBe("string");
  return veri.hata as string;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function pdfBasliklariniDenetle(yanit: Response, asciiAd: string) {
  expect(yanit.status).toBe(200);
  expect(yanit.headers.get("Content-Type")).toBe("application/pdf");
  const cd = yanit.headers.get("Content-Disposition") ?? "";
  expect(cd).toMatch(/^attachment; /);
  expect(cd).toContain(`filename="${asciiAd}.pdf"`);
  expect(cd).toContain("filename*=UTF-8''");
  expect(yanit.headers.get("Cache-Control")).toContain("no-store");
}

/** Son çağrılan hesapRaporuPdf'in argümanları */
function sonHesapRaporu(): { baslik: RaporBasligi; rapor: HesapRaporu } {
  const cagri = m.hesapRaporuPdf.mock.calls.at(-1) as unknown as [RaporBasligi, HesapRaporu];
  return { baslik: cagri[0], rapor: cagri[1] };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getSession.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/rapor/hesap", () => {
  it("anonim: girdiler süzülür, PDF yanıtı ve dosya adı başlıklarıyla döner", async () => {
    const yanit = await hesapPost(jsonIstek("/api/rapor/hesap", { hesapSlug: "ohm-yasasi", girdiler: { R: { value: "7", unit: "ohm" } } }));
    pdfBasliklariniDenetle(yanit, "Ohm-yasasi-ve-guc");
    expect(new TextDecoder().decode(await yanit.arrayBuffer())).toMatch(/^%PDF-/);
    expect(m.girdileriSuz).toHaveBeenCalledWith(expect.objectContaining({ slug: "ohm-yasasi" }), { R: { value: "7", unit: "ohm" } });
    expect(m.ciktiBirimleriniSuz).toHaveBeenCalledWith(expect.objectContaining({ slug: "ohm-yasasi" }), {});
    const { baslik, rapor } = sonHesapRaporu();
    expect(baslik.kullanici).toBeUndefined();
    expect(baslik.baslik).toBe("Ohm yasası ve güç");
    expect(Number.isNaN(Date.parse(baslik.tarih))).toBe(false);
    // Varsayılanlarla tamamlanır: V = 12 V, R = 7 Ω → I = 1,714 A (4 anlamlı basamak)
    expect(rapor.basarili).toBe(true);
    expect(rapor.ciktilar.find((c) => c.key === "I")?.formatted).toBe("1,714 A");
  });

  it("giriş yapılmışsa kullanıcı başlığa eklenir ve profil tercihi (anlamlı basamak) uygulanır", async () => {
    oturumAc();
    const yanit = await hesapPost(
      jsonIstek("/api/rapor/hesap", {
        hesapSlug: "ohm-yasasi",
        girdiler: { R: { value: "7", unit: "ohm" } },
        ciktiBirimleri: { I: "mA" },
        ad: "Pano 3 — ölçüm",
      }),
    );
    pdfBasliklariniDenetle(yanit, "Pano-3-olcum");
    const { baslik, rapor } = sonHesapRaporu();
    expect(baslik.kullanici).toEqual({ ad: "Ayşe Yılmaz", sirket: "Örnek A.Ş.", unvan: "Mühendis" });
    expect(baslik.baslik).toBe("Pano 3 — ölçüm");
    expect(rapor.kayitAdi).toBe("Pano 3 — ölçüm");
    expect(rapor.ciktilar.find((c) => c.key === "I")?.formatted).toBe("1714,29 mA");
  });

  it("oturum okunamazsa anonim devam eder", async () => {
    m.getSession.mockRejectedValue(new Error("veritabanı yok"));
    const yanit = await hesapPost(jsonIstek("/api/rapor/hesap", { hesapSlug: "ohm-yasasi", girdiler: {} }));
    expect(yanit.status).toBe(200);
    expect(sonHesapRaporu().baslik.kullanici).toBeUndefined();
  });

  it.each([
    ["bozuk JSON", "{bozuk", 400, /JSON/],
    ["boş gövde", "", 400, /boş/],
    ["hesapSlug yok", { girdiler: {} }, 400, /hesapSlug/],
    ["girdiler nesne değil", { hesapSlug: "ohm-yasasi", girdiler: "x" }, 400, /girdiler/],
    ["bilinmeyen hesap", { hesapSlug: "yok-boyle", girdiler: {} }, 400, /Bilinmeyen hesap/],
    ["çok uzun ad", { hesapSlug: "ohm-yasasi", girdiler: {}, ad: "a".repeat(121) }, 400, /en çok 120/],
  ])("geçersiz gövde (%s) → %i + Türkçe mesaj", async (_ad, govde, durum, mesaj) => {
    const yanit = await hesapPost(jsonIstek("/api/rapor/hesap", govde));
    expect(yanit.status).toBe(durum);
    expect(await hataMesaji(yanit)).toMatch(mesaj);
    expect(m.hesapRaporuPdf).not.toHaveBeenCalled();
  });

  it("JSON olmayan içerik türü → 415", async () => {
    const yanit = await hesapPost(
      new Request("http://localhost/api/rapor/hesap", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" }),
    );
    expect(yanit.status).toBe(415);
    expect(await hataMesaji(yanit)).toMatch(/JSON/);
  });

  it("100 kB üstü gövde → 413 (Content-Length ile de, onsuz akışta da)", async () => {
    const buyuk = { hesapSlug: "ohm-yasasi", girdiler: { V: { value: "1".repeat(110 * 1024) } } };
    const beyanli = await hesapPost(jsonIstek("/api/rapor/hesap", buyuk, { "Content-Length": String(120 * 1024) }));
    expect(beyanli.status).toBe(413);
    const akis = await hesapPost(akisIstegi("/api/rapor/hesap", 150 * 1024));
    expect(akis.status).toBe(413);
    expect(await hataMesaji(akis)).toMatch(/100 kB/);
  });

  it("PDF üretimi beklenmedik biçimde düşerse 500 + Türkçe mesaj", async () => {
    m.hesapRaporuPdf.mockRejectedValueOnce(new Error("pdfmake"));
    const yanit = await hesapPost(jsonIstek("/api/rapor/hesap", { hesapSlug: "ohm-yasasi", girdiler: {} }));
    expect(yanit.status).toBe(500);
    expect(await hataMesaji(yanit)).toMatch(/beklenmeyen/);
  });
});

function kayit(ek: Partial<KayitliHesap> = {}): KayitliHesap {
  return {
    id: "kayit-1",
    projeId: null,
    hesapSlug: "ohm-yasasi",
    hesapId: "1.1",
    ad: "Aydınlatma hattı",
    notlar: "Not",
    girdiler: { R: { value: "7", unit: "ohm" } },
    ciktiBirimleri: { I: "mA" },
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...ek,
  };
}

describe("GET /api/rapor/hesap/[id]", () => {
  it("giriş yoksa 401", async () => {
    const yanit = await hesapGet(new Request("http://localhost/api/rapor/hesap/kayit-1"), params("kayit-1"));
    expect(yanit.status).toBe(401);
    expect(await hataMesaji(yanit)).toMatch(/giriş/);
    expect(m.hesapGetir).not.toHaveBeenCalled();
  });

  it("oturum okunamazsa 503", async () => {
    m.getSession.mockRejectedValue(new Error("veritabanı yok"));
    const yanit = await hesapGet(new Request("http://localhost/api/rapor/hesap/kayit-1"), params("kayit-1"));
    expect(yanit.status).toBe(503);
  });

  it("başkasının (ya da olmayan) kaydı → 404; sorgu oturumdaki kullanıcıyla yapılır", async () => {
    oturumAc();
    m.hesapGetir.mockResolvedValue(null);
    const yanit = await hesapGet(new Request("http://localhost/api/rapor/hesap/baskasinin"), params("baskasinin"));
    expect(yanit.status).toBe(404);
    expect(await hataMesaji(yanit)).toBe("Kayıt bulunamadı.");
    expect(m.hesapGetir).toHaveBeenCalledWith("kullanici-1", "baskasinin");
  });

  it("tanımı artık olmayan hesap türü → 404", async () => {
    oturumAc();
    m.hesapGetir.mockResolvedValue(kayit({ hesapSlug: "kaldirilmis" }));
    const yanit = await hesapGet(new Request("http://localhost/api/rapor/hesap/kayit-1"), params("kayit-1"));
    expect(yanit.status).toBe(404);
  });

  it("kayıtlı hesap: varsayılanlarla tamamlanmış durum, kayıtlı çıktı birimleri, ad ve notlar", async () => {
    oturumAc({ decimals: 4 });
    m.hesapGetir.mockResolvedValue(kayit());
    const yanit = await hesapGet(new Request("http://localhost/api/rapor/hesap/kayit-1"), params("kayit-1"));
    pdfBasliklariniDenetle(yanit, "Aydinlatma-hatti");
    const { baslik, rapor } = sonHesapRaporu();
    expect(baslik).toMatchObject({ baslik: "Aydınlatma hattı", altBaslik: "1.1 · Ohm yasası ve güç" });
    expect(baslik.kullanici?.ad).toBe("Ayşe Yılmaz");
    expect(rapor).toMatchObject({ kayitAdi: "Aydınlatma hattı", notlar: "Not", basarili: true });
    expect(rapor.girdiler.find((g) => g.key === "V")?.deger).toBe("12 V");
    expect(rapor.ciktilar.find((c) => c.key === "I")?.formatted).toBe("1714 mA");
  });
});

function proje(ek: Partial<Proje> = {}): Proje {
  return { id: "proje-1", ad: "Fabrika A", aciklama: null, createdAt: "", updatedAt: "", hesapSayisi: 2, ...ek };
}

describe("GET /api/rapor/proje/[id]", () => {
  it("giriş yoksa 401", async () => {
    const yanit = await projeGet(new Request("http://localhost/api/rapor/proje/proje-1"), params("proje-1"));
    expect(yanit.status).toBe(401);
  });

  it("başkasının projesi → 404; hesaplar listelenmez", async () => {
    oturumAc();
    m.projeGetir.mockResolvedValue(null);
    const yanit = await projeGet(new Request("http://localhost/api/rapor/proje/baskasinin"), params("baskasinin"));
    expect(yanit.status).toBe(404);
    expect(await hataMesaji(yanit)).toBe("Proje bulunamadı.");
    expect(m.projeGetir).toHaveBeenCalledWith("kullanici-1", "baskasinin");
    expect(m.hesaplariListele).not.toHaveBeenCalled();
  });

  it("projedeki hesaplar KAPSAM sırasıyla raporlanır; tanımı olmayan kayıt atlanır", async () => {
    oturumAc();
    m.projeGetir.mockResolvedValue(proje({ aciklama: "Açıklama" }));
    m.hesaplariListele.mockResolvedValue([
      kayit({ id: "k3", hesapSlug: "analog-olcekleme", hesapId: "5.1", ad: "Seviye", girdiler: {} }),
      kayit({ id: "k2", ad: "Zeta hattı" }),
      kayit({ id: "k1", ad: "Alfa hattı" }),
      kayit({ id: "k4", hesapSlug: "kaldirilmis", hesapId: "9.9", ad: "Eski" }),
    ]);
    const yanit = await projeGet(new Request("http://localhost/api/rapor/proje/proje-1"), params("proje-1"));
    pdfBasliklariniDenetle(yanit, "Fabrika-A-Proje-raporu");
    expect(m.hesaplariListele).toHaveBeenCalledWith("kullanici-1", { projeId: "proje-1" });
    const [baslik, p, raporlar, secenekler] = m.projeRaporuPdf.mock.calls[0] as unknown as [
      RaporBasligi,
      { ad: string; aciklama: string | null },
      HesapRaporu[],
      { atlananlar: string[] },
    ];
    expect(baslik.baslik).toBe("Fabrika A");
    expect(p).toEqual({ ad: "Fabrika A", aciklama: "Açıklama" });
    expect(raporlar.map((r) => r.kayitAdi)).toEqual(["Alfa hattı", "Zeta hattı", "Seviye"]);
    expect(secenekler.atlananlar).toEqual(["Eski"]);
  });

  it("boş proje de PDF döner", async () => {
    oturumAc();
    m.projeGetir.mockResolvedValue(proje());
    m.hesaplariListele.mockResolvedValue([]);
    const yanit = await projeGet(new Request("http://localhost/api/rapor/proje/proje-1"), params("proje-1"));
    expect(yanit.status).toBe(200);
  });
});

const KARSILASTIRMA: Karsilastirma = { hesapSlug: "ohm-yasasi", hesapId: "1.1", baslik: "Ohm yasası ve güç", senaryolar: [], satirlar: [] };
const SERI: TaramaSerisi = {
  girdiKey: "R",
  ciktiKey: "I",
  xEtiket: "Direnç",
  yEtiket: "Akım",
  xBirim: "ohm",
  yBirim: "A",
  xBirimSembolu: "Ω",
  yBirimSembolu: "A",
  noktalar: [],
};
const TARAMA = { girdiKey: "R", ciktiKey: "I", baslangic: 1, bitis: 10, birim: "ohm", noktaSayisi: 20 };

function senaryolar(n: number): { ad: string; state: InputState }[] {
  return Array.from({ length: n }, (_, i) => ({ ad: i === 1 ? "  " : `Senaryo ${i + 1}`, state: { R: { value: String(i + 1), unit: "ohm" } } }));
}

describe("POST /api/rapor/karsilastirma", () => {
  beforeEach(() => {
    m.karsilastirmaOlustur.mockReturnValue(KARSILASTIRMA);
    m.taramaYap.mockReturnValue(SERI);
  });

  it("senaryolar süzülür, kimlikler sunucuda verilir, tarama ilk senaryodan; tablo + grafik PDF'e gider", async () => {
    oturumAc({ unitSystem: "imperial" });
    const yanit = await karsilastirmaPost(
      jsonIstek("/api/rapor/karsilastirma", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(3), outputUnits: { I: "mA" }, tarama: TARAMA }),
    );
    pdfBasliklariniDenetle(yanit, "Ohm-yasasi-ve-guc-Karsilastirma-raporu");
    const [def, gelen, secenek] = m.karsilastirmaOlustur.mock.calls[0] as [CalcDefinition, Senaryo[], Record<string, unknown>];
    expect(def.slug).toBe("ohm-yasasi");
    expect(gelen.map((s) => [s.id, s.ad])).toEqual([
      ["s1", "Senaryo 1"],
      ["s2", "Senaryo 2"],
      ["s3", "Senaryo 3"],
    ]);
    expect(gelen[0].state.R).toEqual({ value: "1", unit: "ohm" });
    expect(gelen[0].state.V).toEqual({ value: "12", unit: "V" }); // varsayılanla tamamlanır
    expect(m.girdileriSuz).toHaveBeenCalledTimes(3);
    expect(secenek).toMatchObject({ significant: 6, outputUnits: { I: "mA" }, preferredUnits: expect.objectContaining({ tork: "lbfft" }) });
    expect(m.taramaYap).toHaveBeenCalledWith(def, gelen[0], TARAMA, secenek);
    expect(m.cizgiGrafikSvg).toHaveBeenCalledWith(SERI);
    const [baslik, k, tarama] = m.karsilastirmaRaporuPdf.mock.calls[0] as unknown as [RaporBasligi, Karsilastirma, unknown];
    expect(baslik.kullanici?.ad).toBe("Ayşe Yılmaz");
    expect(k).toBe(KARSILASTIRMA);
    expect(tarama).toEqual({ seri: SERI, svg: "<svg/>" });
  });

  it("tarama/grafik üretilemezse rapor grafiksiz döner", async () => {
    m.taramaYap.mockImplementation(() => {
      throw new Error("B");
    });
    const yanit = await karsilastirmaPost(jsonIstek("/api/rapor/karsilastirma", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(2), tarama: TARAMA }));
    expect(yanit.status).toBe(200);
    expect((m.karsilastirmaRaporuPdf.mock.calls[0] as unknown[])[2]).toBeUndefined();
  });

  it.each([
    ["9 senaryo", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(9) }, /en çok 8 senaryo/i],
    ["senaryo yok", { hesapSlug: "ohm-yasasi", senaryolar: [] }, /en az bir senaryo/i],
    ["201 nokta", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(2), tarama: { ...TARAMA, noktaSayisi: 201 } }, /en çok 200 nokta/],
    ["kesirli nokta sayısı", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(2), tarama: { ...TARAMA, noktaSayisi: 2.5 } }, /tam sayı/],
    ["select girdisi taranamaz", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(2), tarama: { ...TARAMA, girdiKey: "mod" } }, /sayısal/],
    ["olmayan çıktı", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(2), tarama: { ...TARAMA, ciktiKey: "yok" } }, /çıktısı/],
    ["yanlış birim", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(2), tarama: { ...TARAMA, birim: "V" } }, /birimi/],
    ["aynı başlangıç/bitiş", { hesapSlug: "ohm-yasasi", senaryolar: senaryolar(2), tarama: { ...TARAMA, bitis: 1 } }, /farklı/],
    ["bilinmeyen hesap", { hesapSlug: "yok", senaryolar: senaryolar(2) }, /Bilinmeyen hesap/],
  ])("geçersiz gövde (%s) → 400", async (_ad, govde, mesaj) => {
    const yanit = await karsilastirmaPost(jsonIstek("/api/rapor/karsilastirma", govde));
    expect(yanit.status).toBe(400);
    expect(await hataMesaji(yanit)).toMatch(mesaj);
    expect(m.karsilastirmaOlustur).not.toHaveBeenCalled();
  });
});
