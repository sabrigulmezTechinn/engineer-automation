/**
 * KAPSAM 2.5 — Kısa devre akımı (IEC 60909-0, eşdeğer gerilim kaynağı yöntemi).
 *
 * AG baraya bağlı bir dağıtım trafosu için, üretece uzak (generatörden uzak) kısa devre kabulüyle:
 *   Z_T = u_k·U_rT²/S_rT, R_T = P_krT·U_rT²/S_rT², X_T = √(Z_T² − R_T²)
 *   K_T = 0,95·c_maks/(1 + 0,6·x_T), x_T = X_T·S_rT/U_rT² (ağ trafosu empedans düzeltme katsayısı, isteğe bağlı)
 *   Z_Q = c_Q·U_rT²/S″_kQ (üst gerilim şebekesi, AG tarafına indirgenmiş; U_nQ = U_rTOG kabulü), R_Q/X_Q = 0,1
 *   Z_L = (R′ + jX′)·ℓ/n (kablo, 3 fazlı arızada tek yol)
 *   I″_k3 = c·U_n/(√3·|Z_k|), κ = 1,02 + 0,98·e^(−3R/X), i_p = κ·√2·I″_k3, I″_k2 = (√3/2)·I″_k3
 * Faz-toprak (basitleştirilmiş): simetrili bileşenlerle I″_k1 = √3·c·U_n/|2Z₁ + Z₀|; Dyn trafo (Z₀T = Z_T, şebeke sıfır
 * bileşen devresinde görünmez) ve kablo sıfır bileşeni Z₀L = Z_L + 3·Z_PE kabulüyle döngü empedansı
 * Z_döngü = ⅔·Z_Q + Z_T + Z_L + Z_PE olur: I″_k1 = c·U_n/(√3·|Z_döngü|).
 *
 * Kaynak (formüller ve sayısal örnek): Schneider Electric Cahier Technique n° 158 "Calculation of short-circuit currents",
 * §3.3 (Fig. 25 gerilim katsayısı c), §3.4 (K_T), §3.5 Problem 1 — https://download.se.com/files?p_Doc_Ref=ECT158
 */
import { LIMITS } from "@/config/sinirlar";
import { latexSpec } from "@/lib/calc/latex";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, OutputSpec, Step } from "@/lib/calc/types";
import { formatNumber } from "@/lib/units";
import { num, optNum, qNum, qText, specOf } from "./guc-ortak";

const WHERE = "kisa-devre-akimi";
const SQRT3 = Math.sqrt(3);

export type KdHesap = "cmaks" | "cmin" | "ozel";
export type KdTolerans = "6" | "10";

const MESSAGES = {
  rtGtZt:
    "Kısa devre kayıplarından bulunan direnç bileşeni (P_krT/S_rT) kısa devre geriliminden (u_k) küçük olmalıdır; aksi halde X_T = √(Z_T² − R_T²) tanımsızdır. Trafo etiket değerlerini kontrol edin.",
  method:
    "IEC 60909-0 eşdeğer gerilim kaynağı yöntemi: kısa devre generatörden uzak kabul edildi (I″_k = I_b = I_k); motor katkıları, ark direnci ve yük akımları ihmal edildi. κ, seri (ışınsal) devrenin toplam R/X oranından hesaplandı.",
  noR: "Kısa devre kayıpları girilmediği için trafonun direnci ihmal edildi (R_T = 0): κ ve i_p güvenli tarafta (büyük) çıkar.",
  kt: (kt: number, cmax: number) =>
    `Ağ trafosu empedans düzeltme katsayısı K_T = ${formatNumber(kt)} uygulandı (c_maks = ${formatNumber(cmax)}, AG tarafındaki gerilim toleransına göre).`,
  sebekeYok: "Üst gerilim şebekesinin empedansı ihmal edildi (sonsuz güçlü şebeke): sonuç güvenli tarafta (büyük) çıkar.",
  faz1:
    "Faz-toprak akımı basitleştirilmiş döngü empedansıyla hesaplandı: Dyn bağlı trafo, Z₀T = Z_T kabulü (üreticinin sıfır bileşen empedansı farklı olabilir); dönüş yalnızca PE/PEN iletkeni üzerinden (kablo zırhı ve toprak paralel yolları ihmal); Z_döngü = ⅔·Z_Q + Z_T + Z_L + Z_PE.",
  cmin: "En küçük kısa devre akımı için c_min kullanıldı (değer Schneider Cahier Technique 158'den; o belge IEC 60909'un 2001 baskısına dayanır, 2016 baskısındaki değer doğrulanmadı). Koruma düzeninin açma koşulunu kontrol ederken kablo direncini en yüksek işletme sıcaklığındaki değeriyle girin.",
} as const;

