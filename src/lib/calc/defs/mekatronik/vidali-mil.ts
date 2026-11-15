/**
 * KAPSAM 6.2 — Vidalı mil (bilyalı vida, ballscrew).
 *
 * Kaynak: THK bilyalı vida seçim kriterleri (üretici kataloğu, kamuya açık; URL'ler tahrik-ortak.ts REF ve
 * src/config/sinir/mekatronik-tahrik.ts'te). Hesap SI'dadır; THK'nin mm–N–kg biçimli sabitli denklemleri
 * (… · 10⁷, … · 10⁴) yalnızca formül gösterimindedir.
 *
 * - Tahrik torku (THK denklem 48): T = F·P_h/(2π·η₁)
 * - Geri tahrik (eksenel yükün mile ürettiği tork, THK denklem 3): T_geri = F·P_h·η₂/(2π)
 * - Doğrusal hız ↔ devir: v = ω·P_h/(2π)
 * - Atalet (THK denklem 49, doğrudan bağlı, A = 1): J = m·(P_h/2π)² + J_s; J_s = π·ρ·L·d₀⁴/32 (dolu silindir)
 * - Hızlanma torku: T_ivme = J·α, α = ω/t (sıfırdan doğrusal rampa). Motor ataleti dahil değildir (6.4).
 * - Hızlanmadaki eksenel yük (burkulma kontrolü için, THK örneğindeki gibi): F_maks = F + m·a, a = v/t
 * - Kritik devir (THK denklem 7): N₁ = 0,8·(λ₁²/ℓb²)·√(E·I/(ρ·A)) [rad/s], I = π·d₁⁴/64, A = π·d₁²/4
 * - Burkulma (THK denklem 5): P₁ = 0,5·η₁·π²·E·I/ℓa²; izin verilen çekme/basma (denklem 6): P₂ = σ·π·d₁²/4
 * Burkulma ve kritik devir için yataklama ayrı seçilir: THK örneğinde burkulma somun–yatak açıklığında
 * (sabit–sabit), kritik devir yataklar arasında (sabit–destekli) değerlendirilir. DN değeri sınırı (N₂) modele
 * özgü olduğundan hesaplanmaz.
 */
import type { VidaYataklamaBurkulma, VidaYataklamaKritik } from "@/config/sinir/mekatronik-tahrik";
import { latexNum, latexQty } from "@/lib/calc/latex";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { REF, num, qNum, qOmega, specOf, specText, specWriter } from "./tahrik-ortak";

export type VidaHizGirdi = "devir" | "dogrusal";

const WHERE = "vidali-mil";

const MESSAGES = {
  rootDiameter: "Diş dibi çapı (d₁) mil dış çapından (d₀) küçük olmalıdır.",
  spanTooLong: "Montaj yüzeyleri arası mesafeler (ℓa, ℓb) mil boyundan büyük olamaz.",
  overSpeed: (n: string, n1: string) =>
    `Çalışma devri (${n}) kritik devirden belirlenen izin verilen devri (${n1}) aşıyor: mil çapını büyütün, açıklığı kısaltın veya yataklamayı değiştirin.`,
  speedOk: (n: string, n1: string) => `Çalışma devri (${n}) kritik devirden belirlenen izin verilen devrin (${n1}) altında.`,
  overBuckling: (f: string, p1: string) =>
    `Hızlanmadaki eksenel yük (${f}) burkulma yükünü (${p1}, 0,5 emniyetli) aşıyor.`,
  overYield: (f: string, p2: string) =>
    `Hızlanmadaki eksenel yük (${f}) milin izin verilen çekme/basma yükünü (${p2}) aşıyor.`,
  axialOk: (f: string, p: string) =>
    `Hızlanmadaki eksenel yük (${f}) burkulma ve çekme/basma sınırlarının küçüğünün (${p}) altında.`,
  assumptions:
    "Motor–mil doğrudan bağlı; ön yük torku ve motor ataleti dahil değil (servo seçimi için 6.4). Hızlanma sıfırdan doğrusal rampa kabul edildi. DN değerine göre izin verilen devir (N₂) modele özgüdür, üretici tablosundan ayrıca kontrol edilmelidir. Dikey eksende geri tahrik torku yükü düşürmeye çalışır; fren gerekir.",
} as const;

