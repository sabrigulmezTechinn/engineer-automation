/**
 * KAPSAM 1.7 — dB dönüşümleri.
 *
 * Güç büyüklükleri: L = 10·log₁₀(P₂/P₁) dB. Alan büyüklükleri (gerilim, akım): L = 20·log₁₀(U₂/U₁) dB.
 * Referanslı seviyeler: dBm (1 mW), dBV (1 V), dBµV (1 µV). Bu referans değerleri tanımdır ve burada tutulur.
 *
 * Birim kataloğunda `seviye_db` boyutunun tek birimi `dB`'dir; dBm/dBV/dBµV kardeş birim değildir
 * (dönüştürücü onları dB'ye eşit sayardı). Bu yüzden referanslı seviye çıktıları `dB` birimiyle verilir ve
 * referans etikette yazılır; ara adımlarda birim dBm/dBV/dBµV olarak gösterilir.
 *
 * IEC 60027-3:2002 madde başlıkları (4.1 alan büyüklüklerinin logaritmik oranları, 4.2 güç büyüklüklerinin
 * logaritmik oranları, 4.3 seviyeler) yayıncı önizlemesinden doğrulandı:
 * https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec60027-3{ed3.0}b.pdf
 */
import { latexAuto, latexNum } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, NumberInputSpec, Step } from "@/lib/calc/types";

export type DbMod =
  | "guc-db"
  | "gerilim-db"
  | "db-guc"
  | "db-gerilim"
  | "guc-dbm"
  | "dbm-guc"
  | "gerilim-dbv"
  | "dbv-gerilim"
  | "dbuv-gerilim";

/** Referans değerleri (SI): dBm için 1 mW, dBV için 1 V, dBµV için 1 µV. */
const P_REF_DBM = 1e-3;
const U_REF_DBV = 1;
const U_REF_DBUV = 1e-6;
/** 20·log₁₀(1 V / 1 µV) = 120 dB */
const DBV_TO_DBUV = 120;

/** dB girdileri için pratik sınır: 10^(L/10) taşmasın; ±300 dB fiziksel olarak zaten anlamsızdır. */
const DB_LIMIT = 300;

const MESSAGES = {
  fieldRatio:
    "20·log₁₀ kuralı gerilim veya akım oranı içindir. Bu dB değeri güç oranına yalnızca iki değer aynı empedans üzerinde ölçüldüyse eşittir; empedanslar farklıysa güç oranı farklıdır.",
  voltageLevel:
    "dBV ve dBµV gerilim seviyeleridir (1 V ve 1 µV referans) ve empedanstan bağımsızdır. Güç seviyesine (dBm) çevirmek için empedans gerekir; ör. 50 Ω'da 0 dBm ≈ 107 dBµV.",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`db-donusumleri: "${key}" sayı değil`);
  return v;
}

/** -0 → 0 */
const n0 = (x: number) => (x === 0 ? 0 : x);

const DBM = "\\,\\mathrm{dBm}";
const DBV = "\\,\\mathrm{dBV}";
const DBUV = "\\,\\mathrm{dB\\mu V}";
const DB = "\\,\\mathrm{dB}";
const qDb = (v: number, unit: string) => `${latexNum(v)}${unit}`;
/** log argümanı: üslü gösterim (1 × 10⁻⁵) parantezlenir */
const arg = (latex: string) => (latex.includes("\\times") ? `\\left(${latex}\\right)` : latex);
/** Üs içinde: negatif değer de doğal yazılır, ör. 10^{-20/10} */
const exp = (v: number, div: number) => `10^{${latexNum(v)}/${div}}`;

const levelInput = (key: string, label: string, symbol: string, def: number, mode: DbMod): NumberInputSpec => ({
    kind: "number",
    key,
    label,
    symbol,
    dimension: "seviye_db",
    defaultUnit: "dB",
    units: ["dB"],
    default: def,
    min: -DB_LIMIT,
    max: DB_LIMIT,
    visibleWhen: { key: "mod", equals: mode },
  });

