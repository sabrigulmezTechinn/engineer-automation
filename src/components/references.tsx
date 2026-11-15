import Link from "next/link";
import type { Reference } from "@/lib/calc/types";
import { referenceDetail, standardAnchor } from "@/components/standards";

/** Hesap sayfasındaki standart referansları tablosu: standart no, ad, madde. */
export function ReferenceTable({ references }: { references: readonly Reference[] }) {
  if (references.length === 0) {
    return (
      <p className="text-sm text-muted">
        Bu hesap temel bağıntılara dayanır; belirli bir standart referansı yoktur.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
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
              <th scope="row" className="px-4 py-2.5 font-medium whitespace-nowrap">
                <Link
                  href={`/standartlar#${standardAnchor(ref.standard)}`}
                  className="text-accent hover:underline"
                >
                  {ref.standard}
                </Link>
              </th>
              <td className="px-4 py-2.5">{ref.title ?? <span className="text-muted">—</span>}</td>
              <td className="px-4 py-2.5">
                {referenceDetail(ref) ?? <span className="text-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
