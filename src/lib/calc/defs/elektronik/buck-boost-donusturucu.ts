/**
 * KAPSAM 4.9 — Buck / boost dönüştürücü güç katı (sürekli iletim kipi, CCM).
 *
 * Formüller TI uygulama notlarından (açılan belgeler ve denklem numaraları guc-ortak.ts REF'te):
 *   Buck  — TI SLVA477C https://www.ti.com/lit/an/slva477c/slva477c.pdf
 *   Boost — TI SLVA372D https://www.ti.com/lit/an/slva372d/slva372d.pdf
 *
 * Hangi giriş gerilimi nerede (uygulama notlarına göre):
 * - Buck: D, gerçekleşen dalgalanma ΔI_L ve tepe anahtar akımı V_in,maks'ta (SLVA477C Denk. 1, 2, 4: "en büyük giriş
 *   gerilimi en büyük anahtar akımını verir"). L tahmini tipik V_in'de (Denk. 5), hedef dalgalanma ΔI_L = r·I_o (Denk. 6;
 *   buck'ta ortalama bobin akımı I_o'dur). SLVA477C'nin Ek A'sındaki Denk. 15 D = V_o·η/V_in yazar; bu, gövdedeki
 *   Denk. 1 (D = V_o/(V_in·η), Rev. B'de düzeltilmiş) ile çelişir — Denk. 1 esas alındı.
 * - Boost: D, gerçekleşen dalgalanma ve tepe anahtar akımı V_in,min'de (SLVA372D Denk. 1, 2, 4). L tahmini tipik V_in'de
 *   (Denk. 5). Hedef dalgalanma BOBİN akımının yüzdesi: ΔI_L = r·I_o·V_o/V_in,tip (Denk. 6, "V_OUT/V_IN (Typical)";
 *   η içermez — ideal I_L = I_o/(1 − D), D = 1 − V_in/V_o). I_o tabanlı dalgalanma L'yi V_o/V_in kat büyük çıkarırdı.
 * - η yalnızca D'ye girer (her iki notta Denk. 1); L tahmini formülü (Denk. 5) ve dalgalanma tabanı (Denk. 6) η'sızdır.
 *   Boost'ta tepe akımdaki ortalama bobin akımı I_o/(1 − D) η'lı D ile hesaplanır (Denk. 4).
 * - Hesaplanan L ve C GÜVENLİ YÖNDE (üst komşu) standart değere yuvarlanır; gerçekleşen dalgalanma, tepe akım ve
 *   çıkış dalgalanması standart değerlerle hesaplanır. C_out buck'ta en kötü durumdaki (V_in,maks, L_std) dalgalanmayla
 *   (Denk. 12), boost'ta V_in,min'deki D ile (Denk. 12) bulunur.
 * - CCM sınırı: bobin akımının alt tepesi sıfıra indiği yük akımı. Buck: I_o,sınır = ΔI_L/2 (V_in,maks'ta en büyük).
 *   Boost: I_o,sınır = (1 − D)·ΔI_L/2; V_in'e göre en büyüğü x = V_in·η/V_o = 2/3'te olduğundan V_in,min, V_in,maks ve
 *   aralığa düşüyorsa 2·V_o/(3·η) noktalarında değerlendirilir. Yük bunun altına inerse DCM'ye geçilir.
 */
