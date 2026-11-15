/**
 * KAPSAM 4.12 — Batarya ömrü.
 *
 * - Ortalama akım: sabit akım ya da görev döngüsü profili (TI SWRA347a §5.5):
 *   I_ort = [I_aktif·t_aktif + I_uyku·(T − t_aktif)]/T.
 * - İsteğe bağlı öz deşarj: yıllık kayıp oranı r (anma kapasitesinin oranı) sabit eşdeğer akım olarak eklenir:
 *   I_öz = r·C/(1 yıl), 1 yıl = 365 gün (doğrusal yaklaşım). I = I_ort + I_öz.
 * - Peukert'siz: t = d·C/I (d: kullanılabilir kapasite oranı).
 * - Peukert (Victron BMV-700 §8: C_p = Iⁿ·t sabit): anma kapasitesi C, H saatlik deşarjda (C_H) verilmişse
 *   Iᵏ·t = (C/H)ᵏ·H → t = H·(C/(I·H))ᵏ. Kullanılabilir oran d SÜREYE uygulanır: t = d·H·(C/(I·H))ᵏ.
 *   Gerekçe: sabit akımla tabana (ör. %50 deşarj) kadar deşarj, aynı akımda tam deşarj süresinin d katı sürer;
 *   d·C'yi üssün içine koymak anma noktasını (C/H akımı) kaydırırdı. k = 1'de iki biçim aynıdır.
 * - Kullanılabilir kapasite (bu akımda) C_kul = I·t.
 * Ömür saat ve gün olarak, birimleri sabit verilir (zaman ailesinde otomatik birim saat/gün seçmez).
 */
