/**
 * PDF rapor belgeleri (KAPSAM §3.5; yalnızca sunucu): tek hesap, proje ve karşılaştırma raporu.
 *
 * Düzen: A4; her sayfanın başlığında platform adı + rapor başlığı, kullanıcı (ad, unvan, şirket) ve tarih;
 * altında kısa sorumluluk reddi ve "Sayfa x / y". Belgenin sonunda tam sorumluluk reddi ve telif notu.
 * Formüller ve semboller MathJax SVG'sidir (latex-svg.ts); çizilemeyen LaTeX kaynak metin olarak yazılır.
 * Düz metin `metin()` ile yazılır: Noto Sans'ta olmayan ok/matematik karakterleri yedek yazı tipine geçer.
 */
import type {
  Content,
  ContentTable,
  ContextPageSize,
  PageOrientation,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { Check, CheckLevel, Formula, PresentedOutput, Reference, Step } from "@/lib/calc/types";
import { referenceDetail } from "@/components/standards";
import type { Karsilastirma, KarsilastirmaSatiri, TaramaSerisi } from "@/lib/karsilastirma/types";
import { latexToSvg, type LatexSvg } from "./latex-svg";
import {
  KISA_SORUMLULUK_REDDI,
  PLATFORM_ADI,
  RAPOR_TURU,
  SEVIYE_ETIKETI,
  TAM_SORUMLULUK_REDDI,
  TELIF_NOTU,
  tarihBicimle,
} from "./metinler";
import { exToPt, metin, renderPdf } from "./pdf";
import type { HesapRaporu, RaporBasligi, RaporGirdisi } from "./types";

// ---------------------------------------------------------------------------
// Sayfa ve renkler

/** A4, punto */
const A4 = { genislik: 595.28, yukseklik: 841.89 } as const;
/** Kenar boşlukları [sol, üst, sağ, alt]; üst/alt başlık ve alt bilgiye yer bırakır */
const KENAR: [number, number, number, number] = [50, 84, 50, 64];
const YATAY_KENAR = KENAR[0] + KENAR[2];

/** Sitenin açık tema belirteçleri (globals.css) */
const RENK = {
  metin: "#14171c",
  soluk: "#5a6370",
  cizgi: "#dde1e7",
  cizgiKoyu: "#c4cad3",
  zemin: "#eef0f3",
  vurgu: "#1d5bbf",
  vurguZemin: "#e7effb",
} as const;

const SEVIYE_RENK: Record<CheckLevel, { metin: string; zemin: string; cizgi: string }> = {
  ok: { metin: "#17663a", zemin: "#ebf8f0", cizgi: "#b6e2c6" },
  uyari: { metin: "#8a5700", zemin: "#fff7e3", cizgi: "#f0d38c" },
  hata: { metin: "#b42318", zemin: "#fdf0ef", cizgi: "#f3c0bb" },
};

/** Blok formüllerin ve satır içi sembollerin punto büyüklüğü */
const FORMUL_PT = 11;
const SEMBOL_PT = 10;

function icerikGenisligi(yon: PageOrientation): number {
  return (yon === "landscape" ? A4.yukseklik : A4.genislik) - YATAY_KENAR;
}

/** Metni en çok `n` karaktere kısaltır (başlık alanı sabit yükseklikte; taşmasın). */
function kisalt(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

/**
 * Dar sütunlarda uzun kelimeler sütunu genişletmesin: `n` karakterden uzun kelimelere her `n` karakterde
 * sıfır genişlikli boşluk (U+200B, satır kırma fırsatı) eklenir.
 */
function kirilabilir(s: string, n = 12): string {
  return s.replace(/\S{13,}/g, (kelime) => {
    const parcalar: string[] = [];
    const harfler = [...kelime];
    for (let i = 0; i < harfler.length; i += n) parcalar.push(harfler.slice(i, i + n).join(""));
    return parcalar.join("\u200b");
  });
}

/** "hata" > "uyari" > "ok"; kontrol yoksa null */
export function enKotuSeviye(kontroller: readonly Check[]): CheckLevel | null {
  if (kontroller.some((c) => c.level === "hata")) return "hata";
  if (kontroller.some((c) => c.level === "uyari")) return "uyari";
  return kontroller.length > 0 ? "ok" : null;
}

/** Bir hesap raporunun tek satırlık durumu (özet tabloları için) */
function raporDurumu(rapor: HesapRaporu): { etiket: string; seviye: CheckLevel | null } {
  if (!rapor.basarili) return { etiket: "Hesaplanamadı", seviye: "hata" };
  const seviye = enKotuSeviye(rapor.kontroller);
  return seviye ? { etiket: SEVIYE_ETIKETI[seviye], seviye } : { etiket: "Kontrol yok", seviye: null };
}

// ---------------------------------------------------------------------------
// Formül (SVG) yardımcıları

/** Belge başına LaTeX → SVG önbelleği (aynı sembol/formül tekrar çevrilmesin) */
type SvgOnbellek = Map<string, Promise<LatexSvg | null>>;

function svgAl(onbellek: SvgOnbellek, latex: string, display: boolean): Promise<LatexSvg | null> {
  const anahtar = `${display ? "D" : "I"}:${latex}`;
  let p = onbellek.get(anahtar);
  if (!p) {
    p = latexToSvg(latex, display).catch(() => null);
    onbellek.set(anahtar, p);
  }
  return p;
}

/**
 * LaTeX'i SVG düğümüne çevirir; genişlik `enCok`'u aşarsa orantılı küçültülür. MathJax işleyemezse
 * (hata: true) LaTeX kaynağı düz metin olarak yazılır.
 */
async function formulDugumu(
  onbellek: SvgOnbellek,
  latex: string,
  secenek: { pt: number; enCok: number; display?: boolean },
): Promise<Content> {
  const s = await svgAl(onbellek, latex, secenek.display ?? true);
  if (!s || s.hata || !(s.widthEx > 0) || !(s.heightEx > 0)) {
    return { text: metin(latex), italics: true, color: RENK.soluk, fontSize: secenek.pt - 1 };
  }
  return { svg: s.svg, width: Math.min(exToPt(s.widthEx, secenek.pt), secenek.enCok) };
}

// ---------------------------------------------------------------------------
// Ortak parçalar

const TABLO_DUZENI = {
  hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === node.table.body.length ? 0.6 : 0.4),
  vLineWidth: () => 0,
  hLineColor: (i: number) => (i <= 1 ? RENK.cizgiKoyu : RENK.cizgi),
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
  fillColor: (satir: number) => (satir === 0 ? RENK.zemin : null),
};

function baslikHucresi(s: string): TableCell {
  return { text: metin(s), bold: true, fontSize: 8.5, color: RENK.soluk };
}

function bolumBasligi(s: string): Content {
  return { text: metin(s), style: "bolum", headlineLevel: 1 };
}

function altBaslik(s: string): Content {
  return { text: metin(s), style: "altBolum", headlineLevel: 1 };
}

/** Rapor türü etiketi, başlık ve "Hazırlayan / Tarih" bilgisi (ilk sayfa) */
function kunye(tur: string, baslik: RaporBasligi, ekSatirlar: [string, string][] = []): Content[] {
  const k = baslik.kullanici;
  const satirlar: [string, string][] = [];
  if (k?.ad) satirlar.push(["Hazırlayan", k.ad]);
  if (k?.unvan) satirlar.push(["Unvan", k.unvan]);
  if (k?.sirket) satirlar.push(["Şirket", k.sirket]);
  satirlar.push(["Tarih", tarihBicimle(baslik.tarih)], ...ekSatirlar);
  return [
    { text: metin(tur.toLocaleUpperCase("tr")), fontSize: 8.5, bold: true, color: RENK.vurgu, characterSpacing: 0.6 },
    { text: metin(baslik.baslik), style: "belgeBasligi" },
    ...(baslik.altBaslik ? [{ text: metin(baslik.altBaslik), fontSize: 11, color: RENK.soluk, margin: [0, 2, 0, 0] } as Content] : []),
    {
      margin: [0, 10, 0, 4],
      table: {
        widths: [80, "*"],
        body: satirlar.map(([a, b]) => [
          { text: metin(a), color: RENK.soluk, fontSize: 9 },
          { text: metin(b), fontSize: 9 },
        ]),
      },
      layout: {
        hLineWidth: (i: number, node: ContentTable) => (i === node.table.body.length ? 0.6 : 0),
        vLineWidth: () => 0,
        hLineColor: () => RENK.cizgiKoyu,
        paddingLeft: () => 0,
        paddingRight: () => 4,
        paddingTop: () => 1.5,
        paddingBottom: (i: number, node: ContentTable) => (i === node.table.body.length - 1 ? 8 : 1.5),
      },
    },
  ];
}

/** Belgenin son bölümü: tam sorumluluk reddi ve standart telif notu */
function sorumlulukBolumu(): Content {
  return {
    unbreakable: true,
    margin: [0, 18, 0, 0],
    table: {
      widths: ["*"],
      body: [
        [
          {
            fillColor: SEVIYE_RENK.uyari.zemin,
            stack: [
              { text: "Sorumluluk reddi", bold: true, color: SEVIYE_RENK.uyari.metin, fontSize: 10.5 },
              { text: metin(TAM_SORUMLULUK_REDDI), margin: [0, 3, 0, 0], fontSize: 9, lineHeight: 1.2 },
              { text: metin(TELIF_NOTU), margin: [0, 5, 0, 0], fontSize: 8, color: RENK.soluk, lineHeight: 1.2 },
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => SEVIYE_RENK.uyari.cizgi,
      vLineColor: () => SEVIYE_RENK.uyari.cizgi,
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
  };
}

/** Sayfa başlığı: platform adı + rapor başlığı (solda), kullanıcı ve tarih (sağda), altında ince çizgi */
function sayfaBasligi(baslik: RaporBasligi) {
  const k = baslik.kullanici;
  const sag: Content[] = [];
  if (k?.ad) {
    const ad = k.unvan ? `${kisalt(k.ad, 32)} — ${kisalt(k.unvan, 24)}` : kisalt(k.ad, 50);
    sag.push({ text: metin(ad), bold: true, color: RENK.metin });
  }
  if (k?.sirket) sag.push({ text: metin(kisalt(k.sirket, 54)) });
  sag.push({ text: tarihBicimle(baslik.tarih) });
  return (_sayfa: number, _toplam: number, boyut: ContextPageSize): Content => ({
    margin: [KENAR[0], 26, KENAR[2], 0],
    stack: [
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: PLATFORM_ADI, bold: true, fontSize: 9, color: RENK.vurgu },
              { text: metin(kisalt(baslik.baslik, 90)), fontSize: 9, color: RENK.metin, margin: [0, 1, 0, 0] },
            ],
          },
          { width: 230, stack: sag, alignment: "right", fontSize: 8, color: RENK.soluk, lineHeight: 1.1 },
        ],
        columnGap: 12,
      },
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: boyut.width - YATAY_KENAR, y2: 0, lineWidth: 0.6, lineColor: RENK.cizgiKoyu },
        ],
        absolutePosition: { x: KENAR[0], y: KENAR[1] - 12 },
      },
    ],
  });
}