import type { CalcContext, CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import type { ESeriesId } from "@/lib/calc/defs/yardimci/e-serileri";
import { latexQty } from "@/lib/calc/latex";
import { REF, num, optNum, seriesSelect, specWriter, standardNote, standardSafe, textWriter } from "./guc-ortak";

export type Topoloji = "buck" | "boost";

const WHERE = "buck-boost-donusturucu";

const BUCK = { key: "mod", equals: "buck" } as const;
const BOOST = { key: "mod", equals: "boost" } as const;

function vInput(
  key: string,
  label: string,
  symbol: string,
  def: number,
  help: string,
  visibleWhen: typeof BUCK | typeof BOOST,
): InputSpec {
  return {
    kind: "number",
    key,
    label,
    symbol,
    dimension: "gerilim",
    defaultUnit: "V",
    units: ["mV", "V"],
    default: def,
    min: 0,
    minExclusive: true,
    help,
    visibleWhen,
  };
}

const HELP = {
  vinMinBuck: "Buck'ta en büyük görev oranı burada oluşur (D ≥ 1 ise regüle edemez).",
  vinBuck: "Bobin değeri tahmini tipik giriş geriliminde yapılır (SLVA477C Denk. 5).",
  vinMaksBuck: "Buck'ta dalgalanma ve tepe anahtar akımı en büyük giriş geriliminde hesaplanır (SLVA477C Denk. 1, 2, 4).",
  vinMinBoost: "Boost'ta görev oranı, dalgalanma ve tepe anahtar akımı en küçük giriş geriliminde hesaplanır (SLVA372D Denk. 1, 2, 4).",
  vinBoost: "Bobin değeri ve dalgalanma tahmini tipik giriş geriliminde yapılır (SLVA372D Denk. 5, 6).",
  vinMaksBoost: "Boost çıkışı en büyük giriş geriliminden büyük olmalıdır.",
} as const;

const inputs: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Topoloji",
    options: [
      { value: "buck", label: "Buck (düşürücü)" },
      { value: "boost", label: "Boost (yükseltici)" },
    ],
    default: "buck",
  },
  vInput("buckVinMin", "En küçük giriş gerilimi", "V_{in,min}", 10.8, HELP.vinMinBuck, BUCK),
  vInput("buckVin", "Tipik giriş gerilimi", "V_{in}", 12, HELP.vinBuck, BUCK),
  vInput("buckVinMaks", "En büyük giriş gerilimi", "V_{in,maks}", 13.2, HELP.vinMaksBuck, BUCK),
  vInput("buckVo", "Çıkış gerilimi", "V_o", 5, "Buck çıkışı girişten küçüktür.", BUCK),
  vInput("boostVinMin", "En küçük giriş gerilimi", "V_{in,min}", 4.5, HELP.vinMinBoost, BOOST),
  vInput("boostVin", "Tipik giriş gerilimi", "V_{in}", 5, HELP.vinBoost, BOOST),
  vInput("boostVinMaks", "En büyük giriş gerilimi", "V_{in,maks}", 5.5, HELP.vinMaksBoost, BOOST),
  vInput("boostVo", "Çıkış gerilimi", "V_o", 12, "Boost çıkışı girişten büyüktür.", BOOST),
  {
    kind: "number",
    key: "Io",
    label: "En büyük çıkış akımı",
    symbol: "I_{o}",
    dimension: "akim",
    defaultUnit: "A",
    units: ["mA", "A"],
    default: 1,
    min: 0,
    minExclusive: true,
  },
  {
    kind: "number",
    key: "fs",
    label: "Anahtarlama frekansı (en küçük)",
    symbol: "f_s",
    dimension: "frekans",
    defaultUnit: "kHz",
    units: ["kHz", "MHz"],
    default: 500,
    min: 0,
    minExclusive: true,
    help: "Uygulama notları denetleyicinin en küçük anahtarlama frekansını kullanır.",
  },
  {
    kind: "number",
    key: "eta",
    label: "Verim (tahmini)",
    symbol: "\\eta",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    default: 90,
    min: 0,
    minExclusive: true,
    max: 1,
    help:
      "Görev oranına girer. TI en kötü durum için buck'ta ör. %90, boost'ta ör. %80 önerir; " +
      "ya da denetleyici veri sayfasının verim eğrisini kullanın.",
  },
  {
    kind: "number",
    key: "r",
    label: "Bobin dalgalanma oranı",
    symbol: "r",
    dimension: "oran",
    defaultUnit: "percent",
    units: ["percent", "fraction"],
    default: 30,
    min: 0,
    minExclusive: true,
    max: 2,
    help:
      "Tepeden tepeye dalgalanmanın ortalama bobin akımına oranı (buck'ta I_o, boost'ta I_o·V_o/V_in). " +
      "Uygulama notları %20–%40 önerir.",
  },
  {
    kind: "number",
    key: "dVo",
    label: "İzin verilen çıkış dalgalanması (tepeden tepeye)",
    symbol: "\\Delta V_o",
    dimension: "gerilim",
    defaultUnit: "mV",
    units: ["mV", "V"],
    default: 20,
    min: 0,
    minExclusive: true,
    help: "Kapasitif dalgalanma; kondansatör ESR'sinin ekleyeceği dalgalanma dahil değildir.",
  },
  seriesSelect(
    "seri",
    "Bobin ve kondansatör serisi",
    ["E6", "E12", "E24"],
    "E6",
    "Hesaplanan L ve C bu seriden, güvenli yönde (üst komşu) standart değere yuvarlanır.",
  ),
  {
    kind: "number",
    key: "ILIM",
    label: "Anahtar akım sınırı (en küçük, isteğe bağlı)",
    symbol: "I_{LIM(min)}",
    dimension: "akim",
    defaultUnit: "A",
    units: ["mA", "A"],
    min: 0,
    minExclusive: true,
    optional: true,
    help: "Tümleşik anahtarlı denetleyicinin veri sayfasındaki en küçük akım sınırı. Girilirse verebileceği en büyük çıkış akımı hesaplanır.",
  },
];

