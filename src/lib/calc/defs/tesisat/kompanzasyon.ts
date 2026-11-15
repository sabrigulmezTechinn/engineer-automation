/**
 * KAPSAM 2.4 — Kompanzasyon (gerekli kondansatör gücü, standart kademe önerisi, EPDK reaktif sınır kontrolü).
 *
 * Q_c = P·(tan φ₁ − tan φ₂). İşaret kuralı: endüktif φ > 0, kapasitif φ < 0 (hedef kapasitifse tan φ₂ < 0).
 * Standart kondansatör önerisi (elle doğrulanabilir kural): kalan gücü aşmayan en büyük katalog değeri seçilir; kalan,
 * listedeki en küçük değerden küçük kalınca en küçük değer eklenir (toplam Q_c'yi en küçük birimden az aşar).
 * Önerilen toplamla tan φ_k = tan φ₁ − Q_k/P; negatifse aşırı kompanzasyon (kapasitif).
 * Üçgen bağlı bataryada faz başına kapasite C_Δ = Q/(3·ω·U²).
 *
 * EPDK sınırları (ctx.limits.tesisatGuc.epdkReaktif): reaktif enerji / aktif enerji oranı; sabit yük kabulüyle oran = |tan φ|.
 * Kaynak: Dağıtım Lisansı Sahibi Tüzel Kişiler ve Görevli Tedarik Şirketlerinin Tarife Uygulamalarına İlişkin Usul ve
 * Esaslar, Madde 13 ve EK-1 — https://www.epdk.gov.tr/Detay/DownloadDocument?id=MESSe3sPiW4=
 *
 * Varsayılan katalog değerleri: ENTES "Alçak Gerilim Güç Kondansatörleri" (basım 04.2015), üç fazlı 400 V modeller
 * ENT.CXD-400-5 … -30 ve ENT.C100-400-50 — https://www.entes.com.tr/uploads/files/TR Alcak Gerilim Guc Kondansatorleri.pdf
 * (aynı katalog: ENT.CXD-400-10 için 3×66 µF; ENT.C10-400-1/1,5/2,5 ve ENT.C100-400-2,5/4 küçük kademeler de vardır).
 */
import { latexSpec } from "@/lib/calc/latex";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { formatNumber, formatQuantity, fromSI } from "@/lib/units";
import { n0, num, numList, qNum, qText, specOf } from "./guc-ortak";

const WHERE = "kompanzasyon";

export type KompMevcut = "cos" | "oran";
export type KompKarakter = "enduktif" | "kapasitif";
export type KompSinif = "buyuk" | "kucuk" | "muaf";

const REF_EPDK: Reference = {
  standard: "EPDK 5999-3 sayılı Kurul Kararı",
  title: "Dağıtım Lisansı Sahibi Tüzel Kişiler ve Görevli Tedarik Şirketlerinin Tarife Uygulamalarına İlişkin Usul ve Esaslar",
  clause: "Madde 13, EK-1",
};

const OUTPUTS: OutputSpec[] = [
  { key: "Qc", label: "Gerekli kondansatör gücü", symbol: "Q_c", dimension: "reaktif_guc", defaultUnit: "kvar" },
  { key: "Qk", label: "Önerilen standart kondansatör toplamı", symbol: "Q_k", dimension: "reaktif_guc", defaultUnit: "kvar" },
  { key: "cos1", label: "Mevcut güç faktörü", symbol: "\\cos\\varphi_1", dimension: "boyutsuz", defaultUnit: "unitless" },
  { key: "cosK", label: "Önerilen kondansatörlerle güç faktörü", symbol: "\\cos\\varphi_k", dimension: "boyutsuz", defaultUnit: "unitless" },
  { key: "oran1", label: "Mevcut endüktif reaktif oran (Q/P)", symbol: "\\tan\\varphi_1", dimension: "oran", defaultUnit: "percent", units: ["percent", "fraction"] },
  { key: "oran2", label: "Hedef reaktif oran (|Q/P|)", symbol: "|\\tan\\varphi_2|", dimension: "oran", defaultUnit: "percent", units: ["percent", "fraction"] },
  { key: "oranK", label: "Önerilen kondansatörlerle reaktif oran (|Q/P|)", symbol: "|\\tan\\varphi_k|", dimension: "oran", defaultUnit: "percent", units: ["percent", "fraction"] },
  { key: "Q1", label: "Mevcut reaktif güç", symbol: "Q_1", dimension: "reaktif_guc", defaultUnit: "kvar" },
  { key: "S1", label: "Mevcut görünür güç", symbol: "S_1", dimension: "gorunur_guc", defaultUnit: "kVA" },
  { key: "S2", label: "Hedefteki görünür güç", symbol: "S_2", dimension: "gorunur_guc", defaultUnit: "kVA" },
  // Kondansatör katalogları faz başına kapasiteyi µF verir (ör. 3×66 µF); otomatik birim mF'ye geçmesin.
  { key: "C", label: "Gerekli kapasite (üçgen bağlı, faz başına)", symbol: "C_{\\Delta}", dimension: "kapasitans", defaultUnit: "uF", autoUnit: false },
];

