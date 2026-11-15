/**
 * KAPSAM 2.8 — Pano ısı hesabı (doğal soğutma, fan debisi, klima gücü).
 *
 * IEC/TR 60890 metni telifli olduğundan yöntem, standarda dayanan kamuya açık üretici kılavuzlarından alınmıştır:
 * - Etkin (ısı yayan) yüzey A, montaj şekline göre (IEC 890): Schneider Electric muhafaza kataloğu, ısıl yönetim sayfası
 *   (H yükseklik, W genişlik, D derinlik; m) — https://storage.electrika.com/flips/0700-schn-encl-10/files/assets/basic-html/page691.html
 *     her yönden açık:                   A = 1,8·H·(W + D) + 1,4·W·D
 *     duvara monte:                      A = 1,4·W·(H + D) + 1,8·D·H
 *     sıra başı/sonu, serbest:           A = 1,4·D·(H + W) + 1,8·W·H
 *     sıra başı/sonu, duvara monte:      A = 1,4·H·(W + D) + 1,4·W·D
 *     sıra ortası, serbest:              A = 1,8·W·H + 1,4·W·D + D·H
 *     sıra ortası, duvara monte:         A = 1,4·W·(H + D) + D·H
 *     sıra ortası, duvara monte, üstü kapalı: A = 1,4·W·H + 0,7·W·D + D·H
 *   Aynı sayfa: ısı geçiş katsayısı K = 5,5 (boyalı sac), 3,5 (polyester), 3,7 (paslanmaz), 12 (alüminyum) W/(m²·°C).
 *   Rittal de sac için k = 5,5 W/(m²·K) verir (aşağıdaki katalog).
 * - Isı dengesi ve fan: Rittal "Technical System Catalogue / Climate control" (s. 3-5, 3-6, 3-16) —
 *   https://static.chipdip.ru/lib/034/DOC021034421.pdf, https://www.rittal.de/downloads/eBook/TSH/EN/climate_control/pubData/SEO/Page_6.html
 *     (ΔT)maks = Q_v/(k·A); Q_S = A·k·ΔT; V = f·Q_v/ΔT; Q_E = Q_v − k·A·ΔT (klima)
 *   Schneider (page692.html): klima P = P_d − K·S·(T_i,maks − T_e,maks); fan D = 3,1·P/(T_i,maks − T_e,maks), burada P net güçtür.
 * Bu hesap fan debisini net güçten (ısı dengesi, Schneider biçimi) bulur; Rittal'in toplam kayıpla verdiği değer üst
 * sınır olarak kontrol mesajında gösterilir.
 */
import { latexSpec } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { num, qNum, qText, specOf } from "./guc-ortak";

const WHERE = "pano-isi-hesabi";

export type PanoMontaj = "serbest" | "duvar" | "sonSerbest" | "sonDuvar" | "ortaSerbest" | "ortaDuvar" | "ortaDuvarUstKapali";
export type PanoMalzeme = "sac" | "paslanmaz" | "polyester" | "aluminyum" | "ozel";
export type PanoRakim = "r100" | "r250" | "r500" | "r750" | "r1000";

/** Isı geçiş katsayısı k, W/(m²·K) — Schneider page691 (yukarıda). */
const K_MALZEME: Record<Exclude<PanoMalzeme, "ozel">, number> = {
  sac: 5.5,
  paslanmaz: 3.7,
  polyester: 3.5,
  aluminyum: 12,
};