/** Alt bilgi: kısa sorumluluk reddi ve "Sayfa x / y" */
function altBilgi(sayfa: number, toplam: number, boyut: ContextPageSize): Content {
  return {
    margin: [KENAR[0], 14, KENAR[2], 0],
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: boyut.width - YATAY_KENAR, y2: 0, lineWidth: 0.4, lineColor: RENK.cizgi }] },
      {
        margin: [0, 5, 0, 0],
        columns: [
          { width: "*", text: metin(KISA_SORUMLULUK_REDDI), fontSize: 6.8, color: RENK.soluk, lineHeight: 1.1 },
          { width: 70, text: `Sayfa ${sayfa} / ${toplam}`, alignment: "right", fontSize: 8, color: RENK.soluk },
        ],
        columnGap: 12,
      },
    ],
  };
}

/** Tüm belgelerin ortak iskeleti */
function belge(
  baslik: RaporBasligi,
  tur: string,
  icerik: Content[],
  yon: PageOrientation = "portrait",
): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageOrientation: yon,
    pageMargins: KENAR,
    language: "tr-TR",
    info: {
      title: `${baslik.baslik} — ${tur}`,
      ...(baslik.kullanici?.ad ? { author: baslik.kullanici.ad } : {}),
      subject: tur,
      creator: PLATFORM_ADI,
      producer: PLATFORM_ADI,
    },
    header: sayfaBasligi(baslik),
    footer: altBilgi,
    content: icerik,
    // Bölüm başlığı sayfanın son satırında yalnız kalmasın.
    pageBreakBefore: (dugum, sorgular) => {
      if (dugum.headlineLevel !== 1) return false;
      const bas = dugum.startPosition;
      // Sayfa başlığı/alt bilgisi düğümleri ve sayfalara yayılan kapsayıcılar da "sonraki" listesinde gelir;
      // yalnızca aynı sayfada, başlığın altında ve içerik alanında başlayanlar sayılır.
      const icerikAlti = KENAR[1] + bas.pageInnerHeight;
      return !sorgular
        .getFollowingNodesOnPage()
        .some(
          (n) =>
            n.startPosition.pageNumber === bas.pageNumber &&
            n.startPosition.top > bas.top + 1 &&
            n.startPosition.top >= KENAR[1] - 1 &&
            n.startPosition.top < icerikAlti,
        );
    },
    styles: {
      belgeBasligi: { fontSize: 18, bold: true, color: RENK.metin, margin: [0, 2, 0, 0] },
      hesapBasligi: { fontSize: 15, bold: true, color: RENK.metin },
      bolum: { fontSize: 12, bold: true, color: RENK.metin, margin: [0, 14, 0, 6] },
      altBolum: { fontSize: 10.5, bold: true, color: RENK.metin, margin: [0, 10, 0, 4] },
      etiket: { fontSize: 9, color: RENK.soluk },
    },
    defaultStyle: { fontSize: 9.5, color: RENK.metin, lineHeight: 1.15 },
  };
}

