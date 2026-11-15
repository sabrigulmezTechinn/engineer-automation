import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/** Olmayan ya da başka kullanıcıya ait proje (varlık sızdırılmaz: ikisi aynı görünür). */
export default function ProjeBulunamadi() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Proje bulunamadı</h1>
      <p className="mt-3 text-muted">Aradığınız proje yok, silinmiş ya da size ait değil.</p>
      <div className="mt-6 flex justify-center">
        <Link href="/projeler" className={buttonClass("primary", "px-4 py-2")}>
          Projelerime dön
        </Link>
      </div>
    </div>
  );
}
