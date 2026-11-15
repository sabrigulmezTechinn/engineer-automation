/**
 * KAPSAM 4.10 — PCB yol genişliği (IPC-2221 eğri uydurması).
 *
 * Genel formül: I = k·ΔT^b·A^c; I amper, ΔT °C (K farkıyla aynı), A mil² (1 mil = 0,001 inç = 25,4 µm).
 * k dış katmanda 0,048, iç katmanda 0,024; b = 0,44; c = 0,725. Sabitler ve geçerlilik aralığı
 * src/config/sinir/elektronik-kod-pcb.ts'te kaynaklarıyla (AdvancedPCB Trace Width Calculator notları):
 *   https://www.advancedpcb.com/en-us/tools/trace-width-calculator/
 * Formül boyutlu (birimleri sabit) olduğu için compute SI'da çalışır ve mil² dönüşümünü açıkça yapar:
 *   A[mil²] = A[m²] / (25,4·10⁻⁶ m)².
 * Akımdan genişlik: A = (I/(k·ΔT^b))^(1/c), w = A/t. Genişlikten akım: A = w·t, I = k·ΔT^b·A^c.
 * İsteğe bağlı yol uzunluğu L ile direnç R = ρ₂₀·[1 + α₂₀·(T − 20 °C)]·L/A, T = T_ortam + ΔT (ρ₂₀, α₂₀: NBS Handbook 100),
 * gerilim düşümü ΔV = I·R ve güç kaybı P = I²·R.
 *
 * IPC-2152 (2009) iletken boyutlandırmayı grafiklerle verir; kapalı formu yoktur ve burada kullanılmaz (yalnızca bilgi notu).
 */
import { latexNum, latexSpec } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { formatQuantity, fromSI } from "@/lib/units";
import { autoOutputUnit } from "@/lib/calc/auto-unit";

/** 1 mil (thou) = 25,4 µm (tanım gereği tam), m */
export const MIL = 25.4e-6;
/** 20 °C, K */
const T20 = 293.15;

/** Hüküm olmayan notlar (yöntem, hatırlatma) için seviye */
const BILGI = "ok" as const; // birleştirmede "bilgi" olur

export type PcbMod = "genislik" | "akim";
export type PcbKatman = "dis" | "ic";
/** Bakır kalınlığı seçimi: oz/ft² katı ya da özel kalınlık */
export type PcbBakir = "0.5" | "1" | "2" | "3" | "ozel";

const MESSAGES = {
  ipc2152:
    "Bu sonuç IPC-2221 grafiklerine uydurulmuş genel formüldür ve yolu yalnız başına (yakınında düzlem/bakır alan olmadan) ele alır. Daha yeni IPC-2152 (2009) iletken boyutlandırmayı grafiklerle verir; bu hesapta kullanılmaz.",
  akim: (I: string) =>
    `Akım (${I}) IPC-2221 grafiklerinin kapsadığı 35 A'yı aşıyor; formül bu bölgede yalnızca dışarı değer veriyor (ekstrapolasyon).`,
  genislik: (w: string) =>
    `Yol genişliği (${w}) IPC-2221 grafiklerinin kapsadığı 0,4 inçi (10,16 mm) aşıyor; formül bu bölgede yalnızca dışarı değer veriyor.`,
  sicaklik: (dT: string) =>
    `Sıcaklık artışı (${dT}) IPC-2221 grafiklerinin kapsadığı 10–100 °C aralığının dışında; formül bu bölgede yalnızca dışarı değer veriyor.`,
  kalinlik: (t: string) =>
    `Bakır kalınlığı (${t}) IPC-2221 grafiklerinin kapsadığı 0,5–3 oz/ft² (17,5–105 µm) aralığının dışında; formül bu bölgede yalnızca dışarı değer veriyor.`,
  direncYok: "Yol direnci, gerilim düşümü ve güç kaybı için yol uzunluğunu girin.",
} as const;

