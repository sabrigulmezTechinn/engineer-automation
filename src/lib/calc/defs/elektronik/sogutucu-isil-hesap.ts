/**
 * KAPSAM 4.11 — Soğutucu / ısıl hesap.
 *
 * Seri ısıl direnç modeli (TI SPRA953D Denk. 5): T_j = T_a + P·(R_θjc + R_θcs + R_θsa).
 * Modlar:
 * - "tj":   verilen soğutucuyla jonksiyon, kılıf ve soğutucu sıcaklıkları; T_j,maks'a göre pay.
 * - "rsa":  gereken soğutucu: R_θsa = (T_j,maks − T_a)/P − R_θjc − R_θcs.
 *           Sonuç ≤ 0 ise hiçbir soğutucu yetmez: R_θsa çıktısı VERİLMEZ (negatif sayı gösterilmez); bunun yerine uyarı ve
 *           ideal (R_θsa = 0) soğutucuyla izin verilen en büyük güç ile o güçteki T_j verilir.
 * - "pmax": verilen soğutucuyla izin verilen en büyük güç P_maks = (T_j,maks − T_a)/(R_θjc + R_θcs + R_θsa).
 * İsteğe bağlı R_θJA ile soğutucusuz durum karşılaştırılır (SPRA953D Denk. 1; R_θJA test kartına bağlı olduğundan yaklaşık).
 *
 * SI: sıcaklıklar K, sıcaklık farkları K, ısıl direnç K/W. Seri model ısının kart üzerinden akan kısmını yok sayar; tutucudur.
 */
import type { CalcDefinition, Check, ComputeInputs, InputSpec, OutputSpec, Step } from "@/lib/calc/types";
import { REF, num, optNum, specWriter, textWriter } from "./guc-ortak";

export type IsilMod = "tj" | "rsa" | "pmax";

const WHERE = "sogutucu-isil-hesap";

const TEMP_UNITS = ["degC", "K", "degF"];
const RTH_UNITS = ["K_W", "degC_W"];

const inputs: InputSpec[] = [
  {
    kind: "select",
    key: "mod",
    label: "Hesap",
    options: [
      { value: "tj", label: "Verilen soğutucuyla jonksiyon sıcaklığı" },
      { value: "rsa", label: "Gereken soğutucu ısıl direnci" },
      { value: "pmax", label: "Verilen soğutucuyla izin verilen en büyük güç" },
    ],
    default: "rsa",
  },
  {
    kind: "number",
    key: "P",
    label: "Harcanan güç",
    symbol: "P",
    dimension: "guc",
    defaultUnit: "W",
    units: ["mW", "W"],
    default: 10,
    min: 0,
    minExclusive: true,
    help: "Elemanda ısıya dönüşen güç (ör. MOSFET'te iletim + anahtarlama kaybı; 4.8).",
    visibleWhen: { key: "mod", equals: ["tj", "rsa"] },
  },
  {
    kind: "number",
    key: "Ta",
    label: "Ortam sıcaklığı",
    symbol: "T_a",
    dimension: "sicaklik",
    defaultUnit: "degC",
    units: TEMP_UNITS,
    default: 40,
    help: "Soğutucunun R_θsa değerinin tanımlandığı ortam sıcaklığı (kutu içi sıcaklık).",
  },
  {
    kind: "number",
    key: "Tjmax",
    label: "En büyük jonksiyon sıcaklığı",
    symbol: "T_{j,maks}",
    dimension: "sicaklik",
    defaultUnit: "degC",
    units: TEMP_UNITS,
    default: 125,
    help: "Veri sayfasındaki T_j(max) ya da tasarım payı bırakılmış daha düşük bir değer.",
  },
  {
    kind: "number",
    key: "Rjc",
    label: "Jonksiyon–kılıf ısıl direnci",
    symbol: "R_{\\theta jc}",
    dimension: "isil_direnc",
    defaultUnit: "K_W",
    units: RTH_UNITS,
    default: 1.5,
    min: 0,
    help: "Veri sayfasındaki R_θJC (soğutucunun bağlandığı yüzey için).",
  },
  {
    kind: "number",
    key: "Rcs",
    label: "Kılıf–soğutucu ısıl direnci (arayüz)",
    symbol: "R_{\\theta cs}",
    dimension: "isil_direnc",
    defaultUnit: "K_W",
    units: RTH_UNITS,
    default: 0.5,
    min: 0,
    help: "Termal macun, ped veya yalıtkan pulun ısıl direnci (malzeme veri sayfasından).",
  },
  {
    kind: "number",
    key: "Rsa",
    label: "Soğutucu–ortam ısıl direnci",
    symbol: "R_{\\theta sa}",
    dimension: "isil_direnc",
    defaultUnit: "K_W",
    units: RTH_UNITS,
    default: 4,
    min: 0,
    help: "Soğutucu veri sayfasındaki R_θsa (doğal ya da zorlanmış hava koşuluna dikkat).",
    visibleWhen: { key: "mod", equals: ["tj", "pmax"] },
  },
  {
    kind: "number",
    key: "Rja",
    label: "Jonksiyon–ortam ısıl direnci (soğutucusuz, isteğe bağlı)",
    symbol: "R_{\\theta JA}",
    dimension: "isil_direnc",
    defaultUnit: "K_W",
    units: RTH_UNITS,
    min: 0,
    minExclusive: true,
    optional: true,
    help: "Girilirse soğutucusuz durumla karşılaştırılır. Veri sayfası değeri standart bir test kartında ölçülür; kendi kartınızda farklıdır.",
  },
];

