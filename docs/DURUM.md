# Proje durumu

> Her birleştirmede güncellenir. Yeni oturum buradan devam eder.
> Kullanıcı talimatı: **tüm fazlar (1–4) bitene kadar onay beklemeden devam et.**

## Fazlar

| Faz | İçerik | Durum |
|---|---|---|
| 0 | Altyapı: kullanıcı hesabı, hesap motoru, birim sistemi, formül gösterimi | ✅ Bitti (c5ddcb7) |
| 1 | Temel elektrik (7) + Motor/sürücü (5) + Otomasyon/PLC (7) + Yardımcı (2) = 21 hesap | 🔄 Sürüyor |
| 2 | Kaydetme/projeler, karşılaştırma, PDF rapor | ⏳ |
| 3 | Elektrik tesisat (8) + Mekatronik/mekanik (9) | ⏳ |
| 4 | Elektronik (12) | ⏳ |

## Hesaplar

| No | Hesap | Durum |
|---|---|---|
| 1.1 | Ohm yasası ve güç | ✅ |
| 1.2–1.7 | Temel elektrik | 🔄 Faz 1 işçisi A |
| 3.1–3.5 | Motor ve sürücü | 🔄 Faz 1 işçisi B |
| 5.1–5.7 | Otomasyon ve PLC | 🔄 Faz 1 işçisi C |
| 7.1–7.2 | Yardımcı araçlar | 🔄 Faz 1 işçisi D |

## Çalışma düzeni (her faz)

1. Ortak zemin (ana oturum): sözleşme değişiklikleri, işçilerin çakışmayacağı dosya sahipliği.
2. Planı danışmana göster.
3. Paralel işçiler (Opus, ayrı worktree; `node_modules` symlink; paket kurmaz, build çalıştırmaz).
4. Birleştir → `audit` (tsc, eslint, vitest) → ana checkout'ta `next build` → Playwright ile tarayıcı testi.
5. Son diff'i ve formül gövdelerini danışmana incelet → `DURUM.md` güncelle → sonraki faz.

## Doğruluk kuralları (her işçi brifinginde)

- `compute` SI alır ve SI döner. KAPSAM'daki mühendislik formları (9550·P/n, PPR·n/60) yalnızca gösterim içindir.
- Beklenen test değerleri kaynaktan (standart eki, ders kitabı, veri sayfası) veya elle hesaptan gelir; kodu çalıştırıp alınmaz.
- Her hesapta varsayılan dışı birimlerle en az bir `runCalc` testi.
- Veri tabloları (termokupl katsayıları, IE verimleri, E serileri, AWG…) ezberden yazılmaz; birincil kaynaktan alınır.
- `src/lib/calc/all-calcs.test.ts` her kayıtlı hesabı otomatik denetler (varsayılan durum, KaTeX strict, birimler, referans).

## Alınan kararlar

- Çıktı birimi otomatik seçilir (elektrik büyüklüklerinde; varsayılan birimin 10³ⁿ kardeşleri). Mekanik büyüklükler ve veri hızı otomatik değişmez.
- Binlik ayırıcı U+202F (ISO 80000-1); "." binlik olarak yalnızca kullanıcı girdisinde tanınır.
- `hp` = 745,7 W (mekanik), `PS` = 735,5 W (metrik beygir).
- Enerji fiyatı kanonik birimi TL/J (arayüzde TL/kWh). dB tek birimli boyut; dBm/dBV kardeş birim değildir.
- 4-20 mA döngü tasarım akımı 22 mA (config, girdi olarak değiştirilebilir); NE 43 arıza eşiği ≥ 21 mA ayrı değer.
- Bilinmeyen hesap adresi `src/proxy.ts` ile gerçek 404 döner (cacheComponents akışı yüzünden sayfadaki notFound 200 bırakıyordu).
- Liste girdileri `numberList` türüyle (";" ile ayrılmış); özel arayüzlü hesaplar `customUi` ile, ama durumlarını yine `InputState` + `runCalc` ile tutarlar.

## Açık işler

- Gerçek e-posta sağlayıcısı (şimdilik konsol + `.dev-mail/`).
- Oran sınırlayıcı istemci kaynaklı `x-forwarded-for`'a güveniyor; dağıtım ortamındaki ters vekile göre düzeltilmeli.
- Profil tercihleri (ondalık basamak, birim sistemi) kaydediliyor ama hesap sayfalarına uygulanmıyor (Faz 2 ile birlikte).
- Standart seti seçenekleri (`iec`, `ts`) geçici.
- Faz 3: IEC 60364-5-52 tabloları telif nedeniyle birebir gömülemez (KAPSAM §5.1); üretici katalog değerleri veya lisans gerekir.
