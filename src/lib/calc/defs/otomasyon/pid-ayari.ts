/**
 * KAPSAM 5.5 — PID ayarı (Ziegler–Nichols).
 *
 * KAYNAKLAR:
 *   - Klasik Ziegler–Nichols kuralları (1942). Mühendislik pratiğinde ve ders kitaplarında bilinen değerler
 *     bunlar olduğu için kullanılır. Açılıp doğrulanan kaynaklar:
 *       Kapalı çevrim (P 0,5·K_u; PI 0,45·K_u, T_i = T_u/1,2; PID 0,6·K_u, 0,5·T_u, 0,125·T_u):
 *         https://en.wikipedia.org/wiki/Ziegler%E2%80%93Nichols_method (tablo) ve
 *         https://pages.mtu.edu/~tbco/cm416/zn.html (K_u/2, K_u/2,2 ve P_u/1,2, K_u/1,7 · P_u/2 · P_u/8).
 *       Açık çevrim (K_o = T/(K·L) = 1/a; P K_o; PI 0,9·K_o, K_i = 0,27·K_o/L → T_i = L/0,3;
 *         PID 1,2·K_o, K_i = 0,6·K_o/L → T_i = 2L, K_d = 0,6·K_o·L → T_d = 0,5L):
 *         https://www.picuino.com/en/control-ziegler-nichols.html
 *     Ogata, "Modern Control Engineering" bu kuralları tablo halinde verir ancak bu çalışmada açılmadı.
 *   - K. J. Åström, T. Hägglund, "Advanced PID Control", ISA, 2006, §6.2: a = K·L/T tanımı, Örnek 6.1/6.2
 *     (PID; klasik tabloyla aynı) ve beklenen kapalı çevrim periyodu T_p (P ve PID için). Åström & Hägglund
 *     PI için değiştirilmiş katsayılar (0,4·K_u, 0,8·T_u; 3L) verir; burada klasik değerler tercih edildi ve
 *     klasik PI için T_p tahmini verilmez. Aynı bölüm kuralların çeyrek genlik sönümü hedeflediğini belirtir.
 *
 * Açık çevrim parametresi: birinci dereceden ölü zamanlı model K·e^(−sL)/(1 + sT) için en dik teğet t = L'de
 * K/T eğimlidir ve dikey ekseni −K·L/T'de keser; bu yüzden a = K·L/T.
 * Değerler standart (ideal, ISA) form içindir; paralel form kazançları K_i = K_p/T_i, K_d = K_p·T_d.
 */
import { latexAuto, latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Reference, Step } from "@/lib/calc/types";

export type PidYontem = "kapali" | "acik";
export type PidTip = "P" | "PI" | "PID";

interface Rule {
  /** Kapalı çevrimde K_p/K_u; açık çevrimde a·K_p */
  kp: number;
  /** Kapalı çevrimde T_i/T_u; açık çevrimde T_i/L */
  ti?: number;
  /** Verilirse T_i = (T_u veya L)/tiDiv (klasik tablodaki yazım: T_u/1,2 ve L/0,3) */
  tiDiv?: number;
  /** Kapalı çevrimde T_d/T_u; açık çevrimde T_d/L */
  td?: number;
  /** Kapalı çevrim periyodu tahmini: T_p/T_u veya T_p/L (Åström & Hägglund; yalnız P ve PID) */
  tp?: number;
}

/** Klasik Ziegler–Nichols (kaynaklar dosya başında); T_p: Åström & Hägglund (2006) Tablo 6.1/6.2 */
export const ZN_RULES: Record<PidYontem, Record<PidTip, Rule>> = {
  kapali: {
    P: { kp: 0.5, tp: 1.0 },
    PI: { kp: 0.45, tiDiv: 1.2 },
    PID: { kp: 0.6, ti: 0.5, td: 0.125, tp: 0.85 },
  },
  acik: {
    P: { kp: 1, tp: 4 },
    PI: { kp: 0.9, tiDiv: 0.3 },
    PID: { kp: 1.2, ti: 2, td: 0.5, tp: 3.4 },
  },
};

const ZN_KLASIK: Reference = {
  standard: "Ziegler & Nichols (1942)",
  title: "Optimum Settings for Automatic Controllers, Trans. ASME 64:759–768",
  note: "Klasik tablo; özgün makale açılmadı. Kapalı çevrim değerleri Wikipedia (Ziegler–Nichols method) ve Michigan Tech CM416 ders notundan, açık çevrim değerleri picuino.com Ziegler–Nichols sayfasından doğrulandı.",
};

const ASTROM: Reference = {
  standard: "Åström & Hägglund (2006)",
  title: "Advanced PID Control, ISA",
  clause: "§6.2, Tablo 6.1 ve 6.2",
};