const outputs: OutputSpec[] = [
  { key: "Rtop", label: "Toplam ısıl direnç", symbol: "R_{\\theta ja}", dimension: "isil_direnc", defaultUnit: "K_W", units: RTH_UNITS },
  { key: "Tj", label: "Jonksiyon sıcaklığı", symbol: "T_j", dimension: "sicaklik", defaultUnit: "degC", units: TEMP_UNITS },
  { key: "Tc", label: "Kılıf sıcaklığı", symbol: "T_c", dimension: "sicaklik", defaultUnit: "degC", units: TEMP_UNITS },
  { key: "Ts", label: "Soğutucu sıcaklığı", symbol: "T_s", dimension: "sicaklik", defaultUnit: "degC", units: TEMP_UNITS },
  { key: "pay", label: "T_j,maks'a kalan pay", symbol: "\\Delta T_{pay}", dimension: "sicaklik_farki", defaultUnit: "deltaK", units: ["deltaK", "deltaDegC"] },
  { key: "Rizin", label: "İzin verilen toplam ısıl direnç", symbol: "R_{\\theta ja,izin}", dimension: "isil_direnc", defaultUnit: "K_W", units: RTH_UNITS },
  { key: "RsaGerekli", label: "Gereken soğutucu ısıl direnci (en çok)", symbol: "R_{\\theta sa,maks}", dimension: "isil_direnc", defaultUnit: "K_W", units: RTH_UNITS },
  { key: "Pideal", label: "İdeal soğutucuyla (R_θsa = 0) en büyük güç", symbol: "P_{maks,ideal}", dimension: "guc", defaultUnit: "W" },
  { key: "TjIdeal", label: "İdeal soğutucuyla jonksiyon sıcaklığı", symbol: "T_{j,ideal}", dimension: "sicaklik", defaultUnit: "degC", units: TEMP_UNITS },
  { key: "Pmax", label: "İzin verilen en büyük güç", symbol: "P_{maks}", dimension: "guc", defaultUnit: "W" },
  { key: "TjJA", label: "Soğutucusuz jonksiyon sıcaklığı (R_θJA ile)", symbol: "T_{j,JA}", dimension: "sicaklik", defaultUnit: "degC", units: TEMP_UNITS },
  { key: "PmaxJA", label: "Soğutucusuz en büyük güç (R_θJA ile)", symbol: "P_{maks,JA}", dimension: "guc", defaultUnit: "W" },
];

const q = specWriter([...inputs, ...outputs]);
const t = textWriter([...inputs, ...outputs]);
/** Sıcaklık farkı (K) adımlarda */
const qDT = (dT: number, operand = true) => q("pay", dT, operand);

/** Hüküm olmayan notlar (kabul, yöntem, hatırlatma) */
const BILGI = "ok" as const; // birleştirmede "bilgi" olur

/** Kelvin ↔ °C ofsetlerinden kalan ~1e-14 artıkları "sıfır" saymak için göreli pay */
const REL_TOL = 1e-9;

