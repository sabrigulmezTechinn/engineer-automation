/**
 * KAPSAM 4.8 — Transistör baz direnci, MOSFET kaybı.
 *
 * BJT anahtar (doyumda):
 *   I_B = ODF·I_C/β_min (ODF: aşırı sürme katsayısı, kullanıcı girdisi), R_B = (V_in − V_BE(sat))/I_B.
 *   Standart direnç GÜVENLİ YÖNDE seçilir: R_B serideyse kendisi, değilse ALT komşu (daha çok baz akımı → doyum korunur).
 *   Gerçekleşen I_B,g = (V_in − V_BE)/R_B,std, ODF_g = I_B,g·β_min/I_C, zorlanmış kazanç β_F = I_C/I_B,g.
 *   Kayıplar: P_C ≈ V_CE(sat)·I_C, P_BE = V_BE·I_B,g, baz direnci P_RB = I_B,g²·R_B,std.
 *
 * MOSFET kaybı:
 *   İletim P_iletim = I_rms²·R_DS(on)·k_T (k_T: veri sayfasındaki normalize R_DS(on)–T_j eğrisinden, kullanıcı girdisi).
 *   Anahtarlama iki yöntemle: ½·V_DS·I_D·(t_r + t_f)·f_s (ROHM AEK59-D1-0065-2 Denk. 3, Wolfspeed PRD-03043 Denk. 2)
 *   ya da (E_on + E_off)·f_s (Wolfspeed PRD-03043 Denk. 3–4).
 *   Kapı sürme P_G = Q_g·V_GS·f_s (TI SLUA618A Denk. 9) — sürücüde harcanır, MOSFET kaybına katılmaz; ayrıca toplam verilir.
 */
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import type { ESeriesId } from "@/lib/calc/defs/yardimci/e-serileri";
import { REF, num, qNum, seriesSelect, specWriter, standardNote, standardSafe, textWriter } from "./guc-ortak";

export type TransistorMod = "bjt" | "mosfet";
export type AnahtarlamaYontemi = "vi" | "enerji";

const WHERE = "transistor-baz-direnci-mosfet-kaybi";

const BJT = { key: "mod", equals: "bjt" } as const;
const MOSFET = { key: "mod", equals: "mosfet" } as const;
const VI = { key: "yontem", equals: "vi" } as const;
const ENERJI = { key: "yontem", equals: "enerji" } as const;

const V_UNITS = ["mV", "V"];

