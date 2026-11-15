/**
 * KAPSAM 5.7 — RS485 / Modbus RTU zamanlaması ve hat kılavuzu.
 *
 * Kaynaklar (birincil metinden okundu):
 * - Modbus over Serial Line Specification and Implementation Guide V1.02 (Modbus.org, 20.12.2006),
 *   https://www.modbus.org/file/secure/modbusoverserial.pdf
 *   §2.5.1: RTU karakteri 11 bit (1 başlangıç + 8 veri + 1 parite + 1 dur); paritesizde 2 dur biti gerekir.
 *   §2.5.1: RTU çerçevesi en fazla 256 bayt.
 *   §2.5.1.1: çerçeveler en az 3,5 karakter sessizlikle ayrılır (t3,5); karakterler arası > 1,5 karakter (t1,5)
 *   çerçeveyi bozar. 19200 Bd üstünde sabit t1,5 = 750 µs ve t3,5 = 1,750 ms önerilir.
 *   §3.4.1: tekrarlayıcısız RS485 hattında 32 cihaza her zaman izin verilir.
 *   §3.4.3: en fazla 9600 Bd ve AWG26 (veya kalın) için ana hat en fazla 1000 m.
 *   §3.4.5: hat sonlandırması 150 Ω (0,5 W) direnç; polarizasyon varsa 1 nF (≥10 V) seri kondansatörlü 120 Ω (0,25 W).
 * - TI SLLA272D "The RS-485 Design Guide" (Şubat 2008, rev. Mayıs 2021), §9 Data Rate Versus Bus Length,
 *   https://www.ti.com/lit/pdf/slla272 : "uzunluk [m] × veri hızı [bps] < 10^7" (tutucu kural);
 *   22 AWG, 120 Ω UTP kabloda direnç sınırı ≈ 1200 m. Bu kural Modbus §3.4.3 ile uyumludur (9600 Bd → ≈ 1042 m).
 *   (TI SLLA070D aynı ilişkiyi 10^8 olarak verir; daha tutucu olan SLLA272D kullanıldı.)
 * - MODBUS Application Protocol Specification V1.1b3 (2012), §6.3 (03 Read Holding Registers),
 *   https://www.modbus.org/file/secure/modbusprotocolspecification.pdf : yardım metnindeki örnek çerçeve
 *   uzunlukları (istek PDU 1 + 2 + 2 bayt, yanıt PDU 1 + 1 + 2·N bayt; seri ADU = adres + PDU + CRC).
 */
import { latexAuto, latexNum, latexQty } from "@/lib/calc/latex";
import type { CalcDefinition, Check, ComputeInputs, Reference, Step } from "@/lib/calc/types";
import { formatQuantity } from "@/lib/units";

export type Cerceve = "8E1" | "8O1" | "8N2" | "8N1";

/** Karakter başına bit sayısı: başlangıç + veri + parite + dur */
export const FRAME_BITS: Record<Cerceve, number> = { "8E1": 11, "8O1": 11, "8N2": 11, "8N1": 10 };

/** Modbus §2.5.1.1: bu hızın üstünde sabit zamanlayıcılar kullanılır (Bd = bit/s). */
export const FIXED_TIMER_ABOVE_BAUD = 19200;
/** Modbus §2.5.1.1: 19200 Bd üstünde t1,5 = 750 µs */
export const T15_FIXED = 750e-6;
/** Modbus §2.5.1.1: 19200 Bd üstünde t3,5 = 1,750 ms */
export const T35_FIXED = 1.75e-3;
/** TI SLLA272D §9: L [m] · veri hızı [bit/s] < 10^7 */
export const LENGTH_RATE_PRODUCT = 1e7;
/** TI SLLA272D §9: 22 AWG, 120 Ω UTP kabloda direnç sınırı ≈ 1200 m */
export const MAX_LENGTH = 1200;
/** Modbus §3.4.1: tekrarlayıcısız hatta her zaman izin verilen cihaz sayısı */
export const MAX_DEVICES = 32;

const MODBUS: Reference = {
  standard: "Modbus over Serial Line V1.02",
  title: "MODBUS over serial line specification and implementation guide (Modbus.org, 2006)",
};
const TI_SLLA272: Reference = {
  standard: "TI SLLA272D",
  title: "The RS-485 Design Guide",
  clause: "§9 Data Rate Versus Bus Length",
};

