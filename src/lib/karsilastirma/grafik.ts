/**
 * Çizgi grafik → bağımsız SVG metni (saf). Web sayfası ve PDF raporu (pdfmake svg düğümü) aynı çıktıyı kullanır.
 * İmza sözleşmedir; gövde Faz 2 işçisi B'nindir.
 *
 * Kurallar: renkler açık değerlerdir (CSS değişkeni yok; PDF'te de çizilsin), viewBox + width/height verilir,
 * metinler Noto Sans/sans-serif, eksen etiketleri birimli; uygun olmayan (uyari/hata) noktalar işaretlenir.
 *
 * Yalnızca sunum öznitelikleri kullanılır (style/class/currentColor yok): pdfmake'in SVG çizicisi (svg-to-pdfkit)
 * ve tarayıcı aynı sonucu verir. Kalın yazı (font-weight) kullanılmaz: svg-to-pdfkit, belgede henüz yüklenmemiş
 * kalın yazı tipini gerçek dosya sisteminde arar ve hata verir. Arka plan beyazdır; koyu temada da metinler
 * okunur. Tüm metinler kaçışlanır.
 */
import { formatNumber } from "@/lib/units";
import type { CheckLevel } from "@/lib/calc/types";
import type { GrafikSecenekleri, TaramaNoktasi, TaramaSerisi } from "./types";

/** Grafik renkleri (açık tema; PDF ile aynı) */
export const GRAFIK_RENKLERI = {
  arkaPlan: "#ffffff",
  metin: "#14171c",
  ikincilMetin: "#5a6370",
  izgara: "#e6e9ee",
  eksen: "#8c95a3",
  seri: "#1d5bbf",
  uyari: "#fab219",
  uyariKenar: "#7a4d00",
  hata: "#d03b3b",
} as const;

/**
 * pdfmake SVG'deki yazı tipini font-family listesinde kayıtlı adla (NotoSans) arar; bulamazsa Roboto'ya düşer
 * ve Roboto tanımlı olmadığı için hata verir. Tarayıcı bu adı tanımaz ve sonraki seçeneklere geçer.
 */
const YAZI_TIPI = "NotoSans, 'Noto Sans', Arial, sans-serif";

