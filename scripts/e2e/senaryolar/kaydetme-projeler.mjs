/**
 * Faz 2 — kaydetme ve projeler (KAPSAM §3.3). Akış sırası:
 *   oturumsuz "Kaydetmek için giriş yapın" → Ohm'da değer girip ad + yeni projeyle kaydet (?kayit=<id>) →
 *   yeniden yüklemede değerler → değişiklik göstergesi → aynı kayda kaydet → /projeler → proje → Aç →
 *   Kopyala → Taşı (projesiz) → proje adı/açıklaması → ikinci kullanıcı: başkasının projesi "bulunamadı",
 *   başkasının ?kayit= adresi kayıtsız açılır → kayıt silme → proje silme (hesap projesiz kalır) → temizlik.
 *
 * Oturum girisliBaglam ile paylaşılır (çıkış YAPILMAZ); ikinci kullanıcı ikinciKullaniciBaglami ile açılır
 * (çalıştırmanın ikinci kayıt hakkı, pdf-rapor ile paylaşılır). Kullanıcı her çalıştırmada yenidir; yine de
 * oluşturulan proje ve kayıtlar sonda (adım başarısız olsa da) silinir.
 *
 * Dışa aktarılan yardımcılar karsilastirma ve pdf-rapor senaryolarında da kullanılır.
 */
import {
  adresOlmali,
  agDurulsun,
  bekleKadar,
  dogrula,
  esitOlmali,
  girisliBaglam,
  gorunur,
  hidrasyonBekle,
  ikinciKullaniciBaglami,
  sadelestir,
  sunucuEylemiyle,
  yolVeSorgu,
} from "../yardimcilar.mjs";
import { hesapBolumleri, kartOku } from "./ohm-yasasi.mjs";

export const OHM_YOLU = "/hesaplar/ohm-yasasi";

/* ------------------------------------------------------------------------------------------------
 * Hesap sayfası: araç satırı (kaydetme, rapor) ve Ohm formu
 * ---------------------------------------------------------------------------------------------- */

/** Hesap sayfasının "Hesaplama" bölümündeki kaydetme araçları ve form/sonuç bölümleri */
export function calismaAlani(page) {
  const hesaplama = page.getByRole("region", { name: "Hesaplama", exact: true });
  return {
    hesaplama,
    ...hesapBolumleri(page),
    // Kaydetme paneli açıkken panelde de "Kaydet" var; araç satırınınki DOM'da önce gelir.
    kaydet: hesaplama.getByRole("button", { name: "Kaydet", exact: true }).first(),
    farkliKaydet: hesaplama.getByRole("button", { name: "Farklı kaydet", exact: true }),
    girisBaglantisi: hesaplama.getByRole("link", { name: "Kaydetmek için giriş yapın", exact: true }),
    degisiklikRozeti: gorunur(hesaplama.getByText("Kaydedilmemiş değişiklik", { exact: true })),
    kayitliBilgi: gorunur(hesaplama.getByText("Kayıtlı hesap:", { exact: true })),
    pdfRapor: hesaplama.getByRole("button", { name: "PDF rapor", exact: true }),
  };
}

/**
 * Hesap sayfasını açar ve çalışma alanının gerçek (akışla gelen) sürümünü bekler. Suspense yedeği oturumsuz ve
 * kayıtsız çalışma alanıdır: girişliyken araç satırındaki "Kaydet" düğmesi, oturumsuzken giriş bağlantısı ve
 * ağın durulması beklenir. Böylece yazılan değerler yedekle birlikte silinmez.
 */
export async function hesapSayfasiniAc(page, yol, { girisli }) {
  const yanit = await page.goto(yol);
  esitOlmali(yanit?.status(), 200, `${yol} HTTP durumu`);
  const alan = calismaAlani(page);
  await hidrasyonBekle(girisli ? alan.kaydet : alan.girisBaglantisi);
  await agDurulsun(page);
  return alan;
}

