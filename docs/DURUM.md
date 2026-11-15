# Proje durumu

> Her birleştirmede güncellenir. Yeni oturum buradan devam eder.
> Kullanıcı talimatı: **tüm fazlar (1–4) bitene kadar onay beklemeden devam et.**

## Fazlar

| Faz | İçerik | Durum |
|---|---|---|
| 0 | Altyapı: kullanıcı hesabı, hesap motoru, birim sistemi, formül gösterimi | ✅ Bitti (c5ddcb7) |
| 1 | Temel elektrik (7) + Motor/sürücü (5) + Otomasyon/PLC (7) + Yardımcı (2) = 21 hesap | ✅ Bitti |
| 2 | Kaydetme/projeler, karşılaştırma, PDF rapor | ✅ Bitti (10b478a; 1238 test, e2e 111 adım) |
| 3 | Elektrik tesisat (8) + Mekatronik/mekanik (9) | ✅ Bitti (38 hesap; 072aad2: 1623 test, e2e 145 adım; danışman incelemesi) |
| 4 | Elektronik (12) | ✅ Bitti (50 hesap, tüm kapsam; cd60d21: 2158 test, e2e 169 adım) |

## Hesaplar

| No | Hesap | Durum |
|---|---|---|
| 1.1–1.7 | Temel elektrik | ✅ |
| 3.1–3.5 | Motor ve sürücü | ✅ (3.5'te IE sınıfı tespiti yok) |
| 5.1–5.7 | Otomasyon ve PLC | ✅ |
| 7.1–7.2 | Yardımcı araçlar | ✅ |
| 2.1–2.8 | Elektrik tesisat | ✅ (2.1: katalog yolu Prysmian NYY/YXV + elle I₀; IEC 60364-5-52 Ek G yok) |
| 6.1–6.9 | Mekatronik | ✅ |
| 4.1–4.12 | Elektronik | ✅ (4.5 özel arayüzlü: renkli bant çizimi + kod metin kutusu) |

Danışman Faz 1'de şu hesapların formül gövdelerini inceledi: 1.4, 1.7, 3.3, 3.4 (aritmetik), 5.3, 7.1 (AWG), 7.2.
Diğerleri (1.2, 1.3, 1.5, 1.6, 3.1, 3.2, 3.5, 5.1, 5.2, 5.4, 5.6, 5.7) işçilerin elle hesaplanmış testlerine dayanır.
Faz 3'te danışman 2.1–2.3, 2.5, 2.7, 6.2, 6.9 gövdelerini inceledi (formül hatası yok); diğer on hesabın ana test vektörleri elle doğrulandı.

## Çalışma düzeni (her faz)

1. Ortak zemin (ana oturum): sözleşme değişiklikleri, işçilerin çakışmayacağı dosya sahipliği.
2. Planı danışmana göster.
3. Paralel işçiler (Opus, ayrı worktree; `node_modules` symlink; paket kurmaz, build çalıştırmaz).
4. Birleştir → `audit` (tsc, eslint, vitest) → ana checkout'ta `next build && next start -p 3100` → `npm run e2e` (docs/E2E.md).
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
- Sayı biçimi: varsayılan 4 anlamlı basamak, ama tam sayı basamakları hiç atılmaz (17 786,56 → 17 787); para (TL) iki ondalık. Çıktı başına `significant` / `integer` seçenekleri.
- 5.5 PID: klasik Ziegler–Nichols katsayıları (PI 0,45·K_u, T_u/1,2; açık çevrim PI T_i = L/0,3). Åström & Hägglund'un değiştirilmiş PI değerleri kullanılmaz.
- 5.7 RS485: kablo uzunluğu kılavuzu L·Bd ≤ 10⁷ (TI SLLA272D, tutucu), en çok 1200 m; sonlandırma Modbus §3.4.5'e göre 150 Ω (polarizasyonla 120 Ω + 1 nF).
- 5.6: döngü tasarım akımı 22 mA config'ten; NE 43 sınırları config'ten.
- PDF: pdfmake 0.3.13 + MathJax 4 (@mathjax/src 4.1.3) yol tabanlı SVG + Noto Sans (OFL); sunucuda üretilir (route handler).
  next.config'te serverExternalPackages; yazı tipleri outputFileTracingIncludes ile dağıtıma dahil.
- Faz 2 veri modeli: proje + kayitli_hesap (girdiler = InputState jsonb, ciktiBirimleri jsonb); proje silinince hesaplar projesiz kalır.
  Her sorgu oturumdaki kullanıcıya göre süzülür.
- Hesap sayfası durumu useCalcState (src/components/calc/use-calc-state.ts); CalcWorkspace kaydetme/rapor/senaryo yuvaları.
  Profil tercihleri runSecenekleri ile motora geçer (anlamlı basamak; imperial: hp, lbf·ft, psi, °F).
- Karşılaştırmada bir satırdaki tüm senaryolar tek birimle gösterilir.
- İmperial tercih: tork lbf·ft, basınç psi, sıcaklık °F; güç bilerek yok (elektrik devrelerinde hp anlamsız).
- Rapor uç noktaları hız sınırlı (girişsiz IP başına 20/dk, girişli kullanıcı başına 30/dk; yalnızca üretimde).
- Faz 3 telif kararı (2.1): IEC 60364-5-52 tabloları gömülmez; kamuya açık üretici kataloğu değerleri kaynağıyla,
  kullanıcı I₀'ı geçersiz kılabilir; sıcaklık düzeltmesi formülle, gruplama/toprak katsayıları girdi.
- Adımlarda birimler latexSpec ile (kartla aynı; mekanikte varsayılan birim).
- Kontrol seviyeleri: "ok" yalnızca sağlanan koşul hükmü (yeşil, "Uygun"); kabul/yöntem/hatırlatma notları "bilgi" (nötr).
  En kötü seviye (karşılaştırma rozeti, PDF özeti) bilgiyi saymaz.
- 2.1 teslim yolu: (a) Prysmian NYY (PVC) ve YXV (XLPE) 4 damarlı katalog tabloları + (b) elle I₀; k_t formülle,
  gruplama/toprak katsayıları girdi. EİTY sınırları (%1,5 / %3 / %5) RG 22479 (1995 değişikliği) üzerinden okundu.
- 2.7 Dwight çubuk formülü çapla: R = ρ/(2πL)·[ln(8L/d) − 1] (KAPSAM düzeltildi; 16 mm, 3 m, 100 Ω·m → 33,49 Ω).
- 2.5 varsayılan gerilim toleransı +%6 (c_maks 1,05; CT158 örneğiyle aynı), +%10 seçilebilir; faz-toprak Dyn trafo ve PE dönüşü kabulüyle.
- Faz 4 ortak zemini: ns/µJ/mJ/nC/µC birimleri; 4.5 için "renk-kodu" özel arayüzü (durum select'lerde, metin kutusu ayrıştırır;
  yeni girdi türü yok); select çarpımı 512'yi aşınca görünürlüğü yöneten select'ler × diğer her seçenek tek tek denenir.
- Faz 4 standart değer yuvarlama: güvenli yön (LED ön direnci, LM317 akım direnci, bobin, kondansatör üst komşu; BJT baz
  direnci alt komşu); kazanç/V_o/555/filtre en yakın değer; değer seride varsa kendisi. E serileri yardimci/e-serileri.ts'ten.
- 4.6 555: compute tam ln 2 ve ln 3; 1,44 ve 1,1 yalnızca gösterilen formüllerde (veri sayfası yaklaşımı).
- 4.9: TI SLVA477C (buck) ve SLVA372D (boost) denklem numaralarıyla; boost dalgalanma tabanı I_o·V_o/V_in,tip (Denk. 6, η'sız);
  buck D = V_o/(V_in·η) (gövde Denk. 1; aynı notun Ek A'sı V_o·η/V_in der, çelişki referans notunda).
- 4.12 Peukert: t = d·H·(C/(I·H))^k (kullanılabilir oran d üssün dışında); k varsayılanı 1,25 (Victron, kurşun-asit).
- 4.10 IPC-2221: I = k·ΔT^0,44·A^0,725 (A mil²; dış 0,048, iç 0,024); IPC-2152 kapalı formu yok, yalnızca referans.
- Termokupl katsayıları NIST dosyasından `scripts/nist-termokupl-katsayilari.py` ile üretilir; E serileri Vishay (IEC 60063'e göre) tablosundan.

## Açık işler

- Faz 2: başkasının/olmayan proje ve `/karsilastir` "bulunamadı" ekranı HTTP 200 döner (cacheComponents akışı; noindex). Gerçek 404 için proxy'de veritabanı sorgusu gerekir.
- Faz 2: Suspense yedeğinde girişli kullanıcı bir an "Kaydetmek için giriş yapın" ve varsayılan değerleri görebilir.
- Faz 2: kayıtlı hesabın adını/notunu sonradan düzenleme arayüzü yok (action destekliyor); kaydedilmemiş değişiklikle sayfadan çıkışta uyarı yok.
- Faz 2: tarama tam sayı girdilerde kesirli noktaları hesaplayamaz (null); emoji/CJK için PDF yazı tipi yok.
- Hız sınırlayıcılar (auth, rapor) bellek içi ve tek süreçlidir; IP `x-forwarded-for`'dan okunur.
- Dev veritabanında e2e test kullanıcıları birikir (e2e.*@ornek.com.tr).

- Faz 2 (KAPSAM §3.1'den sapma, planlandı): profildeki "ondalık basamak" tercihi "anlamlı basamak" olarak yeniden tanımlanacak.
- 3.5: IE verim sınıfı tablosu (AB 2019/1781 Ek I) eklenmedi; eur-lex otomatik indirmeye izin vermedi. Elle indirilip eklenmeli.
- İçeriği açılıp doğrulanamayan referanslar: IEC 60947-4-1/-4-2, 61800-2, 60034 ailesi madde numaraları; TIA/EIA-485-A; NAMUR NE 43; ASTM B258; IEC 60063 tabloları (Vishay üzerinden); Ziegler & Nichols 1942 özgün makalesi; IEV madde numaraları.
- Öneriler: `zaman` boyutuna yıl birimi (3.5 geri ödeme şimdilik birimsiz), 1/s boyutu (5.5 K_i), bilgi seviyesinde Check, `visibleWhen` VE koşulu, metin girdisi (5.1 proses birimi etiketi), dBm gibi gösterim eki, mekanik büyüklükleri adımlarda varsayılan birimle yazan LaTeX yardımcısı (Faz 3 öncesi).

- Gerçek e-posta sağlayıcısı (şimdilik konsol + `.dev-mail/`).
- Oran sınırlayıcı istemci kaynaklı `x-forwarded-for`'a güveniyor; dağıtım ortamındaki ters vekile göre düzeltilmeli.
- Profil tercihleri (ondalık basamak, birim sistemi) kaydediliyor ama hesap sayfalarına uygulanmıyor (Faz 2 ile birlikte).
- Standart seti seçenekleri (`iec`, `ts`) geçici.
- Faz 3: IEC 60364-5-52 tabloları telif nedeniyle birebir gömülemez (KAPSAM §5.1); üretici katalog değerleri veya lisans gerekir.
- 2.2: EİTY'nin güncel birleştirilmiş metni mevzuat.gov.tr'de bulunamadı; sınırlar 1995 değişikliğinden. Elle teyit edilmeli.
- 2.5: c_min değeri CT158 (IEC 60909 2001 baskısına dayanır); 2016 baskısındaki değer doğrulanmadı.
- 2.3: gG sigortada I_n < 16 A için I₂/I_n oranının kaynağı açılamadı (kullanıcı girdisi). Kablo reaktansı için Türk üretici tablosu bulunamadı.
- 6.x: ISO 3408, 15552, 6432, 6020-2, 6022, 281 tam metinleri açılmadı (değerler THK/Festo/SKF kataloglarından).
- Faz 4: kategori içi yardımcılar (temel-ortak, entegre-ortak, guc-ortak, kod-ortak, mekatronik/tahrik-ortak) num/specWriter
  kopyalarını tekrarlar; tekilleştirilebilir. 4.10'da ρ/α tavlanmış tel değeri (config), PCB folyosu farklı olabilir.
- Faz 4 önerileri: nA birimi, mil², 1/K, `maxExclusive`, `visibleWhen` VE koşulu, CalcFormView'de girdi gizleme (4.5'te bant
  select'leri hem panelde hem formda), moda bağlı çıktı etiketi.
- 4.9 kapsam dışı: diyot kaybı, ESR dalgalanması, giriş kondansatörü. 4.11: paralel R_θJA modeli yok.
- formatNumber negatif sayıda ASCII "-" yazar ("−5 °C" yerine "-5 °C").
- Öneriler (Faz 3 işçileri): 1/K, mm⁴, kg/m³, "milyon devir", NL hacim birimleri; eşli liste girdisi (P_i ile cos φ_i).
