/**
 * İstemciden server action çağrısı: ağ hatası gibi fırlatılan hatalar sayfayı hata sınırına düşürmesin, mesaja
 * dönüşsün. Next.js'in denetim akışı istisnaları (action içinden redirect → NEXT_REDIRECT) yeniden fırlatılır;
 * yönlendirmeyi yönlendirici bunlarla yapar.
 */
import type { EylemSonucu } from "@/lib/kayit/eylem";

export const BAGLANTI_HATASI = "Sunucuya ulaşılamadı. Bağlantınızı denetleyip yeniden deneyin.";

function nextDenetimIstisnasi(error: unknown): boolean {
  const digest = typeof error === "object" && error !== null ? (error as { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export async function eylemCagir<T>(cagri: () => Promise<EylemSonucu<T>>): Promise<EylemSonucu<T>> {
  try {
    return await cagri();
  } catch (error) {
    if (nextDenetimIstisnasi(error)) throw error;
    console.error("Kayıt işlemi çağrılamadı", error);
    return { ok: false, hata: BAGLANTI_HATASI };
  }
}
