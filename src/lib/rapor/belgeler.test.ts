/**
 * PDF belgeleri: gerçek pdfmake + MathJax ile üretilir, metin poppler'ın `pdftotext`/`pdfinfo` araçlarıyla
 * çıkarılıp denetlenir (araçlar yoksa testler açık hatayla düşer). Ayrıca tüm hesap metinlerindeki
 * karakterlerin seçilen yazı tipinde (Noto Sans ya da yedek Noto Sans Math) bulunduğu denetlenir.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultState } from "@/lib/calc/engine";
import { allCalcs, getCalc } from "@/lib/calc/registry";
import type { CalcDefinition, InputState } from "@/lib/calc/types";
import type { Karsilastirma, TaramaSerisi } from "@/lib/karsilastirma/types";
import { esitliktenBol, hesapRaporuPdf, karsilastirmaRaporuPdf, projeRaporuPdf } from "./belgeler";
import { KISA_SORUMLULUK_REDDI, PLATFORM_ADI, TAM_SORUMLULUK_REDDI, TELIF_NOTU } from "./metinler";
import { hesapRaporuOlustur } from "./model";
import { YEDEK_UNICODE_ARALIKLARI, yedekFontMu } from "./pdf";
import type { HesapRaporu, RaporBasligi } from "./types";

let dizin = "";

function aracVarMi(arac: string): boolean {
  try {
    execFileSync(arac, ["-v"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

beforeAll(() => {
  for (const arac of ["pdftotext", "pdfinfo"]) {
    if (!aracVarMi(arac)) {
      throw new Error(`${arac} bulunamadı: PDF metin testleri için poppler-utils kurulu olmalı (apt install poppler-utils).`);
    }
  }
  dizin = fs.mkdtempSync(path.join(os.tmpdir(), "rapor-test-"));
});

afterAll(() => {
  if (dizin) fs.rmSync(dizin, { recursive: true, force: true });
});

let sayac = 0;
function dosyayaYaz(pdf: Buffer): string {
  const dosya = path.join(dizin, `belge-${++sayac}.pdf`);
  fs.writeFileSync(dosya, pdf);
  return dosya;
}

/** PDF metni, boşlukları sadeleştirilmiş (satır kaydırması eşleşmeyi bozmasın) */
function pdfMetni(pdf: Buffer, sayfa?: number): string {
  const args = sayfa ? ["-f", String(sayfa), "-l", String(sayfa)] : [];
  const ham = execFileSync("pdftotext", [...args, "-enc", "UTF-8", dosyayaYaz(pdf), "-"], { encoding: "utf8" });
  return sade(ham);
}

function sade(s: string): string {
  return s.replace(/[​­]/g, "").replace(/\s+/g, " ").trim();
}

function pdfBilgisi(pdf: Buffer): { sayfa: number; boyut: string } {
  const cikti = execFileSync("pdfinfo", [dosyayaYaz(pdf)], { encoding: "utf8" });
  return {
    sayfa: Number(/^Pages:\s+(\d+)/m.exec(cikti)?.[1]),
    boyut: /^Page size:\s+(.+?)\s+pts/m.exec(cikti)?.[1] ?? "",
  };
}

function pdfMi(pdf: Buffer): void {
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdf.subarray(-8).toString("latin1")).toContain("%%EOF");
}

const TARIH = "2026-11-15T21:30:00Z"; // İstanbul: 16 Kasım 2026 00:30
const KULLANICI = { ad: "Ayşe Yılmaz Çağlar", unvan: "Elektrik Mühendisi", sirket: "Örnek Mühendislik A.Ş." };

function hesap(slug: string): CalcDefinition {
  const def = getCalc(slug);
  if (!def) throw new Error(`hesap yok: ${slug}`);
  return def;
}

function rapor(slug: string, degisiklik: InputState = {}, secenek?: Parameters<typeof hesapRaporuOlustur>[2]): HesapRaporu {
  const def = hesap(slug);
  return hesapRaporuOlustur(def, { ...defaultState(def), ...degisiklik }, secenek);
}

