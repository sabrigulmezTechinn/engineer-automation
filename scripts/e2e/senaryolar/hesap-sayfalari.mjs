/**
 * Tüm hesap sayfaları masaüstünde (1280 px) ve mobilde (iPhone 13): HTTP 200, konsol hatası yok, KaTeX hatası yok,
 * varsayılan girdilerle sonuç hesaplanır, mobilde yatay taşma yok. Hesap listesi /hesaplar sayfasındaki
 * bağlantılardan toplanır (yeni hesaplar kendiliğinden kapsanır).
 */
import { agDurulsun, dogrula, esitOlmali, gorunur } from "../yardimcilar.mjs";

/** Hesaplama bölümünde görünmemesi gereken metinler */
const YASAK_METINLER = [
  [/Hesap tanımı bulunamadı/i, "\"Hesap tanımı bulunamadı\""],
  [/beklenmeyen bir hata/i, "\"beklenmeyen bir hata\""],
  [/Sonuç hesaplanamadı/, "varsayılan girdilerle \"Sonuç hesaplanamadı\""],
];

async function hesapSayfasiniDenetle(t, baglam, slug, { mobil }) {
  const { page, konsol } = await t.yeniSayfa(baglam);
  const yanit = await page.goto(`/hesaplar/${slug}`);
  esitOlmali(yanit?.status(), 200, "HTTP durumu");

  const hesaplama = page.getByRole("region", { name: "Hesaplama", exact: true });
  const sonuc = hesaplama.getByRole("region", { name: "Sonuç", exact: true }).first();
  await sonuc.waitFor({ state: "visible" });
  await agDurulsun(page);

  konsol.dogrulaHataYok();
  const katexHatasi = await page.locator(".katex-error").count();
  esitOlmali(katexHatasi, 0, ".katex-error sayısı");
  // Formula bileşeni çözümlenemeyen LaTeX'i kaynak metin olarak bu başlıkla gösterir.
  const gosterilemeyen = await page.locator('code[title="Formül gösterilemedi"]').count();
  esitOlmali(gosterilemeyen, 0, "gösterilemeyen formül sayısı");

  const metin = await gorunur(hesaplama).innerText();
  for (const [desen, ad] of YASAK_METINLER) dogrula(!desen.test(metin), `Hesaplama bölümünde ${ad} var`);

  if (mobil) {
    const { genislik, gorunen } = await page.evaluate(() => ({
      genislik: document.documentElement.scrollWidth,
      gorunen: document.documentElement.clientWidth,
    }));
    dogrula(genislik <= gorunen, `Yatay taşma: scrollWidth ${genislik} > clientWidth ${gorunen}`);
  }
  // Başarısızlıkta sayfa açık kalır (ekran görüntüsü için); senaryo sonunda bağlamla kapanır.
  await page.close();
}

const senaryo = {
  ad: "hesap-sayfalari",
  aciklama: "Tüm hesap sayfaları masaüstü ve mobilde hatasız açılır",
  adimlarBagimsiz: true,

  async calistir(t) {
    const masaustu = await t.yeniBaglam();
    const mobil = await t.yeniBaglam({ mobil: true });

    const sluglar = await t.adim("hesap listesi /hesaplar sayfasından toplanır", async () => {
      const { page } = await t.yeniSayfa(masaustu);
      const yanit = await page.goto("/hesaplar");
      esitOlmali(yanit?.status(), 200, "HTTP durumu");
      const hrefler = await page
        .locator('main a[href^="/hesaplar/"]')
        .evaluateAll((baglantilar) => baglantilar.map((a) => a.getAttribute("href")));
      const liste = [...new Set(hrefler.map((h) => /^\/hesaplar\/([^/?#]+)$/.exec(h)?.[1]).filter(Boolean))];
      dogrula(liste.length > 0, "/hesaplar sayfasında hesap bağlantısı bulunamadı");
      await page.close();
      return liste;
    });
    if (!sluglar) return;
    t.bilgi(`${sluglar.length} hesap: ${sluglar.join(", ")}`);

    for (const [baglam, ad, secenek] of [
      [masaustu, "masaüstü", { mobil: false }],
      [mobil, "mobil", { mobil: true }],
    ]) {
      for (const slug of sluglar) {
        await t.adim(`${ad}: /hesaplar/${slug}`, () => hesapSayfasiniDenetle(t, baglam, slug, secenek));
      }
    }
  },
};

export default senaryo;
