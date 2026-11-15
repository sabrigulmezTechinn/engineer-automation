import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getSession } from "@/lib/session";
import { signOutAction } from "./actions";

/**
 * Başlıktaki kullanıcı menüsü (async Server Component). Oturumu istek başlıklarından okur; bu yüzden
 * çağıran tarafından <Suspense> içinde render edilmelidir (W4 başlıkta böyle kullanır).
 * Oturum yoksa "Giriş yap" / "Kayıt ol"; varsa kullanıcı adı, "Profil" ve çıkış düğmesi.
 */
export async function UserMenu() {
  let session: Awaited<ReturnType<typeof getSession>> = null;
  try {
    session = await getSession();
  } catch (error) {
    // Next.js'in kendi kontrol akışı istisnalarını (dinamik API, yönlendirme) yutma.
    unstable_rethrow(error);
    // Veritabanı erişilemezse başlık (ve tüm sayfa) çökmesin; ziyaretçi menüsünü göster.
    console.error("[kullanıcı menüsü] Oturum okunamadı:", error);
  }

  if (!session) {
    return (
      <nav aria-label="Hesap" className="flex items-center gap-3 text-sm">
        <Link href="/giris" className="font-medium text-zinc-700 hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-white">
          Giriş yap
        </Link>
        <Link
          href="/kayit"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Kayıt ol
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="Hesap" className="flex items-center gap-3 text-sm">
      <span className="max-w-[12rem] truncate font-medium text-zinc-900 dark:text-zinc-100" title={session.user.email}>
        {session.user.name}
      </span>
      <Link href="/profil" className="text-zinc-700 hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-white">
        Profil
      </Link>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Çıkış yap
        </button>
      </form>
    </nav>
  );
}