describe("hesapRaporuPdf", () => {
  it("PDF baytları; Türkçe metin, başlık bilgileri, sayfa numarası ve sorumluluk reddi", async () => {
    const baslik: RaporBasligi = { baslik: "Pano 3 — ölçüm", altBaslik: "1.1 · Ohm yasası", kullanici: KULLANICI, tarih: TARIH };
    const pdf = await hesapRaporuPdf(baslik, rapor("ohm-yasasi", {}, { kayitAdi: "Pano 3 — ölçüm", notlar: "Şalter çıkışı ölçülecek." }));
    pdfMi(pdf);
    const metin = pdfMetni(pdf);
    for (const parca of [
      PLATFORM_ADI,
      "HESAP RAPORU",
      "Pano 3 — ölçüm",
      "Ayşe Yılmaz Çağlar",
      "Elektrik Mühendisi",
      "Örnek Mühendislik A.Ş.",
      "16 Kasım 2026 00:30",
      "Şalter çıkışı ölçülecek.",
      "Girdiler",
      "Formüller",
      "Ara adımlar",
      "Sonuçlar",
      "Uygunluk durumu",
      "Standart referansları",
      "IEC 60050",
      "Sayfa 1 / ",
      sade(KISA_SORUMLULUK_REDDI),
      sade(TAM_SORUMLULUK_REDDI),
      sade(TELIF_NOTU),
    ]) {
      expect(metin, parca).toContain(parca);
    }
    // Biçimlenmiş girdi ve çıktı değerleri
    expect(metin).toContain("12 V");
    expect(metin).toContain("24 W");
    const { sayfa } = pdfBilgisi(pdf);
    expect(metin).toContain(`Sayfa ${sayfa} / ${sayfa}`);
  });

  it("anonim raporda kullanıcı satırı yok; tarih yine var", async () => {
    const pdf = await hesapRaporuPdf({ baslik: "Ohm yasası ve güç", tarih: TARIH }, rapor("ohm-yasasi"));
    const metin = pdfMetni(pdf, 1);
    expect(metin).not.toContain("Hazırlayan");
    expect(metin).toContain("16 Kasım 2026 00:30");
  });

  it("ok/matematik karakterleri (→ ≤ ≥) yedek yazı tipiyle yazılır ve metin olarak çıkarılabilir", async () => {
    const pdf = await hesapRaporuPdf({ baslik: "Analog ölçekleme", tarih: TARIH }, rapor("analog-olcekleme"));
    const metin = pdfMetni(pdf);
    expect(metin).toContain("→");
    expect(metin).toMatch(/[≤≥]/);
    const fontlar = execFileSync("pdffonts", [dosyayaYaz(pdf)], { encoding: "utf8" });
    expect(fontlar).toContain("NotoSans-Regular");
    expect(fontlar).toContain("NotoSansMath-Regular");
  });

  it("geçersiz girdide 'Sonuç hesaplanamadı' ve alan hatası; sonuç bölümleri yok", async () => {
    const r = rapor("ohm-yasasi", { R: { value: "abc", unit: "ohm" } });
    expect(r.basarili).toBe(false);
    const metin = pdfMetni(await hesapRaporuPdf({ baslik: "Hatalı", tarih: TARIH }, r));
    expect(metin).toContain("Sonuç hesaplanamadı");
    expect(metin).toContain(sade(r.hataMesajlari[0]));
    expect(metin).not.toContain("Ara adımlar");
  });

  it("MathJax'in işleyemediği LaTeX çökmeden kaynak metin olarak yazılır", async () => {
    const r = rapor("ohm-yasasi");
    const bozuk: HesapRaporu = {
      ...r,
      formuller: [{ label: "Bozuk formül", latex: "\\bilinmeyenKomut{x} + 1" }],
      adimlar: [{ label: "Bozuk adım", latex: "\\frac{1}{" }],
    };
    const metin = pdfMetni(await hesapRaporuPdf({ baslik: "Bozuk LaTeX", tarih: TARIH }, bozuk));
    expect(metin).toContain("\\bilinmeyenKomut{x} + 1");
    expect(metin).toContain("\\frac{1}{");
  });

  it("çok uzun kayıt adı ve şirket adı başlıkta kısaltılır; emoji çökertmez", async () => {
    const uzunAd = `Kablo ${"çok uzun kayıt adı ".repeat(6)}`.slice(0, 120);
    const sirket = `Örnek ${"Mühendislik Sanayi ve Ticaret ".repeat(5)}`.slice(0, 150);
    const pdf = await hesapRaporuPdf(
      { baslik: uzunAd, kullanici: { ...KULLANICI, sirket }, tarih: TARIH },
      rapor("ohm-yasasi", {}, { kayitAdi: uzunAd, notlar: "Not 😀 ✓" }),
    );
    pdfMi(pdf);
    const ilk = pdfMetni(pdf, 1);
    expect(ilk).toContain("…");
    expect(ilk).toContain(sade(sirket)); // künyede tam şirket adı
  });
});

