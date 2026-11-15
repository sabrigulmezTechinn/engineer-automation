/**
 * KAPSAM 2.2 — Gerilim düşümü.
 *
 * Endüktif (geri fazlı) yük kabulüyle, R ve X hat başına (Ω/m, SI):
 * - 3 faz (dengeli): ΔU = √3·I·L·(R·cosφ + X·sinφ); yüzde, fazlar arası gerilime göre: %ΔU = ΔU/U.
 * - 1 faz: ΔU = 2·I·L·(R·cosφ + X·sinφ) (gidiş ve dönüş iletkeni); yüzde, faz-nötr gerilimine göre: %ΔU = ΔU/U₀.
 * R iki yoldan: katalogdan Ω/km değeri ya da iletken malzemesi, kesit ve işletme sıcaklığından
 * R_θ = ρ₂₀·(1 + α₂₀·(θ − 20 °C))/A (ρ₂₀, α₂₀: NBS Handbook 100/109, kablo-verileri.ts). X kullanıcı girdisidir.
 *
 * Sınırlar config'ten (src/config/sinir/tesisat-kablo.ts): Elektrik İç Tesisleri Yönetmeliği Madde 57 (a.3) ve
 * Elektrik Kuvvetli Akım Tesisleri Yönetmeliği Madde 58-a/4. IEC 60364-5-52 Ek G değerlerinin kaynağı açılamadığı
 * için kullanıcı tanımlı sınır seçeneği vardır.
 */
import { LIMITS, type Limits } from "@/config/sinirlar";
import { latexNum, latexQty, latexSpec } from "@/lib/calc/latex";
import type {
  CalcContext,
  CalcDefinition,
  Check,
  ComputeInputs,
  NumberInputSpec,
  OutputSpec,
  Reference,
  Step,
} from "@/lib/calc/types";
import { formatQuantity, fromSI } from "@/lib/units";
import { lte, num } from "./kablo-ortak";
import { ILETKEN_MALZEMELERI, MALZEME_REFERANS_SICAKLIGI, ORNEK_REAKTANS_NYY_4X10_OHM_KM } from "./kablo-verileri";

export type Sistem = "uc_faz" | "tek_faz";
export type RKaynagi = "katalog" | "malzeme";
export type Iletken = keyof typeof ILETKEN_MALZEMELERI;
export type SinirSecimi =
  | "eity_aydinlatma"
  | "eity_motor"
  | "eity_trafo"
  | "ekaty_ag"
  | "ekaty_trafo_aydinlatma"
  | "ekaty_trafo_motor"
  | "kullanici";

const WHERE = "gerilim-dusumu";

const REF_EITY: Reference = {
  standard: "Elektrik İç Tesisleri Yönetmeliği (RG 04.11.1984/18565)",
  clause: "Madde 57 (a.3/i) ve (a.3/ii), RG 30.11.1995/22479 ile değişik",
  note: "Yapı bağlantı kutusu ile tüketim araçları arasında: aydınlatma ve priz devreleri %1,5, motor devreleri %3. Transformatör çıkış uçları ile yapı bağlantı kutusu arasında %5.",
};

const REF_EKATY: Reference = {
  standard: "Elektrik Kuvvetli Akım Tesisleri Yönetmeliği",
  clause: "Madde 58-a/4",
  note: "AG tesislerinde %5; kendi transformatörü olan tesislerde AG çıkışından en kritik tüketiciye toplam: aydınlatma %6,5, motor %8. Bu yönetmelik, Elektrik İç Tesisleri Yönetmeliği kapsamındaki tesisleri kapsamaz (Madde 1).",
};

const REF_EK_G: Reference = {
  standard: "IEC 60364-5-52 (TS HD 60364-5-52)",
  title: "Alçak gerilim elektrik tesisleri — Bölüm 5-52: Elektrik donanımının seçimi ve tesisi — Kablo sistemleri",
  clause: "Ek G (bilgilendirici): Gerilim düşümü",
  note: "Ek G'deki sınır değerlerin kaynağı açılamadı; gerekiyorsa 'kullanıcı tanımlı sınır' ile girin.",
};

const REF_NBS: Reference = {
  standard: "NBS Handbook 100 (1966), NBS Handbook 109 (1972)",
  title: "Copper Wire Tables; Aluminum Wire Tables",
  note: "20 °C özdirenç ve sıcaklık katsayısı: Cu 0,017241 Ω·mm²/m, α₂₀ = 0,00393 1/K; Al (EC-H19) 0,028264 Ω·mm²/m, α₂₀ = 0,00403 1/K",
};

