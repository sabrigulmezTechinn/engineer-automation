/**
 * Kimlik doğrulama akışı (tek kullanıcı, tek kayıt): kayıt → .dev-mail doğrulama bağlantısı → doğrulanmamış giriş
 * reddi → doğrulama ve otomatik giriş → profil güncelleme → çıkış → korumalı sayfadan girişe ve geri dönüş →
 * şifremi unuttum → sıfırlama → yeni şifreyle giriş.
 *
 * Oran sınırları (üretim): bu akış 1 kayıt, aynı e-postayla 4 giriş denemesi ve 1 sıfırlama e-postası kullanır.
 * Son girişin oturumu `t.paylasilan.oturum`a yazılır; sonraki senaryolar girisliBaglam ile bunu kullanır.
 */
import {
  adresOlmali,
  agDurulsun,
  baglantiKokunuDogrula,
  basliktaAdOlmali,
  bekleKadar,
  dogrula,
  epostaBekle,
  esitOlmali,
  girisFormunuGonder,
  girisYap,
  gorunur,
  hidrasyonBekle,
  kayitFormunuGonder,
  kayitHakkiAl,
  yeniKullaniciBilgileri,
} from "../yardimcilar.mjs";
import { kartOlmali, ohm12VIle22kOhm } from "./ohm-yasasi.mjs";

/** Başlıktaki "Çıkış yap" düğmesiyle çıkar; ana sayfaya dönüp ziyaretçi menüsünü bekler. */
async function cikisYap(page) {
  const menu = page.getByRole("navigation", { name: "Hesap" });
  const dugme = menu.getByRole("button", { name: "Çıkış yap", exact: true });
  await hidrasyonBekle(dugme);
  await dugme.click();
  await adresOlmali(page, "/");
  await menu.getByRole("link", { name: "Giriş yap", exact: true }).waitFor();
}

