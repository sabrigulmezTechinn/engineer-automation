import Link from "next/link";
import { cx } from "@/components/ui/cx";

export const NAV_ITEMS = [
  { href: "/hesaplar", label: "Hesaplar" },
  { href: "/standartlar", label: "Standartlar" },
] as const;

/**
 * Ana gezinme bağlantıları. Yol bilgisi verilmezse (ör. Suspense yedeği) hiçbir bağlantı vurgulanmaz.
 * "use client" içermez: hem sunucuda yedek olarak hem de istemci sarmalayıcısında kullanılır.
 */
export function NavLinks({ pathname }: { pathname?: string }) {
  return (
    <ul className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const inSection =
          pathname !== undefined && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cx(
                "block rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                inSection
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