const KRITIK_OPTIONS: { value: VidaYataklamaKritik; label: string }[] = [
  { value: "sabit-serbest", label: "Sabit – serbest" },
  { value: "destekli-destekli", label: "Destekli – destekli" },
  { value: "sabit-destekli", label: "Sabit – destekli" },
  { value: "sabit-sabit", label: "Sabit – sabit" },
];

const BURKULMA_OPTIONS: { value: VidaYataklamaBurkulma; label: string }[] = [
  { value: "sabit-serbest", label: "Sabit – serbest" },
  { value: "sabit-destekli", label: "Sabit – destekli" },
  { value: "sabit-sabit", label: "Sabit – sabit" },
];

const ETA_UNITS = ["percent", "fraction"];

const INPUTS: InputSpec[] = [
  {
    kind: "number",
    key: "F",
    label: "Eksenel yük (sabit hızda)",
    symbol: "F",
    dimension: "kuvvet",
    defaultUnit: "N",
    default: 1000,
    min: 0,
    help: "Somuna gelen eksenel kuvvet: kılavuz sürtünmesi + dış kuvvet (+ dikeyde ağırlık).",
  },
  {
    kind: "number",
    key: "Ph",
    label: "Hatve (lead)",
    symbol: "P_h",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 10,
    min: 0,
    minExclusive: true,
    help: "Milin bir devrinde somunun ilerlediği mesafe.",
  },
  {
    kind: "number",
    key: "eta1",
    label: "Verim (dönme → doğrusal)",
    symbol: "\\eta_1",
    dimension: "oran",
    defaultUnit: "percent",
    units: ETA_UNITS,
    default: 90,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "THK: bilyalı vidada 0,9–0,95.",
  },
  {
    kind: "number",
    key: "eta2",
    label: "Ters verim (doğrusal → dönme)",
    symbol: "\\eta_2",
    dimension: "oran",
    defaultUnit: "percent",
    units: ETA_UNITS,
    default: 90,
    min: 0,
    max: 1,
    help: "Geri tahrik verimi; helis açısı ve sürtünmeye göre üretici kataloğundan alınır.",
  },
  {
    kind: "select",
    key: "hizGirdi",
    label: "Hız girdisi",
    options: [
      { value: "devir", label: "Mil devri" },
      { value: "dogrusal", label: "Doğrusal hız" },
    ],
    default: "devir",
  },
  {
    kind: "number",
    key: "n",
    label: "Mil devri",
    symbol: "n",
    dimension: "acisal_hiz",
    defaultUnit: "rpm",
    default: 1500,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "hizGirdi", equals: "devir" },
  },
  {
    kind: "number",
    key: "v",
    label: "Doğrusal hız",
    symbol: "v",
    dimension: "hiz",
    defaultUnit: "m_min",
    default: 15,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "hizGirdi", equals: "dogrusal" },
  },
  {
    kind: "number",
    key: "m",
    label: "Taşınan kütle",
    symbol: "m",
    dimension: "kutle",
    defaultUnit: "kg",
    default: 80,
    min: 0,
    help: "Tabla + iş parçası.",
  },
  {
    kind: "number",
    key: "t",
    label: "Hızlanma süresi",
    symbol: "t",
    dimension: "zaman",
    defaultUnit: "s",
    default: 0.15,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "d0",
    label: "Mil dış çapı",
    symbol: "d_0",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 20,
    min: 0,
    minExclusive: true,
    help: "Mil ataleti için (dolu silindir).",
  },
  {
    kind: "number",
    key: "d1",
    label: "Diş dibi (minör) çapı",
    symbol: "d_1",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 17.5,
    min: 0,
    minExclusive: true,
    help: "Kritik devir ve burkulma için; üretici kataloğundaki mil diş dibi çapı.",
  },
  {
    kind: "number",
    key: "L",
    label: "Mil boyu",
    symbol: "L",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 1200,
    min: 0,
    minExclusive: true,
  },
  { kind: "select", key: "yatakKritik", label: "Yataklama (kritik devir)", options: KRITIK_OPTIONS, default: "sabit-destekli" },
  {
    kind: "number",
    key: "lb",
    label: "Montaj yüzeyleri arası mesafe (kritik devir)",
    symbol: "\\ell_b",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 1100,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "select",
    key: "yatakBurkulma",
    label: "Yataklama (burkulma)",
    options: BURKULMA_OPTIONS,
    default: "sabit-sabit",
  },
  {
    kind: "number",
    key: "la",
    label: "Montaj yüzeyleri arası mesafe (burkulma)",
    symbol: "\\ell_a",
    dimension: "uzunluk",
    defaultUnit: "mm",
    default: 1100,
    min: 0,
    minExclusive: true,
    help: "Basma yükü altındaki açıklık (somun ile yükü taşıyan yatak arası).",
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "T", label: "Tahrik torku (sabit hız)", symbol: "T", dimension: "tork", defaultUnit: "Nm" },
  { key: "Tgeri", label: "Geri tahrik torku", symbol: "T_{\\text{geri}}", dimension: "tork", defaultUnit: "Nm" },
  { key: "n", label: "Mil devri", symbol: "n", dimension: "acisal_hiz", defaultUnit: "rpm" },
  { key: "v", label: "Doğrusal hız", symbol: "v", dimension: "hiz", defaultUnit: "m_min" },
  { key: "Jyuk", label: "Yükün mile yansıyan ataleti", symbol: "J_{\\text{yük}}", dimension: "atalet", defaultUnit: "kgm2" },
  { key: "Js", label: "Mil ataleti", symbol: "J_s", dimension: "atalet", defaultUnit: "kgm2" },
  { key: "J", label: "Toplam atalet (mil + yük)", symbol: "J", dimension: "atalet", defaultUnit: "kgm2" },
  { key: "alfa", label: "Açısal ivme", symbol: "\\alpha", dimension: "acisal_ivme", defaultUnit: "rad_s2" },
  { key: "Tivme", label: "Hızlanma torku", symbol: "T_{\\text{ivme}}", dimension: "tork", defaultUnit: "Nm" },
  { key: "Thiz", label: "Hızlanmada toplam tork", symbol: "T_{\\text{hız}}", dimension: "tork", defaultUnit: "Nm" },
  { key: "Fmaks", label: "Hızlanmadaki eksenel yük", symbol: "F_{\\text{maks}}", dimension: "kuvvet", defaultUnit: "N" },
  { key: "N1", label: "İzin verilen devir (kritik devir)", symbol: "N_1", dimension: "acisal_hiz", defaultUnit: "rpm" },
  { key: "P1", label: "Burkulma yükü", symbol: "P_1", dimension: "kuvvet", defaultUnit: "N" },
  { key: "P2", label: "İzin verilen çekme/basma yükü", symbol: "P_2", dimension: "kuvvet", defaultUnit: "N" },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);