const outputs: OutputSpec[] = [
  { key: "Dvmin", label: "Görev oranı (V_in,min'de)", symbol: "D_{V_{in,min}}", dimension: "oran", defaultUnit: "percent" },
  { key: "Dvmaks", label: "Görev oranı (V_in,maks'ta)", symbol: "D_{V_{in,maks}}", dimension: "oran", defaultUnit: "percent" },
  { key: "IL", label: "Ortalama bobin akımı (dalgalanma tabanı, tipik V_in)", symbol: "I_L", dimension: "akim", defaultUnit: "A" },
  { key: "dIh", label: "Hedef bobin dalgalanması", symbol: "\\Delta I_{L,h}", dimension: "akim", defaultUnit: "A" },
  { key: "L", label: "Hesaplanan bobin değeri", symbol: "L", dimension: "enduktans", defaultUnit: "H", significant: 5 },
  { key: "Lstd", label: "Seçilecek standart bobin (üst komşu)", symbol: "L_{\\text{std}}", dimension: "enduktans", defaultUnit: "H" },
  { key: "dIL", label: "Gerçekleşen bobin dalgalanması (en kötü V_in, L_std)", symbol: "\\Delta I_L", dimension: "akim", defaultUnit: "A" },
  { key: "ILmaks", label: "Ortalama bobin akımı (V_in,min'de)", symbol: "I_{L,maks}", dimension: "akim", defaultUnit: "A" },
  { key: "ISW", label: "Tepe anahtar (ve bobin) akımı", symbol: "I_{SW(maks)}", dimension: "akim", defaultUnit: "A" },
  { key: "Cmin", label: "En küçük çıkış kapasitesi", symbol: "C_{o,min}", dimension: "kapasitans", defaultUnit: "F" },
  { key: "Cstd", label: "Seçilecek standart kondansatör (üst komşu)", symbol: "C_{o,\\text{std}}", dimension: "kapasitans", defaultUnit: "F" },
  { key: "dVoG", label: "Gerçekleşen çıkış dalgalanması (C_std)", symbol: "\\Delta V_{o,g}", dimension: "gerilim", defaultUnit: "V" },
  { key: "IoSinir", label: "CCM sınır yük akımı (altında DCM)", symbol: "I_{o,\\text{sınır}}", dimension: "akim", defaultUnit: "A" },
  { key: "Imaxout", label: "Denetleyicinin verebileceği en büyük çıkış akımı", symbol: "I_{MAXOUT}", dimension: "akim", defaultUnit: "A" },
];

/** Hüküm olmayan notlar (kabul, yöntem, hatırlatma) */
const BILGI = "ok" as const; // birleştirmede "bilgi" olur

const q = specWriter([...inputs, ...outputs]);
const t = textWriter([...inputs, ...outputs]);
const pct = (x: number) => latexQty(x, "percent");

interface Gerilimler {
  min: number;
  tip: number;
  maks: number;
  o: number;
  keys: { min: string; tip: string; maks: string; o: string };
}

