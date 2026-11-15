/**
 * Bir hesabın etkileşimi: Ohm yasası (1.1). 12 V ve 2,2 kΩ → I = 12 / 2200 = 5,4545… mA, P = 12² / 2200 = 65,45… mW
 * (varsayılan 4 anlamlı basamak). Geçersiz girdi alan hatası verir.
 */
import { agDurulsun, bekleKadar, dogrula, esitOlmali, hidrasyonBekle, metinOlmali, sadelestir } from "../yardimcilar.mjs";

/** Hesap sayfasının bölümleri: girdi formu ve sonuç bölgesi. */
export function hesapBolumleri(page) {
  const hesaplama = page.getByRole("region", { name: "Hesaplama", exact: true });
  return {
    // Birim seçicileri ("Direnç birimi") hem girdide hem çıktı kartında var: girdiler formla sınırlanır.
    girdiler: hesaplama.locator("form"),
    sonuc: hesaplama.getByRole("region", { name: "Sonuç", exact: true }).first(),
  };
}

/** Çıktı kartının değeri ve gösterilen birimi (birim seçiciyse seçili seçeneğin metni). */
export async function kartOku(sonuc, anahtar) {
  const kart = sonuc.locator(`li[data-output="${anahtar}"]`);
  const deger = sadelestir(await kart.locator("data").textContent({ timeout: 1_000 }));
  const secici = kart.getByRole("combobox");
  const birim = (await secici.count())
    ? sadelestir(await secici.evaluate((el) => el.selectedOptions[0]?.textContent ?? ""))
    : sadelestir(await kart.locator("data + span").textContent());
  return { deger, birim, metin: `${deger} ${birim}` };
}

/** Kart değeri + birimi beklenene gelene kadar bekler (ör. "5,455 mA"). */
export async function kartOlmali(sonuc, anahtar, beklenen) {
  let son;
  await bekleKadar(
    async () => {
      son = (await kartOku(sonuc, anahtar)).metin;
      return son === beklenen;
    },
    { mesaj: () => `"${anahtar}" kartı: beklenen ${JSON.stringify(beklenen)}, gelen ${JSON.stringify(son)}` },
  );
}

/** Ohm yasası sayfasını açar (hidrasyonu bekler) ve 12 V + 2,2 kΩ girer. */
export async function ohm12VIle22kOhm(page) {
  const yanit = await page.goto("/hesaplar/ohm-yasasi");
  esitOlmali(yanit?.status(), 200, "HTTP durumu");
  const { girdiler, sonuc } = hesapBolumleri(page);
  const gerilim = girdiler.getByRole("textbox", { name: "Gerilim", exact: true });
  await hidrasyonBekle(gerilim);
  await agDurulsun(page);

  await girdiler.getByRole("combobox", { name: "Bilinen büyüklükler", exact: true }).selectOption("V-R");
  await gerilim.fill("12");
  await girdiler.getByRole("combobox", { name: "Gerilim birimi", exact: true }).selectOption({ label: "V" });
  await girdiler.getByRole("textbox", { name: "Direnç", exact: true }).fill("2,2");
  await girdiler.getByRole("combobox", { name: "Direnç birimi", exact: true }).selectOption({ label: "kΩ" });
  return { girdiler, sonuc, gerilim };
}

const senaryo = {
  ad: "ohm-yasasi",
  aciklama: "Ohm yasası: 12 V + 2,2 kΩ sonuçları, ara adım ve geçersiz girdi",

  async calistir(t) {
    const baglam = await t.yeniBaglam();
    const { page, konsol } = await t.yeniSayfa(baglam);
    let bolum;

    await t.adim("12 V ve 2,2 kΩ girilir", async () => {
      bolum = await ohm12VIle22kOhm(page);
    });

    await t.adim("kartlarda I = 5,455 mA ve P = 65,45 mW", async () => {
      await kartOlmali(bolum.sonuc, "I", "5,455 mA");
      await kartOlmali(bolum.sonuc, "P", "65,45 mW");
    });

    await t.adim("ara adımda akım mA ile yazılır", async () => {
      const akimAdimi = bolum.sonuc.locator("ol > li").filter({ hasText: "Akım" }).first();
      // .katex-html görünen gösterimdir (MathML/TeX kaynağı ayrı tutulur).
      await metinOlmali(akimAdimi.locator(".katex-html").first(), /5,455\s*mA/, { ne: "Akım adımı" });
    });

    await t.adim('"abc" girilince "Geçerli bir sayı girin" gösterilir', async () => {
      await bolum.gerilim.fill("abc");
      await bekleKadar(async () => (await bolum.gerilim.getAttribute("aria-invalid")) === "true", {
        mesaj: "Gerilim alanı geçersiz işaretlenmedi",
      });
      const aciklamaKimligi = await bolum.gerilim.getAttribute("aria-describedby");
      dogrula(aciklamaKimligi, "Gerilim alanında aria-describedby yok");
      const aciklama = sadelestir(
        await page.evaluate(
          (kimlikler) => kimlikler.split(" ").map((k) => document.getElementById(k)?.textContent ?? "").join(" "),
          aciklamaKimligi,
        ),
      );
      dogrula(aciklama.includes("Geçerli bir sayı girin"), `Alan açıklaması: ${JSON.stringify(aciklama)}`);
      await metinOlmali(bolum.sonuc, /Sonuç hesaplanamadı/, { ne: "Sonuç bölgesi" });
    });

    await t.adim("etkileşim boyunca konsol hatası yok", async () => {
      konsol.dogrulaHataYok();
    });
  },
};

export default senaryo;
