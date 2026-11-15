"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type SignUpState } from "@/app/(auth)/_lib/actions";
import { firstError } from "@/app/(auth)/_lib/form";
import type { SignUpField } from "@/app/(auth)/_lib/validation";
import { COMPANY_MAX, JOB_TITLE_MAX, NAME_MAX, PASSWORD_MIN } from "@/db/user-fields";
import { FormResetBoundary, useResetOnHide } from "./form-reset";
import { Alert, SubmitButton, TextField, linkClass } from "./form-ui";

const initialState: SignUpState = { status: "idle" };

export function SignupForm() {
  return (
    <FormResetBoundary>
      <SignupFormInner />
    </FormResetBoundary>
  );
}

function SignupFormInner() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  useResetOnHide(state.status !== "idle");

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          <p className="font-semibold">E-postanızı doğrulayın</p>
          <p className="mt-1">
            <strong>{state.email}</strong> adresine bir doğrulama bağlantısı gönderdik. Hesabınızı kullanmaya
            başlamak için e-postadaki bağlantıyı açın. Bağlantı 1 saat geçerlidir.
          </p>
        </Alert>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          E-posta gelmediyse istenmeyen (spam) klasörünü kontrol edin. Doğrulamadan sonra{" "}
          <Link href="/giris" className={linkClass}>
            giriş yapabilirsiniz
          </Link>
          .
        </p>
      </div>
    );
  }

  const err = (alan: SignUpField) => firstError(state.fieldErrors, alan);

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}

      <TextField
        name="name"
        label="Ad soyad"
        autoComplete="name"
        maxLength={NAME_MAX}
        defaultValue={state.values?.name}
        error={err("name")}
      />
      <TextField
        name="email"
        label="E-posta"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={err("email")}
      />
      <TextField
        name="password"
        label="Şifre"
        type="password"
        autoComplete="new-password"
        hint={`En az ${PASSWORD_MIN} karakter.`}
        error={err("password")}
      />
      <TextField
        name="passwordConfirm"
        label="Şifre (tekrar)"
        type="password"
        autoComplete="new-password"
        error={err("passwordConfirm")}
      />
      <TextField
        name="company"
        label="Şirket"
        autoComplete="organization"
        optional
        maxLength={COMPANY_MAX}
        defaultValue={state.values?.company}
        error={err("company")}
      />
      <TextField
        name="jobTitle"
        label="Unvan"
        autoComplete="organization-title"
        optional
        maxLength={JOB_TITLE_MAX}
        hint="Şirket ve unvan rapor başlıklarında kullanılır."
        defaultValue={state.values?.jobTitle}
        error={err("jobTitle")}
      />

      <SubmitButton pending={pending} pendingText="Kaydediliyor…">
        Kayıt ol
      </SubmitButton>
    </form>
  );
}