/** Etkin yüzey formülleri (m², girdiler m) ve LaTeX gösterimleri */
const MONTAJ: Record<PanoMontaj, { area: (H: number, W: number, D: number) => number; latex: string }> = {
  serbest: { area: (H, W, D) => 1.8 * H * (W + D) + 1.4 * W * D, latex: "1{,}8 H (W + D) + 1{,}4 W D" },
  duvar: { area: (H, W, D) => 1.4 * W * (H + D) + 1.8 * D * H, latex: "1{,}4 W (H + D) + 1{,}8 D H" },
  sonSerbest: { area: (H, W, D) => 1.4 * D * (H + W) + 1.8 * W * H, latex: "1{,}4 D (H + W) + 1{,}8 W H" },
  sonDuvar: { area: (H, W, D) => 1.4 * H * (W + D) + 1.4 * W * D, latex: "1{,}4 H (W + D) + 1{,}4 W D" },
  ortaSerbest: { area: (H, W, D) => 1.8 * W * H + 1.4 * W * D + D * H, latex: "1{,}8 W H + 1{,}4 W D + D H" },
  ortaDuvar: { area: (H, W, D) => 1.4 * W * (H + D) + D * H, latex: "1{,}4 W (H + D) + D H" },
  ortaDuvarUstKapali: { area: (H, W, D) => 1.4 * W * H + 0.7 * W * D + D * H, latex: "1{,}4 W H + 0{,}7 W D + D H" },
};

const REF_61439: Reference = {
  standard: "IEC 61439-1",
  title: "Alçak gerilim anahtarlama ve kontrol düzeni panoları — Bölüm 1: Genel kurallar",
  clause: "Madde 7.1 (normal hizmet koşulları), Madde 9.2 (sıcaklık artışı sınırları)",
  note: "Değerler: ABB Technical Application Papers No.11 (1SDC007110G0203), Tablo 3.1 ve 7.1",
};

const OUTPUTS: OutputSpec[] = [
  { key: "A", label: "Etkin (ısı yayan) yüzey", symbol: "A", dimension: "alan", defaultUnit: "m2" },
  { key: "dT", label: "Doğal soğutmada iç sıcaklık artışı", symbol: "\\Delta T", dimension: "sicaklik_farki", defaultUnit: "deltaK" },
  { key: "TiDogal", label: "Doğal soğutmada iç sıcaklık", symbol: "T_i", dimension: "sicaklik", defaultUnit: "degC" },
  { key: "Qs", label: "İzin verilen sıcaklık farkında yüzeyden atılan ısı", symbol: "Q_S", dimension: "guc", defaultUnit: "W" },
  { key: "V", label: "Gerekli fan debisi", symbol: "\\dot{V}", dimension: "debi", defaultUnit: "m3_h" },
  { key: "Qklima", label: "Gerekli klima (soğutma) gücü", symbol: "Q_K", dimension: "guc", defaultUnit: "W" },
];

const S = (key: string) => specOf(OUTPUTS, key);
/** Boyutlar girdilerin varsayılan birimiyle (mm) yazılır; formülde sayısal yerine koyma yapılmaz. */
const qLen = (v: number) => latexSpec({ dimension: "uzunluk", defaultUnit: "mm" }, v);
const qA = (v: number) => latexSpec(S("A"), v);
const qP = (v: number) => latexSpec(S("Qs"), v);
const qK = (v: number) => latexSpec({ dimension: "isi_transfer_katsayisi", defaultUnit: "W_m2K" }, v);
const qDT = (v: number) => latexSpec(S("dT"), v);
const qT = (v: number) => latexSpec(S("TiDogal"), v);
const qDTop = (v: number) => (v < 0 ? `(${qDT(v)})` : qDT(v));
/** f katalog birimiyle (m³·K/(W·h)) yazılır */
const qFcat = (fSI: number) => `${qNum(fSI * 3600)}\\,\\tfrac{\\mathrm{m}^3 \\cdot \\mathrm{K}}{\\mathrm{W} \\cdot \\mathrm{h}}`;

