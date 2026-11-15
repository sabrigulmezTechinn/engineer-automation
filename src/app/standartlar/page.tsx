import type { Metadata } from "next";
import Link from "next/link";
import { TELIF_NOTU } from "@/components/disclaimer";
import { groupReferencesByStandard, referenceDetail } from "@/components/standards";
import { allCalcs } from "@/lib/calc/registry";

export const metadata: Metadata = {
  title: "Standartlar",
  description:
    "Hesaplarda başvurulan standartlar ve kaynaklar; her standardın hangi hesaplarda ve hangi maddesiyle kullanıldığı.",
};

export default function StandartlarPage() {
  const groups = groupReferencesByStandard(allCalcs());

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Standartlar</h1>
        <p className="mt-2 text-muted">
          Hesaplarda başvurulan standart ve kaynaklar. Her standardın altında onu kullanan hesaplar ve
          ilgili madde listelenir.
        </p>
        <p className="mt-3 text-xs text-muted">{TELIF_NOTU}</p>
      </header>

      {groups.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">
          Henüz standart referansı içeren bir hesap yok.
        </p>
      ) : (
        <>
          <nav aria-label="Standart dizini" className="mt-6">
            <ul className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <li key={group.anchor}>
                  <a
                    href={`#${group.anchor}`}
                    className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs hover:border-line-strong hover:bg-surface-muted"
                  >
                    {group.standard}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-8 space-y-4">
            {groups.map((group) => (
              <section
                key={group.anchor}
                id={group.anchor}
                aria-labelledby={`${group.anchor}-baslik`}
                className="scroll-mt-6 rounded-lg border border-line bg-surface"
              >
                <div className="border-b border-line px-4 py-3">
                  <h2 id={`${group.anchor}-baslik`} className="font-semibold">
                    {group.standard}
                  </h2>
                  {group.title && <p className="mt-0.5 text-sm text-muted">{group.title}</p>}
                </div>
                <ul className="divide-y divide-line">
                  {group.usages.map(({ calc, reference }, i) => {
                    const detail = referenceDetail(reference);
                    return (
                      <li
                        key={`${calc.slug}-${i}`}
                        className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 text-sm sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-4"
                      >
                        <span className="font-mono text-muted tabular-nums">{calc.id}</span>
                        <Link href={`/hesaplar/${calc.slug}`} className="font-medium hover:text-accent hover:underline">
                          {calc.title}
                        </Link>
                        <span className="col-start-2 text-muted sm:col-start-3">
                          {detail ? (
                            <>
                              <span className="sr-only">Madde: </span>
                              {detail}
                            </>
                          ) : (
                            <>
                              <span className="sr-only">Madde belirtilmemiş</span>
                              <span aria-hidden="true">—</span>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
