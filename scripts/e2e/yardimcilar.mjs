/**
 * Uçtan uca (e2e) testlerin ortak yardımcıları: yapılandırma, tarayıcı bağlamları, konsol hatası toplama,
 * bekleme/doğrulama, geliştirme e-postalarını okuma, kayıt ve giriş, ekran görüntüsü, PDF indirme.
 *
 * Ortam değişkenleri:
 *   E2E_BASE_URL  Sunucunun kök adresi (varsayılan http://localhost:3100). Sunucunun BETTER_AUTH_URL'i ile aynı olmalı.
 *   E2E_MAIL_DIR  Sunucunun geliştirme e-postalarını yazdığı klasör (varsayılan <proje kökü>/.dev-mail).
 *   E2E_CIKTI     Ekran görüntüleri, indirilen dosyalar ve rapor (varsayılan: geçici dizinde benzersiz bir klasör).
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

/** Proje kökü: bu dosyanın iki üst klasörü (scripts/e2e → kök). Çalışma dizininden bağımsızdır. */
export const PROJE_KOKU = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const AYARLAR = Object.freeze({
  tabanUrl: (process.env.E2E_BASE_URL || "http://localhost:3100").replace(/\/+$/, ""),
  epostaKlasoru: path.resolve(process.env.E2E_MAIL_DIR || path.join(PROJE_KOKU, ".dev-mail")),
});

let ciktiKlasoruOnbellek;
/** Çıktı klasörü (ilk çağrıda oluşturulur). */
export function ciktiKlasoru() {
  if (!ciktiKlasoruOnbellek) {
    if (process.env.E2E_CIKTI) {
      ciktiKlasoruOnbellek = path.resolve(process.env.E2E_CIKTI);
      mkdirSync(ciktiKlasoruOnbellek, { recursive: true });
    } else {
      ciktiKlasoruOnbellek = mkdtempSync(path.join(os.tmpdir(), "e2e-cikti-"));
    }
  }
  return ciktiKlasoruOnbellek;
}

/* ------------------------------------------------------------------------------------------------
 * Hatalar ve doğrulama
 * ---------------------------------------------------------------------------------------------- */

/** Ortam/kurulum hatası: tüm çalıştırmayı durdurur (ör. sunucuya ulaşılamıyor, BETTER_AUTH_URL uyuşmuyor). */
export class KurulumHatasi extends Error {
  name = "KurulumHatasi";
}

/** Beklenti karşılanmadı. */
export class DogrulamaHatasi extends Error {
  name = "DogrulamaHatasi";
}

export function dogrula(kosul, mesaj) {
  if (!kosul) throw new DogrulamaHatasi(typeof mesaj === "function" ? mesaj() : mesaj);
}

export function esitOlmali(gercek, beklenen, ne) {
  if (gercek !== beklenen) {
    throw new DogrulamaHatasi(`${ne}: beklenen ${JSON.stringify(beklenen)}, gelen ${JSON.stringify(gercek)}`);
  }
}

export const uyu = (ms) => new Promise((coz) => setTimeout(coz, ms));

/**
 * `kosul` doğru (truthy) bir değer dönene kadar tekrar dener ve o değeri döner. Süre dolarsa son hatayla
 * birlikte DogrulamaHatasi fırlatır. `kosul` içinde fırlatılan hatalar yeniden denemeye sayılır.
 */
export async function bekleKadar(kosul, { zamanAsimi = 10_000, aralik = 100, mesaj = "Koşul sağlanmadı" } = {}) {
  const bitis = Date.now() + zamanAsimi;
  for (;;) {
    let sonHata;
    try {
      const sonuc = await kosul();
      if (sonuc) return sonuc;
    } catch (hata) {
      if (hata instanceof KurulumHatasi) throw hata;
      sonHata = hata;
    }
    if (Date.now() >= bitis) {
      const metin = typeof mesaj === "function" ? await mesaj() : mesaj;
      throw new DogrulamaHatasi(`${metin} (${zamanAsimi} ms)${sonHata ? `: ${sonHata.message.split("\n")[0]}` : ""}`);
    }
    await uyu(aralik);
  }
}

/** Boşluk türlerini (NBSP, U+202F, satır sonu) tek boşluğa indirger. */
export function sadelestir(metin) {
  return (metin ?? "").replace(/[\s  ]+/g, " ").trim();
}

