import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KayitTablosu } from "@/components/kayit/kayit-tablosu";
import { tarihMetni } from "@/components/kayit/ortak";
import { YeniProje } from "@/components/kayit/yeni-proje";
import { hesaplariListele, projeleriListele } from "@/lib/kayit/islemler";
import { requireSession } from "@/lib/session";
import { projeSecenekleri, satirlaraCevir } from "./_lib/satirlar";

export const metadata: Metadata = {
  title: "Projeler",
  description: "Kaydettiğiniz hesaplar ve projeleriniz.",
};

/**
 * Giriş gerektirir: çerez yoksa src/proxy.ts /giris?yonlendir=/projeler'e yönlendirir; çerez var ama oturum
 * geçersizse requireSession yönlendirir. Oturum ve veritabanı okuması cacheComponents gereği Suspense içindedir.
 */
export default function ProjelerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Projeler</h1>
        <p className="mt-2 text-muted">
          Kaydettiğiniz hesapları projeler altında gruplayın. Bir hesap sayfasında “Kaydet” ile yeni kayıt
          ekleyebilir, kayıtlı hesabı açıp düzenleyebilir ya da kopyalayabilirsiniz.
        </p>
      </header>
      <Suspense fallback={<ProjelerIskeleti />}>
        <ProjelerIcerigi />
      </Suspense>
    </div>
  );
}

async function ProjelerIcerigi() {
  const { user } = await requireSession("/projeler");
  const [projeler, projesizler] = await Promise.all([
    projeleriListele(user.id),
    hesaplariListele(user.id, { projeId: null }),
  ]);

  return (
    <>
      <section aria-labelledby="projelerim" className="mt-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="projelerim" className="text-lg font-semibold tracking-tight">
            Projelerim
          </h2>
          <span className="text-sm text-muted tabular-nums">{projeler.length} proje</span>
        </div>
        <div className="mt-3">
          <YeniProje />
        </div>
        {projeler.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-6 text-sm text-muted">
            Henüz projeniz yok. “Yeni proje” ile oluşturabilir ya da bir hesabı kaydederken yeni proje açabilirsiniz.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projeler.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projeler/${encodeURIComponent(p.id)}`}
                  className="flex h-full flex-col rounded-lg border border-line bg-surface px-4 py-3 shadow-xs transition-colors hover:border-line-strong hover:bg-surface-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="font-semibold break-words">{p.ad}</span>
                  {p.aciklama && <span className="mt-1 line-clamp-2 text-sm text-muted">{p.aciklama}</span>}
                  <span className="mt-auto pt-2 text-xs text-muted tabular-nums">
                    {p.hesapSayisi} hesap · Güncelleme <time dateTime={p.updatedAt}>{tarihMetni(p.updatedAt)}</time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="projesiz" aria-labelledby="projesiz-baslik" className="mt-10 scroll-mt-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="projesiz-baslik" className="text-lg font-semibold tracking-tight">
            Projesiz kayıtlar
          </h2>
          <span className="text-sm text-muted tabular-nums">{projesizler.length} kayıt</span>
        </div>
        <p className="mt-1 text-sm text-muted">Bir projeye eklenmemiş kayıtlı hesaplar.</p>
        <div className="mt-3">
          <KayitTablosu
            kayitlar={satirlaraCevir(projesizler)}
            projeler={projeSecenekleri(projeler)}
            projeId={null}
            girisYolu="/projeler"
            bos="Projesiz kayıt yok."
          />
        </div>
      </section>
    </>
  );
}

function ProjelerIskeleti() {
  return (
    <div className="mt-8 animate-pulse space-y-4" aria-hidden="true">
      <div className="h-6 w-40 rounded bg-surface-muted" />
      <div className="h-8 w-28 rounded bg-surface-muted" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