const senaryo = {
  ad: "kimlik-dogrulama",
  aciklama: "Kayıt, e-posta doğrulama, profil, çıkış/giriş, şifre sıfırlama",

  async calistir(t) {
    const k = yeniKullaniciBilgileri();
    const yeniAd = "E2E Güncel";
    const yeniSifre = "E2e-Yeni-Sifre-2026!";
    const baglam = await t.yeniBaglam();
    const { page, konsol } = await t.yeniSayfa(baglam);
    let kayitBaslangici;
    let dogrulamaBaglantisi;
    let sifirlamaBaglantisi;
    t.bilgi(`kullanıcı: ${k.email}`);

    await t.adim("kayıt: alan hatasında girilen değerler korunur", async () => {
      await page.goto("/kayit");
      const durum = await kayitFormunuGonder(page, k, { sifreTekrar: `${k.sifre}-farkli` });
      esitOlmali(durum, "alan-hatasi", "Kayıt sonucu");
      await gorunur(page.getByText("Şifreler eşleşmiyor.", { exact: true })).waitFor();
      for (const [etiket, beklenen] of [
        ["Ad soyad", k.ad],
        ["E-posta", k.email],
        ["Şirket", k.sirket],
        ["Unvan", k.unvan],
      ]) {
        esitOlmali(await page.getByRole("textbox", { name: etiket }).inputValue(), beklenen, `"${etiket}" alanı`);
      }
    });

    await t.adim("kayıt başarılı: doğrulama e-postası istenir", async () => {
      kayitHakkiAl();
      kayitBaslangici = Date.now();
      const durum = await kayitFormunuGonder(page, k);
      esitOlmali(durum, "basarili", "Kayıt sonucu");
      await gorunur(page.getByText(k.email, { exact: true })).waitFor();
    });

    await t.adim(".dev-mail'de doğrulama bağlantısı, kökü E2E_BASE_URL", async () => {
      const posta = await epostaBekle({ alici: k.email, sonra: kayitBaslangici, yolIcerir: "/verify-email" });
      baglantiKokunuDogrula(posta.baglanti);
      dogrulamaBaglantisi = posta.baglanti;
    });

    await t.adim("doğrulanmamış hesapla giriş reddedilir", async () => {
      const sonuc = await girisYap(page, { email: k.email, sifre: k.sifre });
      dogrula(!sonuc.basarili, "Doğrulanmamış hesapla giriş yapıldı");
      dogrula(/henüz doğrulanmadı/.test(sonuc.hata), `Beklenmeyen hata: ${sonuc.hata}`);
      await page.getByRole("button", { name: "Doğrulama e-postasını tekrar gönder" }).waitFor();
    });

    await t.adim("doğrulama bağlantısı hesabı etkinleştirir ve oturum açar", async () => {
      await page.goto(dogrulamaBaglantisi);
      await adresOlmali(page, "/e-posta-dogrulandi");
      await page.getByRole("heading", { name: "E-posta adresiniz doğrulandı" }).waitFor();
      await basliktaAdOlmali(page, k.ad);
    });

    await t.adim("profil güncellenir (anlamlı basamak 3–8 arası, 6 seçilir)", async () => {
      await page.goto("/profil");
      const kaydet = page.getByRole("button", { name: "Kaydet", exact: true });
      await hidrasyonBekle(kaydet);
      const basamak = page.getByRole("combobox", { name: "Anlamlı basamak" });
      const secenekler = (await basamak.locator("option").allTextContents()).map((s) => s.trim());
      esitOlmali(secenekler.join(","), "3,4,5,6,7,8", "Anlamlı basamak seçenekleri");
      esitOlmali(await page.getByRole("textbox", { name: "Ad soyad" }).inputValue(), k.ad, "Profildeki ad");

      await page.getByRole("textbox", { name: "Ad soyad" }).fill(yeniAd);
      await basamak.selectOption("6");
      await kaydet.click();
      await gorunur(page.getByText("Profiliniz kaydedildi.", { exact: true })).waitFor();
      await basliktaAdOlmali(page, yeniAd);
    });

    await t.adim("profil değerleri yeniden yüklemede korunur", async () => {
      await page.reload();
      await hidrasyonBekle(page.getByRole("button", { name: "Kaydet", exact: true }));
      esitOlmali(await page.getByRole("textbox", { name: "Ad soyad" }).inputValue(), yeniAd, "Ad soyad");
      esitOlmali(await page.getByRole("combobox", { name: "Anlamlı basamak" }).inputValue(), "6", "Anlamlı basamak");
      esitOlmali(await page.getByRole("textbox", { name: "Şirket" }).inputValue(), k.sirket, "Şirket");
    });

    await t.adim("anlamlı basamak tercihi hesapta uygulanır (I = 5,45455 mA)", async () => {
      const { sonuc } = await ohm12VIle22kOhm(page);
      // 12 / 2200 A = 5,454545… mA → 6 anlamlı basamak: 5,45455
      await kartOlmali(sonuc, "I", "5,45455 mA");
    });

    await t.adim("çıkış yapılır", async () => {
      await cikisYap(page);
    });

    await t.adim("oturumsuz /profil → /giris?yonlendir=/profil", async () => {
      await page.goto("/profil");
      await adresOlmali(page, "/giris?yonlendir=/profil");
    });

    await t.adim("giriş sonrası /profil'e dönülür", async () => {
      const sonuc = await girisFormunuGonder(page, { email: k.email, sifre: k.sifre });
      dogrula(sonuc.basarili, () => `Giriş başarısız: ${sonuc.hata}`);
      await adresOlmali(page, "/profil");
      await bekleKadar(async () => (await page.getByRole("textbox", { name: "Ad soyad" }).inputValue()) === yeniAd, {
        mesaj: "Profil formu yüklenmedi",
      });
      await basliktaAdOlmali(page, yeniAd);
    });

    await t.adim("şifremi unuttum: sıfırlama e-postası gelir", async () => {
      await cikisYap(page);
      await page.goto("/sifremi-unuttum");
      const gonder = page.getByRole("button", { name: "Sıfırlama bağlantısı gönder" });
      await hidrasyonBekle(gonder);
      await page.getByRole("textbox", { name: "E-posta" }).fill(k.email);
      const baslangic = Date.now();
      await gonder.click();
      await gorunur(page.getByText(/şifre sıfırlama bağlantısı gönderdik/)).waitFor();
      const posta = await epostaBekle({ alici: k.email, sonra: baslangic, yolIcerir: "/reset-password/" });
      baglantiKokunuDogrula(posta.baglanti);
      sifirlamaBaglantisi = posta.baglanti;
    });

    await t.adim("sıfırlama bağlantısıyla yeni şifre belirlenir", async () => {
      await page.goto(sifirlamaBaglantisi);
      await adresOlmali(page, /^\/sifre-sifirla\?token=/);
      const gonder = page.getByRole("button", { name: "Şifremi güncelle" });
      await hidrasyonBekle(gonder);
      await gorunur(page.getByLabel("Yeni şifre", { exact: true })).fill(yeniSifre);
      await gorunur(page.getByLabel("Yeni şifre (tekrar)", { exact: true })).fill(yeniSifre);
      await gonder.click();
      await gorunur(page.getByText(/Şifreniz güncellendi/)).waitFor();
    });

    await t.adim("eski şifre reddedilir", async () => {
      const sonuc = await girisYap(page, { email: k.email, sifre: k.sifre });
      dogrula(!sonuc.basarili, "Eski şifreyle giriş yapıldı");
      esitOlmali(sonuc.hata, "E-posta adresi veya şifre hatalı.", "Hata mesajı");
    });

    await t.adim("yeni şifreyle giriş yapılır", async () => {
      const sonuc = await girisYap(page, { email: k.email, sifre: yeniSifre });
      dogrula(sonuc.basarili, () => `Giriş başarısız: ${sonuc.hata}`);
      await adresOlmali(page, "/");
      await basliktaAdOlmali(page, yeniAd);
      // Sonraki senaryolar bu oturumu paylaşır (bu bağlamda artık çıkış yapılmaz).
      t.paylasilan.kullanici = { ...k, ad: yeniAd, sifre: yeniSifre };
      t.paylasilan.oturum = await baglam.storageState();
    });

    await t.adim("akış boyunca konsol hatası yok", async () => {
      await agDurulsun(page);
      konsol.dogrulaHataYok();
    });
  },
};

export default senaryo;
