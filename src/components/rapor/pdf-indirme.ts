"use client";

/**
 * PDF indirme: fetch → Blob → geçici indirme bağlantısı. Dosya adı yanıtın `Content-Disposition` başlığından
 * (önce UTF-8 `filename*`), yoksa verilen yedek addan türetilir. Sunucunun `{ hata }` mesajı kullanıcıya gösterilir.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { asciiDosyaAdi, dosyaAdiniCoz } from "@/lib/rapor/dosya-adi";

export class PdfIndirmeHatasi extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfIndirmeHatasi";
  }
}

async function sunucuMesaji(yanit: Response): Promise<string> {
  const varsayilan =
    yanit.status === 401
      ? "Bu raporu indirmek için giriş yapmalısınız."
      : yanit.status === 404
        ? "Rapor bulunamadı."
        : `Rapor oluşturulamadı (HTTP ${yanit.status}).`;
  try {
    const veri: unknown = await yanit.json();
    if (veri && typeof veri === "object" && "hata" in veri && typeof veri.hata === "string" && veri.hata) {
      return veri.hata;
    }
  } catch {
    // JSON olmayan hata gövdesi
  }
  return varsayilan;
}

/** PDF'i indirir; başarısızlıkta Türkçe mesajlı PdfIndirmeHatasi fırlatır. */
export async function pdfIndir(url: string, init: RequestInit | undefined, yedekAd: string): Promise<void> {
  let yanit: Response;
  try {
    yanit = await fetch(url, { ...init, credentials: "same-origin" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PdfIndirmeHatasi("Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.");
  }
  if (!yanit.ok) throw new PdfIndirmeHatasi(await sunucuMesaji(yanit));
  const blob = await yanit.blob();
  const ad = dosyaAdiniCoz(yanit.headers.get("Content-Disposition")) ?? `${asciiDosyaAdi(yedekAd)}.pdf`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = ad;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Bazı tarayıcılar indirmeyi tıklamadan sonra başlatır; bağlantı hemen geri alınmasın.
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

/** İndirme durumu: meşgul bayrağı, son hata ve indir fonksiyonu (aynı anda tek indirme). */
export function usePdfIndirme() {
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const aktif = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      aktif.current?.abort();
      aktif.current = null;
    },
    [],
  );

  const indir = useCallback(async (url: string, init: RequestInit | undefined, yedekAd: string) => {
    if (aktif.current) return;
    const denetleyici = new AbortController();
    aktif.current = denetleyici;
    setMesgul(true);
    setHata(null);
    try {
      await pdfIndir(url, { ...init, signal: denetleyici.signal }, yedekAd);
    } catch (error) {
      if (denetleyici.signal.aborted) return;
      setHata(error instanceof PdfIndirmeHatasi ? error.message : "Rapor indirilemedi. Lütfen tekrar deneyin.");
    } finally {
      if (aktif.current === denetleyici) aktif.current = null;
      // Sayfa arka plana alınıp (Activity) indirme iptal edildiyse de düğme meşgul kalmasın.
      setMesgul(false);
    }
  }, []);

  return { mesgul, hata, indir };
}
