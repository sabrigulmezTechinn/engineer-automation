/**
 * Kayıt/proje bileşenlerinin ortak görsel parçaları (Tailwind belirteçleri; durum içermez).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { loginPath } from "@/app/(auth)/_lib/redirect";
import { cx } from "@/components/ui/cx";

/** Metin kutusu / seçim kutusu / çok satırlı alan */
export const ALAN =
  "block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:opacity-60";

export const ETIKET = "block text-sm font-medium";

/** İşlem sonucu mesajı. `girisYolu` verilirse (oturum sona erdi) giriş bağlantısı eklenir. */
export function IslemMesaji({
  tur,
  children,
  girisYolu,
  className,
}: {
  tur: "ok" | "hata";
  children: ReactNode;
  girisYolu?: string;
  className?: string;
}) {
  return (
    <p
      role={tur === "hata" ? "alert" : "status"}
      className={cx(
        "rounded-md border px-3 py-2 text-sm",
        tur === "hata" ? "border-hata-line bg-hata-bg text-hata" : "border-ok-line bg-ok-bg text-ok",
        className,
      )}
    >
      {children}
      {girisYolu && (
        <>
          {" "}
          <Link href={loginPath(girisYolu)} className="font-medium underline underline-offset-2">
            Giriş yapın
          </Link>
        </>
      )}
    </p>
  );
}

/** Kayıtlı hesabın sayfa adresi (hesap sayfası kaydı `?kayit=` ile açar) */
export function kayitAdresi(slug: string, kayitId: string): string {
  return `/hesaplar/${encodeURIComponent(slug)}?kayit=${encodeURIComponent(kayitId)}`;
}

/** Sunucu ve istemcide aynı metni üreten tarih biçimi (Türkiye saati): "15.11.2026 14:03" */
export function tarihMetni(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parcalar = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const al = (tip: Intl.DateTimeFormatPartTypes) => parcalar.find((p) => p.type === tip)?.value ?? "";
  return `${al("day")}.${al("month")}.${al("year")} ${al("hour")}:${al("minute")}`;
}