// ---------------------------------------------------------------------------
// Hesap bölümleri

async function sembolHucresi(onbellek: SvgOnbellek, sembol: string | undefined, enCok: number): Promise<TableCell> {
  if (!sembol) return { text: "" };
  // SVG hücrenin üstüne yaslanır; metin satırının ortasına denk gelsin diye biraz aşağı alınır.
  return { stack: [await formulDugumu(onbellek, sembol, { pt: SEMBOL_PT, enCok, display: false })], margin: [0, 1.5, 0, 0] };
}

async function girdiTablosu(onbellek: SvgOnbellek, girdiler: RaporGirdisi[], genislik: number): Promise<Content> {
  if (girdiler.length === 0) return { text: "Bu hesabın gösterilecek girdisi yok.", style: "etiket" };
  const sembolGenisligi = 64;
  const degerGenisligi = Math.round(genislik * 0.38);
  const satirlar: TableCell[][] = [[baslikHucresi("Girdi"), baslikHucresi("Sembol"), baslikHucresi("Değer")]];
  for (const g of girdiler) {
    satirlar.push([
      { text: metin(g.label) },
      await sembolHucresi(onbellek, g.symbol, sembolGenisligi - 12),
      { text: metin(g.deger), bold: true },
    ]);
  }
  return {
    table: { headerRows: 1, dontBreakRows: true, widths: ["*", sembolGenisligi, degerGenisligi], body: satirlar },
    layout: TABLO_DUZENI,
  };
}

