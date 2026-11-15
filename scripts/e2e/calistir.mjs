#!/usr/bin/env node
/**
 * Uçtan uca (e2e) testleri çalıştırır. Kullanım: docs/E2E.md
 *
 *   node scripts/e2e/calistir.mjs [--sunucu] [--senaryo=ad1,ad2] [--listele]
 *
 * Varsayılan olarak ÇALIŞAN bir sunucuya (E2E_BASE_URL, varsayılan http://localhost:3100) karşı koşar.
 * --sunucu: derlenmiş uygulamayı (`next start`) alt süreç olarak başlatır ve sonunda durdurur; derleme yapmaz.
 * Çıkış kodu: tüm adımlar geçtiyse 0, aksi halde 1.
 */
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { ozetYaz, senaryolariCalistir, sureYaz } from "./kosucu.mjs";
import { SENARYOLAR } from "./senaryolar/index.mjs";
import { AYARLAR, ciktiKlasoru, KurulumHatasi, playwrightYukle, PROJE_KOKU, raporYaz, uyu } from "./yardimcilar.mjs";

const YARDIM = `Kullanım: node scripts/e2e/calistir.mjs [seçenekler]

Seçenekler:
  --sunucu            Derlenmiş uygulamayı (next start) E2E_BASE_URL'in portunda başlatır, sonunda durdurur.
                      Önce derleme gerekir: npx next build
  --senaryo=a,b       Yalnızca adı verilen senaryoları çalıştırır (--listele ile adlar)
  --listele           Senaryoları listeler
  -h, --yardim        Bu metin

Ortam değişkenleri:
  E2E_BASE_URL        Sunucu adresi (varsayılan http://localhost:3100); sunucunun BETTER_AUTH_URL'i ile aynı olmalı
  E2E_MAIL_DIR        Sunucunun geliştirme e-postalarını yazdığı klasör (varsayılan <proje kökü>/.dev-mail)
  E2E_CIKTI           Ekran görüntüleri ve rapor klasörü (varsayılan: geçici dizinde benzersiz bir klasör)`;

function argumanlariOku(argv) {
  const secenekler = { sunucu: false, senaryolar: null, listele: false, yardim: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--sunucu") secenekler.sunucu = true;
    else if (arg === "--listele") secenekler.listele = true;
    else if (arg === "-h" || arg === "--yardim" || arg === "--help") secenekler.yardim = true;
    else if (arg === "--senaryo") secenekler.senaryolar = (argv[++i] ?? "").split(",");
    else if (arg.startsWith("--senaryo=")) secenekler.senaryolar = arg.slice("--senaryo=".length).split(",");
    else throw new KurulumHatasi(`Bilinmeyen seçenek: ${arg}\n\n${YARDIM}`);
  }
  if (secenekler.senaryolar) secenekler.senaryolar = secenekler.senaryolar.map((s) => s.trim()).filter(Boolean);
  return secenekler;
}

/** Sunucu herhangi bir HTTP yanıtı veriyor mu? */
async function ulasilabilir(adres, zamanAsimi = 3_000) {
  try {
    await fetch(adres, { redirect: "manual", signal: AbortSignal.timeout(zamanAsimi) });
    return true;
  } catch {
    return false;
  }
}

