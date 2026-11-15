/**
 * KAPSAM 1.6 — Enerji tüketimi ve maliyet.
 *
 * Hesap SI'da yapılır: E[J] = P[W] · k · t_gün[s] · n, maliyet[TL] = c[TL/J] · E[J].
 * Enerji fiyatının kanonik birimi TL/J'dir (arayüzde TL/kWh); böylece maliyet düz bir SI çarpımıdır.
 */
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexAuto, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, ComputeInputs, OutputSpec, Step } from "@/lib/calc/types";

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`enerji-maliyeti: "${key}" sayı değil`);
  return v;
}

const OUTPUTS: OutputSpec[] = [
  { key: "E", label: "Toplam enerji tüketimi", symbol: "E", dimension: "enerji", defaultUnit: "kWh" },
  { key: "M", label: "Toplam maliyet", symbol: "M", dimension: "para", defaultUnit: "TL" },
  { key: "Egun", label: "Günlük enerji tüketimi", symbol: "E_{\\text{gün}}", dimension: "enerji", defaultUnit: "kWh" },
  { key: "Mgun", label: "Günlük maliyet", symbol: "M_{\\text{gün}}", dimension: "para", defaultUnit: "TL" },
];

/** Enerjiyi çıktı kartıyla aynı birimde (kWh ailesinden otomatik) yazar. */
const qE = (valueSI: number) => latexQty(valueSI, autoOutputUnit(OUTPUTS[0], valueSI));
const qM = (valueSI: number) => latexQty(valueSI, "TL");

export const enerjiMaliyeti: CalcDefinition = {
  id: "1.6",
  slug: "enerji-tuketimi-maliyet",
  category: "temel-elektrik",
  title: "Enerji tüketimi ve maliyet",
  description:
    "Bir yükün belirli bir süredeki enerji tüketimini ve elektrik maliyetini hesaplayın. Güç, günlük çalışma süresi ve gün sayısı sabit kabul edilir; isteğe bağlı yük oranı, yükün ortalamada anma gücünün ne kadarını çektiğini belirtir.",
  formulas: [
    { label: "Günlük enerji", latex: "E_{\\text{gün}} = P \\cdot k \\cdot t_{\\text{gün}}" },
    { label: "Toplam enerji", latex: "E = E_{\\text{gün}} \\cdot n" },
    { label: "Maliyet", latex: "M = c \\cdot E" },
  ],
  references: [
    {
      standard: "IEC 80000-6",
      title: "Büyüklükler ve birimler — Bölüm 6: Elektromanyetizma",
      note: "Aktif enerji, aktif gücün zamana göre integralidir; sabit güçte E = P·t.",
    },
  ],
  inputs: [
    {
      kind: "number",
      key: "P",
      label: "Güç",
      symbol: "P",
      dimension: "guc",
      defaultUnit: "kW",
      default: 2,
      min: 0,
      help: "Yükün çektiği aktif güç (etiket değeri veya ölçülen ortalama).",
    },
    {
      kind: "number",
      key: "tGun",
      label: "Günlük çalışma süresi",
      symbol: "t_{\\text{gün}}",
      dimension: "zaman",
      defaultUnit: "h",
      units: ["min", "h"],
      default: 8,
      min: 0,
      max: 24 * 3600,
    },
    {
      kind: "number",
      key: "n",
      label: "Gün sayısı",
      symbol: "n",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      units: ["unitless"],
      default: 30,
      min: 1,
      integer: true,
    },
    {
      kind: "number",
      key: "c",
      label: "Birim enerji fiyatı",
      symbol: "c",
      dimension: "enerji_fiyati",
      defaultUnit: "TL_kWh",
      units: ["TL_kWh", "krs_kWh", "TL_MWh"],
      default: 4,
      min: 0,
      help: "Varsayılan değer yalnızca örnektir, güncel bir tarife değildir. Faturanızdaki vergiler ve bedeller dahil birim fiyatı girin.",
    },
    {
      kind: "number",
      key: "k",
      label: "Yük / kullanım oranı",
      symbol: "k",
      dimension: "oran",
      defaultUnit: "percent",
      units: ["percent"],
      min: 0,
      max: 1,
      optional: true,
      help: "Çalışma süresince ortalama güç / anma gücü. Boş bırakılırsa %100 kabul edilir.",
    },
  ],
  outputs: OUTPUTS,

  compute: (inputs) => {
    const P = num(inputs, "P");
    const tGun = num(inputs, "tGun");
    const n = num(inputs, "n");
    const c = num(inputs, "c");
    const hasK = typeof inputs.k === "number";
    const k = hasK ? num(inputs, "k") : 1;

    const Egun = P * k * tGun;
    const E = Egun * n;
    const M = c * E;
    const Mgun = c * Egun;

    const kTerm = hasK ? ` \\cdot ${latexQty(k, "percent")}` : "";
    const steps: Step[] = [
      {
        label: "Günlük enerji",
        latex: `E_{\\text{gün}} = P${hasK ? " \\cdot k" : ""} \\cdot t_{\\text{gün}} = ${latexAuto(P, "guc")}${kTerm} \\cdot ${latexQty(tGun, "h")} = ${qE(Egun)}`,
      },
      { label: "Toplam enerji", latex: `E = E_{\\text{gün}} \\cdot n = ${qE(Egun)} \\cdot ${latexQty(n, "unitless")} = ${qE(E)}` },
      { label: "Toplam maliyet", latex: `M = c \\cdot E = ${latexQty(c, "TL_kWh")} \\cdot ${qE(E)} = ${qM(M)}` },
      { label: "Günlük maliyet", latex: `M_{\\text{gün}} = c \\cdot E_{\\text{gün}} = ${latexQty(c, "TL_kWh")} \\cdot ${qE(Egun)} = ${qM(Mgun)}` },
    ];

    return {
      outputs: { E, M, Egun, Mgun },
      steps,
      checks: [
        {
          level: "ok",
          message:
            "Güç ve birim fiyat sabit kabul edildi. Kademeli tarife, zaman dilimli fiyat, reaktif enerji ve sabit bedeller hesaba katılmadı.",
        },
      ],
    };
  },
};