async function ciktiTablosu(onbellek: SvgOnbellek, ciktilar: PresentedOutput[], genislik: number): Promise<Content> {
  if (ciktilar.length === 0) return { text: "Bu girdilerle gösterilecek bir çıktı yok.", style: "etiket" };
  const sembolGenisligi = 64;
  const degerGenisligi = Math.round(genislik * 0.38);
  const satirlar: TableCell[][] = [[baslikHucresi("Sonuç"), baslikHucresi("Sembol"), baslikHucresi("Değer")]];
  for (const c of ciktilar) {
    satirlar.push([
      { text: metin(c.label) },
      await sembolHucresi(onbellek, c.symbol, sembolGenisligi - 12),
      { text: metin(c.formatted), bold: true, fontSize: 10.5 },
    ]);
  }
  return {
    table: { headerRows: 1, dontBreakRows: true, widths: ["*", sembolGenisligi, degerGenisligi], body: satirlar },
    layout: TABLO_DUZENI,
  };
}

async function formulListesi(
  onbellek: SvgOnbellek,
  ogeler: (Formula | Step)[],
  genislik: number,
  numarali: boolean,
): Promise<Content[]> {
  const sonuc: Content[] = [];
  for (const [i, f] of ogeler.entries()) {
    const etiket = numarali ? `${i + 1}. ${f.label}` : f.label;
    sonuc.push({
      unbreakable: true,
      margin: [0, 0, 0, 6],
      stack: [
        { text: metin(etiket), fontSize: 9, color: RENK.soluk },
        { margin: [12, 3, 0, 0], stack: [await formulDugumu(onbellek, f.latex, { pt: FORMUL_PT, enCok: genislik - 12 })] },
      ],
    });
  }
  return sonuc;
}

function referansMetni(ref: Reference): string {
  return [ref.standard, ref.clause].filter(Boolean).join(", ");
}

