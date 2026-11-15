/**
 * Karşılaştırma (KAPSAM §3.4) sözleşmesi: senaryo ve kayıtlı hesap karşılaştırması, değer taraması (grafik).
 * Hepsi düz JSON; web sayfası ve PDF raporu aynı nesneleri kullanır.
 */
import type { Check, CheckLevel, InputState } from "@/lib/calc/types";

/** Aynı hesabın bir girdi varyantı (senaryo ya da kayıtlı hesap) */
export interface Senaryo {
  id: string;
  ad: string;
  state: InputState;
  /** Kayıtlı hesaptan geliyorsa kimliği */
  kayitId?: string;
}

export interface SenaryoDurumu {
  /** runCalc başarılı mı */
  ok: boolean;
  /** Kontrollerin en kötü seviyesi ("hata" > "uyari" > "ok"); kontrol yoksa null */
  enKotu: CheckLevel | null;
  kontroller: Check[];
}

/**
 * Karşılaştırma tablosunun bir satırı. Bir satırdaki TÜM senaryolar aynı birimle gösterilir (`birim`):
 * otomatik önek seçimi değer başına çalıştığı için aksi halde yan yana "5 mA" ve "1,2 A" çıkardı.
 */
export interface KarsilastirmaSatiri {
  tur: "girdi" | "cikti";
  key: string;
  label: string;
  symbol?: string;
  /** Ortak gösterim birimi (unit id); select girdilerinde ve birimsiz değerlerde "" */
  birim: string;
  /** Gösterilecek birim metni (unitLabel varsa o) */
  birimSembolu: string;
  /** Senaryo başına biçimlenmiş değer (birimsiz); gizli girdi veya hesaplanmayan çıktıda null */
  degerler: (string | null)[];
  /** Senaryo başına ortak birimdeki sayısal değer (grafik/sıralama için); sayısal olmayan satırda null */
  sayisal: (number | null)[];
  /** Senaryolar arasında farklı mı (vurgulanır) */
  farkli: boolean;
}

export interface Karsilastirma {
  hesapSlug: string;
  hesapId: string;
  baslik: string;
  senaryolar: { id: string; ad: string; durum: SenaryoDurumu }[];
  satirlar: KarsilastirmaSatiri[];
}

/** Bir girdinin aralıkta taranması (ör. kesit 1,5 → 25 mm² için gerilim düşümü) */
export interface TaramaAyari {
  girdiKey: string;
  ciktiKey: string;
  /** Başlangıç ve bitiş, girdinin `birim` cinsinden */
  baslangic: number;
  bitis: number;
  birim: string;
  /** Nokta sayısı (2–200) */
  noktaSayisi: number;
}

export interface TaramaNoktasi {
  /** Girdi değeri, `xBirim` cinsinden */
  x: number;
  /** Çıktı değeri, `yBirim` cinsinden; hesaplanamadıysa null */
  y: number | null;
  /** O noktadaki kontrollerin en kötü seviyesi (uygun olmayan bölgeyi işaretlemek için) */
  seviye: CheckLevel | null;
}

export interface TaramaSerisi {
  girdiKey: string;
  ciktiKey: string;
  xEtiket: string;
  yEtiket: string;
  /** Eksen birimleri (unit id) ve gösterim metinleri; tüm seri tek birimle */
  xBirim: string;
  yBirim: string;
  xBirimSembolu: string;
  yBirimSembolu: string;
  noktalar: TaramaNoktasi[];
}

export interface GrafikSecenekleri {
  /** px/pt; varsayılan 640 × 320 */
  genislik?: number;
  yukseklik?: number;
  baslik?: string;
}
