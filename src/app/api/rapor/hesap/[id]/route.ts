/**
 * GET /api/rapor/hesap/[id] — kayıtlı bir hesabın PDF raporu. Giriş gerekir; kayıt oturumdaki kullanıcıya ait
 * değilse ya da yoksa 404 (varlık sızdırılmaz). Durum, hesap sayfasıyla aynı biçimde tanımın varsayılanlarıyla
 * tamamlanır; kayıtlı çıktı birimleri ve profil tercihleri uygulanır.
 */
import { defaultState } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import { hesapGetir } from "@/lib/kayit/islemler";
import { hesapRaporuPdf } from "@/lib/rapor/belgeler";
import { hesapRaporuOlustur } from "@/lib/rapor/model";
import type { RaporBasligi } from "@/lib/rapor/types";
import { hatadanYanit, IstekHatasi, pdfYaniti, zorunluOturum } from "../../_lib/ortak";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const oturum = await zorunluOturum();
    const kayit = await hesapGetir(oturum.userId, id);
    if (!kayit) throw new IstekHatasi(404, "Kayıt bulunamadı.");
    const def = getCalc(kayit.hesapSlug);
    if (!def) throw new IstekHatasi(404, "Bu kaydın hesap türü artık mevcut değil.");

    // use-calc-state.ts initialState ile aynı: tanıma sonradan eklenen girdiler varsayılanla gelir.
    const state = { ...defaultState(def), ...kayit.girdiler };
    const rapor = hesapRaporuOlustur(def, state, {
      ...oturum.tercihler,
      outputUnits: kayit.ciktiBirimleri,
      kayitAdi: kayit.ad,
      notlar: kayit.notlar,
    });
    const baslik: RaporBasligi = {
      baslik: kayit.ad,
      altBaslik: `${def.id} · ${def.title}`,
      kullanici: oturum.kullanici,
      tarih: new Date().toISOString(),
    };
    return pdfYaniti(await hesapRaporuPdf(baslik, rapor), kayit.ad);
  } catch (error) {
    return hatadanYanit(error, "GET /api/rapor/hesap/[id]");
  }
}