const S = (key: string) => specOf(OUTPUTS, key);
const qP = (v: number) => latexSpec({ dimension: "guc", defaultUnit: "kW" }, v);
const qQ = (v: number) => latexSpec(S("Qc"), v);
const qU = (v: number) => latexSpec({ dimension: "gerilim", defaultUnit: "V" }, v);
const qF = (v: number) => latexSpec({ dimension: "frekans", defaultUnit: "Hz" }, v);
const pct = (x: number) => formatQuantity(fromSI(x, "percent"), "percent");
const kvarText = (q: number) => formatQuantity(fromSI(q, "kvar"), "kvar");

const MESSAGES = {
  nothingToDo:
    "Mevcut güç faktörü hedefi zaten sağlıyor (Q_c ≤ 0): kondansatör gerekmez. Hedef cos φ₂'yi veya karakterini kontrol edin.",
  assumption:
    "EPDK sınırları fatura dönemindeki reaktif ve aktif enerjinin oranıdır; hesap yükün dönem boyunca sabit olduğunu kabul eder (oran = |tan φ|). Değişken yükte otomatik kompanzasyon (kademeli röle) gerekir.",
  muaf: "Mesken, aydınlatma, tek fazla beslenen tüketiciler ve kurulu gücü 15 kW'a (dâhil) kadar olan kullanıcılara reaktif enerji tarifesi uygulanmaz (Madde 13 (1)).",
  hedefOk: (kar: string, oran: string, lim: string) => `Hedef ${kar} reaktif oran ${oran} ≤ ${lim}: EPDK sınırını sağlar.`,
  hedefFail: (kar: string, oran: string, lim: string, cosMin: string) =>
    `Hedef ${kar} reaktif oran ${oran} > ${lim}: EPDK sınırını sağlamaz. Sınır için hedef güç faktörü en az ${cosMin} (${kar}) olmalıdır.`,
  kurulu: (list: string, total: string) =>
    `Önerilen kondansatörler: ${list} = ${total} (kalanı aşmayan en büyük katalog değeri; kalan en küçük değerden küçükse en küçük değer). Katalog güçleri anma gerilimindedir; farklı işletme geriliminde Q = Q_n·(U/U_n)².`,
  kuruluOk: (kar: string, oran: string, lim: string) => `Önerilen kondansatörlerin tamamı devredeyken ${kar} oran ${oran} ≤ ${lim}: EPDK sınırı içinde.`,
  kuruluFail: (kar: string, oran: string, lim: string) =>
    `Önerilen kondansatörlerin tamamı devredeyken ${kar} oran ${oran} > ${lim}: EPDK sınırı aşılır. Daha küçük kademeler ekleyin veya kademeli (otomatik) kompanzasyonla yalnızca gereken kadarını devreye alın.`,
  mevcut: (oran: string, lim: string, asar: boolean) =>
    `Mevcut endüktif oran ${oran} ${asar ? ">" : "≤"} ${lim}${asar ? ": kompanzasyonsuz durumda reaktif enerji bedeli uygulanır." : "."}`,
} as const;

type Limits = CalcContext["limits"];

function tanPhi1(inputs: ComputeInputs): number {
  if (inputs.mevcut === "oran") return num(inputs, "oran1", WHERE);
  const c = num(inputs, "cos1", WHERE);
  return Math.sqrt(1 - c * c) / c;
}

