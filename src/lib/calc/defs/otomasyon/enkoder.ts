/**
 * KAPSAM 5.2 — Artımsal enkoder hesapları.
 *
 * SI'da hesaplanır (ω: rad/s):
 *   f = PPR · ω / (2π)                 (kW/rpm formu: f = PPR · n / 60, n: dev/dk)
 *   N = PPR · k                        (devir başına sayım, k: kuadratür çarpanı 1/2/4)
 *   Δθ = 2π / (PPR · k)                (açısal çözünürlük; derece cinsinden 360°/(PPR·k))
 *   ω_maks = 2π · f_maks / PPR         (sayıcı giriş frekansı sınırına göre en yüksek devir)
 *   Δs = p / (PPR · k), v = p · ω/(2π) (p: vidalı mil hatvesi veya kasnak çevresi)
 *
 * Sayıcı sınırı kanal (A/B) frekansına uygulanır: girişin gördüğü darbe frekansı budur. Kuadratür
 * sayımda kenar hızı k·f'dir; veri sayfası sınırı "sayım/s" olarak veriyorsa kullanıcı onu k'ya bölerek
 * girer (girdi açıklamasında yazılı).
 */
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexAuto, latexNum, latexQty } from "@/lib/calc/latex";
import { formatQuantity, fromSI } from "@/lib/units";
import type { CalcDefinition, Check, ComputeInputs, OutputSpec, Step } from "@/lib/calc/types";

export type KuadraturCarpani = "1" | "2" | "4";
export type DogrusalMod = "yok" | "vida" | "kasnak";

const K_OPTIONS: { value: KuadraturCarpani; label: string }[] = [
  { value: "1", label: "x1 (A kanalının yükselen kenarı)" },
  { value: "2", label: "x2 (A kanalının iki kenarı)" },
  { value: "4", label: "x4 (A ve B kanallarının tüm kenarları)" },
];

const DOGRUSAL_OPTIONS: { value: DogrusalMod; label: string }[] = [
  { value: "yok", label: "Yok (yalnızca dönme)" },
  { value: "vida", label: "Vidalı mil" },
  { value: "kasnak", label: "Kasnak / tekerlek" },
];

const MESSAGES = {
  sinirAsildi: (f: string, fMax: string) =>
    `Enkoder çıkış frekansı (${f}) sayıcı giriş sınırını (${fMax}) aşıyor: darbeler kaçırılır, konum ve hız ölçümü bozulur. Devri düşürün, daha düşük PPR'li enkoder veya daha hızlı sayıcı girişi seçin.`,
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`enkoder: "${key}" sayı değil`);
  return v;
}

const OUTPUTS: OutputSpec[] = [
  { key: "f", label: "Enkoder çıkış frekansı (A/B kanalı)", symbol: "f", dimension: "frekans", defaultUnit: "Hz" },
  { key: "fSayim", label: "Sayım hızı (kenar frekansı, k·f)", symbol: "f_k", dimension: "frekans", defaultUnit: "Hz" },
  { key: "N", label: "Devir başına sayım", symbol: "N", dimension: "boyutsuz", defaultUnit: "unitless", integer: true },
  {
    key: "cozunurlukAci",
    label: "Açısal çözünürlük",
    symbol: "\\Delta\\theta",
    dimension: "aci",
    defaultUnit: "deg",
    units: ["deg", "arcmin", "rad"],
  },
  {
    key: "nMaks",
    label: "Sayıcı sınırına göre en yüksek devir",
    symbol: "n_{maks}",
    dimension: "acisal_hiz",
    defaultUnit: "rpm",
    units: ["rpm", "rps", "rad_s"],
  },
  {
    key: "cozunurlukDogrusal",
    label: "Doğrusal çözünürlük",
    symbol: "\\Delta s",
    dimension: "uzunluk",
    defaultUnit: "mm",
    units: ["um", "mm"],
    autoUnit: true,
  },
  {
    key: "v",
    label: "Doğrusal hız",
    symbol: "v",
    dimension: "hiz",
    defaultUnit: "mm_s",
    units: ["mm_s", "m_s", "m_min"],
  },
];

