import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KayitTablosu } from "@/components/kayit/kayit-tablosu";
import { tarihMetni } from "@/components/kayit/ortak";
import { ProjeBilgisi } from "@/components/kayit/proje-bilgisi";
import { ProjeRaporDugmesi } from "@/components/rapor/proje-rapor-dugmesi";
import { hesaplariListele, projeGetir, projeleriListele } from "@/lib/kayit/islemler";
import { requireSession } from "@/lib/session";
import { projeSecenekleri, satirlaraCevir } from "../_lib/satirlar";

export const metadata: Metadata = { title: "Proje" };

/**
 * Proje sayfası: ad/açıklama (düzenlenebilir), proje raporu düğmesi, kayıtlı hesaplar tablosu.
 * Adres parametresi, oturum ve veritabanı Suspense içinde okunur (cacheComponents; kimlikler önceden bilinmez).
 *
 * Başkasına ait ya da olmayan proje → notFound() ile "Proje bulunamadı" arayüzü. Not: içerik akışla
 * gönderildiği için HTTP durumu 200 kalır (sayfaya noindex eklenir); gerçek 404 için proxy'de veritabanı
 * araması gerekirdi.
 */
export default function ProjePage({ params }: PageProps<"/projeler/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Konum" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/projeler" className="hover:text-fg hover:underline">
              Projeler
            </Link>
          </li>
        </ol>
      </nav>
      <Suspense fallback={<ProjeIskeleti />}>
        <ProjeIcerigi params={params} />
      </Suspense>
    </div>
  );
}

async function ProjeIcerigi({ params }: { params: PageProps<"/projeler/[id]">["params"] }) {
  const { id } = await params;
  const yol = `/projeler/${encodeURIComponent(id)}`;
  const { user } = await requireSession(yol);
  const proje = await projeGetir(user.id, id);
  if (!proje) notFound();
  const [kayitlar, projeler] = await Promise.all([
    hesaplariListele(user.id, { projeId: proje.id }),
    projeleriListele(user.id),
  ]);

  return (
    <div className="mt-3 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <ProjeBilgisi
            proje={{ id: proje.id, ad: proje.ad, aciklama: proje.aciklama, hesapSayisi: proje.hesapSayisi }}
            guncelleme={tarihMetni(proje.updatedAt)}
          />
        </div>
        <ProjeRaporDugmesi projeId={proje.id} />
      </div>

      <section aria-labelledby="kayitli-hesaplar">
        <h2 id="kayitli-hesaplar" className="text-lg font-semibold tracking-tight">
          Kayıtlı hesaplar
        </h2>
        <div className="mt-3">
          <KayitTablosu
            kayitlar={satirlaraCevir(kayitlar)}
            projeler={projeSecenekleri(projeler)}
            projeId={proje.id}
            girisYolu={yol}
            bos={
              <>
                Bu projede henüz kayıtlı hesap yok.{" "}
                <Link href="/hesaplar" className="font-medium text-accent hover:underline">
                  Hesaplar
                </Link>{" "}
                sayfasından bir hesap açıp “Kaydet” ile bu projeye ekleyebilirsiniz.
              </>
            }
          />
        </div>
      </section>
    </div>
  );
}

function ProjeIskeleti() {
  return (
    <div className="mt-3 animate-pulse space-y-4" aria-hidden="true">
      <div className="h-8 w-64 max-w-full rounded bg-surface-muted" />
      <div className="h-4 w-96 max-w-full rounded bg-surface-muted" />
      <div className="mt-8 h-40 rounded-lg bg-surface-muted" />
    </div>
  );
}