const MESSAGES = {
  noParity:
    "8N1 (10 bit) Modbus RTU'da standart dışıdır: paritesiz kullanımda 2 dur biti gerekir (11 bitlik karakter). Tüm cihazlar aynı ayarda olmalıdır.",
  fixedTimers: "19200 Bd üstünde t1,5 = 750 µs ve t3,5 = 1,75 ms sabit değerleri kullanıldı.",
  lengthOver: (l: string, lim: string) =>
    `Kablo uzunluğu (${l}) bu hız için kılavuz sınırını (${lim}) aşıyor. Hızı düşürün veya kablonun veri sayfasıyla doğrulayın (tutucu kural: L·Bd < 10⁷; Modbus: 9600 Bd ve AWG26 için en fazla 1000 m).`,
  lengthOk: (l: string, lim: string) => `Kablo uzunluğu (${l}) bu hız için kılavuz sınırı (${lim}) içinde.`,
  devicesOver: (n: number) =>
    `${n} cihaz, tekrarlayıcısız hatta her zaman izin verilen 32 cihazı aşıyor. Cihazların birim yükü (UL) belgelenmiş olmalı veya tekrarlayıcı kullanılmalıdır.`,
  termination:
    "Sonlandırma: ana hattın iki ucuna (yalnızca iki uca) 150 Ω (0,5 W) direnç; hat polarizasyonu varsa 1 nF (≥ 10 V) seri kondansatörlü 120 Ω (0,25 W). RS-485 kablolarının karakteristik empedansı tipik 120 Ω'dur (TI SLLA272D).",
} as const;

function num(inputs: ComputeInputs, key: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`rs485-modbus: "${key}" sayı değil`);
  return v;
}

function optNum(inputs: ComputeInputs, key: string): number | undefined {
  const v = inputs[key];
  return typeof v === "number" ? v : undefined;
}

export interface ModbusTiming {
  tChar: number;
  t15: number;
  t35: number;
  fixed: boolean;
}

/** Karakter süresi ve t1,5 / t3,5 (s). */
export function modbusTiming(baud: number, bits: number): ModbusTiming {
  const tChar = bits / baud;
  const fixed = baud > FIXED_TIMER_ABOVE_BAUD;
  return {
    tChar,
    t15: fixed ? T15_FIXED : 1.5 * tChar,
    t35: fixed ? T35_FIXED : 3.5 * tChar,
    fixed,
  };
}

/** Kılavuz kablo uzunluğu (m): min(1200 m, 10^7 / Bd) */
export function guidelineLength(baud: number): number {
  return Math.min(MAX_LENGTH, LENGTH_RATE_PRODUCT / baud);
}

const qt = (v: number) => latexAuto(v, "zaman");
const qL = (v: number) => latexQty(v, "m");

