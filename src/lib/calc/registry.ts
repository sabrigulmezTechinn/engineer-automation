/**
 * Hesap kayıt defteri.
 * Yeni hesaplar `src/lib/calc/defs/<kategori>/<slug>.ts` altında tanımlanır ve o kategorinin
 * `defs/<kategori>/index.ts` listesine eklenir; bu dosya yalnızca kategori listelerini birleştirir.
 * Modül yüklenirken tanımlar doğrulanır; hatalı tanım varsa yükleme fırlatır (geliştirmede erken yakalanır).
 */
import { ELEKTRONIK } from "./defs/elektronik";
import { MEKATRONIK } from "./defs/mekatronik";
import { MOTOR } from "./defs/motor";
import { OTOMASYON } from "./defs/otomasyon";
import { TEMEL_ELEKTRIK } from "./defs/temel-elektrik";
import { TESISAT } from "./defs/tesisat";
import { YARDIMCI } from "./defs/yardimci";
import type { CalcDefinition, CategoryId, CategoryMeta } from "./types";

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "temel-elektrik",
    title: "Temel elektrik",
    description: "Ohm yasası, seri/paralel devreler, AC güç, reaktans ve dB gibi temel devre hesapları.",
  },
  {
    id: "tesisat",
    title: "Elektrik tesisat ve güç",
    description: "Kablo kesiti, gerilim düşümü, koruma seçimi, kompanzasyon, kısa devre ve topraklama hesapları.",
  },
  {
    id: "motor",
    title: "Motor ve sürücü",
    description: "Güç–tork–devir, motor akımı, yol verme, sürücü seçimi ve motor verimi hesapları.",
  },
  {
    id: "elektronik",
    title: "Elektronik",
    description: "LED direnci, filtreler, op-amp, regülatörler, dönüştürücüler, PCB ve ısıl hesaplar.",
  },
  {
    id: "otomasyon",
    title: "Otomasyon ve PLC",
    description: "Analog ölçekleme, enkoder, sıcaklık sensörleri, 24 VDC yük, PID ve haberleşme hesapları.",
  },
  {
    id: "mekatronik",
    title: "Mekatronik ve mekanik tahrik",
    description: "Dişli ve kayış oranları, vidalı mil, step ve servo, pnömatik, hidrolik ve rulman hesapları.",
  },
  {
    id: "yardimci",
    title: "Yardımcı araçlar",
    description: "Birim dönüştürücü ve standart değer serileri.",
  },
];

/** Tüm hesap tanımları (sırası önemsiz; allCalcs KAPSAM numarasına göre sıralar). */
const DEFINITIONS: CalcDefinition[] = [
  ...TEMEL_ELEKTRIK,
  ...TESISAT,
  ...MOTOR,
  ...ELEKTRONIK,
  ...OTOMASYON,
  ...MEKATRONIK,
  ...YARDIMCI,
];

/** KAPSAM numaralarını bölüm bölüm sayısal karşılaştırır: "4.9" < "4.10". */
export function compareCalcIds(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

const ID_PATTERN = /^\d+\.\d+$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/**
 * Tanımları yapısal olarak doğrular; sorunları Türkçe metin listesi olarak döner (boşsa geçerli).
 * Birim kimlikleri burada denetlenmez (birim sistemini yükleme anında çağırmamak için);
 * bunu entegrasyon testi yapar.
 */
export function validateDefinitions(defs: CalcDefinition[]): string[] {
  const problems: string[] = [];
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));

  for (const id of duplicates(defs.map((d) => d.id))) problems.push(`Yinelenen hesap kimliği: ${id}`);
  for (const slug of duplicates(defs.map((d) => d.slug))) problems.push(`Yinelenen slug: ${slug}`);

  for (const def of defs) {
    const where = `${def.id} (${def.slug})`;
    if (!ID_PATTERN.test(def.id)) problems.push(`${where}: kimlik "1.1" biçiminde olmalı`);
    if (!SLUG_PATTERN.test(def.slug)) problems.push(`${where}: slug küçük harf, rakam ve tire içermeli`);
    if (!categoryIds.has(def.category)) problems.push(`${where}: bilinmeyen kategori "${def.category}"`);

    for (const key of duplicates(def.inputs.map((i) => i.key))) problems.push(`${where}: yinelenen girdi anahtarı "${key}"`);
    for (const key of duplicates(def.outputs.map((o) => o.key))) problems.push(`${where}: yinelenen çıktı anahtarı "${key}"`);

    for (const input of def.inputs) {
      const at = `${where} girdi "${input.key}"`;
      if (input.kind === "select") {
        if (input.options.length === 0) problems.push(`${at}: seçenek yok`);
        for (const v of duplicates(input.options.map((o) => o.value))) problems.push(`${at}: yinelenen seçenek "${v}"`);
        if (!input.options.some((o) => o.value === input.default)) {
          problems.push(`${at}: varsayılan "${input.default}" seçenekler arasında değil`);
        }
      } else {
        if (input.units && !input.units.includes(input.defaultUnit)) {
          problems.push(`${at}: varsayılan birim "${input.defaultUnit}" birim listesinde değil`);
        }
        if (input.kind === "numberList") {
          const min = input.minItems ?? 1;
          const max = input.maxItems ?? 50;
          if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || min > max) {
            problems.push(`${at}: minItems/maxItems geçersiz (${min}/${max})`);
          }
          if (input.default && (input.default.length < min || input.default.length > max)) {
            problems.push(`${at}: varsayılan liste ${input.default.length} eleman; ${min}–${max} olmalı`);
          }
        }
      }

      if (input.visibleWhen) {
        const ctrl = def.inputs.find((i) => i.key === input.visibleWhen?.key);
        if (!ctrl || ctrl.kind !== "select" || ctrl.key === input.key) {
          problems.push(`${at}: visibleWhen başka bir select girdisine işaret etmeli ("${input.visibleWhen.key}")`);
        } else {
          const values = Array.isArray(input.visibleWhen.equals) ? input.visibleWhen.equals : [input.visibleWhen.equals];
          for (const v of values) {
            if (!ctrl.options.some((o) => o.value === v)) {
              problems.push(`${at}: visibleWhen değeri "${v}", "${ctrl.key}" seçenekleri arasında değil`);
            }
          }
        }
      }
    }

    for (const output of def.outputs) {
      if (output.units && !output.units.includes(output.defaultUnit)) {
        problems.push(`${where} çıktı "${output.key}": varsayılan birim "${output.defaultUnit}" birim listesinde değil`);
      }
    }
  }
  return problems;
}

function assertValid(defs: CalcDefinition[]): void {
  const problems = validateDefinitions(defs);
  if (problems.length > 0) {
    throw new Error(`Hesap kayıt defteri geçersiz:\n- ${problems.join("\n- ")}`);
  }
}

assertValid(DEFINITIONS);

const SORTED: readonly CalcDefinition[] = [...DEFINITIONS].sort((a, b) => compareCalcIds(a.id, b.id));
const BY_SLUG = new Map(SORTED.map((d) => [d.slug, d]));

/** Tüm hesaplar, KAPSAM numarasına göre sıralı */
export function allCalcs(): CalcDefinition[] {
  return [...SORTED];
}

export function getCalc(slug: string): CalcDefinition | undefined {
  return BY_SLUG.get(slug);
}

/** Bir kategorinin hesapları, KAPSAM numarasına göre sıralı */
export function calcsByCategory(category: CategoryId): CalcDefinition[] {
  return SORTED.filter((d) => d.category === category);
}