type GerilimDusumuSinirlari = Limits["tesisatKablo"]["gerilimDusumu"];

interface SinirTanimi {
  /** Seçenek etiketinin başı ("EİTY Md. 57: motor devresi") */
  etiket: string;
  /** Kontrol mesajındaki açıklama */
  aciklama: string;
  ref: Reference;
  anahtar: keyof GerilimDusumuSinirlari;
}

const SINIRLAR: Record<Exclude<SinirSecimi, "kullanici">, SinirTanimi> = {
  eity_aydinlatma: {
    etiket: "EİTY Md. 57: aydınlatma ve priz devresi",
    aciklama: "EİTY, aydınlatma ve priz devresi",
    ref: REF_EITY,
    anahtar: "eityAydinlatmaPriz",
  },
  eity_motor: { etiket: "EİTY Md. 57: motor devresi", aciklama: "EİTY, motor devresi", ref: REF_EITY, anahtar: "eityMotor" },
  eity_trafo: {
    etiket: "EİTY Md. 57: transformatör – yapı bağlantı kutusu",
    aciklama: "EİTY, transformatör çıkışı – yapı bağlantı kutusu",
    ref: REF_EITY,
    anahtar: "eityTrafoBaglantiKutusu",
  },
  ekaty_ag: {
    etiket: "EKATY Md. 58: alçak gerilim tesisi",
    aciklama: "EKATY, alçak gerilim tesisi",
    ref: REF_EKATY,
    anahtar: "ekatyAlcakGerilim",
  },
  ekaty_trafo_aydinlatma: {
    etiket: "EKATY Md. 58: kendi trafosu, aydınlatma toplamı",
    aciklama: "EKATY, kendi transformatörü olan tesis, aydınlatma (toplam)",
    ref: REF_EKATY,
    anahtar: "ekatyKendiTrafosuAydinlatma",
  },
  ekaty_trafo_motor: {
    etiket: "EKATY Md. 58: kendi trafosu, motor toplamı",
    aciklama: "EKATY, kendi transformatörü olan tesis, motor (toplam)",
    ref: REF_EKATY,
    anahtar: "ekatyKendiTrafosuMotor",
  },
};

/** Seçenek etiketleri config'teki değerle yazılır (ör. "EİTY Md. 57: motor devresi (%3)"); değer değişirse etiket de değişir. */
const SINIR_SECENEKLERI = (Object.keys(SINIRLAR) as Exclude<SinirSecimi, "kullanici">[]).map((value) => ({
  value,
  label: `${SINIRLAR[value].etiket} (${pctText(LIMITS.tesisatKablo.gerilimDusumu[SINIRLAR[value].anahtar])})`,
}));

const MESSAGES = {
  within: (du: string, lim: string, what: string) => `Gerilim düşümü ${du}, sınırın (${lim}, ${what}) içinde.`,
  exceeds: (du: string, lim: string, what: string) =>
    `Gerilim düşümü ${du}, sınırı (${lim}, ${what}) aşıyor: kesiti büyütün, hattı kısaltın veya yükü bölün.`,
  materialNote:
    "R, ρ₂₀/A'dan hesaplandı: bu değer katalogdaki en büyük iletken direncinden biraz küçüktür (ör. 2,5 mm² Cu: 6,90 Ω/km'ye karşı katalogda 7,41 Ω/km), gerilim düşümünü bir miktar küçük gösterir. Katalog değeri varsa onu kullanın.",
} as const;

const OHM_KM_UNITS = ["ohm_per_km", "mohm_per_m", "ohm_per_m"];

const IN = {
  L: {
    kind: "number",
    key: "L",
    label: "Hat uzunluğu (tek yön)",
    symbol: "L",
    dimension: "uzunluk",
    defaultUnit: "m",
    units: ["m", "km", "ft"],
    default: 80,
    min: 0,
    minExclusive: true,
  },
  thetaIsletme: {
    kind: "number",
    key: "thetaIsletme",
    label: "İletken işletme sıcaklığı",
    symbol: "\\theta",
    dimension: "sicaklik",
    defaultUnit: "degC",
    units: ["degC", "degF", "K"],
    default: 70,
    min: 0,
    help: "Tam yükte iletken sıcaklığı: güvenli tarafta kalmak için yalıtkanın en yüksek işletme sıcaklığı (PVC 70 °C, XLPE 90 °C) alınabilir.",
    visibleWhen: { key: "rKaynak", equals: "malzeme" },
  },
  A: {
    kind: "number",
    key: "A",
    label: "İletken kesiti",
    symbol: "A",
    dimension: "alan",
    defaultUnit: "mm2",
    units: ["mm2"],
    default: 10,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "rKaynak", equals: "malzeme" },
  },
} satisfies Record<string, NumberInputSpec>;

