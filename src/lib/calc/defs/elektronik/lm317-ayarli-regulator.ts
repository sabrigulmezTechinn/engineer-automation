/**
 * KAPSAM 4.7 — LM317 / ayarlı regülatör.
 *
 * TI LM317 (SLVS044Z) denklem (2): V_o = V_ref·(1 + R₂/R₁) + I_adj·R₂. V_ref ve I_adj kullanıcı girdisidir; varsayılanları
 * veri sayfasının tipik değerleridir (1,25 V, 50 µA; ctx.limits.elektronikEntegre.lm317 ile aynı kaynak).
 * - Gerilim modu: R₁, R₂ → V_o (I_adj'sız kısım ve I_adj katkısı ayrı gösterilir).
 * - Hedef modu: R₂ = (V_o − V_ref)/(V_ref/R₁ + I_adj) — denklemin tam tersi; seçilen E serisinden en yakın standart R₂ ve
 *   onunla gerçekleşen V_o.
 * - Sabit akım kaynağı (§7.3.3, §8.3.7): OUT–ADJ arasına tek direnç, I = V_ref/R. Tasarımda R = V_ref/I_hedef; standart
 *   değer güvenli yönde (üst komşu, akım hedefi aşmaz) seçilir. ADJ akımı da yükten geçer: yük akımı I + I_adj ayrıca
 *   gösterilir. LED sürücü bu devrenin bir uygulamasıdır (yük = LED dizisi).
 * Kontroller veri sayfasına göredir: minimum yük akımı (gerilim modlarında R₁ akımı V_ref/R₁ ile), giriş–çıkış farkı (3 V
 * önerilen pay, 40 V sınır), çıkış akımı ≤ 1,5 A, V_o ≤ 37 V; kayıp P = (V_in − V_o)·I_o; isteğe bağlı T_j = T_a + P·R_θJA
 * ve T_j ≤ 125 °C. Başka bir ayarlı regülatörde V_ref/I_adj girilebilir, ama sınır kontrolleri LM317 içindir.
 */
