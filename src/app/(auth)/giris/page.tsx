import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { safeRedirectPath } from "@/app/(auth)/_lib/redirect";
import { AuthCard, FormSkeleton, linkClass } from "@/components/auth/form-ui";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Giriş yap" };

export default function GirisPage({ searchParams }: PageProps<"/giris">) {
  return (
    <AuthCard
      title="Giriş yap"
      description="Hesaplarınızı kaydetmek ve tercihlerinizi kullanmak için giriş yapın."
      footer={
        <>
          Hesabınız yok mu?{" "}
          <Link href="/kayit" className={linkClass}>
            Kayıt olun
          </Link>
        </>
      }
    >
      {/* searchParams isteğe özgüdür: cacheComponents altında Suspense içinde okunur. */}
      <Suspense fallback={<FormSkeleton rows={2} />}>
        <LoginFormWithRedirect searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginFormWithRedirect({ searchParams }: { searchParams: PageProps<"/giris">["searchParams"] }) {
  const { yonlendir } = await searchParams;
  const hedef = safeRedirectPath(Array.isArray(yonlendir) ? yonlendir[0] : yonlendir);
  return <LoginForm redirectTo={hedef ?? undefined} />;
}
