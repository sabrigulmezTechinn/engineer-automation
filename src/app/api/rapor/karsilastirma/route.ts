/**
 * POST /api/rapor/karsilastirma — senaryo karşılaştırması PDF'i (tablo + isteğe bağlı tarama grafiği).
 * Gövde: `{ hesapSlug, senaryolar: { ad, state }[], outputUnits?, tarama? }` (en çok 8 senaryo, tarama en çok
 * 200 nokta). Senaryo kimlikleri sunucuda sırayla verilir (s1, s2, …); tarama İLK senaryodan başlar.
 * Giriş gerekmez; kullanıcı varsa başlığa eklenir ve profil tercihleri uygulanır.
 */
import * as z from "zod";
import { defaultState } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import type { CalcDefinition } from "@/lib/calc/types";
import { karsilastirmaOlustur, taramaYap } from "@/lib/karsilastirma";
import { cizgiGrafikSvg } from "@/lib/karsilastirma/grafik";
import type { Senaryo, TaramaAyari, TaramaSerisi } from "@/lib/karsilastirma/types";
import { ciktiBirimleriniSuz, girdileriSuz } from "@/lib/kayit/dogrulama";
import { KAYIT_AD_MAX } from "@/lib/kayit/types";
import { karsilastirmaRaporuPdf } from "@/lib/rapor/belgeler";
import { RAPOR_TURU } from "@/lib/rapor/metinler";
import { RAPOR_SENARYO_MAX, RAPOR_TARAMA_NOKTA_MAX } from "@/lib/rapor/sinirlar";
import type { RaporBasligi } from "@/lib/rapor/types";
import { unitsFor } from "@/lib/units";
import { hatadanYanit, IstekHatasi, istegeBagliOturum, jsonGovde, pdfYaniti } from "../_lib/ortak";

const GovdeSemasi = z.object({
  hesapSlug: z.string().min(1).max(100),
  senaryolar: z
    .array(
      z.object({
        ad: z.string().max(KAYIT_AD_MAX, `Senaryo adı en çok ${KAYIT_AD_MAX} karakter olabilir.`),
        state: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1, "En az bir senaryo gerekir.")
    .max(RAPOR_SENARYO_MAX, `En çok ${RAPOR_SENARYO_MAX} senaryo karşılaştırılabilir.`),
  outputUnits: z.record(z.string(), z.unknown()).optional(),
  tarama: z
    .object({
      girdiKey: z.string().min(1).max(100),
      ciktiKey: z.string().min(1).max(100),
      baslangic: z.number(),
      bitis: z.number(),
      birim: z.string().min(1).max(50),
      noktaSayisi: z
        .number()
        .int("Nokta sayısı tam sayı olmalıdır.")
        .min(2, "Tarama en az 2 nokta olmalıdır.")
        .max(RAPOR_TARAMA_NOKTA_MAX, `Tarama en çok ${RAPOR_TARAMA_NOKTA_MAX} nokta olabilir.`),
    })
    .optional(),
});

/** Tarama ayarını tanıma göre denetler: girdi sayısal, çıktı tanımlı, birim girdinin birimlerinden. */
function taramayiDenetle(def: CalcDefinition, t: TaramaAyari): void {
  const girdi = def.inputs.find((i) => i.key === t.girdiKey);
  if (!girdi || girdi.kind !== "number") throw new IstekHatasi(400, "Tarama girdisi bu hesabın sayısal bir girdisi değil.");
  if (!def.outputs.some((o) => o.key === t.ciktiKey)) throw new IstekHatasi(400, "Tarama çıktısı bu hesapta yok.");
  const birimler = girdi.units ?? unitsFor(girdi.dimension).map((u) => u.id);
  if (!birimler.includes(t.birim)) throw new IstekHatasi(400, "Tarama birimi bu girdi için geçerli değil.");
  if (!Number.isFinite(t.baslangic) || !Number.isFinite(t.bitis) || t.baslangic === t.bitis) {
    throw new IstekHatasi(400, "Tarama başlangıcı ve bitişi farklı sayılar olmalıdır.");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const govde = await jsonGovde(request, GovdeSemasi);
    const def = getCalc(govde.hesapSlug);
    if (!def) throw new IstekHatasi(400, "Bilinmeyen hesap türü.");
    if (govde.tarama) taramayiDenetle(def, govde.tarama);

    const oturum = await istegeBagliOturum();
    const varsayilan = defaultState(def);
    const senaryolar: Senaryo[] = govde.senaryolar.map((s, i) => ({
      id: `s${i + 1}`,
      ad: s.ad.trim() || `Senaryo ${i + 1}`,
      state: { ...varsayilan, ...girdileriSuz(def, s.state) },
    }));
    const options = { ...oturum?.tercihler, outputUnits: ciktiBirimleriniSuz(def, govde.outputUnits ?? {}) };
    const karsilastirma = karsilastirmaOlustur(def, senaryolar, options);

    let tarama: { seri: TaramaSerisi; svg: string } | undefined;
    if (govde.tarama) {
      try {
        const seri = taramaYap(def, senaryolar[0], govde.tarama, options);
        tarama = { seri, svg: cizgiGrafikSvg(seri) };
      } catch (error) {
        // Grafik üretilemezse karşılaştırma tablosu yine raporlanır.
        console.error("POST /api/rapor/karsilastirma: tarama/grafik üretilemedi", error);
      }
    }

    const baslik: RaporBasligi = {
      baslik: def.title,
      altBaslik: `${def.id} · ${RAPOR_TURU.karsilastirma}`,
      ...(oturum ? { kullanici: oturum.kullanici } : {}),
      tarih: new Date().toISOString(),
    };
    const pdf = await karsilastirmaRaporuPdf(baslik, karsilastirma, tarama);
    return pdfYaniti(pdf, `${def.title} - ${RAPOR_TURU.karsilastirma}`);
  } catch (error) {
    return hatadanYanit(error, "POST /api/rapor/karsilastirma");
  }
}
