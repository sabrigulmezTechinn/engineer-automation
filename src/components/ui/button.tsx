import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border-line bg-surface text-fg hover:bg-surface-muted",
  ghost: "border-transparent text-muted hover:bg-surface-muted hover:text-fg",
};

/** Düğme ve düğme görünümlü bağlantılar için ortak sınıflar. */
export function buttonClass(variant: ButtonVariant = "secondary", className?: string): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
