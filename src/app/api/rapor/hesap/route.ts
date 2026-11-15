/**
 * POST /api/rapor/hesap — kaydedilmemiş (ya da kaydedilmemiş değişiklikleri olan) bir hesabın PDF raporu.
 * Gövde: `{ hesapSlug, girdiler, ciktiBirimleri?, ad? }`. Giriş gerekmez; kullanıcı varsa başlığa eklenir ve
 * profil tercihleri (anlamlı basamak, birim sistemi) uygulanır. Girdiler ve çıktı birimleri tanıma göre süzülür.
 */
import * as z from "zod";
import { defaultState } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import { ciktiBirimleriniSuz, girdileriSuz } from "@/lib/kayit/dogrulama";
import { KAYIT_AD_MAX } from "@/lib/kayit/types";
import { hesapRaporuPdf } from "@/lib/rapor/belgeler";
import { RAPOR_TURU } from "@/lib/rapor/metinler";
import { hesapRaporuOlustur } from "@/lib/rapor/model";
import type { RaporBasligi } from "@/lib/rapor/types";
import { hatadanYanit, IstekHatasi, istegeBagliOturum, jsonGovde, pdfYaniti } from "../_lib/ortak";

const GovdeSemasi = z.object({
  hesapSlug: z.string().min(1).max(100),
  girdiler: z.record(z.string(), z.unknown()),
  ciktiBirimleri: z.record(z.string(), z.unknown()).optional(),
  /** Kayıtlı hesabın adı (kaydedilmemiş değişikliklerle rapor alınırken başlık için) */
  ad: z.string().max(KAYIT_AD_MAX, `Ad en çok ${KAYIT_AD_MAX} karakter olabilir.`).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const govde = await jsonGovde(request, GovdeSemasi);
    const def = getCalc(govde.hesapSlug);
    if (!def) throw new IstekHatasi(400, "Bilinmeyen hesap türü.");

    const oturum = await istegeBagliOturum();
    const state = { ...defaultState(def), ...girdileriSuz(def, govde.girdiler) };
    const outputUnits = ciktiBirimleriniSuz(def, govde.ciktiBirimleri ?? {});
    const ad = govde.ad?.trim() || undefined;

    const rapor = hesapRaporuOlustur(def, state, { ...oturum?.tercihler, outputUnits, ...(ad ? { kayitAdi: ad } : {}) });
    const baslik: RaporBasligi = {
      baslik: ad ?? def.title,
      altBaslik: ad ? `${def.id} · ${def.title}` : RAPOR_TURU.hesap,
      ...(oturum ? { kullanici: oturum.kullanici } : {}),
      tarih: new Date().toISOString(),
    };
    return pdfYaniti(await hesapRaporuPdf(baslik, rapor), ad ?? def.title);
  } catch (error) {
    return hatadanYanit(error, "POST /api/rapor/hesap");
  }
}