describe.each(allCalcs().map((d) => [`${d.id} ${d.slug}`, d] as const))("hesapRaporuPdf — %s varsayılan", (_ad, def) => {
  it("PDF üretilir", async () => {
    const r = hesapRaporuOlustur(def, defaultState(def));
    expect(r.basarili).toBe(true);
    const pdf = await hesapRaporuPdf({ baslik: def.title, kullanici: KULLANICI, tarih: TARIH }, r);
    pdfMi(pdf);
  });
});

describe("geniş formüller", () => {
  it("esitliktenBol en üst düzeydeki = ve \\approx işaretlerinden böler; parantez ve ortam içini bölmez", () => {
    expect(esitliktenBol("A = B = C")).toEqual(["A", "= B", "= C"]);
    expect(esitliktenBol("x \\approx 2{,}5 = y")).toEqual(["x", "\\approx 2{,}5", "= y"]);
    expect(esitliktenBol("\\sum_{i=1}^{n} R_i = R")).toEqual(["\\sum_{i=1}^{n} R_i", "= R"]);
    expect(esitliktenBol("\\left( a = b \\right) = c")).toEqual(["\\left( a = b \\right)", "= c"]);
    expect(esitliktenBol("\\begin{cases} a = 1 \\end{cases}")).toEqual(["\\begin{cases} a = 1 \\end{cases}"]);
    expect(esitliktenBol("a \\leq b")).toEqual(["a \\leq b"]);
  });

  it("sayfadan geniş adım satırlara bölünerek SVG olarak çizilir (LaTeX kaynağına düşmez)", async () => {
    const r = rapor("ohm-yasasi");
    const terimler = Array.from({ length: 14 }, (_, i) => `R_{${i + 1}} = ${i + 1}{,}234\\,\\mathrm{k}\\Omega`).join(" + ");
    const genis: HesapRaporu = { ...r, adimlar: [{ label: "Çok geniş adım", latex: `R = ${terimler}` }] };
    const pdf = await hesapRaporuPdf({ baslik: "Geniş", tarih: TARIH }, genis);
    pdfMi(pdf);
    expect(pdfMetni(pdf)).not.toContain("\\");
  });
});

describe("projeRaporuPdf", () => {
  it("kapak/özet sayfası, içindekiler; her hesap yeni sayfada", async () => {
    const raporlar = [
      rapor("ohm-yasasi", {}, { kayitAdi: "Aydınlatma hattı" }),
      rapor("analog-olcekleme", {}, { kayitAdi: "Seviye sensörü" }),
      rapor("ohm-yasasi", { R: { value: "", unit: "ohm" } }, { kayitAdi: "Eksik girdili kayıt" }),
    ];
    const pdf = await projeRaporuPdf(
      { baslik: "Fabrika A", altBaslik: "Proje raporu", kullanici: KULLANICI, tarih: TARIH },
      { ad: "Fabrika A", aciklama: "Pano revizyonu; I_b ≤ I_n koşulu." },
      raporlar,
      { atlananlar: ["Eski hesap"] },
    );
    pdfMi(pdf);
    const kapak = pdfMetni(pdf, 1);
    for (const parca of ["PROJE RAPORU", "Fabrika A", "Proje açıklaması", "I_b ≤ I_n", "Hesap özeti", "İçindekiler", "Eski hesap", "Hesaplanamadı"]) {
      expect(kapak, parca).toContain(parca);
    }
    for (const r of raporlar) expect(kapak).toContain(r.kayitAdi);
    const { sayfa } = pdfBilgisi(pdf);
    expect(sayfa).toBeGreaterThanOrEqual(4);
    expect(pdfMetni(pdf, 2)).toContain("Aydınlatma hattı");
    // İçindekiler tablosundaki sayfa numarası hesabın gerçek sayfasıyla aynı
    const icindekiler = kapak.slice(kapak.indexOf("İçindekiler"));
    const sayfaNo = Number(/Seviye sensörü (\d+)/.exec(icindekiler)?.[1]);
    expect(sayfaNo).toBeGreaterThan(2);
    expect(pdfMetni(pdf, sayfaNo)).toContain("Seviye sensörü");
    expect(pdfMetni(pdf, sayfa)).toContain(sade(TAM_SORUMLULUK_REDDI));
  });

  it("boş proje de raporlanır", async () => {
    const pdf = await projeRaporuPdf({ baslik: "Boş proje", tarih: TARIH }, { ad: "Boş proje", aciklama: null }, []);
    pdfMi(pdf);
    const metin = pdfMetni(pdf);
    expect(metin).toContain("Bu projede kayıtlı hesap yok.");
    expect(metin).not.toContain("İçindekiler");
    expect(metin).toContain("Sayfa 1 / 1");
  });
});

