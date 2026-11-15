/**
 * Mekanik tahrik hesaplarının (6.1–6.5) ortak yardımcıları ve kaynak referansları. Yalnızca bu hesaplar kullanır.
 */
import { formatQuantity, fromSI } from "@/lib/units";
import { autoOutputUnit } from "@/lib/calc/auto-unit";
import { latexNum, latexQty, latexSpec } from "@/lib/calc/latex";
import type {
  ComputeInputs,
  InputSpec,
  NumberInputSpec,
  NumberListInputSpec,
  OutputSpec,
  Reference,
} from "@/lib/calc/types";

/** Standart yerçekimi ivmesi g_n, m/s² (tanım gereği tam; birim kataloğundaki kgf ile aynı değer) */
export const G_N = 9.80665;

/** Zorunlu sayı girdisi; yoksa programlama hatasıdır (motor doğrulamadan geçmiş girdi verir). */
export function num(inputs: ComputeInputs, key: string, where: string): number {
  const v = inputs[key];
  if (typeof v !== "number") throw new Error(`${where}: "${key}" sayı değil`);
  return v;
}

/** Zorunlu liste girdisi */
export function list(inputs: ComputeInputs, key: string, where: string): number[] {
  const v = inputs[key];
  if (!Array.isArray(v)) throw new Error(`${where}: "${key}" liste değil`);
  return v;
}

type AnySpec = NumberInputSpec | NumberListInputSpec | OutputSpec;

/** Anahtarıyla sayısal girdi/çıktı tanımını bulur; adımlarda kartla aynı birimi yazmak için. */
export function specOf(specs: readonly (InputSpec | OutputSpec)[], key: string): AnySpec {
  const s = specs.find((x) => x.key === key);
  if (!s || ("kind" in s && s.kind === "select")) throw new Error(`tahrik-ortak: "${key}" sayısal tanımı yok`);
  return s as AnySpec;
}

/**
 * Bir tanım listesine bağlı LaTeX yazıcı: q("T", 1.768) → "1{,}768\,\mathrm{N \cdot m}" (tanımın varsayılan birimi;
 * otomatik birimli boyutlarda — güç, frekans, zaman — kartla aynı otomatik birim).
 */
export function specWriter(specs: readonly (InputSpec | OutputSpec)[]) {
  return (key: string, valueSI: number) => {
    const s = specOf(specs, key);
    // Çıktıda tanımlı hassasiyet (significant/integer) adımda da kullanılır; kartla aynı basamak.
    const precision =
      "integer" in s && s.integer && !("kind" in s)
        ? { decimals: 0 }
        : "significant" in s && s.significant !== undefined
          ? { significant: s.significant }
          : undefined;
    return latexSpec(s, valueSI, precision);
  };
}

/** Kontrol mesajlarında (düz metin) bir değeri kartla aynı birim ve biçimle yazar. */
export function specText(spec: AnySpec, valueSI: number): string {
  const unit = autoOutputUnit(spec, valueSI);
  return formatQuantity(fromSI(valueSI, unit), unit);
}

/** Açısal hız adımlarda rad/s ile */
export const qOmega = (omegaSI: number) => latexQty(omegaSI, "rad_s");
/** Oranlar (verim, emniyet katsayısı, çevrim oranı) adımlarda düz sayı */
export const qNum = (x: number) => latexNum(x);
/** Açılar adımlarda radyan */
export const qRad = (x: number) => latexQty(x, "rad");

/**
 * Üretici ve standart referansları (yalnızca açılıp doğrulananlar). Açılan sayfalar:
 * - thkIzinDevir:  https://www.thk.com/eu/en/products/ball_screw/selection/0007/
 * - thkIzinYuk:    https://www.thk.com/eu/en/products/ball_screw/selection/0006/
 * - thkTork:       https://www.thk.com/eu/en/products/ball_screw/selection/0013/
 * - thkGeriTahrik: https://tech.thk.com/en/products/pdf/en_b15_006.pdf (denklem 3, tork örneği)
 * - thkMotor:      https://www.thk.com/eu/en/products/ball_screw/selection/0014/
 * - thkOrnek:      https://tech.thk.com/en/products/pdf/en_b15_069.pdf (çözümlü seçim örneği; testlerde karşılaştırma)
 * - orientalMotor: https://www.orientalmotor.com/technology/motor-sizing-calculations.html (formüller görsel olarak)
 * - gates:         https://www.gates.com/content/dam/documents-library/catalogs/heavy-duty-vbelt-drive-design-manual-en.pdf
 * - khk:           https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html
 */
