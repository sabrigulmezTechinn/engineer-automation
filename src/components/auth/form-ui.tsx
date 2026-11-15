/**
 * Kimlik doğrulama ve profil formlarının ortak görsel parçaları (Tailwind).
 * Durum içermez; hem sunucu hem istemci bileşenlerinde kullanılabilir.
 */
import type { ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
      {description ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? (
        <div className="mt-6 border-t border-zinc-200 pt-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

const inputBase =
  "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:ring-2 disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-100";
const inputOk = "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-300";
const inputErr = "border-red-500 focus:border-red-600 focus:ring-red-600/20 dark:border-red-500";

function FieldShell({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
        {optional ? <span className="ml-1 font-normal text-zinc-500">(isteğe bağlı)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-hata`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-ipucu`} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  error,
  hint,
  optional,
  maxLength,
  readOnly,
}: {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  maxLength?: number;
  readOnly?: boolean;
}) {
  const id = `alan-${name}`;
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        maxLength={maxLength}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-hata` : hint ? `${id}-ipucu` : undefined}
        className={`${inputBase} ${error ? inputErr : inputOk} ${readOnly ? "bg-zinc-50 text-zinc-600 dark:bg-zinc-900/60" : ""}`}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  error,
  hint,
}: {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValue?: string;
  error?: string;
  hint?: string;
}) {
  const id = `alan-${name}`;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-hata` : hint ? `${id}-ipucu` : undefined}
        className={`${inputBase} ${error ? inputErr : inputOk}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    info: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingText = "Lütfen bekleyin…",
  variant = "primary",
}: {
  pending: boolean;
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

/** Suspense yedeği: form yüklenirken alan iskeletleri */
export function FormSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-9 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
      <div className="h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export const linkClass =
  "font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300";
