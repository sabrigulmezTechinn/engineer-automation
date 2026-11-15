import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/auth/form-ui";
import { ProfileForm } from "@/components/auth/profile-form";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Profil" };

/**
 * Giriş gerektirir. Oturum çerezi hiç yoksa src/proxy.ts zaten /giris?yonlendir=/profil'e
 * yönlendirir; çerez var ama oturum geçersizse aşağıdaki requireSession yönlendirir.
 */
export default function ProfilPage() {
  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Profil</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Kişisel bilgilerinizi ve hesaplarda kullanılacak varsayılan tercihlerinizi düzenleyin.
          </p>
          <div className="mt-8">
            {/* Oturum okuma isteğe özgüdür: cacheComponents altında Suspense içinde yapılır. */}
            <Suspense fallback={<FormSkeleton rows={6} />}>
              <ProfileContent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

async function ProfileContent() {
  const { user } = await requireSession("/profil");
  return (
    <ProfileForm
      // Kullanıcı değişirse (çıkış + başka hesapla giriş) form durumu sıfırlansın.
      key={user.id}
      initial={{
        name: user.name,
        email: user.email,
        company: user.company ?? "",
        jobTitle: user.jobTitle ?? "",
        unitSystem: user.unitSystem,
        decimals: String(user.decimals),
        standardSet: user.standardSet,
      }}
    />
  );
}
