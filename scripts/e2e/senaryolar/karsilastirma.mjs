/**
 * Faz 2 — karşılaştırma (KAPSAM §3.4).
 *   Senaryo paneli (oturumsuz, Ohm): iki senaryo (2,2 kΩ ve 4,7 kΩ) → farklı satırlar vurgulu → senaryoyu forma
 *   yükle → sil. Değer taraması: girdi/çıktı/aralık seçilir, grafiğin (SVG role="img") adı ve özeti değişir.
 *   Mobilde (iPhone 13, 390 px) panel açıkken yatay taşma yok.
 *   Kayıtlı karşılaştırma (girişli): aynı projeye iki Ohm kaydı ("Farklı kaydet" ile) ve bir seri/paralel kaydı →
 *   proje sayfasında aynı türden iki kayıt seçilip "Karşılaştır" → /karsilastir?kayitlar=… tablosu; farklı tür
 *   seçimi pasif ve açıklamalı. Oturumsuz /karsilastir → 307 giriş. Proje ve kayıtlar sonda silinir.
 */
import {
  adresOlmali,
  agDurulsun,
  AYARLAR,
  bekleKadar,
  dogrula,
  esitOlmali,
  girisliBaglam,
  gorunur,
  hidrasyonBekle,
  sadelestir,
  yatayTasmaYok,
  yolVeSorgu,
} from "../yardimcilar.mjs";
import {
  calismaAlani,
  direncYaz,
  hesapSayfasiniAc,
  kaydetPaneliyleKaydet,
  kayitliProjeKimligi,
  OHM_YOLU,
  ohmDegerleri,
  ohmDoldur,
  projeSayfasiniAc,
  projeyiIcerigiyleSil,
  temizle,
} from "./kaydetme-projeler.mjs";

/** Hesap sayfasındaki senaryo paneli ve içindeki bölümler */
export function senaryoPaneli(page) {
  const { hesaplama } = calismaAlani(page);
  return {
    // Senaryo eklenince düğmenin adına sayı eklenir ("Senaryo karşılaştırma 2 senaryo").
    ac: hesaplama.getByRole("button", { name: /^Senaryo karşılaştırma/ }),
    ekle: hesaplama.getByRole("button", { name: "Mevcut değerleri senaryo olarak ekle", exact: true }),
    liste: hesaplama.getByRole("list", { name: "Senaryolar", exact: true }),
    tablo: hesaplama.getByRole("region", { name: "Karşılaştırma tablosu", exact: true }),
    tarama: hesaplama.getByRole("region", { name: "Değer taraması", exact: true }),
    rapor: hesaplama.getByRole("button", { name: "Karşılaştırma raporu (PDF)", exact: true }),
  };
}

/** Paneli açar (kapalıysa). */
export async function senaryoPaneliniAc(page) {
  const panel = senaryoPaneli(page);
  await hidrasyonBekle(panel.ac);
  if ((await panel.ac.getAttribute("aria-expanded")) !== "true") await panel.ac.click();
  await panel.ekle.waitFor();
  return panel;
}

/** Formdaki değerleri senaryo olarak ekler; listede `beklenenSayi` senaryo olana kadar bekler. */
export async function senaryoEkle(page, beklenenSayi) {
  const panel = senaryoPaneli(page);
  await panel.ekle.click();
  await bekleKadar(async () => (await panel.liste.getByRole("listitem").count()) === beklenenSayi, {
    mesaj: `Senaryo listesinde ${beklenenSayi} senaryo olmadı`,
  });
}

/** Tablonun sütun başlıklarındaki senaryo adları */
async function sutunAdlari(tablo) {
  return (await tablo.locator("thead th[data-senaryo] span[title]").allTextContents()).map(sadelestir);
}

/** Satır vurgulu mu (data-farkli="true")? Satır yoksa hata. */
async function satirFarkli(tablo, anahtar) {
  const satir = tablo.locator(`tr[data-satir="${anahtar}"]`);
  esitOlmali(await satir.count(), 1, `"${anahtar}" satırı sayısı`);
  return (await satir.getAttribute("data-farkli")) === "true";
}

