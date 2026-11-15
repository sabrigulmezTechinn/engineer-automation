import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { ActiveNavLinks } from "./active-nav-links";
import { NavLinks } from "./nav-links";

export const SITE_NAME = "Mühendislik Hesapları";

function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-fg"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M2.5 12c2.4-6.5 4.8-6.5 7.2 0s4.8 6.5 7.2 0" strokeLinecap="round" />
        <path d="M19.5 7.5v9" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * Site başlığı: ad (ana sayfa bağlantısı), gezinme ve kullanıcı menüsü.
 * Kullanıcı menüsü oturum okuduğu için (dinamik veri) Suspense içindedir; başlığın geri kalanı statik kabukta kalır.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md py-1 font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <LogoMark />
          <span>{SITE_NAME}</span>
        </Link>

        <nav aria-label="Ana gezinme" className="order-last -mx-2.5 w-full sm:order-none sm:mx-0 sm:w-auto">
          <Suspense fallback={<NavLinks />}>
            <ActiveNavLinks />
          </Suspense>
        </nav>

        <div className="ml-auto flex min-h-8 items-center">
          <Suspense
            fallback={
              <span
                aria-hidden="true"
                className="block h-5 w-20 animate-pulse rounded bg-surface-muted"
              />
            }
          >
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