const inputs: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Hesap",
    options: [
      { value: "bjt", label: "BJT anahtar: baz direnci" },
      { value: "mosfet", label: "MOSFET kayıpları" },
    ],
    default: "bjt",
  },
  // --- BJT ---
  {
    kind: "number",
    key: "Vin",
    label: "Sürme gerilimi",
    symbol: "V_{in}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: V_UNITS,
    default: 5,
    min: 0,
    minExclusive: true,
    help: "Baz direncini süren kaynağın (ör. mikrodenetleyici çıkışı) yüksek seviye gerilimi.",
    visibleWhen: BJT,
  },
  {
    kind: "number",
    key: "VBE",
    label: "Baz–emetör doyum gerilimi",
    symbol: "V_{BE(\\mathrm{sat})}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: V_UNITS,
    default: 0.7,
    min: 0,
    help: "Veri sayfasındaki V_BE(sat), çalışma akımına yakın koşulda.",
    visibleWhen: BJT,
  },
  {
    kind: "number",
    key: "IC",
    label: "Kolektör (yük) akımı",
    symbol: "I_C",
    dimension: "akim",
    defaultUnit: "mA",
    units: ["uA", "mA", "A"],
    default: 100,
    min: 0,
    minExclusive: true,
    visibleWhen: BJT,
  },
  {
    kind: "number",
    key: "beta",
    label: "En küçük akım kazancı",
    symbol: "\\beta_{min}",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    default: 100,
    min: 0,
    minExclusive: true,
    help:
      "Veri sayfasındaki h_FE(min): çalışma akımına yakın, düşük V_CE'de ve en düşük çalışma sıcaklığında. " +
      "Ör. P2N2222A'da I_C = 150 mA için V_CE = 10 V'ta 100, V_CE = 1 V'ta 50.",
    visibleWhen: BJT,
  },
  {
    kind: "number",
    key: "odf",
    label: "Aşırı sürme katsayısı",
    symbol: "\\mathrm{ODF}",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    default: 2,
    min: 1,
    help: "Baz akımının doyum sınırındaki I_C/β_min değerine oranı. β'nın yayılımına, sıcaklığa ve direnç toleransına karşı pay bırakır.",
    visibleWhen: BJT,
  },
  {
    kind: "number",
    key: "VCEsat",
    label: "Kolektör–emetör doyum gerilimi",
    symbol: "V_{CE(\\mathrm{sat})}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: V_UNITS,
    default: 0.2,
    min: 0,
    help: "Veri sayfasındaki V_CE(sat); genellikle belirli bir I_C/I_B oranında (ör. 10) verilir.",
    visibleWhen: BJT,
  },
  seriesSelect(
    "seri",
    "Direnç serisi",
    ["E12", "E24", "E48", "E96", "E192"],
    "E24",
    "Standart baz direnci bu seriden, güvenli yönde (alt komşu: daha çok baz akımı) seçilir.",
    BJT,
  ),
  // --- MOSFET ---
  {
    kind: "number",
    key: "Irms",
    label: "Drenaj akımının etkin (RMS) değeri",
    symbol: "I_{rms}",
    dimension: "akim",
    defaultUnit: "A",
    units: ["mA", "A"],
    default: 10,
    min: 0,
    help: "Anahtar iletimdeyken akan akımın bir periyot üzerinden RMS değeri (ör. buck üst anahtarında yaklaşık I_o·√D).",
    visibleWhen: MOSFET,
  },
  {
    kind: "number",
    key: "RDS",
    label: "İletim direnci (25 °C)",
    symbol: "R_{DS(\\mathrm{on})}",
    dimension: "direnc",
    defaultUnit: "mohm",
    units: ["mohm", "ohm"],
    default: 10,
    min: 0,
    minExclusive: true,
    help: "Veri sayfasındaki R_DS(on), kullandığınız V_GS'de.",
    visibleWhen: MOSFET,
  },
  {
    kind: "number",
    key: "kT",
    label: "R_DS(on) sıcaklık katsayısı",
    symbol: "k_T",
    dimension: "boyutsuz",
    defaultUnit: "unitless",
    default: 1.5,
    min: 0,
    minExclusive: true,
    help: "Veri sayfasındaki normalize R_DS(on)–T_j eğrisinden, beklenen jonksiyon sıcaklığında okunur (25 °C'de 1).",
    visibleWhen: MOSFET,
  },
  {
    kind: "select",
    key: "yontem",
    label: "Anahtarlama kaybı yöntemi",
    options: [
      { value: "vi", label: "Anahtarlama süreleri: ½·V·I·(t_r + t_f)·f_s" },
      { value: "enerji", label: "Anahtarlama enerjileri: (E_on + E_off)·f_s" },
    ],
    default: "vi",
    visibleWhen: MOSFET,
  },
  {
    kind: "number",
    key: "VDS",
    label: "Kesimdeki drenaj–kaynak gerilimi",
    symbol: "V_{DS}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: V_UNITS,
    default: 48,
    min: 0,
    help: "Anahtarlama anında MOSFET'in üzerindeki gerilim (ör. buck'ta giriş gerilimi).",
    visibleWhen: VI,
  },
  {
    kind: "number",
    key: "ID",
    label: "Anahtarlanan akım",
    symbol: "I_D",
    dimension: "akim",
    defaultUnit: "A",
    units: ["mA", "A"],
    default: 10,
    min: 0,
    help: "Açılma ve kapanma anındaki drenaj akımı (ör. buck'ta çıkış akımı).",
    visibleWhen: VI,
  },
  {
    kind: "number",
    key: "tr",
    label: "Yükselme süresi",
    symbol: "t_r",
    dimension: "zaman",
    defaultUnit: "ns",
    units: ["ns", "us"],
    default: 20,
    min: 0,
    visibleWhen: VI,
  },
  {
    kind: "number",
    key: "tf",
    label: "Düşme süresi",
    symbol: "t_f",
    dimension: "zaman",
    defaultUnit: "ns",
    units: ["ns", "us"],
    default: 20,
    min: 0,
    visibleWhen: VI,
  },
  {
    kind: "number",
    key: "Eon",
    label: "Açılma enerjisi",
    symbol: "E_{on}",
    dimension: "enerji",
    defaultUnit: "uJ",
    units: ["uJ", "mJ"],
    default: 6,
    min: 0,
    help: "Veri sayfasındaki E_on; test koşulu (V_DS, I_D, R_G, T_j) sizinkinden farklıysa eğrilerden okuyun.",
    visibleWhen: ENERJI,
  },
  {
    kind: "number",
    key: "Eoff",
    label: "Kapanma enerjisi",
    symbol: "E_{off}",
    dimension: "enerji",
    defaultUnit: "uJ",
    units: ["uJ", "mJ"],
    default: 4,
    min: 0,
    visibleWhen: ENERJI,
  },
  {
    kind: "number",
    key: "fs",
    label: "Anahtarlama frekansı",
    symbol: "f_s",
    dimension: "frekans",
    defaultUnit: "kHz",
    units: ["Hz", "kHz", "MHz"],
    default: 100,
    min: 0,
    minExclusive: true,
    visibleWhen: MOSFET,
  },
  {
    kind: "number",
    key: "Qg",
    label: "Toplam kapı yükü",
    symbol: "Q_g",
    dimension: "yuk",
    defaultUnit: "nC",
    units: ["nC", "uC"],
    default: 50,
    min: 0,
    help: "Veri sayfasındaki Q_g, kullandığınız V_GS'de (kapı yükü eğrisinden).",
    visibleWhen: MOSFET,
  },
  {
    kind: "number",
    key: "VGS",
    label: "Kapı sürme gerilimi",
    symbol: "V_{GS}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: V_UNITS,
    default: 10,
    min: 0,
    visibleWhen: MOSFET,
  },
];