function ornekKarsilastirma(n: number): Karsilastirma {
  const dizi = <T,>(f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
  return {
    hesapSlug: "ohm-yasasi",
    hesapId: "1.1",
    baslik: "Ohm yasası ve güç",
    senaryolar: dizi((i) => ({
      id: `s${i + 1}`,
      ad: `Senaryo ${i + 1} çğış`,
      durum:
        i === 1
          ? { ok: true, enKotu: "uyari" as const, kontroller: [{ level: "uyari" as const, message: "Güç ≥ 0,25 W: direncin gücü yetersiz" }] }
          : i === 2
            ? { ok: false, enKotu: "hata" as const, kontroller: [{ level: "hata" as const, message: "Hesaplama sırasında beklenmeyen bir hata oluştu" }] }
            : { ok: true, enKotu: "ok" as const, kontroller: [{ level: "ok" as const, message: "Uygun" }] },
    })),
    satirlar: [
      { tur: "girdi", key: "V", label: "Gerilim", symbol: "V", birim: "V", birimSembolu: "V", degerler: dizi(() => "12"), sayisal: dizi(() => 12), farkli: false },
      { tur: "girdi", key: "R", label: "Direnç", symbol: "R", birim: "ohm", birimSembolu: "Ω", degerler: dizi((i) => String(6 + i)), sayisal: dizi((i) => 6 + i), farkli: true },
      {
        tur: "cikti",
        key: "I",
        label: "Akım",
        symbol: "I",
        birim: "A",
        birimSembolu: "A",
        degerler: dizi((i) => (i === 2 ? null : (12 / (6 + i)).toFixed(3).replace(".", ","))),
        sayisal: dizi((i) => (i === 2 ? null : 12 / (6 + i))),
        farkli: true,
      },
    ],
  };
}

const SERI: TaramaSerisi = {
  girdiKey: "R",
  ciktiKey: "I",
  xEtiket: "Direnç",
  yEtiket: "Akım",
  xBirim: "ohm",
  yBirim: "A",
  xBirimSembolu: "Ω",
  yBirimSembolu: "A",
  noktalar: [
    { x: 1, y: 12, seviye: "ok" },
    { x: 2, y: 6, seviye: "uyari" },
    { x: 3, y: null, seviye: "hata" },
  ],
};

/** İşçi B'nin grafik sözleşmesine uygun örnek: açık renkler, viewBox + width/height, Noto Sans metinler */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
<rect x="0" y="0" width="640" height="320" fill="#ffffff" stroke="#dde1e7"/>
<polyline fill="none" stroke="#1d5bbf" stroke-width="2" points="60,40 200,120 340,180 480,220"/>
<circle cx="200" cy="120" r="4" fill="#8a5700"/>
<text x="320" y="306" font-family="NotoSans, Noto Sans, sans-serif" font-size="12" text-anchor="middle">Direnç (Ω) — ğüşıöç İĞÜŞÖÇ</text>
<text x="16" y="160" font-family="NotoSans, Noto Sans, sans-serif" font-size="12" text-anchor="middle" transform="rotate(-90 16 160)">Akım (A)</text>
</svg>`;

describe("karsilastirmaRaporuPdf", () => {
  it("8 senaryo: yatay sayfa, tablo, durumlar ve grafik (SVG metni Türkçe)", async () => {
    const pdf = await karsilastirmaRaporuPdf({ baslik: "Ohm yasası ve güç", kullanici: KULLANICI, tarih: TARIH }, ornekKarsilastirma(8), {
      seri: SERI,
      svg: SVG,
    });
    pdfMi(pdf);
    expect(pdfBilgisi(pdf).boyut).toBe("841.89 x 595.28");
    const metin = pdfMetni(pdf);
    for (const parca of [
      "KARŞILAŞTIRMA RAPORU",
      "Senaryo tablosu",
      "Senaryo 8 çğış",
      "Gerilim",
      "Akım",
      "Uyarı",
      "Hesaplanamadı",
      "Grafik",
      "Akım (A) — Direnç (Ω)",
      "Direnç (Ω) — ğüşıöç İĞÜŞÖÇ",
      "Güç ≥ 0,25 W",
      "Sayfa 1 / ",
      sade(TAM_SORUMLULUK_REDDI),
    ]) {
      expect(metin, parca).toContain(parca);
    }
  });

  it("4 senaryoya kadar dikey sayfa; tarama yoksa grafik bölümü yok", async () => {
    const pdf = await karsilastirmaRaporuPdf({ baslik: "Ohm", tarih: TARIH }, ornekKarsilastirma(3));
    expect(pdfBilgisi(pdf).boyut).toBe("595.28 x 841.89");
    expect(pdfMetni(pdf)).not.toContain("Grafik");
  });

  it("işlenemeyen grafik SVG'sinde rapor grafiksiz üretilir", async () => {
    const pdf = await karsilastirmaRaporuPdf({ baslik: "Ohm", tarih: TARIH }, ornekKarsilastirma(2), { seri: SERI, svg: "<svg bozuk" });
    pdfMi(pdf);
    expect(pdfMetni(pdf)).toContain("Grafik çizilemedi.");
  });
});

describe("yazı tipi kapsamı", () => {
  type Font = { hasGlyphForCodePoint(cp: number): boolean };
  // fontkit pdfmake'in (pdfkit) bağımlılığıdır; yalnızca bu testte doğrudan kullanılır.
  const fontkit = createRequire(import.meta.url)("fontkit") as { create(b: Buffer): Font };
  const fontDizini = path.join(process.cwd(), "src/lib/rapor/fonts");
  const noto = fontkit.create(fs.readFileSync(path.join(fontDizini, "NotoSans-Regular.ttf")));
  const notoKalin = fontkit.create(fs.readFileSync(path.join(fontDizini, "NotoSans-Bold.ttf")));
  const math = fontkit.create(fs.readFileSync(path.join(fontDizini, "NotoSansMath-Regular.woff")));

  it("yedek aralıklarda yalnızca Noto Sans'ta olmayan karakterler yedek yazı tipine gider", () => {
    for (const [a, b] of YEDEK_UNICODE_ARALIKLARI) {
      for (let cp = a; cp <= b; cp++) {
        expect(yedekFontMu(String.fromCodePoint(cp)), cp.toString(16)).toBe(!noto.hasGlyphForCodePoint(cp));
      }
    }
  });

  /** Select girdilerinin tüm değer kombinasyonları (en fazla 512) */
  function kombinasyonlar(def: CalcDefinition): InputState[] {
    let sonuc: InputState[] = [{}];
    for (const input of def.inputs) {
      if (input.kind !== "select") continue;
      const sonraki: InputState[] = [];
      for (const c of sonuc) for (const o of input.options) sonraki.push({ ...c, [input.key]: { value: o.value } });
      sonuc = sonraki.slice(0, 512);
    }
    return sonuc;
  }

  it("tüm hesapların (tüm seçim kombinasyonları) rapor metinleri yazı tiplerinde var (kutu/tofu yok)", () => {
    const eksik = new Map<string, string>();
    const denetle = (yer: string, s: string | null | undefined) => {
      if (!s) return;
      for (const ch of s) {
        if (ch === "\n") continue;
        const cp = ch.codePointAt(0) ?? 0;
        const var_ = yedekFontMu(ch) ? math.hasGlyphForCodePoint(cp) : noto.hasGlyphForCodePoint(cp) && notoKalin.hasGlyphForCodePoint(cp);
        if (!var_ && !eksik.has(ch)) eksik.set(ch, `U+${cp.toString(16)} ${yer}`);
      }
    };
    for (const s of [PLATFORM_ADI, KISA_SORUMLULUK_REDDI, TAM_SORUMLULUK_REDDI, TELIF_NOTU]) denetle("metinler", s);
    for (const def of allCalcs()) {
      for (const kombinasyon of kombinasyonlar(def)) {
        const r = hesapRaporuOlustur(def, { ...defaultState(def), ...kombinasyon });
        const yer = `${def.slug} ${JSON.stringify(kombinasyon)}`;
        for (const s of [r.baslik, r.aciklama, ...r.hataMesajlari]) denetle(yer, s);
        for (const g of r.girdiler) [g.label, g.deger].forEach((s) => denetle(yer, s));
        for (const f of [...r.formuller, ...r.adimlar]) denetle(yer, f.label);
        for (const c of r.ciktilar) [c.label, c.formatted].forEach((s) => denetle(yer, s));
        for (const k of r.kontroller) [k.message, k.reference?.standard, k.reference?.clause].forEach((s) => denetle(yer, s));
        for (const ref of r.referanslar) [ref.standard, ref.title, ref.clause, ref.note].forEach((s) => denetle(yer, s));
      }
    }
    expect([...eksik.entries()]).toEqual([]);
  });
});
