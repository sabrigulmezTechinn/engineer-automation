"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Çıkış: oturumu veritabanından siler, çerezi temizler ve ana sayfaya döner. */
export async function signOutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // Oturum zaten yoksa/geçersizse yine de ana sayfaya dön.
    console.error("[kimlik doğrulama] Çıkış sırasında hata:", error);
  }
  redirect("/");
}
