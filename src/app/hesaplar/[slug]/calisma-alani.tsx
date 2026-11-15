/**
 * Hesap sayfasının isteğe özgü kısmı (sunucu): `?kayit=<id>` ile kayıtlı hesabı ve oturumdaki kullanıcının
 * tercihlerini okuyup çalışma alanını başlatır. cacheComponents açık olduğu için sayfada <Suspense> içinde
 * render edilir; yedek (fallback) olarak tercihsiz, kayıtsız çalışma alanı gösterilir.
 */
import { CalcWorkspace } from "@/components/calc/calc-workspace";
import { hesapGetir } from "@/lib/kayit/islemler";
import type { KayitliHesap } from "@/lib/kayit/types";
import { getSession } from "@/lib/session";
import { runSecenekleri } from "@/lib/tercihler";

export async function CalismaAlani({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const kayitId = typeof sp.kayit === "string" ? sp.kayit : undefined;
  // Veritabanına ulaşılamazsa sayfa anonim çalışma alanıyla açılır.
  const session = await getSession().catch(() => null);
  const user = session?.user;
  const tercihler = user
    ? runSecenekleri({ anlamliBasamak: user.decimals, birimSistemi: user.unitSystem })
    : undefined;

  let kayit: KayitliHesap | null = null;
  if (kayitId && user) {
    const bulunan = await hesapGetir(user.id, kayitId);
    // Başka bir hesap türünün kaydı bu sayfada açılmaz.
    if (bulunan && bulunan.hesapSlug === slug) kayit = bulunan;
  }

  return (
    <CalcWorkspace
      key={kayit?.id ?? "yeni"}
      slug={slug}
      kayit={kayit}
      tercihler={tercihler}
      girisYapildi={Boolean(user)}
    />
  );
}