/** `next start`'ı alt süreç olarak başlatır; hazır olunca { durdur } döner. */
async function sunucuBaslat() {
  const url = new URL(AYARLAR.tabanUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new KurulumHatasi(`--sunucu yalnızca yerel bir E2E_BASE_URL ile kullanılabilir (verilen: ${AYARLAR.tabanUrl}).`);
  }
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (await ulasilabilir(AYARLAR.tabanUrl)) {
    throw new KurulumHatasi(`${AYARLAR.tabanUrl} zaten yanıt veriyor. --sunucu olmadan çalıştırın ya da E2E_BASE_URL ile boş bir port seçin.`);
  }
  if (!existsSync(path.join(PROJE_KOKU, ".next", "BUILD_ID"))) {
    throw new KurulumHatasi(`Derlenmiş uygulama yok (${path.join(PROJE_KOKU, ".next")}). Önce derleyin: npx next build`);
  }
  const nextBin = path.join(PROJE_KOKU, "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(nextBin)) throw new KurulumHatasi(`Next.js bulunamadı: ${nextBin}`);

  const gunlukYolu = path.join(ciktiKlasoru(), "sunucu.log");
  const gunluk = createWriteStream(gunlukYolu);
  // Ortam değişkenleri .env.local'dan önceliklidir: e-posta bağlantıları ve klasörü bu çalıştırmayla uyuşsun.
  const env = { ...process.env, BETTER_AUTH_URL: AYARLAR.tabanUrl, DEV_MAIL_DIR: AYARLAR.epostaKlasoru };
  console.log(`Sunucu başlatılıyor: next start -p ${port} (günlük: ${gunlukYolu})`);
  console.log(`  BETTER_AUTH_URL=${env.BETTER_AUTH_URL} DEV_MAIL_DIR=${env.DEV_MAIL_DIR}`);
  const cocuk = spawn(process.execPath, [nextBin, "start", "-p", port], {
    cwd: PROJE_KOKU,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // kendi süreç grubu: durdururken next'in alt süreçleri de kapansın
  });
  cocuk.stdout.pipe(gunluk);
  cocuk.stderr.pipe(gunluk);
  let cikti = null;
  cocuk.on("exit", (kod, sinyal) => {
    cikti = { kod, sinyal };
  });

  const durdur = async () => {
    if (cikti) return;
    try {
      process.kill(-cocuk.pid, "SIGTERM");
    } catch {
      return;
    }
    for (let i = 0; i < 50 && !cikti; i++) await uyu(100);
    if (!cikti) {
      try {
        process.kill(-cocuk.pid, "SIGKILL");
      } catch {
        /* zaten kapandı */
      }
    }
  };

  const bitis = Date.now() + 60_000;
  while (!(await ulasilabilir(AYARLAR.tabanUrl, 1_000))) {
    if (cikti) throw new KurulumHatasi(`Sunucu hemen kapandı (kod ${cikti.kod}). Günlük: ${gunlukYolu}`);
    if (Date.now() > bitis) {
      await durdur();
      throw new KurulumHatasi(`Sunucu 60 sn içinde yanıt vermedi. Günlük: ${gunlukYolu}`);
    }
    await uyu(300);
  }
  return { durdur };
}

async function ana() {
  const secenekler = argumanlariOku(process.argv.slice(2));
  if (secenekler.yardim) {
    console.log(YARDIM);
    return 0;
  }
  if (secenekler.listele) {
    for (const s of SENARYOLAR) console.log(`${s.ad.padEnd(20)} ${s.aciklama}`);
    return 0;
  }

  let secilen = SENARYOLAR;
  if (secenekler.senaryolar) {
    const bilinmeyen = secenekler.senaryolar.filter((ad) => !SENARYOLAR.some((s) => s.ad === ad));
    if (bilinmeyen.length) {
      throw new KurulumHatasi(`Bilinmeyen senaryo: ${bilinmeyen.join(", ")}. Mevcut: ${SENARYOLAR.map((s) => s.ad).join(", ")}`);
    }
    secilen = SENARYOLAR.filter((s) => secenekler.senaryolar.includes(s.ad));
  }

  console.log("Uçtan uca testler");
  console.log(`  Sunucu        : ${AYARLAR.tabanUrl}`);
  console.log(`  E-posta klasörü: ${AYARLAR.epostaKlasoru}`);
  console.log(`  Çıktı klasörü : ${ciktiKlasoru()}`);

  const playwright = playwrightYukle();
  let sunucu = null;
  let browser = null;
  const temizle = async () => {
    await browser?.close().catch(() => {});
    await sunucu?.durdur();
  };
  const kesildi = async () => {
    await temizle();
    process.exit(130);
  };
  process.once("SIGINT", kesildi);
  process.once("SIGTERM", kesildi);

  const bas = performance.now();
  try {
    if (secenekler.sunucu) sunucu = await sunucuBaslat();
    else if (!(await ulasilabilir(AYARLAR.tabanUrl, 5_000))) {
      throw new KurulumHatasi(
        `Sunucuya ulaşılamadı: ${AYARLAR.tabanUrl}. Önce başlatın (npx next build && npx next start -p <port>), ` +
          "E2E_BASE_URL'i ayarlayın ya da --sunucu ile çalıştırın.",
      );
    }

    // LANG tanımsızsa Chromium Türkçe karakterli indirme adlarını "download" yapar; UTF-8 yerel ayarı ver.
    browser = await playwright.chromium.launch({ env: { ...process.env, LANG: process.env.LANG || "C.UTF-8" } });
    const { sonuclar, durduran } = await senaryolariCalistir({ browser, playwright, senaryolar: secilen });
    const sureMs = performance.now() - bas;
    const basarili = ozetYaz(sonuclar, { sureMs, durduran });
    const raporYolu = await raporYaz({
      tabanUrl: AYARLAR.tabanUrl,
      tarih: new Date().toISOString(),
      sure: sureYaz(sureMs),
      basarili,
      durduran: durduran?.message ?? null,
      sonuclar,
    });
    console.log(`Rapor: ${raporYolu}`);
    return basarili ? 0 : 1;
  } finally {
    await temizle();
  }
}

ana().then(
  (kod) => process.exit(kod),
  (hata) => {
    if (hata instanceof KurulumHatasi) console.error(`\nHata: ${hata.message}`);
    else console.error(hata);
    process.exit(1);
  },
);
