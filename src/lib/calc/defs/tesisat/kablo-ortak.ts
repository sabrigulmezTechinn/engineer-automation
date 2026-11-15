/**
 * Kablo ve koruma hesaplarının (2.1–2.3) ortak yardımcıları (yalnızca bu klasör kullanır).
 *
 * Aşırı yük koruması koordinasyonu (IEC 60364-4-43): I_b ≤ I_n ≤ I_z ve I₂ ≤ 1,45·I_z.
 * I₂ (koruma cihazının belirlenen sürede kesin açtığı akım) koruma tipine göre I_n'nin katıdır; oranlar
 * src/config/sinir/tesisat-kablo.ts'te kaynaklarıyla tutulur (ctx.limits.tesisatKablo.koruma).
 */
import { LIMITS, type Limits } from "@/config/sinirlar";
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexNum, latexSpec } from "@/lib/calc/latex";
import type { Check, ComputeInputs, OutputSpec, Reference, Step } from "@/lib/calc/types";
import { formatQuantity, fromSI } from "@/lib/units";

export type KorumaTipi = "mcb" | "gG" | "kompakt";
export type KorumaLimitleri = Limits["tesisatKablo"]["koruma"];

/** Zorunlu sayı girdisi; yoksa programlama hatasıdır (motor doğrulamadan geçmiş girdi verir). */
export function num(inputs: ComputeInputs, key: string, where: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`${where}: "${key}" sayı değil`);
  return v;
}

/** İsteğe bağlı veya gizli olabilen sayı girdisi; yoksa undefined. */
export function optNum(inputs: ComputeInputs, key: string): number | undefined {
  const v = inputs[key];
  return typeof v === "number" ? v : undefined;
}

/** a ≤ b, kayan nokta payıyla (ör. 0,025 kA → 25,000000000000004 A sınırı ihlal saymasın). */
export function lte(a: number, b: number): boolean {
  return a <= b + 1e-9 * Math.max(Math.abs(a), Math.abs(b));
}

/** Adımlarda karşılaştırma işareti */
export function latexRel(a: number, b: number): string {
  return lte(a, b) ? "\\leq" : ">";
}

/** Akım gösterimi: kartlarla aynı birim seçimi (A, kA…) */
export const AKIM_SPEC: Pick<OutputSpec, "dimension" | "defaultUnit"> = { dimension: "akim", defaultUnit: "A" };
export const qI = (amper: number) => latexSpec(AKIM_SPEC, amper);

/** Kontrol mesajlarında akım düz metin olarak, kartlarla aynı biçimde (ör. "51,1 A") */
export function akimMetni(amper: number): string {
  const unit = autoOutputUnit(AKIM_SPEC, amper);
  return formatQuantity(fromSI(amper, unit), unit);
}

/**
 * Sıcaklık düzeltme katsayısı (iletken sıcaklığı sabitken ısı atımı ΔT ile orantılı, kayıp I² ile orantılı):
 * k_t = √((θ_maks − θ_ort) / (θ_maks − θ_ref)). Sıcaklıklar K (farklar °C ile aynı).
 */
export function sicaklikKatsayisi(thetaMaks: number, thetaOrtam: number, thetaRef: number): number {
  return Math.sqrt((thetaMaks - thetaOrtam) / (thetaMaks - thetaRef));
}

/**
 * I₂/I_n oranı. Kullanıcı veri sayfasından verdiyse o kullanılır; yoksa koruma tipinin kaynaklı değeri.
 * gG sigortada I_n < 16 A için açılan kaynaklarda değer yok: undefined döner (I₂ koşulu denetlenemez).
 */
export function i2Katsayisi(tip: KorumaTipi, In: number, koruma: KorumaLimitleri, k2Kullanici?: number): number | undefined {
  if (k2Kullanici !== undefined) return k2Kullanici;
  if (tip === "mcb") return koruma.mcbI2Katsayisi;
  if (tip === "kompakt") return koruma.kompaktI2Katsayisi;
  return lte(koruma.gGI2KatsayisiAltSinir, In) ? koruma.gGI2Katsayisi : undefined;
}

/** Tam koordinasyon: I_b ≤ I_n ≤ I_z ve (I₂ biliniyorsa) I₂ ≤ k·I_z. */
export function koordinasyonSaglaniyor(Ib: number, In: number, Iz: number, I2: number | undefined, k145: number): boolean {
  return lte(Ib, In) && lte(In, Iz) && (I2 === undefined || lte(I2, k145 * Iz));
}

