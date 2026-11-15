import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/** Kayıt defterinde olmayan bir hesap slug'ı istendiğinde gösterilir. */
export default function HesapBulunamadi() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Hesap bulunamadı</h1>
      <p className="mt-3 text-muted">
        Aradığınız hesap yok ya da adresi değişmiş olabilir. Tüm hesapları listeden inceleyebilirsiniz.
      </p>
      <div className="mt-6 flex justify-center">
        <Link href="/hesaplar" className={buttonClass("primary", "px-4 py-2")}>
          Hesaplar listesine dön
        </Link>
      </div>
    </div>
  );
}
