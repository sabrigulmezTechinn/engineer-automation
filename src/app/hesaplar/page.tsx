import type { Metadata } from "next";
import Link from "next/link";
import { sortByKapsamId } from "@/components/calc/kapsam";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, calcsByCategory } from "@/lib/calc/registry";

export const metadata: Metadata = {
  title: "Hesaplar",
  description:
    "Kategorilere göre tüm mühendislik hesapları: temel elektrik, tesisat, motor ve sürücü, elektronik, otomasyon, mekatronik ve yardımcı araçlar.",
};

export default function HesaplarPage() {
  const categories = CATEGORIES.map((category) => ({
    ...category,
    calcs: sortByKapsamId(calcsByCategory(category.id)),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hesaplar</h1>
        <p className="mt-2 text-muted">
          Tüm hesaplar kategorilere göre gruplanmıştır. Numaralar proje kapsam belgesindeki sırayı izler.
        </p>
      </header>

      {categories.length > 1 && (
        <nav aria-label="Kategoriler" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.id}>
                <a
                  href={`#${category.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-line-strong hover:bg-surface-muted"
                >
                  {category.title}
                  <span className="text-xs text-muted tabular-nums">{category.calcs.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-8 space-y-10">
        {categories.map((category) => (
          <section key={category.id} id={category.id} aria-labelledby={`${category.id}-baslik`} className="scroll-mt-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id={`${category.id}-baslik`} className="text-lg font-semibold tracking-tight">
                {category.title}
              </h2>
              {category.calcs.length === 0 && <Badge>Yakında</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">{category.description}</p>

            {category.calcs.length > 0 ? (
              <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {category.calcs.map((calc) => (
                  <li key={calc.slug}>
                    <Link
                      href={`/hesaplar/${calc.slug}`}
                      className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 px-4 py-3 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none sm:grid-cols-[3.5rem_minmax(0,16rem)_minmax(0,1fr)] sm:gap-x-4"
                    >
                      <span className="pt-px font-mono text-sm text-muted tabular-nums">{calc.id}</span>
                      <span className="font-medium">{calc.title}</span>
                      <span className="col-start-2 mt-0.5 text-sm text-muted sm:col-start-3 sm:mt-0">
                        {calc.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">
                Bu kategorideki hesaplar hazırlanıyor.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
