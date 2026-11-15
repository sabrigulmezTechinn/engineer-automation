// better-auth uç noktaları: /api/auth/* (giriş, kayıt, e-posta doğrulama, şifre sıfırlama, oturum...)
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
