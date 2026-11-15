# engineer-automation

Otomasyon, mekatronik ve elektrik-elektronik mühendisleri için Türkçe hesaplama platformu.
Kapsam ve yol haritası: [docs/KAPSAM.md](docs/KAPSAM.md). Çalışma düzeni: [CLAUDE.md](CLAUDE.md).

**Yığın:** Next.js 16 (App Router, `cacheComponents` açık), React 19, TypeScript, Tailwind 4,
KaTeX, better-auth 1.7, Drizzle ORM + PostgreSQL 16, Vitest.

## Kurulum (yeni bir makine veya container)

```bash
npm ci
bash scripts/db-setup.sh          # Postgres'i başlatır, engineer kullanıcısını ve veritabanını oluşturur
cp .env.example .env.local        # sonra BETTER_AUTH_SECRET'i doldurun: openssl rand -base64 32
npm run db:migrate
npm run dev                       # http://localhost:3000
```

- `BETTER_AUTH_URL`, sunucunun gerçekten çalıştığı adresle aynı olmalıdır; e-postalardaki bağlantılar bununla oluşturulur.
- `next build` derleme sırasında `DATABASE_URL` ve `BETTER_AUTH_SECRET` ister.
- Geliştirmede e-posta gönderilmez: sunucu konsoluna yazılır ve `.dev-mail/` altına JSON + HTML olarak kaydedilir
  (doğrulama/sıfırlama bağlantısı JSON'daki `links[0]`).

## Komutlar

| Komut | İş |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi / sunucusu |
| `npm test` | Vitest (gerçek Postgres isteyen `src/lib/auth.integration.test.ts` dahil) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` / `npm run db:migrate` | Drizzle migration üret / uygula |

## Yapı

| Yol | İçerik |
|---|---|
| `src/lib/units/` | Birim kataloğu (34+ boyut), SI dönüşümü, Türkçe sayı okuma/biçimlendirme |
| `src/lib/calc/` | Hesap motoru (`runCalc`), kayıt defteri, LaTeX adım yardımcıları, otomatik birim seçimi |
| `src/lib/calc/defs/<kategori>/<slug>.ts` | Hesap tanımları; yeni hesap buraya yazılır ve `registry.ts`'e eklenir |
| `src/config/sinirlar.ts` | Yönetmelik/standart sınır değerleri (koddan ayrı, `ctx.limits` ile okunur) |
| `src/app/hesaplar/[slug]` | Genel hesap sayfası (formül, form, ara adımlar, referanslar) |
| `src/app/(auth)`, `src/app/profil` | Kayıt, giriş, e-posta doğrulama, şifre sıfırlama, profil ve tercihler |
| `src/db/` | Drizzle şeması; `user-fields.ts` profil alanlarının tek kaynağı |
| `src/proxy.ts` | Bilinmeyen hesap adresine 404, korumalı sayfalara oturum yönlendirmesi |

## Yeni hesap eklemek

1. `src/lib/calc/defs/<kategori>/<slug>.ts` içinde `CalcDefinition` yazın (girdi/çıktı SI'da, `compute` saf).
2. `src/lib/calc/registry.ts` içindeki listeye ekleyin; kayıt defteri yüklenirken tanımı doğrular.
3. Bilinen çözümlü örneklerle (standart ekleri, ders kitapları) test yazın; adım LaTeX'i KaTeX strict ile denetlenir.
4. Sınır değerleri koda gömmeyin, `src/config/sinirlar.ts`'e ekleyin.

## Notlar

- Alt ajan çalışma kopyalarında (`.claude/worktrees/`) `node_modules` bağlantı (symlink) olduğu için
  `next build` orada çalışmaz; build ana checkout'ta çalıştırılır.
- Hesaplar mühendislik kararının yerine geçmez; her sayfada ve raporda sorumluluk reddi bulunur.
