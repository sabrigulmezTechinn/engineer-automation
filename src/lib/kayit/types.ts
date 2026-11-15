/**
 * Kaydetme ve projeler (KAPSAM §3.3) sözleşmesi. İstemciye geçebilsin diye tarihler ISO metnidir.
 */
import type { InputState } from "@/lib/calc/types";

export interface Proje {
  id: string;
  ad: string;
  aciklama: string | null;
  createdAt: string;
  updatedAt: string;
  /** Projedeki kayıtlı hesap sayısı (listelerde) */
  hesapSayisi: number;
}

export interface KayitliHesap {
  id: string;
  /** null: projesiz kayıt */
  projeId: string | null;
  hesapSlug: string;
  /** KAPSAM numarası (ör. "2.2"); listelerde sıralama ve gösterim için */
  hesapId: string;
  ad: string;
  notlar: string | null;
  girdiler: InputState;
  ciktiBirimleri: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** Yeni kayıt girdisi. girdiler/ciktiBirimleri kaydetmeden önce hesap tanımına göre süzülür. */
export interface KayitGirdisi {
  hesapSlug: string;
  ad: string;
  notlar?: string | null;
  projeId?: string | null;
  girdiler: InputState;
  ciktiBirimleri?: Record<string, string>;
}

export type KayitGuncelleme = Partial<Pick<KayitGirdisi, "ad" | "notlar" | "projeId" | "girdiler" | "ciktiBirimleri">>;

export interface ProjeGirdisi {
  ad: string;
  aciklama?: string | null;
}

export type KayitHataKodu = "bulunamadi" | "gecersiz";

/**
 * Veri katmanı hatası. Başka kullanıcıya ait kayıt/proje de "bulunamadi" döner (varlık sızdırılmaz).
 */
export class KayitHatasi extends Error {
  constructor(
    public readonly kod: KayitHataKodu,
    message: string,
  ) {
    super(message);
    this.name = "KayitHatasi";
  }
}

/** Ad ve not uzunluk sınırları */
export const KAYIT_AD_MAX = 120;
export const KAYIT_NOT_MAX = 2000;
export const PROJE_AD_MAX = 120;
export const PROJE_ACIKLAMA_MAX = 1000;
