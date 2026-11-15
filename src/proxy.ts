/**
 * Next.js 16 "proxy" (eski adıyla middleware). İki iş yapar:
 *
 * 1. Bilinmeyen hesap adresi → gerçek 404. cacheComponents/kısmi ön üretim açıkken sayfa akışla
 *    gönderildiği için sayfadaki `notFound()` durum kodunu 200 bırakır. Bu yüzden slug, sayfa
 *    render edilmeden kayıt defterinde aranır; yoksa istek eşleşmeyen bir yola yeniden yazılır ve
 *    kök not-found sayfası 404 koduyla döner.
 *
 * 2. İyimser oturum kontrolü. Giriş gerektiren sayfalara oturum çerezi olmadan gelen isteği, sayfa
 *    render edilmeden /giris?yonlendir=<yol> adresine yönlendirir. Yalnızca çerezin VARLIĞINA bakar
 *    (veritabanına gitmez); asıl doğrulama sayfada `requireSession` ile yapılır. Bu yüzden ters yönde
 *    (girişliyken /giris → /profil gibi) yönlendirme burada YAPILMAZ: geçersiz bir çerez döngüye yol açar.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/app/(auth)/_lib/redirect";
import { getCalc } from "@/lib/calc/registry";

const CALC_PATH = /^\/hesaplar\/([^/]+)\/?$/;
/** Hiçbir route ile eşleşmeyen yol: kök not-found sayfası 404 koduyla render edilir. */
const NOT_FOUND_PATH = "/_hesap-bulunamadi";

function knownCalc(rawSlug: string): boolean {
  try {
    return getCalc(decodeURIComponent(rawSlug)) !== undefined;
  } catch {
    return false; // bozuk yüzde kodlaması
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const calc = CALC_PATH.exec(pathname);
  if (calc) {
    if (knownCalc(calc[1])) return NextResponse.next();
    return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
  }

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL(loginPath(`${pathname}${search}`), request.url));
  }
  return NextResponse.next();
}

export const config = {
  // /hesaplar/:slug → hesap varlık kontrolü. Diğerleri giriş gerektiren yollar (/profil, /projeler, /karsilastir ve
  // alt sayfaları; `:path*` yolun kendisini de kapsar); yeni korumalı sayfa eklendiğinde buraya da ekleyin.
  matcher: ["/hesaplar/:slug", "/profil/:path*", "/projeler/:path*", "/karsilastir"],
};