function gerilimler(inp: ComputeInputs, mode: Topoloji): Gerilimler {
  const keys =
    mode === "buck"
      ? { min: "buckVinMin", tip: "buckVin", maks: "buckVinMaks", o: "buckVo" }
      : { min: "boostVinMin", tip: "boostVin", maks: "boostVinMaks", o: "boostVo" };
  return {
    min: num(inp, keys.min, WHERE),
    tip: num(inp, keys.tip, WHERE),
    maks: num(inp, keys.maks, WHERE),
    o: num(inp, keys.o, WHERE),
    keys,
  };
}

function topoloji(inp: ComputeInputs): Topoloji {
  const mode = inp.mod;
  if (mode !== "buck" && mode !== "boost") throw new Error(`${WHERE}: bilinmeyen topoloji "${String(mode)}"`);
  return mode;
}

const MESSAGES = {
  order: "Giriş gerilimleri V_in,min ≤ V_in (tipik) ≤ V_in,maks sırasında olmalı.",
  buckD: (d: string) =>
    `Buck en küçük giriş geriliminde regüle edemez: verimle birlikte D = V_o/(V_in,min·η) = ${d} ≥ %100. ` +
    "Çıkış gerilimini düşürün, en küçük giriş gerilimini yükseltin ya da topolojiyi değiştirin.",
  boostV: "Boost çıkış gerilimi en büyük giriş geriliminden büyük olmalı (boost gerilimi düşüremez).",
  ripple: (r: string, min: string, max: string) =>
    `Dalgalanma oranı ${r}; uygulama notlarının önerdiği aralık ${min}–${max}. Küçük oran büyük bobin, büyük oran yüksek tepe akım ve çıkış dalgalanması demektir.`,
  dcm: (io: string, sinir: string) =>
    `Tam yükte bile sürekli iletim yok: I_o = ${io} ≤ I_o,sınır = ${sinir}. Dönüştürücü DCM'de çalışır; bu hesaptaki CCM formülleri geçerli değildir. Bobini büyütün ya da frekansı artırın.`,
  ccm: (sinir: string) =>
    `Yük akımı ${sinir} altına indiğinde dönüştürücü kesintili iletime (DCM) geçer; o bölgede CCM formülleri geçerli değildir.`,
  ilimLow: (imax: string, io: string) =>
    `Denetleyici bu bobinle en çok ${imax} verebilir; istenen ${io}. Daha yüksek akım sınırlı bir denetleyici seçin ya da dalgalanmayı azaltın (daha büyük L, daha yüksek f_s).`,
  ilimOk: (imax: string) => `Denetleyicinin bu bobinle verebileceği en büyük çıkış akımı ${imax}; istenen akımı karşılıyor.`,
  ceramic:
    "Seramik çıkış kondansatöründe X5R ya da daha iyi dielektrik kullanın: DC öngerilim ve sıcaklıkla kapasite belirgin düşer; " +
    "anma değeri değil, çalışma gerilimindeki etkin kapasite C_o,min'i karşılamalı.",
} as const;

function validate(inp: ComputeInputs): Check[] {
  const mode = topoloji(inp);
  const v = gerilimler(inp, mode);
  const eta = num(inp, "eta", WHERE);
  const checks: Check[] = [];
  if (!(v.min <= v.tip && v.tip <= v.maks)) checks.push({ level: "hata", message: MESSAGES.order });
  if (mode === "buck") {
    const D = v.o / (v.min * eta);
    if (D >= 1) checks.push({ level: "hata", message: MESSAGES.buckD(t("Dvmin", D)), reference: REF.tiBuck });
  } else if (v.o <= v.maks) {
    checks.push({ level: "hata", message: MESSAGES.boostV, reference: REF.tiBoost });
  }
  return checks;
}