export const dbDonusumleri: CalcDefinition = {
  id: "1.7",
  slug: "db-donusumleri",
  category: "temel-elektrik",
  title: "dB dönüşümleri",
  description:
    "Güç ve gerilim/akım oranlarını desibele, desibeli orana çevirin; gücü dBm'e (1 mW referans), gerilimi dBV (1 V) ve dBµV'ye (1 µV) dönüştürün. Referanslı seviyeler sonuçta dB birimiyle gösterilir, referans etikette yazar.",
  formulas: [
    { label: "Güç oranı", latex: "L = 10 \\log_{10}\\frac{P_2}{P_1}\\,\\mathrm{dB}" },
    { label: "Gerilim / akım oranı", latex: "L = 20 \\log_{10}\\frac{U_2}{U_1}\\,\\mathrm{dB}" },
    { label: "Güç seviyesi", latex: "L_{\\mathrm{dBm}} = 10 \\log_{10}\\frac{P}{1\\,\\mathrm{mW}}" },
    {
      label: "Gerilim seviyesi",
      latex: "L_{\\mathrm{dBV}} = 20 \\log_{10}\\frac{U}{1\\,\\mathrm{V}}, \\quad L_{\\mathrm{dB\\mu V}} = 20 \\log_{10}\\frac{U}{1\\,\\mu\\mathrm{V}} = L_{\\mathrm{dBV}} + 120",
    },
  ],
  references: [
    {
      standard: "IEC 60027-3",
      title: "Elektroteknikte kullanılacak harf sembolleri — Bölüm 3: Logaritmik ve ilgili büyüklükler ve birimleri",
      clause: "Madde 4: Alan ve güç büyüklüklerinin logaritmik oranları (4.1, 4.2) ve seviyeler (4.3)",
    },
  ],
  inputs: [
    {
      kind: "select",
      key: "mod",
      label: "Dönüşüm",
      options: [
        { value: "guc-db", label: "Güç oranı → dB" },
        { value: "gerilim-db", label: "Gerilim/akım oranı → dB" },
        { value: "db-guc", label: "dB → güç oranı" },
        { value: "db-gerilim", label: "dB → gerilim/akım oranı" },
        { value: "guc-dbm", label: "Güç → dBm" },
        { value: "dbm-guc", label: "dBm → güç" },
        { value: "gerilim-dbv", label: "Gerilim → dBV ve dBµV" },
        { value: "dbv-gerilim", label: "dBV → gerilim" },
        { value: "dbuv-gerilim", label: "dBµV → gerilim" },
      ],
      default: "guc-db",
    },
    {
      kind: "number",
      key: "oranP",
      label: "Güç oranı P₂/P₁",
      symbol: "P_2/P_1",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      units: ["unitless"],
      default: 2,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "mod", equals: "guc-db" },
    },
    {
      kind: "number",
      key: "oranV",
      label: "Gerilim veya akım oranı U₂/U₁",
      symbol: "U_2/U_1",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      units: ["unitless"],
      default: 10,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "mod", equals: "gerilim-db" },
    },
    levelInput("Lp", "Seviye farkı (güç)", "L", 3, "db-guc"),
    levelInput("Lv", "Seviye farkı (gerilim/akım)", "L", 6, "db-gerilim"),
    {
      kind: "number",
      key: "P",
      label: "Güç",
      symbol: "P",
      dimension: "guc",
      defaultUnit: "mW",
      default: 100,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "mod", equals: "guc-dbm" },
    },
    levelInput("Ldbm", "Güç seviyesi (dBm)", "L_{\\mathrm{dBm}}", 20, "dbm-guc"),
    {
      kind: "number",
      key: "U",
      label: "Gerilim (etkin değer)",
      symbol: "U",
      dimension: "gerilim",
      defaultUnit: "mV",
      default: 10,
      min: 0,
      minExclusive: true,
      visibleWhen: { key: "mod", equals: "gerilim-dbv" },
    },
    levelInput("Ldbv", "Gerilim seviyesi (dBV)", "L_{\\mathrm{dBV}}", -40, "dbv-gerilim"),
    levelInput("Ldbuv", "Gerilim seviyesi (dBµV)", "L_{\\mathrm{dB\\mu V}}", 80, "dbuv-gerilim"),
  ],
  outputs: [
    { key: "L", label: "Seviye farkı (dB)", symbol: "L", dimension: "seviye_db", defaultUnit: "dB" },
    { key: "oranP", label: "Güç oranı P₂/P₁", symbol: "P_2/P_1", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "oranV", label: "Gerilim/akım oranı U₂/U₁", symbol: "U_2/U_1", dimension: "boyutsuz", defaultUnit: "unitless" },
    { key: "dBm", label: "Güç seviyesi (dBm, 1 mW referans)", symbol: "L_{\\mathrm{dBm}}", dimension: "seviye_db", defaultUnit: "dB" },
    { key: "P", label: "Güç", symbol: "P", dimension: "guc", defaultUnit: "W" },
    { key: "U", label: "Gerilim (etkin değer)", symbol: "U", dimension: "gerilim", defaultUnit: "V" },
    { key: "dBV", label: "Gerilim seviyesi (dBV, 1 V referans)", symbol: "L_{\\mathrm{dBV}}", dimension: "seviye_db", defaultUnit: "dB" },
    {
      key: "dBuV",
      label: "Gerilim seviyesi (dBµV, 1 µV referans)",
      symbol: "L_{\\mathrm{dB\\mu V}}",
      dimension: "seviye_db",
      defaultUnit: "dB",
    },
  ],

  compute: (inputs) => {
    const mode = inputs.mod as DbMod;
    const steps: Step[] = [];
    const checks: Check[] = [];
    const outputs: Record<string, number> = {};

    switch (mode) {
      case "guc-db": {
        const r = num(inputs, "oranP");
        const L = n0(10 * Math.log10(r));
        steps.push({ label: "Seviye farkı", latex: `L = 10 \\log_{10}\\frac{P_2}{P_1} = 10 \\log_{10} ${arg(latexNum(r))} = ${qDb(L, DB)}` });
        outputs.L = L;
        break;
      }
      case "gerilim-db": {
        const r = num(inputs, "oranV");
        const L = n0(20 * Math.log10(r));
        steps.push({ label: "Seviye farkı", latex: `L = 20 \\log_{10}\\frac{U_2}{U_1} = 20 \\log_{10} ${arg(latexNum(r))} = ${qDb(L, DB)}` });
        outputs.L = L;
        checks.push({ level: "ok", message: MESSAGES.fieldRatio });
        break;
      }
      case "db-guc": {
        const L = num(inputs, "Lp");
        const r = 10 ** (L / 10);
        steps.push({ label: "Güç oranı", latex: `\\frac{P_2}{P_1} = 10^{L/10} = ${exp(L, 10)} = ${latexNum(r)}` });
        outputs.oranP = r;
        break;
      }
      case "db-gerilim": {
        const L = num(inputs, "Lv");
        const r = 10 ** (L / 20);
        steps.push({ label: "Gerilim/akım oranı", latex: `\\frac{U_2}{U_1} = 10^{L/20} = ${exp(L, 20)} = ${latexNum(r)}` });
        outputs.oranV = r;
        checks.push({ level: "ok", message: MESSAGES.fieldRatio });
        break;
      }
      case "guc-dbm": {
        const P = num(inputs, "P");
        const L = n0(10 * Math.log10(P / P_REF_DBM));
        steps.push({
          label: "Güç seviyesi",
          latex: `L_{\\mathrm{dBm}} = 10 \\log_{10}\\frac{P}{1\\,\\mathrm{mW}} = 10 \\log_{10}\\frac{${latexAuto(P, "guc")}}{1\\,\\mathrm{mW}} = ${qDb(L, DBM)}`,
        });
        outputs.dBm = L;
        break;
      }
      case "dbm-guc": {
        const L = num(inputs, "Ldbm");
        const P = P_REF_DBM * 10 ** (L / 10);
        steps.push({
          label: "Güç",
          latex: `P = 1\\,\\mathrm{mW} \\cdot 10^{L_{\\mathrm{dBm}}/10} = 1\\,\\mathrm{mW} \\cdot ${exp(L, 10)} = ${latexAuto(P, "guc")}`,
        });
        outputs.P = P;
        break;
      }
      case "gerilim-dbv": {
        const U = num(inputs, "U");
        const dBV = n0(20 * Math.log10(U / U_REF_DBV));
        const dBuV = n0(20 * Math.log10(U / U_REF_DBUV));
        const qU = latexAuto(U, "gerilim");
        steps.push({
          label: "Gerilim seviyesi (dBV)",
          latex: `L_{\\mathrm{dBV}} = 20 \\log_{10}\\frac{U}{1\\,\\mathrm{V}} = 20 \\log_{10}\\frac{${qU}}{1\\,\\mathrm{V}} = ${qDb(dBV, DBV)}`,
        });
        steps.push({
          label: "Gerilim seviyesi (dBµV)",
          latex: `L_{\\mathrm{dB\\mu V}} = 20 \\log_{10}\\frac{U}{1\\,\\mu\\mathrm{V}} = 20 \\log_{10}\\frac{${qU}}{1\\,\\mu\\mathrm{V}} = ${qDb(dBuV, DBUV)}`,
        });
        Object.assign(outputs, { dBV, dBuV });
        checks.push({ level: "ok", message: MESSAGES.voltageLevel });
        break;
      }
      case "dbv-gerilim": {
        const L = num(inputs, "Ldbv");
        const U = U_REF_DBV * 10 ** (L / 20);
        const dBuV = n0(L + DBV_TO_DBUV);
        steps.push({
          label: "Gerilim",
          latex: `U = 1\\,\\mathrm{V} \\cdot 10^{L_{\\mathrm{dBV}}/20} = 1\\,\\mathrm{V} \\cdot ${exp(L, 20)} = ${latexAuto(U, "gerilim")}`,
        });
        steps.push({
          label: "Gerilim seviyesi (dBµV)",
          latex: `L_{\\mathrm{dB\\mu V}} = L_{\\mathrm{dBV}} + 120 = ${latexNum(L)} + 120 = ${qDb(dBuV, DBUV)}`,
        });
        Object.assign(outputs, { U, dBuV });
        checks.push({ level: "ok", message: MESSAGES.voltageLevel });
        break;
      }
      case "dbuv-gerilim": {
        const L = num(inputs, "Ldbuv");
        const U = U_REF_DBUV * 10 ** (L / 20);
        const dBV = n0(L - DBV_TO_DBUV);
        steps.push({
          label: "Gerilim",
          latex: `U = 1\\,\\mu\\mathrm{V} \\cdot 10^{L_{\\mathrm{dB\\mu V}}/20} = 1\\,\\mu\\mathrm{V} \\cdot ${exp(L, 20)} = ${latexAuto(U, "gerilim")}`,
        });
        steps.push({
          label: "Gerilim seviyesi (dBV)",
          latex: `L_{\\mathrm{dBV}} = L_{\\mathrm{dB\\mu V}} - 120 = ${latexNum(L)} - 120 = ${qDb(dBV, DBV)}`,
        });
        Object.assign(outputs, { U, dBV });
        checks.push({ level: "ok", message: MESSAGES.voltageLevel });
        break;
      }
      default:
        throw new Error(`db-donusumleri: bilinmeyen mod "${String(mode)}"`);
    }

    return { outputs, steps, checks };
  },
};
