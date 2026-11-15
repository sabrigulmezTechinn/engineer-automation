"use client";

/** PDF rapor düğmelerinin ortak görünümü: indirme simgesi, meşgulken dönen simge ve "Hazırlanıyor…", hata mesajı. */
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

export function IndirDugmesi({
  etiket,
  mesgul,
  hata,
  onClick,
  disabled = false,
  aciklama,
  className,
}: {
  etiket: ReactNode;
  mesgul: boolean;
  hata: string | null;
  onClick: () => void;
  disabled?: boolean;
  /** Düğmenin altında küçük açıklama (ör. neden devre dışı olduğu) */
  aciklama?: string;
  className?: string;
}) {
  const id = useId();
  const hataId = `${id}-hata`;
  const aciklamaId = `${id}-aciklama`;
  const describedBy = [hata ? hataId : null, aciklama ? aciklamaId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex min-w-0 flex-col items-start gap-1", className)}>
      <Button
        onClick={onClick}
        disabled={disabled || mesgul}
        aria-busy={mesgul || undefined}
        aria-describedby={describedBy}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={cx("size-4 shrink-0", mesgul && "animate-spin motion-reduce:animate-none")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {mesgul ? <path d="M21 12a9 9 0 1 1-6.2-8.56" /> : <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />}
        </svg>
        <span>{mesgul ? "Hazırlanıyor…" : etiket}</span>
      </Button>
      {aciklama && !hata && (
        <p id={aciklamaId} className="text-xs text-muted">
          {aciklama}
        </p>
      )}
      <p id={hataId} role="alert" className="text-xs font-medium text-hata empty:hidden">
        {hata ?? ""}
      </p>
    </div>
  );
}
