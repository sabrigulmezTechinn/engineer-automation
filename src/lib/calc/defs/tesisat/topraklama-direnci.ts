/**
 * KAPSAM 2.7 — Topraklama (yayılma) direnci, homojen toprak.
 *
 * Çubuk (derin) topraklayıcı:
 *   Dwight (1936): R = ρ/(2πL)·[ln(4L/a) − 1], a = çubuk YARIÇAPI. Çap d ile: R = ρ/(2πL)·[ln(8L/d) − 1].
 *     Kaynak: H. B. Dwight, "Calculation of resistances to ground", AIEE Transactions 55(12), 1936, s. 1319–1328;
 *     formülün yarıçapla yazıldığı ve sayısal örnekleri: https://eepower.com/technical-articles/how-to-improve-resistance-to-ground/
 *     ("a = rod radius", "Dwight's formulas use the radius (a = d/2)"; ρ = 10 000 Ω·cm, L = 300 cm, d = 1,270 cm → ≈ 35 Ω).
 *     Not: KAPSAM §4.2'deki "ln(4L/d) − 1" yazımı d'yi çap alırsa yanlış sonuç verir (16 mm'de 29,8 Ω yerine 33,5 Ω doğru).
 *   Elektrik Tesislerinde Topraklamalar Yönetmeliği Ek-K (Şekil-K.2) ve Ek-T (b): R = ρ/(2πL)·ln(4L/d), d = çap.
 * Paralel çubuklar: R_n = R₁/(n·η), η kullanım katsayısı (aralığa ve sayıya bağlı; tablodan, kullanıcı girdisi).
 * Şerit (yüzeysel) topraklayıcı (Ek-K): R = ρ/(πL)·ln(2L/d), d = "örgülü iletken çapı veya şerit kalınlığının yarısı".
 * Halka topraklayıcı (Ek-K): D = L/π, R = ρ/(π²D)·ln(2πD/d).
 * Gözlü topraklayıcı (Ek-K, yaklaşık): R = ρ/(2D), D = gözlü alanına eşit alanlı dairenin çapı.
 * Daire levha, yatay gömülü (Ek-T g-2): R = ρ/(2D). Kare levha, yüzeyde (Ek-T h-1): R = ρ/(2,2·S).
 * Yönetmelik metni (Ek-K, Ek-T formül görselleri dahil):
 *   https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.10392.doc (görseller: 7.5.10392_dosyalar/image118, 119, 121, 180, 199, 201)
 * Yönetmelik Ek-T'deki düşey daire levha (R = ρ/(2D)·(0,5 + d/(4πH)), d "levhanın kalınlığı") ve derindeki kare levha
 * formülleri alınmadı: ilkinde d'nin tanımı boyutça kuşkulu, ikincisinde "H < S / H > S" etiketleri formüllerle güvenle
 * eşleştirilemedi.
 *
 * TT sistem koşulu (Yönetmelik Madde 8-a4/ii, Çizelge-12): R_A ≤ U_L/I_a; hata akımı koruma düzeninde I_a = IΔn,
 * seçici (S) tipte R_A ≤ U_L/(2·IΔn). U_L config'ten (tesisatGuc.dokunmaGerilimi).
 */
import { latexSpec } from "@/lib/calc/latex";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { num, qNum, qText, specOf } from "./guc-ortak";

const WHERE = "topraklama-direnci";

export type TopraklayiciTipi = "cubuk" | "paralel" | "serit" | "halka" | "gozlu" | "levhaDaire" | "levhaKare";
export type CubukFormulu = "dwight" | "yonetmelik";
export type TtKontrol = "yok" | "rcd" | "rcdS" | "ia";

const REF_YONETMELIK: Reference = {
  standard: "Elektrik Tesislerinde Topraklamalar Yönetmeliği",
  title: "RG 21/08/2001-24500 (son değişiklik RG 04/12/2019-30968)",
  clause: "Madde 8-a4/ii, Çizelge-11, Çizelge-12",
};

