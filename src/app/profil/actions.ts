"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authErrorMessage, fieldErrorsOf, formText, type FormState } from "@/app/(auth)/_lib/form";
import { loginPath } from "@/app/(auth)/_lib/redirect";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { profileSchema, type ProfileField } from "./_lib/validation";

export type ProfileState = FormState<ProfileField>;

/** Profil ve tercihleri kaydeder. Oturum burada yeniden doğrulanır (istemciye güvenilmez). */
export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getSession();
  if (!session) redirect(loginPath("/profil"));

  const values = {
    name: formText(formData, "name"),
    company: formText(formData, "company"),
    jobTitle: formText(formData, "jobTitle"),
    unitSystem: formText(formData, "unitSystem"),
    decimals: formText(formData, "decimals"),
    standardSet: formText(formData, "standardSet"),
  };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lütfen işaretli alanları düzeltin.",
      fieldErrors: fieldErrorsOf<ProfileField>(parsed.error),
      values,
    };
  }

  const { name, company, jobTitle, unitSystem, decimals, standardSet } = parsed.data;
  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: {
        name,
        // Boş bırakılan alan temizlenir (NULL).
        company: company || null,
        jobTitle: jobTitle || null,
        unitSystem,
        decimals,
        standardSet,
      },
    });
  } catch (error) {
    return { status: "error", message: authErrorMessage(error), values };
  }

  // Başlıktaki kullanıcı adı gibi oturuma bağlı arayüzü yenile.
  refresh();
  return { status: "success", message: "Profiliniz kaydedildi.", values };
}
