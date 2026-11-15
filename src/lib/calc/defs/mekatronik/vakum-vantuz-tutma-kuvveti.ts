/**
 * KAPSAM 6.8 — Vakum vantuz tutma kuvveti.
 *
 * Schmalz "Theoretical Holding Force of a Suction Cup" yük durumları (F_TH: emniyet katsayısı dahil gerekli teorik
 * tutma kuvveti; g: standart yerçekimi ivmesi; a: sistem ivmesi, acil duruş dahil; μ: sürtünme katsayısı):
 *   I   vantuz yatay, kuvvet dikey:  F_TH = m·(g + a)·S
 *   II  vantuz yatay, kuvvet yatay:  F_TH = m·(g + a/μ)·S
 *   III vantuz dikey, kuvvet dikey:  F_TH = (m/μ)·(g + a)·S
 *   https://www.schmalz.com/en/support/know-how/vacuum-knowledge/the-vacuum-system-and-its-components/system-design-calculation-example/theoretical-holding-force-of-a-suction-cup
 * Bir vantuzun teorik tutma kuvveti F = Δp·A (Schmalz "Design of the Suction Cup"); n vantuz için tutma koşulu
 * n·Δp·π·d²/4 ≥ F_TH, buradan gerekli efektif çap d = √(4·F_TH/(π·n·Δp)). Schmalz'ın d = 1,12·√(m·S/(P_U·n))
 * [cm, kg, bar] formu bunun a = 0 (ve dikeyde μ ile) halidir; yalnızca karşılaştırma için.
 *   https://www.schmalz.com/en/support/know-how/vacuum-knowledge/the-vacuum-system-and-its-components/vacuum-suction-cups/design-of-the-suction-cup
 * Emniyet katsayısı sınırları config'te: ctx.limits.mekatronikAkiskan.vakumEmniyet.
 */