/** Bir öğenin metni `beklenen`e (dize: tam eşitlik, RegExp: eşleşme) gelene kadar bekler. */
export async function metinOlmali(locator, beklenen, { ne = "metin", zamanAsimi = 10_000 } = {}) {
  let son;
  await bekleKadar(
    async () => {
      son = sadelestir(await locator.textContent({ timeout: 1_000 }));
      return beklenen instanceof RegExp ? beklenen.test(son) : son === beklenen;
    },
    { zamanAsimi, mesaj: () => `${ne}: beklenen ${String(beklenen)}, gelen ${JSON.stringify(son)}` },
  );
}

/** Yalnızca görünür eşleşmeler. Etkin olmayan (Activity ile gizlenmiş) sayfalar DOM'da kalabilir. */
export function gorunur(locator) {
  return locator.filter({ visible: true });
}

/**
 * Öğe React tarafından hidrate edilene kadar bekler. Hidrasyondan önce kontrollü girdilere yazılan değer
 * silinebilir, formlar da eylem yerine düz HTML gönderimi yapar.
 */
export async function hidrasyonBekle(locator, { zamanAsimi = 15_000 } = {}) {
  await locator.waitFor({ state: "visible", timeout: zamanAsimi });
  await bekleKadar(
    () => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"))),
    { zamanAsimi, aralik: 50, mesaj: "React hidrasyonu tamamlanmadı" },
  );
}

/** Ağ trafiği durulana kadar (en çok `ms`) bekler; Next.js ön yüklemeleri sürerse yine devam eder. */
export async function agDurulsun(page, ms = 8_000) {
  await page.waitForLoadState("networkidle", { timeout: ms }).catch(() => {});
}

/** Sayfa adresinin yol + sorgu kısmı (ör. "/giris?yonlendir=/profil"). */
export function yolVeSorgu(adres) {
  const url = new URL(adres, AYARLAR.tabanUrl);
  return `${url.pathname}${decodeURIComponent(url.search)}`;
}

/** Sayfa belirtilen yola (yol + sorgu; dize veya RegExp) gelene kadar bekler. */
export async function adresOlmali(page, beklenen, { zamanAsimi = 15_000 } = {}) {
  await bekleKadar(
    () => {
      const yol = yolVeSorgu(page.url());
      return beklenen instanceof RegExp ? beklenen.test(yol) : yol === beklenen;
    },
    { zamanAsimi, mesaj: () => `Adres: beklenen ${String(beklenen)}, gelen ${yolVeSorgu(page.url())}` },
  );
}

/* ------------------------------------------------------------------------------------------------
 * Tarayıcı
 * ---------------------------------------------------------------------------------------------- */

/** Playwright sistem genelinde kurulu (NODE_PATH). ESM `import` NODE_PATH'i izlemez; createRequire kullanılır. */
export function playwrightYukle() {
  try {
    return require("playwright");
  } catch (hata) {
    throw new KurulumHatasi(`Playwright yüklenemedi (${hata.message.split("\n")[0]}). Sistemde "playwright" paketi kurulu olmalı.`);
  }
}

export const MASAUSTU = Object.freeze({ viewport: { width: 1280, height: 800 } });

/** iPhone 13 cihaz tanımı (Chromium ile; varsayılan tarayıcı türü alanı bağlam seçeneği değildir). */
export function mobilCihaz(playwright) {
  const { defaultBrowserType, ...cihaz } = playwright.devices["iPhone 13"];
  void defaultBrowserType;
  return cihaz;
}

/** Yeni tarayıcı bağlamı: göreli adresler E2E_BASE_URL'e göre çözülür. */
export async function yeniBaglam(browser, playwright, { mobil = false, storageState } = {}) {
  const baglam = await browser.newContext({
    ...(mobil ? mobilCihaz(playwright) : MASAUSTU),
    baseURL: AYARLAR.tabanUrl,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    acceptDownloads: true,
    ...(storageState ? { storageState } : {}),
  });
  baglam.setDefaultTimeout(15_000);
  baglam.setDefaultNavigationTimeout(30_000);
  return baglam;
}

/**
 * Sayfanın `pageerror` olaylarını ve konsoldaki `error` iletilerini toplar.
 * `dogrulaHataYok({ yoksay: [/desen/] })` beklenen hataları (ör. 404 sayfasındaki kaynak hatası) dışarıda bırakır.
 */
