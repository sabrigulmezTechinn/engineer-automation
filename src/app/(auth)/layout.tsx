import type { ReactNode } from "react";

// Giriş/kayıt sayfaları için ortalanmış dar sütun. Statik: istek verisi okumaz.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
