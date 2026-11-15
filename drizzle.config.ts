import { defineConfig } from "drizzle-kit";

// drizzle-kit, Next.js gibi .env.local'ı kendiliğinden okumaz. Dosya varsa yükle; yoksa
// (ör. CI'da değişkenler ortamdan geliyorsa) sessizce devam et.
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // `db:generate` veritabanına bağlanmaz; yalnızca `db:migrate` için gereklidir.
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