/** Tarama grafiği: SVG'nin erişilebilir adı (<title>) ve özeti (<desc>) */
async function grafikBilgisi(tarama) {
  const svg = tarama.getByRole("img");
  await svg.waitFor();
  return svg.evaluate((el) => ({
    ad: el.querySelector("title")?.textContent ?? "",
    ozet: el.querySelector("desc")?.textContent ?? "",
  }));
}

const PROJE = "E2E Karşılaştırma";
const KAYIT_A = "Karşılaştırma A";
const KAYIT_B = "Karşılaştırma B";
const KAYIT_C = "Seri-paralel C";

const senaryo = {
  ad: "karsilastirma",
  aciklama: "Faz 2: senaryo ve kayıtlı hesap karşılaştırması, grafik",

  async calistir(t) {
    const anonim = await t.yeniBaglam();
    const { page, konsol } = await t.yeniSayfa(anonim);

    await t.adim("senaryo paneli: iki senaryo eklenir (2,2 kΩ ve 4,7 kΩ)", async () => {
      await hesapSayfasiniAc(page, OHM_YOLU, { girisli: false });
      await ohmDoldur(page);
      const panel = await senaryoPaneliniAc(page);
      await gorunur(page.getByText("Henüz senaryo yok.", { exact: false })).waitFor();
      await senaryoEkle(page, 1);
      await direncYaz(page, "4,7");
      await senaryoEkle(page, 2);
      dogrula(/2 senaryo/.test(sadelestir(await panel.ac.textContent())), "Panel başlığında senaryo sayısı yok");
    });

    await t.adim("tabloda farklı satırlar vurgulu, aynı satırlar değil", async () => {
      const { tablo } = senaryoPaneli(page);
      await tablo.waitFor();
      esitOlmali((await sutunAdlari(tablo)).join(" | "), "Senaryo 1 | Senaryo 2", "Sütunlar");
      dogrula(await satirFarkli(tablo, "girdi:R"), "Direnç girdisi satırı vurgulu değil");
      dogrula(await satirFarkli(tablo, "cikti:I"), "Akım çıktısı satırı vurgulu değil");
      dogrula(!(await satirFarkli(tablo, "girdi:V")), "Aynı olan gerilim satırı vurgulu");
      await gorunur(page.getByText(/Vurgulu \d+ satır senaryolar arasında farklı\./)).waitFor();
    });

    await t.adim("senaryo forma yüklenir", async () => {
      const panel = senaryoPaneli(page);
      esitOlmali((await ohmDegerleri(page)).direnc, "4,7", "Yüklemeden önce direnç");
      await panel.liste.getByRole("button", { name: "Senaryo 1: forma yükle", exact: true }).click();
      await bekleKadar(async () => (await ohmDegerleri(page)).direnc === "2,2", { mesaj: "Senaryo 1 forma yüklenmedi" });
      await panel.liste.locator('li[data-senaryo="senaryo-1"]').getByText("Formdaki değerler", { exact: true }).waitFor();
    });

    await t.adim("senaryo silinir", async () => {
      const panel = senaryoPaneli(page);
      await panel.liste.getByRole("button", { name: "Senaryo 2: sil", exact: true }).click();
      await bekleKadar(async () => (await panel.liste.getByRole("listitem").count()) === 1, { mesaj: "Senaryo 2 silinmedi" });
      esitOlmali((await sutunAdlari(panel.tablo)).join(" | "), "Senaryo 1", "Sütunlar");
    });

    await t.adim("tarama: girdi, çıktı ve aralık seçilir; grafik (SVG role=img) yeniden çizilir", async () => {
      const { tarama } = senaryoPaneli(page);
      const ilk = await grafikBilgisi(tarama);
      esitOlmali(ilk.ad, "Akım – Gerilim", "Varsayılan grafik adı");
      await tarama.getByRole("combobox", { name: "Değişen girdi", exact: true }).selectOption({ label: "Direnç" });
      await tarama.getByRole("combobox", { name: "Grafikteki çıktı", exact: true }).selectOption({ label: "Güç" });
      await tarama.getByRole("textbox", { name: "Başlangıç", exact: true }).fill("1");
      await tarama.getByRole("textbox", { name: "Bitiş", exact: true }).fill("10");
      await tarama.getByRole("combobox", { name: "Birim", exact: true }).selectOption({ label: "kΩ" });
      await tarama.getByRole("textbox", { name: "Nokta sayısı", exact: true }).fill("10");
      const son = await bekleKadar(
        async () => {
          const g = await grafikBilgisi(tarama);
          return g.ad === "Güç – Direnç" && /10 nokta/.test(g.ozet) ? g : null;
        },
        { mesaj: async () => `Grafik güncellenmedi: ${JSON.stringify(await grafikBilgisi(tarama))}` },
      );
      dogrula(/1–10\s*kΩ/.test(sadelestir(son.ozet)), `Grafik özetinde aralık yok: ${son.ozet}`);
      await tarama.getByRole("img", { name: "Güç – Direnç", exact: true }).waitFor();
    });

    await t.adim("senaryo paneli boyunca konsol hatası yok", async () => {
      konsol.dogrulaHataYok();
    });

    await t.adim("mobil (iPhone 13, 390 px): panel, tablo ve grafik açıkken yatay taşma yok", async () => {
      const mobil = await t.yeniBaglam({ mobil: true });
      const { page: m, konsol: mk } = await t.yeniSayfa(mobil);
      esitOlmali(m.viewportSize()?.width, 390, "Görünüm genişliği");
      await hesapSayfasiniAc(m, OHM_YOLU, { girisli: false });
      await ohmDoldur(m);
      const panel = await senaryoPaneliniAc(m);
      await senaryoEkle(m, 1);
      await direncYaz(m, "4,7");
      await senaryoEkle(m, 2);
      await panel.tablo.waitFor();
      await panel.tarama.getByRole("img").waitFor();
      await panel.tarama.scrollIntoViewIfNeeded();
      await yatayTasmaYok(m);
      mk.dogrulaHataYok();
      await m.close();
    });

    // Kayıtlı hesap karşılaştırması (girişli)
    const veri = { projeler: [], projesizler: [] };
    const baglam = await girisliBaglam(t);
    try {
      const { page: g, konsol: gk } = await t.yeniSayfa(baglam);
      const kimlik = {};
      let projeId;

      await t.adim("aynı projeye iki Ohm kaydı (Farklı kaydet) ve bir seri/paralel kaydı", async () => {
        await hesapSayfasiniAc(g, OHM_YOLU, { girisli: true });
        await ohmDoldur(g);
        kimlik.A = await kaydetPaneliyleKaydet(g, { ad: KAYIT_A, yeniProje: PROJE });
        projeId = await kayitliProjeKimligi(g);
        veri.projeler.push(projeId);
        veri.projesizler.push(KAYIT_A, KAYIT_B, KAYIT_C);
        await direncYaz(g, "4,7");
        kimlik.B = await kaydetPaneliyleKaydet(g, { ad: KAYIT_B, farkli: true });
        esitOlmali(await kayitliProjeKimligi(g), projeId, "Farklı kaydedilen kaydın projesi");
        await hesapSayfasiniAc(g, "/hesaplar/seri-paralel", { girisli: true });
        kimlik.C = await kaydetPaneliyleKaydet(g, { ad: KAYIT_C, proje: PROJE });
        esitOlmali(await kayitliProjeKimligi(g), projeId, "Seri/paralel kaydının projesi");
      });

      await t.adim("proje sayfasında aynı türden iki kayıt seçilir → Karşılaştır → /karsilastir tablosu", async () => {
        await projeSayfasiniAc(g, projeId);
        for (const ad of [KAYIT_A, KAYIT_B]) {
          const kutu = g.getByRole("checkbox", { name: `Karşılaştırmak için seç: ${ad}`, exact: true });
          await hidrasyonBekle(kutu);
          await kutu.check();
        }
        await gorunur(g.getByText("2 kayıt seçildi: 1.1 Ohm yasası ve güç", { exact: true })).waitFor();
        const karsilastir = g.getByRole("link", { name: "Karşılaştır (2)", exact: true });
        await karsilastir.click();
        await adresOlmali(g, `/karsilastir?kayitlar=${kimlik.A},${kimlik.B}`);
        const tablo = g.getByRole("region", { name: "2 kayıt yan yana", exact: true });
        await tablo.waitFor();
        esitOlmali((await sutunAdlari(tablo)).join(" | "), `${KAYIT_A} | ${KAYIT_B}`, "Sütunlar");
        dogrula(await satirFarkli(tablo, "girdi:R"), "Direnç satırı vurgulu değil");
        dogrula(!(await satirFarkli(tablo, "girdi:V")), "Aynı olan gerilim satırı vurgulu");
        const liste = g.getByRole("list", { name: "Karşılaştırılan kayıtlar", exact: true });
        esitOlmali(
          await liste.getByRole("link", { name: new RegExp(`^${KAYIT_A}`) }).getAttribute("href"),
          `${OHM_YOLU}?kayit=${kimlik.A}`,
          "Kayıt bağlantısı",
        );
      });

      await t.adim("farklı türden kayıtlar seçilince Karşılaştır pasif ve açıklamalı", async () => {
        await projeSayfasiniAc(g, projeId);
        for (const ad of [KAYIT_A, KAYIT_C]) {
          const kutu = g.getByRole("checkbox", { name: `Karşılaştırmak için seç: ${ad}`, exact: true });
          await hidrasyonBekle(kutu);
          await kutu.check();
        }
        const pasif = g.getByRole("button", { name: "Karşılaştır", exact: true });
        await pasif.waitFor();
        esitOlmali(await pasif.getAttribute("aria-disabled"), "true", "aria-disabled");
        esitOlmali(await g.getByRole("link", { name: /^Karşılaştır( \(\d+\))?$/ }).count(), 0, "Karşılaştır bağlantısı sayısı");
        const aciklamaId = await pasif.getAttribute("aria-describedby");
        const aciklama = sadelestir(await g.locator(`[id="${aciklamaId}"]`).textContent());
        dogrula(/farklı hesap türlerinden/.test(aciklama), `Açıklama: ${JSON.stringify(aciklama)}`);
        // Adres elle yazılsa da sayfa farklı türleri karşılaştırmaz.
        await g.goto(`/karsilastir?kayitlar=${kimlik.A},${kimlik.C}`);
        await g.getByRole("heading", { name: "Kayıtlar farklı hesaplara ait", exact: true }).waitFor();
      });

      await t.adim("oturumsuz /karsilastir → 307 /giris?yonlendir=/karsilastir", async () => {
        const yanit = await anonim.request.get("/karsilastir", { maxRedirects: 0 });
        esitOlmali(yanit.status(), 307, "HTTP durumu");
        const konum = yanit.headers()["location"];
        dogrula(konum, "Location başlığı yok");
        esitOlmali(yolVeSorgu(new URL(konum, AYARLAR.tabanUrl).href), "/giris?yonlendir=/karsilastir", "Yönlendirme hedefi");
        await page.goto("/karsilastir");
        await adresOlmali(page, "/giris?yonlendir=/karsilastir");
        await page.getByRole("button", { name: "Giriş yap", exact: true }).waitFor();
      }, { sayfa: page });

      await t.adim("temizlik: proje ve kayıtları silinir", async () => {
        await projeyiIcerigiyleSil(g, projeId);
        veri.projeler = [];
        veri.projesizler = [];
        esitOlmali(await gorunur(g.locator(`main a[href="/projeler/${projeId}"]`)).count(), 0, "Silinen projenin kartı");
      });

      await t.adim("kayıtlı karşılaştırma boyunca konsol hatası yok", async () => {
        await agDurulsun(g);
        gk.dogrulaHataYok();
      });
    } finally {
      await temizle(t, baglam, veri);
    }
  },
};

export default senaryo;
