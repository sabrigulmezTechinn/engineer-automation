/**
 * KAPSAM 2.3 — Sigorta / şalter seçimi.
 *
 * IEC 60364-4-43 aşırı yük koordinasyonu: I_b ≤ I_n ≤ I_z ve I₂ ≤ 1,45·I_z (kablo-ortak.ts).
 * I₂ koruma tipine göre (oranlar ve kaynakları src/config/sinir/tesisat-kablo.ts'te):
 * - Minyatür devre kesici (IEC 60898-1): I₂ = 1,45·I_n; anlık açma bölgesi eğriye göre (B, C, D).
 * - gG sigorta (IEC 60269): I_n ≥ 16 A için I₂ = 1,6·I_n; I_n < 16 A için oran kullanıcı girdisi (kaynak açılamadı).
 * - Kompakt şalter (IEC 60947-2): I₂ = 1,3·I_r; uygun ayar aralığı I_b ≤ I_r ≤ min(I_z, 1,45·I_z/1,3).
 * MCB ve gG'de anma akımları serisinden koşulların hepsini birlikte sağlayan en küçük değer önerilir; kullanıcı kendi
 * seçtiği I_n'i de denetletebilir.
 */
import { latexNum } from "@/lib/calc/latex";
import type { CalcContext, CalcDefinition, Check, ComputeInputs, OutputSpec, Step } from "@/lib/calc/types";
import {
  K2_YARDIM,
  REF_IEC_60269,
  REF_IEC_60364_4_43,
  REF_IEC_60898_1,
  REF_IEC_60947_2,
  akimMetni,
  i2Katsayisi,
  koordinasyonAdimlari,
  koordinasyonKontrolleri,
  koordinasyonSaglaniyor,
  lte,
  num,
  optNum,
  qI,
  type KorumaTipi,
} from "./kablo-ortak";

export type Egri = "B" | "C" | "D";

const WHERE = "sigorta-salter-secimi";

const MESSAGES = {
  noRating: (seri: string, ib: string, iz: string) =>
    `${seri} içinde I_b ≤ I_n ≤ I_z ve I₂ ≤ 1,45·I_z koşullarını birlikte sağlayan anma akımı yok (I_b = ${ib}, I_z = ${iz}): kablo kesitini büyütün veya I₂'si daha küçük bir koruma seçin.`,
  seriesTooSmall: (seri: string, max: string, ib: string) =>
    `${seri} en büyük değeri (${max}) tasarım akımından (${ib}) küçük.`,
  nhOnly:
    "Önerilen gG serisi yalnızca NH bıçaklı sigortalarındır; başka gövdelerin (ör. D tipi) anma akımları için 'Denetlenecek anma akımı' alanını kullanın.",
  instantaneous: (egri: string, lo: string, hi: string) =>
    `${egri} eğrisi anlık açma bölgesi ${lo} – ${hi}: yol alma ve ani akımlar alt sınırın altında kalmalı; devre sonundaki en küçük kısa devre akımı üst sınırı aşmalıdır (anlık açmanın kesinleşmesi için).`,
  noIrRange: (ib: string, iz: string) =>
    `Uygun ayar aralığı yok: I_b = ${ib}, I_z = ${iz} için I_b ≤ I_r ≤ I_z sağlanamıyor. Kablo kesitini büyütün.`,
  irRange: (lo: string, hi: string) => `Ayar akımı ${lo} ile ${hi} arasında seçilmelidir.`,
} as const;

const TIP_ADI: Record<KorumaTipi, string> = {
  mcb: "Minyatür devre kesici",
  gG: "gG sigorta",
  kompakt: "Kompakt şalter",
};

/** Önerinin yapıldığı anma akımı serisinin adı (config'teki kaynaklar) */
const SERI_ADI: Record<"mcb" | "gG", string> = {
  mcb: "MCB serisi (Lovato P1MB…P)",
  gG: "NH gG sigorta serisi (Legrand F00189EN)",
};

const OUT = {
  In: { key: "In", label: "Anma akımı", symbol: "I_n", dimension: "akim", defaultUnit: "A" },
  I2: { key: "I2", label: "Geleneksel açma (erime) akımı", symbol: "I_2", dimension: "akim", defaultUnit: "A" },
  I2sinir: { key: "I2sinir", label: "İzin verilen en büyük I₂ (1,45·I_z)", symbol: "1{,}45 \\cdot I_z", dimension: "akim", defaultUnit: "A" },
  ImMin: { key: "ImMin", label: "Anlık açma bölgesi alt sınırı", symbol: "I_{m,\\text{min}}", dimension: "akim", defaultUnit: "A" },
  ImMax: { key: "ImMax", label: "Anlık açma bölgesi üst sınırı", symbol: "I_{m,\\text{maks}}", dimension: "akim", defaultUnit: "A" },
  IrMin: { key: "IrMin", label: "Ayar akımı alt sınırı", symbol: "I_{r,\\text{min}}", dimension: "akim", defaultUnit: "A" },
  IrMax: { key: "IrMax", label: "Ayar akımı üst sınırı", symbol: "I_{r,\\text{maks}}", dimension: "akim", defaultUnit: "A" },
} satisfies Record<string, OutputSpec>;