import { LIMITS } from "@/config/sinirlar";
import type { CalcDefinition, Check, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import type { ESeriesId } from "../yardimci/e-serileri";
import { REF, eSeriInput, num, optNum, specWriters, standartDeger } from "./entegre-ortak";

export type Lm317Mod = "gerilim" | "hedef" | "akim";

const WHERE = "lm317-ayarli-regulator";
const VARSAYILAN = LIMITS.elektronikEntegre.lm317;

/** Hüküm olmayan notlar (kabul, yöntem, hatırlatma). */
const BILGI = "ok" as const; // birleştirmede "bilgi" olur

const GERILIM_MODLARI: Lm317Mod[] = ["gerilim", "hedef"];

const MESSAGES = {
  hedefVref: "Hedef çıkış gerilimi V_ref'ten büyük olmalıdır (R₂ = 0 iken V_o = V_ref; daha düşük çıkış bu devreyle alınamaz).",
  minYukR1: (ir1: string, typ: string, max: string, r1max: string) =>
    `R₁ akımı ${ir1}: yüksüz çalışmada regülatörün tek yükü budur ve veri sayfasındaki minimum yük akımının (tipik ${typ}, en çok ${max}) altındadır. Yük kesilirse çıkış gerilimi yükselebilir. Yük her zaman bu farkı çekmiyorsa R₁ ≤ V_ref / ${max} = ${r1max} seçin.`,
  minYukR1Ok: (ir1: string, max: string) =>
    `R₁ akımı ${ir1} ≥ ${max}: yüksüz çalışmada da veri sayfasındaki minimum yük akımı sağlanır.`,
  minYukAkim: (i: string, typ: string, max: string) =>
    `Ayar akımı ${i}, veri sayfasındaki minimum yük akımının (tipik ${typ}, en çok ${max}) altında: regülatör akımı ayarlayamayabilir.`,
  cikisGerilimi: (vo: string, max: string) => `Çıkış gerilimi ${vo}, veri sayfasındaki önerilen en yüksek çıkış geriliminin (${max}) üzerinde.`,
  cikisAkimi: (io: string, max: string) => `Çıkış akımı ${io}, veri sayfasındaki önerilen en yüksek çıkış akımının (${max}) üzerinde.`,
  regulasyonYok: (dv: string) =>
    `Giriş–çıkış farkı ${dv}: giriş gerilimi çıkış geriliminden yüksek değil, regülatör çalışmaz. Kayıp ve sıcaklık hesaplanmadı.`,
  payAz: (dv: string, min: string) =>
    `Giriş–çıkış farkı ${dv}, veri sayfasının önerdiği ${min} payın altında: tam akımda ve düşük sıcaklıkta regülasyon kaybolabilir (çıkış ≈ giriş − düşüm).`,
  farkFazla: (dv: string, max: string) => `Giriş–çıkış farkı ${dv}, veri sayfasındaki ${max} sınırını aşıyor.`,
  tjFazla: (tj: string, max: string) => `Jonksiyon sıcaklığı ${tj}, veri sayfasındaki ${max} sınırını aşıyor: soğutucu ekleyin, R_θJA'yı veya kaybı düşürün.`,
  tjOk: (tj: string, max: string) => `Jonksiyon sıcaklığı ${tj} ≤ ${max}.`,
  direncGucu: (p: string) => `Ayar direncinin gücü ${p}: anma gücü bundan büyük bir direnç seçin.`,
  adjAkimi: (iadj: string) => `ADJ akımı (${iadj}) de yükten geçer; yük akımı ayar akımından bu kadar büyüktür.`,
} as const;

const INPUTS: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Hesap",
    options: [
      { value: "gerilim", label: "R₁, R₂ → çıkış gerilimi" },
      { value: "hedef", label: "Hedef çıkış geriliminden R₂" },
      { value: "akim", label: "Sabit akım kaynağı (ör. LED sürücü)" },
    ],
    default: "gerilim",
  },
  {
    kind: "number",
    key: "Vref",
    label: "Referans gerilimi",
    symbol: "V_{ref}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["V"],
    default: VARSAYILAN.vRef,
    min: 0,
    minExclusive: true,
    help: "OUT ile ADJ arasındaki gerilim. TI LM317: tipik 1,25 V (tüm çalışma koşullarında 1,2–1,3 V).",
  },
  {
    kind: "number",
    key: "Iadj",
    label: "ADJ ucu akımı",
    symbol: "I_{adj}",
    dimension: "akim",
    defaultUnit: "uA",
    units: ["uA"],
    default: VARSAYILAN.iAdj * 1e6,
    min: 0,
    help: "TI LM317: tipik 50 µA, en çok 100 µA. Etkisini görmezden gelmek için 0 girin.",
  },
  {
    kind: "number",
    key: "R1",
    label: "R₁ (OUT–ADJ arası)",
    symbol: "R_1",
    dimension: "direnc",
    defaultUnit: "ohm",
    units: ["ohm", "kohm"],
    default: 240,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: GERILIM_MODLARI },
  },
  {
    kind: "number",
    key: "R2",
    label: "R₂ (ADJ–toprak arası)",
    symbol: "R_2",
    dimension: "direnc",
    defaultUnit: "ohm",
    units: ["ohm", "kohm"],
    default: 720,
    min: 0,
    help: "0 girilirse V_o = V_ref.",
    visibleWhen: { key: "mod", equals: "gerilim" },
  },
  {
    kind: "number",
    key: "VoHedef",
    label: "Hedef çıkış gerilimi",
    symbol: "V_{o,\\text{hedef}}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["V"],
    default: 5,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "hedef" },
  },
  {
    kind: "number",
    key: "Ihedef",
    label: "Hedef akım",
    symbol: "I_{\\text{hedef}}",
    dimension: "akim",
    defaultUnit: "mA",
    units: ["mA", "A"],
    default: 350,
    min: 0,
    minExclusive: true,
    visibleWhen: { key: "mod", equals: "akim" },
  },
  {
    kind: "number",
    key: "Vyuk",
    label: "Yük gerilimi (ör. LED dizisinin toplam ileri gerilimi)",
    symbol: "V_{\\text{yük}}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["V"],
    default: 6.4,
    min: 0,
    help: "Ayar direncinden sonra toprağa giden yükün gerilimi; giriş–çıkış payı ve kayıp için kullanılır.",
    visibleWhen: { key: "mod", equals: "akim" },
  },
  eSeriInput("E96", { key: "mod", equals: ["hedef", "akim"] }),
  {
    kind: "number",
    key: "Vin",
    label: "Giriş gerilimi",
    symbol: "V_{in}",
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["V"],
    default: 12,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "Io",
    label: "Yük akımı",
    symbol: "I_o",
    dimension: "akim",
    defaultUnit: "mA",
    units: ["mA", "A"],
    default: 500,
    min: 0,
    visibleWhen: { key: "mod", equals: GERILIM_MODLARI },
  },
  {
    kind: "number",
    key: "Ta",
    label: "Ortam sıcaklığı",
    symbol: "T_a",
    dimension: "sicaklik",
    defaultUnit: "degC",
    units: ["degC", "K"],
    default: 25,
    help: "Yalnızca R_θJA girilirse jonksiyon sıcaklığı için kullanılır.",
  },
  {
    kind: "number",
    key: "RthJA",
    label: "Jonksiyon–ortam ısıl direnci (isteğe bağlı)",
    symbol: "R_{\\theta JA}",
    dimension: "isil_direnc",
    defaultUnit: "degC_W",
    units: ["degC_W", "K_W"],
    min: 0,
    minExclusive: true,
    optional: true,
    help: "Kılıf ve varsa soğutucu dahil. TI veri sayfası (JEDEC test kartı) değerleri, °C/W — eski yonga: SOT-223 66,8, TO-220 (KCS) 23,5, TO-220 (KCT) 37,9, TO-263 38,0; yeni yonga: SOT-223 59,6, TO-263 41,0. Boş bırakılırsa T_j hesaplanmaz.",
  },
];