export const rs485Modbus: CalcDefinition = {
  id: "5.7",
  slug: "rs485-modbus",
  category: "otomasyon",
  title: "RS485 / Modbus RTU zamanlaması",
  description:
    "Modbus RTU hattında karakter süresi, t1,5 ve t3,5 zamanlayıcıları, çerçeve süreleri ve bir istek–yanıt çevriminin süresi; RS485 kablo uzunluğu kılavuzu ve sonlandırma bilgisi.",
  formulas: [
    { label: "Karakter süresi", latex: "t_c = \\frac{N_{\\text{bit}}}{\\mathrm{Bd}}" },
    {
      label: "Zamanlayıcılar (Bd ≤ 19200)",
      latex: "t_{1{,}5} = 1{,}5 \\, t_c, \\quad t_{3{,}5} = 3{,}5 \\, t_c",
    },
    {
      label: "Zamanlayıcılar (Bd > 19200, sabit)",
      latex: "t_{1{,}5} = 750\\,\\mu\\mathrm{s}, \\quad t_{3{,}5} = 1{,}75\\,\\mathrm{ms}",
    },
    { label: "Çerçeve süresi", latex: "T = n_{\\text{bayt}} \\cdot t_c" },
    {
      label: "İstek–yanıt çevrimi",
      latex:
        "T_{\\text{çevrim}} = T_{\\text{istek}} + t_{3{,}5} + t_{\\text{işlem}} + T_{\\text{yanıt}} + t_{3{,}5}",
    },
    {
      label: "Kılavuz kablo uzunluğu (TI SLLA272D)",
      latex: "L_{\\text{kılavuz}} = \\min\\left(1200\\,\\mathrm{m},\\; \\frac{10^{7}\\,\\mathrm{m \\cdot bit/s}}{\\mathrm{Bd}}\\right)",
    },
  ],
  references: [
    {
      ...MODBUS,
      clause: "§2.5.1 (RTU karakteri, 256 bayt), §2.5.1.1 (t1,5 / t3,5), §3.4.1, §3.4.3, §3.4.5",
    },
    {
      standard: "TIA/EIA-485-A",
      title: "Electrical characteristics of generators and receivers for use in balanced digital multipoint systems",
      note: "Elektriksel katman. Uzunluk–hız kuralı ve 1200 m değeri TI SLLA272D'den alınmıştır.",
    },
    { ...TI_SLLA272, note: "L·Bd < 10⁷ (tutucu kural); 22 AWG 120 Ω UTP için ≈ 1200 m; 120 Ω sonlandırma." },
    {
      standard: "Modbus Application Protocol V1.1b3",
      title: "MODBUS Application Protocol Specification (Modbus.org, 2012)",
      clause: "§6.3 03 Read Holding Registers",
      note: "Örnek çerçeve uzunlukları: istek PDU 5 bayt, yanıt PDU 2 + 2·N bayt; seri hatta + adres (1) + CRC (2).",
    },
  ],
  inputs: [
    {
      kind: "number",
      key: "baud",
      label: "İletişim hızı",
      symbol: "\\mathrm{Bd}",
      dimension: "veri_hizi",
      defaultUnit: "Bd",
      units: ["Bd", "bit_s", "kbit_s"],
      default: 19200,
      min: 0,
      minExclusive: true,
      help: "Modbus: 9600 ve 19200 Bd zorunlu, varsayılan 19200 Bd (§3.2).",
    },
    {
      kind: "select",
      key: "cerceve",
      label: "Karakter çerçevesi",
      options: [
        { value: "8E1", label: "8 veri, çift parite, 1 dur (11 bit, varsayılan)" },
        { value: "8O1", label: "8 veri, tek parite, 1 dur (11 bit)" },
        { value: "8N2", label: "8 veri, paritesiz, 2 dur (11 bit)" },
        { value: "8N1", label: "8 veri, paritesiz, 1 dur (10 bit, standart dışı)" },
      ],
      default: "8E1",
    },
    {
      kind: "number",
      key: "n_istek",
      label: "İstek çerçevesi uzunluğu (bayt)",
      symbol: "n_{\\text{istek}}",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 8,
      min: 4,
      max: 256,
      integer: true,
      help: "Adres + fonksiyon kodu + veri + CRC. Ör. 03 Read Holding Registers isteği: 1 + 1 + 2 + 2 + 2 = 8 bayt. RTU çerçevesi 4–256 bayt.",
    },
    {
      kind: "number",
      key: "n_yanit",
      label: "Yanıt çerçevesi uzunluğu (bayt)",
      symbol: "n_{\\text{yanıt}}",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      default: 25,
      min: 4,
      max: 256,
      integer: true,
      help: "Ör. 03 ile 10 register okuma yanıtı: 1 + 1 + 1 + 2·10 + 2 = 25 bayt.",
    },
    {
      kind: "number",
      key: "t_islem",
      label: "Cihaz işlem süresi",
      symbol: "t_{\\text{işlem}}",
      dimension: "zaman",
      defaultUnit: "ms",
      units: ["us", "ms", "s"],
      min: 0,
      optional: true,
      help: "İsteğin sonundaki t3,5 sessizliğinden sonra yanıt başlayana kadar geçen ek süre (cihaz veri sayfası). Boşsa 0.",
    },
    {
      kind: "number",
      key: "L",
      label: "Ana hat kablo uzunluğu",
      symbol: "L",
      dimension: "uzunluk",
      defaultUnit: "m",
      units: ["m", "km", "ft"],
      default: 300,
      min: 0,
      minExclusive: true,
      optional: true,
    },
    {
      kind: "number",
      key: "n_cihaz",
      label: "Hattaki cihaz sayısı",
      symbol: "N",
      dimension: "boyutsuz",
      defaultUnit: "unitless",
      min: 2,
      integer: true,
      optional: true,
      help: "Ana birim dahil, tekrarlayıcısız bir hat parçasındaki toplam cihaz.",
    },
  ],
  outputs: [
    { key: "t_c", label: "Karakter süresi", symbol: "t_c", dimension: "zaman", defaultUnit: "s" },
    { key: "t15", label: "Karakterler arası zaman aşımı", symbol: "t_{1{,}5}", dimension: "zaman", defaultUnit: "s" },
    { key: "t35", label: "Çerçeveler arası sessizlik", symbol: "t_{3{,}5}", dimension: "zaman", defaultUnit: "s" },
    { key: "T_istek", label: "İstek çerçevesi süresi", symbol: "T_{\\text{istek}}", dimension: "zaman", defaultUnit: "s" },
    { key: "T_yanit", label: "Yanıt çerçevesi süresi", symbol: "T_{\\text{yanıt}}", dimension: "zaman", defaultUnit: "s" },
    { key: "T_cevrim", label: "İstek–yanıt çevrimi süresi", symbol: "T_{\\text{çevrim}}", dimension: "zaman", defaultUnit: "s" },
    {
      key: "f_cevrim",
      label: "Saniyedeki en fazla çevrim sayısı",
      symbol: "1/T_{\\text{çevrim}}",
      dimension: "frekans",
      defaultUnit: "Hz",
      units: ["Hz"],
      autoUnit: false,
    },
    { key: "L_kilavuz", label: "Kılavuz kablo uzunluğu", symbol: "L_{\\text{kılavuz}}", dimension: "uzunluk", defaultUnit: "m" },
  ],

  compute: (inputs) => {
    const baud = num(inputs, "baud");
    const cerceve = inputs.cerceve as Cerceve;
    const bits = FRAME_BITS[cerceve];
    if (bits === undefined) throw new Error(`rs485-modbus: bilinmeyen çerçeve "${String(cerceve)}"`);
    const nReq = num(inputs, "n_istek");
    const nResp = num(inputs, "n_yanit");
    const tProc = optNum(inputs, "t_islem") ?? 0;
    const L = optNum(inputs, "L");
    const nDev = optNum(inputs, "n_cihaz");

    const { tChar, t15, t35, fixed } = modbusTiming(baud, bits);
    const tReq = nReq * tChar;
    const tResp = nResp * tChar;
    const tCycle = tReq + t35 + tProc + tResp + t35;
    const lGuide = guidelineLength(baud);

    const steps: Step[] = [
      {
        label: "Karakter süresi",
        latex: `t_c = \\frac{N_{\\text{bit}}}{\\mathrm{Bd}} = \\frac{${bits}}{${latexQty(baud, "Bd")}} = ${qt(tChar)}`,
      },
      fixed
        ? {
            label: "Zamanlayıcılar (19200 Bd üstü, sabit değerler)",
            latex: `t_{1{,}5} = ${qt(t15)}, \\quad t_{3{,}5} = ${qt(t35)}`,
          }
        : {
            label: "Zamanlayıcılar",
            latex: `t_{1{,}5} = 1{,}5 \\cdot ${qt(tChar)} = ${qt(t15)}, \\quad t_{3{,}5} = 3{,}5 \\cdot ${qt(tChar)} = ${qt(t35)}`,
          },
      {
        label: "Çerçeve süreleri",
        latex: `T_{\\text{istek}} = ${latexNum(nReq)} \\cdot ${qt(tChar)} = ${qt(tReq)}, \\quad T_{\\text{yanıt}} = ${latexNum(nResp)} \\cdot ${qt(tChar)} = ${qt(tResp)}`,
      },
      {
        label: "İstek–yanıt çevrimi",
        latex: `T_{\\text{çevrim}} = ${[tReq, t35, ...(tProc > 0 ? [tProc] : []), tResp, t35].map(qt).join(" + ")} = ${qt(tCycle)}`,
      },
      {
        label: "Kılavuz kablo uzunluğu",
        latex: `L_{\\text{kılavuz}} = \\min\\left(1200\\,\\mathrm{m},\\; \\frac{10^{7}\\,\\mathrm{m \\cdot bit/s}}{${latexQty(baud, "Bd")}}\\right) = ${qL(lGuide)}`,
      },
    ];

    const checks: Check[] = [];
    if (cerceve === "8N1") {
      checks.push({ level: "uyari", message: MESSAGES.noParity, reference: { ...MODBUS, clause: "§2.5.1" } });
    }
    if (fixed) checks.push({ level: "ok", message: MESSAGES.fixedTimers, reference: { ...MODBUS, clause: "§2.5.1.1" } });
    if (L !== undefined) {
      const lText = formatQuantity(L, "m");
      const limText = formatQuantity(lGuide, "m");
      checks.push(
        L > lGuide
          ? { level: "uyari", message: MESSAGES.lengthOver(lText, limText), reference: TI_SLLA272 }
          : { level: "ok", message: MESSAGES.lengthOk(lText, limText), reference: TI_SLLA272 },
      );
    }
    if (nDev !== undefined && nDev > MAX_DEVICES) {
      checks.push({ level: "uyari", message: MESSAGES.devicesOver(nDev), reference: { ...MODBUS, clause: "§3.4.1" } });
    }
    checks.push({ level: "ok", message: MESSAGES.termination, reference: { ...MODBUS, clause: "§3.4.5" } });

    return {
      outputs: {
        t_c: tChar,
        t15,
        t35,
        T_istek: tReq,
        T_yanit: tResp,
        T_cevrim: tCycle,
        f_cevrim: 1 / tCycle,
        L_kilavuz: lGuide,
      },
      steps,
      checks,
    };
  },
};
