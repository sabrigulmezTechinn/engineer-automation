/**
 * Küçük test koşucusu: senaryoları sırayla çalıştırır, her adımı ✓/✗ ve süresiyle yazar, başarısız adımda
 * ekran görüntüsü alır. @playwright/test kullanılmaz.
 *
 * Senaryo modülü (senaryolar/*.mjs) varsayılan olarak şunu dışa aktarır:
 *   { ad, aciklama, adimlarBagimsiz?, async calistir(t) }
 * - Bağımlı senaryoda (varsayılan) ilk başarısız adımdan sonra kalan adımlar atlanır (akışlar için).
 * - `adimlarBagimsiz: true` ise her adım ayrı denetlenir (ör. tüm hesap sayfaları).
 *
 * `t` (senaryoya verilen araçlar):
 *   t.adim(ad, async () => {...}, { sayfa? })  adımı çalıştırır; fonksiyonun dönüş değerini döner
 *   t.atla(neden)                              senaryonun kalanını "atlandı" sayar (ör. henüz yazılmamış akış)
 *   t.yeniBaglam({ mobil?, storageState? })    senaryo sonunda kapatılan tarayıcı bağlamı
 *   t.yeniSayfa(baglam)                        { page, konsol }: konsol hatalarını toplar; ekran görüntüsü bu sayfadan
 *   t.bilgi(metin)                             bilgi satırı
 *   t.paylasilan                               senaryolar arası durum (ör. oturum; bkz. girisliBaglam)
 *   t.browser, t.playwright
 */
import { performance } from "node:perf_hooks";
import {
  ciktiKlasoru,
  DogrulamaHatasi,
  ekranGoruntusu,
  konsolHatalariniTopla,
  KurulumHatasi,
  yeniBaglam,
} from "./yardimcilar.mjs";

class SenaryoDurdu extends Error {}
class SenaryoAtlandi extends Error {}

const renk = process.stdout.isTTY && !process.env.NO_COLOR;
const boya = (kod, metin) => (renk ? `\x1b[${kod}m${metin}\x1b[0m` : metin);
const yesil = (m) => boya(32, m);
const kirmizi = (m) => boya(31, m);
const sari = (m) => boya(33, m);
const soluk = (m) => boya(2, m);

