import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/form-ui";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default function SifremiUnuttumPage() {
  return (
    <AuthCard
      title="Şifremi unuttum"
      description="Hesabınıza kayıtlı e-posta adresini girin; size yeni şifre belirlemeniz için bir bağlantı gönderelim."
      footer={
        <>
          Şifrenizi hatırladınız mı?{" "}
          <Link href="/giris" className={linkClass}>
            Giriş yapın
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
