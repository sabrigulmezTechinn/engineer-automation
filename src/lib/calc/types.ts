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

/**
 * Aynı boyutta birden çok değer (ör. seri dirençler, yük listesi). Kullanıcı değerleri tek alana
 * noktalı virgül veya satır sonuyla ayırarak yazar ("10; 22; 47"); seçilen birim hepsine uygulanır.
 * compute'a SI değerlerden oluşan `number[]` olarak gelir.
 */
export interface NumberListInputSpec extends InputBase {
  kind: "numberList";
  dimension: Dimension;
  defaultUnit: string;
  units?: string[];
  /** Varsayılan değerler, defaultUnit cinsinden */
  default?: number[];
  /** Her eleman için SI cinsinden sınırlar */
  min?: number;
  max?: number;
  minExclusive?: boolean;
  integer?: boolean;
  /** En az / en fazla eleman sayısı (varsayılan 1 / 50) */
  minItems?: number;
  maxItems?: number;
  optional?: boolean;
}

export interface SelectInputSpec extends InputBase {
  kind: "select";
  options: { value: string; label: string }[];
  default: string;
}

export type InputSpec = NumberInputSpec | NumberListInputSpec | SelectInputSpec;

export interface OutputSpec {
  key: string;
  label: string;
  symbol?: string;
  dimension: Dimension;
  defaultUnit: string;
  units?: string[];
  /**
   * Kullanıcı birim seçmediyse gösterim birimi değere göre otomatik seçilsin mi
   * (0,005 A → 5 mA). Yalnızca varsayılan birimin 10³ⁿ katı olan kardeşleri arasında seçilir
   * (A → mA/kA; bar → mbar, kPa'ya geçmez). Verilmezse elektrik büyüklüklerinde açık,
   * mekanik büyüklüklerde kapalıdır (ör. uzunluk teknik resimdeki gibi mm'de kalır).
   */
  autoUnit?: boolean;
  /** Gösterimde anlamlı basamak sayısı (varsayılan 4). Ör. 17971,2 gibi değerler için 6. */
  significant?: number;
  /** Tam sayı çıktısı (sayım, adım sayısı): yuvarlanmadan, ondalıksız gösterilir (16384 → "16 384"). */
  integer?: boolean;
  /**
   * Gösterimde birim sembolü yerine yazılacak etiket (ör. dB biriminde "dBm", "dBV"). Yalnızca tek birimli
   * çıktılarda anlamlıdır; birim dönüşümünü etkilemez.
   */
  unitLabel?: string;
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

/**
 * compute'a giden doğrulanmış girdiler: sayılar SI, numberList'ler SI `number[]`, select'ler string.
 * Gizli/boş isteğe bağlı girdiler yoktur.
 */
export type ComputeInputs = Record<string, number | string | number[]>;

export interface CalcContext {
  limits: Limits;
}

export interface CalcResult {
  /** SI cinsinden çıktılar; anahtarlar OutputSpec.key. Bu girdilerle anlamsız olan çıktı atlanabilir. */
  outputs: Record<string, number>;
  steps: Step[];
  checks: Check[];
}

/** Genel form yerine özel arayüzle gösterilen hesaplar (src/components/calc/custom/) */
export type CustomUiId = "birim-donusturucu" | "renk-kodu";

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
  /**
   * Verilirse hesap sayfası genel form yerine bu özel arayüzü gösterir. Özel arayüz de durumunu
   * InputState olarak tutar ve sonucu runCalc ile alır (kaydetme/karşılaştırma/PDF aynı yoldan çalışsın).
   */
  customUi?: CustomUiId;
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
  /** Gösterilecek birim metni: OutputSpec.unitLabel varsa o, yoksa birim sembolü */
  unitSymbol: string;
  formatted: string; // ör. "1,5 kV"
  /** Yalnızca sayı, çıktının hassasiyetiyle biçimlenmiş (ör. "1,5"); kartta birim ayrı gösterilir. */
  formattedValue: string;
}

/** runCalc seçenekleri (kullanıcı tercihleri dahil) */
export interface RunOptions {
  ctx?: CalcContext;
  /** Çıktı başına kullanıcının seçtiği gösterim birimi (output key → unit id) */
  outputUnits?: Record<string, string>;
  /** Hassasiyeti tanımda belirtilmemiş çıktılar için varsayılan anlamlı basamak (profil tercihi; varsayılan 4) */
  significant?: number;
  /**
   * Boyut başına tercih edilen gösterim birimi (ör. imperial tercihinde güç → hp). Kullanıcı o çıktı için
   * birim seçmediyse ve birim çıktının izinli birimleri arasındaysa otomatik seçimden önce gelir.
   */
  preferredUnits?: Partial<Record<Dimension, string>>;
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