const MESSAGES = {
  method:
    "Panonun iç havası tek bir ortalama sıcaklıkta kabul edildi (ΔT = P/(k·A)); IEC/TR 60890'daki yüksekliğe göre sıcaklık dağılımı ve iç bölmeler hesaba katılmadı. Güneş ışınımı ve dış hava akımı yoktur (iç mekân, durgun hava).",
  natOk: (ti: string, tmax: string) => `Doğal soğutma yeterli: iç sıcaklık ${ti} ≤ ${tmax}. Fan veya klima gerekmez.`,
  natFail: (ti: string, tmax: string) => `Doğal soğutma yetmez: iç sıcaklık ${ti} > ${tmax}. Fan (ortam yeterince serinse) veya klima gerekir.`,
  fanBound: (v: string) =>
    `Fan debisi yüzeyden atılan ısı düşülerek (net güçle) hesaplandı. Yüzeyden ısı atımı ihmal edilirse (Rittal biçimi, toplam kayıpla) üst sınır ${v} olur. Filtre ve panjur basınç kaybı nedeniyle fanın gerçek debisi katalog eğrisinden kontrol edilmelidir.`,
  noFan: (tu: string, ti: string) =>
    `Ortam sıcaklığı (${tu}) izin verilen iç sıcaklığa (${ti}) eşit veya üstünde: ortam havasıyla fan soğutması mümkün değildir; klima gerekir ve dış yüzeyden içeri ısı girer.`,
  info61439: (maks: string, ort: string, min: string, uc: string, yuzey: string) =>
    `IEC 61439-1 iç mekân normal hizmet koşulları: ortam sıcaklığı en çok ${maks}, 24 saatlik ortalaması en çok ${ort}, en az ${min}. Pano parçalarının sıcaklık artışı sınırları (ör. dış iletken bağlantı uçları ${uc}, erişilebilir metal muhafaza yüzeyleri ${yuzey}) 24 saatlik ortalama ortam sıcaklığı ${ort} değerini aşmadıkça geçerlidir.`,
  above61439: (tu: string, maks: string) =>
    `Ortam sıcaklığı ${tu}, IEC 61439-1 iç mekân normal hizmet koşullarındaki ${maks} sınırının üzerinde: özel hizmet koşulu; pano üreticisiyle anlaşma ve sıcaklık artışı sınırlarının uyarlanması gerekir.`,
} as const;

function kValue(inputs: ComputeInputs): number {
  const m = inputs.malzeme as PanoMalzeme;
  if (m === "ozel") return num(inputs, "kOzel", WHERE);
  const k = K_MALZEME[m];
  if (k === undefined) throw new Error(`${WHERE}: bilinmeyen malzeme "${String(m)}"`);
  return k;
}