/** Ohm formunu (Gerilim ve direnç biliniyor) doldurur. Sayfa açık ve hidrate olmalı. */
export async function ohmDoldur(page, { gerilim = "12", direnc = "2,2", direncBirimi = "kΩ" } = {}) {
  const { girdiler } = hesapBolumleri(page);
  const gerilimKutusu = girdiler.getByRole("textbox", { name: "Gerilim", exact: true });
  await hidrasyonBekle(gerilimKutusu);
  await girdiler.getByRole("combobox", { name: "Bilinen büyüklükler", exact: true }).selectOption("V-R");
  await gerilimKutusu.fill(gerilim);
  await girdiler.getByRole("combobox", { name: "Gerilim birimi", exact: true }).selectOption({ label: "V" });
  await direncYaz(page, direnc, direncBirimi);
}

/** Yalnızca direnci (ve birimini) değiştirir. */
export async function direncYaz(page, direnc, direncBirimi = "kΩ") {
  const { girdiler } = hesapBolumleri(page);
  await girdiler.getByRole("textbox", { name: "Direnç", exact: true }).fill(direnc);
  await girdiler.getByRole("combobox", { name: "Direnç birimi", exact: true }).selectOption({ label: direncBirimi });
}

/** Formdaki Ohm girdileri: { gerilim, gerilimBirimi, direnc, direncBirimi } */
export async function ohmDegerleri(page) {
  const { girdiler } = hesapBolumleri(page);
  const secili = (ad) =>
    girdiler.getByRole("combobox", { name: ad, exact: true }).evaluate((el) => el.selectedOptions[0]?.textContent?.trim() ?? "");
  return {
    gerilim: await girdiler.getByRole("textbox", { name: "Gerilim", exact: true }).inputValue(),
    gerilimBirimi: await secili("Gerilim birimi"),
    direnc: await girdiler.getByRole("textbox", { name: "Direnç", exact: true }).inputValue(),
    direncBirimi: await secili("Direnç birimi"),
  };
}

/** Akım kartının metni (ör. "5,455 mA"); hesaplanana kadar bekler. Anlamlı basamak kullanıcı tercihine bağlıdır. */
export async function akimMetni(page) {
  const { sonuc } = hesapBolumleri(page);
  return bekleKadar(
    async () => {
      const { deger, metin } = await kartOku(sonuc, "I");
      return deger ? metin : null;
    },
    { mesaj: "Akım kartı hesaplanmadı" },
  );
}

/** Adres çubuğundaki ?kayit= kimliği (yoksa null) */
export function kayitKimligi(page) {
  return new URL(page.url()).searchParams.get("kayit");
}

/** Kayıtlı hesap çalışma alanı yüklendi: "Kayıtlı hesap:" ve kayıt adı görünür. */
export async function kayitYuklendi(page, ad) {
  const alan = calismaAlani(page);
  await alan.kayitliBilgi.waitFor();
  await gorunur(alan.hesaplama.getByText(ad, { exact: true })).first().waitFor();
  await hidrasyonBekle(alan.kaydet);
  return alan;
}

/**
 * Araç satırındaki "Kaydet" (kayıtsız) ya da "Farklı kaydet" (kayıtlı) panelini açar, adı ve projeyi seçip kaydeder.
 * `yeniProje`: bu adla yeni proje; `proje`: mevcut projenin adı; ikisi de yoksa panelin varsayılanı (yeni kayıtta
 * projesiz, farklı kaydette kaydın projesi). Adres yeni `?kayit=<id>` olana ve kayıt yüklenene kadar bekler; kimliği döner.
 */