const REF_ADVANCEDPCB: Reference = {
  standard: "AdvancedPCB — Trace Width Calculator",
  title: "IPC-2221 eğrilerine uydurulmuş formül ve geçerlilik aralığı",
  clause: "Notes ve SSS",
  note: "Area[mils²] = (I/(k·ΔT^b))^(1/c), Width[mils] = Area/(Thickness[oz]·1,378); iç katman k = 0,024, dış katman k = 0,048, b = 0,44, c = 0,725. Grafikler 35 A, 0,4 inç genişlik, 10–100 °C artış ve 0,5–3 oz/ft² bakırla sınırlıdır. https://www.advancedpcb.com/en-us/tools/trace-width-calculator/",
};

const REFERENCES: Reference[] = [
  {
    standard: "IPC-2221B",
    title: "Generic Standard on Printed Board Design (Kasım 2012; IPC-2221A 2003 ve IPC-2221 1998'in yerine)",
    note: "Akım taşıma formülü IPC-2221 grafiklerine yapılan eğri uydurmasıdır (k, b, c); standardın tablo ve grafikleri burada yayınlanmaz.",
  },
  REF_ADVANCEDPCB,
  {
    standard: "IPC-2152",
    title: "Standard for Determining Current Carrying Capacity in Printed Board Design (Ağustos 2009)",
    clause: "Bölüm 5: Conductor Sizing Charts",
    note: "Daha yeni standart; iletken boyutlandırmayı durgun hava ve vakum/uzay ortamları için grafiklerle verir. Kapalı formu yoktur, bu hesapta kullanılmaz.",
  },
  {
    standard: "NBS Handbook 100 (1966)",
    title: "Copper Wire Tables",
    clause: "§1.a, §1.b",
    note: "Tavlanmış bakır (IACS), 20 °C: ρ₂₀ = 1,7241 µΩ·cm, α₂₀ = 0,00393 1/K. https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook100.pdf",
  },
];

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Hesap",
    options: [
      { value: "genislik", label: "Akımdan genişlik" },
      { value: "akim", label: "Genişlikten akım" },
    ],
    default: "genislik",
  },
  {
    kind: "select",
    key: "katman",
    label: "Katman",
    options: [
      { value: "dis", label: "Dış katman" },
      { value: "ic", label: "İç katman" },
    ],
    default: "dis",
    help: "Dış katman havayla soğur (k = 0,048); iç katman dielektrik içindedir (k = 0,024). Vakumda veya kalıplanmış (potted) kartta dış katman için de iç katmanı seçin.",
  },
  {
    kind: "number",
    key: "I",
    label: "Akım",
    symbol: "I",
    dimension: "akim",
    defaultUnit: "A",
    units: ["mA", "A"],
    default: 2,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "genislik" },
  },
  {
    kind: "number",
    key: "w",
    label: "Yol genişliği",
    symbol: "w",
    dimension: "uzunluk",
    defaultUnit: "mm",
    units: ["um", "mm", "thou", "in"],
    default: 1,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "akim" },
  },
  {
    kind: "number",
    key: "dT",
    label: "İzin verilen sıcaklık artışı",
    symbol: "\\Delta T",
    dimension: "sicaklik_farki",
    defaultUnit: "deltaDegC",
    units: ["deltaDegC", "deltaK"],
    default: 10,
    min: 0,
    minExclusive: true,
    help: "Yolun ortam sıcaklığının üzerine çıkmasına izin verilen sıcaklık farkı.",
  },
  {
    kind: "select",
    key: "bakir",
    label: "Bakır kalınlığı",
    options: [
      { value: "0.5", label: "0,5 oz/ft² (17,5 µm)" },
      { value: "1", label: "1 oz/ft² (35 µm)" },
      { value: "2", label: "2 oz/ft² (70 µm)" },
      { value: "3", label: "3 oz/ft² (105 µm)" },
      { value: "ozel", label: "Özel kalınlık" },
    ],
    default: "1",
    help: "1 oz/ft² = 1,378 mil ≈ 35 µm (AdvancedPCB).",
  },
  {
    kind: "number",
    key: "t",
    label: "Bakır kalınlığı",
    symbol: "t",
    dimension: "uzunluk",
    defaultUnit: "um",
    units: ["um", "mm", "thou"],
    default: 35,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "bakir", equals: "ozel" },
  },
  {
    kind: "number",
    key: "L",
    label: "Yol uzunluğu (isteğe bağlı)",
    symbol: "L",
    dimension: "uzunluk",
    defaultUnit: "mm",
    units: ["mm", "cm", "m", "thou", "in"],
    default: 50,
    min: 0,
    minExclusive: true,
    optional: true,
    help: "Verilirse yol direnci, gerilim düşümü ve güç kaybı hesaplanır.",
  },
  {
    kind: "number",
    key: "Ta",
    label: "Ortam sıcaklığı",
    symbol: "T_a",
    dimension: "sicaklik",
    defaultUnit: "degC",
    units: ["degC", "K", "degF"],
    default: 25,
    min: 0,
    minExclusive: true,
    help: "Yalnızca direnç hesabında kullanılır: yol sıcaklığı T = T_a + ΔT.",
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "w_gerekli", label: "Gerekli yol genişliği", symbol: "w", dimension: "uzunluk", defaultUnit: "mm", units: ["um", "mm", "thou", "in"] },
  { key: "I_izin", label: "İzin verilen akım", symbol: "I", dimension: "akim", defaultUnit: "A", units: ["mA", "A"] },
  { key: "A", label: "Yol kesiti", symbol: "A", dimension: "alan", defaultUnit: "mm2", units: ["mm2"] },
  { key: "t_cu", label: "Bakır kalınlığı", symbol: "t", dimension: "uzunluk", defaultUnit: "um", units: ["um", "mm", "thou"] },
  { key: "T_yol", label: "Yol sıcaklığı", symbol: "T", dimension: "sicaklik", defaultUnit: "degC", units: ["degC", "K", "degF"] },
  { key: "R", label: "Yol direnci", symbol: "R", dimension: "direnc", defaultUnit: "ohm", units: ["mohm", "ohm"] },
  { key: "dV", label: "Gerilim düşümü", symbol: "\\Delta V", dimension: "gerilim", defaultUnit: "V", units: ["uV", "mV", "V"] },
  { key: "P", label: "Güç kaybı", symbol: "P", dimension: "guc", defaultUnit: "W", units: ["mW", "W"] },
];

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`pcb-yol-genisligi: "${key}" sayı değil`);
  return v;
}

