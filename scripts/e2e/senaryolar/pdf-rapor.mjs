/**
 * Faz 2 — PDF rapor (KAPSAM §3.5). İndirilen PDF'ler `pdftotext` ile okunur (indirilenPdf); hangi uç noktanın
 * çağrıldığı (GET/POST) istekle birlikte denetlenir.
 *   - Tek hesap: oturumsuz (POST, kullanıcı bilgisi yok) ve girişli (kullanıcı adı/şirket); kayıtlı hesap GET
 *     /api/rapor/hesap/<id>; kayıtlı + değiştirilmiş → açıklama ve POST; yerinde kaydedince yeniden GET.
 *   - Proje raporu: proje sayfasındaki düğme; içindekiler ve kayıt adları.
 *   - Karşılaştırma raporu: senaryo panelinden ve /karsilastir'dan; senaryo/kayıt adları ve tarama grafiği.
 *   - API: sahibi 200, başka kullanıcı 404, oturumsuz 401, bozuk gövde 400, JSON olmayan gövde 415.
 * Sonuçtaki sayılar (anlamlı basamak tercihine bağlı) sayfadan okunur, PDF'te aynısı aranır.
 */
import {
  dogrula,
  esitOlmali,
  girisliBaglam,
  gorunur,
  hidrasyonBekle,
  ikinciKullaniciBaglami,
  indirilenPdf,
  pdfIcermeli,
  pdfSadelestir,
  sunucuEylemiyle,
} from "../yardimcilar.mjs";
import { senaryoEkle, senaryoPaneli, senaryoPaneliniAc } from "./karsilastirma.mjs";
import {
  akimMetni,
  calismaAlani,
  direncYaz,
  hesapSayfasiniAc,
  kaydetPaneliyleKaydet,
  kayitliProjeKimligi,
  OHM_YOLU,
  ohmDoldur,
  projeSayfasiniAc,
  projeyiIcerigiyleSil,
  temizle,
} from "./kaydetme-projeler.mjs";

const PROJE = "E2E Rapor projesi";
const KAYIT_1 = "Pano ölçümü";
const KAYIT_2 = "Şalt ölçümü";
const HESAP_BASLIGI = "Ohm yasası ve güç";
const DEGISIKLIK_NOTU = "Kaydedilmemiş değişiklikler rapora dahil edilir.";
/** Her raporda bulunması gerekenler: platform adı (Türkçe karakterli), sayfa numarası, sorumluluk reddi */
const ORTAK = ["Mühendislik Hesapları", /Sayfa 1 \/ \d+/, "Sorumluluk reddi", "doğrulayın"];

/**
 * Chromium, Linux'ta indirme adını yerel ayarın karakter kümesine çevirir: LANG/LC_ALL UTF-8 değilse (ör. LANG'sız
 * konteyner, "C" yerel ayarı) Türkçe karakterli `<a download>` adı "download" olur. Tarayıcının önerdiği ad yalnızca
 * UTF-8 yerel ayarda denetlenir; sunucunun Content-Disposition adı her zaman denetlenir.
 */
const UTF8_YEREL = /utf-?8/i.test(process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || "");

/**
 * `dugme` tıklanınca `yontem` + `yol` isteği yapılmalı ve PDF inmeli. `dosyaAdi` verilirse sunucunun
 * Content-Disposition'daki UTF-8 adı (filename*) ve (UTF-8 yerel ayarda) indirilen dosyanın adı onunla aynı olmalı.
 * Döner: { istek, pdf: { yol, dosyaAdi, metin } }.
 */
async function raporIndir(page, dugme, { yontem, yol, dosyaAdi }) {
  await hidrasyonBekle(dugme);
  const [istek, pdf] = await Promise.all([
    page.waitForRequest((r) => r.method() === yontem && new URL(r.url()).pathname === yol, { timeout: 30_000 }),
    indirilenPdf(page, dugme),
  ]);
  const yanit = await istek.response();
  esitOlmali(yanit?.status(), 200, `${yontem} ${yol} HTTP durumu`);
  if (dosyaAdi) {
    const baslik = (await yanit.allHeaders())["content-disposition"] ?? "";
    const kodlu = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(baslik)?.[1];
    esitOlmali(kodlu ? decodeURIComponent(kodlu.trim()) : null, dosyaAdi, "Content-Disposition dosya adı");
    dogrula(/^attachment;/.test(baslik) && /filename="[\x20-\x7e]+\.pdf"/.test(baslik), `ASCII filename yok: ${baslik}`);
    if (UTF8_YEREL) esitOlmali(pdf.dosyaAdi, dosyaAdi, "İndirilen dosyanın adı");
  }
  return { istek, pdf };
}

