"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "@/app/(auth)/_lib/actions";
import { firstError } from "@/app/(auth)/_lib/form";
import { PASSWORD_MIN } from "@/db/user-fields";
import { Alert, SubmitButton, TextField, linkClass } from "./form-ui";

const initialState: ResetPasswordState = { status: "idle" };

/** Yeni şifre formu. `token`: e-postadaki bağlantıdan gelen sıfırlama jetonu. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.message}</Alert>
        <Link
          href="/giris"
          className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Giriş yap
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert tone="error">
          {state.message}{" "}
          <Link href="/sifremi-unuttum" className={linkClass}>
            Yeni bağlantı iste
          </Link>
        </Alert>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <TextField
        name="password"
        label="Yeni şifre"
        type="password"
        autoComplete="new-password"
        hint={`En az ${PASSWORD_MIN} karakter.`}
        error={firstError(state.fieldErrors, "password")}
      />
      <TextField
        name="passwordConfirm"
        label="Yeni şifre (tekrar)"
        type="password"
        autoComplete="new-password"
        error={firstError(state.fieldErrors, "passwordConfirm")}
      />
      <SubmitButton pending={pending} pendingText="Kaydediliyor…">
        Şifremi güncelle
      </SubmitButton>
    </form>
  );
}
