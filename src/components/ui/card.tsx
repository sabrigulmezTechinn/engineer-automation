import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

/** Sade kart kabı: kenarlık, yüzey rengi, yuvarlatılmış köşe. */
export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cx("min-w-0 rounded-lg border border-line bg-surface shadow-xs", className)}
      {...props}
    />
  );
}
