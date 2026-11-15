/**
 * Otomatik gösterim birimi seçimi (0,005455 A → 5,455 mA).
 * Hem çıktı kartları (engine.presentOutputs) hem ara adımlar (latex.latexAuto) bunu kullanır;
 * böylece kart ile adım aynı birimi gösterir. Sunucu ve istemcide çalışır.
 */
import { getUnit, unitsFor } from "@/lib/units";
import type { Dimension, UnitDef } from "@/lib/units/types";
import type { OutputSpec } from "./types";

/**
 * autoUnit verilmemiş çıktılarda otomatik seçimin açık olduğu boyutlar. Mekanik büyüklükler
 * (uzunluk, basınç, tork…) bilerek yoktur: teknik resim mm'de, pnömatik bar'da kalır.
 * veri_hizi de yoktur: baud hızları "9600 Bd" diye yazılır, "9,6 kbit/s" diye değil.
 */
export const AUTO_UNIT_DIMENSIONS: ReadonlySet<Dimension> = new Set<Dimension>([
  "gerilim",
  "akim",
  "direnc",
  "iletkenlik",
  "guc",
  "reaktif_guc",
  "gorunur_guc",
  "enerji",
  "yuk",
  "frekans",
  "kapasitans",
  "enduktans",
  "zaman",
  "direnc_uzunluk",
]);

/** Seçim için gereken alanlar; tam bir OutputSpec de verilebilir. */
type UnitChoiceSpec = Partial<OutputSpec> & Pick<OutputSpec, "dimension" | "defaultUnit">;

/**
 * Değeri 1 ≤ |değer| < 1000 aralığında gösteren birimi seçer. Adaylar: izin verilen birimlerden
 * ofsetsiz olup çarpanı varsayılan birimin 10³ⁿ katı olanlar (ör. kWh → Wh/MWh; J aday değil).
 * Aynı çarpanlı birimlerden (bit/s–Bd, mΩ/m–Ω/km) varsayılan birim, o yoksa listede önce gelen seçilir.
 * Sıfır, sonlu olmayan değer veya otomatik seçimin kapalı olduğu çıktıda varsayılan birim döner.
 */
export function autoOutputUnit(spec: UnitChoiceSpec, valueSI: number): string {
  const enabled = spec.autoUnit ?? AUTO_UNIT_DIMENSIONS.has(spec.dimension);
  if (!enabled || valueSI === 0 || !Number.isFinite(valueSI)) return spec.defaultUnit;
  const base = getUnit(spec.defaultUnit);
  if (base.offset) return spec.defaultUnit;

  const allowed = (spec.units ?? unitsFor(spec.dimension).map((u) => u.id)).map((id) => getUnit(id));
  const byFactor = new Map<number, UnitDef>();
  for (const u of allowed) {
    if (u.offset) continue;
    const n = Math.log10(u.factor / base.factor) / 3;
    if (Math.abs(n - Math.round(n)) >= 1e-9) continue;
    const current = byFactor.get(u.factor);
    if (!current || u.id === base.id) byFactor.set(u.factor, u);
  }
  const family = [...byFactor.values()].sort((a, b) => a.factor - b.factor);
  if (family.length === 0) return spec.defaultUnit;

  const abs = Math.abs(valueSI);
  // 4 anlamlı basamağa yuvarlanmış gösterim ölçüt alınır: 0,99996 A "1000 mA" değil "1 A" olur.
  let chosen = family[0];
  for (const u of family) {
    if (Number((abs / u.factor).toPrecision(4)) >= 1) chosen = u;
  }
  return chosen.id;
}
