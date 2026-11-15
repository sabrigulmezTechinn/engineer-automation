import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/form-ui";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Kayıt ol" };

export default function KayitPage() {
  return (
    <AuthCard
      title="Kayıt ol"
      description="Ücretsiz hesap oluşturun; hesaplarınızı kaydedin ve raporlarınızda adınızı kullanın."
      footer={
        <>
          Zaten hesabınız var mı?{" "}
          <Link href="/giris" className={linkClass}>
            Giriş yapın
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