const OUTPUTS: OutputSpec[] = [
  { key: "Ik3", label: "Üç fazlı başlangıç kısa devre akımı", symbol: "I''_{k3}", dimension: "akim", defaultUnit: "kA" },
  { key: "ip", label: "Darbe kısa devre akımı", symbol: "i_p", dimension: "akim", defaultUnit: "kA" },
  { key: "Ik2", label: "İki fazlı kısa devre akımı", symbol: "I''_{k2}", dimension: "akim", defaultUnit: "kA" },
  { key: "Ik1", label: "Faz-toprak kısa devre akımı (basitleştirilmiş)", symbol: "I''_{k1}", dimension: "akim", defaultUnit: "kA" },
  { key: "Sk", label: "Başlangıç kısa devre gücü", symbol: "S''_k", dimension: "gorunur_guc", defaultUnit: "MVA" },
  { key: "kappa", label: "Darbe katsayısı", symbol: "\\kappa", dimension: "boyutsuz", defaultUnit: "unitless" },
  { key: "RX", label: "Kısa devre empedansının R/X oranı", symbol: "R_k/X_k", dimension: "boyutsuz", defaultUnit: "unitless" },
  { key: "Zk", label: "Kısa devre empedansı", symbol: "|Z_k|", dimension: "direnc", defaultUnit: "mohm" },
  { key: "Rk", label: "Kısa devre direnci", symbol: "R_k", dimension: "direnc", defaultUnit: "mohm" },
  { key: "Xk", label: "Kısa devre reaktansı", symbol: "X_k", dimension: "direnc", defaultUnit: "mohm" },
  { key: "IrT", label: "Trafo AG anma akımı", symbol: "I_{rT}", dimension: "akim", defaultUnit: "A" },
  { key: "KT", label: "Trafo empedans düzeltme katsayısı", symbol: "K_T", dimension: "boyutsuz", defaultUnit: "unitless" },
];

const S = (key: string) => specOf(OUTPUTS, key);
const qI = (v: number) => latexSpec(S("Ik3"), v);
const qZ = (v: number) => latexSpec(S("Zk"), v);
const qU = (v: number) => latexSpec({ dimension: "gerilim", defaultUnit: "V" }, v);
const qSt = (v: number) => latexSpec({ dimension: "gorunur_guc", defaultUnit: "kVA" }, v);
const qP = (v: number) => latexSpec({ dimension: "guc", defaultUnit: "kW" }, v);
const qPct = (v: number) => latexSpec({ dimension: "oran", defaultUnit: "percent" }, v);
const qLen = (v: number) => latexSpec({ dimension: "uzunluk", defaultUnit: "m" }, v);
const qRpl = (v: number) => latexSpec({ dimension: "direnc_uzunluk", defaultUnit: "ohm_per_km" }, v);

type Limits = CalcContext["limits"];

function cFactors(inputs: ComputeInputs, limits: Limits): { c: number; cMaks: number } {
  const k = limits.tesisatGuc.gerilimKatsayisi;
  const band = inputs.tolerans === "6" ? k.ag6 : k.ag10;
  const hesap = inputs.hesap as KdHesap;
  if (hesap === "cmaks") return { c: band.cMaks, cMaks: band.cMaks };
  if (hesap === "cmin") return { c: band.cMin, cMaks: band.cMaks };
  if (hesap === "ozel") return { c: num(inputs, "cOzel", WHERE), cMaks: band.cMaks };
  throw new Error(`${WHERE}: bilinmeyen hesap "${String(hesap)}"`);
}

function crossChecks(inputs: ComputeInputs): Check[] {
  const Pk = optNum(inputs, "PkrT");
  if (Pk !== undefined && Pk / num(inputs, "SrT", WHERE) >= num(inputs, "uk", WHERE)) {
    return [{ level: "hata", message: MESSAGES.rtGtZt }];
  }
  return [];
}

