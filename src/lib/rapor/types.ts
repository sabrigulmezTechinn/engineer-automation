/**
 * Rapor (KAPSAM §3.5) sözleşmesi: tek hesap, proje ve karşılaştırma raporlarının ortak veri modeli.
 * Model saf ve düz JSON'dur; PDF (pdfmake) bu modelden üretilir.
 */
import type { Check, Formula, PresentedOutput, Reference, Step } from "@/lib/calc/types";

export interface RaporKullanici {
  ad: string;
  sirket?: string | null;
  unvan?: string | null;
}

/** Her raporun başlık bilgisi */
export interface RaporBasligi {
  baslik: string;
  altBaslik?: string;
  /** Giriş yapmış kullanıcı; anonim raporda yok */
  kullanici?: RaporKullanici;
  /** ISO tarih-saat */
  tarih: string;
}

export interface RaporGirdisi {
  key: string;
  label: string;
  symbol?: string;
  /** Biçimlenmiş, birimli değer (ör. "2,2 kΩ") ya da seçilen seçeneğin etiketi */
  deger: string;
}

export interface HesapRaporu {
  hesapId: string;
  hesapSlug: string;
  baslik: string;
  aciklama: string;
  /** Kayıtlı hesabın adı ve notları (varsa) */
  kayitAdi?: string;
  notlar?: string | null;
  /** Yalnızca görünür girdiler, tanım sırasıyla */
  girdiler: RaporGirdisi[];
  formuller: Formula[];
  adimlar: Step[];
  ciktilar: PresentedOutput[];
  kontroller: Check[];
  referanslar: Reference[];
  /** runCalc başarılı mı; değilse hataMesajlari alan hatalarını içerir */
  basarili: boolean;
  hataMesajlari: string[];
}
