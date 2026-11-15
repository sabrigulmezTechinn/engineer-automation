import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/** Genel 404 sayfası. Her sayfayla birlikte gönderildiği için sunucu bileşenidir ve istemci kodu içermez. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sayfa bulunamadı</h1>
      <p className="mt-3 text-muted">
        Aradığınız sayfa yok, taşınmış ya da adres yanlış yazılmış olabilir.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClass("primary", "px-4 py-2")}>
          Ana sayfaya dön
        </Link>
        <Link href="/hesaplar" className={buttonClass("secondary", "px-4 py-2")}>
          Hesaplar
        </Link>
      </div>
    </div>
  );
}