const OUT = {
  dU: { key: "dU", label: "Gerilim düşümü", symbol: "\\Delta U", dimension: "gerilim", defaultUnit: "V" },
  dUyuzde: {
    key: "dUyuzde",
    label: "Yüzde gerilim düşümü",
    symbol: "\\%\\Delta U",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
  },
  Uyuk: { key: "Uyuk", label: "Yük ucundaki gerilim", symbol: "U_{\\text{yük}}", dimension: "gerilim", defaultUnit: "V" },
  R: {
    key: "R",
    label: "İletken direnci (işletme sıcaklığında)",
    symbol: "R_\\theta",
    dimension: "direnc_uzunluk",
    defaultUnit: "ohm_per_km",
    units: OHM_KM_UNITS,
  },
} satisfies Record<string, OutputSpec>;

const R_SPEC = { dimension: "direnc_uzunluk", defaultUnit: "ohm_per_km", units: OHM_KM_UNITS } as const;
const qR = (ohmPerM: number) => latexSpec(R_SPEC, ohmPerM);
const qU = (v: number) => latexSpec(OUT.dU, v);
const qPct = (x: number) => latexSpec(OUT.dUyuzde, x);
const qI = (a: number) => latexSpec({ dimension: "akim", defaultUnit: "A" }, a);

function pctText(x: number): string {
  return formatQuantity(fromSI(x, "percent"), "percent");
}

/** İletken direnci (Ω/m) ve ara adımı */
function resistance(inputs: ComputeInputs): { R: number; step?: Step } {
  const kaynak = inputs.rKaynak as RKaynagi;
  if (kaynak === "katalog") return { R: num(inputs, "R_km", WHERE) };
  if (kaynak !== "malzeme") throw new Error(`${WHERE}: bilinmeyen R kaynağı "${String(kaynak)}"`);
  const iletken = inputs.iletken as Iletken;
  const m = ILETKEN_MALZEMELERI[iletken];
  if (!m) throw new Error(`${WHERE}: bilinmeyen iletken "${String(iletken)}"`);
  const A = num(inputs, "A", WHERE);
  const theta = num(inputs, "thetaIsletme", WHERE);
  const R = (m.rho20 * (1 + m.alpha20 * (theta - MALZEME_REFERANS_SICAKLIGI))) / A;
  const T = IN.thetaIsletme;
  return {
    R,
    step: {
      label: `İletken direnci (${m.ad})`,
      latex: `R_\\theta = \\frac{\\rho_{20} \\left(1 + \\alpha_{20} \\left(\\theta - 20\\,{}^\\circ\\mathrm{C}\\right)\\right)}{A} = \\frac{${latexQty(m.rho20, "ohm_mm2_m", { significant: 5 })} \\cdot \\left(1 + ${latexNum(m.alpha20)}\\,\\mathrm{K}^{-1} \\cdot \\left(${latexSpec(T, theta)} - ${latexSpec(T, MALZEME_REFERANS_SICAKLIGI)}\\right)\\right)}{${latexSpec(IN.A, A)}} = ${qR(R)}`,
    },
  };
}

function limitOf(inputs: ComputeInputs, ctx: CalcContext): { deger: number; aciklama: string; ref: Reference } {
  const secim = inputs.sinir as SinirSecimi;
  if (secim === "kullanici") {
    return { deger: num(inputs, "sinirKullanici", WHERE), aciklama: "kullanıcı tanımlı sınır", ref: REF_EK_G };
  }
  const t = SINIRLAR[secim];
  if (!t) throw new Error(`${WHERE}: bilinmeyen sınır "${String(secim)}"`);
  return { deger: ctx.limits.tesisatKablo.gerilimDusumu[t.anahtar], aciklama: t.aciklama, ref: t.ref };
}

