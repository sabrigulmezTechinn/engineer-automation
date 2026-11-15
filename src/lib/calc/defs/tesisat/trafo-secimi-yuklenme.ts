/**
 * KAPSAM 2.6 — Trafo seçimi ve yüklenme.
 *
 * Gerekli görünür güç: S = √3·U·I veya yük listesinden P = k_e·ΣP_i, Q = k_e·ΣP_i·tan φ_i, S = √(P² + Q²).
 * Önerilen trafo: standart güç listesinde S'yi karşılayan en küçük değer S_n; yüklenme oranı β = S/S_n.
 * Kayıplar (isteğe bağlı, sabit yük kabulü): P_kayıp = P₀ + β²·P_k, η = P/(P + P_kayıp), E_kayıp = P_kayıp·t.
 *
 * Standart güç listesi: IEC 60076-1 "Preferred values of rated power" (2011 baskısında §5.1.2, 1993 baskısında §4.3)
 * metni açılamadı; yalnızca içindekiler ve normatif atıflardaki ISO 3 (tercihli sayılar) görüldü:
 *   https://cdn.standards.iteh.ai/samples/843/b657b6b91da44112a4f5557af1fc4353/IEC-60076-1-1993.pdf
 * Bu yüzden varsayılan liste ISO 3 R10 tercihli sayı serisidir (1,00 1,25 1,60 2,00 2,50 3,15 4,00 5,00 6,30 8,00 × 10ⁿ):
 *   https://en.wikipedia.org/wiki/Renard_series
 * ve kullanıcı tarafından değiştirilebilir (ör. dağıtım şirketinin veya üreticinin güç listesi).
 */
import { latexSpec } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, OutputSpec, Step } from "@/lib/calc/types";
import { num, numList, qNum, qText, specOf } from "./guc-ortak";

const WHERE = "trafo-secimi-yuklenme";
const SQRT3 = Math.sqrt(3);

export type TrafoGiris = "liste" | "akim";

/** ISO 3 R10 serisi, 50 kVA – 3150 kVA (kVA) */
const R10_KVA = [50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150];

const OUTPUTS: OutputSpec[] = [
  { key: "S", label: "Gerekli görünür güç", symbol: "S", dimension: "gorunur_guc", defaultUnit: "kVA" },
  { key: "Sn", label: "Önerilen trafo anma gücü", symbol: "S_n", dimension: "gorunur_guc", defaultUnit: "kVA" },
  { key: "beta", label: "Yüklenme oranı", symbol: "\\beta", dimension: "oran", defaultUnit: "percent", units: ["percent", "fraction"] },
  { key: "P", label: "Aktif güç", symbol: "P", dimension: "guc", defaultUnit: "kW" },
  { key: "Q", label: "Reaktif güç", symbol: "Q", dimension: "reaktif_guc", defaultUnit: "kvar" },
  { key: "cos", label: "Toplam güç faktörü", symbol: "\\cos\\varphi", dimension: "boyutsuz", defaultUnit: "unitless" },
  { key: "Iyuk", label: "Yük akımı (AG)", symbol: "I", dimension: "akim", defaultUnit: "A" },
  { key: "In", label: "Trafo AG anma akımı", symbol: "I_n", dimension: "akim", defaultUnit: "A" },
  { key: "Pkayip", label: "Toplam trafo kaybı (bu yükte)", symbol: "P_{\\text{kayıp}}", dimension: "guc", defaultUnit: "kW" },
  { key: "eta", label: "Trafo verimi (bu yükte)", symbol: "\\eta", dimension: "oran", defaultUnit: "percent", units: ["percent", "fraction"] },
  { key: "E", label: "Yıllık kayıp enerjisi", symbol: "E_{\\text{kayıp}}", dimension: "enerji", defaultUnit: "kWh" },
];

const S_ = (key: string) => specOf(OUTPUTS, key);
const qS = (v: number) => latexSpec(S_("S"), v);
const qP = (v: number) => latexSpec(S_("P"), v);
const qQ = (v: number) => latexSpec(S_("Q"), v);
const qU = (v: number) => latexSpec({ dimension: "gerilim", defaultUnit: "V" }, v);
const qI = (v: number) => latexSpec(S_("Iyuk"), v);
const qPct = (v: number) => latexSpec(S_("beta"), v);
const qT = (v: number) => latexSpec({ dimension: "zaman", defaultUnit: "h", autoUnit: false }, v);