export const panoIsiHesabi: CalcDefinition = {
  id: "2.8",
  slug: "pano-isi-hesabi",
  category: "tesisat",
  title: "Pano ısı hesabı",
  description:
    "Pano içindeki güç kaybından etkin yüzeyi, doğal soğutmadaki iç sıcaklık artışını, izin verilen iç sıcaklık için gerekli fan debisini ve klima gücünü hesaplayın. Etkin yüzey montaj şekline göre IEC 890 katsayılarıyla bulunur.",
  formulas: [
    { label: "Doğal soğutmada sıcaklık artışı", latex: "\\Delta T = \\frac{P_{\\text{kayıp}}}{k \\cdot A}" },
    { label: "Yüzeyden atılan ısı", latex: "Q_S = k \\cdot A \\cdot \\Delta T_{\\text{izin}}, \\quad \\Delta T_{\\text{izin}} = T_i - T_u" },
    { label: "Klima gücü", latex: "Q_K = P_{\\text{kayıp}} - k \\cdot A \\cdot \\Delta T_{\\text{izin}}" },
    {
      label: "Fan debisi",
      latex: "\\dot{V} = f \\cdot \\frac{P_{\\text{kayıp}} - k \\cdot A \\cdot \\Delta T_{\\text{izin}}}{\\Delta T_{\\text{izin}}}, \\quad f = \\frac{1}{\\rho_{\\text{hava}} \\cdot c_p}",
    },
    { label: "Etkin yüzey (ör. duvara monte)", latex: "A = 1{,}4\\, W (H + D) + 1{,}8\\, D H" },
  ],
  references: [
    {
      standard: "IEC/TR 60890",
      title: "Alçak gerilim anahtarlama ve kontrol düzeni panolarında sıcaklık artışının hesapla doğrulanması yöntemi",
      note: "Etkin soğutma yüzeyi; yöntem üretici kılavuzlarından (Rittal, Schneider Electric)",
    },
    {
      standard: "Rittal Technical System Catalogue — Climate control",
      title: "Calculation basis for enclosure climate control; fan-and-filter units project planning; cooling units",
      note: "k = 5,5 W/(m²·K) (sac), fan katsayısı f yükseklik tablosu",
    },
    REF_61439,
  ],
  inputs: [
    {
      kind: "select",
      key: "montaj",
      label: "Montaj şekli",
      options: [
        { value: "serbest", label: "Tek pano, her yönden açık" },
        { value: "duvar", label: "Tek pano, duvara monte" },
        { value: "sonSerbest", label: "Sıra başı/sonu pano, serbest" },
        { value: "sonDuvar", label: "Sıra başı/sonu pano, duvara monte" },
        { value: "ortaSerbest", label: "Sıra ortası pano, serbest" },
        { value: "ortaDuvar", label: "Sıra ortası pano, duvara monte" },
        { value: "ortaDuvarUstKapali", label: "Sıra ortası pano, duvara monte, üstü kapalı" },
      ],
      default: "duvar",
    },
    { kind: "number", key: "H", label: "Yükseklik", symbol: "H", dimension: "uzunluk", defaultUnit: "mm", units: ["mm", "cm", "m"], default: 2000, min: 0, minExclusive: true },
    { kind: "number", key: "W", label: "Genişlik", symbol: "W", dimension: "uzunluk", defaultUnit: "mm", units: ["mm", "cm", "m"], default: 800, min: 0, minExclusive: true },
    { kind: "number", key: "D", label: "Derinlik", symbol: "D", dimension: "uzunluk", defaultUnit: "mm", units: ["mm", "cm", "m"], default: 400, min: 0, minExclusive: true },
    {
      kind: "select",
      key: "malzeme",
      label: "Muhafaza malzemesi",
      options: [
        { value: "sac", label: "Boyalı sac (k = 5,5 W/(m²·K))" },
        { value: "paslanmaz", label: "Paslanmaz çelik (k = 3,7 W/(m²·K))" },
        { value: "polyester", label: "Polyester (k = 3,5 W/(m²·K))" },
        { value: "aluminyum", label: "Alüminyum (k = 12 W/(m²·K))" },
        { value: "ozel", label: "Özel k değeri" },
      ],
      default: "sac",
    },
    {
      kind: "number",
      key: "kOzel",
      label: "Isı geçiş katsayısı",
      symbol: "k",
      dimension: "isi_transfer_katsayisi",
      defaultUnit: "W_m2K",
      default: 5.5,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "malzeme", equals: "ozel" },
    },
    {
      kind: "number",
      key: "P",
      label: "Pano içindeki toplam güç kaybı",
      symbol: "P_{\\text{kayıp}}",
      dimension: "guc",
      defaultUnit: "W",
      units: ["W", "kW"],
      default: 800,
      min: 0,
      minExclusive: true,
      help: "Cihaz veri sayfalarındaki kayıpların toplamı (sürücüler, güç kaynakları, şalterler, baralar).",
    },
    {
      kind: "number",
      key: "Tu",
      label: "En yüksek ortam sıcaklığı",
      symbol: "T_u",
      dimension: "sicaklik",
      defaultUnit: "degC",
      units: ["degC", "K", "degF"],
      default: 35,
    },
    {
      kind: "number",
      key: "Ti",
      label: "İzin verilen en yüksek iç sıcaklık",
      symbol: "T_i",
      dimension: "sicaklik",
      defaultUnit: "degC",
      units: ["degC", "K", "degF"],
      default: 40,
      help: "İçerideki cihazların izin verdiği en yüksek ortam sıcaklığı (veri sayfalarından).",
    },
    {
      kind: "select",
      key: "rakim",
      label: "Deniz seviyesinden yükseklik (fan katsayısı f)",
      options: [
        { value: "r100", label: "0–100 m (f = 3,1 m³·K/(W·h))" },
        { value: "r250", label: "100–250 m (f = 3,2)" },
        { value: "r500", label: "250–500 m (f = 3,3)" },
        { value: "r750", label: "500–750 m (f = 3,4)" },
        { value: "r1000", label: "750–1000 m (f = 3,5)" },
      ],
      default: "r100",
    },
  ],
  outputs: OUTPUTS,

  compute: (inputs, ctx) => {
    const montaj = inputs.montaj as PanoMontaj;
    const m = MONTAJ[montaj];
    if (!m) throw new Error(`${WHERE}: bilinmeyen montaj "${String(montaj)}"`);
    const H = num(inputs, "H", WHERE);
    const W = num(inputs, "W", WHERE);
    const D = num(inputs, "D", WHERE);
    const P = num(inputs, "P", WHERE);
    const Tu = num(inputs, "Tu", WHERE);
    const Ti = num(inputs, "Ti", WHERE);
    const k = kValue(inputs);
    const fTable = ctx.limits.tesisatGuc.fanKatsayisi;
    const f = fTable[inputs.rakim as PanoRakim];
    if (f === undefined) throw new Error(`${WHERE}: bilinmeyen yükseklik "${String(inputs.rakim)}"`);

    const A = m.area(H, W, D);
    const dT = P / (k * A);
    const TiDogal = Tu + dT;
    const dTizin = Ti - Tu;
    const Qs = k * A * dTizin;
    const Qnet = P - Qs;
    const outputs: Record<string, number> = { A, dT, TiDogal, Qs };
    const checks: Check[] = [{ level: "ok", message: MESSAGES.method }];
    const tiText = qText(S("TiDogal"), TiDogal);
    const tmaxText = qText(S("TiDogal"), Ti);

    const steps: Step[] = [
      {
        label: "Etkin yüzey",
        latex: `A = ${m.latex} = ${qA(A)} \\quad (H = ${qLen(H)},\\ W = ${qLen(W)},\\ D = ${qLen(D)})`,
      },
      {
        label: "Doğal soğutmada iç sıcaklık",
        latex: `\\Delta T = \\frac{P_{\\text{kayıp}}}{k \\cdot A} = \\frac{${qP(P)}}{${qK(k)} \\cdot ${qA(A)}} = ${qDT(dT)} \\qquad T_i = T_u + \\Delta T = ${qT(TiDogal)}`,
      },
      {
        label: "İzin verilen sıcaklık farkında yüzeyden atılan ısı",
        latex: `Q_S = k \\cdot A \\cdot (T_i - T_u) = ${qK(k)} \\cdot ${qA(A)} \\cdot ${qDTop(dTizin)} = ${qP(Qs)}`,
      },
    ];

    if (Qnet <= 0) {
      checks.push({ level: "ok", message: MESSAGES.natOk(tiText, tmaxText) });
    } else {
      checks.push({ level: "uyari", message: MESSAGES.natFail(tiText, tmaxText) });
      outputs.Qklima = Qnet;
      steps.push({
        label: "Gerekli klima gücü",
        latex: `Q_K = P_{\\text{kayıp}} - Q_S = ${qP(P)} - ${Qs < 0 ? `(${qP(Qs)})` : qP(Qs)} = ${qP(Qnet)}`,
      });
      if (dTizin > 0) {
        const V = (f * Qnet) / dTizin;
        const Vbound = (f * P) / dTizin;
        outputs.V = V;
        steps.push({
          label: "Gerekli fan debisi",
          latex: `\\dot{V} = f \\cdot \\frac{P_{\\text{kayıp}} - Q_S}{T_i - T_u} = ${qFcat(f)} \\cdot \\frac{${qP(Qnet)}}{${qDT(dTizin)}} = ${latexSpec(S("V"), V)}`,
        });
        checks.push({ level: "ok", message: MESSAGES.fanBound(qText(S("V"), Vbound)) });
      } else {
        checks.push({ level: "ok", message: MESSAGES.noFan(qText(S("TiDogal"), Tu), tmaxText) });
      }
    }

    const l = ctx.limits.tesisatGuc.iec61439;
    const tC = (v: number) => qText(S("TiDogal"), v);
    const dK = (v: number) => qText(S("dT"), v);
    checks.push(
      Tu > l.ortamMaks
        ? { level: "uyari", message: MESSAGES.above61439(tC(Tu), tC(l.ortamMaks)), reference: REF_61439 }
        : {
            level: "ok",
            message: MESSAGES.info61439(tC(l.ortamMaks), tC(l.ortam24sOrt), tC(l.ortamMin), dK(l.ucArtis), dK(l.metalYuzeyArtis)),
            reference: REF_61439,
          },
    );

    return { outputs, steps, checks };
  },
};
