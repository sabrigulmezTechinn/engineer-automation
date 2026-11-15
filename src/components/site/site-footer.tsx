import Link from "next/link";
import { KISA_SORUMLULUK_REDDI, TELIF_NOTU } from "@/components/disclaimer";
import { NAV_ITEMS } from "./nav-links";

/** Alt bilgi: kısa sorumluluk reddi ve standart telif notu. (Yıl yazılmaz: cacheComponents altında tarih okumak ön üretimi bozar.) */
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-xs leading-relaxed text-muted sm:grid-cols-[1fr_auto] sm:px-6">
        <div className="space-y-2">
          <p>
            <strong className="font-semibold text-fg">Sorumluluk reddi.</strong> {KISA_SORUMLULUK_REDDI}
          </p>
          <p>{TELIF_NOTU}</p>
        </div>
        <nav aria-label="Alt gezinme">
          <ul className="flex gap-4 sm:flex-col sm:gap-1.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-fg hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