import { LIMITS } from "@/config/sinirlar";
import { latexNum, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { REF, num, opt, specText, specWriter } from "./temel-ortak";

export type BataryaProfil = "sabit" | "dongu";

/** Hüküm olmayan notlar (varsayım, yöntem, hatırlatma) */
const BILGI = "ok" as const; // birleştirmede "bilgi" olur

const WHERE = "batarya-omru";

/** 1 yıl = 365 gün, s (birim kataloğundaki "yr" ile aynı) */
const YIL = 365 * 86400;

const MESSAGES = {
  activeTooLong: "Aktif süre periyottan büyük olamaz.",
  zeroCurrent: "Ortalama akım sıfır: batarya ömrü hesaplanamaz (aktif veya uyku akımı girin).",
  peukert:
    "Peukert üssü gerçeğin kaba bir yaklaşımıdır; çok yüksek akımlarda batarya hesaplanandan da az kapasite verir (Victron).",
  peukertAverage: "Peukert düzeltmesi ortalama akıma uygulandı; denklem sabit akımla deşarj için tanımlıdır.",
  peukertBelowRated: (iRated: string, cKul: string) =>
    `Akım anma deşarj akımının (C/H = ${iRated}) altında: Peukert denklemi anma kapasitesinden büyük kullanılabilir kapasite (${cKul}) veriyor; bu, anma noktasının dışına bir dışdeğerlemedir.`,
  fullCapacity:
    "Kullanılabilir kapasite oranı %100: sıcaklık, yaşlanma ve kesme gerilimi etkileri hesaba katılmadı. Kurşun-asit akülerde Victron deşarj tabanı olarak %50 önerir.",
  selfDischarge: "Öz deşarj, yıllık oranın sabit eşdeğer akıma çevrilmesiyle eklendi (doğrusal yaklaşım).",
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "profil",
    label: "Yük profili",
    options: [
      { value: "sabit", label: "Sabit akım" },
      { value: "dongu", label: "Görev döngüsü (aktif / uyku)" },
    ],
    default: "sabit",
  },
  {
    kind: "select",
    key: "peukert",
    label: "Peukert düzeltmesi",
    options: [
      { value: "yok", label: "Yok (t = C/I)" },
      { value: "var", label: "Var (kurşun-asit vb.)" },
    ],
    default: "yok",
  },
  {
    kind: "number",
    key: "C",
    label: "Anma kapasitesi",
    symbol: "C",
    dimension: "yuk",
    defaultUnit: "mAh",
    units: ["mAh", "Ah"],
    default: 2000,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "I",
    label: "Yük akımı",
    symbol: "I",
    dimension: "akim",
    defaultUnit: "mA",
    units: ["uA", "mA", "A"],
    default: 100,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "profil", equals: "sabit" },
  },
  {
    kind: "number",
    key: "Ia",
    label: "Aktif akım",
    symbol: "I_{\\text{aktif}}",
    dimension: "akim",
    defaultUnit: "mA",
    units: ["uA", "mA", "A"],
    default: 20,
    min: 0,
    visibleWhen: { key: "profil", equals: "dongu" },
  },
  {
    kind: "number",
    key: "ta",
    label: "Aktif süre (periyot başına)",
    symbol: "t_{\\text{aktif}}",
    dimension: "zaman",
    defaultUnit: "ms",
    units: ["us", "ms", "s", "min"],
    default: 100,
    min: 0,
    visibleWhen: { key: "profil", equals: "dongu" },
  },
  {
    kind: "number",
    key: "Is",
    label: "Uyku akımı",
    symbol: "I_{\\text{uyku}}",
    dimension: "akim",
    defaultUnit: "uA",
    units: ["uA", "mA"],
    default: 5,
    min: 0,
    visibleWhen: { key: "profil", equals: "dongu" },
  },
  {
    kind: "number",
    key: "T",
    label: "Periyot",
    symbol: "T",
    dimension: "zaman",
    defaultUnit: "s",
    units: ["ms", "s", "min", "h"],
    default: 10,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "profil", equals: "dongu" },
  },
  {
    kind: "number",
    key: "d",
    label: "Kullanılabilir kapasite oranı",
    symbol: "d",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    default: 100,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "Sıcaklık, yaşlanma, kesme gerilimi ve deşarj tabanı için düşürün (ör. kurşun-asitte Victron deşarj tabanı %50 → %50).",
  },
  {
    kind: "number",
    key: "oz",
    label: "Öz deşarj (yıllık, anma kapasitesinin oranı)",
    symbol: "r",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    min: 0,
    max: 1,
    optional: true,
    help: "Pil veri sayfasındaki yıllık öz deşarj oranı (aylık oranı 12 ile çarpın). Boş bırakılırsa yok sayılır.",
  },
  {
    kind: "number",
    key: "k",
    label: "Peukert üssü",
    symbol: "k",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    units: ["unitless"],
    default: LIMITS.elektronikTemel.peukertUssuKursunAsit,
    min: 1,
    help: "Akü veri sayfasından veya iki anma kapasitesinden (ör. C5 ve C20) hesaplanır. Varsayılan 1,25: Victron'a göre çoğu kurşun-asit akü için kabul edilebilir ortalama; ideal batarya 1.",
    visibleWhen: { key: "peukert", equals: "var" },
  },
  {
    kind: "number",
    key: "H",
    label: "Anma deşarj süresi (C_H)",
    symbol: "H",
    dimension: "zaman",
    defaultUnit: "h",
    units: ["h"],
    default: LIMITS.elektronikTemel.peukertAnmaSuresi / 3600,
    min: 0,
    minExclusive: true,
    help: "Anma kapasitesinin verildiği deşarj süresi (C20 için 20 sa).",
    visibleWhen: { key: "peukert", equals: "var" },
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "D", label: "Görev oranı", symbol: "D", dimension: "oran", defaultUnit: "percent", units: ["percent"] },
  { key: "Iort", label: "Ortalama akım", symbol: "I_{\\text{ort}}", dimension: "akim", defaultUnit: "A", significant: 5 },
  { key: "Ioz", label: "Öz deşarj eşdeğer akımı", symbol: "I_{\\text{öz}}", dimension: "akim", defaultUnit: "A" },
  { key: "Itop", label: "Hesapta kullanılan akım", symbol: "I", dimension: "akim", defaultUnit: "A" },
  { key: "tNaif", label: "Peukert'siz ömür", symbol: "t_{k=1}", dimension: "zaman", defaultUnit: "h", units: ["min", "h"], autoUnit: false, significant: 5 },
  { key: "t", label: "Batarya ömrü", symbol: "t", dimension: "zaman", defaultUnit: "h", units: ["min", "h"], autoUnit: false, significant: 5 },
  { key: "tGun", label: "Batarya ömrü (gün)", symbol: "t", dimension: "zaman", defaultUnit: "day", units: ["day", "yr"], autoUnit: false, significant: 5 },
  { key: "Ckul", label: "Kullanılabilir kapasite (bu akımda)", symbol: "C_{\\text{kul}}", dimension: "yuk", defaultUnit: "mAh", units: ["mAh", "Ah"] },
];