const MESSAGES = {
  shortRod: "Çubuk boyu çapına göre çok kısa: formülün logaritma terimi pozitif kalmıyor (L ≫ d olmalı).",
  shortStrip: "Şerit/halka uzunluğu eşdeğer çapa göre çok kısa: formülün logaritma terimi pozitif kalmıyor (L ≫ d olmalı).",
  homojen:
    "Homojen toprak kabul edildi (tek ρ değeri). Toprak özdirenci nem ve mevsimle değişir; tasarımda yerinde ölçülmüş değer kullanılmalı ve kurulumdan sonra direnç ölçülmelidir.",
  dwight:
    "Dwight formülünde a çubuğun yarıçapıdır (a = d/2); burada çap girilir ve ln(8L/d) − 1 biçimi kullanılır. Yönetmelik Ek-K formülü (−1 terimi yok) aynı çubukta biraz daha büyük sonuç verir.",
  yonetmelik: "Topraklamalar Yönetmeliği Ek-K (Şekil-K.2) derin topraklayıcı formülü kullanıldı; d çubuğun çapıdır.",
  paralel:
    "Kullanım katsayısı η, çubuk sayısına ve aralığına göre tablolardan alınır; çubuklar arası karşılıklı etkiyi temsil eder. Yönetmelik Ek-T (b): çubuklar arasındaki açıklık en az bir topraklayıcı boyunun iki katı olmalıdır.",
  serit: "Yönetmelik Ek-K şerit topraklayıcı formülü (yüzeye yakın, 0,5–1 m derinlik) kullanıldı.",
  halka: "Yönetmelik Ek-K halka topraklayıcı formülü kullanıldı (D = L/π). Bu ifade aynı uzunluktaki düz şerit formülüne eşittir.",
  gozlu: "Yönetmelik Ek-K gözlü topraklayıcı yaklaşık formülü kullanıldı; D, gözlü alanına eşit alanlı dairenin çapıdır.",
  levhaDaire: "Yönetmelik Ek-T (g-2) yatay gömülü daire levha formülü kullanıldı. Yönetmelik levha topraklayıcı kullanımını tavsiye etmez (Madde 9-a).",
  levhaKare: "Yönetmelik Ek-T (h-1) yüzeyde kare levha formülü kullanıldı. Yönetmelik levha topraklayıcı kullanımını tavsiye etmez (Madde 9-a).",
  ttOk: (r: string, rmax: string) =>
    `TT koşulu sağlanıyor: yayılma direnci ${r} ≤ ${rmax}. R_A, topraklayıcı ile koruma iletkeninin toplam direncidir; koruma iletkeninin direnci de bu sınır içinde kalmalıdır.`,
  ttFail: (r: string, rmax: string) =>
    `TT koşulu sağlanmıyor: yayılma direnci ${r} > ${rmax} (R_A·I_a ≤ U_L). Topraklayıcıyı büyütün (çubuk sayısı/boyu) veya daha düşük anma akımlı koruma düzeni kullanın.`,
} as const;

