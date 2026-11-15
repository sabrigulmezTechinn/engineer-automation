/**
 * Güç elektroniği ve ısıl hesapların (4.8, 4.9, 4.11) ortak yardımcıları ve kaynak referansları. Yalnızca bu hesaplar kullanır.
 */
import { formatQuantity, fromSI } from "@/lib/units";
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexNum, latexSpec } from "@/lib/calc/latex";
import { standardNeighbours } from "@/lib/calc/defs/yardimci/standart-deger-serileri";
import type { ESeriesId } from "@/lib/calc/defs/yardimci/e-serileri";
import type {
  ComputeInputs,
  InputSpec,
  NumberInputSpec,
  OutputSpec,
  Reference,
  SelectInputSpec,
} from "@/lib/calc/types";

/** Zorunlu sayı girdisi; yoksa programlama hatasıdır (motor doğrulamadan geçmiş girdi verir). */
export function num(inputs: ComputeInputs, key: string, where: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`${where}: "${key}" sayı değil`);
  return v;
}

/** İsteğe bağlı sayı girdisi: boş bırakıldıysa undefined. */
export function optNum(inputs: ComputeInputs, key: string): number | undefined {
  const v = inputs[key];
  return typeof v === "number" ? v : undefined;
}

type NumericSpec = NumberInputSpec | OutputSpec;

/** Anahtarıyla sayısal girdi/çıktı tanımını bulur; adımlarda kartla aynı birimi yazmak için. */
export function specOf(specs: readonly (InputSpec | OutputSpec)[], key: string): NumericSpec {
  const s = specs.find((x) => x.key === key);
  if (!s || ("kind" in s && s.kind !== "number")) throw new Error(`guc-ortak: "${key}" sayısal tanımı yok`);
  return s as NumericSpec;
}

/**
 * Tanım listesine bağlı LaTeX yazıcı: q("L", 9.72e-6) → "9{,}722\,\mu\mathrm{H}" (kartla aynı otomatik birim ve basamak).
 * İşlem içinde (operand = true, varsayılan) GÖSTERİLEN değeri negatif olan sayı parantezlenir (ofsetli birimlerde,
 * ör. −20 °C = 253,15 K, işaret SI değerine değil gösterime bakar); eşitliğin sonundaki sonuç için operand = false.
 */
export function specWriter(specs: readonly (InputSpec | OutputSpec)[]) {
  return (key: string, valueSI: number, operand = true) => {
    const s = specOf(specs, key);
    const precision = "significant" in s && s.significant !== undefined ? { significant: s.significant } : undefined;
    const text = latexSpec(s, valueSI, precision);
    const shown = fromSI(valueSI, autoOutputUnit(s, valueSI));
    return operand && shown < 0 ? `(${text})` : text;
  };
}

/** Kontrol mesajlarında (düz metin) bir değeri kartla aynı birim ve biçimle yazar. */
export function specText(spec: NumericSpec, valueSI: number): string {
  const unit = autoOutputUnit(spec, valueSI);
  return formatQuantity(fromSI(valueSI, unit), unit);
}

/** Tanım listesine bağlı düz metin yazıcı (kontrol mesajları için). */
export function textWriter(specs: readonly (InputSpec | OutputSpec)[]) {
  return (key: string, valueSI: number) => specText(specOf(specs, key), valueSI);
}

/** Oranlar (verim, kazanç, katsayı) adımlarda düz sayı */
export const qNum = (x: number) => latexNum(x);

/** Standart değer serisi seçimi (E serileri, IEC 60063; değerler Vishay 28372 tablosundan, 7.2 ile aynı kaynak) */
export function seriesSelect(
  key: string,
  label: string,
  ids: ESeriesId[],
  defaultId: ESeriesId,
  help: string,
  visibleWhen?: SelectInputSpec["visibleWhen"],
): SelectInputSpec {
  return {
    kind: "select",
    key,
    label,
    options: ids.map((id) => ({ value: id, label: id })),
    default: defaultId,
    help,
    ...(visibleWhen ? { visibleWhen } : {}),
  };
}

/**
 * Güvenli yönde standart değer: x serideyse kendisi; değilse "alt" için alt komşu, "ust" için üst komşu.
 * (7.2'deki standardNeighbours: alt/üst kesin komşulardır, x serideyse exact = true ve nearest = x'in seri değeri.)
 */
export function standardSafe(x: number, series: ESeriesId, direction: "alt" | "ust"): { value: number; exact: boolean } {
  const n = standardNeighbours(x, series);
  if (n.exact) return { value: n.nearest, exact: true };
  return { value: direction === "alt" ? n.lower : n.upper, exact: false };
}

/** Standart değer adımının açıklaması: "E24 serisinde standart değer" / "E24 üst komşu" */
export function standardNote(series: ESeriesId, exact: boolean, direction: "alt" | "ust"): string {
  return exact ? `\\text{${series} serisinde standart değer}` : `\\text{${series} ${direction === "alt" ? "alt" : "üst"} komşu}`;
}