const tOut = (key: string, v: number) => specText(specOf(OUTPUTS, key), v);

/** Alan atalet momenti mm⁴ ile (katalogdaki gibi); birim kataloğunda mm⁴ yok */
const qMm4 = (iSI: number) => `${latexNum(iSI * 1e12)}\\,\\mathrm{mm}^4`;
const qPa = (p: number) => latexQty(p, "MPa");
const qRho = (rho: number) => `${latexNum(rho)}\\,\\mathrm{kg/m^3}`;

function crossChecks(inputs: ComputeInputs): Check[] {
  const checks: Check[] = [];
  if (num(inputs, "d1", WHERE) >= num(inputs, "d0", WHERE)) checks.push({ level: "hata", message: MESSAGES.rootDiameter });
  const L = num(inputs, "L", WHERE);
  if (num(inputs, "la", WHERE) > L || num(inputs, "lb", WHERE) > L) checks.push({ level: "hata", message: MESSAGES.spanTooLong });
  return checks;
}

function compute(inputs: ComputeInputs, ctx: CalcContext) {
  const k = ctx.limits.mekatronikTahrik.vidaliMil;
  const F = num(inputs, "F", WHERE);
  const Ph = num(inputs, "Ph", WHERE);
  const eta1 = num(inputs, "eta1", WHERE);
  const eta2 = num(inputs, "eta2", WHERE);
  const m = num(inputs, "m", WHERE);
  const t = num(inputs, "t", WHERE);
  const d0 = num(inputs, "d0", WHERE);
  const d1 = num(inputs, "d1", WHERE);
  const L = num(inputs, "L", WHERE);
  const la = num(inputs, "la", WHERE);
  const lb = num(inputs, "lb", WHERE);
  const yatakKritik = inputs.yatakKritik as VidaYataklamaKritik;
  const yatakBurkulma = inputs.yatakBurkulma as VidaYataklamaBurkulma;
  const lambda1 = k.lambda1[yatakKritik];
  const eta1Yatak = k.eta1[yatakBurkulma];
  if (lambda1 === undefined || eta1Yatak === undefined) throw new Error(`${WHERE}: bilinmeyen yataklama`);

  const steps: Step[] = [];

  // Hız
  let omega: number;
  let v: number;
  if (inputs.hizGirdi === "dogrusal") {
    v = num(inputs, "v", WHERE);
    omega = (2 * Math.PI * v) / Ph;
    steps.push({
      label: "Mil devri",
      latex: `\\omega = \\frac{2\\pi \\cdot v}{P_h} = \\frac{2\\pi \\cdot ${qi("v", v)}}{${qi("Ph", Ph)}} = ${qOmega(omega)} \\;\\Rightarrow\\; n = ${qo("n", omega)}`,
    });
  } else {
    omega = num(inputs, "n", WHERE);
    v = (omega * Ph) / (2 * Math.PI);
    steps.push({
      label: "Doğrusal hız",
      latex: `v = \\frac{\\omega \\cdot P_h}{2\\pi} = \\frac{${qOmega(omega)} \\cdot ${qi("Ph", Ph)}}{2\\pi} = ${qo("v", v)}`,
    });
  }

  // Torklar
  const T = (F * Ph) / (2 * Math.PI * eta1);
  const Tgeri = (F * Ph * eta2) / (2 * Math.PI);
  steps.push(
    {
      label: "Tahrik torku (THK denklem 48)",
      latex: `T = \\frac{F \\cdot P_h}{2\\pi \\cdot \\eta_1} = \\frac{${qi("F", F)} \\cdot ${qi("Ph", Ph)}}{2\\pi \\cdot ${qNum(eta1)}} = ${qo("T", T)}`,
    },
    {
      label: "Geri tahrik torku (THK denklem 3)",
      latex: `T_{\\text{geri}} = \\frac{F \\cdot P_h \\cdot \\eta_2}{2\\pi} = \\frac{${qi("F", F)} \\cdot ${qi("Ph", Ph)} \\cdot ${qNum(eta2)}}{2\\pi} = ${qo("Tgeri", Tgeri)}`,
    },
  );

  // Atalet ve hızlanma
  const Jyuk = m * (Ph / (2 * Math.PI)) ** 2;
  const Js = (Math.PI * k.yogunluk * L * d0 ** 4) / 32;
  const J = Jyuk + Js;
  const alfa = omega / t;
  const Tivme = J * alfa;
  const Thiz = T + Tivme;
  const a = v / t;
  const Fmaks = F + m * a;
  steps.push(
    {
      label: "Yükün mile yansıyan ataleti",
      latex: `J_{\\text{yük}} = m \\left(\\frac{P_h}{2\\pi}\\right)^2 = ${qi("m", m)} \\cdot \\left(\\frac{${qi("Ph", Ph)}}{2\\pi}\\right)^2 = ${qo("Jyuk", Jyuk)}`,
    },
    {
      label: "Mil ataleti (dolu silindir)",
      latex: `J_s = \\frac{\\pi \\cdot \\rho \\cdot L \\cdot d_0^4}{32} = \\frac{\\pi \\cdot ${qRho(k.yogunluk)} \\cdot ${qi("L", L)} \\cdot (${qi("d0", d0)})^4}{32} = ${qo("Js", Js)}`,
    },
    {
      label: "Toplam atalet",
      latex: `J = J_{\\text{yük}} + J_s = ${qo("Jyuk", Jyuk)} + ${qo("Js", Js)} = ${qo("J", J)}`,
    },
    {
      label: "Açısal ivme (doğrusal rampa)",
      latex: `\\alpha = \\frac{\\omega}{t} = \\frac{${qOmega(omega)}}{${qi("t", t)}} = ${qo("alfa", alfa)}`,
    },
    {
      label: "Hızlanma torku (THK denklem 49)",
      latex: `T_{\\text{ivme}} = J \\cdot \\alpha = ${qo("J", J)} \\cdot ${qo("alfa", alfa)} = ${qo("Tivme", Tivme)}`,
    },
    {
      label: "Hızlanmada toplam tork",
      latex: `T_{\\text{hız}} = T + T_{\\text{ivme}} = ${qo("T", T)} + ${qo("Tivme", Tivme)} = ${qo("Thiz", Thiz)}`,
    },
    {
      label: "Hızlanmadaki eksenel yük",
      latex: `F_{\\text{maks}} = F + m \\cdot \\frac{v}{t} = ${qi("F", F)} + ${qi("m", m)} \\cdot \\frac{${qo("v", v)}}{${qi("t", t)}} = ${qo("Fmaks", Fmaks)}`,
    },
  );

  // Kritik devir, burkulma, izin verilen yük
  const I = (Math.PI * d1 ** 4) / 64;
  const A = (Math.PI * d1 ** 2) / 4;
  const E = k.elastisiteModulu;
  const N1 = k.kritikDevirKatsayisi * (lambda1 ** 2 / lb ** 2) * Math.sqrt((E * I) / (k.yogunluk * A));
  const P1 = k.burkulmaKatsayisi * ((eta1Yatak * Math.PI ** 2 * E * I) / la ** 2);
  const P2 = k.izinGerilme * A;
  steps.push(
    {
      label: "Diş dibi kesitinin atalet momenti ve alanı",
      latex: `I = \\frac{\\pi \\cdot d_1^4}{64} = \\frac{\\pi \\cdot (${qi("d1", d1)})^4}{64} = ${qMm4(I)}, \\qquad A = \\frac{\\pi \\cdot d_1^2}{4} = ${latexQty(A, "mm2")}`,
    },
    {
      label: "İzin verilen devir — kritik devir (THK denklem 7)",
      latex: `N_1 = ${qNum(k.kritikDevirKatsayisi)} \\cdot \\frac{\\lambda_1^2}{\\ell_b^2} \\sqrt{\\frac{E \\cdot I}{\\rho \\cdot A}} = ${qNum(k.kritikDevirKatsayisi)} \\cdot \\frac{${qNum(lambda1)}^2}{(${qi("lb", lb)})^2} \\sqrt{\\frac{${qPa(E)} \\cdot ${qMm4(I)}}{${qRho(k.yogunluk)} \\cdot ${latexQty(A, "mm2")}}} = ${qOmega(N1)} = ${qo("N1", N1)}`,
    },
    {
      label: "Burkulma yükü (THK denklem 5)",
      latex: `P_1 = ${qNum(k.burkulmaKatsayisi)} \\cdot \\frac{\\eta_1 \\cdot \\pi^2 \\cdot E \\cdot I}{\\ell_a^2} = ${qNum(k.burkulmaKatsayisi)} \\cdot \\frac{${qNum(eta1Yatak)} \\cdot \\pi^2 \\cdot ${qPa(E)} \\cdot ${qMm4(I)}}{(${qi("la", la)})^2} = ${qo("P1", P1)}`,
    },
    {
      label: "İzin verilen çekme/basma yükü (THK denklem 6)",
      latex: `P_2 = \\sigma \\cdot A = ${qPa(k.izinGerilme)} \\cdot ${latexQty(A, "mm2")} = ${qo("P2", P2)}`,
    },
  );

  const checks: Check[] = [];
  const nText = tOut("n", omega);
  const n1Text = tOut("N1", N1);
  if (omega > N1) checks.push({ level: "uyari", message: MESSAGES.overSpeed(nText, n1Text), reference: REF.thkIzinDevir });
  else checks.push({ level: "ok", message: MESSAGES.speedOk(nText, n1Text) });
  const fText = tOut("Fmaks", Fmaks);
  if (Fmaks > P1) checks.push({ level: "uyari", message: MESSAGES.overBuckling(fText, tOut("P1", P1)), reference: REF.thkIzinYuk });
  if (Fmaks > P2) checks.push({ level: "uyari", message: MESSAGES.overYield(fText, tOut("P2", P2)), reference: REF.thkIzinYuk });
  if (Fmaks <= P1 && Fmaks <= P2) checks.push({ level: "ok", message: MESSAGES.axialOk(fText, tOut("P1", Math.min(P1, P2))) });
  checks.push({ level: "ok", message: MESSAGES.assumptions });

  return {
    outputs: { T, Tgeri, n: omega, v, Jyuk, Js, J, alfa, Tivme, Thiz, Fmaks, N1, P1, P2 },
    steps,
    checks,
  };
}