const SPECS = [...INPUTS, ...OUTPUTS];

/** Anahtarıyla sayısal tanımın birimiyle LaTeX (kartla aynı birim kuralı). */
function q(key: string, valueSI: number): string {
  const spec = SPECS.find((s) => s.key === key);
  if (!spec || ("kind" in spec && spec.kind === "select")) throw new Error(`pcb-yol-genisligi: "${key}" sayısal tanımı yok`);
  return latexSpec(spec as OutputSpec, valueSI);
}

/** Kontrol mesajlarında değeri kartla aynı birimle yazar. */
function text(key: string, valueSI: number): string {
  const spec = SPECS.find((s) => s.key === key) as OutputSpec;
  const unit = autoOutputUnit(spec, valueSI);
  return formatQuantity(fromSI(valueSI, unit), unit);
}

const mil2 = (x: number) => `${latexNum(x)}\\,\\text{mil}^2`;

/** IPC-2221: akımdan kesit, mil² (I: A, ΔT: °C) */
export function ipc2221Kesit(I: number, dT: number, k: number, b: number, c: number): number {
  return (I / (k * dT ** b)) ** (1 / c);
}

/** IPC-2221: kesitten akım, A (A: mil², ΔT: °C) */
export function ipc2221Akim(Amil2: number, dT: number, k: number, b: number, c: number): number {
  return k * dT ** b * Amil2 ** c;
}