function seriesText(series: readonly number[]): string {
  return series.map((x) => String(x).replace(".", ",")).join("; ");
}

function computeBreaker(inputs: ComputeInputs, ctx: CalcContext, Ib: number, Iz: number) {
  const lim = ctx.limits.tesisatKablo.koruma;
  const k145 = lim.asiriYukKatsayisi;
  const Ir = num(inputs, "Ir", WHERE);
  const k2 = lim.kompaktI2Katsayisi;
  const I2 = k2 * Ir;
  const IrMax = Math.min(Iz, (k145 * Iz) / k2);
  const outputs: Record<string, number> = { I2, I2sinir: k145 * Iz };
  const steps: Step[] = [];
  const checks: Check[] = [];

  if (lte(Ib, IrMax)) {
    Object.assign(outputs, { IrMin: Ib, IrMax });
    steps.push({
      label: "Uygun ayar akımı aralığı",
      latex: `I_b \\leq I_r \\leq \\min\\left(I_z,\\ \\frac{1{,}45 \\cdot I_z}{k_2}\\right): \\quad ${qI(Ib)} \\leq I_r \\leq \\min\\left(${qI(Iz)},\\ \\frac{${latexNum(k145)} \\cdot ${qI(Iz)}}{${latexNum(k2)}}\\right) = ${qI(IrMax)}`,
    });
    checks.push({ level: "bilgi", message: MESSAGES.irRange(akimMetni(Ib), akimMetni(IrMax)), reference: REF_IEC_60947_2 });
  } else {
    checks.push({ level: "uyari", message: MESSAGES.noIrRange(akimMetni(Ib), akimMetni(Iz)), reference: REF_IEC_60364_4_43 });
  }
  steps.push(...koordinasyonAdimlari({ Ib, Iz, In: Ir, k2, k145, sembol: "I_r" }));
  checks.push(...koordinasyonKontrolleri({ Ib, Iz, In: Ir, I2, k145, sembol: "I_r" }));
  return { outputs, steps, checks };
}

function computeSeries(inputs: ComputeInputs, ctx: CalcContext, tip: "mcb" | "gG", Ib: number, Iz: number) {
  const lim = ctx.limits.tesisatKablo.koruma;
  const k145 = lim.asiriYukKatsayisi;
  const k2User = tip === "gG" ? optNum(inputs, "k2") : undefined;
  const k2Of = (In: number) => i2Katsayisi(tip, In, lim, k2User);
  const I2Of = (In: number) => {
    const k = k2Of(In);
    return k === undefined ? undefined : k * In;
  };
  const series = tip === "mcb" ? lim.mcbAnmaAkimlari : lim.gGAnmaAkimlari;
  const outputs: Record<string, number> = { I2sinir: k145 * Iz };
  const steps: Step[] = [];
  const checks: Check[] = [];

  let In = optNum(inputs, "InSecim");
  if (In === undefined) {
    In = series.find((x) => koordinasyonSaglaniyor(Ib, x, Iz, I2Of(x), k145));
    if (In === undefined) {
      const max = series[series.length - 1];
      const message = lte(Ib, max)
        ? MESSAGES.noRating(SERI_ADI[tip], akimMetni(Ib), akimMetni(Iz))
        : MESSAGES.seriesTooSmall(SERI_ADI[tip], akimMetni(max), akimMetni(Ib));
      checks.push({ level: "uyari", message: tip === "gG" ? `${message} ${MESSAGES.nhOnly}` : message, reference: REF_IEC_60364_4_43 });
      steps.push({
        label: "İzin verilen en büyük I₂",
        latex: `I_{2,\\text{maks}} = ${latexNum(k145)} \\cdot I_z = ${latexNum(k145)} \\cdot ${qI(Iz)} = ${qI(k145 * Iz)}`,
      });
      return { outputs, steps, checks };
    }
    steps.push({
      label: `Seriden seçim — ${SERI_ADI[tip]}: ${seriesText(series)} A`,
      latex: `I_n = \\min\\left\\{ I_n \\in \\text{seri} \\mid I_b \\leq I_n \\leq I_z,\\ I_2 \\leq 1{,}45 \\cdot I_z \\right\\} = ${qI(In)}`,
    });
  }

  const k2 = k2Of(In);
  const I2 = k2 === undefined ? undefined : k2 * In;
  outputs.In = In;
  if (I2 !== undefined) outputs.I2 = I2;
  steps.push(...koordinasyonAdimlari({ Ib, Iz, In, k2, k145 }));
  checks.push(...koordinasyonKontrolleri({ Ib, Iz, In, I2, I2Bilinmiyor: I2 === undefined, k145 }));

  if (tip === "mcb") {
    const egri = inputs.egri as Egri;
    const band = lim.mcbAnlikAcma[egri];
    if (!band) throw new Error(`${WHERE}: bilinmeyen eğri "${String(egri)}"`);
    const ImMin = band.min * In;
    const ImMax = band.max * In;
    Object.assign(outputs, { ImMin, ImMax });
    steps.push({
      label: `Anlık açma bölgesi (${egri} eğrisi)`,
      latex: `I_m = ${latexNum(band.min)} \\cdot I_n \\ldots ${latexNum(band.max)} \\cdot I_n = ${qI(ImMin)} \\ldots ${qI(ImMax)}`,
    });
    checks.push({
      level: "bilgi",
      message: MESSAGES.instantaneous(egri, akimMetni(ImMin), akimMetni(ImMax)),
      reference: REF_IEC_60898_1,
    });
  }
  return { outputs, steps, checks };
}