function compute(inp: ComputeInputs, ctx: CalcContext) {
  const mode = topoloji(inp);
  const v = gerilimler(inp, mode);
  const k = v.keys;
  const Io = num(inp, "Io", WHERE);
  const fs = num(inp, "fs", WHERE);
  const eta = num(inp, "eta", WHERE);
  const r = num(inp, "r", WHERE);
  const dVo = num(inp, "dVo", WHERE);
  const seri = inp.seri as ESeriesId;
  const ILIM = optNum(inp, "ILIM");
  const ref = mode === "buck" ? REF.tiBuck : REF.tiBoost;

  const steps: Step[] = [];
  const checks: Check[] = [];
  const out: Record<string, number> = {};

  // 1) Görev oranları (Denk. 1)
  let Dvmin: number;
  let Dvmaks: number;
  if (mode === "buck") {
    Dvmin = v.o / (v.min * eta);
    Dvmaks = v.o / (v.maks * eta);
    steps.push({
      label: "Görev oranı, V_in,maks'ta (dalgalanma ve tepe akım için; SLVA477C Denk. 1)",
      latex: `D = \\frac{V_o}{V_{in,maks} \\cdot \\eta} = \\frac{${q(k.o, v.o)}}{${q(k.maks, v.maks)} \\cdot ${pct(eta)}} = ${pct(Dvmaks)}`,
    });
    steps.push({
      label: "Görev oranı, V_in,min'de (en büyük D)",
      latex: `D_{maks} = \\frac{V_o}{V_{in,min} \\cdot \\eta} = \\frac{${q(k.o, v.o)}}{${q(k.min, v.min)} \\cdot ${pct(eta)}} = ${pct(Dvmin)}`,
    });
  } else {
    Dvmin = 1 - (v.min * eta) / v.o;
    Dvmaks = 1 - (v.maks * eta) / v.o;
    steps.push({
      label: "Görev oranı, V_in,min'de (dalgalanma, tepe akım ve C_o için; SLVA372D Denk. 1)",
      latex: `D = 1 - \\frac{V_{in,min} \\cdot \\eta}{V_o} = 1 - \\frac{${q(k.min, v.min)} \\cdot ${pct(eta)}}{${q(k.o, v.o)}} = ${pct(Dvmin)}`,
    });
    steps.push({
      label: "Görev oranı, V_in,maks'ta (en küçük D)",
      latex: `D_{min} = 1 - \\frac{V_{in,maks} \\cdot \\eta}{V_o} = 1 - \\frac{${q(k.maks, v.maks)} \\cdot ${pct(eta)}}{${q(k.o, v.o)}} = ${pct(Dvmaks)}`,
    });
  }
  Object.assign(out, { Dvmin, Dvmaks });

  // 2) Hedef dalgalanma ve bobin (Denk. 5, 6) — tipik V_in'de, η'sız
  let IL: number;
  let L: number;
  if (mode === "buck") {
    IL = Io;
    steps.push({ label: "Ortalama bobin akımı (buck)", latex: `I_L = I_o = ${q("IL", IL)}` });
  } else {
    IL = (Io * v.o) / v.tip;
    steps.push({
      label: "Ortalama bobin akımı, tipik V_in'de (dalgalanma tabanı; SLVA372D Denk. 6)",
      latex: `I_L = \\frac{I_o}{1 - D_{tip}} = I_o \\cdot \\frac{V_o}{V_{in}} = ${q("Io", Io)} \\cdot \\frac{${q(k.o, v.o)}}{${q(k.tip, v.tip)}} = ${q("IL", IL)}`,
    });
  }
  const dIh = r * IL;
  steps.push({
    label: "Hedef bobin dalgalanması (Denk. 6)",
    latex: `\\Delta I_{L,h} = r \\cdot I_L = ${pct(r)} \\cdot ${q("IL", IL)} = ${q("dIh", dIh)}`,
  });
  if (mode === "buck") {
    L = (v.o * (v.tip - v.o)) / (dIh * fs * v.tip);
    steps.push({
      label: "Bobin değeri, tipik V_in'de (SLVA477C Denk. 5)",
      latex:
        `L = \\frac{V_o \\cdot (V_{in} - V_o)}{\\Delta I_{L,h} \\cdot f_s \\cdot V_{in}} = ` +
        `\\frac{${q(k.o, v.o)} \\cdot (${q(k.tip, v.tip)} - ${q(k.o, v.o)})}{${q("dIh", dIh)} \\cdot ${q("fs", fs)} \\cdot ${q(k.tip, v.tip)}} = ${q("L", L)}`,
    });
  } else {
    L = (v.tip * (v.o - v.tip)) / (dIh * fs * v.o);
    steps.push({
      label: "Bobin değeri, tipik V_in'de (SLVA372D Denk. 5)",
      latex:
        `L = \\frac{V_{in} \\cdot (V_o - V_{in})}{\\Delta I_{L,h} \\cdot f_s \\cdot V_o} = ` +
        `\\frac{${q(k.tip, v.tip)} \\cdot (${q(k.o, v.o)} - ${q(k.tip, v.tip)})}{${q("dIh", dIh)} \\cdot ${q("fs", fs)} \\cdot ${q(k.o, v.o)}} = ${q("L", L)}`,
    });
  }
  const lStd = standardSafe(L, seri, "ust");
  const Lstd = lStd.value;
  steps.push({ label: `Standart bobin (${seri}, güvenli yön)`, latex: `L_{\\text{std}} = ${q("Lstd", Lstd)} \\quad (${standardNote(seri, lStd.exact, "ust")})` });
  Object.assign(out, { IL, dIh, L, Lstd });

  // 3) Gerçekleşen dalgalanma ve tepe akım (Denk. 2, 4) — en kötü V_in, L_std
  let dIL: number;
  let ISW: number;
  let Cmin: number;
  let IoSinir: number;
  let Imaxout: number | undefined;
  if (mode === "buck") {
    dIL = ((v.maks - v.o) * Dvmaks) / (fs * Lstd);
    ISW = dIL / 2 + Io;
    steps.push({
      label: "Gerçekleşen dalgalanma, V_in,maks'ta (SLVA477C Denk. 2)",
      latex:
        `\\Delta I_L = \\frac{(V_{in,maks} - V_o) \\cdot D}{f_s \\cdot L_{\\text{std}}} = ` +
        `\\frac{(${q(k.maks, v.maks)} - ${q(k.o, v.o)}) \\cdot ${pct(Dvmaks)}}{${q("fs", fs)} \\cdot ${q("Lstd", Lstd)}} = ${q("dIL", dIL)}`,
    });
    steps.push({
      label: "Tepe anahtar akımı (SLVA477C Denk. 4)",
      latex: `I_{SW(maks)} = \\frac{\\Delta I_L}{2} + I_o = \\frac{${q("dIL", dIL)}}{2} + ${q("Io", Io)} = ${q("ISW", ISW)}`,
    });
    Cmin = dIL / (8 * fs * dVo);
    steps.push({
      label: "En küçük çıkış kapasitesi (SLVA477C Denk. 12)",
      latex: `C_{o,min} = \\frac{\\Delta I_L}{8 \\cdot f_s \\cdot \\Delta V_o} = \\frac{${q("dIL", dIL)}}{8 \\cdot ${q("fs", fs)} \\cdot ${q("dVo", dVo)}} = ${q("Cmin", Cmin)}`,
    });
    IoSinir = dIL / 2;
    steps.push({
      label: "CCM sınır yük akımı (V_in,maks'ta en büyük)",
      latex: `I_{o,\\text{sınır}} = \\frac{\\Delta I_L}{2} = \\frac{${q("dIL", dIL)}}{2} = ${q("IoSinir", IoSinir)}`,
    });
    if (ILIM !== undefined) {
      Imaxout = ILIM - dIL / 2;
      steps.push({
        label: "Denetleyicinin verebileceği en büyük çıkış akımı (SLVA477C Denk. 3)",
        latex: `I_{MAXOUT} = I_{LIM(min)} - \\frac{\\Delta I_L}{2} = ${q("ILIM", ILIM)} - \\frac{${q("dIL", dIL)}}{2} = ${q("Imaxout", Imaxout)}`,
      });
    }
  } else {
    dIL = (v.min * Dvmin) / (fs * Lstd);
    const ILmaks = Io / (1 - Dvmin);
    ISW = dIL / 2 + ILmaks;
    steps.push({
      label: "Gerçekleşen dalgalanma, V_in,min'de (SLVA372D Denk. 2)",
      latex: `\\Delta I_L = \\frac{V_{in,min} \\cdot D}{f_s \\cdot L_{\\text{std}}} = \\frac{${q(k.min, v.min)} \\cdot ${pct(Dvmin)}}{${q("fs", fs)} \\cdot ${q("Lstd", Lstd)}} = ${q("dIL", dIL)}`,
    });
    steps.push({
      label: "Ortalama bobin akımı, V_in,min'de",
      latex: `I_{L,maks} = \\frac{I_o}{1 - D} = \\frac{${q("Io", Io)}}{1 - ${pct(Dvmin)}} = ${q("ILmaks", ILmaks)}`,
    });
    steps.push({
      label: "Tepe anahtar akımı (SLVA372D Denk. 4)",
      latex: `I_{SW(maks)} = \\frac{\\Delta I_L}{2} + \\frac{I_o}{1 - D} = \\frac{${q("dIL", dIL)}}{2} + ${q("ILmaks", ILmaks)} = ${q("ISW", ISW)}`,
    });
    Cmin = (Io * Dvmin) / (fs * dVo);
    steps.push({
      label: "En küçük çıkış kapasitesi (SLVA372D Denk. 12)",
      latex: `C_{o,min} = \\frac{I_o \\cdot D}{f_s \\cdot \\Delta V_o} = \\frac{${q("Io", Io)} \\cdot ${pct(Dvmin)}}{${q("fs", fs)} \\cdot ${q("dVo", dVo)}} = ${q("Cmin", Cmin)}`,
    });
    // CCM sınırı: I_o,B(V) = (1 − D(V))·ΔI_L(V)/2, D(V) = 1 − V·η/V_o, ΔI_L(V) = V·D(V)/(f_s·L_std)
    const boundary = (V: number) => {
      const D = 1 - (V * eta) / v.o;
      return ((1 - D) * ((V * D) / (fs * Lstd))) / 2;
    };
    const peak = (2 * v.o) / (3 * eta);
    const candidates = [v.min, v.maks, Math.min(Math.max(peak, v.min), v.maks)];
    let Vb = v.min;
    for (const V of candidates) if (boundary(V) > boundary(Vb)) Vb = V;
    IoSinir = boundary(Vb);
    const Db = 1 - (Vb * eta) / v.o;
    const dILb = (Vb * Db) / (fs * Lstd);
    const VbText = latexQty(Vb, "V");
    steps.push({
      label: "CCM sınır yük akımı (V_in aralığındaki en büyük değer)",
      latex:
        `I_{o,\\text{sınır}} = \\frac{(1 - D) \\cdot \\Delta I_L}{2}, \\quad \\Delta I_L = \\frac{V_{in} \\cdot D}{f_s \\cdot L_{\\text{std}}}; \\quad ` +
        `V_{in} = ${VbText}: \\; D = ${pct(Db)}, \\; \\Delta I_L = \\frac{${VbText} \\cdot ${pct(Db)}}{${q("fs", fs)} \\cdot ${q("Lstd", Lstd)}} = ${q("dIL", dILb)}, \\; ` +
        `I_{o,\\text{sınır}} = \\frac{(1 - ${pct(Db)}) \\cdot ${q("dIL", dILb)}}{2} = ${q("IoSinir", IoSinir)}`,
    });
    if (ILIM !== undefined) {
      Imaxout = (ILIM - dIL / 2) * (1 - Dvmin);
      steps.push({
        label: "Denetleyicinin verebileceği en büyük çıkış akımı (SLVA372D Denk. 3)",
        latex: `I_{MAXOUT} = \\left(I_{LIM(min)} - \\frac{\\Delta I_L}{2}\\right) \\cdot (1 - D) = \\left(${q("ILIM", ILIM)} - \\frac{${q("dIL", dIL)}}{2}\\right) \\cdot (1 - ${pct(Dvmin)}) = ${q("Imaxout", Imaxout)}`,
      });
    }
    out.ILmaks = ILmaks;
  }

  const cStd = standardSafe(Cmin, seri, "ust");
  const Cstd = cStd.value;
  const dVoG = (Cmin / Cstd) * dVo;
  steps.push({ label: `Standart kondansatör (${seri}, güvenli yön)`, latex: `C_{o,\\text{std}} = ${q("Cstd", Cstd)} \\quad (${standardNote(seri, cStd.exact, "ust")})` });
  steps.push({
    label: "Gerçekleşen çıkış dalgalanması",
    latex: `\\Delta V_{o,g} = \\Delta V_o \\cdot \\frac{C_{o,min}}{C_{o,\\text{std}}} = ${q("dVo", dVo)} \\cdot \\frac{${q("Cmin", Cmin)}}{${q("Cstd", Cstd)}} = ${q("dVoG", dVoG)}`,
  });
  Object.assign(out, { dIL, ISW, Cmin, Cstd, dVoG, IoSinir });
  if (Imaxout !== undefined) out.Imaxout = Imaxout;

  // Kontroller
  const oneri = ctx.limits.elektronikGuc.dalgalanmaOrani;
  if (r < oneri.min || r > oneri.max) {
    checks.push({
      level: "uyari",
      message: MESSAGES.ripple(t("r", r), t("r", oneri.min), t("r", oneri.max)),
      reference: { ...ref, clause: "Denk. (6)" },
    });
  }
  if (Io <= IoSinir) {
    checks.push({ level: "uyari", message: MESSAGES.dcm(t("Io", Io), t("IoSinir", IoSinir)), reference: ref });
  } else {
    checks.push({ level: BILGI, message: MESSAGES.ccm(t("IoSinir", IoSinir)) });
  }
  if (Imaxout !== undefined) {
    if (Imaxout < Io) {
      checks.push({ level: "uyari", message: MESSAGES.ilimLow(t("Imaxout", Imaxout), t("Io", Io)), reference: { ...ref, clause: "Denk. (3)" } });
    } else {
      checks.push({ level: "ok", message: MESSAGES.ilimOk(t("Imaxout", Imaxout)) });
    }
  }
  checks.push({ level: BILGI, message: MESSAGES.ceramic, reference: { ...ref, clause: "Bölüm 6–7" } });

  return { outputs: out, steps, checks };
}

