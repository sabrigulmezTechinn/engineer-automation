# engineer-automation

Türkçe mühendislik hesaplama platformu. Kapsam: docs/KAPSAM.md

## Model düzeni
- Ana oturum (Sonnet): kodu yazar, düzeltmeleri uygular, işi koordine eder.
- Danışman (Opus, advisor aracı). Şu üç anda danışmana başvur:
  1. Bir planı kesinleştirmeden önce
  2. Aynı hata ikinci kez ortaya çıktığında
  3. İşi bitti olarak bildirmeden önce (son diff'i incelet)
- Alt ajanlar (Haiku): `search`, `grep`, `audit`

## Devretme kuralı (ana bağlamı küçük tutmak için)
- Depodaki her arama alt ajana gider: yapı veya konu bulmak için `search`, çağrı noktaları için `grep`. Yeri bilinen tek bir dosyayı okumak bu kurala dahil değildir.
- Her test çalıştırması ve diff denetimi `audit` ajanına gider.
- `audit` yalnızca commit edilmiş işi görür: devretmeden önce değişiklikleri yerel olarak commit et ve ajana denetlenecek commit aralığını ver.
- Hesap formüllerinin doğruluğuna Haiku karar vermez; son söz testlerde ve danışmandadır.
