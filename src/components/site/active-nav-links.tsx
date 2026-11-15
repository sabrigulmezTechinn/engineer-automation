"use client";

import { usePathname } from "next/navigation";
import { NavLinks } from "./nav-links";

/**
 * Geçerli bölümü vurgulayan gezinme. cacheComponents açıkken usePathname, önceden bilinmeyen
 * dinamik parametreli sayfalarda askıya alınır; bu yüzden başlıkta <Suspense> içinde kullanılır.
 */
export function ActiveNavLinks() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}