/**
 * Kabloya bağlı koşullar (kesit seçiminde): I_z ≥ I_b, koruma varsa I_z ≥ I_n ve (I₂ biliniyorsa) I₂ ≤ k·I_z.
 * I_b ≤ I_n kabloya bağlı değildir; ayrıca denetlenir.
 */
export function kabloKosullariSaglaniyor(
  Ib: number,
  Iz: number,
  In: number | undefined,
  I2: number | undefined,
  k145: number,
): boolean {
  return lte(Ib, Iz) && (In === undefined || lte(In, Iz)) && (I2 === undefined || lte(I2, k145 * Iz));
}

/** gG sigortada I₂/I_n girdisinin yardım metni (2.1 ve 2.3); oran ve alt sınır config'ten yazılır. */
export const K2_YARDIM = (() => {
  const k = LIMITS.tesisatKablo.koruma;
  const oran = String(k.gGI2Katsayisi).replace(".", ",");
  return `Boş bırakılırsa I_n ≥ ${k.gGI2KatsayisiAltSinir} A için ${oran} alınır (IEC 60269, gG). I_n < ${k.gGI2KatsayisiAltSinir} A için oranın kaynağı açılamadı: sigorta veri sayfasındaki geleneksel erime akımından girin.`;
})();

export const REF_IEC_60364_4_43: Reference = {
  standard: "IEC 60364-4-43",
  title: "Alçak gerilim elektrik tesisleri — Bölüm 4-43: Güvenlik için koruma — Aşırı akıma karşı koruma",
  note: "Aşırı yük koruması koordinasyonu: I_b ≤ I_n ≤ I_z ve I₂ ≤ 1,45·I_z",
};

export const REF_IEC_60898_1: Reference = {
  standard: "IEC 60898-1",
  title:
    "Elektrik aksesuarları — Ev ve benzeri tesisler için aşırı akım koruması devre kesicileri — Bölüm 1: AC işletme için devre kesiciler",
  note: "Geleneksel açma akımı I₂ = 1,45·I_n; anlık açma bölgesi B 3–5·I_n, C 5–10·I_n, D 10–20·I_n (Hager kataloğu, Tablo 2)",
};

export const REF_IEC_60269: Reference = {
  standard: "IEC 60269-1, IEC 60269-2",
  title: "Alçak gerilim sigortaları",
  note: "gG, I_n ≥ 16 A: geleneksel erime akımı I_f = 1,6·I_n (Enel GSCL004 Tablo 6). I_n < 16 A için oranın kaynağı açılamadı; sigorta veri sayfasından girilmelidir.",
};

export const REF_IEC_60947_2: Reference = {
  standard: "IEC 60947-2",
  title: "Alçak gerilim anahtarlama ve kontrol düzenleri — Bölüm 2: Devre kesiciler",
  note: "Geleneksel açma akımı 1,3 × ayar akımı I_r (Schneider Electric SSS FA369327)",
};

export function korumaReferansi(tip: KorumaTipi): Reference {
  if (tip === "mcb") return REF_IEC_60898_1;
  if (tip === "gG") return REF_IEC_60269;
  return REF_IEC_60947_2;
}

const MESSAGES = {
  ibInIz: (ib: string, inn: string, iz: string, s: string) => `I_b ≤ ${s} ≤ I_z sağlanıyor: ${ib} ≤ ${inn} ≤ ${iz}.`,
  ibAboveIn: (ib: string, inn: string, s: string) =>
    `Koruma akımı tasarım akımından küçük (${s} = ${inn} < I_b = ${ib}): koruma normal işletmede açar, I_b ≤ ${s} sağlanmalıdır.`,
  inAboveIz: (inn: string, iz: string, s: string) =>
    `Koruma akımı kablonun akım taşıma kapasitesini aşıyor (${s} = ${inn} > I_z = ${iz}): kablo aşırı yüke karşı korunmuyor.`,
  ibIz: (ib: string, iz: string) => `I_b ≤ I_z sağlanıyor: ${ib} ≤ ${iz}.`,
  ibAboveIz: (ib: string, iz: string) => `Kablo yükü taşıyamıyor: I_b = ${ib} > I_z = ${iz}.`,
  i2Ok: (i2: string, lim: string) => `I₂ ≤ 1,45·I_z sağlanıyor: ${i2} ≤ ${lim}.`,
  i2Fail: (i2: string, lim: string) =>
    `I₂ ≤ 1,45·I_z sağlanmıyor (${i2} > ${lim}): koruma, kabloyu aşırı yükte yeterince hızlı açmaz. Kesiti büyütün veya I₂'si daha küçük bir koruma seçin.`,
  i2Unknown:
    "I₂ doğrulanamadı: gG sigortada I_n < 16 A için geleneksel erime akımı oranının kaynağı açılamadı. Sigorta veri sayfasından I₂/I_n oranını girin.",
} as const;

