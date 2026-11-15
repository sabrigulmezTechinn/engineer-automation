/**
 * Tarayıcı tarafı better-auth istemcisi (React).
 *
 * Bu projedeki giriş/kayıt/profil formları Server Action'larla çalışır (bkz. src/app/(auth)/_lib/actions.ts),
 * bu yüzden istemci şu an zorunlu değildir; istemci bileşenlerinde oturum bilgisine ihtiyaç duyulursa
 * (ör. `authClient.useSession()`) buradan kullanılır. Sunucu bileşenlerinde bunun yerine
 * `src/lib/session.ts` içindeki `getSession()` kullanılmalıdır.
 */
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  // baseURL verilmezse istek, sayfanın bulunduğu kökün /api/auth yoluna gider (aynı köken).
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { useSession, signOut } = authClient;