const qi = specWriter(INPUTS);
const qo = specWriter(OUTPUTS);

/** Görünür girdilerden ortalama akım ve öz deşarj eşdeğer akımı (adımsız). */
function currents(inputs: ComputeInputs): { Iort: number; Ioz: number | undefined; D: number | undefined } {
  let Iort: number;
  let D: number | undefined;
  if (inputs.profil === "dongu") {
    const Ia = num(inputs, "Ia", WHERE);
    const ta = num(inputs, "ta", WHERE);
    const Is = num(inputs, "Is", WHERE);
    const T = num(inputs, "T", WHERE);
    D = ta / T;
    Iort = (Ia * ta + Is * (T - ta)) / T;
  } else {
    Iort = num(inputs, "I", WHERE);
  }
  const r = opt(inputs, "oz");
  const Ioz = r !== undefined ? (r * num(inputs, "C", WHERE)) / YIL : undefined;
  return { Iort, Ioz, D };
}

function validate(inputs: ComputeInputs): Check[] {
  if (inputs.profil === "dongu" && num(inputs, "ta", WHERE) > num(inputs, "T", WHERE)) {
    return [{ level: "hata", message: MESSAGES.activeTooLong }];
  }
  const { Iort, Ioz } = currents(inputs);
  if (!(Iort + (Ioz ?? 0) > 0)) return [{ level: "hata", message: MESSAGES.zeroCurrent }];
  return [];
}

function compute(inputs: ComputeInputs) {
  const C = num(inputs, "C", WHERE);
  const d = num(inputs, "d", WHERE);
  const dongu = inputs.profil === "dongu";
  const peukert = inputs.peukert === "var";
  const { Iort, Ioz, D } = currents(inputs);
  const I = Iort + (Ioz ?? 0);

  const steps: Step[] = [];
  const outputs: Record<string, number> = {};
  const checks: Check[] = [];

  if (dongu) {
    const Ia = num(inputs, "Ia", WHERE);
    const ta = num(inputs, "ta", WHERE);
    const Is = num(inputs, "Is", WHERE);
    const T = num(inputs, "T", WHERE);
    steps.push(
      {
        label: "Görev oranı",
        latex: `D = \\frac{t_{\\text{aktif}}}{T} = \\frac{${qi("ta", ta)}}{${qi("T", T)}} = ${qo("D", D ?? 0)}`,
      },
      {
        label: "Ortalama akım",
        latex: `I_{\\text{ort}} = \\frac{I_{\\text{aktif}} \\cdot t_{\\text{aktif}} + I_{\\text{uyku}} \\cdot (T - t_{\\text{aktif}})}{T} = \\frac{${qi("Ia", Ia)} \\cdot ${qi("ta", ta)} + ${qi("Is", Is)} \\cdot (${qi("T", T)} - ${qi("ta", ta)})}{${qi("T", T)}} = ${qo("Iort", Iort)}`,
      },
    );
    Object.assign(outputs, { D, Iort });
  }

  const iSym = Ioz !== undefined ? "I" : dongu ? "I_{\\text{ort}}" : "I";
  const iText = Ioz !== undefined ? qo("Itop", I) : dongu ? qo("Iort", Iort) : qi("I", I);
  if (Ioz !== undefined) {
    const r = num(inputs, "oz", WHERE);
    steps.push(
      {
        label: "Öz deşarj eşdeğer akımı",
        latex: `I_{\\text{öz}} = \\frac{r \\cdot C}{1\\,\\text{yıl}} = \\frac{${latexNum(r)} \\cdot ${qi("C", C)}}{${latexQty(YIL, "h", { decimals: 0 })}} = ${qo("Ioz", Ioz)}`,
      },
      {
        label: "Hesapta kullanılan akım",
        latex: `I = ${dongu ? "I_{\\text{ort}}" : "I_{\\text{yük}}"} + I_{\\text{öz}} = ${dongu ? qo("Iort", Iort) : qo("Itop", Iort)} + ${qo("Ioz", Ioz)} = ${qo("Itop", I)}`,
      },
    );
    Object.assign(outputs, { Ioz, Itop: I });
    checks.push({ level: BILGI, message: MESSAGES.selfDischarge });
  }

  const tNaif = (d * C) / I;
  let t: number;
  if (peukert) {
    const k = num(inputs, "k", WHERE);
    const H = num(inputs, "H", WHERE);
    const ratio = C / (I * H);
    t = d * H * ratio ** k;
    steps.push(
      {
        label: "Peukert'siz ömür (karşılaştırma)",
        latex: `t_{k=1} = \\frac{d \\cdot C}{${iSym}} = \\frac{${latexNum(d)} \\cdot ${qi("C", C)}}{${iText}} = ${qo("tNaif", tNaif)}`,
      },
      {
        label: "Anma akımına oran",
        latex: `\\frac{C}{${iSym} \\cdot H} = \\frac{${qi("C", C)}}{${iText} \\cdot ${qi("H", H)}} = ${latexNum(ratio)}`,
      },
      {
        label: "Peukert düzeltmeli ömür",
        latex: `t = d \\cdot H \\left(\\frac{C}{${iSym} \\cdot H}\\right)^{k} = ${latexNum(d)} \\cdot ${qi("H", H)} \\cdot (${latexNum(ratio)})^{${latexNum(k)}} = ${qo("t", t)}`,
      },
    );
    outputs.tNaif = tNaif;
    checks.push({ level: BILGI, message: MESSAGES.peukert, reference: REF.victronPeukert });
    if (dongu || Ioz !== undefined) checks.push({ level: BILGI, message: MESSAGES.peukertAverage });
    if (k > 1 && ratio > 1 && I * t > C) {
      checks.push({
        level: "uyari",
        message: MESSAGES.peukertBelowRated(specText(OUTPUTS, "Iort", C / H), specText(OUTPUTS, "Ckul", I * t)),
        reference: REF.victronPeukert,
      });
    }
  } else {
    t = tNaif;
    steps.push({
      label: "Batarya ömrü",
      latex: `t = \\frac{d \\cdot C}{${iSym}} = \\frac{${latexNum(d)} \\cdot ${qi("C", C)}}{${iText}} = ${qo("t", t)}`,
    });
  }

  const Ckul = I * t;
  steps.push(
    { label: "Gün olarak", latex: `t = \\frac{${qo("t", t)}}{24\\,\\text{sa/gün}} = ${qo("tGun", t)}` },
    { label: "Kullanılabilir kapasite (bu akımda)", latex: `C_{\\text{kul}} = ${iSym} \\cdot t = ${iText} \\cdot ${qo("t", t)} = ${qo("Ckul", Ckul)}` },
  );
  Object.assign(outputs, { t, tGun: t, Ckul });
  if (d === 1) checks.push({ level: BILGI, message: MESSAGES.fullCapacity, reference: REF.victronTaban });

  return { outputs, steps, checks };
}