/** İşaretli tan φ₂ (kapasitifte negatif). */
function tanPhi2(inputs: ComputeInputs): number {
  const c = num(inputs, "cos2", WHERE);
  const t = Math.sqrt(1 - c * c) / c;
  return inputs.hedefKarakter === "kapasitif" ? -t : t;
}

function requiredQ(inputs: ComputeInputs): number {
  return num(inputs, "P", WHERE) * (tanPhi1(inputs) - tanPhi2(inputs));
}

function crossChecks(inputs: ComputeInputs): Check[] {
  if (!(requiredQ(inputs) > 0)) return [{ level: "hata", message: MESSAGES.nothingToDo }];
  return [];
}

/**
 * Kalan gücü aşmayan en büyük değeri seçer; hiçbir değer kalanı aşmadan sığmıyorsa en küçük değeri ekler ve biter.
 * Kayan nokta payı: değerin kalanı en çok 10⁻⁹ oranında aşması "aşmıyor" sayılır.
 */
export function selectSteps(qc: number, catalog: number[]): number[] {
  const values = [...catalog].sort((a, b) => a - b);
  const eps = 1e-9 * qc;
  const picks: number[] = [];
  let remaining = qc;
  while (remaining > eps) {
    let chosen: number | undefined;
    for (const v of values) if (v <= remaining + eps) chosen = v;
    if (chosen === undefined) {
      picks.push(values[0]);
      break;
    }
    picks.push(chosen);
    remaining -= chosen;
  }
  return picks;
}

/** "3 × 50 kvar + 1 × 5 kvar" */
function describePicks(picks: number[]): string {
  const counts = new Map<number, number>();
  for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([v, n]) => `${n} × ${kvarText(v)}`)
    .join(" + ");
}

function limitsFor(sinif: KompSinif, limits: Limits) {
  const e = limits.tesisatGuc.epdkReaktif;
  return sinif === "kucuk" ? e.kucuk : e.buyuk;
}

const cosOf = (tan: number) => 1 / Math.sqrt(1 + tan * tan);