/** API yanıtının durum kodu ve JSON `hata` mesajı */
async function hataOlmali(yanit, durum, hata, ne) {
  esitOlmali(yanit.status(), durum, `${ne} HTTP durumu`);
  const govde = await yanit.json().catch(() => ({}));
  const mesaj = String(govde?.hata ?? "");
  dogrula(hata instanceof RegExp ? hata.test(mesaj) : mesaj === hata, `${ne} hata mesajı: ${JSON.stringify(mesaj)}`);
}

async function pdfOlmali(yanit, ne) {
  esitOlmali(yanit.status(), 200, `${ne} HTTP durumu`);
  esitOlmali(yanit.headers()["content-type"], "application/pdf", `${ne} Content-Type`);
  esitOlmali((await yanit.body()).subarray(0, 5).toString("latin1"), "%PDF-", `${ne} PDF imzası`);
}

const senaryo = {
  ad: "pdf-rapor",
  aciklama: "Faz 2: tek hesap, proje ve karşılaştırma PDF raporları; rapor API'sinin yetki ve doğrulaması",

  async calistir(t) {
    if (!UTF8_YEREL) t.bilgi("yerel ayar UTF-8 değil: indirilen dosyanın adı denetlenmiyor (ör. LANG=C.UTF-8 ile çalıştırın)");
    const anonim = await t.yeniBaglam();

    await t.adim("oturumsuz: hesap raporu POST ile iner; başlık, Türkçe metin, sayfa no, sorumluluk reddi", async () => {
      const { page, konsol } = await t.yeniSayfa(anonim);
      const alan = await hesapSayfasiniAc(page, OHM_YOLU, { girisli: false });
      await ohmDoldur(page);
      const akim = await akimMetni(page);
      const { istek, pdf } = await raporIndir(page, alan.pdfRapor, {
        yontem: "POST",
        yol: "/api/rapor/hesap",
        dosyaAdi: `${HESAP_BASLIGI}.pdf`,
      });
      esitOlmali(istek.postDataJSON()?.hesapSlug, "ohm-yasasi", "İstekteki hesap");
      pdfIcermeli(pdf.metin, [...ORTAK, HESAP_BASLIGI, "Hesap raporu", akim], "Oturumsuz hesap raporu");
      dogrula(!pdfSadelestir(pdf.metin).includes("E2E"), "Oturumsuz raporda kullanıcı bilgisi var");
      konsol.dogrulaHataYok();
      await page.close();
    });

    const veri = { projeler: [], projesizler: [] };
    const baglam = await girisliBaglam(t);
    const kullanici = t.paylasilan.kullanici;
    try {
      const { page, konsol } = await t.yeniSayfa(baglam);
      // Ana akışın adımlarında hata ekran görüntüsü bu sayfadan (ikinci kullanıcının sayfası araya girse de).
      const adim = (ad, fn) => t.adim(ad, fn, { sayfa: page });
      const alan = calismaAlani(page);
      const kimlik = {};
      let projeId;
      let akimKayitli;
      let akimDegisik;

      await adim("girişli: rapor başlığında kullanıcı adı, unvanı ve şirketi", async () => {
        await hesapSayfasiniAc(page, OHM_YOLU, { girisli: true });
        await ohmDoldur(page);
        akimKayitli = await akimMetni(page);
        const { pdf } = await raporIndir(page, alan.pdfRapor, { yontem: "POST", yol: "/api/rapor/hesap" });
        const beklenen = [...ORTAK, HESAP_BASLIGI, akimKayitli, kullanici.ad, kullanici.sirket];
        if (kullanici.unvan) beklenen.push(kullanici.unvan);
        pdfIcermeli(pdf.metin, beklenen, "Girişli hesap raporu");
      });

      await adim("kayıtlı hesap: GET /api/rapor/hesap/<id>, başlık kayıt adı", async () => {
        kimlik[1] = await kaydetPaneliyleKaydet(page, { ad: KAYIT_1, yeniProje: PROJE });
        projeId = await kayitliProjeKimligi(page);
        veri.projeler.push(projeId);
        veri.projesizler.push(KAYIT_1, KAYIT_2);
        esitOlmali(await gorunur(page.getByText(DEGISIKLIK_NOTU)).count(), 0, "Değişiklik notu sayısı");
        const { pdf } = await raporIndir(page, alan.pdfRapor, {
          yontem: "GET",
          yol: `/api/rapor/hesap/${kimlik[1]}`,
          dosyaAdi: `${KAYIT_1}.pdf`,
        });
        pdfIcermeli(pdf.metin, [...ORTAK, KAYIT_1, `1.1 · ${HESAP_BASLIGI}`, akimKayitli, kullanici.ad], "Kayıtlı hesap raporu");
      });

      await adim(`kayıtlı + değiştirilmiş: "${DEGISIKLIK_NOTU}" ve POST; PDF yeni değeri taşır`, async () => {
        await direncYaz(page, "4,7");
        await gorunur(page.getByText(DEGISIKLIK_NOTU, { exact: true })).waitFor();
        akimDegisik = await akimMetni(page);
        const { istek, pdf } = await raporIndir(page, alan.pdfRapor, {
          yontem: "POST",
          yol: "/api/rapor/hesap",
          dosyaAdi: `${KAYIT_1}.pdf`,
        });
        const govde = istek.postDataJSON();
        esitOlmali(govde?.ad, KAYIT_1, "İstekteki kayıt adı");
        esitOlmali(govde?.girdiler?.R?.value, "4,7", "İstekteki direnç");
        pdfIcermeli(pdf.metin, [...ORTAK, KAYIT_1, akimDegisik], "Değiştirilmiş kayıt raporu");
        dogrula(!pdfSadelestir(pdf.metin).includes(akimKayitli), `Raporda eski akım (${akimKayitli}) var`);
      });

      await adim("yerinde kaydedince değişiklik notu kalkar, rapor yeniden GET ile iner", async () => {
        await sunucuEylemiyle(page, () => alan.kaydet.click());
        await gorunur(alan.hesaplama.getByText("Değişiklikler kaydedildi.", { exact: true })).waitFor();
        await gorunur(page.getByText(DEGISIKLIK_NOTU, { exact: true })).waitFor({ state: "detached" });
        const { pdf } = await raporIndir(page, alan.pdfRapor, { yontem: "GET", yol: `/api/rapor/hesap/${kimlik[1]}` });
        pdfIcermeli(pdf.metin, [KAYIT_1, akimDegisik], "Kaydedilen kaydın raporu");
      });

      await adim("proje raporu: proje sayfasındaki düğme; içindekiler, proje ve kayıt adları", async () => {
        await direncYaz(page, "10");
        kimlik[2] = await kaydetPaneliyleKaydet(page, { ad: KAYIT_2, farkli: true });
        await projeSayfasiniAc(page, projeId);
        const dugme = page.getByRole("button", { name: "Proje raporu (PDF)", exact: true });
        const { pdf } = await raporIndir(page, dugme, {
          yontem: "GET",
          yol: `/api/rapor/proje/${projeId}`,
          dosyaAdi: `${PROJE} - Proje raporu.pdf`,
        });
        pdfIcermeli(pdf.metin, [...ORTAK, PROJE, "Proje raporu", "İçindekiler", KAYIT_1, KAYIT_2, kullanici.ad], "Proje raporu");
        const toplam = Number(/Sayfa 1 \/ (\d+)/.exec(pdfSadelestir(pdf.metin))?.[1]);
        dogrula(toplam >= 3, `Proje raporu ${toplam} sayfa; özet + her kayıt ayrı sayfada beklenirdi`);
      });

      await adim("karşılaştırma raporu (senaryo paneli): senaryo adları, tablo ve tarama grafiği", async () => {
        await hesapSayfasiniAc(page, OHM_YOLU, { girisli: true });
        await ohmDoldur(page);
        const panel = await senaryoPaneliniAc(page);
        await senaryoEkle(page, 1);
        await panel.liste.getByRole("textbox", { name: "1. senaryonun adı", exact: true }).fill("Düşük");
        await direncYaz(page, "4,7");
        await senaryoEkle(page, 2);
        await panel.liste.getByRole("textbox", { name: "2. senaryonun adı", exact: true }).fill("Yüksek");
        await panel.tarama.getByRole("img").waitFor(); // tarama varsayılan olarak ilk senaryodan çizilir
        const { istek, pdf } = await raporIndir(page, senaryoPaneli(page).rapor, {
          yontem: "POST",
          yol: "/api/rapor/karsilastirma",
          dosyaAdi: `${HESAP_BASLIGI} - Karşılaştırma raporu.pdf`,
        });
        const govde = istek.postDataJSON();
        esitOlmali(govde?.senaryolar?.map((s) => s.ad).join(","), "Düşük,Yüksek", "İstekteki senaryolar");
        dogrula(govde?.tarama?.noktaSayisi > 0, "İstekte tarama yok");
        pdfIcermeli(
          pdf.metin,
          [...ORTAK, "Karşılaştırma raporu", HESAP_BASLIGI, "Senaryo tablosu", "Düşük", "Yüksek", "Grafik", `${govde.tarama.noktaSayisi} nokta.`, kullanici.ad],
          "Senaryo karşılaştırma raporu",
        );
        dogrula(!pdfSadelestir(pdf.metin).includes("Grafik çizilemedi."), "Raporda grafik çizilemedi");
      });

      await adim("karşılaştırma raporu (/karsilastir): kayıt adları ve grafik", async () => {
        await page.goto(`/karsilastir?kayitlar=${kimlik[1]},${kimlik[2]}`);
        await page.getByRole("region", { name: "2 kayıt yan yana", exact: true }).waitFor();
        const dugme = page.getByRole("button", { name: "Karşılaştırma raporu (PDF)", exact: true });
        const { istek, pdf } = await raporIndir(page, dugme, { yontem: "POST", yol: "/api/rapor/karsilastirma" });
        const govde = istek.postDataJSON();
        esitOlmali(govde?.senaryolar?.map((s) => s.ad).join(","), `${KAYIT_1},${KAYIT_2}`, "İstekteki kayıtlar");
        pdfIcermeli(pdf.metin, [...ORTAK, "Karşılaştırma raporu", KAYIT_1, KAYIT_2, "Senaryo tablosu", "Grafik"], "Kayıtlı karşılaştırma raporu");
        dogrula(!pdfSadelestir(pdf.metin).includes("Grafik çizilemedi."), "Raporda grafik çizilemedi");
      });

      await adim("API: sahibi kayıtlı hesap ve proje raporunu alır (200, PDF)", async () => {
        await pdfOlmali(await baglam.request.get(`/api/rapor/hesap/${kimlik[1]}`), "Hesap raporu");
        await pdfOlmali(await baglam.request.get(`/api/rapor/proje/${projeId}`), "Proje raporu");
      });

      await t.adim("API: başka kullanıcı → 404 (kayıt ve proje)", async () => {
        const ikinci = await ikinciKullaniciBaglami(t);
        await hataOlmali(await ikinci.request.get(`/api/rapor/hesap/${kimlik[1]}`), 404, "Kayıt bulunamadı.", "Başkasının kaydı");
        await hataOlmali(await ikinci.request.get(`/api/rapor/proje/${projeId}`), 404, "Proje bulunamadı.", "Başkasının projesi");
      });

      await adim("API: oturumsuz → 401 (kayıt ve proje)", async () => {
        const mesaj = "Bu raporu indirmek için giriş yapmalısınız.";
        await hataOlmali(await anonim.request.get(`/api/rapor/hesap/${kimlik[1]}`), 401, mesaj, "Oturumsuz kayıt raporu");
        await hataOlmali(await anonim.request.get(`/api/rapor/proje/${projeId}`), 401, mesaj, "Oturumsuz proje raporu");
      });

      await adim("API: bozuk gövde → 400, JSON olmayan gövde → 415", async () => {
        const gonder = (yol, govde, tur = "application/json") =>
          anonim.request.post(yol, { headers: { "content-type": tur }, data: Buffer.from(govde, "utf8") });
        await hataOlmali(await gonder("/api/rapor/hesap", "{bozuk"), 400, "İstek gövdesi geçerli JSON değil.", "Bozuk JSON");
        await hataOlmali(
          await gonder("/api/rapor/hesap", JSON.stringify({ hesapSlug: "ohm-yasasi" })),
          400,
          /^Geçersiz istek \(girdiler\)/,
          "Eksik alan",
        );
        await hataOlmali(
          await gonder("/api/rapor/hesap", JSON.stringify({ hesapSlug: "yok-boyle", girdiler: {} })),
          400,
          "Bilinmeyen hesap türü.",
          "Bilinmeyen hesap",
        );
        await hataOlmali(
          await gonder("/api/rapor/karsilastirma", JSON.stringify({ hesapSlug: "ohm-yasasi", senaryolar: [] })),
          400,
          /En az bir senaryo gerekir/,
          "Boş karşılaştırma",
        );
        await hataOlmali(await gonder("/api/rapor/hesap", "hesapSlug=ohm-yasasi", "text/plain"), 415, /JSON olmalıdır/, "Düz metin gövde");
      });

      await adim("temizlik: proje ve kayıtları silinir", async () => {
        await projeyiIcerigiyleSil(page, projeId);
        veri.projeler = [];
        veri.projesizler = [];
      });

      await adim("rapor akışı boyunca konsol hatası yok", async () => {
        konsol.dogrulaHataYok();
      });
    } finally {
      await temizle(t, baglam, veri);
    }
  },
};

export default senaryo;