export const bataryaOmru: CalcDefinition = {
  id: "4.12",
  slug: "batarya-omru",
  category: "elektronik",
  title: "Batarya ömrü",
  description:
    "Sabit akımda veya aktif/uyku görev döngüsünde ortalama akımı ve batarya ömrünü saat ve gün olarak hesaplayın; kullanılabilir kapasite oranını, isteğe bağlı öz deşarjı ve kurşun-asit akülerde Peukert düzeltmesini hesaba katın.",
  formulas: [
    {
      label: "Görev döngüsünde ortalama akım",
      latex: "I_{\\text{ort}} = \\frac{I_{\\text{aktif}} \\cdot t_{\\text{aktif}} + I_{\\text{uyku}} \\cdot (T - t_{\\text{aktif}})}{T}",
    },
    { label: "Öz deşarj eşdeğer akımı (isteğe bağlı)", latex: "I_{\\text{öz}} = \\frac{r \\cdot C}{1\\,\\text{yıl}}, \\qquad I = I_{\\text{ort}} + I_{\\text{öz}}" },
    { label: "Batarya ömrü", latex: "t = \\frac{d \\cdot C}{I}" },
    { label: "Peukert düzeltmesi (anma: C, H saatte)", latex: "t = d \\cdot H \\left(\\frac{C}{I \\cdot H}\\right)^{k}" },
    { label: "Kullanılabilir kapasite", latex: "C_{\\text{kul}} = I \\cdot t" },
  ],
  references: [REF.tiAn092, REF.victronPeukert, REF.victronTaban],
  inputs: INPUTS,
  outputs: OUTPUTS,
  validate: (inputs) => validate(inputs),
  compute: (inputs) => compute(inputs),
};