/** Uygunluk durumu: her kontrol renkli bir satır (seviye etiketi + mesaj + referans) */
export function kontrolTablosu(kontroller: readonly Check[]): Content {
  if (kontroller.length === 0) {
    return { text: "Bu girdiler için uygunluk kontrolü yok.", style: "etiket" };
  }
  return {
    table: {
      dontBreakRows: true,
      widths: [52, "*"],
      body: kontroller.map((k) => {
        const renk = SEVIYE_RENK[k.level];
        const detay: Content[] = [{ text: metin(k.message) }];
        if (k.reference) {
          detay.push({ text: metin(`Referans: ${referansMetni(k.reference)}`), fontSize: 8, color: RENK.soluk, margin: [0, 2, 0, 0] });
        }
        return [
          { text: SEVIYE_ETIKETI[k.level], bold: true, color: renk.metin, fillColor: renk.zemin },
          { stack: detay, fillColor: renk.zemin },
        ];
      }),
    },
    layout: {
      hLineWidth: () => 2,
      vLineWidth: () => 0,
      hLineColor: () => "#ffffff",
      paddingLeft: () => 7,
      paddingRight: () => 7,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
  };
}

function referansTablosu(referanslar: readonly Reference[]): Content {
  if (referanslar.length === 0) {
    return { text: "Bu hesap temel bağıntılara dayanır; belirli bir standart referansı yoktur.", style: "etiket" };
  }
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [120, "*", 150],
      body: [
        [baslikHucresi("Standart / kaynak"), baslikHucresi("Ad"), baslikHucresi("Madde / not")],
        ...referanslar.map((r): TableCell[] => [
          { text: metin(r.standard), bold: true },
          { text: metin(r.title ?? "—") },
          { text: metin(referenceDetail(r) ?? "—") },
        ]),
      ],
    },
    layout: TABLO_DUZENI,
  };
}

