/**
 * KAPSAM 4.4 — Op-amp kazancı.
 *
 * İdeal op-amp (sonsuz açık çevrim kazancı) kabulüyle kapalı çevrim kazancı:
 * - Eviren: A = −R_f/R_in; giriş empedansı R_in.
 * - Evirmeyen: A = 1 + R_f/R_g.
 * - Fark yükselteci (R₁ = R₃, R₂ = R₄ eşleşmiş): V_o = (R₂/R₁)·(V₂ − V₁).
 * - Gerilim izleyici: A = 1.
 * - Eviren toplayıcı: V_o = −R_f·Σ V_i/R_i.
 * Kapalı çevrim bant genişliği tek kutuplu (sabit GBW) yaklaşımla f₋₃dB = GBW / NG'dir. NG gürültü (evirmeyen) kazancıdır:
 * evirende 1 + R_f/R_in — sinyal kazancının büyüklüğü |A| DEĞİL (TI SBOA270: kazanç −1 iken NG = 2, bant genişliği GBW/2).
 * Toplayıcıda giriş dirençleri paraleldir: NG = 1 + R_f/(R₁‖R₂‖…) (TI SBOA272).
 * Doyma: çıkış, besleme raylarından kullanıcının girdiği ray payı kadar içeride kırpılır.
 * Ters mod: hedef kazanç ve R_in (R_g) → R_f; seçilen E serisinden en yakın standart değer ve onunla gerçekleşen kazanç.
 */
import { latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import type { ESeriesId } from "../yardimci/e-serileri";
import { REF, eSeriInput, list, num, optNum, specWriters, standartDeger } from "./entegre-ortak";

export type OpampMod = "eviren" | "evirmeyen" | "fark" | "izleyici" | "toplayici" | "eviren-tasarim" | "evirmeyen-tasarim";

const WHERE = "op-amp-kazanci";

/** Hüküm olmayan notlar (kabul, yöntem, hatırlatma). */

const EVIREN: OpampMod[] = ["eviren", "eviren-tasarim"];
const EVIRMEYEN: OpampMod[] = ["evirmeyen", "evirmeyen-tasarim"];
const TASARIM: OpampMod[] = ["eviren-tasarim", "evirmeyen-tasarim"];
const TEK_GIRIS: OpampMod[] = ["eviren", "evirmeyen", "izleyici", "eviren-tasarim", "evirmeyen-tasarim"];

const MESSAGES = {
  besleme: "Pozitif besleme (V₊) negatif beslemeden (V₋) büyük olmalıdır.",
  rayPayi: "Ray payı çok büyük: V₊ − ΔV, V₋ + ΔV'den büyük olmalıdır (çıkışın salınabileceği bir aralık kalmıyor).",
  listeBoyu: (nR: number, nV: number) =>
    `Giriş direnci sayısı (${nR}) ile giriş gerilimi sayısı (${nV}) eşit olmalıdır: her girişin bir direnci ve bir gerilimi vardır.`,
  evirmeyenKazanc:
    "Evirmeyen yükselteçte kazanç 1'den büyük olmalıdır (R_f = (A − 1)·R_g > 0). Kazanç 1 için gerilim izleyiciyi seçin.",
  doymaUst: (vo: string, max: string) =>
    `Çıkış pozitif doyuma gider: ideal çıkış ${vo}, ulaşılabilir en yüksek çıkış ${max} (V₊ − ray payı). Çıkış bu değerde kırpılır; kazancı veya giriş genliğini düşürün.`,
  doymaAlt: (vo: string, min: string) =>
    `Çıkış negatif doyuma gider: ideal çıkış ${vo}, ulaşılabilir en düşük çıkış ${min} (V₋ + ray payı). Çıkış bu değerde kırpılır; kazancı veya giriş genliğini düşürün.`,
  salinimIcinde: (min: string, max: string) => `Çıkış, op-amp'ın salınım sınırları içinde (${min} … ${max}).`,
  ortakMod: (vcm: string) =>
    `Op-amp girişlerindeki ortak mod gerilimi ${vcm}: op-amp'ın giriş ortak mod aralığı içinde kaldığını veri sayfasından denetleyin.`,
  toplayiciZin: "Toplayıcıda her girişin giriş empedansı kendi giriş direncine (R_i) eşittir.",
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Devre",
    options: [
      { value: "eviren", label: "Eviren yükselteç" },
      { value: "evirmeyen", label: "Evirmeyen yükselteç" },
      { value: "fark", label: "Fark yükselteci (eşleşmiş R₁, R₂)" },
      { value: "izleyici", label: "Gerilim izleyici (tampon)" },
      { value: "toplayici", label: "Eviren toplayıcı" },
      { value: "eviren-tasarim", label: "Eviren — hedef kazançtan R_f" },
      { value: "evirmeyen-tasarim", label: "Evirmeyen — hedef kazançtan R_f" },
    ],
    default: "eviren",
  },
  {
    kind: "number",
    key: "Rf",
    label: "Geri besleme direnci",
    symbol: "R_f",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 10,
    min: 0,
    minExclusive: true,
    help: "Çıkış ile eviren (−) giriş arasındaki direnç.",
    visibleWhen: { key: "mod", equals: ["eviren", "evirmeyen", "toplayici"] },
  },
  {
    kind: "number",
    key: "Rin",
    label: "Giriş direnci",
    symbol: "R_{in}",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 1,
    min: 0,
    minExclusive: true,
    help: "Sinyal kaynağı ile eviren (−) giriş arasındaki direnç; devrenin giriş empedansını belirler.",
    visibleWhen: { key: "mod", equals: EVIREN },
  },
  {
    kind: "number",
    key: "Rg",
    label: "Toprak direnci",
    symbol: "R_g",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 1,
    min: 0,
    minExclusive: true,
    help: "Eviren (−) giriş ile toprak arasındaki direnç.",
    visibleWhen: { key: "mod", equals: EVIRMEYEN },
  },
  {
    kind: "number",
    key: "R1",
    label: "Giriş dirençleri (R₁ = R₃)",
    symbol: "R_1",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 10,
    min: 0,
    minExclusive: true,
    help: "V₁ ile eviren giriş arasındaki ve V₂ ile evirmeyen giriş arasındaki eşleşmiş dirençler.",
    visibleWhen: { key: "mod", equals: "fark" },
  },
  {
    kind: "number",
    key: "R2",
    label: "Geri besleme ve toprak dirençleri (R₂ = R₄)",
    symbol: "R_2",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: 20,
    min: 0,
    minExclusive: true,
    help: "Geri besleme direnci ile evirmeyen girişten toprağa (referansa) bağlı eşleşmiş direnç. Eşleşme bozuldukça ortak mod bastırma düşer.",
    visibleWhen: { key: "mod", equals: "fark" },
  },
  {
    kind: "numberList",
    key: "Ri",
    label: "Giriş dirençleri",
    symbol: "R_i",
    dimension: "direnc",
    defaultUnit: "kohm",
    units: ["ohm", "kohm", "Mohm"],
    default: [10, 10, 10],
    min: 0,
    minExclusive: true,
    minItems: 2,
    maxItems: 10,
    help: "Her girişin direnci, noktalı virgülle ayrılmış (R₁; R₂; …). Giriş gerilimleriyle aynı sırada yazın.",
    visibleWhen: { key: "mod", equals: "toplayici" },
  },
  {
    kind: "numberList",
    key: "Vi",
    label: "Giriş gerilimleri",
    symbol: "V_i",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["mV", "V"],
    default: [1, 0.5, -0.2],
    minItems: 2,
    maxItems: 10,
    help: "Her girişin gerilimi (V₁; V₂; …), dirençlerle aynı sırada. Negatif girilebilir.",
    visibleWhen: { key: "mod", equals: "toplayici" },
  },
  {
    kind: "number",
    key: "Ahedef",
    label: "Hedef kazanç (büyüklük)",
    symbol: "|A_v|",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: 10,
    min: 0,
    minExclusive: true,
    help: "V/V cinsinden. Eviren devrede kazancın büyüklüğü (işaret negatiftir); evirmeyen devrede 1'den büyük olmalıdır.",
    visibleWhen: { key: "mod", equals: TASARIM },
  },
  eSeriInput("E96", { key: "mod", equals: TASARIM }),
  {
    kind: "number",
    key: "Vin",
    label: "Giriş gerilimi",
    symbol: "V_{in}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["uV", "mV", "V"],
    default: 0.5,
    help: "Doğru gerilim ya da tepe değeri. Negatif girilebilir.",
    visibleWhen: { key: "mod", equals: TEK_GIRIS },
  },
  {
    kind: "number",
    key: "V1",
    label: "Eviren giriş gerilimi",
    symbol: "V_1",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["uV", "mV", "V"],
    default: 1,
    visibleWhen: { key: "mod", equals: "fark" },
  },
  {
    kind: "number",
    key: "V2",
    label: "Evirmeyen giriş gerilimi",
    symbol: "V_2",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["uV", "mV", "V"],
    default: 1.5,
    visibleWhen: { key: "mod", equals: "fark" },
  },
  {
    kind: "number",
    key: "Vpos",
    label: "Pozitif besleme",
    symbol: "V_+",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["V"],
    default: 15,
  },
  {
    kind: "number",
    key: "Vneg",
    label: "Negatif besleme",
    symbol: "V_-",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["V"],
    default: -15,
    help: "Tek beslemeli devrede 0 V.",
  },
  {
    kind: "number",
    key: "payi",
    label: "Ray payı (çıkış salınım kaybı)",
    symbol: "\\Delta V",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["mV", "V"],
    default: 1.5,
    min: 0,
    help: "Çıkışın her iki besleme rayına ne kadar yaklaşamadığı. Op-amp veri sayfasındaki çıkış salınımı (V_OH, V_OL) değerinden, yük direnci koşuluna dikkat ederek alın; rail-to-rail çıkışlı op-amplarda çok küçüktür.",
  },
  {
    kind: "number",
    key: "GBW",
    label: "Kazanç-bant genişliği çarpımı",
    symbol: "\\text{GBW}",
    dimension: "frekans",
    defaultUnit: "MHz",
    units: ["Hz", "kHz", "MHz"],
    default: 1,
    min: 0,
    minExclusive: true,
    help: "Op-amp veri sayfasındaki GBW (GBP) ya da birim kazanç frekansı.",
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "Rfh", label: "Hesaplanan R_f", symbol: "R_f", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Rfs", label: "Seçilen standart R_f", symbol: "R_{f,\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "A", label: "Gerilim kazancı", symbol: "A_v", dimension: "boyutsuz", defaultUnit: "unitless", unitLabel: "V/V" },
  { key: "AdB", label: "Gerilim kazancı (dB)", symbol: "A_{dB}", dimension: "seviye_db", defaultUnit: "dB" },
  { key: "sapma", label: "Hedef kazançtan sapma", symbol: "\\delta", dimension: "oran", defaultUnit: "percent" },
  { key: "Vout", label: "Çıkış gerilimi (ideal)", symbol: "V_o", dimension: "gerilim", defaultUnit: "V" },
  { key: "VoMax", label: "Çıkış salınımı üst sınırı", symbol: "V_{o,\\max}", dimension: "gerilim", defaultUnit: "V" },
  { key: "VoMin", label: "Çıkış salınımı alt sınırı", symbol: "V_{o,\\min}", dimension: "gerilim", defaultUnit: "V" },
  { key: "NG", label: "Gürültü kazancı", symbol: "\\text{NG}", dimension: "boyutsuz", defaultUnit: "unitless", unitLabel: "V/V" },
  { key: "BW", label: "Kapalı çevrim bant genişliği (−3 dB)", symbol: "f_{-3\\,\\text{dB}}", dimension: "frekans", defaultUnit: "Hz" },
  { key: "Zin", label: "Giriş empedansı", symbol: "Z_{in}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Rpar", label: "Giriş dirençlerinin paraleli", symbol: "R_{\\parallel}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Vcm", label: "Giriş ortak mod gerilimi", symbol: "V_{cm}", dimension: "gerilim", defaultUnit: "V" },
];

const { q, qo, t } = specWriters([...INPUTS, ...OUTPUTS]);
const n = (x: number) => latexNum(x);
const nOp = (x: number) => (x < 0 ? `(${latexNum(x)})` : latexNum(x));

/** Toplayıcı listesinin terimlerini LaTeX'te sıralar: a₁ + a₂ + … */
const sumLatex = (terms: string[]) => terms.join(" + ");

export const opAmpKazanci: CalcDefinition = {
  id: "4.4",
  slug: "op-amp-kazanci",
  category: "elektronik",
  title: "Op-amp kazancı",
  description:
    "Eviren, evirmeyen, fark, izleyici ve toplayıcı op-amp devrelerinin kazancını (V/V ve dB), çıkış gerilimini ve doymayı, gürültü kazancıyla kapalı çevrim bant genişliğini (GBW/NG) hesaplayın; hedef kazançtan standart R_f seçin. İdeal op-amp ve tek kutuplu GBW yaklaşımı kullanılır; büyük sinyalde slew rate ayrıca sınırlar.",
  formulas: [
    { label: "Eviren yükselteç", latex: "A_v = -\\frac{R_f}{R_{in}}, \\quad \\text{NG} = 1 + \\frac{R_f}{R_{in}}, \\quad Z_{in} = R_{in}" },
    { label: "Evirmeyen yükselteç", latex: "A_v = \\text{NG} = 1 + \\frac{R_f}{R_g}" },
    {
      label: "Fark yükselteci (R₁ = R₃, R₂ = R₄)",
      latex: "V_o = \\frac{R_2}{R_1} \\cdot (V_2 - V_1), \\quad \\text{NG} = 1 + \\frac{R_2}{R_1}",
    },
    { label: "Gerilim izleyici", latex: "A_v = \\text{NG} = 1" },
    {
      label: "Eviren toplayıcı",
      latex: "V_o = -R_f \\cdot \\sum_i \\frac{V_i}{R_i}, \\quad \\text{NG} = 1 + \\frac{R_f}{R_1 \\parallel R_2 \\parallel \\cdots}",
    },
    { label: "Kapalı çevrim bant genişliği", latex: "f_{-3\\,\\text{dB}} = \\frac{\\text{GBW}}{\\text{NG}}" },
    { label: "Kazanç (dB)", latex: "A_{dB} = 20 \\log_{10} |A_v|" },
    { label: "Doyma sınırları", latex: "V_- + \\Delta V \\le V_o \\le V_+ - \\Delta V" },
    {
      label: "Ters mod (R_f)",
      latex: "R_f = |A_v| \\cdot R_{in} \\;(\\text{eviren}), \\quad R_f = (A_v - 1) \\cdot R_g \\;(\\text{evirmeyen})",
    },
  ],
  references: [REF.sboa270, REF.sboa271, REF.sboa274, REF.sboa269, REF.sboa272],
  inputs: INPUTS,
  outputs: OUTPUTS,

  validate: (inputs) => {
    const checks: Check[] = [];
    const mode = inputs.mod as OpampMod;
    const Vpos = num(inputs, "Vpos", WHERE);
    const Vneg = num(inputs, "Vneg", WHERE);
    const payi = num(inputs, "payi", WHERE);
    if (Vpos <= Vneg) checks.push({ level: "hata", message: MESSAGES.besleme });
    else if (Vpos - payi <= Vneg + payi) checks.push({ level: "hata", message: MESSAGES.rayPayi });
    if (mode === "toplayici") {
      const Ri = list(inputs, "Ri", WHERE);
      const Vi = list(inputs, "Vi", WHERE);
      if (Ri.length !== Vi.length) checks.push({ level: "hata", message: MESSAGES.listeBoyu(Ri.length, Vi.length) });
    }
    if (mode === "evirmeyen-tasarim") {
      const A = optNum(inputs, "Ahedef");
      if (A !== undefined && A <= 1) checks.push({ level: "hata", message: MESSAGES.evirmeyenKazanc });
    }
    return checks;
  },

  compute: (inputs) => {
    const mode = inputs.mod as OpampMod;
    const Vpos = num(inputs, "Vpos", WHERE);
    const Vneg = num(inputs, "Vneg", WHERE);
    const payi = num(inputs, "payi", WHERE);
    const GBW = num(inputs, "GBW", WHERE);
    const steps: Step[] = [];
    const checks: Check[] = [];
    const outputs: Record<string, number> = {};

    let A: number | undefined;
    let NG: number;
    let Vout: number;
    let Vcm: number | undefined;

    if (mode === "eviren" || mode === "eviren-tasarim") {
      const Rin = num(inputs, "Rin", WHERE);
      let Rf: number;
      if (mode === "eviren-tasarim") {
        const Ah = num(inputs, "Ahedef", WHERE);
        const seri = inputs.seri as ESeriesId;
        const Rfh = Ah * Rin;
        Rf = standartDeger(Rfh, seri, "yakin");
        steps.push({ label: "Hesaplanan R_f", latex: `R_f = |A_v| \\cdot R_{in} = ${n(Ah)} \\cdot ${q("Rin", Rin)} = ${q("Rfh", Rfh)}` });
        steps.push({ label: `Standart R_f (${seri}, en yakın)`, latex: `R_{f,\\text{std}} = ${q("Rfs", Rf)}` });
        outputs.Rfh = Rfh;
        outputs.Rfs = Rf;
        A = -Rf / Rin;
        outputs.sapma = (-A - Ah) / Ah;
        steps.push({ label: "Gerilim kazancı (standart R_f ile)", latex: `A_v = -\\frac{R_{f,\\text{std}}}{R_{in}} = -\\frac{${q("Rfs", Rf)}}{${q("Rin", Rin)}} = ${q("A", A)}` });
        steps.push({
          label: "Hedef kazançtan sapma",
          latex: `\\delta = \\frac{|A_v| - |A_v|_{\\text{hedef}}}{|A_v|_{\\text{hedef}}} = \\frac{${n(-A)} - ${n(Ah)}}{${n(Ah)}} = ${q("sapma", outputs.sapma)}`,
        });
      } else {
        Rf = num(inputs, "Rf", WHERE);
        A = -Rf / Rin;
        steps.push({ label: "Gerilim kazancı", latex: `A_v = -\\frac{R_f}{R_{in}} = -\\frac{${q("Rf", Rf)}}{${q("Rin", Rin)}} = ${q("A", A)}` });
      }
      const rf = mode === "eviren-tasarim" ? "R_{f,\\text{std}}" : "R_f";
      const rfq = mode === "eviren-tasarim" ? q("Rfs", Rf) : q("Rf", Rf);
      NG = 1 + Rf / Rin;
      steps.push({
        label: "Gürültü kazancı",
        latex: `\\text{NG} = 1 + \\frac{${rf}}{R_{in}} = 1 + \\frac{${rfq}}{${q("Rin", Rin)}} = ${q("NG", NG)}`,
      });
      outputs.Zin = Rin;
      steps.push({ label: "Giriş empedansı", latex: `Z_{in} = R_{in} = ${q("Zin", Rin)}` });
      const Vin = num(inputs, "Vin", WHERE);
      Vout = A * Vin;
      steps.push({ label: "Çıkış gerilimi", latex: `V_o = A_v \\cdot V_{in} = ${qo("A", A)} \\cdot ${qo("Vin", Vin)} = ${q("Vout", Vout)}` });
    } else if (mode === "evirmeyen" || mode === "evirmeyen-tasarim") {
      const Rg = num(inputs, "Rg", WHERE);
      let Rf: number;
      if (mode === "evirmeyen-tasarim") {
        const Ah = num(inputs, "Ahedef", WHERE);
        const seri = inputs.seri as ESeriesId;
        const Rfh = (Ah - 1) * Rg;
        Rf = standartDeger(Rfh, seri, "yakin");
        steps.push({ label: "Hesaplanan R_f", latex: `R_f = (A_v - 1) \\cdot R_g = (${n(Ah)} - 1) \\cdot ${q("Rg", Rg)} = ${q("Rfh", Rfh)}` });
        steps.push({ label: `Standart R_f (${seri}, en yakın)`, latex: `R_{f,\\text{std}} = ${q("Rfs", Rf)}` });
        outputs.Rfh = Rfh;
        outputs.Rfs = Rf;
        A = 1 + Rf / Rg;
        outputs.sapma = (A - Ah) / Ah;
        steps.push({
          label: "Gerilim kazancı (standart R_f ile)",
          latex: `A_v = 1 + \\frac{R_{f,\\text{std}}}{R_g} = 1 + \\frac{${q("Rfs", Rf)}}{${q("Rg", Rg)}} = ${q("A", A)}`,
        });
        steps.push({
          label: "Hedef kazançtan sapma",
          latex: `\\delta = \\frac{A_v - A_{v,\\text{hedef}}}{A_{v,\\text{hedef}}} = \\frac{${n(A)} - ${n(Ah)}}{${n(Ah)}} = ${q("sapma", outputs.sapma)}`,
        });
      } else {
        Rf = num(inputs, "Rf", WHERE);
        A = 1 + Rf / Rg;
        steps.push({ label: "Gerilim kazancı", latex: `A_v = 1 + \\frac{R_f}{R_g} = 1 + \\frac{${q("Rf", Rf)}}{${q("Rg", Rg)}} = ${q("A", A)}` });
      }
      NG = A;
      steps.push({ label: "Gürültü kazancı", latex: `\\text{NG} = A_v = ${q("NG", NG)}` });
      const Vin = num(inputs, "Vin", WHERE);
      Vout = A * Vin;
      Vcm = Vin;
      steps.push({ label: "Çıkış gerilimi", latex: `V_o = A_v \\cdot V_{in} = ${n(A)} \\cdot ${qo("Vin", Vin)} = ${q("Vout", Vout)}` });
    } else if (mode === "izleyici") {
      A = 1;
      NG = 1;
      const Vin = num(inputs, "Vin", WHERE);
      Vout = Vin;
      Vcm = Vin;
      steps.push({ label: "Gerilim kazancı ve gürültü kazancı", latex: `A_v = \\text{NG} = 1` });
      steps.push({ label: "Çıkış gerilimi", latex: `V_o = V_{in} = ${q("Vout", Vout)}` });
    } else if (mode === "fark") {
      const R1 = num(inputs, "R1", WHERE);
      const R2 = num(inputs, "R2", WHERE);
      const V1 = num(inputs, "V1", WHERE);
      const V2 = num(inputs, "V2", WHERE);
      A = R2 / R1;
      NG = 1 + R2 / R1;
      Vout = A * (V2 - V1);
      Vcm = (V2 * R2) / (R1 + R2);
      steps.push({ label: "Fark kazancı", latex: `A_v = \\frac{R_2}{R_1} = \\frac{${q("R2", R2)}}{${q("R1", R1)}} = ${q("A", A)}` });
      steps.push({
        label: "Çıkış gerilimi",
        latex: `V_o = A_v \\cdot (V_2 - V_1) = ${n(A)} \\cdot (${q("V2", V2)} - ${qo("V1", V1)}) = ${q("Vout", Vout)}`,
      });
      steps.push({ label: "Gürültü kazancı", latex: `\\text{NG} = 1 + \\frac{R_2}{R_1} = 1 + \\frac{${q("R2", R2)}}{${q("R1", R1)}} = ${q("NG", NG)}` });
      steps.push({
        label: "Girişlerdeki ortak mod gerilimi",
        latex: `V_{cm} = V_2 \\cdot \\frac{R_2}{R_1 + R_2} = ${qo("V2", V2)} \\cdot \\frac{${q("R2", R2)}}{${q("R1", R1)} + ${q("R2", R2)}} = ${q("Vcm", Vcm)}`,
      });
    } else if (mode === "toplayici") {
      const Rf = num(inputs, "Rf", WHERE);
      const Ri = list(inputs, "Ri", WHERE);
      const Vi = list(inputs, "Vi", WHERE);
      let sum = 0;
      let invSum = 0;
      for (let i = 0; i < Ri.length; i++) {
        sum += Vi[i] / Ri[i];
        invSum += 1 / Ri[i];
      }
      Vout = -Rf * sum;
      const Rpar = 1 / invSum;
      NG = 1 + Rf / Rpar;
      outputs.Rpar = Rpar;
      for (let i = 0; i < Ri.length; i++) {
        steps.push({
          label: `${i + 1}. girişin kazancı`,
          latex: `A_{${i + 1}} = -\\frac{R_f}{R_{${i + 1}}} = -\\frac{${q("Rf", Rf)}}{${q("Ri", Ri[i])}} = ${n(-Rf / Ri[i])}`,
        });
      }
      const terms = Ri.map((r, i) => `\\frac{${q("Vi", Vi[i])}}{${q("Ri", r)}}`);
      steps.push({
        label: "Çıkış gerilimi",
        latex: `V_o = -R_f \\cdot \\sum_i \\frac{V_i}{R_i} = -${q("Rf", Rf)} \\cdot \\left( ${sumLatex(terms)} \\right) = ${q("Vout", Vout)}`,
      });
      steps.push({
        label: "Giriş dirençlerinin paraleli",
        latex: `R_{\\parallel} = \\left( ${sumLatex(Ri.map((r) => `\\frac{1}{${q("Ri", r)}}`))} \\right)^{-1} = ${q("Rpar", Rpar)}`,
      });
      steps.push({
        label: "Gürültü kazancı",
        latex: `\\text{NG} = 1 + \\frac{R_f}{R_{\\parallel}} = 1 + \\frac{${q("Rf", Rf)}}{${q("Rpar", Rpar)}} = ${q("NG", NG)}`,
      });
      checks.push({ level: "bilgi", message: MESSAGES.toplayiciZin, reference: REF.sboa272 });
    } else {
      throw new Error(`${WHERE}: bilinmeyen mod "${String(mode)}"`);
    }

    if (A !== undefined) {
      outputs.A = A;
      outputs.AdB = 20 * Math.log10(Math.abs(A));
      steps.push({
        label: "Kazanç (dB)",
        latex: `A_{dB} = 20 \\log_{10} |A_v| = 20 \\log_{10} ${n(Math.abs(A))} = ${q("AdB", outputs.AdB)}`,
      });
    }

    const BW = GBW / NG;
    outputs.NG = NG;
    outputs.BW = BW;
    steps.push({
      label: "Kapalı çevrim bant genişliği",
      latex: `f_{-3\\,\\text{dB}} = \\frac{\\text{GBW}}{\\text{NG}} = \\frac{${q("GBW", GBW)}}{${nOp(NG)}} = ${q("BW", BW)}`,
    });

    const VoMax = Vpos - payi;
    const VoMin = Vneg + payi;
    outputs.Vout = Vout;
    outputs.VoMax = VoMax;
    outputs.VoMin = VoMin;
    steps.push({
      label: "Çıkış salınım sınırları",
      latex: `V_{o,\\max} = V_+ - \\Delta V = ${q("Vpos", Vpos)} - ${q("payi", payi)} = ${q("VoMax", VoMax)}, \\quad V_{o,\\min} = V_- + \\Delta V = ${qo("Vneg", Vneg)} + ${q("payi", payi)} = ${q("VoMin", VoMin)}`,
    });
    const tol = 1e-12 * Math.max(Math.abs(Vout), Math.abs(VoMax), Math.abs(VoMin), 1);
    if (Vout > VoMax + tol) {
      checks.push({ level: "uyari", message: MESSAGES.doymaUst(t("Vout", Vout), t("VoMax", VoMax)), reference: REF.sboa270 });
    } else if (Vout < VoMin - tol) {
      checks.push({ level: "uyari", message: MESSAGES.doymaAlt(t("Vout", Vout), t("VoMin", VoMin)), reference: REF.sboa270 });
    } else {
      checks.push({ level: "ok", message: MESSAGES.salinimIcinde(t("VoMin", VoMin), t("VoMax", VoMax)) });
    }

    if (Vcm !== undefined) {
      outputs.Vcm = Vcm;
      checks.push({ level: "bilgi", message: MESSAGES.ortakMod(t("Vcm", Vcm)), reference: mode === "fark" ? REF.sboa274 : REF.sboa271 });
    }

    return { outputs, steps, checks };
  },
};

