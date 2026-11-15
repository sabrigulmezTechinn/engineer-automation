/**
 * Hesap motoru sözleşmesi.
 *
 * Kurallar:
 * - Hesap tanımları istemcide de içe aktarılabilir (anlık doğrulama için): sunucuya özgü bir şey içe aktarmaz.
 * - `compute` saf bir fonksiyondur: aynı SI girdileriyle hep aynı sonucu döner, yan etkisi yoktur.
 * - Motorun içinde tüm sayısal değerler SI birimindedir. Birim çevirisi yalnızca giriş/çıkışta yapılır.
 * - Kaydetme ve karşılaştırma (Faz 2) `InputState`'i saklar; bu yüzden InputState düz JSON'dur.
 * - Yönetmelik/standart sınır değerleri koddan ayrı tutulur (src/config/sinirlar.ts) ve `ctx.limits` ile gelir.
 */
import type { Dimension } from "@/lib/units/types";
import type { Limits } from "@/config/sinirlar";

export type CategoryId =
  | "temel-elektrik"
  | "tesisat"
  | "motor"
  | "elektronik"
  | "otomasyon"
  | "mekatronik"
  | "yardimci";

export interface Reference {
  /** Standart veya kaynak numarası, ör. "IEC 60364-5-52" */
  standard: string;
  /** Standardın adı */
  title?: string;
  /** Madde / ek, ör. "Ek G" */
  clause?: string;
  note?: string;
}

export interface Formula {
  label: string;
  /** KaTeX ile gösterilecek LaTeX, ör. "V = I \\cdot R" */
  latex: string;
}

interface InputBase {
  key: string;
  label: string;
  /** LaTeX sembolü, ör. "R_1" */
  symbol?: string;
  help?: string;
  /** Yalnızca belirtilen select girdisi belirtilen değerdeyken gösterilir ve doğrulanır. */
  visibleWhen?: { key: string; equals: string | string[] };
}

export interface NumberInputSpec extends InputBase {
  kind: "number";
  dimension: Dimension;
  /** Varsayılan gösterim birimi (unit id) */
  defaultUnit: string;
  /** Seçilebilir birimler; verilmezse boyutun tüm birimleri */
  units?: string[];
  /** Varsayılan değer, defaultUnit cinsinden */
  default?: number;
  /** SI cinsinden sınırlar */
  min?: number;
  max?: number;
  /** true ise min dahil değildir (ör. direnç > 0) */
  minExclusive?: boolean;
  integer?: boolean;
  optional?: boolean;
}

export interface SelectInputSpec extends InputBase {
  kind: "select";
  options: { value: string; label: string }[];
  default: string;
}

export type InputSpec = NumberInputSpec | SelectInputSpec;

export interface OutputSpec {
  key: string;
  label: string;
  symbol?: string;
  dimension: Dimension;
  defaultUnit: string;
  units?: string[];
}

/** Ara adım: formülün değerler yerine konmuş hali */
export interface Step {
  label: string;
  latex: string;
}

export type CheckLevel = "ok" | "uyari" | "hata";

/** Standart sınırına göre durum göstergesi veya fiziksel anlamsızlık uyarısı */
export interface Check {
  level: CheckLevel;
  message: string;
  reference?: Reference;
}

/** compute'a giden doğrulanmış girdiler: sayılar SI, select'ler string. Gizli/boş isteğe bağlı girdiler yoktur. */
export type ComputeInputs = Record<string, number | string>;

export interface CalcContext {
  limits: Limits;
}

export interface CalcResult {
  /** SI cinsinden çıktılar; anahtarlar OutputSpec.key. Bu girdilerle anlamsız olan çıktı atlanabilir. */
  outputs: Record<string, number>;
  steps: Step[];
  checks: Check[];
}

export interface CalcDefinition {
  /** KAPSAM.md numarası, ör. "1.1" */
  id: string;
  /** URL parçası, ör. "ohm-yasasi" */
  slug: string;
  category: CategoryId;
  title: string;
  description: string;
  formulas: Formula[];
  references: Reference[];
  inputs: InputSpec[];
  outputs: OutputSpec[];
  /** Alan bazlı doğrulamadan sonra çapraz alan kontrolleri; "hata" seviyesinde compute çalışmaz. */
  validate?: (inputs: ComputeInputs, ctx: CalcContext) => Check[];
  compute: (inputs: ComputeInputs, ctx: CalcContext) => CalcResult;
}

/** Kaydedilebilir, düz JSON girdi durumu. select girdilerinde unit yoktur. */
export type InputState = Record<string, { value: string; unit?: string }>;

/** Gösterime hazır çıktı */
export interface PresentedOutput {
  key: string;
  label: string;
  symbol?: string;
  value: number; // seçili birimde
  unit: string; // unit id
  formatted: string; // ör. "1,5 kV"
}

export type RunResult =
  | {
      ok: true;
      inputsSI: ComputeInputs;
      result: CalcResult;
      outputs: PresentedOutput[];
    }
  | {
      ok: false;
      /** Alan bazlı hatalar (anahtar: input key) */
      fieldErrors: Record<string, string>;
      /** validate'ten gelen çapraz alan kontrolleri */
      checks: Check[];
    };

export interface CategoryMeta {
  id: CategoryId;
  title: string;
  description: string;
}