const spec = (key: string) => {
  const s = OUTPUTS.find((o) => o.key === key);
  if (!s) throw new Error(`enkoder: çıktı "${key}" yok`);
  return s;
};

// Adım yardımcıları: kartlarla aynı birim
const SIG = { significant: 6 } as const;
const qF = (v: number) => latexAuto(v, "frekans", SIG);
const qRpm = (omega: number) => latexQty(omega, "rpm", SIG);
const qDeg = (rad: number) => latexQty(rad, "deg", SIG);
const qLen = (m: number, key: string) => latexQty(m, autoOutputUnit(spec(key), m), SIG);
const qMm = (m: number) => latexQty(m, "mm", SIG);

export const enkoder: CalcDefinition = {
  id: "5.2",
  slug: "enkoder",
  category: "otomasyon",
  title: "Enkoder hesapları",
  description:
    "Artımsal enkoderin çıkış frekansını, kuadratür (x1/x2/x4) sayımla devir başına sayımı ve açısal çözünürlüğü, sayıcı girişinin frekans sınırına göre en yüksek devri ve vidalı mil ya da kasnakla doğrusal çözünürlüğü hesaplayın.",
  formulas: [
    { label: "Çıkış frekansı (n: dev/dk)", latex: "f = \\frac{\\text{PPR} \\cdot n}{60}" },
    { label: "Çıkış frekansı (SI)", latex: "f = \\frac{\\text{PPR} \\cdot \\omega}{2\\pi}" },
    { label: "Açısal çözünürlük", latex: "\\Delta\\theta = \\frac{360^\\circ}{\\text{PPR} \\cdot k}" },
    { label: "En yüksek devir (n: dev/dk)", latex: "n_{maks} = \\frac{60 \\cdot f_{maks}}{\\text{PPR}}" },
    { label: "Doğrusal çözünürlük", latex: "\\Delta s = \\frac{p}{\\text{PPR} \\cdot k}" },
  ],
  references: [
    {
      standard: "ISO 80000-3",
      title: "Nicelikler ve birimler — Bölüm 3: Uzay ve zaman",
      note: "Dönme frekansı ve açısal hız tanımları (ω = 2π·n)",
    },
  ],
  inputs: [
    {
      kind: "number",
      key: "ppr",
      label: "Enkoder çözünürlüğü (PPR, devir başına darbe)",
      symbol: "\\text{PPR}",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 1024,
      min: 1,
      integer: true,
      help: "Bir kanalın (A) bir turdaki darbe sayısı; veri sayfasında PPR, P/R veya ppr olarak verilir.",
    },
    {
      kind: "number",
      key: "n",
      label: "Devir",
      symbol: "n",
      dimension: "acisal_hiz",
      defaultUnit: "rpm",
      units: ["rpm", "rps", "rad_s"],
      default: 3000,
      min: 0,
    },
    { kind: "select", key: "k", label: "Kuadratür çarpanı", options: K_OPTIONS, default: "4" },
    {
      kind: "number",
      key: "fMaks",
      label: "Sayıcı giriş frekansı sınırı",
      symbol: "f_{maks}",
      dimension: "frekans",
      defaultUnit: "kHz",
      units: ["Hz", "kHz", "MHz"],
      default: 100,
      min: 0,
      minExclusive: true,
      optional: true,
      help: "Hızlı sayıcı (HSC) girişinin kabul ettiği en yüksek kanal (A/B) frekansı. Veri sayfası sınırı sayım hızı (kenar/s) olarak veriyorsa kuadratür çarpanına bölerek girin.",
    },
    {
      kind: "select",
      key: "dogrusal",
      label: "Doğrusal hareket",
      options: DOGRUSAL_OPTIONS,
      default: "vida",
    },
    {
      kind: "number",
      key: "hatve",
      label: "Vidalı mil hatvesi (devir başına ilerleme)",
      symbol: "p",
      dimension: "uzunluk",
      defaultUnit: "mm",
      units: ["mm", "um", "cm", "m", "in"],
      default: 5,
      min: 0,
      minExclusive: true,
      help: "Çok ağızlı vidada hatve = adım × ağız sayısı. Enkoder doğrudan vidalı mile bağlı kabul edilir.",
      visibleWhen: { key: "dogrusal", equals: "vida" },
    },
    {
      kind: "number",
      key: "cevre",
      label: "Kasnak / tekerlek çevresi (π·D)",
      symbol: "p",
      dimension: "uzunluk",
      defaultUnit: "mm",
      units: ["mm", "cm", "m", "in"],
      default: 200,
      min: 0,
      minExclusive: true,
      help: "Enkoderin bağlı olduğu kasnağın veya ölçüm tekerleğinin bir turda aldığı yol (çap × π).",
      visibleWhen: { key: "dogrusal", equals: "kasnak" },
    },
  ],
  outputs: OUTPUTS,

  compute: (inputs) => {
    const ppr = num(inputs, "ppr");
    const omega = num(inputs, "n");
    const k = Number(inputs.k as KuadraturCarpani);
    const steps: Step[] = [];
    const checks: Check[] = [];

    const f = (ppr * omega) / (2 * Math.PI);
    const fSayim = k * f;
    const N = ppr * k;
    const cozunurlukAci = (2 * Math.PI) / N;
    const outputs: Record<string, number> = { f, fSayim, N, cozunurlukAci };

    const pprL = latexNum(ppr, SIG);
    steps.push({
      label: "Çıkış frekansı",
      latex: `f = \\frac{\\text{PPR} \\cdot n}{60} = \\frac{${pprL} \\cdot ${qRpm(omega)}}{60} = ${qF(f)}`,
    });
    steps.push({ label: "Sayım hızı", latex: `f_k = k \\cdot f = ${k} \\cdot ${qF(f)} = ${qF(fSayim)}` });
    steps.push({ label: "Devir başına sayım", latex: `N = \\text{PPR} \\cdot k = ${pprL} \\cdot ${k} = ${latexNum(N, SIG)}` });
    steps.push({
      label: "Açısal çözünürlük",
      latex: `\\Delta\\theta = \\frac{360^\\circ}{\\text{PPR} \\cdot k} = \\frac{360^\\circ}{${latexNum(N, SIG)}} = ${qDeg(cozunurlukAci)}`,
    });

    if (inputs.fMaks !== undefined) {
      const fMaks = num(inputs, "fMaks");
      const nMaks = (2 * Math.PI * fMaks) / ppr;
      outputs.nMaks = nMaks;
      steps.push({
        label: "En yüksek devir",
        latex: `n_{maks} = \\frac{60 \\cdot f_{maks}}{\\text{PPR}} = \\frac{60 \\cdot ${qF(fMaks)}}{${pprL}} = ${qRpm(nMaks)}`,
      });
      if (f > fMaks * (1 + 1e-12)) {
        checks.push({ level: "uyari", message: MESSAGES.sinirAsildi(fmtF(f), fmtF(fMaks)) });
      }
    }

    const mod = inputs.dogrusal as DogrusalMod;
    if (mod !== "yok") {
      const p = num(inputs, mod === "vida" ? "hatve" : "cevre");
      const ds = p / N;
      const v = (p * omega) / (2 * Math.PI);
      outputs.cozunurlukDogrusal = ds;
      outputs.v = v;
      steps.push({
        label: "Doğrusal çözünürlük",
        latex: `\\Delta s = \\frac{p}{\\text{PPR} \\cdot k} = \\frac{${qMm(p)}}{${latexNum(N, SIG)}} = ${qLen(ds, "cozunurlukDogrusal")}`,
      });
      steps.push({
        label: "Doğrusal hız",
        latex: `v = p \\cdot n = ${qMm(p)} \\cdot ${latexQty(omega, "rps", SIG)} = ${latexQty(v, "mm_s", SIG)}`,
      });
    }

    return { outputs, steps, checks };
  },
};

/** Mesaj metni için frekans gösterimi, kartlarla aynı birim ve biçimde (ör. "120 kHz"). */
function fmtF(hz: number): string {
  const unit = autoOutputUnit(spec("f"), hz);
  return formatQuantity(fromSI(hz, unit), unit);
}