function compute(inputs: ComputeInputs, ctx: CalcContext) {
  const Ib = num(inputs, "Ib", WHERE);
  const Iz = num(inputs, "Iz", WHERE);
  const tip = inputs.koruma as KorumaTipi;
  if (tip === "kompakt") return computeBreaker(inputs, ctx, Ib, Iz);
  if (tip === "mcb" || tip === "gG") return computeSeries(inputs, ctx, tip, Ib, Iz);
  throw new Error(`${WHERE}: bilinmeyen koruma "${String(tip)}"`);
}

export const sigortaSalterSecimi: CalcDefinition = {
  id: "2.3",
  slug: "sigorta-salter-secimi",
  category: "tesisat",
  title: "Sigorta / şalter seçimi",
  description:
    "Tasarım akımı ve kablonun akım taşıma kapasitesine göre minyatür devre kesici veya gG sigorta için standart seriden uygun en küçük anma akımını önerin (I_b ≤ I_n ≤ I_z, I₂ ≤ 1,45·I_z); kompakt şalterde uygun ayar akımı aralığını bulun. MCB'de eğriye göre anlık açma bölgesi verilir.",
  formulas: [
    { label: "Aşırı yük koordinasyonu", latex: "I_b \\leq I_n \\leq I_z, \\qquad I_2 \\leq 1{,}45 \\cdot I_z" },
    { label: "Geleneksel açma akımı", latex: "I_2 = k_2 \\cdot I_n" },
    { label: "Kompakt şalter ayar aralığı", latex: "I_b \\leq I_r \\leq \\min\\left(I_z,\\ \\frac{1{,}45 \\cdot I_z}{k_2}\\right)" },
  ],
  references: [REF_IEC_60364_4_43, REF_IEC_60898_1, REF_IEC_60269, REF_IEC_60947_2],
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
      kind: "number",
      key: "Iz",
      label: "Kablonun düzeltilmiş akım taşıma kapasitesi",
      symbol: "I_z",
      dimension: "akim",
      defaultUnit: "A",
      default: 51,
      min: 0,
      minExclusive: true,
      help: "Düzeltme katsayılarıyla hesaplanmış değer (2.1 Kablo kesiti seçimi).",
    },
    {
      kind: "select",
      key: "koruma",
      label: "Koruma cihazı",
      options: [
        { value: "mcb", label: TIP_ADI.mcb + " (IEC 60898-1)" },
        { value: "gG", label: TIP_ADI.gG + " (IEC 60269)" },
        { value: "kompakt", label: TIP_ADI.kompakt + " (IEC 60947-2)" },
      ],
      default: "mcb",
    },
    {
      kind: "select",
      key: "egri",
      label: "Açma eğrisi",
      options: [
        { value: "B", label: "B" },
        { value: "C", label: "C" },
        { value: "D", label: "D" },
      ],
      default: "C",
      help: "Lovato kataloğuna göre: B düşük endüktif yükler (ısıtıcılar, jeneratörler, çok uzun hatlar); C endüktif yükler (düşük ani akımlı); D yüksek ani akımlı yükler (ör. motorlar).",
      visibleWhen: { key: "koruma", equals: "mcb" },
    },
    {
      kind: "number",
      key: "InSecim",
      label: "Denetlenecek anma akımı",
      symbol: "I_n",
      dimension: "akim",
      defaultUnit: "A",
      min: 0,
      minExclusive: true,
      optional: true,
      help: "Boş bırakılırsa seriden (MCB: Lovato P1MB…P; gG: NH bıçaklı sigorta, Legrand) koşulları sağlayan en küçük anma akımı önerilir. Seride olmayan bir değer (ör. D tipi 20 A gG) girilirse o denetlenir.",
      visibleWhen: { key: "koruma", equals: ["mcb", "gG"] },
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
    {
      kind: "number",
      key: "Ir",
      label: "Aşırı yük ayar akımı",
      symbol: "I_r",
      dimension: "akim",
      defaultUnit: "A",
      default: 48,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "koruma", equals: "kompakt" },
    },
  ],
  outputs: [OUT.In, OUT.I2, OUT.I2sinir, OUT.ImMin, OUT.ImMax, OUT.IrMin, OUT.IrMax],
  compute,
};