function hataKutusu(baslik: string, mesajlar: string[]): Content {
  const renk = SEVIYE_RENK.hata;
  return {
    margin: [0, 4, 0, 4],
    table: {
      widths: ["*"],
      body: [
        [
          {
            fillColor: renk.zemin,
            stack: [
              { text: metin(baslik), bold: true, color: renk.metin },
              ...(mesajlar.length > 0
                ? [{ ul: mesajlar.map((m) => ({ text: metin(m) })), margin: [0, 3, 0, 0] } as Content]
                : []),
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => renk.cizgi,
      vLineColor: () => renk.cizgi,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
  };
}

/**
 * Bir hesabın tüm bölümleri: başlık, girdiler, formüller, ara adımlar, sonuçlar, uygunluk, referanslar.
 * `projede` true ise başlık içindekiler tablosuna girer.
 */
async function hesapBolumu(
  onbellek: SvgOnbellek,
  rapor: HesapRaporu,
  genislik: number,
  projede: boolean,
): Promise<Content[]> {
  const ad = rapor.kayitAdi?.trim() || rapor.baslik;
  const ust = rapor.kayitAdi?.trim() ? `${rapor.hesapId} · ${rapor.baslik}` : `Hesap ${rapor.hesapId}`;
  const durum = raporDurumu(rapor);
  const icerik: Content[] = [
    { text: metin(ust), fontSize: 9, color: RENK.soluk },
    projede
      ? ({ text: metin(ad), style: "hesapBasligi", tocItem: true, tocMargin: [0, 2, 0, 2] } as unknown as Content)
      : { text: metin(ad), style: "hesapBasligi" },
    { text: metin(rapor.aciklama), fontSize: 9, color: RENK.soluk, margin: [0, 3, 0, 0] },
  ];
  if (rapor.notlar?.trim()) {
    icerik.push({
      margin: [0, 6, 0, 0],
      text: [{ text: "Notlar: ", bold: true }, ...asDizi(metin(rapor.notlar.trim()))],
      fontSize: 9,
    });
  }
  icerik.push({
    margin: [0, 6, 0, 0],
    text: [
      { text: "Genel durum: ", color: RENK.soluk },
      { text: durum.etiket, bold: true, color: durum.seviye ? SEVIYE_RENK[durum.seviye].metin : RENK.soluk },
    ],
    fontSize: 9.5,
  });

  icerik.push(bolumBasligi("Girdiler"), await girdiTablosu(onbellek, rapor.girdiler, genislik));

  if (!rapor.basarili) {
    icerik.push(bolumBasligi("Sonuç"), hataKutusu("Sonuç hesaplanamadı:", rapor.hataMesajlari));
  }

  if (rapor.formuller.length > 0) {
    icerik.push(bolumBasligi("Formüller"), ...(await formulListesi(onbellek, rapor.formuller, genislik, false)));
  }

  if (rapor.basarili) {
    if (rapor.adimlar.length > 0) {
      icerik.push(bolumBasligi("Ara adımlar"), ...(await formulListesi(onbellek, rapor.adimlar, genislik, true)));
    }
    icerik.push(bolumBasligi("Sonuçlar"), await ciktiTablosu(onbellek, rapor.ciktilar, genislik));
  }

  if (rapor.basarili || rapor.kontroller.length > 0) {
    icerik.push(bolumBasligi("Uygunluk durumu"), kontrolTablosu(rapor.kontroller));
  }

  icerik.push(bolumBasligi("Standart referansları"), referansTablosu(rapor.referanslar));
  return icerik;
}

function asDizi(c: string | Content[]): Content[] {
  return typeof c === "string" ? [c] : c;
}

// ---------------------------------------------------------------------------
// Belgeler

/** Tek hesap raporu */
export async function hesapRaporuPdf(baslik: RaporBasligi, rapor: HesapRaporu): Promise<Buffer> {
  const onbellek: SvgOnbellek = new Map();
  const genislik = icerikGenisligi("portrait");
  const icerik: Content[] = [
    ...kunye(RAPOR_TURU.hesap, baslik),
    { margin: [0, 10, 0, 0], stack: await hesapBolumu(onbellek, rapor, genislik, false) },
    sorumlulukBolumu(),
  ];
  return renderPdf(belge(baslik, RAPOR_TURU.hesap, icerik));
}

/**
 * Proje raporu: kapak/özet sayfası (künye, açıklama, hesap özeti ve içindekiler), her hesap yeni sayfada.
 * `atlananlar`: tanımı artık bulunmayan kayıtların adları (rapora alınamadı notu).
 */
export async function projeRaporuPdf(
  baslik: RaporBasligi,
  proje: { ad: string; aciklama: string | null },
  raporlar: HesapRaporu[],
  secenekler?: { atlananlar?: string[] },
): Promise<Buffer> {
  const onbellek: SvgOnbellek = new Map();
  const genislik = icerikGenisligi("portrait");
  const icerik: Content[] = [...kunye(RAPOR_TURU.proje, baslik, [["Hesap sayısı", String(raporlar.length)]])];

  if (proje.aciklama?.trim()) {
    icerik.push(bolumBasligi("Proje açıklaması"), { text: metin(proje.aciklama.trim()), lineHeight: 1.25 });
  }

  icerik.push(bolumBasligi("Hesap özeti"));
  if (raporlar.length === 0) {
    icerik.push({ text: "Bu projede kayıtlı hesap yok.", style: "etiket" });
  } else {
    icerik.push({
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [22, "*", "*", 84],
        body: [
          [baslikHucresi("No"), baslikHucresi("Kayıt adı"), baslikHucresi("Hesap"), baslikHucresi("Durum")],
          ...raporlar.map((r, i): TableCell[] => {
            const d = raporDurumu(r);
            return [
              { text: String(i + 1), color: RENK.soluk },
              { text: metin(r.kayitAdi?.trim() || r.baslik), bold: true },
              { text: metin(`${r.hesapId} · ${r.baslik}`) },
              {
                text: d.etiket,
                bold: true,
                color: d.seviye ? SEVIYE_RENK[d.seviye].metin : RENK.soluk,
                ...(d.seviye ? { fillColor: SEVIYE_RENK[d.seviye].zemin } : {}),
              },
            ];
          }),
        ],
      },
      layout: TABLO_DUZENI,
    });
  }
  if (secenekler?.atlananlar?.length) {
    icerik.push({
      margin: [0, 6, 0, 0],
      text: metin(`Hesap tanımı artık bulunmadığı için rapora alınamayan kayıtlar: ${secenekler.atlananlar.join(", ")}`),
      style: "etiket",
    });
  }

  if (raporlar.length > 0) {
    icerik.push({
      toc: {
        title: { text: "İçindekiler", style: "bolum" },
        textStyle: { fontSize: 9.5 },
        numberStyle: { fontSize: 9.5, color: RENK.soluk },
        textMargin: [0, 2, 0, 2],
      },
    });
  }

  for (const rapor of raporlar) {
    icerik.push({ pageBreak: "before", stack: await hesapBolumu(onbellek, rapor, genislik, true) });
  }
  icerik.push(sorumlulukBolumu());
  return renderPdf(belge(baslik, RAPOR_TURU.proje, icerik));
}

/** Karşılaştırma tablosunda en çok bu kadar senaryo dikey sayfaya sığar; fazlası yatay sayfa */
const DIKEY_SENARYO_MAX = 4;

function senaryoBasligiHucresi(ad: string, seviye: CheckLevel | null, ok: boolean, pt: number): TableCell {
  const s: CheckLevel | null = ok ? seviye : "hata";
  return {
    text: metin(kirilabilir(kisalt(ad, 60))),
    bold: true,
    fontSize: pt,
    color: s && s !== "ok" ? SEVIYE_RENK[s].metin : RENK.metin,
    alignment: "right",
  };
}

async function karsilastirmaTablosu(
  onbellek: SvgOnbellek,
  k: Karsilastirma,
  genislik: number,
): Promise<Content> {
  const n = k.senaryolar.length;
  // Sabit sütunlar senaryo sütunlarına en az ~64 pt bırakacak kadar daralır (8 senaryo, yatay A4).
  const sembolGenisligi = n > 4 ? 36 : 46;
  const birimGenisligi = n > 4 ? 40 : 46;
  const etiketGenisligi = Math.max(96, Math.min(150, genislik - sembolGenisligi - birimGenisligi - n * 66));
  const sutunSayisi = 3 + n;
  const yaziPt = n > 6 ? 7.5 : 8.5;

  const govde: TableCell[][] = [
    [
      baslikHucresi("Büyüklük"),
      baslikHucresi("Sembol"),
      baslikHucresi("Birim"),
      ...k.senaryolar.map((s) => senaryoBasligiHucresi(s.ad, s.durum.enKotu, s.durum.ok, yaziPt)),
    ],
  ];

  const grupSatiri = (ad: string): TableCell[] => [
    { text: ad, bold: true, colSpan: sutunSayisi, fontSize: 8.5, color: RENK.vurgu, margin: [0, 3, 0, 0] },
    ...Array.from({ length: sutunSayisi - 1 }, () => ({ text: "" })),
  ];

  const satirEkle = async (s: KarsilastirmaSatiri) => {
    const zemin = s.farkli ? RENK.vurguZemin : undefined;
    const hucre = (c: TableCell): TableCell =>
      zemin && typeof c === "object" && !Array.isArray(c) ? ({ ...(c as object), fillColor: zemin } as TableCell) : c;
    govde.push([
      hucre({ text: metin(kirilabilir(s.label)) }),
      hucre(await sembolHucresi(onbellek, s.symbol, sembolGenisligi - 8)),
      hucre({ text: metin(s.birimSembolu || "—"), color: RENK.soluk }),
      ...s.degerler.map((d) =>
        hucre({
          text: metin(kirilabilir(d ?? "—")),
          alignment: "right",
          bold: s.farkli,
          color: d === null ? RENK.soluk : RENK.metin,
        }),
      ),
    ]);
  };

  const girdiler = k.satirlar.filter((s) => s.tur === "girdi");
  const ciktilar = k.satirlar.filter((s) => s.tur === "cikti");
  if (girdiler.length > 0) {
    govde.push(grupSatiri("Girdiler"));
    for (const s of girdiler) await satirEkle(s);
  }
  if (ciktilar.length > 0) {
    govde.push(grupSatiri("Sonuçlar"));
    for (const s of ciktilar) await satirEkle(s);
  }
  // Durum satırı: senaryonun en kötü kontrol seviyesi
  govde.push([
    { text: "Uygunluk durumu", bold: true },
    { text: "" },
    { text: "" },
    ...k.senaryolar.map((s): TableCell => {
      const seviye: CheckLevel | null = s.durum.ok ? s.durum.enKotu : "hata";
      const etiket = !s.durum.ok ? "Hesaplanamadı" : seviye ? SEVIYE_ETIKETI[seviye] : "Kontrol yok";
      return {
        text: etiket,
        bold: true,
        alignment: "right",
        fontSize: n > 4 ? 7 : yaziPt,
        color: seviye ? SEVIYE_RENK[seviye].metin : RENK.soluk,
        ...(seviye ? { fillColor: SEVIYE_RENK[seviye].zemin } : {}),
      };
    }),
  ]);

  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [etiketGenisligi, sembolGenisligi, birimGenisligi, ...Array.from({ length: n }, () => "*" as const)],
      body: govde,
    },
    layout: { ...TABLO_DUZENI, paddingLeft: () => 4, paddingRight: () => 4 },
    fontSize: yaziPt,
  };
}

function senaryoKontrolleri(k: Karsilastirma): Content[] {
  const icerik: Content[] = [];
  for (const s of k.senaryolar) {
    icerik.push(altBaslik(s.ad));
    if (!s.durum.ok) {
      const mesajlar = s.durum.kontroller.filter((c) => c.level === "hata").map((c) => c.message);
      icerik.push(hataKutusu("Bu senaryo hesaplanamadı (girdileri kontrol edin).", mesajlar));
      const diger = s.durum.kontroller.filter((c) => c.level !== "hata");
      if (diger.length > 0) icerik.push(kontrolTablosu(diger));
    } else {
      icerik.push(kontrolTablosu(s.durum.kontroller));
    }
  }
  return icerik;
}

function taramaBolumu(tarama: { seri: TaramaSerisi; svg: string }, genislik: number, svgli: boolean): Content[] {
  const { seri } = tarama;
  const eksen = (etiket: string, birim: string) => (birim ? `${etiket} (${birim})` : etiket);
  const icerik: Content[] = [
    { text: "Grafik", style: "bolum" },
    {
      text: metin(`${eksen(seri.yEtiket, seri.yBirimSembolu)} — ${eksen(seri.xEtiket, seri.xBirimSembolu)}`),
      fontSize: 9,
      color: RENK.soluk,
      margin: [0, 0, 0, 6],
    },
  ];
  if (svgli) {
    icerik.push({ svg: tarama.svg, width: Math.min(genislik, 640), alignment: "center" } as Content);
  } else {
    icerik.push({ text: "Grafik çizilemedi.", style: "etiket" });
  }
  const uygunsuz = seri.noktalar.filter((p) => p.seviye === "uyari" || p.seviye === "hata").length;
  const hesaplanamayan = seri.noktalar.filter((p) => p.y === null).length;
  const notlar: string[] = [`${seri.noktalar.length} nokta.`];
  if (uygunsuz > 0) notlar.push(`${uygunsuz} noktada uyarı veya hata var (grafikte işaretli).`);
  if (hesaplanamayan > 0) notlar.push(`${hesaplanamayan} noktada sonuç hesaplanamadı.`);
  icerik.push({ text: metin(notlar.join(" ")), style: "etiket", margin: [0, 6, 0, 0] });
  // Başlık, eksen bilgisi ve grafik aynı sayfada kalsın (grafik bir sayfadan kısa).
  return [{ unbreakable: true, stack: icerik }];
}

/** Karşılaştırma raporu: senaryo tablosu, senaryo kontrolleri ve (varsa) tarama grafiği */
export async function karsilastirmaRaporuPdf(
  baslik: RaporBasligi,
  karsilastirma: Karsilastirma,
  tarama?: { seri: TaramaSerisi; svg: string },
): Promise<Buffer> {
  const onbellek: SvgOnbellek = new Map();
  const yon: PageOrientation = karsilastirma.senaryolar.length > DIKEY_SENARYO_MAX ? "landscape" : "portrait";
  const genislik = icerikGenisligi(yon);

  const olustur = async (svgli: boolean): Promise<TDocumentDefinitions> => {
    const icerik: Content[] = [
      ...kunye(RAPOR_TURU.karsilastirma, baslik, [
        ["Hesap", `${karsilastirma.hesapId} · ${karsilastirma.baslik}`],
        ["Senaryo sayısı", String(karsilastirma.senaryolar.length)],
      ]),
      bolumBasligi("Senaryo tablosu"),
      await karsilastirmaTablosu(onbellek, karsilastirma, genislik),
      {
        text: "Vurgulu satırlarda değerler senaryolar arasında farklıdır. Satırdaki tüm değerler aynı birimle verilmiştir.",
        style: "etiket",
        margin: [0, 4, 0, 0],
      },
    ];
    if (tarama) icerik.push(...taramaBolumu(tarama, genislik, svgli));
    icerik.push(bolumBasligi("Uygunluk durumu"), ...senaryoKontrolleri(karsilastirma), sorumlulukBolumu());
    return belge(baslik, RAPOR_TURU.karsilastirma, icerik, yon);
  };

  if (!tarama) return renderPdf(await olustur(false));
  try {
    return await renderPdf(await olustur(true));
  } catch (error) {
    // Grafik SVG'si pdfmake'te işlenemezse rapor grafiksiz üretilir.
    console.error("Karşılaştırma grafiği PDF'e eklenemedi", error);
    return renderPdf(await olustur(false));
  }
}
