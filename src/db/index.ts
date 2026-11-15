/**
 * Veritabanı bağlantısı: tek bir `pg` havuzu + Drizzle.
 *
 * Yalnızca sunucuda içe aktarılmalıdır. Havuz tembeldir: içe aktarmak bağlantı açmaz,
 * ilk sorguda bağlanır.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL tanımlı değil. .env.example dosyasını .env.local olarak kopyalayıp doldurun " +
      "(yerel veritabanı için: scripts/db-setup.sh).",
  );
}

/**
 * Geliştirmede sıcak yeniden yüklemede (HMR) modül tekrar değerlendirilir; her seferinde yeni
 * havuz açılıp bağlantılar tükenmesin diye havuzu globalThis üzerinde saklarız.
 */
const globalForDb = globalThis as typeof globalThis & { __engineerPgPool?: Pool };

const pool =
  globalForDb.__engineerPgPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__engineerPgPool = pool;
}

export const db = drizzle({ client: pool, schema });
export { pool, schema };
export type Database = typeof db;
