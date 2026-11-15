/**
 * İyimser oturum kontrolü (Next.js 16 "proxy", eski adıyla middleware).
 *
 * Giriş gerektiren sayfalara oturum çerezi olmadan gelen isteği, sayfa render edilmeden
 * /giris?yonlendir=<yol> adresine yönlendirir. Yalnızca çerezin VARLIĞINA bakar (veritabanına
 * gitmez); asıl doğrulama sayfada `requireSession` ile yapılır. Bu yüzden ters yönde
 * (girişliyken /giris → /profil gibi) yönlendirme burada YAPILMAZ: geçersiz bir çerez döngüye yol açar.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/app/(auth)/_lib/redirect";

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(new URL(loginPath(`${pathname}${search}`), request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Giriş gerektiren yollar. Yeni korumalı sayfa eklendiğinde buraya da ekleyin.
  matcher: ["/profil/:path*"],
};
