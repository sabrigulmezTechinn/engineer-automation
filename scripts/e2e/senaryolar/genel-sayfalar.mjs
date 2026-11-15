/**
 * Genel sayfalar: ana sayfa, hesap listesi, standartlar; bilinmeyen hesap adresi gerçek 404;
 * korumalı sayfa (/profil) oturumsuz istekte 307 ile girişe yönlendirir.
 */
import { adresOlmali, agDurulsun, AYARLAR, dogrula, esitOlmali, gorunur, yolVeSorgu } from "../yardimcilar.mjs";

/** 404 sayfasında tarayıcının yazdığı kaynak hatası beklenen bir durumdur. */
const KAYNAK_404 = /Failed to load resource: the server responded with a status of 404/;

const senaryo = {
  ad: "genel-sayfalar",
  aciklama: "Genel sayfalar 200, bilinmeyen hesap 404, /profil oturumsuz → giriş",
  adimlarBagimsiz: true,

  async calistir(t) {
    const baglam = await t.yeniBaglam();

    for (const [yol, baslik] of [
      ["/", null],
      ["/hesaplar", "Hesaplar"],
      ["/standartlar", null],
    ]) {
      await t.adim(`${yol} 200 döner, konsol hatası yok`, async () => {
        const { page, konsol } = await t.yeniSayfa(baglam);
        const yanit = await page.goto(yol);
        esitOlmali(yanit?.status(), 200, "HTTP durumu");
        await page.getByRole("heading", { level: 1, ...(baslik ? { name: baslik, exact: true } : {}) }).first().waitFor();
        await agDurulsun(page);
        konsol.dogrulaHataYok();
        await page.close();
      });
    }

    await t.adim("/hesaplar/yok-boyle gerçek 404 döner", async () => {
      const { page, konsol } = await t.yeniSayfa(baglam);
      const yanit = await page.goto("/hesaplar/yok-boyle");
      esitOlmali(yanit?.status(), 404, "HTTP durumu");
      await gorunur(page.getByRole("heading", { name: "Sayfa bulunamadı" })).waitFor();
      await agDurulsun(page);
      konsol.dogrulaHataYok({ yoksay: [KAYNAK_404] });
      await page.close();
    });

    await t.adim("/profil oturumsuz → 307 /giris?yonlendir=/profil", async () => {
      const yanit = await baglam.request.get("/profil", { maxRedirects: 0 });
      esitOlmali(yanit.status(), 307, "HTTP durumu");
      const konum = yanit.headers()["location"];
      dogrula(konum, "Location başlığı yok");
      esitOlmali(yolVeSorgu(new URL(konum, AYARLAR.tabanUrl).href), "/giris?yonlendir=/profil", "Yönlendirme hedefi");

      const { page, konsol } = await t.yeniSayfa(baglam);
      await page.goto("/profil");
      await adresOlmali(page, "/giris?yonlendir=/profil");
      await page.getByRole("button", { name: "Giriş yap", exact: true }).waitFor();
      await agDurulsun(page);
      konsol.dogrulaHataYok();
      await page.close();
    });
  },
};

export default senaryo;
