import type { ReactNode } from "react";
import { cx } from "./cx";

export type BadgeTone = "neutral" | "accent" | "ok" | "uyari" | "hata";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-muted text-muted",
  accent: "border-transparent bg-accent-soft text-accent",
  ok: "border-ok-line bg-ok-bg text-ok",
  uyari: "border-uyari-line bg-uyari-bg text-uyari",
  hata: "border-hata-line bg-hata-bg text-hata",
};

/** Küçük etiket: KAPSAM numarası, "Yakında", durum seviyesi vb. */
export function Badge({
  tone = "neutral",
  mono = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  /** Numara gibi değerler için eş aralıklı yazı tipi */
  mono?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-xs leading-none font-medium",
        mono && "font-mono tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
