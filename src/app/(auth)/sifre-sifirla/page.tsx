import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert, AuthCard, FormSkeleton } from "@/components/auth/form-ui";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Yeni şifre belirle" };

/**
 * E-postadaki bağlantı önce /api/auth/reset-password/<token> adresine gider; better-auth jetonu
 * kontrol edip buraya `?token=...` (geçerliyse) veya `?error=INVALID_TOKEN` ile yönlendirir.
 */
export default function SifreSifirlaPage({ searchParams }: PageProps<"/sifre-sifirla">) {
  return (
    <AuthCard title="Yeni şifre belirle" description="Hesabınız için yeni bir şifre belirleyin.">
      <Suspense fallback={<FormSkeleton rows={2} />}>
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function ResetPasswordContent({ searchParams }: { searchParams: PageProps<"/sifre-sifirla">["searchParams"] }) {
  const { token, error } = await searchParams;
  const jeton = Array.isArray(token) ? token[0] : token;

  if (error || !jeton) {
    return (
      <div className="space-y-4">
        <Alert tone="error">
          Şifre sıfırlama bağlantısı geçersiz, süresi dolmuş ya da daha önce kullanılmış.
        </Alert>
        <Link
          href="/sifremi-unuttum"
          className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Yeni bağlantı iste
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={jeton} />;
}
