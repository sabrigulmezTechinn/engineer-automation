/**
 * KAPSAM 2.1 — Kablo kesiti seçimi.
 *
 * Düzeltilmiş akım taşıma kapasitesi I_z = I₀·k_t·k_g·k_ρ; seçim koşulu I_z ≥ I_b.
 * - I₀ (temel akım taşıma kapasitesi): IEC 60364-5-52 tabloları telif nedeniyle gömülmez (KAPSAM §5.1). İki yol:
 *   (a) Prysmian kataloğundaki 4 damarlı NYY (PVC) ve YXV/2XY (XLPE) tabloları (kablo-verileri.ts): koşulları sağlayan
 *       en küçük kesit seçilir; (b) kullanıcı kendi katalog/standart verisinden I₀'ı elle girer ve kablo denetlenir.
 * - k_t: sıcaklık katsayısı fizik formülüyle (iletken θ_maks'ta tutulurken atılabilen ısı ΔT ile, kayıp I² ile
 *   orantılı): k_t = √((θ_maks − θ_ort)/(θ_maks − θ_ref)). θ_maks ve θ_ref config'ten (kaynaklarıyla).
 * - k_g (gruplama) ve k_ρ (toprak ısıl direnci) yalnızca tablolarda verildiği için kullanıcı girdisidir.
 * - Koruma seçilirse IEC 60364-4-43 koordinasyonu da seçime katılır: I_z ≥ I_n ve I₂ ≤ 1,45·I_z (I₂ = k₂·I_n,
 *   koruma tipine göre; kablo-ortak.ts). I_b ≤ I_n kabloya bağlı olmadığından ayrıca denetlenir.
 */
import { latexNum, latexSpec, latexSpecOperand } from "@/lib/calc/latex";
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
import {
  K2_YARDIM,
  REF_IEC_60269,
  REF_IEC_60364_4_43,
  REF_IEC_60898_1,
  REF_IEC_60947_2,
  akimMetni,
  i2Katsayisi,
  kabloKosullariSaglaniyor,
  koordinasyonAdimlari,
  koordinasyonKontrolleri,
  num,
  optNum,
  qI,
  sicaklikKatsayisi,
  type KorumaTipi,
} from "./kablo-ortak";
import { KABLO_KATALOGLARI, katalogSatiriSI, type KabloKatalogu } from "./kablo-verileri";

export type KesitYontemi = "katalog_nyy" | "katalog_yxv" | "elle";
export type Doseme = "hava" | "toprak";
export type Yalitkan = "pvc" | "xlpe" | "epr";
export type Koruma = "yok" | KorumaTipi;

const WHERE = "kablo-kesiti-secimi";

const REF_60364_5_52: Reference = {
  standard: "IEC 60364-5-52 (TS HD 60364-5-52)",
  title: "Alçak gerilim elektrik tesisleri — Bölüm 5-52: Elektrik donanımının seçimi ve tesisi — Kablo sistemleri",
  note: "Akım taşıma kapasitesi ve düzeltme katsayıları. Standardın tabloları telif nedeniyle gömülmedi (KAPSAM §5.1): temel değerler üretici kataloğundan veya kullanıcıdan alınır.",
};

const REF_PRYSMIAN: Reference = {
  standard: "Prysmian Türkiye kataloğu",
  title: "YVV-U/YVV-R/NYY ve YXV-U/YXV-R/YE3V/2XY 0,6/1 kV — Teknik özellikler",
  clause: "4 damarlı tablolar, s. 73 (NYY) ve s. 89 (YXV)",
  note: "Referans koşulları: toprak 20 °C, hava 30 °C, 1 K·m/W, yük faktörü 0,7. tr.prysmian.com",
};

const MESSAGES = {
  ambientTooHigh: (amb: string, max: string) =>
    `Ortam sıcaklığı (${amb}) yalıtkanın en yüksek işletme sıcaklığına (${max}) eşit veya ondan büyük: kablo bu ortamda yüklenemez.`,
  refTooHigh: (ref: string, max: string) =>
    `Referans ortam sıcaklığı (${ref}) yalıtkanın en yüksek işletme sıcaklığından (${max}) küçük olmalıdır.`,
  catalog: (k: KabloKatalogu) => `Katalog: ${k.ad} (${k.sayfa}). ${k.referansNotu}`,
  buriedLoadFactor:
    "Toprakta katalog değerleri 0,7 yük faktörü (çevrimsel yük) içindir: sürekli yükte, katalogdaki veya standarttaki düzeltmeyi toprak düzeltme katsayısına (k_ρ) katın.",
  noSize: (s: string, iz: string) =>
    `Katalogdaki en büyük kesit (${s}, I_z = ${iz}) bile koşulları sağlamıyor: paralel kablo, farklı döşeme veya daha yüksek sıcaklık sınıflı (XLPE) kablo düşünün.`,
  manual:
    "I₀ kullanıcı verisidir: değerin, seçilen döşeme biçimi ve buradaki referans sıcaklığı için olduğundan emin olun.",
} as const;

