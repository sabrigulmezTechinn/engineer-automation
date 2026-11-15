/**
 * GET /api/rapor/proje/[id] — bir projedeki tüm kayıtlı hesaplar tek PDF'te. Giriş gerekir; proje oturumdaki
 * kullanıcıya ait değilse ya da yoksa 404. Hesaplar KAPSAM numarasına, sonra ada göre sıralanır; tanımı artık
 * bulunmayan kayıtlar atlanır ve özet sayfasında belirtilir. Boş proje de (özet sayfasıyla) raporlanır.
 */
import { defaultState } from "@/lib/calc/engine";
import { compareCalcIds, getCalc } from "@/lib/calc/registry";
import { hesaplariListele, projeGetir } from "@/lib/kayit/islemler";
import { projeRaporuPdf } from "@/lib/rapor/belgeler";
import { RAPOR_TURU } from "@/lib/rapor/metinler";
import { hesapRaporuOlustur } from "@/lib/rapor/model";
import type { HesapRaporu, RaporBasligi } from "@/lib/rapor/types";
import { hatadanYanit, IstekHatasi, pdfYaniti, zorunluOturum } from "../../_lib/ortak";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const oturum = await zorunluOturum();
    const proje = await projeGetir(oturum.userId, id);
    if (!proje) throw new IstekHatasi(404, "Proje bulunamadı.");

    const kayitlar = (await hesaplariListele(oturum.userId, { projeId: proje.id }))
      .slice()
      .sort((a, b) => compareCalcIds(a.hesapId, b.hesapId) || a.ad.localeCompare(b.ad, "tr"));

    const raporlar: HesapRaporu[] = [];
    const atlananlar: string[] = [];
    for (const kayit of kayitlar) {
      const def = getCalc(kayit.hesapSlug);
      if (!def) {
        atlananlar.push(kayit.ad);
        continue;
      }
      raporlar.push(
        hesapRaporuOlustur(
          def,
          { ...defaultState(def), ...kayit.girdiler },
          { ...oturum.tercihler, outputUnits: kayit.ciktiBirimleri, kayitAdi: kayit.ad, notlar: kayit.notlar },
        ),
      );
    }

    const baslik: RaporBasligi = {
      baslik: proje.ad,
      altBaslik: RAPOR_TURU.proje,
      kullanici: oturum.kullanici,
      tarih: new Date().toISOString(),
    };
    const pdf = await projeRaporuPdf(baslik, { ad: proje.ad, aciklama: proje.aciklama }, raporlar, { atlananlar });
    return pdfYaniti(pdf, `${proje.ad} - ${RAPOR_TURU.proje}`);
  } catch (error) {
    return hatadanYanit(error, "GET /api/rapor/proje/[id]");
  }
}