export async function kaydetPaneliyleKaydet(page, { ad, yeniProje, proje, farkli = false }) {
  const alan = calismaAlani(page);
  const onceki = kayitKimligi(page);
  const acici = farkli ? alan.farkliKaydet : alan.kaydet;
  await hidrasyonBekle(acici);
  await acici.click();
  const panel = alan.hesaplama.getByRole("region", { name: farkli ? "Farklı kaydet" : "Hesabı kaydet", exact: true });
  await panel.waitFor();
  await panel.getByRole("textbox", { name: "Kayıt adı", exact: true }).fill(ad);
  const projeSecimi = panel.getByRole("combobox", { name: "Proje", exact: true });
  if (yeniProje) {
    await projeSecimi.selectOption({ label: "Yeni proje…" });
    await panel.getByRole("textbox", { name: "Yeni proje adı", exact: true }).fill(yeniProje);
  } else if (proje) {
    // selectOption, proje listesi (server action) yüklenip seçenek gelene kadar bekler.
    await projeSecimi.selectOption({ label: proje });
  }
  await sunucuEylemiyle(page, () => panel.getByRole("button", { name: "Kaydet", exact: true }).click());
  const id = await bekleKadar(
    () => {
      const kimlik = kayitKimligi(page);
      return kimlik && kimlik !== onceki ? kimlik : null;
    },
    { zamanAsimi: 15_000, mesaj: () => `Kaydetme sonrası adres ?kayit=<yeni id> olmadı: ${yolVeSorgu(page.url())}` },
  );
  await kayitYuklendi(page, ad);
  return id;
}

/** Kayıtlı hesabın proje kimliği ("Proje:" bağlantısından); projesizse null */
export async function kayitliProjeKimligi(page) {
  const { hesaplama } = calismaAlani(page);
  const baglanti = gorunur(hesaplama.locator('a[href^="/projeler/"]')).first();
  await baglanti.waitFor();
  const href = await baglanti.getAttribute("href");
  return decodeURIComponent(href.slice("/projeler/".length));
}

/* ------------------------------------------------------------------------------------------------
 * Projeler ve kayıt tablosu
 * ---------------------------------------------------------------------------------------------- */

/** Proje sayfasını açar; tablo bölümü ("Kayıtlı hesaplar") görünene kadar bekler. */
export async function projeSayfasiniAc(page, projeId) {
  await page.goto(`/projeler/${encodeURIComponent(projeId)}`);
  await page.getByRole("heading", { name: "Kayıtlı hesaplar", exact: true }).waitFor();
  await agDurulsun(page);
}

/** Tablodaki (görünür) kayıt satırı bağlantısı; adla tam eşleşir ("X (kopya)" ile karışmaz). */
export function kayitBaglantisi(page, ad) {
  return page.getByRole("link", { name: ad, exact: true });
}

/** Tabloda o adla görünür kayıt kalmayana kadar bekler. */
export async function kayitGorunmemeli(page, ad) {
  await bekleKadar(async () => (await kayitBaglantisi(page, ad).count()) === 0, { mesaj: `"${ad}" tabloda hâlâ görünüyor` });
}

/** Tablodaki satırı "Sil" → "Evet, sil" ile siler ve onay mesajını bekler. */
export async function kaydiSil(page, ad) {
  const dugme = page.getByRole("button", { name: `Sil: ${ad}`, exact: true });
  await hidrasyonBekle(dugme);
  await dugme.click();
  const onay = page.getByRole("group", { name: `Silmeyi onayla: ${ad}`, exact: true });
  await sunucuEylemiyle(page, () => onay.getByRole("button", { name: "Evet, sil", exact: true }).click());
  await gorunur(page.getByText(`“${ad}” silindi.`, { exact: true })).waitFor();
  await kayitGorunmemeli(page, ad);
}

/** Proje sayfasında "Projeyi sil" → onay; /projeler'e yönlenir. */
export async function projeyiSil(page) {
  const dugme = page.getByRole("button", { name: "Projeyi sil", exact: true });
  await hidrasyonBekle(dugme);
  await dugme.click();
  const onay = page.getByRole("group", { name: "Projeyi silmeyi onayla", exact: true });
  await onay.waitFor();
  await sunucuEylemiyle(page, () => onay.getByRole("button", { name: "Evet, projeyi sil", exact: true }).click());
  await adresOlmali(page, "/projeler");
  await page.getByRole("heading", { name: "Projelerim", exact: true }).waitFor();
}