const MESSAGES = {
  cosCount: "cos φ listesi tek değer (tüm yüklere uygulanır) veya yük listesiyle aynı sayıda değer içermelidir.",
  chosen: (sn: string, beta: string) => `Önerilen trafo: ${sn} (listede gerekli gücü karşılayan en küçük değer); yüklenme oranı ${beta}.`,
  none: (smax: string, s: string) =>
    `Listedeki en büyük güç (${smax}) gerekli gücün (${s}) altında: paralel trafo veya listeye daha büyük güç ekleyin.`,
  loss:
    "Kayıplar, yükün işletme süresi boyunca sabit (β) olduğu kabulüyle hesaplandı: E = (P₀ + β²·P_k)·t. Değişken yükte yük kayıpları için eşdeğer tam yük süresi kullanılmalıdır.",
  ambient:
    "Anma gücü, üreticinin belirttiği soğutma ortamı koşullarında sürekli verilebilen güçtür; yüksek ortam sıcaklığı, harmonikli yük veya havalandırması yetersiz trafo odasında yüklenme sınırı üretici verilerine göre düşürülmelidir.",
} as const;

const tanOf = (c: number) => Math.sqrt(1 - c * c) / c;

function crossChecks(inputs: ComputeInputs): Check[] {
  if (inputs.giris === "liste") {
    const n = numList(inputs, "Pliste", WHERE).length;
    const m = numList(inputs, "cosListe", WHERE).length;
    if (m !== 1 && m !== n) return [{ level: "hata", message: MESSAGES.cosCount }];
  }
  return [];
}