const TEMP_UNITS = ["degC", "degF", "K"];

const IN = {
  thetaHava: {
    kind: "number",
    key: "thetaHava",
    label: "Ortam (hava) sıcaklığı",
    symbol: "\\theta_{\\text{ort}}",
    dimension: "sicaklik",
    defaultUnit: "degC",
    units: TEMP_UNITS,
    default: 40,
    min: 0,
    visibleWhen: { key: "doseme", equals: "hava" },
  },
  thetaToprak: {
    kind: "number",
    key: "thetaToprak",
    label: "Toprak sıcaklığı",
    symbol: "\\theta_{\\text{ort}}",
    dimension: "sicaklik",
    defaultUnit: "degC",
    units: TEMP_UNITS,
    default: 25,
    min: 0,
    visibleWhen: { key: "doseme", equals: "toprak" },
  },
} satisfies Record<string, NumberInputSpec>;

const OUT = {
  kt: { key: "kt", label: "Sıcaklık düzeltme katsayısı", symbol: "k_t", dimension: "boyutsuz", defaultUnit: "unitless" },
  k: { key: "k", label: "Toplam düzeltme katsayısı", symbol: "k", dimension: "boyutsuz", defaultUnit: "unitless" },
  kesit: { key: "kesit", label: "Seçilen kesit", symbol: "S", dimension: "alan", defaultUnit: "mm2", units: ["mm2"] },
  I0: { key: "I0", label: "Temel akım taşıma kapasitesi (katalog)", symbol: "I_0", dimension: "akim", defaultUnit: "A" },
  Iz: { key: "Iz", label: "Düzeltilmiş akım taşıma kapasitesi", symbol: "I_z", dimension: "akim", defaultUnit: "A" },
  I2: { key: "I2", label: "Korumanın geleneksel açma akımı", symbol: "I_2", dimension: "akim", defaultUnit: "A" },
  I2sinir: { key: "I2sinir", label: "İzin verilen en büyük I₂ (1,45·I_z)", symbol: "1{,}45 \\cdot I_z", dimension: "akim", defaultUnit: "A" },
  R20: {
    key: "R20",
    label: "İletken direnci (20 °C, DC, katalog)",
    symbol: "R_{20}",
    dimension: "direnc_uzunluk",
    defaultUnit: "ohm_per_km",
    units: ["ohm_per_km", "mohm_per_m", "ohm_per_m"],
  },
} satisfies Record<string, OutputSpec>;

const qT = (spec: NumberInputSpec, kelvin: number) => latexSpec(spec, kelvin);
const qTop = (spec: NumberInputSpec, kelvin: number) => latexSpecOperand(spec, kelvin);
const qK = (x: number) => latexNum(x);

function tempText(kelvin: number): string {
  return formatQuantity(fromSI(kelvin, "degC"), "degC");
}

function catalogOf(inputs: ComputeInputs): KabloKatalogu | undefined {
  const y = inputs.yontem as KesitYontemi;
  if (y === "katalog_nyy") return KABLO_KATALOGLARI.nyy;
  if (y === "katalog_yxv") return KABLO_KATALOGLARI.yxv;
  if (y === "elle") return undefined;
  throw new Error(`${WHERE}: bilinmeyen yöntem "${String(y)}"`);
}

function insulation(inputs: ComputeInputs): Yalitkan {
  return catalogOf(inputs)?.yalitkan ?? (inputs.yalitkan as Yalitkan);
}

/** Sıcaklıklar (K) ve kullanılan ortam sıcaklığı girdisinin tanımı */
function temperatures(inputs: ComputeInputs, ctx: CalcContext) {
  const lim = ctx.limits.tesisatKablo;
  const doseme = inputs.doseme as Doseme;
  const thetaMaks = lim.yalitkanMaksSicaklik[insulation(inputs)];
  const ambSpec = doseme === "toprak" ? IN.thetaToprak : IN.thetaHava;
  const thetaOrt = num(inputs, ambSpec.key, WHERE);
  const thetaRef = optNum(inputs, "thetaRef") ?? lim.referansOrtamSicakligi[doseme];
  return { doseme, thetaMaks, thetaOrt, thetaRef, ambSpec };
}