function compute(inputs: ComputeInputs, ctx: CalcContext) {
  const sistem = inputs.sistem as Sistem;
  if (sistem !== "uc_faz" && sistem !== "tek_faz") throw new Error(`${WHERE}: bilinmeyen sistem "${String(sistem)}"`);
  const triple = sistem === "uc_faz";
  const U = triple ? num(inputs, "U_ll", WHERE) : num(inputs, "U_ph", WHERE);
  const I = num(inputs, "I", WHERE);
  const L = num(inputs, "L", WHERE);
  const cosphi = num(inputs, "cosphi", WHERE);
  const sinphi = Math.sqrt(Math.max(0, 1 - cosphi * cosphi));
  const X = num(inputs, "X_km", WHERE);
  const { R, step: rStep } = resistance(inputs);

  const factor = triple ? Math.sqrt(3) : 2;
  const dU = factor * I * L * (R * cosphi + X * sinphi);
  const pct = dU / U;
  const Uyuk = U - dU;

  const outputs: Record<string, number> = { dU, dUyuzde: pct, Uyuk };
  const steps: Step[] = [
    {
      label: "sin φ (endüktif yük)",
      latex: `\\sin\\varphi = \\sqrt{1 - \\cos^2\\varphi} = \\sqrt{1 - ${latexNum(cosphi)}^2} = ${latexNum(sinphi)}`,
    },
  ];
  if (rStep) {
    steps.push(rStep);
    outputs.R = R;
  }
  const fLatex = triple ? "\\sqrt{3}" : "2";
  const uSym = triple ? "U" : "U_0";
  steps.push(
    {
      label: triple ? "Gerilim düşümü (3 faz)" : "Gerilim düşümü (1 faz, gidiş-dönüş)",
      latex: `\\Delta U = ${fLatex} \\cdot I \\cdot L \\cdot \\left(R \\cos\\varphi + X \\sin\\varphi\\right) = ${fLatex} \\cdot ${qI(I)} \\cdot ${latexSpec(IN.L, L)} \\cdot \\left(${qR(R)} \\cdot ${latexNum(cosphi)} + ${qR(X)} \\cdot ${latexNum(sinphi)}\\right) = ${qU(dU)}`,
    },
    {
      label: triple ? "Yüzde gerilim düşümü (fazlar arası gerilime göre)" : "Yüzde gerilim düşümü (faz-nötr gerilimine göre)",
      latex: `\\%\\Delta U = \\frac{\\Delta U}{${uSym}} = \\frac{${qU(dU)}}{${qU(U)}} = ${qPct(pct)}`,
    },
    {
      label: "Yük ucundaki gerilim",
      latex: `U_{\\text{yük}} = ${uSym} - \\Delta U = ${qU(U)} - ${qU(dU)} = ${qU(Uyuk)}`,
    },
  );

  const lim = limitOf(inputs, ctx);
  const ok = lte(pct, lim.deger);
  const checks: Check[] = [
    {
      level: ok ? "ok" : "uyari",
      message: (ok ? MESSAGES.within : MESSAGES.exceeds)(pctText(pct), pctText(lim.deger), lim.aciklama),
      reference: lim.ref,
    },
  ];
  if (rStep) checks.push({ level: "bilgi", message: MESSAGES.materialNote, reference: REF_NBS });
  return { outputs, steps, checks };
}