export const pcbYolGenisligi: CalcDefinition = {
  id: "4.10",
  slug: "pcb-yol-genisligi",
  category: "elektronik",
  title: "PCB yol genişliği",
  description:
    "Baskılı devre kartında bir yolun taşıyacağı akım için gerekli genişliği ya da verilen genişliğin taşıyabileceği akımı IPC-2221 formülüyle hesaplayın; isteğe bağlı yol uzunluğuyla direnç, gerilim düşümü ve güç kaybını bulun.",
  formulas: [
    { label: "IPC-2221 (eğri uydurması; I: A, ΔT: °C, A: mil²)", latex: "I = k \\cdot \\Delta T^{0{,}44} \\cdot A^{0{,}725}, \\quad k_{\\text{dış}} = 0{,}048,\\; k_{\\text{iç}} = 0{,}024" },
    { label: "Akımdan kesit ve genişlik", latex: "A = \\left( \\frac{I}{k \\cdot \\Delta T^{0{,}44}} \\right)^{1/0{,}725}, \\quad w = \\frac{A}{t}" },
    { label: "mil² dönüşümü (1 mil = 25,4 µm)", latex: "A_{\\text{mil}^2} = \\frac{A}{(25{,}4 \\times 10^{-6}\\,\\mathrm{m})^2}" },
    {
      label: "Yol direnci",
      latex: "R = \\frac{\\rho_{20} \\cdot \\left[ 1 + \\alpha_{20} \\cdot (T - 20\\,{}^\\circ\\mathrm{C}) \\right] \\cdot L}{A}, \\quad T = T_a + \\Delta T",
    },
    { label: "Gerilim düşümü ve güç kaybı", latex: "\\Delta V = I \\cdot R, \\quad P = I^2 \\cdot R" },
  ],
  references: REFERENCES,
  inputs: INPUTS,
  outputs: OUTPUTS,

  compute: (inputs, ctx) => {
    const P = ctx.limits.elektronikKodPcb.pcb;
    const mode = inputs.mod as PcbMod;
    const katman = inputs.katman as PcbKatman;
    const bakir = inputs.bakir as PcbBakir;
    if (katman !== "dis" && katman !== "ic") throw new Error(`pcb-yol-genisligi: bilinmeyen katman "${String(katman)}"`);
    const k = katman === "dis" ? P.ipc2221.kDis : P.ipc2221.kIc;
    const { b, c } = P.ipc2221;
    const dT = num(inputs, "dT");
    const steps: Step[] = [];
    const checks: Check[] = [];
    const outputs: Record<string, number> = {};

    // Bakır kalınlığı
    let t: number;
    if (bakir === "ozel") {
      t = num(inputs, "t");
    } else {
      const oz = Number(bakir);
      if (!(oz > 0)) throw new Error(`pcb-yol-genisligi: bilinmeyen bakır kalınlığı "${String(bakir)}"`);
      t = oz * P.ozKalinligi;
      steps.push({
        label: "Bakır kalınlığı",
        latex: `t = ${latexNum(oz)} \\cdot 1{,}378\\,\\text{mil} = ${q("t_cu", t)}`,
      });
    }
    outputs.t_cu = t;

    const kText = `${latexNum(k)} \\cdot ${latexNum(dT)}^{${latexNum(b)}}`;
    let I: number;
    let A: number;
    let w: number;
    if (mode === "genislik") {
      I = num(inputs, "I");
      const Amil2 = ipc2221Kesit(I, dT, k, b, c);
      A = Amil2 * MIL * MIL;
      w = A / t;
      steps.push({
        label: `Gerekli kesit (IPC-2221, ${katman === "dis" ? "dış" : "iç"} katman)`,
        latex: `A = \\left( \\frac{I}{k \\cdot \\Delta T^{${latexNum(b)}}} \\right)^{1/${latexNum(c)}} = \\left( \\frac{${latexNum(I)}}{${kText}} \\right)^{1/${latexNum(c)}} = ${mil2(Amil2)} = ${q("A", A)}`,
      });
      steps.push({ label: "Gerekli yol genişliği", latex: `w = \\frac{A}{t} = \\frac{${q("A", A)}}{${q("t_cu", t)}} = ${q("w_gerekli", w)}` });
      Object.assign(outputs, { w_gerekli: w, A });
    } else if (mode === "akim") {
      w = num(inputs, "w");
      A = w * t;
      const Amil2 = A / (MIL * MIL);
      I = ipc2221Akim(Amil2, dT, k, b, c);
      steps.push({ label: "Yol kesiti", latex: `A = w \\cdot t = ${q("w", w)} \\cdot ${q("t_cu", t)} = ${q("A", A)} = ${mil2(Amil2)}` });
      steps.push({
        label: `İzin verilen akım (IPC-2221, ${katman === "dis" ? "dış" : "iç"} katman)`,
        latex: `I = k \\cdot \\Delta T^{${latexNum(b)}} \\cdot A^{${latexNum(c)}} = ${kText} \\cdot ${latexNum(Amil2)}^{${latexNum(c)}} = ${q("I_izin", I)}`,
      });
      Object.assign(outputs, { I_izin: I, A });
    } else {
      throw new Error(`pcb-yol-genisligi: bilinmeyen mod "${String(mode)}"`);
    }

    // Yol sıcaklığı ve isteğe bağlı direnç
    const Ta = num(inputs, "Ta");
    const T = Ta + dT;
    outputs.T_yol = T;
    steps.push({ label: "Yol sıcaklığı", latex: `T = T_a + \\Delta T = ${q("Ta", Ta)} + ${q("dT", dT)} = ${q("T_yol", T)}` });

    if (typeof inputs.L === "number") {
      const L = inputs.L;
      const rho = P.bakirOzdirenci20 * (1 + P.bakirSicaklikKatsayisi20 * (T - T20));
      const R = (rho * L) / A;
      const dV = I * R;
      const Pk = I * I * R;
      steps.push({
        label: "Bakır özdirenci (yol sıcaklığında)",
        latex: `\\rho = \\rho_{20} \\cdot \\left[ 1 + \\alpha_{20} \\cdot (T - 20\\,{}^\\circ\\mathrm{C}) \\right] = ${latexNum(P.bakirOzdirenci20 * 1e8)} \\times 10^{-8}\\,\\Omega\\,\\mathrm{m} \\cdot \\left[ 1 + ${latexNum(P.bakirSicaklikKatsayisi20)}\\,\\mathrm{K}^{-1} \\cdot ${latexNum(T - T20)}\\,\\mathrm{K} \\right] = ${latexNum(rho * 1e8)} \\times 10^{-8}\\,\\Omega\\,\\mathrm{m}`,
      });
      steps.push({ label: "Yol direnci", latex: `R = \\frac{\\rho \\cdot L}{A} = \\frac{${latexNum(rho * 1e8)} \\times 10^{-8}\\,\\Omega\\,\\mathrm{m} \\cdot ${q("L", L)}}{${q("A", A)}} = ${q("R", R)}` });
      steps.push({ label: "Gerilim düşümü", latex: `\\Delta V = I \\cdot R = ${q("I_izin", I)} \\cdot ${q("R", R)} = ${q("dV", dV)}` });
      steps.push({ label: "Güç kaybı", latex: `P = I^2 \\cdot R = (${q("I_izin", I)})^2 \\cdot ${q("R", R)} = ${q("P", Pk)}` });
      Object.assign(outputs, { R, dV, P: Pk });
    } else {
      checks.push({ level: BILGI, message: MESSAGES.direncYok });
    }

    // IPC-2221 grafiklerinin kapsamı
    const G = P.gecerlilik;
    if (I > G.maksAkim) checks.push({ level: "uyari", message: MESSAGES.akim(text("I_izin", I)), reference: REF_ADVANCEDPCB });
    if (w > G.maksGenislik) checks.push({ level: "uyari", message: MESSAGES.genislik(text("w_gerekli", w)), reference: REF_ADVANCEDPCB });
    if (dT < G.minSicaklikArtisi || dT > G.maksSicaklikArtisi) {
      checks.push({ level: "uyari", message: MESSAGES.sicaklik(text("dT", dT)), reference: REF_ADVANCEDPCB });
    }
    const tol = 1e-9;
    if (t < G.minBakirOz * P.ozKalinligi * (1 - tol) || t > G.maksBakirOz * P.ozKalinligi * (1 + tol)) {
      checks.push({ level: "uyari", message: MESSAGES.kalinlik(text("t_cu", t)), reference: REF_ADVANCEDPCB });
    }
    checks.push({ level: BILGI, message: MESSAGES.ipc2152 });

    return { outputs, steps, checks };
  },
};