const outputs: OutputSpec[] = [
  // BJT
  { key: "IB", label: "Gereken baz akımı", symbol: "I_B", dimension: "akim", defaultUnit: "A" },
  { key: "RB", label: "Hesaplanan baz direnci", symbol: "R_B", dimension: "direnc", defaultUnit: "ohm" },
  { key: "RBstd", label: "Seçilecek standart direnç (alt komşu)", symbol: "R_{B,\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "IBg", label: "Gerçekleşen baz akımı", symbol: "I_{B,g}", dimension: "akim", defaultUnit: "A" },
  { key: "odfG", label: "Gerçekleşen aşırı sürme katsayısı", symbol: "\\mathrm{ODF}_g", dimension: "boyutsuz", defaultUnit: "unitless" },
  { key: "betaF", label: "Zorlanmış kazanç (I_C/I_B)", symbol: "\\beta_F", dimension: "boyutsuz", defaultUnit: "unitless" },
  { key: "PRB", label: "Baz direnci gücü", symbol: "P_{R_B}", dimension: "guc", defaultUnit: "W" },
  { key: "PC", label: "Kolektör kaybı (doyumda)", symbol: "P_C", dimension: "guc", defaultUnit: "W" },
  { key: "PBE", label: "Baz–emetör kaybı", symbol: "P_{BE}", dimension: "guc", defaultUnit: "W" },
  { key: "PT", label: "Transistör toplam kaybı", symbol: "P_T", dimension: "guc", defaultUnit: "W" },
  // MOSFET
  { key: "RDSsicak", label: "Sıcaklıkta iletim direnci", symbol: "R_{DS(\\mathrm{on}),T}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Pcond", label: "İletim kaybı", symbol: "P_{\\text{iletim}}", dimension: "guc", defaultUnit: "W" },
  { key: "Esw", label: "Anahtarlama enerjisi (açılma + kapanma)", symbol: "E_{sw}", dimension: "enerji", defaultUnit: "J", units: ["uJ", "mJ", "J"] },
  { key: "Psw", label: "Anahtarlama kaybı", symbol: "P_{sw}", dimension: "guc", defaultUnit: "W" },
  { key: "Pmos", label: "MOSFET kaybı (iletim + anahtarlama; ısıl hesap için)", symbol: "P_{\\text{MOSFET}}", dimension: "guc", defaultUnit: "W" },
  { key: "Pgate", label: "Kapı sürme gücü (sürücüde harcanır)", symbol: "P_G", dimension: "guc", defaultUnit: "W" },
  { key: "Ptop", label: "Toplam kayıp (kapı sürme dahil)", symbol: "P_{\\text{top}}", dimension: "guc", defaultUnit: "W" },
];

/** Hüküm olmayan notlar (kabul, yöntem, hatırlatma) */

const q = specWriter([...inputs, ...outputs]);
const t = textWriter([...inputs, ...outputs]);

const MESSAGES = {
  vceSat: (betaF: string) =>
    `Veri sayfası V_CE(sat) değerini belirli bir I_C/I_B oranında verir (ör. P2N2222A'da I_C = 150 mA, I_B = 15 mA, yani 10). ` +
    `Bu tasarımda zorlanmış kazanç β_F = ${betaF}; veri sayfası koşulundan büyükse gerçek V_CE(sat) ve kolektör kaybı daha yüksek olabilir.`,
  vinLow: "Sürme gerilimi baz–emetör doyum geriliminden büyük olmalı; aksi halde baz akımı akmaz.",
  gate: "Kapı sürme gücü MOSFET'te değil, kapı sürücüsünde ve kapı dirençlerinde harcanır. Isıl hesapta (4.11) MOSFET kaybını kullanın.",
  vi: "Veri sayfasındaki t_r ve t_f dirençli yükte, belirli bir kapı direnciyle ölçülür; ½·V·I·(t_r + t_f)·f_s kaba bir tahmindir. Mümkünse E_on/E_off ile karşılaştırın.",
  enerji: "E_on ve E_off veri sayfasında belirli bir V_DS, I_D, R_G ve T_j'de verilir; çalışma koşulunuz farklıysa veri sayfasındaki eğrilerden okuyun.",
} as const;

function computeBjt(inp: ComputeInputs) {
  const Vin = num(inp, "Vin", WHERE);
  const VBE = num(inp, "VBE", WHERE);
  const IC = num(inp, "IC", WHERE);
  const beta = num(inp, "beta", WHERE);
  const odf = num(inp, "odf", WHERE);
  const VCEsat = num(inp, "VCEsat", WHERE);
  const seri = inp.seri as ESeriesId;

  const IB = (odf * IC) / beta;
  const RB = (Vin - VBE) / IB;
  const std = standardSafe(RB, seri, "alt");
  const RBstd = std.value;
  const IBg = (Vin - VBE) / RBstd;
  const odfG = (IBg * beta) / IC;
  const betaF = IC / IBg;
  const PRB = IBg * IBg * RBstd;
  const PC = VCEsat * IC;
  const PBE = VBE * IBg;
  const PT = PC + PBE;

  const steps: Step[] = [
    {
      label: "Gereken baz akımı",
      latex: `I_B = \\mathrm{ODF} \\cdot \\frac{I_C}{\\beta_{min}} = ${qNum(odf)} \\cdot \\frac{${q("IC", IC)}}{${qNum(beta)}} = ${q("IB", IB)}`,
    },
    {
      label: "Baz direnci",
      latex: `R_B = \\frac{V_{in} - V_{BE(\\mathrm{sat})}}{I_B} = \\frac{${q("Vin", Vin)} - ${q("VBE", VBE)}}{${q("IB", IB)}} = ${q("RB", RB)}`,
    },
    {
      label: `Standart direnç (${seri}, güvenli yön)`,
      latex: `R_{B,\\text{std}} = ${q("RBstd", RBstd)} \\quad (${standardNote(seri, std.exact, "alt")})`,
    },
    {
      label: "Gerçekleşen baz akımı",
      latex: `I_{B,g} = \\frac{V_{in} - V_{BE(\\mathrm{sat})}}{R_{B,\\text{std}}} = \\frac{${q("Vin", Vin)} - ${q("VBE", VBE)}}{${q("RBstd", RBstd)}} = ${q("IBg", IBg)}`,
    },
    {
      label: "Gerçekleşen aşırı sürme ve zorlanmış kazanç",
      latex: `\\mathrm{ODF}_g = \\frac{I_{B,g} \\cdot \\beta_{min}}{I_C} = \\frac{${q("IBg", IBg)} \\cdot ${qNum(beta)}}{${q("IC", IC)}} = ${qNum(odfG)}, \\quad \\beta_F = \\frac{I_C}{I_{B,g}} = ${qNum(betaF)}`,
    },
    {
      label: "Baz direnci gücü",
      latex: `P_{R_B} = I_{B,g}^2 \\cdot R_{B,\\text{std}} = (${q("IBg", IBg)})^2 \\cdot ${q("RBstd", RBstd)} = ${q("PRB", PRB)}`,
    },
    {
      label: "Transistör kaybı",
      latex:
        `P_T = V_{CE(\\mathrm{sat})} \\cdot I_C + V_{BE(\\mathrm{sat})} \\cdot I_{B,g} = ${q("VCEsat", VCEsat)} \\cdot ${q("IC", IC)} + ` +
        `${q("VBE", VBE)} \\cdot ${q("IBg", IBg)} = ${q("PC", PC)} + ${q("PBE", PBE)} = ${q("PT", PT)}`,
    },
  ];
  const checks: Check[] = [{ level: "bilgi", message: MESSAGES.vceSat(t("betaF", betaF)), reference: REF.p2n2222a }];
  return { outputs: { IB, RB, RBstd, IBg, odfG, betaF, PRB, PC, PBE, PT }, steps, checks };
}

function computeMosfet(inp: ComputeInputs) {
  const Irms = num(inp, "Irms", WHERE);
  const RDS = num(inp, "RDS", WHERE);
  const kT = num(inp, "kT", WHERE);
  const fs = num(inp, "fs", WHERE);
  const Qg = num(inp, "Qg", WHERE);
  const VGS = num(inp, "VGS", WHERE);
  const yontem = inp.yontem as AnahtarlamaYontemi;

  const RDSsicak = kT * RDS;
  const Pcond = Irms * Irms * RDSsicak;
  const steps: Step[] = [
    {
      label: "Sıcaklıkta iletim direnci",
      latex: `R_{DS(\\mathrm{on}),T} = k_T \\cdot R_{DS(\\mathrm{on})} = ${qNum(kT)} \\cdot ${q("RDS", RDS)} = ${q("RDSsicak", RDSsicak)}`,
    },
    {
      label: "İletim kaybı",
      latex: `P_{\\text{iletim}} = I_{rms}^2 \\cdot R_{DS(\\mathrm{on}),T} = (${q("Irms", Irms)})^2 \\cdot ${q("RDSsicak", RDSsicak)} = ${q("Pcond", Pcond)}`,
    },
  ];
  const checks: Check[] = [];

  let Esw: number;
  if (yontem === "vi") {
    const VDS = num(inp, "VDS", WHERE);
    const ID = num(inp, "ID", WHERE);
    const tr = num(inp, "tr", WHERE);
    const tf = num(inp, "tf", WHERE);
    Esw = 0.5 * VDS * ID * (tr + tf);
    steps.push({
      label: "Anahtarlama enerjisi (doğrusal yaklaşım)",
      latex: `E_{sw} = \\tfrac{1}{2} \\cdot V_{DS} \\cdot I_D \\cdot (t_r + t_f) = \\tfrac{1}{2} \\cdot ${q("VDS", VDS)} \\cdot ${q("ID", ID)} \\cdot (${q("tr", tr)} + ${q("tf", tf)}) = ${q("Esw", Esw)}`,
    });
    checks.push({ level: "bilgi", message: MESSAGES.vi, reference: REF.vishay608 });
  } else if (yontem === "enerji") {
    const Eon = num(inp, "Eon", WHERE);
    const Eoff = num(inp, "Eoff", WHERE);
    Esw = Eon + Eoff;
    steps.push({
      label: "Anahtarlama enerjisi",
      latex: `E_{sw} = E_{on} + E_{off} = ${q("Eon", Eon)} + ${q("Eoff", Eoff)} = ${q("Esw", Esw)}`,
    });
    checks.push({ level: "bilgi", message: MESSAGES.enerji, reference: REF.wolfspeed });
  } else {
    throw new Error(`${WHERE}: bilinmeyen yöntem "${String(yontem)}"`);
  }

  const Psw = Esw * fs;
  const Pmos = Pcond + Psw;
  const Pgate = Qg * VGS * fs;
  const Ptop = Pmos + Pgate;
  steps.push(
    { label: "Anahtarlama kaybı", latex: `P_{sw} = E_{sw} \\cdot f_s = ${q("Esw", Esw)} \\cdot ${q("fs", fs)} = ${q("Psw", Psw)}` },
    {
      label: "MOSFET kaybı",
      latex: `P_{\\text{MOSFET}} = P_{\\text{iletim}} + P_{sw} = ${q("Pcond", Pcond)} + ${q("Psw", Psw)} = ${q("Pmos", Pmos)}`,
    },
    { label: "Kapı sürme gücü", latex: `P_G = Q_g \\cdot V_{GS} \\cdot f_s = ${q("Qg", Qg)} \\cdot ${q("VGS", VGS)} \\cdot ${q("fs", fs)} = ${q("Pgate", Pgate)}` },
    { label: "Toplam kayıp", latex: `P_{\\text{top}} = P_{\\text{MOSFET}} + P_G = ${q("Pmos", Pmos)} + ${q("Pgate", Pgate)} = ${q("Ptop", Ptop)}` },
  );
  checks.push({ level: "bilgi", message: MESSAGES.gate, reference: REF.tiKapi });
  return { outputs: { RDSsicak, Pcond, Esw, Psw, Pmos, Pgate, Ptop }, steps, checks };
}

export const transistorBazDirenciMosfetKaybi: CalcDefinition = {
  id: "4.8",
  slug: "transistor-baz-direnci-mosfet-kaybi",
  category: "elektronik",
  title: "Transistör baz direnci, MOSFET kaybı",
  description:
    "Anahtar olarak çalışan BJT'nin baz direncini aşırı sürme katsayısıyla hesaplayıp güvenli yönde standart değere yuvarlayın; " +
    "MOSFET'in iletim, anahtarlama ve kapı sürme kayıplarını bulun.",
  formulas: [
    { label: "BJT baz akımı", latex: "I_B = \\mathrm{ODF} \\cdot \\frac{I_C}{\\beta_{min}}" },
    { label: "BJT baz direnci", latex: "R_B = \\frac{V_{in} - V_{BE(\\mathrm{sat})}}{I_B}" },
    { label: "BJT kolektör kaybı", latex: "P_C \\approx V_{CE(\\mathrm{sat})} \\cdot I_C" },
    { label: "MOSFET iletim kaybı", latex: "P_{\\text{iletim}} = I_{rms}^2 \\cdot R_{DS(\\mathrm{on})} \\cdot k_T" },
    {
      label: "MOSFET anahtarlama kaybı",
      latex: "P_{sw} = \\tfrac{1}{2} \\cdot V_{DS} \\cdot I_D \\cdot (t_r + t_f) \\cdot f_s \\quad \\text{ya da} \\quad P_{sw} = (E_{on} + E_{off}) \\cdot f_s",
    },
    { label: "Kapı sürme gücü", latex: "P_G = Q_g \\cdot V_{GS} \\cdot f_s" },
  ],
  references: [REF.rohmKayip, REF.wolfspeed, REF.tiKapi, REF.vishay608, REF.p2n2222a],
  inputs,
  outputs,
  validate: (inp) => {
    if (inp.mod !== "bjt") return [];
    const Vin = num(inp, "Vin", WHERE);
    const VBE = num(inp, "VBE", WHERE);
    return Vin > VBE ? [] : [{ level: "hata", message: MESSAGES.vinLow }];
  },
  compute: (inp) => {
    const mod = inp.mod as TransistorMod;
    if (mod === "bjt") return computeBjt(inp);
    if (mod === "mosfet") return computeMosfet(inp);
    throw new Error(`${WHERE}: bilinmeyen mod "${String(mod)}"`);
  },
};