export const gerilimDusumu: CalcDefinition = {
  id: "2.2",
  slug: "gerilim-dusumu",
  category: "tesisat",
  title: "Gerilim düşümü",
  description:
    "Üç fazlı veya tek fazlı bir hattaki gerilim düşümünü iletken direnci ve reaktansıyla hesaplayın; yüzde değeri Elektrik İç Tesisleri Yönetmeliği, Elektrik Kuvvetli Akım Tesisleri Yönetmeliği veya kendi sınırınızla karşılaştırın. Direnç katalogdan girilebilir veya iletken malzemesi, kesit ve işletme sıcaklığından hesaplanabilir. Yük endüktif (geri fazlı) kabul edilir.",
  formulas: [
    {
      label: "3 faz (yüzde fazlar arası gerilime göre)",
      latex: "\\Delta U = \\sqrt{3} \\cdot I \\cdot L \\cdot \\left(R \\cos\\varphi + X \\sin\\varphi\\right), \\qquad \\%\\Delta U = \\frac{\\Delta U}{U}",
    },
    {
      label: "1 faz (yüzde faz-nötr gerilimine göre)",
      latex: "\\Delta U = 2 \\cdot I \\cdot L \\cdot \\left(R \\cos\\varphi + X \\sin\\varphi\\right), \\qquad \\%\\Delta U = \\frac{\\Delta U}{U_0}",
    },
    {
      label: "İşletme sıcaklığında iletken direnci",
      latex: "R_\\theta = \\frac{\\rho_{20} \\left(1 + \\alpha_{20} \\left(\\theta - 20\\,{}^\\circ\\mathrm{C}\\right)\\right)}{A}",
    },
  ],
  references: [REF_EK_G, REF_EITY, REF_EKATY, REF_NBS],
  inputs: [
    {
      kind: "select",
      key: "sistem",
      label: "Sistem",
      options: [
        { value: "uc_faz", label: "Üç fazlı (dengeli)" },
        { value: "tek_faz", label: "Tek fazlı" },
      ],
      default: "uc_faz",
    },
    {
      kind: "number",
      key: "U_ll",
      label: "Fazlar arası gerilim",
      symbol: "U",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 400,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "sistem", equals: "uc_faz" },
    },
    {
      kind: "number",
      key: "U_ph",
      label: "Faz-nötr gerilimi",
      symbol: "U_0",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 230,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "sistem", equals: "tek_faz" },
    },
    {
      kind: "number",
      key: "I",
      label: "Hat akımı",
      symbol: "I",
      dimension: "akim",
      defaultUnit: "A",
      default: 45,
      min: 0,
      minExclusive: true,
      help: "Yönetmelik, sürekli en büyük işletme akımıyla hesap ister.",
    },
    IN.L,
    {
      kind: "number",
      key: "cosphi",
      label: "Güç katsayısı",
      symbol: "\\cos\\varphi",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 0.85,
      min: 0,
      max: 1,
      help: "Omik yükte ve doğru akımda 1.",
    },
    {
      kind: "select",
      key: "rKaynak",
      label: "İletken direnci",
      options: [
        { value: "katalog", label: "Katalogdan (Ω/km)" },
        { value: "malzeme", label: "Malzeme, kesit ve sıcaklıktan hesapla" },
      ],
      default: "katalog",
    },
    {
      kind: "number",
      key: "R_km",
      label: "İletken direnci (katalog)",
      symbol: "R",
      dimension: "direnc_uzunluk",
      defaultUnit: "ohm_per_km",
      units: OHM_KM_UNITS,
      default: 1.83,
      min: 0,
      minExclusive: true,
      help: "Tek iletkenin direnci. Kataloglar çoğunlukla 20 °C DC direnç verir (ör. Prysmian NYY 10 mm²: 1,83 Ω/km); işletme sıcaklığındaki direnç daha büyüktür, varsa onu girin.",
      visibleWhen: { key: "rKaynak", equals: "katalog" },
    },
    {
      kind: "select",
      key: "iletken",
      label: "İletken malzemesi",
      options: [
        { value: "cu", label: "Bakır" },
        { value: "al", label: "Alüminyum" },
      ],
      default: "cu",
      visibleWhen: { key: "rKaynak", equals: "malzeme" },
    },
    IN.A,
    IN.thetaIsletme,
    {
      kind: "number",
      key: "X_km",
      label: "İletken reaktansı",
      symbol: "X",
      dimension: "direnc_uzunluk",
      defaultUnit: "ohm_per_km",
      units: OHM_KM_UNITS,
      default: ORNEK_REAKTANS_NYY_4X10_OHM_KM,
      min: 0,
      help: "Katalogdaki endüktif reaktans; katalog endüktans veriyorsa X = 2π·f·L. Örnek: Klaus Faber NYY-O 4×10, 0,301 mH/km → 0,0946 Ω/km. Bilinmiyorsa 0 girilirse yalnızca direnç hesaba katılır.",
    },
    {
      kind: "select",
      key: "sinir",
      label: "İzin verilen gerilim düşümü",
      options: [...SINIR_SECENEKLERI, { value: "kullanici", label: "Kullanıcı tanımlı (ör. IEC 60364-5-52 Ek G, şartname)" }],
      default: "eity_motor",
    },
    {
      kind: "number",
      key: "sinirKullanici",
      label: "İzin verilen gerilim düşümü",
      symbol: "\\%\\Delta U_{\\text{maks}}",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      min: 0,
      minExclusive: true,
      max: 1,
      help: "Standarttaki (ör. IEC 60364-5-52 Ek G) veya şartnamedeki değeri girin.",
      visibleWhen: { key: "sinir", equals: "kullanici" },
    },
  ],
  outputs: [OUT.dU, OUT.dUyuzde, OUT.Uyuk, OUT.R],
  compute,
};