export const trafoSecimiYuklenme: CalcDefinition = {
  id: "2.6",
  slug: "trafo-secimi-yuklenme",
  category: "tesisat",
  title: "Trafo seçimi ve yüklenme",
  description:
    "Yük listesinden (kW, cos φ, eşzamanlılık) veya gerilim ve akımdan gerekli görünür gücü bulun, standart güç listesinden trafo önerin, yüklenme oranını ve isteğe bağlı olarak boşta ve yükte kayıplardan verimi ve yıllık kayıp enerjisini hesaplayın.",
  formulas: [
    { label: "Görünür güç (akımdan)", latex: "S = \\sqrt{3} \\cdot U \\cdot I" },
    {
      label: "Görünür güç (yük listesinden)",
      latex: "P = k_e \\sum P_i, \\quad Q = k_e \\sum P_i \\tan\\varphi_i, \\quad S = \\sqrt{P^2 + Q^2}",
    },
    { label: "Yüklenme oranı", latex: "\\beta = \\frac{S}{S_n}" },
    { label: "Kayıp ve verim", latex: "P_{\\text{kayıp}} = P_0 + \\beta^2 P_k, \\quad \\eta = \\frac{P}{P + P_{\\text{kayıp}}}" },
    { label: "Yıllık kayıp enerjisi (sabit yük)", latex: "E_{\\text{kayıp}} = \\left(P_0 + \\beta^2 P_k\\right) \\cdot t" },
  ],
  references: [
    {
      standard: "IEC 60076-1",
      title: "Güç transformatörleri — Bölüm 1: Genel",
      clause: "§5.1.2 Tercih edilen anma gücü değerleri",
      note: "Standart metni açılamadı; varsayılan liste ISO 3 R10 serisidir",
    },
    { standard: "ISO 3", title: "Tercihli sayılar — Tercihli sayı serileri", note: "R10 serisi" },
  ],
  inputs: [
    {
      kind: "select",
      key: "giris",
      label: "Gerekli güç",
      options: [
        { value: "liste", label: "Yük listesinden (kW, cos φ, eşzamanlılık)" },
        { value: "akim", label: "Gerilim ve akımdan (S = √3·U·I)" },
      ],
      default: "liste",
    },
    {
      kind: "number",
      key: "U",
      label: "AG fazlar arası gerilim",
      symbol: "U",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 400,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "number",
      key: "I",
      label: "Yük akımı",
      symbol: "I",
      dimension: "akim",
      defaultUnit: "A",
      default: 1000,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "giris", equals: "akim" },
    },
    {
      kind: "number",
      key: "cosAkim",
      label: "Güç faktörü",
      symbol: "\\cos\\varphi",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 0.9,
      min: 0,
      minExclusive: true,
      max: 1,
      help: "Aktif güç ve verim için kullanılır.",
      visibleWhen: { key: "giris", equals: "akim" },
    },
    {
      kind: "numberList",
      key: "Pliste",
      label: "Yüklerin aktif güçleri",
      symbol: "P_i",
      dimension: "guc",
      defaultUnit: "kW",
      default: [75, 55, 37, 30, 22, 15, 11],
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "giris", equals: "liste" },
    },
    {
      kind: "numberList",
      key: "cosListe",
      label: "Yüklerin güç faktörleri",
      symbol: "\\cos\\varphi_i",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: [0.85],
      min: 0,
      minExclusive: true,
      max: 1,
      help: "Tek değer girilirse tüm yüklere uygulanır; aksi halde yük listesiyle aynı sırada ve sayıda.",
      visibleWhen: { key: "giris", equals: "liste" },
    },
    {
      kind: "number",
      key: "ke",
      label: "Eşzamanlılık katsayısı",
      symbol: "k_e",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 0.8,
      min: 0,
      minExclusive: true,
      max: 1,
      visibleWhen: { key: "giris", equals: "liste" },
    },
    {
      kind: "numberList",
      key: "standart",
      label: "Standart trafo güçleri",
      symbol: "S_n",
      dimension: "gorunur_guc",
      defaultUnit: "kVA",
      default: R10_KVA,
      min: 0,
      minExclusive: true,
      help: "Varsayılan: ISO 3 R10 tercihli sayı serisi (50 kVA – 3150 kVA). Dağıtım şirketinin veya üreticinin güç listesiyle değiştirilebilir.",
    },
    {
      kind: "select",
      key: "kayip",
      label: "Kayıp ve verim hesabı",
      options: [
        { value: "yok", label: "Hesaplama" },
        { value: "var", label: "Boşta ve yükte kayıplardan hesapla" },
      ],
      default: "yok",
    },
    {
      kind: "number",
      key: "P0",
      label: "Boşta kayıplar",
      symbol: "P_0",
      dimension: "guc",
      defaultUnit: "kW",
      default: 0.36,
      min: 0,
      help: "Önerilen güçteki trafonun etiket veya test raporu değeri.",
      visibleWhen: { key: "kayip", equals: "var" },
    },
    {
      kind: "number",
      key: "Pk",
      label: "Anma yükünde kayıplar (kısa devre kayıpları)",
      symbol: "P_k",
      dimension: "guc",
      defaultUnit: "kW",
      default: 3.25,
      min: 0,
      visibleWhen: { key: "kayip", equals: "var" },
    },
    {
      kind: "number",
      key: "t",
      label: "Yıllık işletme süresi",
      symbol: "t",
      dimension: "zaman",
      defaultUnit: "h",
      units: ["h", "day"],
      default: 8760,
      min: 0,
      minExclusive: true,
      max: 8784 * 3600,
      visibleWhen: { key: "kayip", equals: "var" },
    },
  ],
  outputs: OUTPUTS,

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const U = num(inputs, "U", WHERE);
    const steps: Step[] = [];
    let P: number;
    let Q: number;
    let S: number;

    if (inputs.giris === "akim") {
      const I = num(inputs, "I", WHERE);
      const c = num(inputs, "cosAkim", WHERE);
      S = SQRT3 * U * I;
      P = S * c;
      Q = S * Math.sqrt(1 - c * c);
      steps.push(
        { label: "Gerekli görünür güç", latex: `S = \\sqrt{3} \\cdot U \\cdot I = \\sqrt{3} \\cdot ${qU(U)} \\cdot ${qI(I)} = ${qS(S)}` },
        { label: "Aktif ve reaktif güç", latex: `P = S \\cdot \\cos\\varphi = ${qP(P)} \\qquad Q = S \\cdot \\sin\\varphi = ${qQ(Q)}` },
      );
    } else {
      const Pl = numList(inputs, "Pliste", WHERE);
      const cl = numList(inputs, "cosListe", WHERE);
      const ke = num(inputs, "ke", WHERE);
      const sumP = Pl.reduce((a, b) => a + b, 0);
      const sumQ = Pl.reduce((a, p, i) => a + p * tanOf(cl.length === 1 ? cl[0] : cl[i]), 0);
      P = ke * sumP;
      Q = ke * sumQ;
      S = Math.hypot(P, Q);
      steps.push(
        {
          label: `Yük toplamları (${Pl.length} yük)`,
          latex: `\\sum P_i = ${qP(sumP)} \\qquad \\sum P_i \\tan\\varphi_i = ${qQ(sumQ)}`,
        },
        {
          label: "Eşzamanlılıkla aktif ve reaktif güç",
          latex: `P = k_e \\sum P_i = ${qNum(ke)} \\cdot ${qP(sumP)} = ${qP(P)} \\qquad Q = k_e \\sum P_i \\tan\\varphi_i = ${qQ(Q)}`,
        },
        { label: "Gerekli görünür güç", latex: `S = \\sqrt{P^2 + Q^2} = \\sqrt{(${qP(P)})^2 + (${qQ(Q)})^2} = ${qS(S)}` },
      );
    }

    const cos = P / S;
    const Iyuk = S / (SQRT3 * U);
    const outputs: Record<string, number> = { S, P, Q, cos, Iyuk };
    const checks: Check[] = [];

    const list = [...numList(inputs, "standart", WHERE)].sort((a, b) => a - b);
    const Sn = list.find((v) => v >= S * (1 - 1e-12));
    if (Sn === undefined) {
      checks.push({ level: "uyari", message: MESSAGES.none(qText(S_("S"), list[list.length - 1]), qText(S_("S"), S)) });
      return { outputs, steps, checks };
    }

    const beta = S / Sn;
    const In = Sn / (SQRT3 * U);
    Object.assign(outputs, { Sn, beta, In });
    steps.push(
      { label: "Yüklenme oranı", latex: `\\beta = \\frac{S}{S_n} = \\frac{${qS(S)}}{${qS(Sn)}} = ${qPct(beta)}` },
      {
        label: "Trafo AG anma akımı ve yük akımı",
        latex: `I_n = \\frac{S_n}{\\sqrt{3} \\cdot U} = ${qI(In)} \\qquad I = \\frac{S}{\\sqrt{3} \\cdot U} = ${qI(Iyuk)}`,
      },
    );
    checks.push({ level: "ok", message: MESSAGES.chosen(qText(S_("Sn"), Sn), qText(S_("beta"), beta)) });

    if (inputs.kayip === "var") {
      const P0 = num(inputs, "P0", WHERE);
      const Pk = num(inputs, "Pk", WHERE);
      const t = num(inputs, "t", WHERE);
      const Pkayip = P0 + beta * beta * Pk;
      const eta = P / (P + Pkayip);
      const E = Pkayip * t;
      Object.assign(outputs, { Pkayip, eta, E });
      steps.push(
        {
          label: "Bu yükteki toplam kayıp",
          latex: `P_{\\text{kayıp}} = P_0 + \\beta^2 P_k = ${qP(P0)} + ${qNum(beta)}^2 \\cdot ${qP(Pk)} = ${qP(Pkayip)}`,
        },
        {
          label: "Verim",
          latex: `\\eta = \\frac{P}{P + P_{\\text{kayıp}}} = \\frac{${qP(P)}}{${qP(P)} + ${qP(Pkayip)}} = ${latexSpec(S_("eta"), eta)}`,
        },
        {
          label: "Yıllık kayıp enerjisi",
          latex: `E_{\\text{kayıp}} = P_{\\text{kayıp}} \\cdot t = ${qP(Pkayip)} \\cdot ${qT(t)} = ${latexSpec(S_("E"), E)}`,
        },
      );
      checks.push({ level: "ok", message: MESSAGES.loss });
    }
    checks.push({ level: "ok", message: MESSAGES.ambient });

    return { outputs, steps, checks };
  },
};
