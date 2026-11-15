import Link from "next/link";
import { sortByKapsamId } from "@/components/calc/kapsam";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";
import { CATEGORIES, calcsByCategory } from "@/lib/calc/registry";

/** Kategori kartında listelenecek en fazla hesap sayısı */
const KART_HESAP_SINIRI = 5;

const OZELLIKLER = [
  {
    title: "Formül ve ara adımlar",
    text: "Her sonuç, kullanılan formül ve değerlerin yerine konduğu adımlarla birlikte gösterilir.",
  },
  {
    title: "Her girdide birim seçimi",
    text: "Değerleri alışık olduğunuz birimle girin; Türkçe ondalık virgül kabul edilir.",
  },
  {
    title: "Standart referansı ve durum",
    text: "İlgili standart ve madde belirtilir; sınır aşımlarında uyarı verilir.",
  },
];

export default function Home() {
  const categories = CATEGORIES.map((category) => ({
    ...category,
    calcs: sortByKapsamId(calcsByCategory(category.id)),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-10 sm:py-14">
        <p className="text-sm font-medium text-accent">
          Otomasyon · Mekatronik · Elektrik-Elektronik
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Günlük mühendislik hesapları, formülleri ve standart referanslarıyla tek yerde.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Kendi değerlerinizi girin, birimi seçin; sonucu ara adımları, kullanılan formülü ve ilgili
          standardı ile birlikte görün. Hesaplar Türkçe hazırlanmıştır ve anlık doğrulama yapar.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/hesaplar" className={buttonClass("primary", "px-4 py-2")}>
            Hesaplara göz at
          </Link>
          <Link href="/standartlar" className={buttonClass("secondary", "px-4 py-2")}>
            Standartlar
          </Link>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-4 border-t border-line pt-6 sm:grid-cols-3">
          {OZELLIKLER.map((item) => (
            <li key={item.title}>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="kategoriler-baslik" className="pb-4">
        <h2 id="kategoriler-baslik" className="text-lg font-semibold tracking-tight">
          Kategoriler
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const hasCalcs = category.calcs.length > 0;
            const shown = category.calcs.slice(0, KART_HESAP_SINIRI);
            const rest = category.calcs.length - shown.length;
            return (
              <li key={category.id}>
                <Card className={cx("flex h-full flex-col p-4 sm:p-5", !hasCalcs && "bg-surface/60")}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">
                      {hasCalcs ? (
                        <Link href={`/hesaplar#${category.id}`} className="hover:text-accent hover:underline">
                          {category.title}
                        </Link>
                      ) : (
                        <span className="text-muted">{category.title}</span>
                      )}
                    </h3>
                    {hasCalcs ? (
                      <Badge tone="accent">{category.calcs.length} hesap</Badge>
                    ) : (
                      <Badge>Yakında</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-muted">{category.description}</p>

                  {hasCalcs && (
                    <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
                      {shown.map((calc) => (
                        <li key={calc.slug} className="flex items-baseline gap-2.5">
                          <span className="w-8 shrink-0 font-mono text-xs text-muted tabular-nums">
                            {calc.id}
                          </span>
                          <Link href={`/hesaplar/${calc.slug}`} className="hover:text-accent hover:underline">
                            {calc.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {rest > 0 && (
                    <Link
                      href={`/hesaplar#${category.id}`}
                      className="mt-3 text-sm font-medium text-accent hover:underline"
                    >
                      +{rest} hesap daha
                    </Link>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