export const REF = {
  thkIzinDevir: {
    standard: "THK — Ball Screw Selection Criteria",
    title: "Permissible Rotational Speed (kritik devir ve DN değeri)",
    clause: "Denklem (7)",
    note: "N₁ = 60·λ₁²/(2π·ℓb²)·√(E·10³·I/(γ·A))·0,8; λ₁: sabit–serbest 1,875, destekli–destekli 3,142, sabit–destekli 3,927, sabit–sabit 4,73.",
  },
  thkIzinYuk: {
    standard: "THK — Ball Screw Selection Criteria",
    title: "Permissible Axial Load (burkulma yükü, izin verilen çekme/basma yükü)",
    clause: "Denklem (5) ve (6)",
    note: "P₁ = n_b·π²·E·I/ℓa²·0,5; n_b (THK'de η₁): sabit–serbest 0,25, sabit–destekli 2, sabit–sabit 4. P₂ = σ·(π/4)·d₁², σ = 147 MPa.",
  },
  thkTork: {
    standard: "THK — Ball Screw Selection Criteria",
    title: "Studying the Rotational Torque",
    clause: "Denklem (48) ve (49)",
    note: "T₁ = Fa·Ph/(2π·η); J = m·(Ph/2π)²·A² + Js·A² + …; ω′ = 2π·Nm/(60·t).",
  },
  thkGeriTahrik: {
    standard: "THK Genel Kataloğu — Ball Screw, Features of the Ball Screw",
    title: "Relationship between Thrust and Torque",
    clause: "Denklem (1)–(3)",
    note: "Eksenel yükün ürettiği tork T = Ph·η₂·Fa/(2π); η₂: ters (geri) verim.",
  },
  thkMotor: {
    standard: "THK — Ball Screw Selection Criteria",
    title: "Studying the Driving Motor",
    clause: "Denklem (54)–(57)",
    note: "T_rms (54); J_M = J/C, C normalde 3–10, motora ve sürücüye göre değişir (55); adım açısı E = 360·S/(Ph·A) (56); darbe hızı f = V/S (57); step motorda hesaplanan tork normalde iki katına çıkarılır.",
  },
  thkOrnek: {
    standard: "THK — Example Ball Screw Selections",
    title: "High-speed Transfer Equipment (Horizontal Use)",
    note: "Çözümlü seçim örneği: burkulma, kritik devir, atalet, hızlanma torku, efektif tork.",
  },
  orientalMotor: {
    standard: "Oriental Motor — Motor Sizing Calculations",
    title: "Yük torku, atalet, hızlanma torku, gerekli tork ve efektif yük torku",
    note: "T_M = (T_L + T_a)·S_f; T_a = J·α; J = m·(A/2π)²; kayış/kremayer T_L = F·D/(2·η·i); F = F_A + m·g·(sin θ + μ·cos θ); T_rms = √(((T_a+T_L)²·t₁ + T_L²·t₂ + (T_d−T_L)²·t₃)/t_f).",
  },
  gates: {
    standard: "Gates Heavy Duty V-Belt Drive Design Manual",
    title: "Center Distance and Belt Length",
    clause: "Formula No. 13",
    note: "Belt Length = 2C + 1,57·(D + d) + (D − d)²/(4C); hız oranı ve kayış hızı hatve (pitch) çapıyla, kayış boyu datum çapıyla hesaplanır.",
  },
  khk: {
    standard: "KHK Gears — Gear Technical Reference",
    title: "Calculation of Gear Dimensions",
    clause: "4.1 Düz dişliler: Tablo 4.1 (referans çap d = z·m); (3) Kremayer ve düz dişli",
    note: "Dişlinin bir devri kremayeri referans dairesinin çevresi (π·d) kadar ilerletir.",
  },
  iso80000_4: {
    standard: "ISO 80000-4",
    title: "Büyüklükler ve birimler — Bölüm 4: Mekanik",
    note: "Kuvvet, tork, güç, eylemsizlik momenti tanımları",
  },
} satisfies Record<string, Reference>;
