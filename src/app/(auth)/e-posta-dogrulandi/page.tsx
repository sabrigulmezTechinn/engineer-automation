import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert, AuthCard, FormSkeleton, linkClass } from "@/components/auth/form-ui";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const metadata: Metadata = { title: "E-posta doğrulama" };

/**
 * Doğrulama bağlantısı (/api/auth/verify-email) sonrası yönlendirme hedefi.
 * Başarılıysa parametresiz gelinir (better-auth oturumu da açar); hata varsa
 * `?error=TOKEN_EXPIRED | INVALID_TOKEN | USER_NOT_FOUND`.
 */
export default function EpostaDogrulandiPage({ searchParams }: PageProps<"/e-posta-dogrulandi">) {
  return (
    <Suspense
      fallback={
        <AuthCard title="E-posta doğrulama">
          <FormSkeleton rows={1} />
        </AuthCard>
      }
    >
      <VerificationResult searchParams={searchParams} />
    </Suspense>
  );
}

const primaryButton =
  "inline-flex flex-1 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const secondaryButton =
  "inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

async function VerificationResult({ searchParams }: { searchParams: PageProps<"/e-posta-dogrulandi">["searchParams"] }) {
  const { error } = await searchParams;
  const hata = Array.isArray(error) ? error[0] : error;

  if (!hata) {
    return (
      <AuthCard title="E-posta adresiniz doğrulandı">
        <div className="space-y-4">
          <Alert tone="success">Hesabınız etkinleştirildi ve kullanıma hazır.</Alert>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/profil" className={primaryButton}>
              Profilime git
            </Link>
            <Link href="/" className={secondaryButton}>
              Ana sayfa
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  const mesaj =
    hata === "TOKEN_EXPIRED"
      ? "Doğrulama bağlantısının süresi dolmuş."
      : hata === "USER_NOT_FOUND"
        ? "Bu doğrulama bağlantısına ait bir hesap bulunamadı."
        : "Doğrulama bağlantısı geçersiz.";

  return (
    <AuthCard
      title="E-posta doğrulanamadı"
      footer={
        <>
          Hesabınız zaten doğrulandıysa{" "}
          <Link href="/giris" className={linkClass}>
            giriş yapın
          </Link>
          .
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="error">{mesaj} Yeni bir doğrulama bağlantısı isteyebilirsiniz.</Alert>
        <ResendVerificationForm />
      </div>
    </AuthCard>
  );
}
