"use client";

import { useActionState } from "react";
import { resendVerificationAction, type ResendVerificationState } from "@/app/(auth)/_lib/actions";
import { firstError } from "@/app/(auth)/_lib/form";
import { Alert, SubmitButton, TextField } from "./form-ui";

const initialState: ResendVerificationState = { status: "idle" };

/**
 * Doğrulama e-postasını yeniden gönderme formu.
 * `email` verilirse adres gizli alanla gönderilir (giriş formundan gelindiğinde);
 * verilmezse kullanıcı adresini yazar (ör. süresi dolmuş bağlantı sayfasında).
 */
export function ResendVerificationForm({ email }: { email?: string }) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, initialState);

  if (state.status === "success") {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} noValidate className="space-y-3">
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <TextField
          name="email"
          label="E-posta"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          error={firstError(state.fieldErrors, "email")}
        />
      )}
      <SubmitButton pending={pending} pendingText="Gönderiliyor…" variant="secondary">
        Doğrulama e-postasını tekrar gönder
      </SubmitButton>
    </form>
  );
}