const MESSAGES = {
  aggressive:
    "Ziegler–Nichols kuralları çeyrek genlik sönüm oranını (ardışık tepeler arası oran 1/4) hedefler: agresiftir, set değer aşımı büyük ve sönüm zayıf olabilir. Değerleri başlangıç noktası olarak kullanıp devreye almada ince ayar yapın.",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`pid-ayari: "${key}" sayı değil`);
  return v;
}

const qt = (v: number) => latexAuto(v, "zaman");
const n = (v: number) => latexNum(v);

export const pidAyari: CalcDefinition = {
  id: "5.5",
  slug: "pid-ayari",
  category: "otomasyon",
  title: "PID ayarı (Ziegler–Nichols)",
  description:
    "Ziegler–Nichols kapalı çevrim (salınım: K_u, T_u) veya açık çevrim (reaksiyon eğrisi: K, L, T) yöntemiyle P, PI ve PID denetleyici parametreleri; standart ve paralel form kazançları.",
  formulas: [
    {
      label: "Standart (ideal) form",
      latex: "u(t) = K_p \\left( e(t) + \\frac{1}{T_i} \\int_0^t e(\\tau)\\,d\\tau + T_d \\frac{de(t)}{dt} \\right)",
    },
    { label: "Paralel form kazançları", latex: "K_i = \\frac{K_p}{T_i}, \\quad K_d = K_p \\cdot T_d" },
    {
      label: "Kapalı çevrim (salınım deneyi)",
      latex:
        "\\begin{aligned} \\text{P}&: K_p = 0{,}5\\,K_u \\\\ \\text{PI}&: K_p = 0{,}45\\,K_u,\\; T_i = T_u/1{,}2 \\\\ \\text{PID}&: K_p = 0{,}6\\,K_u,\\; T_i = 0{,}5\\,T_u,\\; T_d = 0{,}125\\,T_u \\end{aligned}",
    },
    {
      label: "Açık çevrim (reaksiyon eğrisi), a = K·L/T",
      latex:
        "\\begin{aligned} \\text{P}&: K_p = 1/a \\\\ \\text{PI}&: K_p = 0{,}9/a,\\; T_i = L/0{,}3 \\\\ \\text{PID}&: K_p = 1{,}2/a,\\; T_i = 2L,\\; T_d = L/2 \\end{aligned}",
    },
  ],
  references: [
    ZN_KLASIK,
    {
      ...ASTROM,
      note: "a = K·L/T tanımı, örnekler ve beklenen kapalı çevrim periyodu (P, PID). PI için değiştirilmiş katsayılar (0,4·K_u, 0,8·T_u; 3L) önerir; burada klasik değerler kullanılır.",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "yontem",
      label: "Yöntem",
      options: [
        { value: "kapali", label: "Kapalı çevrim (salınım deneyi: K_u, T_u)" },
        { value: "acik", label: "Açık çevrim (reaksiyon eğrisi: K, L, T)" },
      ],
      default: "kapali",
    },
    {
      kind: "select",
      key: "tip",
      label: "Denetleyici",
      options: [
        { value: "P", label: "P" },
        { value: "PI", label: "PI" },
        { value: "PID", label: "PID" },
      ],
      default: "PID",
    },
    {
      kind: "number",
      key: "Ku",
      label: "Kritik kazanç",
      symbol: "K_u",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 2.5,
      min: 0,
      minExclusive: true,
      help: "Yalnız P denetimde kazanç artırılırken sürekli salınımın başladığı kazanç.",
      visibleWhen: { key: "yontem", equals: "kapali" },
    },
    {
      kind: "number",
      key: "Tu",
      label: "Salınım periyodu",
      symbol: "T_u",
      dimension: "zaman",
      defaultUnit: "s",
      units: ["ms", "s", "min"],
      default: 40,
      min: 0,
      minExclusive: true,
      help: "Kritik kazançtaki sürekli salınımın periyodu.",
      visibleWhen: { key: "yontem", equals: "kapali" },
    },
    {
      kind: "number",
      key: "K",
      label: "Proses kazancı",
      symbol: "K",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 1.5,
      min: 0,
      minExclusive: true,
      help: "Kalıcı çıkış değişimi / basamak girişi (aynı birimlerde, ör. %/%). Ters etkili proseste mutlak değer.",
      visibleWhen: { key: "yontem", equals: "acik" },
    },
    {
      kind: "number",
      key: "L",
      label: "Ölü zaman",
      symbol: "L",
      dimension: "zaman",
      defaultUnit: "s",
      units: ["ms", "s", "min"],
      default: 5,
      min: 0,
      minExclusive: true,
      help: "Basamaktan en dik teğetin zaman eksenini kestiği ana kadar geçen süre.",
      visibleWhen: { key: "yontem", equals: "acik" },
    },
    {
      kind: "number",
      key: "T",
      label: "Zaman sabiti",
      symbol: "T",
      dimension: "zaman",
      defaultUnit: "s",
      units: ["ms", "s", "min"],
      default: 30,
      min: 0,
      minExclusive: true,
      help: "Teğet yöntemiyle tutarlı olmalı: T = K / (en dik teğetin eğimi, birim basamak başına). Böylece a = K·L/T teğetin dikey eksen kesimidir.",
      visibleWhen: { key: "yontem", equals: "acik" },
    },
  ],
  outputs: [
    { key: "Kp", label: "Oransal kazanç", symbol: "K_p", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "Ti", label: "İntegral zamanı", symbol: "T_i", dimension: "zaman", defaultUnit: "s" },
    { key: "Td", label: "Türev zamanı", symbol: "T_d", dimension: "zaman", defaultUnit: "s" },
    { key: "Ki", label: "İntegral kazancı, paralel form (1/s)", symbol: "K_i", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "Kd", label: "Türev kazancı, paralel form", symbol: "K_d", dimension: "zaman", defaultUnit: "s" },
    { key: "Tp", label: "Beklenen kapalı çevrim periyodu", symbol: "T_p", dimension: "zaman", defaultUnit: "s" },
    { key: "a", label: "Normalize kazanç (a = K·L/T)", symbol: "a", dimension: "boyutsuz", defaultUnit: "unitless" },
  ],

  compute: (inputs) => {
    const yontem = inputs.yontem as PidYontem;
    const tip = inputs.tip as PidTip;
    const rule = ZN_RULES[yontem]?.[tip];
    if (!rule) throw new Error(`pid-ayari: bilinmeyen yöntem/tip "${String(yontem)}/${String(tip)}"`);

    const steps: Step[] = [];
    const outputs: Record<string, number> = {};
    let Kp: number;
    /** T_i, T_d ve T_p'nin ölçeklendiği süre (T_u veya L) ve sembolü */
    let base: number;
    let baseSym: string;

    if (yontem === "kapali") {
      const Ku = num(inputs, "Ku");
      base = num(inputs, "Tu");
      baseSym = "T_u";
      Kp = rule.kp * Ku;
      steps.push({ label: "Oransal kazanç", latex: `K_p = ${n(rule.kp)} \\cdot K_u = ${n(rule.kp)} \\cdot ${n(Ku)} = ${n(Kp)}` });
    } else {
      const K = num(inputs, "K");
      base = num(inputs, "L");
      baseSym = "L";
      const T = num(inputs, "T");
      const a = (K * base) / T;
      outputs.a = a;
      Kp = rule.kp / a;
      steps.push({
        label: "Normalize kazanç",
        latex: `a = \\frac{K \\cdot L}{T} = \\frac{${n(K)} \\cdot ${qt(base)}}{${qt(T)}} = ${n(a)}`,
      });
      steps.push({ label: "Oransal kazanç", latex: `K_p = \\frac{${n(rule.kp)}}{a} = \\frac{${n(rule.kp)}}{${n(a)}} = ${n(Kp)}` });
    }
    outputs.Kp = Kp;

    if (rule.ti !== undefined || rule.tiDiv !== undefined) {
      const Ti = rule.tiDiv !== undefined ? base / rule.tiDiv : (rule.ti as number) * base;
      const Ki = Kp / Ti;
      outputs.Ti = Ti;
      outputs.Ki = Ki;
      steps.push({
        label: "İntegral zamanı",
        latex:
          rule.tiDiv !== undefined
            ? `T_i = \\frac{${baseSym}}{${n(rule.tiDiv)}} = \\frac{${qt(base)}}{${n(rule.tiDiv)}} = ${qt(Ti)}`
            : `T_i = ${n(rule.ti as number)} \\cdot ${baseSym} = ${n(rule.ti as number)} \\cdot ${qt(base)} = ${qt(Ti)}`,
      });
      steps.push({
        label: "İntegral kazancı (paralel form)",
        latex: `K_i = \\frac{K_p}{T_i} = \\frac{${n(Kp)}}{${qt(Ti)}} = ${n(Ki)}\\,\\mathrm{s}^{-1}`,
      });
    }
    if (rule.td !== undefined) {
      const Td = rule.td * base;
      const Kd = Kp * Td;
      outputs.Td = Td;
      outputs.Kd = Kd;
      steps.push({ label: "Türev zamanı", latex: `T_d = ${n(rule.td)} \\cdot ${baseSym} = ${n(rule.td)} \\cdot ${qt(base)} = ${qt(Td)}` });
      steps.push({ label: "Türev kazancı (paralel form)", latex: `K_d = K_p \\cdot T_d = ${n(Kp)} \\cdot ${qt(Td)} = ${qt(Kd)}` });
    }
    if (rule.tp !== undefined) {
      const Tp = rule.tp * base;
      outputs.Tp = Tp;
      steps.push({ label: "Beklenen kapalı çevrim periyodu", latex: `T_p = ${n(rule.tp)} \\cdot ${baseSym} = ${n(rule.tp)} \\cdot ${qt(base)} = ${qt(Tp)}` });
    }

    const checks: Check[] = [{ level: "uyari", message: MESSAGES.aggressive, reference: ZN_KLASIK }];
    return { outputs, steps, checks };
  },
};