/**
 * Projeyi içindeki kayıtlarla birlikte siler (proje silme kayıtları projesiz bırakır; önce kayıtlar silinir).
 * Proje yoksa (silinmiş/başkasının) bir şey yapmaz.
 */
export async function projeyiIcerigiyleSil(page, projeId) {
  await page.goto(`/projeler/${encodeURIComponent(projeId)}`);
  const durum = await bekleKadar(async () => {
    if (await gorunur(page.getByRole("heading", { name: "Proje bulunamadı", exact: true })).count()) return "yok";
    if (await page.getByRole("heading", { name: "Kayıtlı hesaplar", exact: true }).isVisible()) return "var";
    return null;
  });
  if (durum === "yok") return;
  for (let i = 0; i < 20; i++) {
    const sil = page.getByRole("button", { name: /^Sil: / });
    if ((await sil.count()) === 0) break;
    const etiket = await sil.first().getAttribute("aria-label");
    await kaydiSil(page, etiket.slice("Sil: ".length));
  }
  await projeyiSil(page);
}

/** /projeler sayfasındaki "Projesiz kayıtlar" tablosundan verilen adlardaki kayıtları siler (olanları). */
export async function projesizKayitlariSil(page, adlar) {
  await page.goto("/projeler");
  await page.getByRole("heading", { name: "Projesiz kayıtlar", exact: true }).waitFor();
  await agDurulsun(page);
  for (const ad of adlar) {
    if (await page.getByRole("button", { name: `Sil: ${ad}`, exact: true }).count()) await kaydiSil(page, ad);
  }
}

/**
 * Senaryo sonu temizliği (en iyi çaba): adım başarısız olsa da `finally` içinde çağrılır, hata fırlatmaz.
 * Projeler içerikleriyle, projesiz kayıtlar adlarıyla silinir.
 */
export async function temizle(t, baglam, { projeler = [], projesizler = [] }) {
  if (projeler.length === 0 && projesizler.length === 0) return;
  let page;
  try {
    page = await baglam.newPage();
    for (const id of projeler) await projeyiIcerigiyleSil(page, id);
    if (projesizler.length) await projesizKayitlariSil(page, projesizler);
    t.bilgi(`temizlik: ${projeler.length} proje, ${projesizler.length} projesiz kayıt denetlendi`);
  } catch (hata) {
    t.bilgi(`temizlik tamamlanamadı (test verisi kalmış olabilir): ${String(hata?.message ?? hata).split("\n")[0]}`);
  } finally {
    await page?.close().catch(() => {});
  }
}

/* ------------------------------------------------------------------------------------------------
 * Senaryo
 * ---------------------------------------------------------------------------------------------- */

const KAYIT = "E2E Ohm kaydı";
const KOPYA = `${KAYIT} (kopya)`;
const PROJE = "E2E Ölçüm projesi";
const PROJE_YENI = "E2E Ölçüm projesi (güncel)";
const PROJE_ACIKLAMA = "Uçtan uca test: şalt panosu ölçümleri";

