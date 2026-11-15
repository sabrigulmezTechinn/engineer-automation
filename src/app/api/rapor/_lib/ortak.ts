/**
 * PDF rapor uç noktalarının ortak yardımcıları (yalnızca sunucu): oturum ve tercihler, sınırlı JSON gövde
 * okuma, hata ve PDF yanıtları. `_lib` klasörü yönlendirmeye dahil değildir.
 */
import * as z from "zod";
import type { AuthUser } from "@/lib/auth";
import { pdfContentDisposition } from "@/lib/rapor/dosya-adi";
import { RAPOR_GOVDE_MAX } from "@/lib/rapor/sinirlar";
import type { RaporKullanici } from "@/lib/rapor/types";
import { getSession } from "@/lib/session";
import { runSecenekleri } from "@/lib/tercihler";
import type { RunOptions } from "@/lib/calc/types";


/** İstemciye gösterilecek mesajla sonlanan istek hatası */
export class IstekHatasi extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "IstekHatasi";
  }
}

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** `{ hata: "<Türkçe mesaj>" }` JSON hata yanıtı */
export function hataYaniti(status: number, hata: string): Response {
  return Response.json({ hata }, { status, headers: NO_STORE });
}

/** PDF indirme yanıtı; dosya adı görünen addan türetilir (ASCII `filename` + UTF-8 `filename*`). */
export function pdfYaniti(pdf: Buffer, ad: string): Response {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(ad),
      "Content-Length": String(pdf.length),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Beklenmeyen hatada 500; IstekHatasi'nda kendi durumu ve mesajı. */
export function hatadanYanit(error: unknown, baglam: string): Response {
  if (error instanceof IstekHatasi) return hataYaniti(error.status, error.message);
  console.error(`${baglam}: rapor oluşturulamadı`, error);
  return hataYaniti(500, "Rapor oluşturulurken beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
}

export interface RaporOturumu {
  userId: string;
  kullanici: RaporKullanici;
  /** Profil tercihlerinden runCalc seçenekleri (anlamlı basamak, birim sistemi) */
  tercihler: Pick<RunOptions, "significant" | "preferredUnits">;
}

function oturumdan(user: AuthUser): RaporOturumu {
  return {
    userId: user.id,
    kullanici: { ad: user.name, sirket: user.company ?? null, unvan: user.jobTitle ?? null },
    tercihler: runSecenekleri({ anlamliBasamak: user.decimals, birimSistemi: user.unitSystem }),
  };
}

/** Giriş yapılmışsa oturum bilgisi; yoksa ya da oturum okunamazsa null (kayıtsız raporlar için). */
export async function istegeBagliOturum(): Promise<RaporOturumu | null> {
  const session = await getSession().catch((error: unknown) => {
    console.error("Rapor: oturum okunamadı; anonim devam ediliyor", error);
    return null;
  });
  return session?.user ? oturumdan(session.user) : null;
}

/** Giriş zorunlu uç noktalar: oturum yoksa 401, okunamazsa 503 (IstekHatasi). */
export async function zorunluOturum(): Promise<RaporOturumu> {
  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession();
  } catch (error) {
    console.error("Rapor: oturum okunamadı", error);
    throw new IstekHatasi(503, "Oturum doğrulanamadı. Lütfen biraz sonra tekrar deneyin.");
  }
  if (!session?.user) throw new IstekHatasi(401, "Bu raporu indirmek için giriş yapmalısınız.");
  return oturumdan(session.user);
}

/** Gövdeyi en çok `sinir` bayt okur (Content-Length'e güvenmeden); aşarsa 413. */
async function sinirliOku(request: Request, sinir: number): Promise<string> {
  const beyan = Number(request.headers.get("content-length"));
  if (Number.isFinite(beyan) && beyan > sinir) throw buyukGovde(sinir);
  if (!request.body) throw new IstekHatasi(400, "İstek gövdesi boş.");
  const reader = request.body.getReader();
  const parcalar: Uint8Array[] = [];
  let toplam = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    toplam += value.byteLength;
    if (toplam > sinir) {
      await reader.cancel().catch(() => undefined);
      throw buyukGovde(sinir);
    }
    parcalar.push(value);
  }
  const birlesik = new Uint8Array(toplam);
  let konum = 0;
  for (const p of parcalar) {
    birlesik.set(p, konum);
    konum += p.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(birlesik);
  } catch {
    throw new IstekHatasi(400, "İstek gövdesi geçerli UTF-8 metni değil.");
  }
}

function buyukGovde(sinir: number): IstekHatasi {
  return new IstekHatasi(413, `İstek gövdesi çok büyük (en çok ${Math.round(sinir / 1024)} kB).`);
}

/**
 * JSON gövdesini okuyup şemayla doğrular. Content-Type JSON değilse 415, sınır aşılırsa 413,
 * bozuk JSON veya şemaya uymayan gövdede 400 (Türkçe mesajla).
 */
export async function jsonGovde<T>(request: Request, sema: z.ZodType<T>, sinir = RAPOR_GOVDE_MAX): Promise<T> {
  const tur = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(tur.trim())) {
    throw new IstekHatasi(415, "İstek gövdesi JSON olmalıdır (Content-Type: application/json).");
  }
  const metin = await sinirliOku(request, sinir);
  if (metin.trim() === "") throw new IstekHatasi(400, "İstek gövdesi boş.");
  let veri: unknown;
  try {
    veri = JSON.parse(metin);
  } catch {
    throw new IstekHatasi(400, "İstek gövdesi geçerli JSON değil.");
  }
  const sonuc = sema.safeParse(veri, { error: z.locales.tr().localeError });
  if (!sonuc.success) {
    const sorun = sonuc.error.issues[0];
    const alan = sorun?.path.length ? ` (${sorun.path.join(".")})` : "";
    throw new IstekHatasi(400, `Geçersiz istek${alan}: ${sorun?.message ?? "gövde beklenen biçimde değil"}`);
  }
  return sonuc.data;
}