/**
 * Kaynaklar (yalnızca açılıp okunanlar). Açılan belgeler:
 * - tiBuck:     https://www.ti.com/lit/an/slva477c/slva477c.pdf (SLVA477C, güncel revizyon; slva477b adresi buraya yönleniyor)
 * - tiBoost:    https://www.ti.com/lit/an/slva372d/slva372d.pdf (SLVA372D, güncel revizyon)
 * - rohmKayip:  https://fscdn.rohm.com/en/products/databook/applinote/ic/power/switching_regulator/power_loss_appli-e.pdf
 * - wolfspeed:  https://assets.wolfspeed.com/uploads/2024/01/Wolfspeed_PRD-03043_Measuring_Switching_and_Conduction_Losses_in_LTspice_Simulation_Software.pdf
 * - tiKapi:     https://www.ti.com/lit/ml/slua618a/slua618a.pdf
 * - vishay608:  https://www.vishay.com/docs/73217/an608a.pdf
 * - p2n2222a:   https://www.onsemi.com/download/data-sheet/pdf/p2n2222a-d.pdf
 * - tiIsil:     https://www.ti.com/lit/pdf/spra953 (SPRA953D)
 */
export const REF = {
  tiBuck: {
    standard: "TI SLVA477C",
    title: "Basic Calculation of a Buck Converter's Power Stage (Rev. C)",
    clause: "Denk. (1), (2), (4), (5), (6), (12)",
    note:
      "D = V_OUT/(V_IN(max)·η) (Denk. 1; Ek A'daki Denk. 15'te V_OUT·η/V_IN(max) yazar, gövde metni esas alındı); " +
      "ΔI_L = (V_IN(max) − V_OUT)·D/(f_S·L); I_SW(max) = ΔI_L/2 + I_OUT(max); L = V_OUT·(V_IN − V_OUT)/(ΔI_L·f_S·V_IN), V_IN tipik; " +
      "ΔI_L ≈ (0,2…0,4)·I_OUT(max); C_OUT(min) = ΔI_L/(8·f_S·ΔV_OUT). Formüller sürekli iletim kipi (CCM) içindir.",
  },
  tiBoost: {
    standard: "TI SLVA372D",
    title: "Basic Calculation of a Boost Converter's Power Stage (Rev. D)",
    clause: "Denk. (1)–(6), (12)",
    note:
      "D = 1 − V_IN(min)·η/V_OUT; ΔI_L = V_IN(min)·D/(f_S·L); I_MAXOUT = (I_LIM(min) − ΔI_L/2)·(1 − D); " +
      "I_SW(max) = ΔI_L/2 + I_OUT(max)/(1 − D); L = V_IN·(V_OUT − V_IN)/(ΔI_L·f_S·V_OUT), V_IN tipik; " +
      "ΔI_L ≈ (0,2…0,4)·I_OUT(max)·V_OUT/V_IN; C_OUT(min) = I_OUT(max)·D/(f_S·ΔV_OUT). Formüller sürekli iletim kipi (CCM) içindir.",
  },
  rohmKayip: {
    standard: "ROHM AEK59-D1-0065-2",
    title: "Calculation of Power Loss (Synchronous), Rev. 003",
    clause: "Denk. (1), (3), (5) ve hesap örneği",
    note:
      "P_ON = I_O²·R_ON·V_O/V_IN; P_SW = ½·V_IN·I_O·(t_r + t_f)·f_SW; P_G = Q_g·V_gs·f_SW. " +
      "Örnek: 12 V, 3 A, t_r 4 ns, t_f 6 ns, 2 MHz → 360 mW.",
  },
  wolfspeed: {
    standard: "Wolfspeed PRD-03043 Rev. 2",
    title: "Measuring Switching and Conduction Losses in LTspice Simulation Software",
    clause: "Denk. (2)–(4)",
    note: "P_sw = ½·t_sw,on·V_in·I_on·f_sw + ½·t_sw,off·V_in·I_on·f_sw; P_sw,on = E_sw,on·f_sw, P_sw,off = E_sw,off·f_sw.",
  },
  tiKapi: {
    standard: "TI SLUA618A",
    title: "Fundamentals of MOSFET and IGBT Gate Driver Circuits",
    clause: "Bölüm 2.7, Denk. (9)",
    note: "P_GATE = V_DRV·Q_G·f_DRV; bu güç MOSFET'te değil, kapı sürme devresinde (sürücü çıkış direnci, kapı dirençleri) harcanır.",
  },
  vishay608: {
    standard: "Vishay AN608A",
    title: "Power MOSFET Basics: Understanding Gate Charge and Using it to Assess Switching Performance",
    note: "Veri sayfasındaki anahtarlama süreleri dirençli yükte ölçülür ve gerçek devreyi tam temsil etmez; ½·V·I·(t_r + t_f)·f_s kaba bir tahmindir.",
  },
  p2n2222a: {
    standard: "onsemi P2N2222A/D, Rev. 7",
    title: "P2N2222A Amplifier Transistors, NPN Silicon — ON Characteristics",
    note:
      "Örnek veri sayfası: h_FE en az değeri I_C = 150 mA'de V_CE = 10 V için 100, V_CE = 1 V için 50; " +
      "V_CE(sat) ≤ 0,3 V ve V_BE(sat) 0,6–1,2 V, I_C = 150 mA, I_B = 15 mA'de (I_C/I_B = 10) verilir.",
  },
  tiIsil: {
    standard: "TI SPRA953D",
    title: "Semiconductor and IC Package Thermal Metrics (Rev. D)",
    clause: "Denk. (1), (5), (6); Bölüm 1 ve 2.2",
    note:
      "T_J ≅ T_A + (R_θJC + R_θ(CS) + R_θ(SA))·P (Denk. 5), R_θJC, R_θJA'ya göre küçükken en doğrudur; ısının bir kısmı " +
      "kart üzerinden de aktığı için bu seri model tutucudur (Denk. 6 paralel yol). R_θJA belirli bir test kartında ölçülür; " +
      "T_J = T_A + R_θJA·P ile sistem tahmini (Denk. 1) yaklaşıktır.",
  },
} satisfies Record<string, Reference>;