import { latexNum, latexQty, latexSpec } from "@/lib/calc/latex";
import type { CalcDefinition, CalcResult, Check, NumberInputSpec, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { formatNumber, formatQuantity } from "@/lib/units";
import { G_N, daireAlani, num, optNum } from "./akiskan-ortak";

const WHERE = "vakum-vantuz-tutma-kuvveti";

export type VakumYukDurumu = "I" | "II" | "III";

const REF_YUK: Reference = {
  standard: "Schmalz Vacuum Knowledge",
  title: "Theoretical Holding Force of a Suction Cup",
  clause: "Yük durumları I–III; emniyet katsayısı S; sürtünme katsayısı μ",
  note: "https://www.schmalz.com/en/support/know-how/vacuum-knowledge/the-vacuum-system-and-its-components/system-design-calculation-example/theoretical-holding-force-of-a-suction-cup",
};
const REF_CAP: Reference = {
  standard: "Schmalz Vacuum Knowledge",
  title: "Design of the Suction Cup",
  clause: "Tutma kuvveti F = Δp·A; vantuz çapı; dönmede S ≥ 2,5",
  note: "https://www.schmalz.com/en/support/know-how/vacuum-knowledge/the-vacuum-system-and-its-components/vacuum-suction-cups/design-of-the-suction-cup",
};

const IN_M: NumberInputSpec = {
  kind: "number",
  key: "m",
  label: "İş parçası kütlesi",
  symbol: "m",
  dimension: "kutle",
  defaultUnit: "kg",
  units: ["g", "kg", "t"],
  default: 20,
  min: 0,
  minExclusive: true,
};
const IN_A: NumberInputSpec = {
  kind: "number",
  key: "a",
  label: "Sistem ivmesi",
  symbol: "a",
  dimension: "ivme",
  defaultUnit: "m_s2",
  units: ["mm_s2", "m_s2", "gn"],
  default: 5,
  min: 0,
  help: "Hareketteki en büyük ivme; acil duruştaki yavaşlamayı da göz önüne alın.",
};
const IN_MU: NumberInputSpec = {
  kind: "number",
  key: "mu",
  label: "Sürtünme katsayısı (vantuz–iş parçası)",
  symbol: "\\mu",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
  default: 0.5,
  min: 0,
  minExclusive: true,
  help: "Deneyle belirlenmelidir. Schmalz referans değerleri: ıslak yüzey 0,2–0,3; ahşap, metal, cam, taş 0,5; pürüzlü yüzey 0,6; yağlı yüzey 0,1–0,3.",
  visibleWhen: { key: "yuk", equals: ["II", "III"] },
};
const IN_S: NumberInputSpec = {
  kind: "number",
  key: "S",
  label: "Emniyet katsayısı",
  symbol: "S",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
  default: 2,
  min: 1,
  help: "Schmalz: pürüzsüz ve sızdırmaz parçada en az 1,5; kritik, gözenekli, pürüzlü veya yağlı yüzeyde 2,0 ve üstü; parça döndürülürken 2,5 ve üstü.",
};
const IN_DP: NumberInputSpec = {
  kind: "number",
  key: "dp",
  label: "Vakum seviyesi (atmosfere göre basınç farkı)",
  symbol: "\\Delta p",
  dimension: "basinc",
  defaultUnit: "bar",
  units: ["mbar", "bar", "kPa"],
  default: 0.6,
  min: 0,
  minExclusive: true,
  max: 101325,
  help: "Vantuzdaki vakumun atmosfer basıncından farkı; ör. −0,6 bar gösterge vakumu için 0,6 bar.",
};
const IN_N: NumberInputSpec = {
  kind: "number",
  key: "n",
  label: "Vantuz sayısı",
  symbol: "n",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
  default: 4,
  min: 1,
  integer: true,
};
const IN_DV: NumberInputSpec = {
  kind: "number",
  key: "dv",
  label: "Seçilen vantuzun efektif çapı",
  symbol: "d",
  dimension: "uzunluk",
  defaultUnit: "mm",
  units: ["mm", "cm"],
  default: 60,
  min: 0,
  minExclusive: true,
  optional: true,
  help: "Vakum altındaki efektif emme çapı (çift dudaklı vantuzda yaklaşık iç çap, körüklü vantuzda sızdırmazlık dudağının iç çapı). Boş bırakılırsa yalnızca gerekli çap hesaplanır.",
};

const OUT_FTH: OutputSpec = {
  key: "FTH",
  label: "Gerekli teorik tutma kuvveti (S dahil)",
  symbol: "F_{\\text{TH}}",
  dimension: "kuvvet",
  defaultUnit: "N",
  units: ["N", "kN", "kgf"],
};
const OUT_DREQ: OutputSpec = {
  key: "dGerekli",
  label: "Gerekli en küçük efektif vantuz çapı",
  symbol: "d_{\\text{gerekli}}",
  dimension: "uzunluk",
  defaultUnit: "mm",
  units: ["mm", "cm"],
};
const OUT_FV: OutputSpec = {
  key: "Fvantuz",
  label: "Bir vantuzun teorik tutma kuvveti",
  symbol: "F_v",
  dimension: "kuvvet",
  defaultUnit: "N",
  units: ["N", "kN", "kgf"],
};
const OUT_FTOP: OutputSpec = {
  key: "Ftoplam",
  label: "Vantuzların toplam teorik tutma kuvveti",
  symbol: "F_{\\text{toplam}}",
  dimension: "kuvvet",
  defaultUnit: "N",
  units: ["N", "kN", "kgf"],
};
const OUT_FIZIN: OutputSpec = {
  key: "Fizin",
  label: "Emniyetli tutma kuvveti (n·Δp·A/S)",
  symbol: "F_{\\text{izin}}",
  dimension: "kuvvet",
  defaultUnit: "N",
  units: ["N", "kN", "kgf"],
};
const OUT_SG: OutputSpec = {
  key: "Sgercek",
  label: "Seçilen vantuzlarla gerçek emniyet katsayısı",
  symbol: "S_{\\text{gerçek}}",
  dimension: "boyutsuz",
  defaultUnit: "unitless",
  significant: 3,
};

const qm = (v: number) => latexSpec(IN_M, v);
const qa = (v: number) => latexSpec(IN_A, v);
const qg = latexQty(G_N, "m_s2");
const qdp = (v: number) => latexSpec(IN_DP, v);
const qdv = (v: number) => latexSpec(IN_DV, v);
const qF = (v: number) => latexSpec(OUT_FTH, v);
const qd = (v: number) => latexSpec(OUT_DREQ, v);

const nText = (v: number, significant = 3) => formatNumber(v, { significant });
const fText = (v: number) => formatQuantity(v, "N");

const MESSAGES = {
  sTooLow: (min: string) =>
    `Emniyet katsayısı ${min}'in altında: Schmalz pürüzsüz ve sızdırmaz iş parçalarında bile en az ${min} öngörür.`,
  sGuide: (kritik: string, donme: string) =>
    `Kritik, gözenekli, pürüzlü veya yağlı yüzeylerde S ≥ ${kritik}; iş parçası döndürülürken S ≥ ${donme} alınmalıdır (Schmalz). En elverişsiz yük durumuyla hesaplayın.`,
  insufficient: (ftop: string, fth: string, sg: string, s: string) =>
    `Seçilen vantuzlar yetersiz: toplam teorik tutma kuvveti ${ftop} < gerekli ${fth} (gerçek emniyet katsayısı ${sg} < ${s}). Daha büyük çap, daha çok vantuz veya daha yüksek vakum gerekir.`,
  sufficient: (ftop: string, fth: string, sg: string) =>
    `Seçilen vantuzlar yeterli: toplam teorik tutma kuvveti ${ftop} ≥ gerekli ${fth} (gerçek emniyet katsayısı ${sg}).`,
  theoretical:
    "Değerler teoriktir: vantuzun boyutu ve biçimi, yüzeyin durumu ve parçanın rijitliği gerçek tutma kuvvetini etkiler; deneyle doğrulayın.",
} as const;

export const vakumVantuz: CalcDefinition = {
  id: "6.8",
  slug: "vakum-vantuz-tutma-kuvveti",
  category: "mekatronik",
  title: "Vakum vantuz tutma kuvveti",
  description:
    "Vantuzla taşınan iş parçası için gerekli teorik tutma kuvvetini üretici yük durumlarına (yatay/dikey vantuz, kaldırma/yatay taşıma, sürtünme katsayısı ve ivme) göre hesaplayın; gerekli vantuz çapını bulun ve seçilen vantuzların gerçek emniyet katsayısını kontrol edin.",
  formulas: [
    { label: "Yük durumu I — vantuz yatay, kuvvet dikey", latex: "F_{\\text{TH}} = m \\cdot (g + a) \\cdot S" },
    { label: "Yük durumu II — vantuz yatay, kuvvet yatay", latex: "F_{\\text{TH}} = m \\cdot \\left(g + \\frac{a}{\\mu}\\right) \\cdot S" },
    { label: "Yük durumu III — vantuz dikey, kuvvet dikey", latex: "F_{\\text{TH}} = \\frac{m}{\\mu} \\cdot (g + a) \\cdot S" },
    { label: "Bir vantuzun teorik tutma kuvveti", latex: "F_v = \\Delta p \\cdot A = \\Delta p \\cdot \\frac{\\pi d^2}{4}" },
    { label: "Gerekli efektif çap (n vantuz)", latex: "d_{\\text{gerekli}} = \\sqrt{\\frac{4 \\, F_{\\text{TH}}}{\\pi \\cdot n \\cdot \\Delta p}}" },
    {
      label: "Emniyetli tutma kuvveti (yük durumunun gerektirdiği F_TH/S ile karşılaştırılır)",
      latex: "F_{\\text{izin}} = \\frac{n \\cdot \\Delta p \\cdot A}{S} \\geq \\frac{F_{\\text{TH}}}{S}",
    },
    { label: "Gerçek emniyet katsayısı", latex: "S_{\\text{gerçek}} = S \\cdot \\frac{n \\cdot F_v}{F_{\\text{TH}}}" },
  ],
  references: [REF_YUK, REF_CAP],
  inputs: [
    {
      kind: "select",
      key: "yuk",
      label: "Yük durumu",
      options: [
        { value: "I", label: "I — Vantuz yatay, kuvvet dikey (dikey kaldırma)" },
        { value: "II", label: "II — Vantuz yatay, kuvvet yatay (kaldırıp yatay taşıma)" },
        { value: "III", label: "III — Vantuz dikey, kuvvet dikey (dikey tutulan parça)" },
      ],
      default: "I",
    },
    IN_M,
    IN_A,
    IN_MU,
    IN_S,
    IN_DP,
    IN_N,
    IN_DV,
  ],
  outputs: [OUT_FTH, OUT_DREQ, OUT_FV, OUT_FTOP, OUT_FIZIN, OUT_SG],

  compute: (inputs, ctx): CalcResult => {
    const yuk = inputs.yuk as VakumYukDurumu;
    const m = num(inputs, "m", WHERE);
    const a = num(inputs, "a", WHERE);
    const S = num(inputs, "S", WHERE);
    const dp = num(inputs, "dp", WHERE);
    const n = num(inputs, "n", WHERE);
    const dv = optNum(inputs, "dv");
    const g = G_N;

    let FTH: number;
    let step: Step;
    if (yuk === "I") {
      FTH = m * (g + a) * S;
      step = {
        label: "Gerekli teorik tutma kuvveti (yük durumu I)",
        latex: `F_{\\text{TH}} = m \\cdot (g + a) \\cdot S = ${qm(m)} \\cdot \\left(${qg} + ${qa(a)}\\right) \\cdot ${latexNum(S)} = ${qF(FTH)}`,
      };
    } else if (yuk === "II" || yuk === "III") {
      const mu = num(inputs, "mu", WHERE);
      if (yuk === "II") {
        FTH = m * (g + a / mu) * S;
        step = {
          label: "Gerekli teorik tutma kuvveti (yük durumu II)",
          latex: `F_{\\text{TH}} = m \\cdot \\left(g + \\frac{a}{\\mu}\\right) \\cdot S = ${qm(m)} \\cdot \\left(${qg} + \\frac{${qa(a)}}{${latexNum(mu)}}\\right) \\cdot ${latexNum(S)} = ${qF(FTH)}`,
        };
      } else {
        FTH = (m / mu) * (g + a) * S;
        step = {
          label: "Gerekli teorik tutma kuvveti (yük durumu III)",
          latex: `F_{\\text{TH}} = \\frac{m}{\\mu} \\cdot (g + a) \\cdot S = \\frac{${qm(m)}}{${latexNum(mu)}} \\cdot \\left(${qg} + ${qa(a)}\\right) \\cdot ${latexNum(S)} = ${qF(FTH)}`,
        };
      }
    } else {
      throw new Error(`${WHERE}: bilinmeyen yük durumu "${String(yuk)}"`);
    }

    const dGerekli = Math.sqrt((4 * FTH) / (Math.PI * n * dp));
    const steps: Step[] = [
      step,
      {
        label: "Gerekli en küçük efektif vantuz çapı",
        latex: `d_{\\text{gerekli}} = \\sqrt{\\frac{4 \\, F_{\\text{TH}}}{\\pi \\cdot n \\cdot \\Delta p}} = \\sqrt{\\frac{4 \\cdot ${qF(FTH)}}{\\pi \\cdot ${latexNum(n)} \\cdot ${qdp(dp)}}} = ${qd(dGerekli)}`,
      },
    ];
    const outputs: Record<string, number> = { FTH, dGerekli };
    const checks: Check[] = [];
    const sinir = ctx.limits.mekatronikAkiskan.vakumEmniyet;

    if (S < sinir.min * (1 - 1e-9)) {
      checks.push({ level: "uyari", message: MESSAGES.sTooLow(nText(sinir.min, 2)), reference: REF_YUK });
    }

    if (dv !== undefined) {
      const Fvantuz = dp * daireAlani(dv);
      const Ftoplam = n * Fvantuz;
      const Fizin = Ftoplam / S;
      const Fyuk = FTH / S;
      const Sgercek = (S * Ftoplam) / FTH;
      Object.assign(outputs, { Fvantuz, Ftoplam, Fizin, Sgercek });
      steps.push(
        {
          label: "Bir vantuzun teorik tutma kuvveti",
          latex: `F_v = \\Delta p \\cdot \\frac{\\pi d^2}{4} = ${qdp(dp)} \\cdot \\frac{\\pi \\cdot (${qdv(dv)})^2}{4} = ${qF(Fvantuz)}`,
        },
        {
          label: "Toplam teorik tutma kuvveti",
          latex: `F_{\\text{toplam}} = n \\cdot F_v = ${latexNum(n)} \\cdot ${qF(Fvantuz)} = ${qF(Ftoplam)}`,
        },
        {
          label: "Emniyetli tutma kuvveti (yük durumunun gerektirdiği F_TH/S ile karşılaştırma)",
          latex: `F_{\\text{izin}} = \\frac{n \\cdot \\Delta p \\cdot A}{S} = \\frac{${qF(Ftoplam)}}{${latexNum(S)}} = ${qF(Fizin)} ${Fizin >= Fyuk * (1 - 1e-9) ? "\\geq" : "<"} \\frac{F_{\\text{TH}}}{S} = ${qF(Fyuk)}`,
        },
        {
          label: "Gerçek emniyet katsayısı",
          latex: `S_{\\text{gerçek}} = S \\cdot \\frac{F_{\\text{toplam}}}{F_{\\text{TH}}} = ${latexNum(S)} \\cdot \\frac{${qF(Ftoplam)}}{${qF(FTH)}} = ${latexNum(Sgercek, { significant: 3 })}`,
        },
      );
      checks.push(
        Ftoplam < FTH * (1 - 1e-9)
          ? {
              level: "uyari",
              message: MESSAGES.insufficient(fText(Ftoplam), fText(FTH), nText(Sgercek), nText(S)),
              reference: REF_CAP,
            }
          : { level: "ok", message: MESSAGES.sufficient(fText(Ftoplam), fText(FTH), nText(Sgercek)) },
      );
    }

    checks.push(
      { level: "bilgi", message: MESSAGES.sGuide(nText(sinir.kritikYuzey, 2), nText(sinir.dondurme, 2)), reference: REF_CAP },
      { level: "bilgi", message: MESSAGES.theoretical },
    );

    return { outputs, steps, checks };
  },
};