function crossChecks(inputs: ComputeInputs, ctx: CalcContext): Check[] {
  const { thetaMaks, thetaOrt, thetaRef } = temperatures(inputs, ctx);
  if (!(thetaOrt < thetaMaks)) {
    return [{ level: "hata", message: MESSAGES.ambientTooHigh(tempText(thetaOrt), tempText(thetaMaks)) }];
  }
  if (!(thetaRef < thetaMaks)) {
    return [{ level: "hata", message: MESSAGES.refTooHigh(tempText(thetaRef), tempText(thetaMaks)) }];
  }
  return [];
}

function compute(inputs: ComputeInputs, ctx: CalcContext) {
  const blocking = crossChecks(inputs, ctx);
  if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

  const lim = ctx.limits.tesisatKablo;
  const k145 = lim.koruma.asiriYukKatsayisi;
  const Ib = num(inputs, "Ib", WHERE);
  const { doseme, thetaMaks, thetaOrt, thetaRef, ambSpec } = temperatures(inputs, ctx);
  const kt = sicaklikKatsayisi(thetaMaks, thetaOrt, thetaRef);
  const kg = num(inputs, "kGrup", WHERE);
  const kRho = doseme === "toprak" ? num(inputs, "kToprak", WHERE) : 1;
  const k = kt * kg * kRho;

  const koruma = inputs.koruma as Koruma;
  const In = koruma === "yok" ? undefined : num(inputs, "In", WHERE);
  const k2 = koruma === "yok" || In === undefined ? undefined : i2Katsayisi(koruma, In, lim.koruma, optNum(inputs, "k2"));
  const I2 = k2 !== undefined && In !== undefined ? k2 * In : undefined;

  const outputs: Record<string, number> = { kt, k };
  const checks: Check[] = [];
  const steps: Step[] = [
    {
      label: "Sıcaklık düzeltme katsayısı",
      latex: `k_t = \\sqrt{\\frac{\\theta_{\\text{maks}} - \\theta_{\\text{ort}}}{\\theta_{\\text{maks}} - \\theta_{\\text{ref}}}} = \\sqrt{\\frac{${qT(ambSpec, thetaMaks)} - ${qTop(ambSpec, thetaOrt)}}{${qT(ambSpec, thetaMaks)} - ${qTop(ambSpec, thetaRef)}}} = ${qK(kt)}`,
    },
    {
      label: "Toplam düzeltme katsayısı",
      latex:
        doseme === "toprak"
          ? `k = k_t \\cdot k_g \\cdot k_\\rho = ${qK(kt)} \\cdot ${qK(kg)} \\cdot ${qK(kRho)} = ${qK(k)}`
          : `k = k_t \\cdot k_g = ${qK(kt)} \\cdot ${qK(kg)} = ${qK(k)}`,
    },
  ];

  const catalog = catalogOf(inputs);
  let Iz: number;
  if (catalog) {
    // Kabloya bağlı koşulların hepsi birlikte: I_z ≥ I_b, I_z ≥ I_n, I_z ≥ I₂/1,45
    const terms = [Ib, ...(In !== undefined ? [In] : []), ...(I2 !== undefined ? [I2 / k145] : [])];
    const Igerekli = Math.max(...terms);
    const termLatex = ["I_b", ...(In !== undefined ? ["I_n"] : []), ...(I2 !== undefined ? ["I_2/1{,}45"] : [])];
    const termValues = [qI(Ib), ...(In !== undefined ? [qI(In)] : []), ...(I2 !== undefined ? [qI(I2 / k145)] : [])];
    const maxOf = (xs: string[]) => (xs.length > 1 ? `\\max\\left(${xs.join(",\\ ")}\\right)` : xs[0]);
    steps.push({
      label: "Gereken en küçük temel akım taşıma kapasitesi",
      latex: `I_{0,\\text{gerekli}} = \\frac{${maxOf(termLatex)}}{k} = \\frac{${maxOf(termValues)}}{${qK(k)}} = ${qI(Igerekli / k)}`,
    });

    const rows = catalog.satirlar.map(katalogSatiriSI);
    const chosen = rows.find((r) => kabloKosullariSaglaniyor(Ib, r[doseme] * k, In, I2, k145));
    checks.push({ level: "ok", message: MESSAGES.catalog(catalog), reference: REF_PRYSMIAN });
    if (doseme === "toprak") checks.push({ level: "ok", message: MESSAGES.buriedLoadFactor, reference: REF_PRYSMIAN });
    if (!chosen) {
      const last = rows[rows.length - 1];
      checks.push({
        level: "uyari",
        message: MESSAGES.noSize(formatQuantity(fromSI(last.kesit, "mm2"), "mm2"), akimMetni(last[doseme] * k)),
        reference: REF_60364_5_52,
      });
      return { outputs, steps, checks };
    }
    const I0 = chosen[doseme];
    Iz = I0 * k;
    Object.assign(outputs, { kesit: chosen.kesit, I0, Iz, R20: chosen.r20 });
    steps.push({
      label: `Seçilen kesit (katalog, ${doseme === "toprak" ? "toprakta" : "havada"})`,
      latex: `S = ${latexSpec(OUT.kesit, chosen.kesit)}:\\quad I_z = I_0 \\cdot k = ${qI(I0)} \\cdot ${qK(k)} = ${qI(Iz)}`,
    });
  } else {
    const I0 = num(inputs, "I0", WHERE);
    Iz = I0 * k;
    outputs.Iz = Iz;
    steps.push({
      label: "Düzeltilmiş akım taşıma kapasitesi",
      latex: `I_z = I_0 \\cdot k = ${qI(I0)} \\cdot ${qK(k)} = ${qI(Iz)}`,
    });
    checks.push({ level: "ok", message: MESSAGES.manual, reference: REF_60364_5_52 });
  }

  const sembol = koruma === "kompakt" ? "I_r" : "I_n";
  steps.push(...koordinasyonAdimlari({ Ib, Iz, In, k2, k145, sembol }));
  checks.push(
    ...koordinasyonKontrolleri({ Ib, Iz, In, I2, I2Bilinmiyor: koruma === "gG" && I2 === undefined, k145, sembol }),
  );
  if (I2 !== undefined) outputs.I2 = I2;
  if (koruma !== "yok") outputs.I2sinir = k145 * Iz;

  return { outputs, steps, checks };
}

