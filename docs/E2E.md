# Uçtan uca (e2e) testler

Tarayıcıda (Playwright, Chromium) gerçek kullanıcı akışlarını çalıştırır. Düz Node betiğidir; `@playwright/test`
gerekmez, sistemde kurulu `playwright` paketi kullanılır (`pdftotext` yalnızca PDF senaryolarında gerekir).

## Çalıştırma

Betik **çalışan bir üretim sunucusuna** karşı koşar:

```bash
npx next build && npx next start -p 3100     # ayrı terminalde
node scripts/e2e/calistir.mjs                # E2E_BASE_URL varsayılanı http://localhost:3100
```

Ya da derlenmiş uygulamayı betik başlatıp kapatsın (derleme yapmaz; port E2E_BASE_URL'den alınır):

```bash
npx next build
node scripts/e2e/calistir.mjs --sunucu
```

`--sunucu` ile başlatılan sunucuya `BETTER_AUTH_URL=E2E_BASE_URL` ve `DEV_MAIL_DIR=E2E_MAIL_DIR` verilir.

| Seçenek | İş |
|---|---|
| `--senaryo=ad1,ad2` | Yalnızca bu senaryolar (`--listele` ile adlar) |
| `--sunucu` | `next start`'ı alt süreç olarak başlatır |
| `--listele` / `--yardim` | Senaryo listesi / yardım |

| Ortam değişkeni | Varsayılan | Not |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3100` | Sunucunun `BETTER_AUTH_URL`'i ile **aynı** olmalı (e-posta bağlantıları onunla kurulur) |
| `E2E_MAIL_DIR` | `<proje kökü>/.dev-mail` | Sunucunun geliştirme e-postalarını yazdığı klasör (sunucunun `DEV_MAIL_DIR`'i) |
| `E2E_CIKTI` | geçici dizinde `e2e-cikti-XXXXXX` | Hata ekran görüntüleri, indirilen PDF'ler, `rapor.json`, `--sunucu` günlüğü |

Her adım `✓`/`✗` ve süresiyle yazılır. Sonda bir özet çıkar. Bir adım başarısızsa çıkış kodu 1 olur.
Kurulum hataları tüm çalıştırmayı durdurur. Bunlar: sunucuya ulaşılamaması ve e-posta bağlantısının kökünün
`E2E_BASE_URL` ile uyuşmaması.

## Kapsam

| Senaryo | İçerik |
|---|---|
| `genel-sayfalar` | `/`, `/hesaplar`, `/standartlar` 200 ve konsol hatası yok; `/hesaplar/yok-boyle` 404; `/profil` oturumsuz → 307 `/giris?yonlendir=/profil` |
| `kimlik-dogrulama` | Akış sırası: kayıt (alan hatasında değerler korunur), `.dev-mail` doğrulama bağlantısı, doğrulanmamış girişin reddi, doğrulama ve otomatik giriş, profil (anlamlı basamak 3–8 ve hesapta uygulanması), çıkış, `/profil` → giriş → geri dönüş, şifremi unuttum, sıfırlama, yeni şifreyle giriş |
| `ohm-yasasi` | 12 V + 2,2 kΩ → 5,455 mA ve 65,45 mW; ara adımda mA; "abc" → "Geçerli bir sayı girin" |
| `hesap-sayfalari` | `/hesaplar`'daki her hesap, masaüstünde (1280 px) ve iPhone 13'te açılır. Denetlenenler: HTTP 200, konsol/`pageerror` hatası, KaTeX hatası, varsayılan girdilerle sonuç ve mobilde yatay taşma |
| `kaydetme-projeler`, `karsilastirma`, `pdf-rapor` | Faz 2. Henüz boş; "atlandı" olarak raporlanır |

## Oran sınırları

Üretim sunucusunda kayıt IP başına dakikada 5 kez, giriş IP ve e-posta başına dakikada 5 kez yapılabilir
(`src/app/(auth)/_lib/rate-limit.ts`). Bu sınırlar yüzünden:

- Bir çalıştırma en çok 2 kayıt yapar. Kullanıcılar `e2e.<zaman>@ornek.com.tr` biçiminde benzersizdir.
- Kimlik akışı aynı e-postayla 4 giriş denemesi yapar.
- Oran sınırına takılan kayıt bir kez bekleyip yeniden denenir.

## Yeni senaryo eklemek

1. `scripts/e2e/senaryolar/<ad>.mjs` dosyasını yazın. Dosya `{ ad, aciklama, adimlarBagimsiz?, calistir(t) }` dışa aktarır.
2. Senaryoyu `senaryolar/index.mjs`'teki listeye ekleyin.
3. Her denetimi `t.adim("...", async () => { ... })` içine yazın. Bağımlı senaryoda ilk hatadan sonra kalan adımlar atlanır.
4. Ortak yardımcılar `scripts/e2e/yardimcilar.mjs` içindedir:
   - `girisliBaglam(t)`: oturum açılmış bağlam. Kimlik senaryosunun oturumunu paylaşır, o senaryo çalışmadıysa yeni kullanıcı açar. Bu bağlamda çıkış yapmayın.
   - `indirilenPdf(page, tıklama)`: indirmeyi bekler ve `{ yol, metin }` döner.
   - Ayrıca `epostaBekle`, `girisYap`, `hidrasyonBekle`, `sunucuEylemiyle`, `metinOlmali` ve `gorunur`.
5. Gizlenen sayfalar DOM'da kalabilir (Activity). Bu yüzden locator olarak `getByRole` ya da `gorunur(locator)` kullanın.