/**
 * Koordinasyon kontrolleri (ok/uyarı, IEC 60364-4-43 referansıyla). `In` verilmezse (koruma yok) yalnızca I_b ≤ I_z.
 * `I2Bilinmiyor` true ise I₂ denetlenemediği için uyarı eklenir.
 */
export function koordinasyonKontrolleri(p: {
  Ib: number;
  Iz: number;
  In?: number;
  I2?: number;
  I2Bilinmiyor?: boolean;
  k145: number;
  /** Mesajda koruma akımının adı: "I_n" veya kompakt şalterde "I_r" */
  sembol?: string;
}): Check[] {
  const s = p.sembol ?? "I_n";
  const ref = REF_IEC_60364_4_43;
  const checks: Check[] = [];
  const ib = akimMetni(p.Ib);
  const iz = akimMetni(p.Iz);
  if (p.In !== undefined) {
    const inn = akimMetni(p.In);
    const a = lte(p.Ib, p.In);
    const b = lte(p.In, p.Iz);
    if (a && b) checks.push({ level: "ok", message: MESSAGES.ibInIz(ib, inn, iz, s), reference: ref });
    if (!a) checks.push({ level: "uyari", message: MESSAGES.ibAboveIn(ib, inn, s), reference: ref });
    if (!b) checks.push({ level: "uyari", message: MESSAGES.inAboveIz(inn, iz, s), reference: ref });
  } else if (lte(p.Ib, p.Iz)) {
    checks.push({ level: "ok", message: MESSAGES.ibIz(ib, iz), reference: ref });
  } else {
    checks.push({ level: "uyari", message: MESSAGES.ibAboveIz(ib, iz), reference: ref });
  }
  if (p.I2 !== undefined) {
    const lim = p.k145 * p.Iz;
    const msg = lte(p.I2, lim) ? MESSAGES.i2Ok : MESSAGES.i2Fail;
    checks.push({ level: lte(p.I2, lim) ? "ok" : "uyari", message: msg(akimMetni(p.I2), akimMetni(lim)), reference: ref });
  } else if (p.I2Bilinmiyor) {
    checks.push({ level: "uyari", message: MESSAGES.i2Unknown, reference: REF_IEC_60269 });
  }
  return checks;
}

/** Koordinasyon adımları: I_b ≤ I_n ≤ I_z ve I₂ = k₂·I_n ≤ 1,45·I_z (değerler yerine konmuş). */
export function koordinasyonAdimlari(p: {
  Ib: number;
  Iz: number;
  In?: number;
  k2?: number;
  k145: number;
  sembol?: string;
}): Step[] {
  const s = p.sembol ?? "I_n";
  const steps: Step[] = [];
  if (p.In !== undefined) {
    steps.push({
      label: `Koordinasyon: I_b ≤ ${s} ≤ I_z`,
      latex: `I_b = ${qI(p.Ib)} \\;${latexRel(p.Ib, p.In)}\\; ${s} = ${qI(p.In)} \\;${latexRel(p.In, p.Iz)}\\; I_z = ${qI(p.Iz)}`,
    });
    if (p.k2 !== undefined) {
      const I2 = p.k2 * p.In;
      const lim = p.k145 * p.Iz;
      steps.push({
        label: "Koordinasyon: I₂ ≤ 1,45·I_z",
        latex: `I_2 = k_2 \\cdot ${s} = ${fmt(p.k2)} \\cdot ${qI(p.In)} = ${qI(I2)} \\;${latexRel(I2, lim)}\\; ${fmt(p.k145)} \\cdot I_z = ${fmt(p.k145)} \\cdot ${qI(p.Iz)} = ${qI(lim)}`,
      });
    }
  } else {
    steps.push({
      label: "Koşul: I_b ≤ I_z",
      latex: `I_b = ${qI(p.Ib)} \\;${latexRel(p.Ib, p.Iz)}\\; I_z = ${qI(p.Iz)}`,
    });
  }
  return steps;
}

/** Boyutsuz katsayı LaTeX'te (1,45; 0,866) */
const fmt = (x: number) => latexNum(x);