export const kabloKesitiSecimi: CalcDefinition = {
  id: "2.1",
  slug: "kablo-kesiti-secimi",
  category: "tesisat",
  title: "Kablo kesiti seçimi",
  description:
    "Ortam sıcaklığı, gruplama ve toprak koşullarıyla düzeltilmiş akım taşıma kapasitesini (I_z) hesaplayın; üretici kataloğundan (Prysmian NYY / YXV) I_z ≥ I_b koşulunu sağlayan en küçük kesiti seçin veya kendi verinizdeki I₀ ile kabloyu denetleyin. İsteğe bağlı olarak koruma cihazıyla koordinasyon (I_b ≤ I_n ≤ I_z, I₂ ≤ 1,45·I_z) da seçime katılır.",
  formulas: [
    { label: "Düzeltilmiş akım taşıma kapasitesi", latex: "I_z = I_0 \\cdot k_t \\cdot k_g \\cdot k_\\rho" },
    {
      label: "Sıcaklık düzeltme katsayısı",
      latex: "k_t = \\sqrt{\\frac{\\theta_{\\text{maks}} - \\theta_{\\text{ort}}}{\\theta_{\\text{maks}} - \\theta_{\\text{ref}}}}",
    },
    { label: "Seçim koşulu", latex: "I_z \\geq I_b" },
    { label: "Koruma koordinasyonu", latex: "I_b \\leq I_n \\leq I_z, \\qquad I_2 = k_2 \\cdot I_n \\leq 1{,}45 \\cdot I_z" },
  ],
  references: [REF_60364_5_52, REF_IEC_60364_4_43, REF_PRYSMIAN, REF_IEC_60898_1, REF_IEC_60269, REF_IEC_60947_2],
  inputs: [
    {
      kind: "number",
      key: "Ib",
      label: "Tasarım (yük) akımı",
      symbol: "I_b",
      dimension: "akim",
      defaultUnit: "A",
      default: 45,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "select",
      key: "yontem",
      label: "Akım taşıma kapasitesi verisi",
      options: [
        { value: "katalog_nyy", label: "Katalog: Prysmian NYY (Cu/PVC, 4 damarlı)" },
        { value: "katalog_yxv", label: "Katalog: Prysmian YXV / 2XY (Cu/XLPE, 4 damarlı)" },
        { value: "elle", label: "I₀'ı elle gir (kendi katalog veya standart verim)" },
      ],
      default: "katalog_nyy",
    },
    {
      kind: "select",
      key: "yalitkan",
      label: "Yalıtkan",
      options: [
        { value: "pvc", label: "PVC (θ_maks 70 °C)" },
        { value: "xlpe", label: "XLPE (θ_maks 90 °C)" },
        { value: "epr", label: "EPR (θ_maks 90 °C)" },
      ],
      default: "pvc",
      visibleWhen: { key: "yontem", equals: "elle" },
    },
    {
      kind: "number",
      key: "I0",
      label: "Temel akım taşıma kapasitesi",
      symbol: "I_0",
      dimension: "akim",
      defaultUnit: "A",
      default: 59,
      min: 0,
      minExclusive: true,
      help: "Denetlenen kablonun, seçilen döşeme biçimi ve referans sıcaklığındaki akım taşıma kapasitesi: kablo üreticisinin kataloğundan veya standarttaki (IEC 60364-5-52) tablodan alın.",
      visibleWhen: { key: "yontem", equals: "elle" },
    },
    {
      kind: "select",
      key: "doseme",
      label: "Döşeme",
      options: [
        { value: "hava", label: "Havada" },
        { value: "toprak", label: "Toprakta" },
      ],
      default: "hava",
    },
    IN.thetaHava,
    IN.thetaToprak,
    {
      kind: "number",
      key: "thetaRef",
      label: "Verinin referans ortam sıcaklığı",
      symbol: "\\theta_{\\text{ref}}",
      dimension: "sicaklik",
      defaultUnit: "degC",
      units: TEMP_UNITS,
      min: 0,
      optional: true,
      help: "Boş bırakılırsa havada 30 °C, toprakta 20 °C alınır. Kullandığınız verinin referansı farklıysa girin.",
      visibleWhen: { key: "yontem", equals: "elle" },
    },
    {
      kind: "number",
      key: "kGrup",
      label: "Gruplama katsayısı",
      symbol: "k_g",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 1,
      min: 0,
      minExclusive: true,
      max: 1,
      help: "Aynı güzergâhtaki devre sayısına ve döşeme biçimine göre; standarttaki (IEC 60364-5-52) veya katalogdaki gruplama tablosundan alın. Tek devre için 1.",
    },
    {
      kind: "number",
      key: "kToprak",
      label: "Toprak düzeltme katsayısı (ısıl direnç, yük faktörü)",
      symbol: "k_\\rho",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 1,
      min: 0,
      minExclusive: true,
      help: "Prysmian katalog değerleri 1 K·m/W toprak ısıl direnci ve 0,7 yük faktörü içindir. Toprak ısıl direnci farklıysa veya yük sürekliyse (yük faktörü 1), katalogdaki veya standarttaki düzeltme tablolarından aldığınız katsayıların çarpımını girin. Elle girilen I₀'da kendi verinizin referans koşullarına göre düzeltin.",
      visibleWhen: { key: "doseme", equals: "toprak" },
    },
    {
      kind: "select",
      key: "koruma",
      label: "Aşırı yük koruması",
      options: [
        { value: "yok", label: "Koordinasyon denetlenmesin" },
        { value: "mcb", label: "Minyatür devre kesici (IEC 60898-1)" },
        { value: "gG", label: "gG sigorta (IEC 60269)" },
        { value: "kompakt", label: "Kompakt şalter (IEC 60947-2)" },
      ],
      default: "mcb",
    },
    {
      kind: "number",
      key: "In",
      label: "Koruma anma akımı (kompakt şalterde ayar akımı I_r)",
      symbol: "I_n",
      dimension: "akim",
      defaultUnit: "A",
      default: 50,
      min: 0,
      minExclusive: true,
      help: "Uygun anma akımını seçmek için 2.3 Sigorta / şalter seçimi hesabını kullanabilirsiniz.",
      visibleWhen: { key: "koruma", equals: ["mcb", "gG", "kompakt"] },
    },
    {
      kind: "number",
      key: "k2",
      label: "I₂/I_n oranı (sigorta veri sayfasından)",
      symbol: "k_2",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      min: 1,
      optional: true,
      help: K2_YARDIM,
      visibleWhen: { key: "koruma", equals: "gG" },
    },
  ],
  outputs: [OUT.kesit, OUT.Iz, OUT.I0, OUT.kt, OUT.k, OUT.I2, OUT.I2sinir, OUT.R20],

  validate: (inputs, ctx) => crossChecks(inputs, ctx),
  compute,
};
