import Link from "next/link";
import type { Reference } from "@/lib/calc/types";
import { referenceDetail, standardAnchor } from "@/components/standards";

/** Hesap sayfasındaki standart referansları tablosu: standart no, ad, madde. */
export function ReferenceTable({
  references,
}: {
  references: readonly Reference[];
}) {
  if (references.length === 0) {
    return (
      <p className="text-sm text-muted">
        Bu hesap temel bağıntılara dayanır; belirli bir standart referansı
        yoktur.
      </p>
    );
  }

  return (
    <>
      {/* Dar ekranda tablo yerine alt alta liste: uzun yönetmelik adları ve URL'li notlar sığar. */}
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm sm:hidden">
        {references.map((ref, i) => {
          const detail = referenceDetail(ref);
          return (
            <li
              key={`${ref.standard}-${i}`}
              className="space-y-1 px-4 py-3 [overflow-wrap:anywhere]"
            >
              <Link
                href={`/standartlar#${standardAnchor(ref.standard)}`}
                className="font-medium text-accent hover:underline"
              >
                {ref.standard}
              </Link>
              {ref.title && <p>{ref.title}</p>}
              {detail && <p className="text-muted">{detail}</p>}
            </li>
          );
        })}
      </ul>
      <ReferenceGrid references={references} />
    </>
  );
}

function ReferenceGrid({ references }: { references: readonly Reference[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface sm:block">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-line bg-surface-muted text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Standart / kaynak
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Ad
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Madde / not
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {references.map((ref, i) => (
            <tr key={`${ref.standard}-${i}`} className="align-top">
              <th
                scope="row"
                className="min-w-[9rem] px-4 py-2.5 font-medium [overflow-wrap:anywhere]"
              >
                <Link
                  href={`/standartlar#${standardAnchor(ref.standard)}`}
                  className="text-accent hover:underline"
                >
                  {ref.standard}
                </Link>
              </th>
              <td className="px-4 py-2.5">
                {ref.title ?? <span className="text-muted">—</span>}
              </td>
              <td className="px-4 py-2.5 [overflow-wrap:anywhere]">
                {referenceDetail(ref) ?? <span className="text-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
