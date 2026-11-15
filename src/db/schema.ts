/**
 * Veritabanı şeması (Drizzle, PostgreSQL).
 *
 * `user`, `session`, `account`, `verification` tabloları better-auth 1.7'nin Drizzle adapter'ının
 * beklediği alan adlarıyla yazılmıştır (referans: better-auth'un kendi şema üreticisinin çıktısı).
 * Tablo nesnelerinin dışa aktarım adları ve sütun özellik adları better-auth model/alan adlarıyla
 * aynı olmalıdır; better-auth çalışırken bu nesneyi kendi yapılandırmasıyla karşılaştırır ve
 * uyuşmazlıkta hata verir. Şemayı değiştirdikten sonra: `npm run db:generate` ve `npm run db:migrate`.
 */
import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { InputState } from "@/lib/calc/types";
import { PREFERENCE_DEFAULTS, UNIT_SYSTEM_VALUES } from "./user-fields";

const zaman = (ad: string) => timestamp(ad, { withTimezone: true });

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: zaman("created_at").defaultNow().notNull(),
  updatedAt: zaman("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),

  // Profil (KAPSAM §3.1) — rapor başlığında kullanılır
  company: text("company"),
  /** Unvan */
  jobTitle: text("job_title"),

  // Varsayılan tercihler
  unitSystem: text("unit_system", { enum: UNIT_SYSTEM_VALUES })
    .default(PREFERENCE_DEFAULTS.unitSystem)
    .notNull(),
  decimals: integer("decimals").default(PREFERENCE_DEFAULTS.decimals).notNull(),
  standardSet: text("standard_set").default(PREFERENCE_DEFAULTS.standardSet).notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: zaman("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: zaman("created_at").defaultNow().notNull(),
    updatedAt: zaman("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: zaman("access_token_expires_at"),
    refreshTokenExpiresAt: zaman("refresh_token_expires_at"),
    scope: text("scope"),
    /** Şifre özeti (scrypt); yalnızca "credential" sağlayıcısında dolu */
    password: text("password"),
    createdAt: zaman("created_at").defaultNow().notNull(),
    updatedAt: zaman("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

/** E-posta doğrulama dışındaki tek kullanımlık değerler (ör. şifre sıfırlama jetonu) */
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: zaman("expires_at").notNull(),
    createdAt: zaman("created_at").defaultNow().notNull(),
    updatedAt: zaman("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// İlişkiler (drizzle-orm 0.x ilişkisel sorgu API'si için: db.query.user.findFirst({ with: ... }))
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  projeler: many(proje),
  kayitliHesaplar: many(kayitliHesap),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// ---------------------------------------------------------------------------------------------
// Kaydetme ve projeler (KAPSAM §3.3, Faz 2)
// Her sorgu oturumdaki kullanıcıya göre süzülür (src/lib/kayit). Proje silinince içindeki hesaplar
// silinmez, projeden çıkarılır (proje_id → NULL).
// ---------------------------------------------------------------------------------------------

export const proje = pgTable(
  "proje",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ad: text("ad").notNull(),
    aciklama: text("aciklama"),
    createdAt: zaman("created_at").defaultNow().notNull(),
    updatedAt: zaman("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("proje_userId_idx").on(table.userId)],
);

export const kayitliHesap = pgTable(
  "kayitli_hesap",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projeId: text("proje_id").references(() => proje.id, { onDelete: "set null" }),
    /** Hesap tanımının slug'ı (kalıcı kimlik); hesapId KAPSAM numarası, listelerde sıralama için */
    hesapSlug: text("hesap_slug").notNull(),
    hesapId: text("hesap_id").notNull(),
    ad: text("ad").notNull(),
    notlar: text("notlar"),
    /** Kaydedilebilir girdi durumu (InputState): kaydetmede hesap tanımına göre süzülür */
    girdiler: jsonb("girdiler").$type<InputState>().notNull(),
    /** Kullanıcının seçtiği çıktı gösterim birimleri (output key → unit id) */
    ciktiBirimleri: jsonb("cikti_birimleri").$type<Record<string, string>>().default({}).notNull(),
    createdAt: zaman("created_at").defaultNow().notNull(),
    updatedAt: zaman("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("kayitli_hesap_userId_idx").on(table.userId),
    index("kayitli_hesap_projeId_idx").on(table.projeId),
  ],
);

export const projeRelations = relations(proje, ({ one, many }) => ({
  user: one(user, { fields: [proje.userId], references: [user.id] }),
  hesaplar: many(kayitliHesap),
}));

export const kayitliHesapRelations = relations(kayitliHesap, ({ one }) => ({
  user: one(user, { fields: [kayitliHesap.userId], references: [user.id] }),
  proje: one(proje, { fields: [kayitliHesap.projeId], references: [proje.id] }),
}));