const OUTPUTS: OutputSpec[] = [
  { key: "R2h", label: "Hesaplanan R₂", symbol: "R_2", dimension: "direnc", defaultUnit: "ohm" },
  { key: "R2s", label: "Seçilen standart R₂", symbol: "R_{2,\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Rh", label: "Hesaplanan ayar direnci", symbol: "R", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Rs", label: "Seçilen standart ayar direnci (üst komşu)", symbol: "R_{\\text{std}}", dimension: "direnc", defaultUnit: "ohm" },
  { key: "Vo", label: "Çıkış (OUT ucu) gerilimi", symbol: "V_o", dimension: "gerilim", defaultUnit: "V" },
  { key: "Vo0", label: "Çıkış gerilimi (I_adj ihmal)", symbol: "V_{o,0}", dimension: "gerilim", defaultUnit: "V" },
  { key: "dVadj", label: "I_adj katkısı", symbol: "I_{adj} R_2", dimension: "gerilim", defaultUnit: "V" },
  { key: "VoSapma", label: "Hedef gerilimden sapma", symbol: "\\delta_V", dimension: "oran", defaultUnit: "percent" },
  { key: "IR1", label: "R₁ akımı", symbol: "I_{R1}", dimension: "akim", defaultUnit: "A" },
  { key: "I", label: "Ayar akımı", symbol: "I", dimension: "akim", defaultUnit: "A", significant: 5 },
  { key: "Iyuk", label: "Yük akımı (I_adj dahil)", symbol: "I_{\\text{yük}}", dimension: "akim", defaultUnit: "A", significant: 5 },
  { key: "PR", label: "Ayar direnci gücü", symbol: "P_R", dimension: "guc", defaultUnit: "W" },
  { key: "dV", label: "Giriş–çıkış farkı", symbol: "V_{in} - V_o", dimension: "gerilim", defaultUnit: "V" },
  { key: "P", label: "Regülatör kaybı", symbol: "P", dimension: "guc", defaultUnit: "W" },
  { key: "Tj", label: "Jonksiyon sıcaklığı", symbol: "T_j", dimension: "sicaklik", defaultUnit: "degC", units: ["degC", "K"] },
  { key: "Pmax", label: "İzin verilen en büyük kayıp", symbol: "P_{\\max}", dimension: "guc", defaultUnit: "W" },
];

const { q, t } = specWriters([...INPUTS, ...OUTPUTS]);

/** Ortam sıcaklığı adımda °C ile yazılır (SI kelvin); 0 °C'nin altındaki değer işlem içinde parantezlenir. */
const SIFIR_C = 273.15;
const taOperand = (Ta: number) => (Ta < SIFIR_C ? `(${q("Ta", Ta)})` : q("Ta", Ta));

export const lm317AyarliRegulator: CalcDefinition = {
  id: "4.7",
  slug: "lm317-ayarli-regulator",
  category: "elektronik",
  title: "LM317 / ayarlı regülatör",
  description:
    "LM317 ayarlı regülatörün çıkış gerilimini (I_adj dahil), hedef gerilim için standart R₂'yi ve sabit akım kaynağı (LED sürücü) direncini hesaplayın; minimum yük akımı, giriş–çıkış payı, kayıp ve jonksiyon sıcaklığını TI veri sayfasına göre denetleyin.",
  formulas: [
    { label: "Çıkış gerilimi", latex: "V_o = V_{ref} \\cdot \\left(1 + \\frac{R_2}{R_1}\\right) + I_{adj} \\cdot R_2" },
    { label: "Hedef çıkış için R₂", latex: "R_2 = \\frac{V_o - V_{ref}}{V_{ref} / R_1 + I_{adj}}" },
    { label: "Sabit akım kaynağı", latex: "I = \\frac{V_{ref}}{R}, \\quad R = \\frac{V_{ref}}{I}, \\quad P_R = \\frac{V_{ref}^2}{R}, \\quad I_{\\text{yük}} = I + I_{adj}" },
    { label: "R₁ akımı (yüksüz çalışma)", latex: "I_{R1} = \\frac{V_{ref}}{R_1} \\ge I_{\\min}" },
    { label: "Regülatör kaybı", latex: "P = (V_{in} - V_o) \\cdot I_o" },
    { label: "Jonksiyon sıcaklığı", latex: "T_j = T_a + P \\cdot R_{\\theta JA}, \\quad P_{\\max} = \\frac{T_{j,\\max} - T_a}{R_{\\theta JA}}" },
  ],
  references: [REF.lm317, REF.lm317Sinir, REF.lm317Akim, REF.lm317Isil],
  inputs: INPUTS,
  outputs: OUTPUTS,

  validate: (inputs) => {
    const checks: Check[] = [];
    if (inputs.mod === "hedef") {
      const Vref = num(inputs, "Vref", WHERE);
      const Vh = num(inputs, "VoHedef", WHERE);
      if (Vh <= Vref) checks.push({ level: "hata", message: MESSAGES.hedefVref });
    }
    return checks;
  },

  compute: (inputs, ctx) => {
    const mode = inputs.mod as Lm317Mod;
    const s = ctx.limits.elektronikEntegre.lm317;
    const Vref = num(inputs, "Vref", WHERE);
    const Iadj = num(inputs, "Iadj", WHERE);
    const Vin = num(inputs, "Vin", WHERE);
    const steps: Step[] = [];
    const checks: Check[] = [];
    const outputs: Record<string, number> = {};

    /** Regülatör çıkış (OUT) gerilimi ve kayıp hesabında kullanılan akım */
    let Vo: number;
    let Io: number;
    let vo: string;
    let io: string;

    if (mode === "gerilim" || mode === "hedef") {
      const R1 = num(inputs, "R1", WHERE);
      Io = num(inputs, "Io", WHERE);
      const IR1 = Vref / R1;
      outputs.IR1 = IR1;
      steps.push({ label: "R₁ akımı", latex: `I_{R1} = \\frac{V_{ref}}{R_1} = \\frac{${q("Vref", Vref)}}{${q("R1", R1)}} = ${q("IR1", IR1)}` });

      let R2: number;
      let r2: string;
      let qR2: (v: number) => string;
      if (mode === "hedef") {
        const Vh = num(inputs, "VoHedef", WHERE);
        const seri = inputs.seri as ESeriesId;
        const R2h = (Vh - Vref) / (Vref / R1 + Iadj);
        steps.push({
          label: "Hesaplanan R₂",
          latex: `R_2 = \\frac{V_o - V_{ref}}{V_{ref} / R_1 + I_{adj}} = \\frac{${q("VoHedef", Vh)} - ${q("Vref", Vref)}}{${q("IR1", IR1)} + ${q("Iadj", Iadj)}} = ${q("R2h", R2h)}`,
        });
        R2 = standartDeger(R2h, seri, "yakin");
        steps.push({ label: `Standart R₂ (${seri}, en yakın)`, latex: `R_{2,\\text{std}} = ${q("R2s", R2)}` });
        Object.assign(outputs, { R2h, R2s: R2 });
        r2 = "R_{2,\\text{std}}";
        qR2 = (v) => q("R2s", v);
      } else {
        R2 = num(inputs, "R2", WHERE);
        r2 = "R_2";
        qR2 = (v) => q("R2", v);
      }

      const Vo0 = Vref * (1 + R2 / R1);
      const dVadj = Iadj * R2;
      Vo = Vo0 + dVadj;
      steps.push({
        label: mode === "hedef" ? "Çıkış gerilimi (standart R₂ ile)" : "Çıkış gerilimi",
        latex: `V_o = V_{ref} \\cdot \\left(1 + \\frac{${r2}}{R_1}\\right) + I_{adj} \\cdot ${r2} = ${q("Vref", Vref)} \\cdot \\left(1 + \\frac{${qR2(R2)}}{${q("R1", R1)}}\\right) + ${q("Iadj", Iadj)} \\cdot ${qR2(R2)} = ${q("Vo0", Vo0)} + ${q("dVadj", dVadj)} = ${q("Vo", Vo)}`,
      });
      Object.assign(outputs, { Vo, Vo0, dVadj });
      if (mode === "hedef") {
        const Vh = num(inputs, "VoHedef", WHERE);
        outputs.VoSapma = (Vo - Vh) / Vh;
        steps.push({
          label: "Hedef gerilimden sapma",
          latex: `\\delta_V = \\frac{V_o - V_{o,\\text{hedef}}}{V_{o,\\text{hedef}}} = \\frac{${q("Vo", Vo)} - ${q("VoHedef", Vh)}}{${q("VoHedef", Vh)}} = ${q("VoSapma", outputs.VoSapma)}`,
        });
      }

      // Minimum yük akımı: yük kesildiğinde regülatörün tek yükü R₁–R₂ bölücüsüdür (§7.4.3).
      if (IR1 < s.minYukAkimiMax) {
        checks.push({
          level: "uyari",
          message: MESSAGES.minYukR1(t("IR1", IR1), t("IR1", s.minYukAkimiTip), t("IR1", s.minYukAkimiMax), t("R2h", Vref / s.minYukAkimiMax)),
          reference: REF.lm317Sinir,
        });
      } else {
        checks.push({ level: "ok", message: MESSAGES.minYukR1Ok(t("IR1", IR1), t("IR1", s.minYukAkimiMax)), reference: REF.lm317Sinir });
      }
      if (Vo > s.cikisGerilimiMax) {
        checks.push({ level: "uyari", message: MESSAGES.cikisGerilimi(t("Vo", Vo), t("Vo", s.cikisGerilimiMax)), reference: REF.lm317Sinir });
      }
      vo = "V_o";
      io = "I_o";
    } else if (mode === "akim") {
      const Ih = num(inputs, "Ihedef", WHERE);
      const Vyuk = num(inputs, "Vyuk", WHERE);
      const seri = inputs.seri as ESeriesId;
      const Rh = Vref / Ih;
      steps.push({ label: "Hesaplanan ayar direnci", latex: `R = \\frac{V_{ref}}{I_{\\text{hedef}}} = \\frac{${q("Vref", Vref)}}{${q("Ihedef", Ih)}} = ${q("Rh", Rh)}` });
      const Rs = standartDeger(Rh, seri, "ust");
      steps.push({ label: `Standart değer (${seri}, üst komşu: akım hedefi aşmaz)`, latex: `R_{\\text{std}} = ${q("Rs", Rs)}` });
      const I = Vref / Rs;
      const Iyuk = I + Iadj;
      const PR = (Vref * Vref) / Rs;
      steps.push({ label: "Ayar akımı (standart R ile)", latex: `I = \\frac{V_{ref}}{R_{\\text{std}}} = \\frac{${q("Vref", Vref)}}{${q("Rs", Rs)}} = ${q("I", I)}` });
      steps.push({ label: "Yük akımı (I_adj dahil)", latex: `I_{\\text{yük}} = I + I_{adj} = ${q("I", I)} + ${q("Iadj", Iadj)} = ${q("Iyuk", Iyuk)}` });
      steps.push({ label: "Ayar direnci gücü", latex: `P_R = \\frac{V_{ref}^2}{R_{\\text{std}}} = \\frac{(${q("Vref", Vref)})^2}{${q("Rs", Rs)}} = ${q("PR", PR)}` });
      Vo = Vyuk + Vref;
      steps.push({
        label: "Regülatör çıkış (OUT) gerilimi",
        latex: `V_o = V_{\\text{yük}} + V_{ref} = ${q("Vyuk", Vyuk)} + ${q("Vref", Vref)} = ${q("Vo", Vo)}`,
      });
      Object.assign(outputs, { Rh, Rs, I, Iyuk, PR, Vo });
      Io = I;
      checks.push({ level: BILGI, message: MESSAGES.direncGucu(t("PR", PR)), reference: REF.lm317Akim });
      if (Iadj > 0) checks.push({ level: BILGI, message: MESSAGES.adjAkimi(t("Iadj", Iadj)) });
      if (I < s.minYukAkimiMax) {
        checks.push({
          level: "uyari",
          message: MESSAGES.minYukAkim(t("I", I), t("I", s.minYukAkimiTip), t("I", s.minYukAkimiMax)),
          reference: REF.lm317Sinir,
        });
      }
      vo = "V_o";
      io = "I";
    } else {
      throw new Error(`${WHERE}: bilinmeyen mod "${String(mode)}"`);
    }

    if (Io > s.cikisAkimiMax) {
      checks.push({ level: "uyari", message: MESSAGES.cikisAkimi(t("I", Io), t("I", s.cikisAkimiMax)), reference: REF.lm317Sinir });
    }

    const dV = Vin - Vo;
    outputs.dV = dV;
    steps.push({ label: "Giriş–çıkış farkı", latex: `V_{in} - ${vo} = ${q("Vin", Vin)} - ${q("Vo", Vo)} = ${q("dV", dV)}` });
    if (dV <= 0) {
      checks.push({ level: "uyari", message: MESSAGES.regulasyonYok(t("dV", dV)), reference: REF.lm317Sinir });
      return { outputs, steps, checks };
    }
    if (dV < s.girisCikisFarkiMin) {
      checks.push({ level: "uyari", message: MESSAGES.payAz(t("dV", dV), t("dV", s.girisCikisFarkiMin)), reference: REF.lm317Sinir });
    } else if (dV > s.girisCikisFarkiMax) {
      checks.push({ level: "uyari", message: MESSAGES.farkFazla(t("dV", dV), t("dV", s.girisCikisFarkiMax)), reference: REF.lm317Sinir });
    }

    const P = dV * Io;
    outputs.P = P;
    const ioq = mode === "akim" ? q("I", Io) : q("Io", Io);
    steps.push({ label: "Regülatör kaybı", latex: `P = (V_{in} - ${vo}) \\cdot ${io} = ${q("dV", dV)} \\cdot ${ioq} = ${q("P", P)}` });

    const RthJA = optNum(inputs, "RthJA");
    if (RthJA !== undefined) {
      const Ta = num(inputs, "Ta", WHERE);
      const Tj = Ta + P * RthJA;
      outputs.Tj = Tj;
      steps.push({
        label: "Jonksiyon sıcaklığı",
        latex: `T_j = T_a + P \\cdot R_{\\theta JA} = ${q("Ta", Ta)} + ${q("P", P)} \\cdot ${q("RthJA", RthJA)} = ${q("Tj", Tj)}`,
      });
      const Pmax = (s.tjMax - Ta) / RthJA;
      if (Pmax > 0) {
        outputs.Pmax = Pmax;
        steps.push({
          label: "İzin verilen en büyük kayıp",
          latex: `P_{\\max} = \\frac{T_{j,\\max} - T_a}{R_{\\theta JA}} = \\frac{${q("Tj", s.tjMax)} - ${taOperand(Ta)}}{${q("RthJA", RthJA)}} = ${q("Pmax", Pmax)}`,
        });
      }
      if (Tj > s.tjMax) {
        checks.push({ level: "uyari", message: MESSAGES.tjFazla(t("Tj", Tj), t("Tj", s.tjMax)), reference: REF.lm317Isil });
      } else {
        checks.push({ level: "ok", message: MESSAGES.tjOk(t("Tj", Tj), t("Tj", s.tjMax)), reference: REF.lm317Isil });
      }
    }

    return { outputs, steps, checks };
  },
};