export const kompanzasyon: CalcDefinition = {
  id: "2.4",
  slug: "kompanzasyon",
  category: "tesisat",
  title: "Kompanzasyon (kVAr)",
  description:
    "Mevcut ve hedef güç faktöründen gerekli kondansatör gücünü hesaplayın, katalog değerlerinden standart kondansatör toplamı önerin ve EPDK reaktif enerji sınırlarını (endüktif/kapasitif oran) kontrol edin.",
  formulas: [
    { label: "Gerekli kondansatör gücü", latex: "Q_c = P \\cdot \\left(\\tan\\varphi_1 - \\tan\\varphi_2\\right)" },
    { label: "Reaktif oran (sabit yük)", latex: "\\frac{E_{\\text{reaktif}}}{E_{\\text{aktif}}} = \\left|\\tan\\varphi\\right| = \\frac{|Q|}{P}" },
    { label: "Kurulu güçle ulaşılan durum", latex: "\\tan\\varphi_k = \\tan\\varphi_1 - \\frac{Q_k}{P}, \\quad \\cos\\varphi_k = \\frac{1}{\\sqrt{1 + \\tan^2\\varphi_k}}" },
    { label: "Faz başına kapasite (üçgen)", latex: "C_{\\Delta} = \\frac{Q}{3 \\cdot 2\\pi f \\cdot U^2}" },
  ],
  references: [REF_EPDK, { standard: "IEC 60831-1", title: "Alternatif akım sistemleri için şönt güç kondansatörleri (kendi kendini onaran tip, ≤ 1000 V) — Bölüm 1" }],
  inputs: [
    {
      kind: "number",
      key: "P",
      label: "Aktif güç (ortalama yük)",
      symbol: "P",
      dimension: "guc",
      defaultUnit: "kW",
      default: 250,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "select",
      key: "mevcut",
      label: "Mevcut durum",
      options: [
        { value: "cos", label: "Güç faktörü (cos φ₁) biliniyor" },
        { value: "oran", label: "Endüktif reaktif oran (Q/P, faturadaki %) biliniyor" },
      ],
      default: "cos",
    },
    {
      kind: "number",
      key: "cos1",
      label: "Mevcut güç faktörü (endüktif)",
      symbol: "\\cos\\varphi_1",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 0.75,
      min: 0,
      minExclusive: true,
      max: 1,
      visibleWhen: { key: "mevcut", equals: "cos" },
    },
    {
      kind: "number",
      key: "oran1",
      label: "Mevcut endüktif reaktif oran",
      symbol: "\\tan\\varphi_1",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent", "fraction"],
      default: 60,
      min: 0,
      help: "Endüktif reaktif enerjinin aktif enerjiye oranı (kVArh/kWh), ör. faturada %60.",
      visibleWhen: { key: "mevcut", equals: "oran" },
    },
    {
      kind: "select",
      key: "hedefKarakter",
      label: "Hedef güç faktörünün karakteri",
      options: [
        { value: "enduktif", label: "Endüktif (geri)" },
        { value: "kapasitif", label: "Kapasitif (ileri)" },
      ],
      default: "enduktif",
    },
    {
      kind: "number",
      key: "cos2",
      label: "Hedef güç faktörü",
      symbol: "\\cos\\varphi_2",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 0.99,
      min: 0,
      minExclusive: true,
      max: 1,
    },
    {
      kind: "select",
      key: "sinif",
      label: "EPDK sınıfı (kurulu güç)",
      options: [
        { value: "buyuk", label: "Kurulu güç ≥ 50 kVA (endüktif %20, kapasitif %15)" },
        { value: "kucuk", label: "Kurulu güç < 50 kVA (endüktif %33, kapasitif %20)" },
        { value: "muaf", label: "Reaktif tarifeye tabi değil (mesken, aydınlatma, tek faz, ≤ 15 kW)" },
      ],
      default: "buyuk",
    },
    {
      kind: "numberList",
      key: "katalog",
      label: "Standart kondansatör güçleri (katalog)",
      symbol: "Q_n",
      dimension: "reaktif_guc",
      defaultUnit: "kvar",
      default: [5, 7.5, 10, 12.5, 15, 20, 25, 30, 50],
      min: 0,
      minExclusive: true,
      help: "Tedarikçinizin üç fazlı kondansatör güçleri (anma geriliminde). Varsayılan: ENTES 400 V katalog değerleri (CXD ve C100 serisi).",
    },
    {
      kind: "number",
      key: "U",
      label: "Kondansatör gerilimi (fazlar arası)",
      symbol: "U",
      dimension: "gerilim",
      defaultUnit: "V",
      default: 400,
      min: 0,
      minExclusive: true,
    },
    {
      kind: "number",
      key: "f",
      label: "Şebeke frekansı",
      symbol: "f",
      dimension: "frekans",
      defaultUnit: "Hz",
      units: ["Hz"],
      default: 50,
      min: 0,
      minExclusive: true,
    },
  ],
  outputs: OUTPUTS,

  validate: (inputs) => crossChecks(inputs),

  compute: (inputs, ctx) => {
    const blocking = crossChecks(inputs);
    if (blocking.length > 0) return { outputs: {}, steps: [], checks: blocking };

    const P = num(inputs, "P", WHERE);
    const U = num(inputs, "U", WHERE);
    const f = num(inputs, "f", WHERE);
    const catalog = numList(inputs, "katalog", WHERE);
    const sinif = inputs.sinif as KompSinif;
    const kapasitif = inputs.hedefKarakter === "kapasitif";

    const t1 = tanPhi1(inputs);
    const t2 = tanPhi2(inputs);
    const cos1 = cosOf(t1);
    const Qc = P * (t1 - t2);
    const Q1 = P * t1;
    const S1 = P * Math.sqrt(1 + t1 * t1);
    const S2 = P * Math.sqrt(1 + t2 * t2);
    const picks = selectSteps(Qc, catalog);
    const Qk = picks.reduce((a, b) => a + b, 0);
    const tk = n0(t1 - Qk / P);
    const cosK = cosOf(tk);
    const C = Qc / (3 * 2 * Math.PI * f * U * U);

    const outputs: Record<string, number> = {
      Qc,
      Qk,
      cos1,
      cosK,
      oran1: t1,
      oran2: Math.abs(t2),
      oranK: Math.abs(tk),
      Q1,
      S1,
      S2,
      C,
    };

    const steps: Step[] = [];
    if (inputs.mevcut === "oran") {
      steps.push({
        label: "Mevcut güç faktörü (orandan)",
        latex: `\\tan\\varphi_1 = \\frac{Q_1}{P} = ${qNum(t1)} \\quad\\Rightarrow\\quad \\cos\\varphi_1 = \\frac{1}{\\sqrt{1 + \\tan^2\\varphi_1}} = ${qNum(cos1)}`,
      });
    } else {
      steps.push({
        label: "Mevcut durum",
        latex: `\\tan\\varphi_1 = \\frac{\\sqrt{1 - \\cos^2\\varphi_1}}{\\cos\\varphi_1} = \\frac{\\sqrt{1 - ${qNum(cos1)}^2}}{${qNum(cos1)}} = ${qNum(t1)}`,
      });
    }
    const cos2 = num(inputs, "cos2", WHERE);
    steps.push(
      {
        label: kapasitif ? "Hedef (kapasitif: tan φ₂ < 0)" : "Hedef",
        latex: `\\tan\\varphi_2 = ${kapasitif ? "-" : ""}\\frac{\\sqrt{1 - ${qNum(cos2)}^2}}{${qNum(cos2)}} = ${qNum(n0(t2))}`,
      },
      {
        label: "Gerekli kondansatör gücü",
        latex: `Q_c = P \\cdot \\left(\\tan\\varphi_1 - \\tan\\varphi_2\\right) = ${qP(P)} \\cdot \\left(${qNum(t1)} - ${t2 < 0 ? `(${qNum(t2)})` : qNum(n0(t2))}\\right) = ${qQ(Qc)}`,
      },
      {
        label: "Önerilen standart kondansatörlerle ulaşılan durum",
        latex: `\\tan\\varphi_k = \\tan\\varphi_1 - \\frac{Q_k}{P} = ${qNum(t1)} - \\frac{${qQ(Qk)}}{${qP(P)}} = ${qNum(tk)} \\qquad \\cos\\varphi_k = ${qNum(cosK)}`,
      },
      {
        label: "Faz başına kapasite (üçgen bağlı)",
        latex: `C_{\\Delta} = \\frac{Q_c}{3 \\cdot 2\\pi f \\cdot U^2} = \\frac{${qQ(Qc)}}{3 \\cdot 2\\pi \\cdot ${qF(f)} \\cdot (${qU(U)})^2} = ${latexSpec(S("C"), C)}`,
      },
    );

    const checks: Check[] = [
      { level: "bilgi", message: MESSAGES.kurulu(describePicks(picks), qText(S("Qk"), Qk)) },
      { level: "bilgi", message: MESSAGES.assumption },
    ];

    if (sinif === "muaf") {
      checks.push({ level: "bilgi", message: MESSAGES.muaf, reference: REF_EPDK });
    } else {
      const lim = limitsFor(sinif, ctx.limits);
      // Hedef
      const limHedef = kapasitif ? lim.kapasitif : lim.enduktif;
      const karHedef = kapasitif ? "kapasitif" : "endüktif";
      if (Math.abs(t2) <= limHedef) {
        checks.push({ level: "ok", message: MESSAGES.hedefOk(karHedef, pct(Math.abs(t2)), pct(limHedef)), reference: REF_EPDK });
      } else {
        checks.push({
          level: "uyari",
          message: MESSAGES.hedefFail(karHedef, pct(Math.abs(t2)), pct(limHedef), formatNumber(cosOf(limHedef))),
          reference: REF_EPDK,
        });
      }
      // Önerilen kurulu güç
      const karK = tk < 0 ? "kapasitif" : "endüktif";
      const limK = tk < 0 ? lim.kapasitif : lim.enduktif;
      checks.push(
        Math.abs(tk) <= limK
          ? { level: "ok", message: MESSAGES.kuruluOk(karK, pct(Math.abs(tk)), pct(limK)), reference: REF_EPDK }
          : { level: "uyari", message: MESSAGES.kuruluFail(karK, pct(Math.abs(tk)), pct(limK)), reference: REF_EPDK },
      );
      // Mevcut durum (bilgi)
      checks.push({ level: "bilgi", message: MESSAGES.mevcut(pct(t1), pct(lim.enduktif), t1 > lim.enduktif), reference: REF_EPDK });
    }

    return { outputs, steps, checks };
  },
};