const MESSAGES = {
  taHigh: "En büyük jonksiyon sıcaklığı ortam sıcaklığından büyük olmalı; aksi halde eleman hiç güç harcayamaz.",
  rZero: "Toplam ısıl direnç sıfırdan büyük olmalı.",
  tjOk: (tj: string, tjmax: string, pay: string) => `Jonksiyon sıcaklığı ${tj}, sınır ${tjmax} değerinin altında (pay ${pay}).`,
  tjOver: (tj: string, tjmax: string) =>
    `Jonksiyon sıcaklığı ${tj}, sınır ${tjmax} değerini aşıyor. Daha düşük ısıl dirençli soğutucu seçin, arayüzü iyileştirin ya da gücü düşürün.`,
  noHeatsink: (rsa: string, pIdeal: string, tjIdeal: string) =>
    `Hiçbir soğutucu yetmez: gereken R_θsa = ${rsa} ≤ 0. Sıfır dirençli ideal bir soğutucuyla bile jonksiyon ${tjIdeal} olur; ` +
    `bu koşullarda izin verilen en büyük güç ${pIdeal}. Gücü düşürün, R_θjc'si daha küçük bir kılıf/eleman seçin, ` +
    "R_θcs'yi azaltın (daha iyi termal macun/ped), ortam sıcaklığını düşürün ya da gücü birden çok elemana paylaştırın.",
  zeroHeatsink:
    "Gereken R_θsa sıfır: yalnızca sıfır dirençli ideal bir soğutucu yeterdi; uygulanabilir bir soğutucu yok. Gücü veya R_θjc + R_θcs'yi azaltın.",
  rsaOk: (rsa: string) => `R_θsa değeri en çok ${rsa} olan bir soğutucu seçin (soğutucu veri sayfasındaki hava koşuluna dikkat edin).`,
  jaEnough: (tj: string) =>
    `Soğutucusuz jonksiyon sıcaklığı yaklaşık ${tj}, sınırın altında; soğutucu gerekmeyebilir. ` +
    "R_θJA standart test kartında ölçüldüğünden kendi kartınızda doğrulayın.",
  jaNotEnough: (tj: string) => `Soğutucusuz jonksiyon sıcaklığı yaklaşık ${tj}, sınırın üstünde; soğutucu gerekli.`,
  seriesModel:
    "Seri model ısının baskılı devre kartı üzerinden akan kısmını yok sayar; sonuç tutucudur. R_θjc, R_θJA'ya göre küçük olduğunda en doğrudur.",
} as const;