export const buckBoostDonusturucu: CalcDefinition = {
  id: "4.9",
  slug: "buck-boost-donusturucu",
  category: "elektronik",
  title: "Buck / boost dönüştürücü",
  description:
    "Buck ve boost dönüştürücünün görev oranını, bobin ve çıkış kondansatörü değerlerini (standart değerleriyle), " +
    "tepe anahtar akımını ve sürekli iletim (CCM) sınırını giriş gerilimi aralığı ve verimle hesaplayın.",
  formulas: [
    { label: "Buck görev oranı", latex: "D = \\frac{V_o}{V_{in,maks} \\cdot \\eta}" },
    { label: "Buck bobini", latex: "L = \\frac{V_o \\cdot (V_{in} - V_o)}{\\Delta I_L \\cdot f_s \\cdot V_{in}}, \\quad \\Delta I_L = r \\cdot I_o" },
    { label: "Buck tepe akım ve çıkış kondansatörü", latex: "I_{SW(maks)} = \\frac{\\Delta I_L}{2} + I_o, \\quad C_{o,min} = \\frac{\\Delta I_L}{8 \\cdot f_s \\cdot \\Delta V_o}" },
    { label: "Boost görev oranı", latex: "D = 1 - \\frac{V_{in,min} \\cdot \\eta}{V_o}" },
    {
      label: "Boost bobini",
      latex: "L = \\frac{V_{in} \\cdot (V_o - V_{in})}{\\Delta I_L \\cdot f_s \\cdot V_o}, \\quad \\Delta I_L = r \\cdot I_o \\cdot \\frac{V_o}{V_{in}}",
    },
    {
      label: "Boost tepe akım ve çıkış kondansatörü",
      latex: "I_{SW(maks)} = \\frac{\\Delta I_L}{2} + \\frac{I_o}{1 - D}, \\quad C_{o,min} = \\frac{I_o \\cdot D}{f_s \\cdot \\Delta V_o}",
    },
    { label: "Gerçekleşen dalgalanma", latex: "\\Delta I_{L,\\text{buck}} = \\frac{(V_{in,maks} - V_o) \\cdot D}{f_s \\cdot L}, \\quad \\Delta I_{L,\\text{boost}} = \\frac{V_{in,min} \\cdot D}{f_s \\cdot L}" },
  ],
  references: [REF.tiBuck, REF.tiBoost],
  inputs,
  outputs,
  validate,
  compute,
};
