import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CalcForm } from "@/components/calc/calc-form";
import { categoryMeta } from "@/components/calc/kapsam";
import { DisclaimerBox } from "@/components/disclaimer";
import { Formula } from "@/components/formula";
import { ReferenceTable } from "@/components/references";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CATEGORIES, allCalcs, getCalc } from "@/lib/calc/registry";

/**
 * Hesap tanımları statiktir: tüm hesap sayfaları derleme sırasında önceden üretilir.
 * cacheComponents açıkken generateStaticParams boş dizi dönemez; kayıt defteri boşsa
 * (yalnızca geliştirme aşamasında olası) yer tutucu bir slug verilir ve sayfa notFound() ile 404 olur.
 */
export function generateStaticParams(): { slug: string }[] {
  const calcs = allCalcs();
  if (calcs.length === 0) return [{ slug: "__hesap-yok__" }];
  return calcs.map((calc) => ({ slug: calc.slug }));
}

export async function generateMetadata({ params }: PageProps<"/hesaplar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const def = getCalc(slug);
  if (!def) return { title: "Hesap bulunamadı" };
  return {
    title: `${def.title} (${def.id})`,
    description: def.description,
  };
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export default async function HesapPage({ params }: PageProps<"/hesaplar/[slug]">) {
  const { slug } = await params;
  const def = getCalc(slug);
  if (!def) notFound();

  const category = categoryMeta(CATEGORIES, def.category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Konum" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/hesaplar" className="hover:text-fg hover:underline">
              Hesaplar
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/hesaplar#${category.id}`} className="hover:text-fg hover:underline">
                  {category.title}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <header className="mt-3 max-w-3xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone="accent" mono className="text-sm">
            <span className="sr-only">Kapsam no </span>
            {def.id}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{def.title}</h1>
        </div>
        <p className="mt-2 leading-relaxed text-muted">{def.description}</p>
      </header>

      {def.formulas.length > 0 && (
        <section aria-labelledby="formuller" className="mt-8">
          <SectionHeading id="formuller">Formüller</SectionHeading>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {def.formulas.map((formula, i) => (
              <li key={`${formula.label}-${i}`}>
                <Card className="h-full px-4 py-3">
                  <p className="text-xs font-medium text-muted">{formula.label}</p>
                  <Formula latex={formula.latex} displayMode className="mt-1.5" />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="hesaplama" className="mt-8">
        <SectionHeading id="hesaplama">Hesaplama</SectionHeading>
        <div className="mt-3">
          <CalcForm key={def.slug} slug={def.slug} />
        </div>
      </section>

      <section aria-labelledby="standart-referanslari" className="mt-8">
        <SectionHeading id="standart-referanslari">Standart referansları</SectionHeading>
        <div className="mt-3">
          <ReferenceTable references={def.references} />
        </div>
      </section>

      <DisclaimerBox className="mt-10" />
    </div>
  );
}