export function konsolHatalariniTopla(page) {
  const hatalar = [];
  page.on("pageerror", (hata) => hatalar.push({ tur: "pageerror", metin: hata.message, adres: page.url() }));
  page.on("console", (ileti) => {
    if (ileti.type() !== "error") return;
    const konum = ileti.location();
    hatalar.push({ tur: "konsol", metin: ileti.text(), adres: konum?.url || page.url() });
  });
  return {
    hatalar,
    temizle() {
      hatalar.length = 0;
    },
    dogrulaHataYok({ yoksay = [] } = {}) {
      const kalan = hatalar.filter((h) => !yoksay.some((desen) => desen.test(h.metin)));
      if (kalan.length > 0) {
        const ozet = kalan
          .slice(0, 5)
          .map((h) => `[${h.tur}] ${h.metin.split("\n")[0].slice(0, 300)} (${yolVeSorgu(h.adres)})`)
          .join(" | ");
        throw new DogrulamaHatasi(`Konsolda ${kalan.length} hata: ${ozet}`);
      }
    },
  };
}

/** Türkçe karakterleri sadeleştirip dosya adına uygun hale getirir. */
export function dosyaAdi(metin) {
  const harita = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
  return metin
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (h) => harita[h])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Tam sayfa ekran görüntüsü alır; dosya yolunu döner (alınamazsa null). */
export async function ekranGoruntusu(page, ad) {
  if (!page || page.isClosed()) return null;
  const yol = path.join(ciktiKlasoru(), `${dosyaAdi(ad)}.png`);
  try {
    await page.screenshot({ path: yol, fullPage: true, timeout: 10_000 });
    return yol;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Geliştirme e-postaları (src/lib/email.ts: .dev-mail/*.json → { to, subject, links, createdAt })
 * ---------------------------------------------------------------------------------------------- */

/**
 * `alici` adresine `sonra` (ms, Date.now()) anından sonra yazılmış ve `links[0]`'ı `yolIcerir`
 * içeren en yeni e-postayı bekler. Döner: { konu, baglanti, dosya, veri }.
 */
export async function epostaBekle({ alici, sonra, yolIcerir, zamanAsimi = 20_000 }) {
  const klasor = AYARLAR.epostaKlasoru;
  const hedef = alici.toLowerCase();
  // Dosya adında alıcı, src/lib/email.ts'deki gibi sadeleştirilmiş olarak geçer.
  const adParcasi = `_${hedef.replace(/[^a-z0-9@._-]/g, "_")}_`;
  return bekleKadar(
    async () => {
      let adlar;
      try {
        adlar = await readdir(klasor);
      } catch (hata) {
        if (hata.code === "ENOENT") return null;
        throw hata;
      }
      let enYeni = null;
      for (const ad of adlar) {
        if (!ad.endsWith(".json") || !ad.includes(adParcasi)) continue;
        let veri;
        try {
          veri = JSON.parse(await readFile(path.join(klasor, ad), "utf8"));
        } catch {
          continue; // dosya henüz yazılıyor olabilir; sonraki turda yeniden okunur
        }
        if (String(veri.to).toLowerCase() !== hedef) continue;
        const zaman = Date.parse(veri.createdAt);
        // 500 ms pay: e-posta, eylem başlangıcıyla aynı milisaniyelerde yazılabilir.
        if (!(zaman >= sonra - 500)) continue;
        const baglanti = Array.isArray(veri.links) ? veri.links[0] : undefined;
        if (!baglanti || (yolIcerir && !baglanti.includes(yolIcerir))) continue;
        if (!enYeni || zaman > enYeni.zaman) enYeni = { zaman, konu: veri.subject, baglanti, dosya: path.join(klasor, ad), veri };
      }
      return enYeni;
    },
    {
      zamanAsimi,
      aralik: 250,
      mesaj:
        `${alici} için "${yolIcerir ?? ""}" bağlantılı e-posta ${klasor} klasöründe bulunamadı. ` +
        "Sunucu e-postaları bu klasöre mi yazıyor? (sunucunun çalışma dizinindeki .dev-mail ya da DEV_MAIL_DIR; E2E_MAIL_DIR ile ayarlayın)",
    },
  );
}

/**
 * E-postadaki bağlantının kökü E2E_BASE_URL ile aynı olmalı (sunucu bağlantıları BETTER_AUTH_URL ile kurar).
 * Uyuşmazlık tüm çalıştırmayı durdurur: oturum çerezleri başka kökte kalır, akışların hiçbiri anlamlı olmaz.
 */
export function baglantiKokunuDogrula(baglanti) {
  const kok = new URL(baglanti).origin;
  const beklenen = new URL(AYARLAR.tabanUrl).origin;
  if (kok !== beklenen) {
    throw new KurulumHatasi(
      `E-postadaki bağlantının kökü (${kok}) E2E_BASE_URL (${beklenen}) ile uyuşmuyor. ` +
        `Sunucunun BETTER_AUTH_URL değerini ${beklenen} yapın (.env.local ya da ortam değişkeni) ve sunucuyu yeniden başlatın; ` +
        "ya da E2E_BASE_URL'i sunucunun adresine göre ayarlayın.",
    );
  }
}

/* ------------------------------------------------------------------------------------------------
 * Kayıt ve giriş
 * ---------------------------------------------------------------------------------------------- */

/** Bir çalıştırmada en çok bu kadar kayıt yapılır (üretim oran sınırı: IP başına dakikada 5 kayıt). */
export const KAYIT_SINIRI = 2;
let kayitSayisi = 0;

/** Yeni bir kayıt hakkı kullanır; sınır aşılırsa çalıştırmayı durdurur. */
export function kayitHakkiAl() {
  kayitSayisi += 1;
  if (kayitSayisi > KAYIT_SINIRI) {
    throw new KurulumHatasi(
      `Bu çalıştırmada en çok ${KAYIT_SINIRI} kayıt yapılabilir (sunucu oran sınırı). Mevcut kullanıcıyı girisliBaglam ile paylaşın.`,
    );
  }
}

/** Benzersiz test kullanıcısı bilgileri. */
export function yeniKullaniciBilgileri() {
  const zaman = Date.now();
  return {
    ad: "E2E Deneme",
    email: `e2e.${zaman}@ornek.com.tr`,
    sifre: "E2e-Sifre-2026!",
    sirket: "E2E Mühendislik A.Ş.",
    unvan: "Test mühendisi",
  };
}

const ORAN_SINIRI = /Çok fazla deneme yaptınız\. Lütfen (\d+) saniye sonra/;

/**
 * `eylem` (ör. gönder düğmesine tıklama) bir Server Action isteği başlatmalı; istek bitene (ya da istemci
 * tarafından kesilene) kadar bekler. Böylece önceki gönderimden kalan hata/uyarı yeni sonuç sanılmaz.
 * Not: Next.js, eylem sonucunu aldıktan sonra yanıt akışını kesebilir (net::ERR_ABORTED); bu da "bitti" sayılır.
 */
export async function sunucuEylemiyle(page, eylem, { zamanAsimi = 20_000 } = {}) {
  const eylemIstegi = (istek) => istek.method() === "POST" && istek.headers()["next-action"] !== undefined;
  let izlenen = null;
  let bitir;
  const bitti = new Promise((coz) => {
    bitir = coz;
  });
  const basladi = (istek) => {
    if (!izlenen && eylemIstegi(istek)) izlenen = istek;
  };
  const sonlandi = (istek) => {
    if (istek === izlenen) bitir(true);
  };
  page.on("request", basladi);
  page.on("requestfinished", sonlandi);
  page.on("requestfailed", sonlandi);
  let zamanlayici;
  try {
    await eylem();
    const sonuc = await Promise.race([
      bitti,
      new Promise((coz) => {
        zamanlayici = setTimeout(() => coz(false), zamanAsimi);
      }),
    ]);
    if (!sonuc) {
      throw new DogrulamaHatasi(
        izlenen ? `Sunucu eylemi ${zamanAsimi} ms içinde bitmedi` : "Gönderim bir Server Action isteği başlatmadı",
      );
    }
  } finally {
    clearTimeout(zamanlayici);
    page.off("request", basladi);
    page.off("requestfinished", sonlandi);
    page.off("requestfailed", sonlandi);
  }
}

/** Görünür form uyarısının (role=alert) metni; yoksa null. Rota duyurucusu (role=alert) form dışında kalır. */
async function formUyarisi(page) {
  for (const uyari of await gorunur(page.locator('form [role="alert"]')).all()) {
    const metin = sadelestir(await uyari.textContent());
    if (metin) return metin;
  }
  return null;
}

/**
 * Kayıt formunu (geçerli sayfadaki /kayit) doldurup gönderir. `sifreTekrar` verilirse onu kullanır.
 * Döner: "basarili" ya da "alan-hatasi". Oran sınırına takılırsa bekleyip bir kez yeniden dener;
 * başka bir form hatasında DogrulamaHatasi fırlatır.
 */
export async function kayitFormunuGonder(page, k, { sifreTekrar, yenidenDene = true } = {}) {
  const gonder = page.getByRole("button", { name: "Kayıt ol", exact: true });
  await hidrasyonBekle(gonder);
  await page.getByRole("textbox", { name: "Ad soyad" }).fill(k.ad);
  await page.getByRole("textbox", { name: "E-posta" }).fill(k.email);
  await gorunur(page.getByLabel("Şifre", { exact: true })).fill(k.sifre);
  await gorunur(page.getByLabel("Şifre (tekrar)", { exact: true })).fill(sifreTekrar ?? k.sifre);
  await page.getByRole("textbox", { name: "Şirket" }).fill(k.sirket ?? "");
  await page.getByRole("textbox", { name: "Unvan" }).fill(k.unvan ?? "");
  await sunucuEylemiyle(page, () => gonder.click());

  const basari = gorunur(page.getByText("E-postanızı doğrulayın", { exact: true }));
  const alanHatasi = gorunur(page.locator('form [aria-invalid="true"]'));
  const durum = await bekleKadar(
    async () => {
      if (await basari.isVisible()) return "basarili";
      // Düğme beklemedeyken adı "Kaydediliyor…" olur: sonuç henüz işlenmedi.
      if (!(await gonder.isVisible()) || !(await gonder.isEnabled())) return null;
      if (await alanHatasi.count()) return "alan-hatasi";
      const uyari = await formUyarisi(page);
      return uyari ? { uyari } : null;
    },
    { zamanAsimi: 20_000, mesaj: "Kayıt formu yanıt vermedi" },
  );
  if (typeof durum === "string") return durum;

  const sinir = ORAN_SINIRI.exec(durum.uyari);
  if (sinir && yenidenDene) {
    const sn = Math.min(Number(sinir[1]) + 1, 65);
    console.log(`    … kayıt oran sınırına takıldı; ${sn} sn beklenip bir kez yeniden denenecek`);
    await uyu(sn * 1000);
    await page.reload();
    return kayitFormunuGonder(page, k, { sifreTekrar, yenidenDene: false });
  }
  throw new DogrulamaHatasi(`Kayıt başarısız: ${durum.uyari}`);
}

/**
 * Geçerli sayfadaki giriş formunu doldurup gönderir. Döner: { basarili: true } (giriş sayfasından
 * ayrıldıysa) veya { basarili: false, hata: "<uyarı metni>" }.
 */
export async function girisFormunuGonder(page, { email, sifre }) {
  const gonder = page.getByRole("button", { name: "Giriş yap", exact: true });
  await hidrasyonBekle(gonder);
  await page.getByRole("textbox", { name: "E-posta" }).fill(email);
  await gorunur(page.getByLabel("Şifre", { exact: true })).fill(sifre);
  await sunucuEylemiyle(page, () => gonder.click());
  return bekleKadar(
    async () => {
      if (!new URL(page.url()).pathname.startsWith("/giris")) return { basarili: true };
      if (!(await gonder.isVisible()) || !(await gonder.isEnabled())) return null;
      const hata = await formUyarisi(page);
      return hata ? { basarili: false, hata } : null;
    },
    { zamanAsimi: 20_000, mesaj: "Giriş formu yanıt vermedi" },
  );
}

/** /giris (isteğe bağlı ?yonlendir=) sayfasını açıp giriş yapar. */
export async function girisYap(page, { email, sifre, yonlendir }) {
  await page.goto(yonlendir ? `/giris?yonlendir=${yonlendir}` : "/giris");
  return girisFormunuGonder(page, { email, sifre });
}

/** Başlıktaki hesap menüsünde kullanıcı adı görünene kadar bekler. */
export async function basliktaAdOlmali(page, ad) {
  const menu = page.getByRole("navigation", { name: "Hesap" });
  await bekleKadar(() => menu.getByText(ad, { exact: true }).isVisible(), {
    mesaj: async () => `Başlıkta "${ad}" görünmedi; menü: ${JSON.stringify(sadelestir(await menu.textContent().catch(() => "")))}`,
  });
}

/**
 * Oturum açılmış yeni bir bağlam. Kimlik doğrulama senaryosu çalıştıysa onun son oturumunu paylaşır; yoksa
 * yeni bir kullanıcı kaydeder ve doğrular (doğrulama bağlantısı oturumu açar; giriş denemesi harcanmaz).
 *
 * DİKKAT: Paylaşılan oturumla "Çıkış yap" denmemeli ve şifre sıfırlanmamalı; ikisi de oturumu sunucuda siler
 * ve sonraki senaryolar giriş yapmamış olur.
 */
export async function girisliBaglam(t, secenekler = {}) {
  if (!t.paylasilan.oturum) {
    const baglam = await t.yeniBaglam();
    const { page } = await t.yeniSayfa(baglam);
    const k = yeniKullaniciBilgileri();
    kayitHakkiAl();
    const baslangic = Date.now();
    await page.goto("/kayit");
    const durum = await kayitFormunuGonder(page, k);
    esitOlmali(durum, "basarili", "Kayıt sonucu");
    const posta = await epostaBekle({ alici: k.email, sonra: baslangic, yolIcerir: "/verify-email" });
    baglantiKokunuDogrula(posta.baglanti);
    await page.goto(posta.baglanti);
    await adresOlmali(page, "/e-posta-dogrulandi");
    await basliktaAdOlmali(page, k.ad);
    t.paylasilan.kullanici = k;
    t.paylasilan.oturum = await baglam.storageState();
    await page.close();
  }
  return t.yeniBaglam({ ...secenekler, storageState: t.paylasilan.oturum });
}

/* ------------------------------------------------------------------------------------------------
 * PDF indirme
 * ---------------------------------------------------------------------------------------------- */

/**
 * `tiklama` (fonksiyon ya da tıklanacak locator) bir indirme başlatmalı. İndirilen dosyayı çıktı klasörüne
 * kaydeder, PDF imzasını denetler ve `pdftotext` ile metnini çıkarır. Döner: { yol, dosyaAdi, metin }.
 *
 * Not: Yalnızca indirme (Content-Disposition: attachment ya da <a download>) Playwright "download" olayını
 * tetikler; PDF yeni sekmede satır içi açılıyorsa bu yardımcı o sekmenin olayını beklemelidir.
 */
export async function indirilenPdf(page, tiklama, { zamanAsimi = 30_000 } = {}) {
  const [indirme] = await Promise.all([
    page.waitForEvent("download", { timeout: zamanAsimi }),
    typeof tiklama === "function" ? tiklama() : tiklama.click(),
  ]);
  const hata = await indirme.failure();
  if (hata) throw new DogrulamaHatasi(`İndirme başarısız: ${hata}`);

  const klasor = path.join(ciktiKlasoru(), "indirilenler");
  mkdirSync(klasor, { recursive: true });
  const dosyaAdi = indirme.suggestedFilename();
  const yol = path.join(klasor, `${Date.now()}-${dosyaAdi.replace(/[^\w.-]+/g, "_")}`);
  await indirme.saveAs(yol);

  const bas = (await readFile(yol)).subarray(0, 5).toString("latin1");
  esitOlmali(bas, "%PDF-", `${dosyaAdi} PDF imzası`);

  let metin;
  try {
    ({ stdout: metin } = await execFileAsync("pdftotext", ["-enc", "UTF-8", yol, "-"], { maxBuffer: 32 * 1024 * 1024 }));
  } catch (e) {
    if (e.code === "ENOENT") throw new KurulumHatasi("pdftotext bulunamadı (poppler-utils paketi gerekli).");
    throw new DogrulamaHatasi(`pdftotext ${dosyaAdi} dosyasını okuyamadı: ${e.message.split("\n")[0]}`);
  }
  return { yol, dosyaAdi, metin };
}

/** Çalıştırma raporunu (JSON) çıktı klasörüne yazar. */
export async function raporYaz(veri) {
  const yol = path.join(ciktiKlasoru(), "rapor.json");
  await writeFile(yol, JSON.stringify(veri, null, 2), "utf8");
  return yol;
}