/** XML 1.0'da izin verilmeyen denetim karakterleri */
const GECERSIZ_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Metni SVG/XML içeriğine ve özniteliğine güvenle koyar. */
export function xmlKacis(metin: string): string {
  return metin
    .replace(GECERSIZ_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Eksen tikleri

export interface EksenTikleri {
  /** Eksenin çizileceği aralık (tiklerin ilki ve sonu) */
  min: number;
  max: number;
  adim: number;
  tikler: number[];
  /** Tik etiketlerindeki ondalık basamak (adımdan türetilir; tüm etiketler aynı biçimde) */
  ondalik: number;
}

/** En yakın 1, 2, 5 × 10ⁿ "yuvarlak" sayı (Heckbert, Graphics Gems I). */
function yuvarlakAdim(deger: number): number {
  const us = Math.floor(Math.log10(deger));
  const kesir = deger / 10 ** us;
  const yuvarlak = kesir < 1.5 ? 1 : kesir < 3 ? 2 : kesir < 7 ? 5 : 10;
  return yuvarlak * 10 ** us;
}

/**
 * Veri aralığını kapsayan okunaklı tikler: adım 1, 2 veya 5 × 10ⁿ; uçlar adımın katı.
 * Tek değerli (düz) aralık ±%10 (sıfırda ±1) genişletilir; sonlu olmayan girdide 0–1 döner.
 */
export function eksenTikleri(veriMin: number, veriMax: number, hedefSayi = 5): EksenTikleri {
  let lo = Math.min(veriMin, veriMax);
  let hi = Math.max(veriMin, veriMax);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (lo === hi) {
    const pay = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pay;
    hi += pay;
  }
  const hedef = Math.max(2, Math.round(hedefSayi));
  const adim = yuvarlakAdim((hi - lo) / (hedef - 1));
  const ilk = Math.floor(lo / adim + 1e-9);
  const son = Math.ceil(hi / adim - 1e-9);
  const tikler: number[] = [];
  for (let k = ilk; k <= son; k++) {
    const t = Number((k * adim).toPrecision(12));
    tikler.push(t === 0 ? 0 : t);
  }
  const ondalik = Math.max(0, -Math.floor(Math.log10(adim) + 1e-9));
  return { min: tikler[0], max: tikler[tikler.length - 1], adim, tikler, ondalik };
}

/** Tik etiketi: adımın ondalık sayısıyla (çok küçük adımlarda 3 anlamlı basamak). */
export function tikEtiketi(deger: number, ondalik: number): string {
  return ondalik <= 4 ? formatNumber(deger, { decimals: ondalik }) : formatNumber(deger, { significant: 3 });
}

// ---------------------------------------------------------------------------
// SVG

/** Koordinat metni: iki ondalık yeter, gereksiz sıfırlar atılır. */
function k(n: number): string {
  const v = Math.round(n * 100) / 100;
  return String(v === 0 ? 0 : v);
}

/** Yaklaşık metin genişliği (Noto Sans ortalama karakter genişliği ≈ 0,58 em) */
function metinGenisligi(metin: string, punto: number): number {
  return metin.length * punto * 0.58;
}

function eksenEtiketi(etiket: string, birimSembolu: string): string {
  return birimSembolu ? `${etiket} (${birimSembolu})` : etiket;
}

function birimli(deger: string, birimSembolu: string): string {
  return birimSembolu ? `${deger} ${birimSembolu}` : deger;
}

const SEVIYE_ADI: Record<CheckLevel, string> = { ok: "uygun", uyari: "uyarı", hata: "hata" };

/** Nokta işareti. Seviye rengin yanında şekille de ayrılır: normal daire, uyarı üçgen, hata kare. */
function isaret(x: number, y: number, tur: "normal" | "uyari" | "hata", ipucu?: string): string {
  const baslik = ipucu ? `<title>${xmlKacis(ipucu)}</title>` : "";
  const R = GRAFIK_RENKLERI;
  if (tur === "uyari") {
    const r = 6;
    const noktalar = `${k(x)},${k(y - r)} ${k(x + r * 0.95)},${k(y + r * 0.65)} ${k(x - r * 0.95)},${k(y + r * 0.65)}`;
    return `<polygon points="${noktalar}" fill="${R.uyari}" stroke="${R.uyariKenar}" stroke-width="1.2" stroke-linejoin="round">${baslik}</polygon>`;
  }
  if (tur === "hata") {
    const r = 4.5;
    return `<rect x="${k(x - r)}" y="${k(y - r)}" width="${k(2 * r)}" height="${k(2 * r)}" fill="${R.hata}" stroke="${R.arkaPlan}" stroke-width="1.5">${baslik}</rect>`;
  }
  return `<circle cx="${k(x)}" cy="${k(y)}" r="3.5" fill="${R.seri}" stroke="${R.arkaPlan}" stroke-width="1.5">${baslik}</circle>`;
}

function metin(
  x: number,
  y: number,
  icerik: string,
  ozellikler: { punto?: number; renk?: string; hiza?: "start" | "middle" | "end"; ek?: string } = {},
): string {
  const { punto = 11, renk = GRAFIK_RENKLERI.ikincilMetin, hiza = "start", ek = "" } = ozellikler;
  return `<text x="${k(x)}" y="${k(y)}" font-size="${punto}" fill="${renk}" text-anchor="${hiza}"${ek}>${xmlKacis(icerik)}</text>`;
}

/** Ardışık hesaplanmış noktalardan çizgi yolu; y = null olan noktada çizgi kırılır. */
function cizgiYolu(noktalar: TaramaNoktasi[], sx: (x: number) => number, sy: (y: number) => number): string {
  let d = "";
  let acik = false;
  for (const p of noktalar) {
    if (p.y === null) {
      acik = false;
      continue;
    }
    d += `${acik ? "L" : "M"}${k(sx(p.x))} ${k(sy(p.y))} `;
    acik = true;
  }
  return d.trim();
}

/**
 * Tarama serisini bağımsız bir SVG çizgi grafiğine çevirir: eksenler, okunaklı tikler (ondalık virgül),
 * birimli eksen etiketleri, çizgi + noktalar; uyarı (sarı üçgen) ve hata (kırmızı kare) noktaları işaretlenir.
 * `role="img"` ve `<title>` erişilebilir ad verir; `<desc>` kısa bir özet içerir.
 */
export function cizgiGrafikSvg(seri: TaramaSerisi, secenekler?: GrafikSecenekleri): string {
  const R = GRAFIK_RENKLERI;
  const W = Math.max(240, secenekler?.genislik ?? 640);
  const H = Math.max(160, secenekler?.yukseklik ?? 320);
  const baslik = secenekler?.baslik?.trim() ?? "";
  const xEtiket = eksenEtiketi(seri.xEtiket, seri.xBirimSembolu);
  const yEtiket = eksenEtiketi(seri.yEtiket, seri.yBirimSembolu);
  const erisilebilirAd = baslik || `${seri.yEtiket} – ${seri.xEtiket}`;

  const noktalar = seri.noktalar.filter((p) => Number.isFinite(p.x) && (p.y === null || Number.isFinite(p.y)));
  const hesaplanan = noktalar.filter((p): p is TaramaNoktasi & { y: number } => p.y !== null);
  const xs = noktalar.map((p) => p.x);
  const ys = hesaplanan.map((p) => p.y);
  const xT = xs.length > 0 ? eksenTikleri(Math.min(...xs), Math.max(...xs), 6) : eksenTikleri(0, 1, 6);
  const yT = ys.length > 0 ? eksenTikleri(Math.min(...ys), Math.max(...ys), 5) : eksenTikleri(0, 1, 5);
  const xTikMetni = xT.tikler.map((t) => tikEtiketi(t, xT.ondalik));
  const yTikMetni = yT.tikler.map((t) => tikEtiketi(t, yT.ondalik));

  const uyariSayisi = hesaplanan.filter((p) => p.seviye === "uyari").length;
  const hataSayisi = hesaplanan.filter((p) => p.seviye === "hata").length;

  // Yerleşim
  const tikPunto = 11;
  const ustBaslik = baslik ? 22 : 0;
  const lejantY = 8 + ustBaslik + 10;
  const sol = Math.max(44, 22 + Math.max(...yTikMetni.map((t) => metinGenisligi(t, tikPunto))) + 10);
  const sag = 12 + metinGenisligi(xTikMetni[xTikMetni.length - 1] ?? "", tikPunto) / 2;
  const ust = lejantY + 16;
  const alt = 46;
  const px0 = sol;
  const px1 = W - sag;
  const py0 = ust;
  const py1 = H - alt;
  const sx = (x: number) => px0 + ((x - xT.min) / (xT.max - xT.min)) * (px1 - px0);
  const sy = (y: number) => py1 - ((y - yT.min) / (yT.max - yT.min)) * (py1 - py0);

  const parcalar: string[] = [];
  parcalar.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${R.arkaPlan}"/>`);
  if (baslik) parcalar.push(metin(px0, 8 + 13, baslik, { punto: 13, renk: R.metin }));

  // Izgara ve y tikleri
  for (const [i, t] of yT.tikler.entries()) {
    const y = sy(t);
    parcalar.push(`<line x1="${k(px0)}" y1="${k(y)}" x2="${k(px1)}" y2="${k(y)}" stroke="${R.izgara}" stroke-width="1"/>`);
    parcalar.push(metin(px0 - 6, y + 4, yTikMetni[i], { punto: tikPunto, hiza: "end" }));
  }
  // x tikleri
  for (const [i, t] of xT.tikler.entries()) {
    const x = sx(t);
    parcalar.push(`<line x1="${k(x)}" y1="${k(py1)}" x2="${k(x)}" y2="${k(py1 + 4)}" stroke="${R.eksen}" stroke-width="1"/>`);
    parcalar.push(metin(x, py1 + 17, xTikMetni[i], { punto: tikPunto, hiza: "middle" }));
  }
  // Eksenler
  parcalar.push(`<line x1="${k(px0)}" y1="${k(py0)}" x2="${k(px0)}" y2="${k(py1)}" stroke="${R.eksen}" stroke-width="1"/>`);
  parcalar.push(`<line x1="${k(px0)}" y1="${k(py1)}" x2="${k(px1)}" y2="${k(py1)}" stroke="${R.eksen}" stroke-width="1"/>`);
  // Eksen etiketleri
  parcalar.push(metin((px0 + px1) / 2, H - 9, xEtiket, { punto: 12, renk: R.metin, hiza: "middle" }));
  const yEtiketX = 14;
  const yEtiketY = (py0 + py1) / 2;
  parcalar.push(
    metin(yEtiketX, yEtiketY, yEtiket, {
      punto: 12,
      renk: R.metin,
      hiza: "middle",
      ek: ` transform="rotate(-90 ${k(yEtiketX)} ${k(yEtiketY)})"`,
    }),
  );

  // Seri
  const d = cizgiYolu(noktalar, sx, sy);
  if (d) {
    parcalar.push(
      `<path d="${d}" fill="none" stroke="${R.seri}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    );
  }
  const azNokta = hesaplanan.length <= 50;
  for (const [i, p] of noktalar.entries()) {
    if (p.y === null) continue;
    const yalniz = (noktalar[i - 1]?.y ?? null) === null && (noktalar[i + 1]?.y ?? null) === null;
    const tur = p.seviye === "hata" ? "hata" : p.seviye === "uyari" ? "uyari" : "normal";
    if (tur === "normal" && !azNokta && !yalniz) continue;
    const ipucu =
      `${seri.xEtiket} = ${birimli(formatNumber(p.x), seri.xBirimSembolu)}; ` +
      `${seri.yEtiket} = ${birimli(formatNumber(p.y), seri.yBirimSembolu)}` +
      (p.seviye && p.seviye !== "ok" ? ` (${SEVIYE_ADI[p.seviye]})` : "");
    parcalar.push(isaret(sx(p.x), sy(p.y), tur, ipucu));
  }

  if (hesaplanan.length === 0) {
    parcalar.push(
      metin((px0 + px1) / 2, (py0 + py1) / 2, "Bu aralıkta hesaplanabilen değer yok", { punto: 12, hiza: "middle" }),
    );
  }

  // Lejant: seri + (varsa) uyarı ve hata işaretleri
  let lx = px0;
  const ly = lejantY;
  parcalar.push(`<line x1="${k(lx)}" y1="${k(ly)}" x2="${k(lx + 18)}" y2="${k(ly)}" stroke="${R.seri}" stroke-width="2"/>`);
  parcalar.push(isaret(lx + 9, ly, "normal"));
  parcalar.push(metin(lx + 24, ly + 4, seri.yEtiket, { punto: tikPunto, renk: R.metin }));
  lx += 24 + metinGenisligi(seri.yEtiket, tikPunto) + 16;
  if (uyariSayisi > 0) {
    parcalar.push(isaret(lx + 6, ly, "uyari"));
    parcalar.push(metin(lx + 16, ly + 4, "Uyarı", { punto: tikPunto, renk: R.metin }));
    lx += 16 + metinGenisligi("Uyarı", tikPunto) + 16;
  }
  if (hataSayisi > 0) {
    parcalar.push(isaret(lx + 6, ly, "hata"));
    parcalar.push(metin(lx + 16, ly + 4, "Hata", { punto: tikPunto, renk: R.metin }));
  }

  const ozet =
    `${yEtiket}, ${xEtiket} ` +
    (xs.length > 0
      ? `${birimli(`${formatNumber(Math.min(...xs))}–${formatNumber(Math.max(...xs))}`, seri.xBirimSembolu)} aralığında; `
      : "") +
    `${noktalar.length} nokta, ${hesaplanan.length} hesaplanan` +
    (uyariSayisi > 0 ? `, ${uyariSayisi} uyarı` : "") +
    (hataSayisi > 0 ? `, ${hataSayisi} hata` : "") +
    ".";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" ` +
    `font-family="${YAZI_TIPI}">` +
    `<title>${xmlKacis(erisilebilirAd)}</title><desc>${xmlKacis(ozet)}</desc>` +
    parcalar.join("") +
    `</svg>`
  );
}
