/**
 * Op-amp, 555 ve ayarlı regülatör hesaplarının (4.4, 4.6, 4.7) ortak yardımcıları ve kaynak referansları.
 * Yalnızca bu hesaplar kullanır (Faz 4 işçisi B).
 */
import { formatQuantity, fromSI } from "@/lib/units";
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexSpec, latexSpecOperand } from "@/lib/calc/latex";
import type {
  ComputeInputs,
  InputSpec,
  NumberInputSpec,
  NumberListInputSpec,
  OutputSpec,
  Reference,
  SelectInputSpec,
} from "@/lib/calc/types";
import type { ESeriesId } from "../yardimci/e-serileri";
import { standardNeighbours } from "../yardimci/standart-deger-serileri";

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

/** Zorunlu liste girdisi */
export function list(inputs: ComputeInputs, key: string, where: string): number[] {
  const v = inputs[key];
  if (!Array.isArray(v)) throw new Error(`${where}: "${key}" liste değil`);
  return v;
}

const E_SERILER: ESeriesId[] = ["E6", "E12", "E24", "E48", "E96", "E192"];

/** E serisi seçimi (7.2 ile aynı seçenekler ve tolerans notu). */
export function eSeriInput(
  defaultSeries: ESeriesId,
  visibleWhen: SelectInputSpec["visibleWhen"],
  key = "seri",
): SelectInputSpec {
  return {
    kind: "select",
    key,
    label: "Standart değer serisi",
    options: E_SERILER.map((id) => ({ value: id, label: id })),
    default: defaultSeries,
    help: "IEC 60063 E serileri. Vishay 31001: ±%10 → E12, ±%2 ve ±%5 → E24, ±%1 → E96, ±%0,1–0,5 → E192.",
    visibleWhen,
  };
}

/** Standart değere yuvarlama yönü: "yakin" en yakın, "ust" güvenli taraf (ör. akım ayar direnci büyüdükçe akım azalır). */
export type Yuvarlama = "yakin" | "ust";

/**
 * Seçilen E serisinden standart değer. Değer zaten standartsa kendisi döner (standardNeighbours'ta lower/upper kesin
 * komşulardır, eşitlikte bile x'i atlar; bu yüzden önce `exact` denetlenir).
 */
export function standartDeger(x: number, seri: ESeriesId, yon: Yuvarlama): number {
  const n = standardNeighbours(x, seri);
  if (n.exact) return n.nearest;
  return yon === "ust" ? n.upper : n.nearest;
}

type AnySpec = NumberInputSpec | NumberListInputSpec | OutputSpec;

/** Anahtarıyla sayısal girdi/çıktı tanımını bulur; adımlarda kartla aynı birimi yazmak için. */
export function specOf(specs: readonly (InputSpec | OutputSpec)[], key: string): AnySpec {
  const s = specs.find((x) => x.key === key);
  if (!s || ("kind" in s && s.kind === "select")) throw new Error(`entegre-ortak: "${key}" sayısal tanımı yok`);
  return s as AnySpec;
}

function precisionOf(s: AnySpec) {
  if (!("kind" in s) && s.integer) return { decimals: 0 };
  if (!("kind" in s) && s.significant !== undefined) return { significant: s.significant };
  return undefined;
}

/**
 * Bir tanım listesine bağlı LaTeX yazıcılar: q("R1", 1000) → "1\,\mathrm{k}\Omega" (kartla aynı otomatik birim),
 * qo(...) işlem içi hali (negatif değer parantezli).
 */
export function specWriters(specs: readonly (InputSpec | OutputSpec)[]) {
  const q = (key: string, valueSI: number) => {
    const s = specOf(specs, key);
    return latexSpec(s, valueSI, precisionOf(s));
  };
  const qo = (key: string, valueSI: number) => {
    const s = specOf(specs, key);
    return latexSpecOperand(s, valueSI, precisionOf(s));
  };
  /** Kontrol mesajlarında (düz metin) bir değeri kartla aynı birim ve biçimle yazar. */
  const t = (key: string, valueSI: number) => {
    const s = specOf(specs, key);
    const unit = autoOutputUnit(s, valueSI);
    return formatQuantity(fromSI(valueSI, unit), unit, precisionOf(s));
  };
  return { q, qo, t };
}

/**
 * Kaynaklar (yalnızca açılıp okunanlar). Açılan belgeler:
 * - TI SBOA270C Inverting Amplifier Circuit:        https://www.ti.com/lit/an/sboa270/sboa270.pdf
 * - TI SBOA271A Non-Inverting Amplifier Circuit:    https://www.ti.com/lit/an/sboa271/sboa271.pdf
 * - TI SBOA274A Difference Amplifier (Subtractor):  https://www.ti.com/lit/an/sboa274/sboa274.pdf
 * - TI SBOA269B Buffer (Follower) Circuit:          https://www.ti.com/lit/an/sboa269/sboa269.pdf
 * - TI SBOA272C Inverting Summer Circuit:           https://www.ti.com/lit/an/sboa272/sboa272.pdf
 * - TI SLFS022K xx555 Precision Timers:             https://www.ti.com/lit/ds/symlink/ne555.pdf
 * - TI SNAS548D LM555 Timer:                        https://www.ti.com/lit/ds/symlink/lm555.pdf
 * - TI SLVS044Z LM317 3-Pin Adjustable Regulator:   https://www.ti.com/lit/ds/symlink/lm317.pdf
 */