const OUTPUTS: OutputSpec[] = [
  { key: "R", label: "Yayılma direnci", symbol: "R_E", dimension: "direnc", defaultUnit: "ohm" },
  { key: "R1", label: "Tek çubuğun yayılma direnci", symbol: "R_1", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Dhalka", label: "Halka çapı", symbol: "D", dimension: "uzunluk", defaultUnit: "m" },
  { key: "RAmaks", label: "TT sisteminde izin verilen en büyük topraklama direnci", symbol: "R_{A,\\max}", dimension: "direnc", defaultUnit: "ohm" },
];

const S = (key: string) => specOf(OUTPUTS, key);
const qR = (v: number) => latexSpec(S("R"), v);
const qRho = (v: number) => latexSpec({ dimension: "ozdirenc", defaultUnit: "ohm_m" }, v);
const qM = (v: number) => latexSpec({ dimension: "uzunluk", defaultUnit: "m" }, v);
const qMm = (v: number) => latexSpec({ dimension: "uzunluk", defaultUnit: "mm" }, v);
const qI = (v: number) => latexSpec({ dimension: "akim", defaultUnit: "A" }, v);
const qV = (v: number) => latexSpec({ dimension: "gerilim", defaultUnit: "V" }, v);

const isRod = (tip: unknown) => tip === "cubuk" || tip === "paralel";

function crossChecks(inputs: ComputeInputs): Check[] {
  if (isRod(inputs.tip)) {
    const L = num(inputs, "L", WHERE);
    const d = num(inputs, "d", WHERE);
    const arg = inputs.formul === "yonetmelik" ? Math.log((4 * L) / d) : Math.log((8 * L) / d) - 1;
    if (!(arg > 0)) return [{ level: "hata", message: MESSAGES.shortRod }];
  } else if (inputs.tip === "serit" || inputs.tip === "halka") {
    const L = num(inputs, "Lyatay", WHERE);
    const d = num(inputs, "dYatay", WHERE);
    if (!((2 * L) / d > 1)) return [{ level: "hata", message: MESSAGES.shortStrip }];
  }
  return [];
}

/** Tek çubuk direnci ve adımı */
function rod(inputs: ComputeInputs, rho: number): { R: number; step: Step } {
  const L = num(inputs, "L", WHERE);
  const d = num(inputs, "d", WHERE);
  if (inputs.formul === "yonetmelik") {
    const R = (rho / (2 * Math.PI * L)) * Math.log((4 * L) / d);
    return {
      R,
      step: {
        label: "Çubuk topraklayıcı (Yönetmelik Ek-K)",
        latex: `R = \\frac{\\rho}{2\\pi L} \\ln\\frac{4L}{d} = \\frac{${qRho(rho)}}{2\\pi \\cdot ${qM(L)}} \\ln\\frac{4 \\cdot ${qM(L)}}{${qMm(d)}} = ${qR(R)}`,
      },
    };
  }
  const R = (rho / (2 * Math.PI * L)) * (Math.log((8 * L) / d) - 1);
  return {
    R,
    step: {
      label: "Çubuk topraklayıcı (Dwight; a = d/2 yarıçap)",
      latex: `R = \\frac{\\rho}{2\\pi L} \\left[\\ln\\frac{4L}{a} - 1\\right] = \\frac{\\rho}{2\\pi L} \\left[\\ln\\frac{8L}{d} - 1\\right] = \\frac{${qRho(rho)}}{2\\pi \\cdot ${qM(L)}} \\left[\\ln\\frac{8 \\cdot ${qM(L)}}{${qMm(d)}} - 1\\right] = ${qR(R)}`,
    },
  };
}

function ttLimit(inputs: ComputeInputs, ctx: CalcContext): { RAmaks: number; step: Step } | null {
  const tt = inputs.tt as TtKontrol;
  if (tt === "yok") return null;
  const UL = inputs.UL === "25" ? ctx.limits.tesisatGuc.dokunmaGerilimi.dusuk : ctx.limits.tesisatGuc.dokunmaGerilimi.normal;
  if (tt === "ia") {
    const Ia = num(inputs, "Ia", WHERE);
    const RAmaks = UL / Ia;
    return {
      RAmaks,
      step: { label: "TT koşulu: izin verilen en büyük direnç", latex: `R_{A,\\max} = \\frac{U_L}{I_a} = \\frac{${qV(UL)}}{${qI(Ia)}} = ${qR(RAmaks)}` },
    };
  }
  const IdN = num(inputs, "IdN", WHERE);
  if (tt === "rcdS") {
    const RAmaks = UL / (2 * IdN);
    return {
      RAmaks,
      step: {
        label: "TT koşulu: seçici (S) hata akımı koruma düzeni",
        latex: `R_{A,\\max} = \\frac{U_L}{2 \\cdot I_{\\Delta n}} = \\frac{${qV(UL)}}{2 \\cdot ${qI(IdN)}} = ${qR(RAmaks)}`,
      },
    };
  }
  if (tt === "rcd") {
    const RAmaks = UL / IdN;
    return {
      RAmaks,
      step: { label: "TT koşulu: hata akımı koruma düzeni", latex: `R_{A,\\max} = \\frac{U_L}{I_{\\Delta n}} = \\frac{${qV(UL)}}{${qI(IdN)}} = ${qR(RAmaks)}` },
    };
  }
  throw new Error(`${WHERE}: bilinmeyen TT kontrolü "${String(tt)}"`);
}

export const topraklamaDirenci: CalcDefinition = {
  id: "2.7",
  slug: "topraklama-direnci",
  category: "tesisat",
  title: "Topraklama direnci",
  description:
    "Çubuk, paralel çubuk, şerit, halka, gözlü ve levha topraklayıcıların homojen topraktaki yayılma direncini hesaplayın; TT sisteminde koruma düzenine göre izin verilen en büyük topraklama direnciyle karşılaştırın.",
  formulas: [
    { label: "Çubuk (Dwight; a yarıçap, d çap)", latex: "R = \\frac{\\rho}{2\\pi L}\\left[\\ln\\frac{4L}{a} - 1\\right] = \\frac{\\rho}{2\\pi L}\\left[\\ln\\frac{8L}{d} - 1\\right]" },
    { label: "Çubuk (Yönetmelik Ek-K; d çap)", latex: "R = \\frac{\\rho}{2\\pi L} \\ln\\frac{4L}{d}" },
    { label: "Paralel çubuklar", latex: "R_n = \\frac{R_1}{n \\cdot \\eta}" },
    { label: "Şerit (Ek-K)", latex: "R = \\frac{\\rho}{\\pi L} \\ln\\frac{2L}{d}" },
    { label: "Halka (Ek-K)", latex: "R = \\frac{\\rho}{\\pi^2 D} \\ln\\frac{2\\pi D}{d}, \\quad D = \\frac{L}{\\pi}" },
    { label: "Gözlü (Ek-K) ve yatay daire levha (Ek-T)", latex: "R = \\frac{\\rho}{2D}" },
    { label: "Kare levha, yüzeyde (Ek-T)", latex: "R = \\frac{\\rho}{2{,}2 \\cdot S}" },
    { label: "TT sistem koşulu", latex: "R_A \\cdot I_a \\leq U_L" },
  ],
  references: [
    { ...REF_YONETMELIK, clause: "Ek-K (K.2), Ek-T, Madde 8-a4/ii, Çizelge-12" },
    {
      standard: "Dwight (1936)",
      title: "H. B. Dwight, Calculation of resistances to ground, AIEE Transactions 55(12), s. 1319–1328",
      note: "Tek çubuk formülü; a yarıçaptır",
    },
    { standard: "IEC 60364-5-54", title: "Alçak gerilim elektrik tesisleri — Bölüm 5-54: Topraklama düzenekleri ve koruma iletkenleri" },
  ],
  inputs: [
    {
      kind: "select",
      key: "tip",
      label: "Topraklayıcı tipi",
      options: [
        { value: "cubuk", label: "Tek çubuk (derin) topraklayıcı" },
        { value: "paralel", label: "Paralel çubuklar" },
        { value: "serit", label: "Şerit / örgülü iletken (yüzeysel)" },
        { value: "halka", label: "Halka topraklayıcı" },
        { value: "gozlu", label: "Gözlü topraklayıcı (yaklaşık)" },
        { value: "levhaDaire", label: "Daire levha (yatay gömülü)" },
        { value: "levhaKare", label: "Kare levha (yüzeyde)" },
      ],
      default: "cubuk",
    },
    {
      kind: "select",
      key: "formul",
      label: "Çubuk formülü",
      options: [
        { value: "dwight", label: "Dwight: ln(8L/d) − 1 (d çap)" },
        { value: "yonetmelik", label: "Topraklamalar Yönetmeliği Ek-K: ln(4L/d)" },
      ],
      default: "dwight",
      visibleWhen: { key: "tip", equals: ["cubuk", "paralel"] },
    },
    {
      kind: "number",
      key: "rho",
      label: "Toprak özdirenci",
      symbol: "\\rho",
      dimension: "ozdirenc",
      defaultUnit: "ohm_m",
      units: ["ohm_m"],
      default: 100,
      min: 0,
      minExclusive: true,
      help: "Yerinde ölçülmelidir. Fikir vermesi için yönetmelik Çizelge-K.1: çamur/kil/humus 20–200 Ω·m, kum 200–2500 Ω·m.",
    },
    {
      kind: "number",
      key: "L",
      label: "Çubuk boyu",
      symbol: "L",
      dimension: "uzunluk",
      defaultUnit: "m",
      units: ["m", "cm", "ft"],
      default: 3,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "tip", equals: ["cubuk", "paralel"] },
    },
    {
      kind: "number",
      key: "d",
      label: "Çubuk çapı",
      symbol: "d",
      dimension: "uzunluk",
      defaultUnit: "mm",
      units: ["mm", "cm", "in"],
      default: 16,
      min: 0,
      minExclusive: true,
      help: "Çap girilir (ör. 16 mm). Dwight formülündeki yarıçap a = d/2 hesapta kullanılır.",
      visibleWhen: { key: "tip", equals: ["cubuk", "paralel"] },
    },
    {
      kind: "number",
      key: "n",
      label: "Çubuk sayısı",
      symbol: "n",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 4,
      min: 2,
      integer: true,
      visibleWhen: { key: "tip", equals: "paralel" },
    },
    {
      kind: "number",
      key: "eta",
      label: "Kullanım katsayısı (paralel çalışma)",
      symbol: "\\eta",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 0.8,
      min: 0,
      minExclusive: true,
      max: 1,
      help: "Çubuk sayısına, dizilişe ve aralığa bağlı katsayı (≤ 1); ders kitabı veya üretici tablolarından alınır. Burada örnek değerdir.",
      visibleWhen: { key: "tip", equals: "paralel" },
    },
    {
      kind: "number",
      key: "Lyatay",
      label: "Şerit / halka uzunluğu",
      symbol: "L",
      dimension: "uzunluk",
      defaultUnit: "m",
      units: ["m", "ft"],
      default: 20,
      min: 0,
      minExclusive: true,
      help: "Halkada çevre uzunluğu (D = L/π).",
      visibleWhen: { key: "tip", equals: ["serit", "halka"] },
    },
    {
      kind: "number",
      key: "dYatay",
      label: "Eşdeğer çap",
      symbol: "d",
      dimension: "uzunluk",
      defaultUnit: "mm",
      units: ["mm", "cm"],
      default: 15,
      min: 0,
      minExclusive: true,
      help: "Yönetmelik Ek-K tanımı: örgülü iletken çapı veya şerit kalınlığının yarısı; yönetmelikteki eğriler için 0,015 m kabul edilmiştir.",
      visibleWhen: { key: "tip", equals: ["serit", "halka"] },
    },
    {
      kind: "number",
      key: "Dgozlu",
      label: "Gözlü alanına eşit alanlı dairenin çapı",
      symbol: "D",
      dimension: "uzunluk",
      defaultUnit: "m",
      units: ["m", "ft"],
      default: 20,
      min: 0,
      minExclusive: true,
      help: "D = √(4·A/π), A gözlü topraklayıcının kapladığı alan.",
      visibleWhen: { key: "tip", equals: "gozlu" },
    },
    {
      kind: "number",
      key: "Dlevha",
      label: "Levha çapı",
      symbol: "D",
      dimension: "uzunluk",
      defaultUnit: "m",
      units: ["m", "cm"],
      default: 1,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "tip", equals: "levhaDaire" },
    },
    {
      kind: "number",
      key: "Slevha",
      label: "Kare levhanın kenar uzunluğu",
      symbol: "S",
      dimension: "uzunluk",
      defaultUnit: "m",
      units: ["m", "cm"],
      default: 1,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "tip", equals: "levhaKare" },
    },
    {
      kind: "select",
      key: "tt",
      label: "TT sistemi koşulu (R_A·I_a ≤ U_L)",
      options: [
        { value: "rcd", label: "Hata akımı koruma düzeni (RCD)" },
        { value: "rcdS", label: "Seçici (S tipi) hata akımı koruma düzeni" },
        { value: "ia", label: "Aşırı akım koruma düzeni (I_a gir)" },
        { value: "yok", label: "Kontrol etme" },
      ],
      default: "rcd",
    },
    {
      kind: "select",
      key: "UL",
      label: "İzin verilen sürekli dokunma gerilimi",
      options: [
        { value: "50", label: "U_L = 50 V" },
        { value: "25", label: "U_L = 25 V" },
      ],
      default: "50",
      visibleWhen: { key: "tt", equals: ["rcd", "rcdS", "ia"] },
    },
    {
      kind: "number",
      key: "IdN",
      label: "Anma hata (kaçak) akımı",
      symbol: "I_{\\Delta n}",
      dimension: "akim",
      defaultUnit: "mA",
      units: ["mA", "A"],
      default: 300,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "tt", equals: ["rcd", "rcdS"] },
    },
    {
      kind: "number",
      key: "Ia",
      label: "Koruma düzeninin otomatik açma akımı",
      symbol: "I_a",
      dimension: "akim",
      defaultUnit: "A",
      units: ["A", "kA"],
      default: 100,
      min: 0,
      minExclusive: true,
      help: "Ters zamanlı düzende 5 s içinde açtıran en küçük akım; ani açmalı düzende ani açtıran en küçük akım (Yönetmelik Madde 8-a4/ii).",
      visibleWhen: { key: "tt", equals: "ia" },
    },
  ],
  outputs: OUTPUTS,

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs, ctx) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const tip = inputs.tip as TopraklayiciTipi;
    const rho = num(inputs, "rho", WHERE);
    const steps: Step[] = [];
    const checks: Check[] = [{ level: "ok", message: MESSAGES.homojen }];
    const outputs: Record<string, number> = {};
    let R: number;

    if (tip === "cubuk" || tip === "paralel") {
      const r1 = rod(inputs, rho);
      steps.push(r1.step);
      checks.push({ level: "ok", message: inputs.formul === "yonetmelik" ? MESSAGES.yonetmelik : MESSAGES.dwight });
      if (tip === "paralel") {
        const n = num(inputs, "n", WHERE);
        const eta = num(inputs, "eta", WHERE);
        R = r1.R / (n * eta);
        outputs.R1 = r1.R;
        steps.push({
          label: "Paralel çubuklar",
          latex: `R_n = \\frac{R_1}{n \\cdot \\eta} = \\frac{${qR(r1.R)}}{${qNum(n)} \\cdot ${qNum(eta)}} = ${qR(R)}`,
        });
        checks.push({ level: "ok", message: MESSAGES.paralel });
      } else {
        R = r1.R;
      }
    } else if (tip === "serit") {
      const L = num(inputs, "Lyatay", WHERE);
      const d = num(inputs, "dYatay", WHERE);
      R = (rho / (Math.PI * L)) * Math.log((2 * L) / d);
      steps.push({
        label: "Şerit topraklayıcı (Ek-K)",
        latex: `R = \\frac{\\rho}{\\pi L} \\ln\\frac{2L}{d} = \\frac{${qRho(rho)}}{\\pi \\cdot ${qM(L)}} \\ln\\frac{2 \\cdot ${qM(L)}}{${qMm(d)}} = ${qR(R)}`,
      });
      checks.push({ level: "ok", message: MESSAGES.serit });
    } else if (tip === "halka") {
      const L = num(inputs, "Lyatay", WHERE);
      const d = num(inputs, "dYatay", WHERE);
      const D = L / Math.PI;
      R = (rho / (Math.PI * Math.PI * D)) * Math.log((2 * Math.PI * D) / d);
      outputs.Dhalka = D;
      steps.push(
        { label: "Halka çapı", latex: `D = \\frac{L}{\\pi} = \\frac{${qM(L)}}{\\pi} = ${qM(D)}` },
        {
          label: "Halka topraklayıcı (Ek-K)",
          latex: `R = \\frac{\\rho}{\\pi^2 D} \\ln\\frac{2\\pi D}{d} = \\frac{${qRho(rho)}}{\\pi^2 \\cdot ${qM(D)}} \\ln\\frac{2\\pi \\cdot ${qM(D)}}{${qMm(d)}} = ${qR(R)}`,
        },
      );
      checks.push({ level: "ok", message: MESSAGES.halka });
    } else if (tip === "gozlu" || tip === "levhaDaire") {
      const D = num(inputs, tip === "gozlu" ? "Dgozlu" : "Dlevha", WHERE);
      R = rho / (2 * D);
      steps.push({
        label: tip === "gozlu" ? "Gözlü topraklayıcı (Ek-K)" : "Daire levha, yatay (Ek-T)",
        latex: `R = \\frac{\\rho}{2D} = \\frac{${qRho(rho)}}{2 \\cdot ${qM(D)}} = ${qR(R)}`,
      });
      checks.push({ level: "ok", message: tip === "gozlu" ? MESSAGES.gozlu : MESSAGES.levhaDaire });
    } else if (tip === "levhaKare") {
      const Sk = num(inputs, "Slevha", WHERE);
      R = rho / (2.2 * Sk);
      steps.push({
        label: "Kare levha, yüzeyde (Ek-T)",
        latex: `R = \\frac{\\rho}{2{,}2 \\cdot S} = \\frac{${qRho(rho)}}{2{,}2 \\cdot ${qM(Sk)}} = ${qR(R)}`,
      });
      checks.push({ level: "ok", message: MESSAGES.levhaKare });
    } else {
      throw new Error(`${WHERE}: bilinmeyen topraklayıcı tipi "${String(tip)}"`);
    }
    outputs.R = R;

    const tt = ttLimit(inputs, ctx);
    if (tt) {
      outputs.RAmaks = tt.RAmaks;
      steps.push(tt.step);
      const rText = qText(S("R"), R);
      const maxText = qText(S("RAmaks"), tt.RAmaks);
      checks.push(
        R <= tt.RAmaks
          ? { level: "ok", message: MESSAGES.ttOk(rText, maxText), reference: REF_YONETMELIK }
          : { level: "uyari", message: MESSAGES.ttFail(rText, maxText), reference: REF_YONETMELIK },
      );
    }

    return { outputs, steps, checks };
  },
};
