import Link from "next/link";

/**
 * Başlıktaki kullanıcı menüsü. Sözleşme stub'ı: W3 (auth) bu dosyanın sahibidir ve gerçek oturum
 * bilgisini (ad, profil, çıkış) gösterecek şekilde değiştirir. W4 bunu başlıkta <Suspense> içinde kullanır.
 */
export async function UserMenu() {
  return (
    <Link href="/giris" className="text-sm font-medium hover:underline">
      Giriş yap
    </Link>
  );
}