export const REF = {
  sboa270: {
    standard: "TI SBOA270C",
    title: "Analog Engineer's Circuit: Inverting Amplifier Circuit",
    clause: "Design Steps 3–4; Design Notes 1, 2, 5",
    note: "G = −R2/R1; küçük sinyal bant genişliği gürültü kazancıyla (NG = 1 + R2/R1) hesaplanır: BW = GBP/NG. Giriş empedansı giriş direncine (R1) eşittir.",
  },
  sboa271: {
    standard: "TI SBOA271A",
    title: "Analog Engineer's Circuit: Non-Inverting Amplifier Circuit",
    clause: "Design Steps 1–2; Design Notes 1, 2, 5",
    note: "G = 1 + R1/R2 (R1 geri besleme); ortak mod gerilimi giriş sinyaline eşittir; giriş empedansı op-amp'ın giriş empedansıdır.",
  },
  sboa274: {
    standard: "TI SBOA274A",
    title: "Analog Engineer's Circuit: Difference Amplifier (Subtractor) Circuit",
    clause: "Design Steps (R1 = R2, R3 = R4 için sadeleşmiş transfer fonksiyonu); Design Note 5",
    note: "Vo = (Vi2 − Vi1)·R3/R1 + Vref; dirençlerin eşleşmesi ortak mod bastırmayı (CMRR) belirler.",
  },
  sboa269: {
    standard: "TI SBOA269B",
    title: "Analog Engineer's Circuit: Buffer (Follower) Circuit",
    clause: "Design Note 2",
    note: "Küçük sinyal bant genişliği op-amp'ın birim kazanç bant genişliğidir.",
  },
  sboa272: {
    standard: "TI SBOA272C",
    title: "Analog Engineer's Circuit: Inverting Summer Circuit",
    clause: "Design Steps 1–6",
    note: "Vo = −(Vi1·R3/R1 + Vi2·R3/R2); gürültü kazancında giriş dirençleri paraleldir: NG = 1 + R3/(R1‖R2), BW = GBP/NG.",
  },
  ne555: {
    standard: "TI SLFS022K",
    title: "xx555 Precision Timers (NA555, NE555, SA555, SE555) veri sayfası",
    clause: "§6.3.1 Monostable Operation, §6.3.2 Astable Operation (denklem 1–6), Tablo 6-1",
    note: "Kondansatör 1/3·V_CC ile 2/3·V_CC arasında dolar ve boşalır; veri sayfası t_H ≅ 0,693·(R_A+R_B)·C, f ≅ 1,44/((R_A+2R_B)·C), t_w ≅ 1,1·R_A·C yaklaşımlarını verir.",
  },
  ne555Sinir: {
    standard: "TI SLFS022K",
    title: "xx555 Precision Timers veri sayfası — sınırlar",
    clause: "§5.3 Recommended Operating Conditions; §5.5 THRES current dipnotu (1); §6.3.1; §6.3.2",
    note: "V_CC 4,5–16 V; R_A + R_B ≅ 3,4 MΩ (5 V), ≅ 10 MΩ (15 V); en kısa monostable darbe 10 µs; astable ≤ 100 kHz önerilir.",
  },
  lm555: {
    standard: "TI SNAS548D",
    title: "LM555 Timer veri sayfası",
    clause: "§6.5 Electrical Characteristics; §7.4.2 Astable Operation (denklem 1–3)",
    note: "Eşik gerilimi 0,667·V_CC; t1 = 0,693·(R_A+R_B)·C, t2 = 0,693·R_B·C. 15 V'ta en büyük R_A + R_B 20 MΩ (NE555'ten daha geniş).",
  },
  lm317: {
    standard: "TI SLVS044Z",
    title: "LM317 3-Pin Adjustable Regulator veri sayfası",
    clause: "Denklem (1)–(2), §8.2.2 Detailed Design Procedure",
    note: "V_O = V_REF·(1 + R2/R1) + I_ADJ·R2; I_ADJ tipik 50 µA. §6.6: V_REF tipik 1,25 V (1,2–1,3 V).",
  },
  lm317Sinir: {
    standard: "TI SLVS044Z",
    title: "LM317 veri sayfası — çalışma koşulları",
    clause: "§6.3 Recommended Operating Conditions; §6.6 Electrical Characteristics; §7.3.1; §7.4.2; §7.4.3",
    note: "V_O 1,25–37 V; V_I − V_O 3–40 V (3 V önerilen pay); I_O ≤ 1,5 A; minimum yük akımı tipik 3,5 mA, en çok 10 mA; T_J ≤ 125 °C.",
  },
  lm317Akim: {
    standard: "TI SLVS044Z",
    title: "LM317 veri sayfası — akım ayarı",
    clause: "§7.3.3 Programmable Feedback; §8.3.7 50mA Constant-Current Battery-Charger Circuit",
    note: "Akım ayarında tek direnç R = 1,25 V / I_O, direnç gücü > (1,25 V)²/R. §8.3.7: I = 1,25 V ÷ 24 Ω; V_I > V_yük + 4,25 V (1,25 V V_REF + 3 V pay).",
  },
  lm317Isil: {
    standard: "TI SLVS044Z",
    title: "LM317 veri sayfası — ısıl hesap",
    clause: "§8.5.1.1.1 Heat Sink Requirements, denklem (9)–(11); §6.4–6.5 Thermal Information",
    note: "P_D ≈ (V_IN − V_OUT)·I_L; T_R(MAX) = T_J(MAX) − T_A(MAX); R_θJA ≤ T_R(MAX)/P_D.",
  },
} satisfies Record<string, Reference>;