const senaryo = {
  ad: "kaydetme-projeler",
  aciklama: "Faz 2: hesap kaydetme, projeler, kayıtlı hesabı açma/kopyalama/taşıma/silme, sahiplik",

  async calistir(t) {
    const veri = { projeler: [], projesizler: [] };
    let baglam;
    try {
      await t.adim('oturumsuz: "Kaydet" yerine "Kaydetmek için giriş yapın" bağlantısı', async () => {
        const anonim = await t.yeniBaglam();
        const { page, konsol } = await t.yeniSayfa(anonim);
        const alan = await hesapSayfasiniAc(page, OHM_YOLU, { girisli: false });
        esitOlmali(await alan.girisBaglantisi.getAttribute("href"), "/giris?yonlendir=/hesaplar/ohm-yasasi", "Bağlantı hedefi");
        esitOlmali(await alan.hesaplama.getByRole("button", { name: "Kaydet", exact: true }).count(), 0, '"Kaydet" düğmesi sayısı');
        konsol.dogrulaHataYok();
        await page.close();
      });

      baglam = await girisliBaglam(t);
      const { page, konsol } = await t.yeniSayfa(baglam);
      // Ana akışın adımlarında hata ekran görüntüsü bu sayfadan (ikinci kullanıcının sayfası araya girse de).
      const adim = (ad, fn) => t.adim(ad, fn, { sayfa: page });
      let kayitId;
      let projeId;
      let ilkAkim;
      let degisenAkim;

      await adim("girişli: Ohm değerleri girilip ad ve yeni projeyle kaydedilir → ?kayit=<id>", async () => {
        await hesapSayfasiniAc(page, OHM_YOLU, { girisli: true });
        await ohmDoldur(page);
        ilkAkim = await akimMetni(page);
        kayitId = await kaydetPaneliyleKaydet(page, { ad: KAYIT, yeniProje: PROJE });
        veri.projesizler.push(KAYIT, KOPYA); // proje silinirse kayıtlar projesiz kalır
        await adresOlmali(page, `${OHM_YOLU}?kayit=${kayitId}`);
        projeId = await kayitliProjeKimligi(page);
        veri.projeler.push(projeId);
        // Proje adı, proje listesi (server action) gelince "Projeyi aç" yerine yazılır.
        await gorunur(calismaAlani(page).hesaplama.getByRole("link", { name: PROJE, exact: true })).waitFor();
        t.bilgi(`kayıt ${kayitId}, proje ${projeId}`);
      });

      await adim("yeniden yüklemede kayıtlı değerler ve sonuç geri gelir", async () => {
        await page.reload();
        await kayitYuklendi(page, KAYIT);
        const d = await ohmDegerleri(page);
        esitOlmali(JSON.stringify(d), JSON.stringify({ gerilim: "12", gerilimBirimi: "V", direnc: "2,2", direncBirimi: "kΩ" }), "Girdiler");
        esitOlmali(await akimMetni(page), ilkAkim, "Akım kartı");
        dogrula(!(await calismaAlani(page).degisiklikRozeti.count()), "Yüklenen kayıtta değişiklik göstergesi var");
      });

      await adim('değer değişince "Kaydedilmemiş değişiklik" göstergesi çıkar', async () => {
        await direncYaz(page, "4,7");
        await calismaAlani(page).degisiklikRozeti.waitFor();
        degisenAkim = await akimMetni(page);
        dogrula(degisenAkim !== ilkAkim, `Akım değişmedi: ${degisenAkim}`);
      });

      await adim('"Kaydet" aynı kayda yazar, gösterge kalkar; değer yeniden yüklemede korunur', async () => {
        const alan = calismaAlani(page);
        await sunucuEylemiyle(page, () => alan.kaydet.click());
        await gorunur(alan.hesaplama.getByText("Değişiklikler kaydedildi.", { exact: true })).waitFor();
        await alan.degisiklikRozeti.waitFor({ state: "detached" });
        esitOlmali(kayitKimligi(page), kayitId, "Kayıt kimliği (aynı kayıt)");
        await page.reload();
        await kayitYuklendi(page, KAYIT);
        esitOlmali((await ohmDegerleri(page)).direnc, "4,7", "Kaydedilen direnç");
        esitOlmali(await akimMetni(page), degisenAkim, "Akım kartı");
      });

      await adim("/projeler: proje kartı → proje sayfasında kayıt → Aç", async () => {
        await page.goto("/projeler");
        const kart = gorunur(page.locator(`main a[href="/projeler/${projeId}"]`));
        await hidrasyonBekle(kart);
        const kartMetni = sadelestir(await kart.textContent());
        dogrula(kartMetni.startsWith(PROJE) && /1 hesap/.test(kartMetni), `Proje kartı: ${JSON.stringify(kartMetni)}`);
        await kart.click();
        await adresOlmali(page, `/projeler/${projeId}`);
        await page.getByRole("heading", { level: 1, name: PROJE, exact: true }).waitFor();
        await kayitBaglantisi(page, KAYIT).waitFor();
        const ac = page.getByRole("link", { name: `Aç: ${KAYIT}`, exact: true });
        await hidrasyonBekle(ac);
        await ac.click();
        await adresOlmali(page, `${OHM_YOLU}?kayit=${kayitId}`);
        await kayitYuklendi(page, KAYIT);
        esitOlmali((await ohmDegerleri(page)).direnc, "4,7", "Açılan kaydın direnci");
      });

      await adim('Kopyala: aynı projede "(kopya)" kaydı oluşur', async () => {
        await projeSayfasiniAc(page, projeId);
        const kopyala = page.getByRole("button", { name: `Kopyala: ${KAYIT}`, exact: true });
        await hidrasyonBekle(kopyala);
        await sunucuEylemiyle(page, () => kopyala.click());
        await gorunur(page.getByText(`“${KOPYA}” oluşturuldu.`, { exact: true })).waitFor();
        await kayitBaglantisi(page, KAYIT).waitFor();
        // Kopya ayrı bir kayıttır ve girdileri kaynağınkiyle aynıdır.
        await kayitBaglantisi(page, KOPYA).click();
        await adresOlmali(page, new RegExp(`^${OHM_YOLU}\\?kayit=(?!${kayitId}$)[^&]+$`));
        await kayitYuklendi(page, KOPYA);
        esitOlmali((await ohmDegerleri(page)).direnc, "4,7", "Kopyanın direnci");
        await projeSayfasiniAc(page, projeId);
        await kayitBaglantisi(page, KOPYA).waitFor();
      });

      await adim("Taşı: kopya projesiz kayıtlara taşınır", async () => {
        const tasi = page.getByRole("button", { name: `Taşı: ${KOPYA}`, exact: true });
        await hidrasyonBekle(tasi);
        await tasi.click();
        const form = page.getByRole("form", { name: `Taşı: ${KOPYA}`, exact: true });
        await form.getByRole("combobox", { name: "Taşınacak yer", exact: true }).selectOption({ label: "Projesiz kayıtlar" });
        await sunucuEylemiyle(page, () => form.getByRole("button", { name: "Taşı", exact: true }).click());
        await gorunur(page.getByText(`“${KOPYA}” taşındı: Projesiz kayıtlar.`, { exact: true })).waitFor();
        await kayitGorunmemeli(page, KOPYA);
        await page.goto("/projeler");
        const projesiz = page.getByRole("region", { name: "Projesiz kayıtlar", exact: true });
        await projesiz.getByRole("link", { name: KOPYA, exact: true }).waitFor();
      });

      await adim("proje adı ve açıklaması düzenlenir, yeniden yüklemede korunur", async () => {
        await projeSayfasiniAc(page, projeId);
        const duzenle = page.getByRole("button", { name: "Adı ve açıklamayı düzenle", exact: true });
        await hidrasyonBekle(duzenle);
        await duzenle.click();
        const form = page.getByRole("form", { name: "Projeyi düzenle", exact: true });
        await form.getByRole("textbox", { name: "Proje adı", exact: true }).fill(PROJE_YENI);
        await form.getByRole("textbox", { name: /^Açıklama/ }).fill(PROJE_ACIKLAMA);
        await sunucuEylemiyle(page, () => form.getByRole("button", { name: "Kaydet", exact: true }).click());
        await gorunur(page.getByText("Proje güncellendi.", { exact: true })).waitFor();
        await page.getByRole("heading", { level: 1, name: PROJE_YENI, exact: true }).waitFor();
        await page.reload();
        await page.getByRole("heading", { level: 1, name: PROJE_YENI, exact: true }).waitFor();
        await gorunur(page.getByText(PROJE_ACIKLAMA, { exact: true })).waitFor();
      });

      await t.adim('ikinci kullanıcı: başkasının /projeler/<id> adresi "Proje bulunamadı"', async () => {
        const ikinci = await ikinciKullaniciBaglami(t);
        const { page: p2, konsol: k2 } = await t.yeniSayfa(ikinci);
        await p2.goto(`/projeler/${projeId}`);
        await gorunur(p2.getByRole("heading", { name: "Proje bulunamadı", exact: true })).waitFor();
        esitOlmali(await p2.getByText(PROJE_YENI).count(), 0, "Başkasının proje adı görünme sayısı");
        k2.dogrulaHataYok();
        await p2.close();
      });

      await t.adim("ikinci kullanıcı: başkasının ?kayit= adresi kayıtsız, varsayılan değerlerle açılır", async () => {
        const ikinci = await ikinciKullaniciBaglami(t);
        const { page: p2, konsol: k2 } = await t.yeniSayfa(ikinci);
        // Girişli araç satırı ("Kaydet") akışla gelen gerçek çalışma alanını gösterir; yedek oturumsuzdur.
        const alan = await hesapSayfasiniAc(p2, `${OHM_YOLU}?kayit=${kayitId}`, { girisli: true });
        esitOlmali(await alan.kaydet.getAttribute("aria-expanded"), "false", 'Kayıtsız "Kaydet" (panel açıcı)');
        esitOlmali(await alan.kayitliBilgi.count(), 0, '"Kayıtlı hesap:" sayısı');
        esitOlmali(await alan.farkliKaydet.count(), 0, '"Farklı kaydet" sayısı');
        esitOlmali(await p2.getByText(KAYIT).count(), 0, "Başkasının kayıt adı görünme sayısı");
        const d = await ohmDegerleri(p2);
        esitOlmali(`${d.direnc} ${d.direncBirimi}`, "6 Ω", "Direnç (tanımın varsayılanı)");
        k2.dogrulaHataYok();
        await p2.close();
      });

      await adim("kayıt silinir (projesiz kayıtlar tablosundan)", async () => {
        await page.goto("/projeler");
        await page.getByRole("heading", { name: "Projesiz kayıtlar", exact: true }).waitFor();
        await kaydiSil(page, KOPYA);
        await gorunur(page.getByText("Projesiz kayıt yok.", { exact: true })).waitFor();
      });

      await adim("proje silinir; içindeki hesap silinmez, projesiz kalır", async () => {
        await projeSayfasiniAc(page, projeId);
        const sil = page.getByRole("button", { name: "Projeyi sil", exact: true });
        await hidrasyonBekle(sil);
        await sil.click();
        await gorunur(page.getByText(/İçindeki 1 hesap silinmez; projesiz kayıtlara taşınır\./)).waitFor();
        await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
        await projeyiSil(page);
        veri.projeler = veri.projeler.filter((id) => id !== projeId);
        esitOlmali(await gorunur(page.locator(`main a[href="/projeler/${projeId}"]`)).count(), 0, "Silinen projenin kartı");
        const projesiz = page.getByRole("region", { name: "Projesiz kayıtlar", exact: true });
        await projesiz.getByRole("link", { name: KAYIT, exact: true }).waitFor();
      });

      await adim("temizlik: kalan kayıt silinir", async () => {
        await kaydiSil(page, KAYIT);
        veri.projesizler = [];
        await gorunur(page.getByText("Projesiz kayıt yok.", { exact: true })).waitFor();
      });

      await adim("akış boyunca konsol hatası yok", async () => {
        await agDurulsun(page);
        konsol.dogrulaHataYok();
      });
    } finally {
      if (baglam) await temizle(t, baglam, veri);
    }
  },
};

export default senaryo;