export const kisaDevreAkimi: CalcDefinition = {
  id: "2.5",
  slug: "kisa-devre-akimi",
  category: "tesisat",
  title: "Kısa devre akımı (IEC 60909)",
  description:
    "Dağıtım trafosu, üst gerilim şebekesi ve kablo empedanslarından AG tarafında üç fazlı başlangıç kısa devre akımını, darbe akımını, iki fazlı ve basitleştirilmiş faz-toprak kısa devre akımını IEC 60909-0 eşdeğer gerilim kaynağı yöntemiyle hesaplayın.",
  formulas: [
    { label: "Trafo empedansı", latex: "Z_T = \\frac{u_k \\cdot U_{rT}^2}{S_{rT}}, \\quad R_T = \\frac{P_{krT} \\cdot U_{rT}^2}{S_{rT}^2}, \\quad X_T = \\sqrt{Z_T^2 - R_T^2}" },
    { label: "Trafo düzeltme katsayısı", latex: "K_T = 0{,}95 \\cdot \\frac{c_{\\max}}{1 + 0{,}6\\, x_T}, \\quad x_T = X_T \\cdot \\frac{S_{rT}}{U_{rT}^2}" },
    { label: "Şebeke empedansı (AG tarafına indirgenmiş)", latex: "Z_Q = \\frac{c_Q \\cdot U_{rT}^2}{S''_{kQ}}, \\quad R_Q = 0{,}1\\, X_Q" },
    { label: "Kablo empedansı", latex: "Z_L = \\left(R' + jX'\\right) \\cdot \\frac{\\ell}{n}" },
    { label: "Üç fazlı kısa devre akımı", latex: "I''_{k3} = \\frac{c \\cdot U_n}{\\sqrt{3} \\cdot |Z_k|}" },
    { label: "Darbe akımı", latex: "i_p = \\kappa \\cdot \\sqrt{2} \\cdot I''_{k3}, \\quad \\kappa = 1{,}02 + 0{,}98\\, e^{-3R_k/X_k}" },
    { label: "İki fazlı kısa devre akımı", latex: "I''_{k2} = \\frac{\\sqrt{3}}{2}\\, I''_{k3}" },
    {
      label: "Faz-toprak (basitleştirilmiş döngü)",
      latex: "I''_{k1} = \\frac{c \\cdot U_n}{\\sqrt{3} \\cdot \\left|\\tfrac{2}{3} Z_Q + Z_T + Z_L + Z_{PE}\\right|}",
    },
  ],
  references: [
    {
      standard: "IEC 60909-0",
      title: "Üç fazlı a.a. sistemlerde kısa devre akımları — Bölüm 0: Akımların hesaplanması",
      note: "Eşdeğer gerilim kaynağı yöntemi, gerilim katsayısı c, K_T düzeltme katsayısı, κ",
    },
    {
      standard: "Schneider Electric Cahier Technique n° 158",
      title: "Calculation of short-circuit currents",
      clause: "§3.3–3.5 (Fig. 25; Problem 1)",
      note: "Formüller ve sayısal örnek; https://download.se.com/files?p_Doc_Ref=ECT158",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "hesap",
      label: "Hesap",
      options: [
        { value: "cmaks", label: "En büyük kısa devre akımı (c_maks)" },
        { value: "cmin", label: "En küçük kısa devre akımı (c_min)" },
        { value: "ozel", label: "Özel gerilim katsayısı c" },
      ],
      default: "cmaks",
    },
    {
      kind: "select",
      key: "tolerans",
      label: "AG şebekesinin gerilim toleransı",
      options: [
        { value: "6", label: "+%6 (c_maks = 1,05; c_min = 0,95)" },
        { value: "10", label: "+%10 (c_maks = 1,10; c_min = 0,95)" },
      ],
      default: "6",
      help: "IEC 60909'a göre AG (100–1000 V) gerilim katsayıları. K_T düzeltmesinde de bu c_maks kullanılır.",
    },
    {
      kind: "number",
      key: "cOzel",
      label: "Gerilim katsayısı",
      symbol: "c",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 1,
      min: 0,
      minExclusive: true,
      max: 2,
      visibleWhen: { key: "hesap", equals: "ozel" },
    },
    {
      kind: "number",
      key: "Un",
      label: "Şebeke anma gerilimi (fazlar arası)",
      symbol: "U_n",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 400,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "number",
      key: "SrT",
      label: "Trafo anma gücü",
      symbol: "S_{rT}",
      dimension: "gorunur_guc",
      defaultUnit: "kVA",
      default: 400,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "number",
      key: "UrT",
      label: "Trafo AG anma gerilimi",
      symbol: "U_{rT}",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 410,
      min: 0,
      minExclusive: true,
      help: "Trafo etiketindeki AG anma (boşta) gerilimi, ör. 400 V veya 410 V.",
    },
    {
      kind: "number",
      key: "uk",
      label: "Kısa devre gerilimi",
      symbol: "u_k",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 4,
      min: 0,
      minExclusive: true,
      max: 1,
    },
    {
      kind: "number",
      key: "PkrT",
      label: "Anma kısa devre (yük) kayıpları",
      symbol: "P_{krT}",
      dimension: "guc",
      defaultUnit: "kW",
      default: 4.6,
      min: 0,
      optional: true,
      help: "Trafo etiketi veya test raporundan. Boş bırakılırsa R_T ihmal edilir.",
    },
    {
      kind: "select",
      key: "kT",
      label: "Trafo empedans düzeltme katsayısı K_T",
      options: [
        { value: "uygula", label: "Uygula (IEC 60909-0 ağ trafosu)" },
        { value: "uygulama", label: "Uygulanmasın" },
      ],
      default: "uygula",
    },
    {
      kind: "select",
      key: "sebeke",
      label: "Üst gerilim şebekesi",
      options: [
        { value: "var", label: "Kısa devre gücü biliniyor" },
        { value: "yok", label: "İhmal et (sonsuz güçlü şebeke)" },
      ],
      default: "var",
    },
    {
      kind: "number",
      key: "SkQ",
      label: "Şebekenin başlangıç kısa devre gücü (trafo OG ucunda)",
      symbol: "S''_{kQ}",
      dimension: "gorunur_guc",
      defaultUnit: "MVA",
      default: 346.41,
      min: 0,
      minExclusive: true,
      help: "Dağıtım şirketinden alınır. Akım biliniyorsa S″_kQ = √3·U_nQ·I″_kQ (ör. 20 kV, 10 kA → 346,41 MVA). Şebeke anma geriliminin trafonun OG anma gerilimine eşit olduğu kabul edilir.",
      visibleWhen: { key: "sebeke", equals: "var" },
    },
    {
      kind: "number",
      key: "cQ",
      label: "Şebeke tarafı gerilim katsayısı",
      symbol: "c_Q",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: LIMITS.tesisatGuc.gerilimKatsayisi.og.cMaks,
      min: 0,
      minExclusive: true,
      max: 2,
      help: "OG/YG şebekesi için IEC 60909 c değeri (en büyük akımda 1,1).",
      visibleWhen: { key: "sebeke", equals: "var" },
    },
    {
      kind: "number",
      key: "RXQ",
      label: "Şebeke empedansının R/X oranı",
      symbol: "R_Q/X_Q",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: LIMITS.tesisatGuc.sebekeRX,
      min: 0,
      help: "Bilinmiyorsa 0,1 alınır.",
      visibleWhen: { key: "sebeke", equals: "var" },
    },
    {
      kind: "select",
      key: "kablo",
      label: "Trafo ile arıza noktası arasındaki kablo",
      options: [
        { value: "var", label: "Var" },
        { value: "yok", label: "Yok (trafo AG baraları)" },
      ],
      default: "var",
    },
    {
      kind: "number",
      key: "Rkm",
      label: "Kablo faz iletkeni direnci",
      symbol: "R'",
      dimension: "direnc_uzunluk",
      defaultUnit: "ohm_per_km",
      default: 0.208,
      min: 0,
      help: "Üretici kataloğundan. En büyük akım için 20 °C değeri, en küçük akım için işletme sıcaklığındaki değer girilir.",
      visibleWhen: { key: "kablo", equals: "var" },
    },
    {
      kind: "number",
      key: "Xkm",
      label: "Kablo faz iletkeni reaktansı",
      symbol: "X'",
      dimension: "direnc_uzunluk",
      defaultUnit: "ohm_per_km",
      default: 0.068,
      min: 0,
      visibleWhen: { key: "kablo", equals: "var" },
    },
    {
      kind: "number",
      key: "L",
      label: "Kablo uzunluğu",
      symbol: "\\ell",
      dimension: "uzunluk",
      defaultUnit: "m",
      units: ["m", "km"],
      default: 4,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "kablo", equals: "var" },
    },
    {
      kind: "number",
      key: "nParalel",
      label: "Paralel kablo sayısı",
      symbol: "n",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 2,
      min: 1,
      integer: true,
      visibleWhen: { key: "kablo", equals: "var" },
    },
    {
      kind: "select",
      key: "fazToprak",
      label: "Faz-toprak kısa devre akımı",
      options: [
        { value: "yok", label: "Hesaplanmasın" },
        { value: "var", label: "Hesapla (basitleştirilmiş döngü)" },
      ],
      default: "yok",
    },
    {
      kind: "number",
      key: "RPEkm",
      label: "Koruma (PE/PEN) iletkeni direnci",
      symbol: "R'_{PE}",
      dimension: "direnc_uzunluk",
      defaultUnit: "ohm_per_km",
      default: 0.208,
      min: 0,
      help: "Kablo yoksa kullanılmaz. Paralel kablolarda her kablonun kendi PE iletkeni olduğu kabul edilir.",
      visibleWhen: { key: "fazToprak", equals: "var" },
    },
    {
      kind: "number",
      key: "XPEkm",
      label: "Koruma (PE/PEN) iletkeni reaktansı",
      symbol: "X'_{PE}",
      dimension: "direnc_uzunluk",
      defaultUnit: "ohm_per_km",
      default: 0.068,
      min: 0,
      visibleWhen: { key: "fazToprak", equals: "var" },
    },
  ],
  outputs: OUTPUTS,

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs, ctx) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const { c, cMaks } = cFactors(inputs, ctx.limits);
    const Un = num(inputs, "Un", WHERE);
    const SrT = num(inputs, "SrT", WHERE);
    const UrT = num(inputs, "UrT", WHERE);
    const uk = num(inputs, "uk", WHERE);
    const Pk = optNum(inputs, "PkrT");
    const steps: Step[] = [];
    const checks: Check[] = [{ level: "bilgi", message: MESSAGES.method }];
    const outputs: Record<string, number> = {};

    // Trafo
    const IrT = SrT / (SQRT3 * UrT);
    const ZT = (uk * UrT * UrT) / SrT;
    const RT = Pk !== undefined ? (Pk * UrT * UrT) / (SrT * SrT) : 0;
    const XT = Math.sqrt(ZT * ZT - RT * RT);
    steps.push(
      {
        label: "Trafo AG anma akımı",
        latex: `I_{rT} = \\frac{S_{rT}}{\\sqrt{3} \\cdot U_{rT}} = \\frac{${qSt(SrT)}}{\\sqrt{3} \\cdot ${qU(UrT)}} = ${latexSpec(S("IrT"), IrT)}`,
      },
      {
        label: "Trafo empedansı",
        latex: `Z_T = \\frac{u_k \\cdot U_{rT}^2}{S_{rT}} = \\frac{${qPct(uk)} \\cdot (${qU(UrT)})^2}{${qSt(SrT)}} = ${qZ(ZT)}`,
      },
    );
    if (Pk !== undefined) {
      steps.push({
        label: "Trafo direnci (kısa devre kayıplarından)",
        latex: `R_T = \\frac{P_{krT} \\cdot U_{rT}^2}{S_{rT}^2} = \\frac{${qP(Pk)} \\cdot (${qU(UrT)})^2}{(${qSt(SrT)})^2} = ${qZ(RT)}`,
      });
    } else {
      checks.push({ level: "bilgi", message: MESSAGES.noR });
    }
    steps.push({
      label: "Trafo reaktansı",
      latex: `X_T = \\sqrt{Z_T^2 - R_T^2} = \\sqrt{(${qZ(ZT)})^2 - (${qZ(RT)})^2} = ${qZ(XT)}`,
    });

    let KT = 1;
    if (inputs.kT === "uygula") {
      const xT = (XT * SrT) / (UrT * UrT);
      KT = (0.95 * cMaks) / (1 + 0.6 * xT);
      outputs.KT = KT;
      steps.push({
        label: "Trafo empedans düzeltme katsayısı",
        latex: `x_T = X_T \\cdot \\frac{S_{rT}}{U_{rT}^2} = ${qNum(xT)} \\qquad K_T = 0{,}95 \\cdot \\frac{c_{\\max}}{1 + 0{,}6\\, x_T} = 0{,}95 \\cdot \\frac{${qNum(cMaks)}}{1 + 0{,}6 \\cdot ${qNum(xT)}} = ${qNum(KT)}`,
      });
      steps.push({
        label: "Düzeltilmiş trafo empedansı",
        latex: `R_{TK} = K_T \\cdot R_T = ${qZ(KT * RT)} \\qquad X_{TK} = K_T \\cdot X_T = ${qZ(KT * XT)}`,
      });
      checks.push({ level: "bilgi", message: MESSAGES.kt(KT, cMaks) });
    }
    const RTK = KT * RT;
    const XTK = KT * XT;

    // Şebeke
    let RQ = 0;
    let XQ = 0;
    if (inputs.sebeke === "var") {
      const SkQ = num(inputs, "SkQ", WHERE);
      const cQ = num(inputs, "cQ", WHERE);
      const rx = num(inputs, "RXQ", WHERE);
      const ZQ = (cQ * UrT * UrT) / SkQ;
      XQ = ZQ / Math.sqrt(1 + rx * rx);
      RQ = rx * XQ;
      steps.push(
        {
          label: "Şebeke empedansı (AG tarafına indirgenmiş)",
          latex: `Z_Q = \\frac{c_Q \\cdot U_{rT}^2}{S''_{kQ}} = \\frac{${qNum(cQ)} \\cdot (${qU(UrT)})^2}{${latexSpec(S("Sk"), SkQ)}} = ${qZ(ZQ)}`,
        },
        {
          label: "Şebeke direnci ve reaktansı",
          latex: `X_Q = \\frac{Z_Q}{\\sqrt{1 + (R_Q/X_Q)^2}} = ${qZ(XQ)} \\qquad R_Q = ${qNum(rx)} \\cdot X_Q = ${qZ(RQ)}`,
        },
      );
    } else {
      checks.push({ level: "bilgi", message: MESSAGES.sebekeYok });
    }

    // Kablo
    let RL = 0;
    let XL = 0;
    let RPE = 0;
    let XPE = 0;
    const fazToprak = inputs.fazToprak === "var";
    if (inputs.kablo === "var") {
      const L = num(inputs, "L", WHERE);
      const n = num(inputs, "nParalel", WHERE);
      const Rkm = num(inputs, "Rkm", WHERE);
      const Xkm = num(inputs, "Xkm", WHERE);
      RL = (Rkm * L) / n;
      XL = (Xkm * L) / n;
      steps.push({
        label: "Kablo empedansı (tek yol)",
        latex: `R_L = \\frac{R' \\cdot \\ell}{n} = \\frac{${qRpl(Rkm)} \\cdot ${qLen(L)}}{${qNum(n)}} = ${qZ(RL)} \\qquad X_L = \\frac{X' \\cdot \\ell}{n} = \\frac{${qRpl(Xkm)} \\cdot ${qLen(L)}}{${qNum(n)}} = ${qZ(XL)}`,
      });
      if (fazToprak) {
        const RPEkm = num(inputs, "RPEkm", WHERE);
        const XPEkm = num(inputs, "XPEkm", WHERE);
        RPE = (RPEkm * L) / n;
        XPE = (XPEkm * L) / n;
        steps.push({
          label: "Koruma iletkeni empedansı",
          latex: `R_{PE} = \\frac{R'_{PE} \\cdot \\ell}{n} = ${qZ(RPE)} \\qquad X_{PE} = \\frac{X'_{PE} \\cdot \\ell}{n} = ${qZ(XPE)}`,
        });
      }
    }

    // Toplam ve akımlar
    const Rk = RQ + RTK + RL;
    const Xk = XQ + XTK + XL;
    const Zk = Math.hypot(Rk, Xk);
    const Ik3 = (c * Un) / (SQRT3 * Zk);
    // X_k > 0: doğrulama R_T < Z_T şartını koyduğu için X_T > 0'dır.
    const RX = Rk / Xk;
    const kappa = 1.02 + 0.98 * Math.exp(-3 * RX);
    const ip = kappa * Math.SQRT2 * Ik3;
    const Ik2 = (SQRT3 / 2) * Ik3;
    const Sk = SQRT3 * Un * Ik3;
    Object.assign(outputs, { Ik3, ip, Ik2, Sk, kappa, RX, Zk, Rk, Xk, IrT });

    steps.push(
      {
        label: "Kısa devre empedansı",
        latex: `R_k = R_Q + R_{TK} + R_L = ${qZ(Rk)} \\qquad X_k = X_Q + X_{TK} + X_L = ${qZ(Xk)} \\qquad |Z_k| = \\sqrt{R_k^2 + X_k^2} = ${qZ(Zk)}`,
      },
      {
        label: "Üç fazlı başlangıç kısa devre akımı",
        latex: `I''_{k3} = \\frac{c \\cdot U_n}{\\sqrt{3} \\cdot |Z_k|} = \\frac{${qNum(c)} \\cdot ${qU(Un)}}{\\sqrt{3} \\cdot ${qZ(Zk)}} = ${qI(Ik3)}`,
      },
      {
        label: "Darbe katsayısı ve darbe akımı",
        latex: `\\kappa = 1{,}02 + 0{,}98\\, e^{-3 \\cdot ${qNum(RX)}} = ${qNum(kappa)} \\qquad i_p = \\kappa \\cdot \\sqrt{2} \\cdot I''_{k3} = ${qNum(kappa)} \\cdot \\sqrt{2} \\cdot ${qI(Ik3)} = ${qI(ip)}`,
      },
      {
        label: "İki fazlı kısa devre akımı ve kısa devre gücü",
        latex: `I''_{k2} = \\frac{\\sqrt{3}}{2} \\cdot ${qI(Ik3)} = ${qI(Ik2)} \\qquad S''_k = \\sqrt{3} \\cdot U_n \\cdot I''_{k3} = ${latexSpec(S("Sk"), Sk)}`,
      },
    );

    if (fazToprak) {
      const R1 = (2 / 3) * RQ + RTK + RL + RPE;
      const X1 = (2 / 3) * XQ + XTK + XL + XPE;
      const Z1 = Math.hypot(R1, X1);
      const Ik1 = (c * Un) / (SQRT3 * Z1);
      outputs.Ik1 = Ik1;
      steps.push(
        {
          label: "Faz-toprak döngü empedansı (basitleştirilmiş)",
          latex: `R_{\\text{döngü}} = \\tfrac{2}{3} R_Q + R_{TK} + R_L + R_{PE} = ${qZ(R1)} \\qquad X_{\\text{döngü}} = \\tfrac{2}{3} X_Q + X_{TK} + X_L + X_{PE} = ${qZ(X1)} \\qquad |Z_{\\text{döngü}}| = ${qZ(Z1)}`,
        },
        {
          label: "Faz-toprak kısa devre akımı",
          latex: `I''_{k1} = \\frac{c \\cdot U_n}{\\sqrt{3} \\cdot |Z_{\\text{döngü}}|} = \\frac{${qNum(c)} \\cdot ${qU(Un)}}{\\sqrt{3} \\cdot ${qZ(Z1)}} = ${qI(Ik1)}`,
        },
      );
      checks.push({ level: "bilgi", message: MESSAGES.faz1 });
    }
    if (inputs.hesap === "cmin") checks.push({ level: "bilgi", message: MESSAGES.cmin });

    // Kesme kapasitesi ve dinamik dayanım en büyük kısa devre akımına (c_maks) göre seçilir; c_min veya özel c ile
    // hesaplanan akım bu seçim için belirleyici değildir.
    if (inputs.hesap === "cmaks") {
      checks.push({
        level: "bilgi",
        message: `Seçilecek koruma düzeninin kesme kapasitesi ${qText(S("Ik3"), Ik3)} değerinden, baraların dinamik dayanımı ${qText(S("ip"), ip)} darbe akımından küçük olmamalıdır.`,
      });
    }

    return { outputs, steps, checks };
  },
};