export const sogutucuIsilHesap: CalcDefinition = {
  id: "4.11",
  slug: "sogutucu-isil-hesap",
  category: "elektronik",
  title: "Soğutucu / ısıl hesap",
  description:
    "Jonksiyon–kılıf, kılıf–soğutucu ve soğutucu–ortam ısıl dirençleriyle jonksiyon sıcaklığını, gereken soğutucu ısıl direncini " +
    "veya izin verilen en büyük gücü hesaplayın; isteğe bağlı olarak soğutucusuz durumla karşılaştırın.",
  formulas: [
    { label: "Jonksiyon sıcaklığı", latex: "T_j = T_a + P \\cdot (R_{\\theta jc} + R_{\\theta cs} + R_{\\theta sa})" },
    { label: "Gereken soğutucu", latex: "R_{\\theta sa} \\le \\frac{T_{j,maks} - T_a}{P} - R_{\\theta jc} - R_{\\theta cs}" },
    { label: "İzin verilen en büyük güç", latex: "P_{maks} = \\frac{T_{j,maks} - T_a}{R_{\\theta jc} + R_{\\theta cs} + R_{\\theta sa}}" },
    { label: "Soğutucusuz", latex: "T_j = T_a + P \\cdot R_{\\theta JA}" },
  ],
  references: [REF.tiIsil],
  inputs,
  outputs,
  validate: (inp) => {
    const Ta = num(inp, "Ta", WHERE);
    const Tjmax = num(inp, "Tjmax", WHERE);
    const checks: Check[] = [];
    if (!(Tjmax > Ta)) checks.push({ level: "hata", message: MESSAGES.taHigh });
    if (inp.mod === "pmax" && !(num(inp, "Rjc", WHERE) + num(inp, "Rcs", WHERE) + num(inp, "Rsa", WHERE) > 0)) {
      checks.push({ level: "hata", message: MESSAGES.rZero });
    }
    return checks;
  },
  compute: (inp: ComputeInputs) => {
    const mod = inp.mod as IsilMod;
    const Ta = num(inp, "Ta", WHERE);
    const Tjmax = num(inp, "Tjmax", WHERE);
    const Rjc = num(inp, "Rjc", WHERE);
    const Rcs = num(inp, "Rcs", WHERE);
    const Rja = optNum(inp, "Rja");
    const dTmax = Tjmax - Ta;
    const steps: Step[] = [];
    const checks: Check[] = [];
    const out: Record<string, number> = {};

    if (mod === "tj" || mod === "pmax") {
      const Rsa = num(inp, "Rsa", WHERE);
      const Rtop = Rjc + Rcs + Rsa;
      steps.push({
        label: "Toplam ısıl direnç",
        latex: `R_{\\theta ja} = R_{\\theta jc} + R_{\\theta cs} + R_{\\theta sa} = ${q("Rjc", Rjc)} + ${q("Rcs", Rcs)} + ${q("Rsa", Rsa)} = ${q("Rtop", Rtop)}`,
      });
      out.Rtop = Rtop;
      // Güç: tj modunda girdi, pmax modunda hesap
      let P: number;
      if (mod === "tj") {
        P = num(inp, "P", WHERE);
      } else {
        P = dTmax / Rtop;
        steps.push({
          label: "İzin verilen en büyük güç",
          latex: `P_{maks} = \\frac{T_{j,maks} - T_a}{R_{\\theta ja}} = \\frac{${q("Tjmax", Tjmax, false)} - ${q("Ta", Ta)}}{${q("Rtop", Rtop)}} = \\frac{${qDT(dTmax)}}{${q("Rtop", Rtop)}} = ${q("Pmax", P)}`,
        });
        out.Pmax = P;
      }
      const Tj = Ta + P * Rtop;
      const Tc = Ta + P * (Rcs + Rsa);
      const Ts = Ta + P * Rsa;
      const pay = Tjmax - Tj;
      const pq = mod === "tj" ? q("P", P) : q("Pmax", P);
      steps.push(
        {
          label: mod === "tj" ? "Jonksiyon sıcaklığı" : "Bu güçte jonksiyon sıcaklığı",
          latex: `T_j = T_a + P \\cdot R_{\\theta ja} = ${q("Ta", Ta, false)} + ${pq} \\cdot ${q("Rtop", Rtop)} = ${q("Tj", Tj, false)}`,
        },
        {
          label: "Kılıf ve soğutucu sıcaklığı",
          latex:
            `T_c = T_a + P \\cdot (R_{\\theta cs} + R_{\\theta sa}) = ${q("Ta", Ta, false)} + ${pq} \\cdot ${q("Rtop", Rcs + Rsa)} = ${q("Tc", Tc, false)}, \\quad ` +
            `T_s = T_a + P \\cdot R_{\\theta sa} = ${q("Ta", Ta, false)} + ${pq} \\cdot ${q("Rsa", Rsa)} = ${q("Ts", Ts, false)}`,
        },
      );
      Object.assign(out, { Tj, Tc, Ts });
      if (mod === "tj") {
        steps.push({ label: "Sınıra kalan pay", latex: `\\Delta T_{pay} = T_{j,maks} - T_j = ${q("Tjmax", Tjmax, false)} - ${q("Tj", Tj)} = ${qDT(pay, false)}` });
        out.pay = pay;
        if (pay < -REL_TOL * Tjmax) {
          checks.push({ level: "uyari", message: MESSAGES.tjOver(t("Tj", Tj), t("Tjmax", Tjmax)), reference: REF.tiIsil });
        } else {
          checks.push({ level: "ok", message: MESSAGES.tjOk(t("Tj", Tj), t("Tjmax", Tjmax), t("pay", Math.max(pay, 0))) });
        }
      }
      if (Rja !== undefined) {
        if (mod === "tj") {
          const TjJA = Ta + P * Rja;
          steps.push({ label: "Soğutucusuz (R_θJA ile)", latex: `T_{j,JA} = T_a + P \\cdot R_{\\theta JA} = ${q("Ta", Ta, false)} + ${q("P", P)} \\cdot ${q("Rja", Rja)} = ${q("TjJA", TjJA, false)}` });
          out.TjJA = TjJA;
          checks.push(
            TjJA <= Tjmax
              ? { level: "ok", message: MESSAGES.jaEnough(t("TjJA", TjJA)), reference: REF.tiIsil }
              : { level: BILGI, message: MESSAGES.jaNotEnough(t("TjJA", TjJA)), reference: REF.tiIsil },
          );
        } else {
          const PmaxJA = dTmax / Rja;
          steps.push({ label: "Soğutucusuz en büyük güç (R_θJA ile)", latex: `P_{maks,JA} = \\frac{T_{j,maks} - T_a}{R_{\\theta JA}} = \\frac{${qDT(dTmax)}}{${q("Rja", Rja)}} = ${q("PmaxJA", PmaxJA)}` });
          out.PmaxJA = PmaxJA;
        }
      }
      checks.push({ level: BILGI, message: MESSAGES.seriesModel, reference: REF.tiIsil });
      return { outputs: out, steps, checks };
    }

    if (mod !== "rsa") throw new Error(`${WHERE}: bilinmeyen mod "${String(mod)}"`);

    const P = num(inp, "P", WHERE);
    const Rizin = dTmax / P;
    const RsaRaw = Rizin - Rjc - Rcs;
    steps.push({
      label: "İzin verilen toplam ısıl direnç",
      latex: `R_{\\theta ja,izin} = \\frac{T_{j,maks} - T_a}{P} = \\frac{${q("Tjmax", Tjmax, false)} - ${q("Ta", Ta)}}{${q("P", P)}} = \\frac{${qDT(dTmax)}}{${q("P", P)}} = ${q("Rizin", Rizin)}`,
    });
    out.Rizin = Rizin;
    const fark = `R_{\\theta sa} = R_{\\theta ja,izin} - R_{\\theta jc} - R_{\\theta cs} = ${q("Rizin", Rizin)} - ${q("Rjc", Rjc)} - ${q("Rcs", Rcs)}`;

    if (RsaRaw > REL_TOL * Rizin) {
      steps.push({ label: "Gereken soğutucu ısıl direnci", latex: `${fark} = ${q("RsaGerekli", RsaRaw)}` });
      out.RsaGerekli = RsaRaw;
      checks.push({ level: BILGI, message: MESSAGES.rsaOk(t("RsaGerekli", RsaRaw)), reference: REF.tiIsil });
    } else {
      // Hiçbir soğutucu yetmez: negatif/sıfır R_θsa gösterilmez; ideal soğutucuyla anlamlı sınırlar verilir.
      const Rmin = Rjc + Rcs;
      const zero = Math.abs(RsaRaw) <= REL_TOL * Rizin;
      steps.push({
        label: "Gereken soğutucu ısıl direnci",
        latex: `${fark} ${zero ? "= 0" : "< 0"} \\quad \\Rightarrow \\quad \\text{hiçbir soğutucu yetmez}`,
      });
      const TjIdeal = Ta + P * Rmin;
      steps.push({
        label: "İdeal soğutucuyla (R_θsa = 0) jonksiyon sıcaklığı",
        latex: `T_{j,ideal} = T_a + P \\cdot (R_{\\theta jc} + R_{\\theta cs}) = ${q("Ta", Ta, false)} + ${q("P", P)} \\cdot ${q("Rtop", Rmin)} = ${q("TjIdeal", TjIdeal, false)}`,
      });
      out.TjIdeal = TjIdeal;
      // Bu dalda R_θjc + R_θcs ≥ R_θja,izin·(1 − pay) > 0 olduğundan bölme güvenlidir.
      const Pideal = dTmax / Rmin;
      steps.push({
        label: "İdeal soğutucuyla en büyük güç",
        latex: `P_{maks,ideal} = \\frac{T_{j,maks} - T_a}{R_{\\theta jc} + R_{\\theta cs}} = \\frac{${qDT(dTmax)}}{${q("Rtop", Rmin)}} = ${q("Pideal", Pideal)}`,
      });
      out.Pideal = Pideal;
      checks.push({
        level: "uyari",
        message: zero ? MESSAGES.zeroHeatsink : MESSAGES.noHeatsink(t("RsaGerekli", RsaRaw), t("Pideal", Pideal), t("TjIdeal", TjIdeal)),
        reference: REF.tiIsil,
      });
    }

    if (Rja !== undefined) {
      const TjJA = Ta + P * Rja;
      steps.push({ label: "Soğutucusuz (R_θJA ile)", latex: `T_{j,JA} = T_a + P \\cdot R_{\\theta JA} = ${q("Ta", Ta, false)} + ${q("P", P)} \\cdot ${q("Rja", Rja)} = ${q("TjJA", TjJA, false)}` });
      out.TjJA = TjJA;
      checks.push(
        TjJA <= Tjmax
          ? { level: "ok", message: MESSAGES.jaEnough(t("TjJA", TjJA)), reference: REF.tiIsil }
          : { level: BILGI, message: MESSAGES.jaNotEnough(t("TjJA", TjJA)), reference: REF.tiIsil },
      );
    }
    checks.push({ level: BILGI, message: MESSAGES.seriesModel, reference: REF.tiIsil });
    return { outputs: out, steps, checks };
  },
};
