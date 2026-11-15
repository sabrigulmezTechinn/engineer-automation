"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ForgotPasswordState } from "@/app/(auth)/_lib/actions";
import { firstError } from "@/app/(auth)/_lib/form";
import { Alert, SubmitButton, TextField } from "./form-ui";

const initialState: ForgotPasswordState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  if (state.status === "success") {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField
        name="email"
        label="E-posta"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={firstError(state.fieldErrors, "email")}
      />
      <SubmitButton pending={pending} pendingText="Gönderiliyor…">
        Sıfırlama bağlantısı gönder
      </SubmitButton>
    </form>
  );
}
