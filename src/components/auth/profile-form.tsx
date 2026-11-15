"use client";

import { useActionState } from "react";
import { firstError } from "@/app/(auth)/_lib/form";
import type { ProfileField } from "@/app/profil/_lib/validation";
import { updateProfileAction, type ProfileState } from "@/app/profil/actions";
import {
  COMPANY_MAX,
  DECIMALS_MAX,
  DECIMALS_MIN,
  JOB_TITLE_MAX,
  NAME_MAX,
  STANDARD_SETS,
  UNIT_SYSTEMS,
} from "@/db/user-fields";
import { Alert, SelectField, SubmitButton, TextField } from "./form-ui";

export interface ProfileFormValues {
  name: string;
  email: string;
  company: string;
  jobTitle: string;
  unitSystem: string;
  decimals: string;
  standardSet: string;
}

const initialState: ProfileState = { status: "idle" };

const DECIMAL_OPTIONS = Array.from({ length: DECIMALS_MAX - DECIMALS_MIN + 1 }, (_, i) => {
  const n = String(DECIMALS_MIN + i);
  return { value: n, label: n };
});

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  // Gönderimden sonra React formu sıfırlar; alanlar son gönderilen değerlerle yeniden doldurulur.
  const v = { ...initial, ...state.values };
  const err = (alan: ProfileField) => firstError(state.fieldErrors, alan);

  return (
    <form action={formAction} noValidate className="space-y-8">
      {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Profil bilgileri</legend>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Ad, şirket ve unvan rapor başlıklarında kullanılır.</p>
        <TextField
          name="email"
          label="E-posta"
          type="email"
          defaultValue={initial.email}
          readOnly
          hint="E-posta adresi şimdilik değiştirilemez."
        />
        <TextField name="name" label="Ad soyad" autoComplete="name" maxLength={NAME_MAX} defaultValue={v.name} error={err("name")} />
        <TextField
          name="company"
          label="Şirket"
          autoComplete="organization"
          optional
          maxLength={COMPANY_MAX}
          defaultValue={v.company}
          error={err("company")}
        />
        <TextField
          name="jobTitle"
          label="Unvan"
          autoComplete="organization-title"
          optional
          maxLength={JOB_TITLE_MAX}
          defaultValue={v.jobTitle}
          error={err("jobTitle")}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Varsayılan tercihler</legend>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Yeni hesaplarda başlangıç değeri olarak kullanılır.</p>
        <SelectField
          name="unitSystem"
          label="Birim sistemi"
          options={UNIT_SYSTEMS}
          defaultValue={v.unitSystem}
          error={err("unitSystem")}
        />
        <SelectField
          name="decimals"
          label="Ondalık basamak"
          options={DECIMAL_OPTIONS}
          defaultValue={v.decimals}
          hint="Sonuçlarda gösterilecek ondalık basamak sayısı."
          error={err("decimals")}
        />
        <SelectField
          name="standardSet"
          label="Standart seti"
          options={STANDARD_SETS}
          defaultValue={v.standardSet}
          error={err("standardSet")}
        />
      </fieldset>

      <div className="sm:max-w-xs">
        <SubmitButton pending={pending} pendingText="Kaydediliyor…">
          Kaydet
        </SubmitButton>
      </div>
    </form>
  );
}
