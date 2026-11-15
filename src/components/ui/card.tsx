import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

/** Sade kart kabı: kenarlık, yüzey rengi, yuvarlatılmış köşe. */
export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cx("rounded-lg border border-line bg-surface shadow-xs", className)}
      {...props}
    />
  );
}
