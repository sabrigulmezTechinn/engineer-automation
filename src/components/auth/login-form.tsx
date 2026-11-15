"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/(auth)/_lib/actions";
import { firstError } from "@/app/(auth)/_lib/form";
import { Alert, SubmitButton, TextField, linkClass } from "./form-ui";
import { ResendVerificationForm } from "./resend-verification-form";

const initialState: SignInState = { status: "idle" };

/** Giriş formu. `redirectTo`: giriş sonrası dönülecek (doğrulanmış) yol; boşsa ana sayfa. */
export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <div className="space-y-6">
      <form action={formAction} noValidate className="space-y-4">
        {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}

        <input type="hidden" name="yonlendir" value={redirectTo ?? ""} />
        <TextField
          name="email"
          label="E-posta"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          error={firstError(state.fieldErrors, "email")}
        />
        <TextField
          name="password"
          label="Şifre"
          type="password"
          autoComplete="current-password"
          error={firstError(state.fieldErrors, "password")}
        />

        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name="rememberMe"
              defaultChecked
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700"
            />
            Beni hatırla
          </label>
          <Link href="/sifremi-unuttum" className={linkClass}>
            Şifremi unuttum
          </Link>
        </div>

        <SubmitButton pending={pending} pendingText="Giriş yapılıyor…">
          Giriş yap
        </SubmitButton>
      </form>

      {state.unverifiedEmail ? (
        // Ayrı form: iç içe form olamaz.
        <ResendVerificationForm key={state.unverifiedEmail} email={state.unverifiedEmail} />
      ) : null}
    </div>
  );
}