export function sureYaz(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(".", ",")} sn`;
  return `${Math.floor(ms / 60_000)} dk ${Math.round((ms % 60_000) / 1000)} sn`;
}

function hataMetni(hata) {
  if (hata instanceof DogrulamaHatasi || hata instanceof KurulumHatasi) return hata.message;
  // Playwright hataları çok satırlı "Call log" içerir; ilk birkaç satır yeterli.
  return String(hata?.message ?? hata).split("\n").slice(0, 4).join(" ⏎ ");
}

/**
 * Senaryoları çalıştırır. Döner: { sonuclar, durduran } — `durduran` bir KurulumHatasi ise çalıştırma
 * yarıda kesilmiştir.
 */
export async function senaryolariCalistir({ browser, playwright, senaryolar }) {
  const sonuclar = [];
  const paylasilan = {};
  let sira = 0;

  for (const senaryo of senaryolar) {
    console.log(`\n▶ ${senaryo.ad} ${soluk(`— ${senaryo.aciklama}`)}`);
    const baglamlar = [];
    let sonSayfa = null;

    const kaydet = (adim, durum, sure, ek = {}) => {
      const kayit = { senaryo: senaryo.ad, adim, durum, sureMs: Math.round(sure), ...ek };
      sonuclar.push(kayit);
      return kayit;
    };

    const t = {
      browser,
      playwright,
      paylasilan,
      bilgi(metin) {
        console.log(soluk(`  · ${metin}`));
      },
      atla(neden) {
        throw new SenaryoAtlandi(neden);
      },
      async yeniBaglam(secenekler) {
        const baglam = await yeniBaglam(browser, playwright, secenekler);
        baglamlar.push(baglam);
        return baglam;
      },
      async yeniSayfa(baglam) {
        const page = await baglam.newPage();
        sonSayfa = page;
        return { page, konsol: konsolHatalariniTopla(page) };
      },
      async adim(ad, fn, { sayfa } = {}) {
        sira += 1;
        const bas = performance.now();
        try {
          const sonuc = await fn();
          const sure = performance.now() - bas;
          console.log(`  ${yesil("✓")} ${ad} ${soluk(`(${sureYaz(sure)})`)}`);
          kaydet(ad, "gecti", sure);
          return sonuc;
        } catch (hata) {
          const sure = performance.now() - bas;
          const hedefSayfa = sayfa ?? sonSayfa;
          const ekran = await ekranGoruntusu(hedefSayfa, `${String(sira).padStart(3, "0")}-${senaryo.ad}-${ad}`);
          console.log(`  ${kirmizi("✗")} ${ad} ${soluk(`(${sureYaz(sure)})`)}`);
          console.log(`      ${kirmizi(hataMetni(hata))}`);
          if (hedefSayfa && !hedefSayfa.isClosed()) console.log(soluk(`      adres: ${hedefSayfa.url()}`));
          if (ekran) console.log(soluk(`      ekran görüntüsü: ${ekran}`));
          kaydet(ad, "kaldi", sure, { hata: hataMetni(hata), ekran, adres: hedefSayfa?.isClosed() ? undefined : hedefSayfa?.url() });
          if (hata instanceof KurulumHatasi) throw hata;
          if (!senaryo.adimlarBagimsiz) throw new SenaryoDurdu();
          return undefined;
        }
      },
    };

    try {
      await senaryo.calistir(t);
    } catch (hata) {
      if (hata instanceof SenaryoDurdu) {
        console.log(sari("  – önceki adım başarısız olduğu için senaryonun kalan adımları atlandı"));
        kaydet("(kalan adımlar)", "atlandi", 0, { neden: "önceki adım başarısız" });
      } else if (hata instanceof SenaryoAtlandi) {
        console.log(`  ${sari("–")} atlandı: ${hata.message}`);
        kaydet("(senaryo)", "atlandi", 0, { neden: hata.message });
      } else if (hata instanceof KurulumHatasi) {
        for (const b of baglamlar) await b.close().catch(() => {});
        return { sonuclar, durduran: hata };
      } else {
        // Adım dışında kalan kodda beklenmeyen hata
        const ekran = await ekranGoruntusu(sonSayfa, `${String(++sira).padStart(3, "0")}-${senaryo.ad}-senaryo-hatasi`);
        console.log(`  ${kirmizi("✗")} senaryo hatası: ${kirmizi(hataMetni(hata))}`);
        if (ekran) console.log(soluk(`      ekran görüntüsü: ${ekran}`));
        kaydet("(senaryo hatası)", "kaldi", 0, { hata: hataMetni(hata), ekran });
      }
    } finally {
      for (const b of baglamlar) await b.close().catch(() => {});
    }
  }
  return { sonuclar, durduran: null };
}

/** Sonuç özetini yazar; başarısız adım varsa false döner. */
export function ozetYaz(sonuclar, { sureMs, durduran }) {
  const say = (durum) => sonuclar.filter((s) => s.durum === durum).length;
  const gecti = say("gecti");
  const kaldi = say("kaldi");
  const atlandi = say("atlandi");
  const adimSayisi = gecti + kaldi;

  console.log(`\n${"─".repeat(72)}`);
  const parcalar = [yesil(`${gecti} geçti`), kaldi ? kirmizi(`${kaldi} kaldı`) : `${kaldi} kaldı`];
  if (atlandi) parcalar.push(sari(`${atlandi} atlandı`));
  console.log(`Özet: ${adimSayisi} adım — ${parcalar.join(", ")} (${sureYaz(sureMs)})`);

  const kalanlar = sonuclar.filter((s) => s.durum === "kaldi");
  if (kalanlar.length) {
    console.log("\nBaşarısız adımlar:");
    for (const s of kalanlar) {
      console.log(`  ${kirmizi("✗")} ${s.senaryo} › ${s.adim}: ${s.hata}`);
      if (s.ekran) console.log(soluk(`      ${s.ekran}`));
    }
  }
  const atlananlar = sonuclar.filter((s) => s.durum === "atlandi");
  if (atlananlar.length) {
    console.log("\nAtlananlar:");
    for (const s of atlananlar) console.log(`  ${sari("–")} ${s.senaryo}: ${s.neden}`);
  }
  if (durduran) console.log(`\n${kirmizi("Çalıştırma durduruldu:")} ${durduran.message}`);
  console.log(`\nÇıktı klasörü: ${ciktiKlasoru()}`);
  return kaldi === 0 && !durduran;
}
