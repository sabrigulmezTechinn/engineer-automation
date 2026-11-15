/**
 * Sunucu tarafı oturum okuma yardımcıları (Server Component ve Server Action'larda).
 *
 * cacheComponents açık olduğu için oturum okuyan her bileşen bir <Suspense> sınırı içinde
 * olmalıdır (istek başlıklarına erişim isteğe özgü veridir, statik kabuğa giremez).
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loginPath } from "@/app/(auth)/_lib/redirect";
import { auth } from "@/lib/auth";

/**
 * Geçerli oturumu (kullanıcı + oturum kaydı) döner; yoksa `null`.
 * React `cache` ile aynı istek içinde tek bir veritabanı sorgusuna indirgenir
 * (ör. başlıktaki kullanıcı menüsü ve profil sayfası birlikte okuduğunda).
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Oturum yoksa giriş sayfasına (`/giris?yonlendir=<donusYolu>`) yönlendirir. */
export async function requireSession(donusYolu: string) {
  const session = await getSession();
  if (!session) redirect(loginPath(donusYolu));
  return session;
}