export const vidaliMil: CalcDefinition = {
  id: "6.2",
  slug: "vidali-mil",
  category: "mekatronik",
  title: "Vidalı mil (ballscrew)",
  description:
    "Bilyalı vidada tahrik ve geri tahrik torkunu, doğrusal hız ile devir ilişkisini, mil + yük ataletini ve hızlanma torkunu hesaplayın; kritik devir, burkulma yükü ve izin verilen eksenel yükü THK kataloğundaki yataklama katsayılarıyla kontrol edin.",
  formulas: [
    { label: "Tahrik torku", latex: "T = \\frac{F \\cdot P_h}{2\\pi \\cdot \\eta_1}" },
    { label: "Geri tahrik torku", latex: "T_{\\text{geri}} = \\frac{F \\cdot P_h \\cdot \\eta_2}{2\\pi}" },
    { label: "Doğrusal hız", latex: "v = n \\cdot P_h = \\frac{\\omega \\cdot P_h}{2\\pi}" },
    {
      label: "Atalet (doğrudan bağlı)",
      latex: "J = m \\left(\\frac{P_h}{2\\pi}\\right)^2 + J_s, \\qquad J_s = \\frac{\\pi \\rho L d_0^4}{32}",
    },
    { label: "Hızlanma torku", latex: "T_{\\text{ivme}} = J \\cdot \\alpha, \\qquad \\alpha = \\frac{\\omega}{t}" },
    {
      label: "Kritik devir (THK, 0,8 emniyetli; mm ve dev/dk ile)",
      latex:
        "N_1 = \\frac{60 \\lambda_1^2}{2\\pi \\ell_b^2} \\sqrt{\\frac{E \\cdot 10^3 \\cdot I}{\\gamma \\cdot A}} \\cdot 0{,}8 = \\lambda_2 \\frac{d_1}{\\ell_b^2} \\cdot 10^7",
    },
    {
      label: "Burkulma yükü (THK, 0,5 emniyetli; mm ve N ile)",
      latex: "P_1 = \\frac{\\eta_1 \\pi^2 E I}{\\ell_a^2} \\cdot 0{,}5 = \\eta_2 \\frac{d_1^4}{\\ell_a^2} \\cdot 10^4",
    },
    { label: "İzin verilen çekme/basma yükü", latex: "P_2 = \\sigma \\cdot \\frac{\\pi}{4} d_1^2" },
  ],
  references: [
    {
      standard: "ISO 3408-1:2006",
      title: "Ball screws — Part 1: Vocabulary and designation",
      note: "Bilyalı vida terimleri ve gösterimi. Kritik devir ve burkulma bu standarttan değil, üretici kataloğundan (THK) alınmıştır.",
    },
    {
      standard: "ISO 3408-5:2006",
      title: "Ball screws — Part 5: Static and dynamic axial load ratings and operational life",
      note: "Yük sayıları ve ömür hesabı bu standarttadır; bu hesapta ömür hesaplanmaz.",
    },
    REF.thkTork,
    REF.thkGeriTahrik,
    REF.thkIzinDevir,
    REF.thkIzinYuk,
    REF.thkOrnek,
  ],
  inputs: INPUTS,
  outputs: OUTPUTS,
  validate: (inputs) => crossChecks(inputs),
  compute: (inputs, ctx) => {
    if (crossChecks(inputs).some((c) => c.level === "hata")) return { outputs: {}, steps: [], checks: [] };
    return compute(inputs, ctx);
  },
};
