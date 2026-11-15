# Proje Kapsamı — Mühendislik Hesaplama Platformu

> Durum: Taslak v0.1 · Tarih: 2026-11-15

## 1. Vizyon

Otomasyon, mekatronik ve elektrik-elektronik mühendislerinin günlük hesaplarını tek bir yerde,
Türkçe, formülleri ve standart referanslarıyla birlikte yapabildiği; sonuçları kaydedip
karşılaştırabildiği ve rapor olarak alabildiği bir web platformu.

## 2. Temel kararlar

| Konu | Karar |
|---|---|
| Dil | Türkçe (ileride çoklu dil desteğine açık yapı) |
| Hedef kitle | Mühendisler ve tasarımcılar |
| Hesap kapsamı | Bölüm 4'teki tüm hesaplar (7 kategori, 50 hesap) |
| Kullanıcı hesabı | Var |
| Rapor | PDF çıktısı |
| Şeffaflık | Her hesapta formül ve standart referansı gösterilir |
| Karşılaştırma | Var (Bölüm 3.4) |

## 3. Platform özellikleri

### 3.1 Kullanıcı hesabı
- Kayıt, giriş, şifre sıfırlama (e-posta doğrulamalı)
- Profil: ad, şirket, unvan (rapor başlığında kullanılır)
- Varsayılan tercihler: birim sistemi, ondalık basamak, varsayılan standart seti

### 3.2 Hesaplama
- Kullanıcı kendi değerlerini girer; birim seçimi her girdide yapılabilir
- Anlık doğrulama: aralık dışı / fiziksel olarak anlamsız değerler için uyarı
- Sonuçta: değer + birim + kullanılan formül + ara adımlar + standart referansı
- Standart sınırlarına göre durum göstergesi (ör. gerilim düşümü %3 sınırını aşıyor → uyarı)

### 3.3 Kaydetme ve projeler
- Hesaplar isim verilerek kaydedilir
- Hesaplar projeler (klasörler) altında gruplanır
- Kayıtlı hesap açılıp düzenlenebilir, kopyalanabilir

### 3.4 Karşılaştırma
- **Senaryo karşılaştırma:** Aynı hesabın farklı girdilerle varyantları yan yana
  (ör. 4 mm², 6 mm², 10 mm² kablo için gerilim düşümü ve kayıp)
- **Kayıtlı hesap karşılaştırma:** Aynı türden kayıtlı hesaplar tabloda yan yana
- Değişen değerler vurgulanır; uygun olmayan seçenekler işaretlenir
- Sonuçlar grafikle de gösterilir (ör. kesit–gerilim düşümü eğrisi)

### 3.5 Rapor (PDF)
- Tek hesap raporu: başlık, kullanıcı/şirket bilgisi, tarih, girdiler, formül,
  ara adımlar, sonuçlar, standart referansları, uygunluk durumu
- Proje raporu: bir projedeki tüm hesaplar tek PDF'te
- Karşılaştırma raporu: senaryo tablosu ve grafik
- Sorumluluk reddi metni her raporda yer alır

### 3.6 Formül ve standart referansları
- Formüller matematiksel gösterimle (LaTeX tabanlı) görüntülenir
- Her hesapta ilgili standart(lar)ın adı, numarası ve ilgili madde/ek bilgisi
- Ayrı bir "Standartlar" sayfası: hangi standart hangi hesaplarda kullanılıyor

## 4. Hesap listesi

Sütunlar: **Hesap** · **Temel formül** · **Standart / kaynak referansı**

### 4.1 Temel elektrik (7)

| # | Hesap | Temel formül | Referans |
|---|---|---|---|
| 1.1 | Ohm yasası ve güç | V = I·R, P = V·I | IEC 60050 (terminoloji) |
| 1.2 | Seri/paralel R, C, L | R = ΣRᵢ ; 1/R = Σ1/Rᵢ | — |
| 1.3 | Gerilim ve akım bölücü | Vₒ = Vᵢ·R₂/(R₁+R₂) | — |
| 1.4 | AC güç (1 faz / 3 faz) | P = √3·U·I·cosφ, Q, S | IEC 60050-131 |
| 1.5 | Reaktans, empedans, rezonans | X_L = 2πfL, X_C = 1/(2πfC), f₀ = 1/(2π√LC) | — |
| 1.6 | Enerji tüketimi ve maliyet | E = P·t | — |
| 1.7 | dB dönüşümleri | dB = 10·log(P₂/P₁) = 20·log(V₂/V₁) | IEC 60027-3 |

### 4.2 Elektrik tesisat ve güç (8)

| # | Hesap | Temel formül | Referans |
|---|---|---|---|
| 2.1 | Kablo kesiti seçimi | I_z ≥ I_b (düzeltme faktörleriyle) | IEC 60364-5-52 (TS HD 60364-5-52) |
| 2.2 | Gerilim düşümü | ΔU = √3·I·L·(R·cosφ + X·sinφ) | IEC 60364-5-52 Ek G; Elektrik İç Tesisleri Yönetmeliği |
| 2.3 | Sigorta / şalter seçimi | I_b ≤ I_n ≤ I_z ; I₂ ≤ 1,45·I_z | IEC 60364-4-43, IEC 60898-1, IEC 60947-2 |
| 2.4 | Kompanzasyon (kVAR) | Q_c = P·(tanφ₁ − tanφ₂) | EPDK reaktif enerji sınırları |
| 2.5 | Kısa devre akımı | I_k = c·U_n / (√3·Z_k) | IEC 60909-0 |
| 2.6 | Trafo seçimi ve yüklenme | S = √3·U·I | IEC 60076 |
| 2.7 | Topraklama direnci | Çubuk (Dwight, d çap): R = ρ/(2πL)·[ln(8L/d) − 1] | IEC 60364-5-54; Elektrik Tesislerinde Topraklamalar Yönetmeliği |
| 2.8 | Pano ısı hesabı | ΔT = P_kayıp / (k·A) ; fan debisi | IEC/TR 60890, IEC 61439-1 |

### 4.3 Motor ve sürücü (5)

| # | Hesap | Temel formül | Referans |
|---|---|---|---|
| 3.1 | Güç–tork–devir | P = T·ω ; T[Nm] = 9550·P[kW]/n[rpm] | — |
| 3.2 | Motor nominal akımı | I = P / (√3·U·cosφ·η) | IEC 60034-1 |
| 3.3 | Yol verme akımları | I_Y = I_Δ/3 ; I_kalkış = k·I_n | IEC 60947-4-1 |
| 3.4 | VFD seçimi ve frenleme direnci | R_fren ≤ U_dc² / P_fren | IEC 61800-2 |
| 3.5 | Motor verimi ve enerji tasarrufu | η = P_çıkış/P_giriş | IEC 60034-2-1, IEC 60034-30-1 (IE sınıfları) |

### 4.4 Elektronik (12)

| # | Hesap | Temel formül | Referans |
|---|---|---|---|
| 4.1 | LED ön direnci | R = (V_s − V_f) / I_f | — |
| 4.2 | RC / RL zaman sabiti | τ = R·C ; τ = L/R | — |
| 4.3 | RC / LC filtre kesim frekansı | f_c = 1/(2πRC) | — |
| 4.4 | Op-amp kazancı | Eviren: −R_f/R_in ; Evirmeyen: 1 + R_f/R_g | — |
| 4.5 | Direnç renk kodu, SMD ve kondansatör kodları | Kod tabloları | IEC 60062 |
| 4.6 | 555 zamanlayıcı | f = 1,44 / ((R₁+2R₂)·C) | Üretici veri sayfası |
| 4.7 | LM317 / ayarlı regülatör | V_o = 1,25·(1 + R₂/R₁) + I_adj·R₂ | Üretici veri sayfası |
| 4.8 | Transistör baz direnci, MOSFET kaybı | R_B = (V_in − V_BE)/I_B ; P = I²·R_DS(on) + P_sw | — |
| 4.9 | Buck / boost dönüştürücü | Buck: D = V_o/V_i ; L = (V_i − V_o)·D / (f_s·ΔI) | Üretici uygulama notları |
| 4.10 | PCB yol genişliği | I = k·ΔT^0,44·A^0,725 | IPC-2221, IPC-2152 |
| 4.11 | Soğutucu / ısıl hesap | T_j = T_a + P·(R_θjc + R_θcs + R_θsa) | — |
| 4.12 | Batarya ömrü | t = C / I (ops. Peukert düzeltmesi) | — |

### 4.5 Otomasyon ve PLC (7)

| # | Hesap | Temel formül | Referans |
|---|---|---|---|
| 5.1 | Analog ölçekleme (4-20 mA, 0-10 V, raw) | y = (x − x₁)·(y₂ − y₁)/(x₂ − x₁) + y₁ | NAMUR NE 43 (hata sinyal sınırları) |
| 5.2 | Enkoder hesapları | f = PPR·n/60 ; çözünürlük = 360°/(PPR·4) | — |
| 5.3 | PT100 ve termokupl dönüşümleri | R(T) = R₀·(1 + A·T + B·T²) (Callendar–Van Dusen) | IEC 60751, IEC 60584-1 |
| 5.4 | 24 VDC güç kaynağı yük hesabı | P_top = Σ(Pᵢ)·k_eşzamanlılık·k_rezerv | IEC 61131-2 |
| 5.5 | PID ayarı | Ziegler–Nichols: K_p = 0,6·K_u, T_i = T_u/2, T_d = T_u/8 | — |
| 5.6 | 4-20 mA döngü yük direnci | R_maks = (V_s − V_min,verici) / 0,022 A | NAMUR NE 43 |
| 5.7 | RS485 / Modbus | Kablo uzunluğu, sonlandırma 120 Ω, karakter süresi | TIA/EIA-485-A, Modbus over Serial Line |

### 4.6 Mekatronik ve mekanik tahrik (9)

| # | Hesap | Temel formül | Referans |
|---|---|---|---|
| 6.1 | Dişli ve kayış-kasnak oranları | i = z₂/z₁ ; T₂ = T₁·i·η | — |
| 6.2 | Vidalı mil (ballscrew) | T = F·P_h / (2π·η) ; kritik devir | ISO 3408 |
| 6.3 | Step motor | Adım/devir = (360/θ)·mikrostep | — |
| 6.4 | Servo boyutlandırma | T = J_top·α + T_yük ; atalet oranı J_yük/J_motor | — |
| 6.5 | Kremayer-pinyon ve konveyör gücü | P = F·v / η | DIN 22101 (bant konveyör) |
| 6.6 | Pnömatik silindir kuvveti ve hava tüketimi | F = p·A·η ; Q = A·s·n·(p+p_atm)/p_atm | ISO 15552, ISO 6432, ISO 8778 |
| 6.7 | Hidrolik silindir ve pompa | F = p·A ; v = Q/A ; P = p·Q/η | ISO 6020/6022 |
| 6.8 | Vakum vantuz tutma kuvveti | F = Δp·A / S (S: emniyet katsayısı) | — |
| 6.9 | Rulman ömrü | L₁₀ = (C/P)^p (bilyeli p=3, makaralı p=10/3) | ISO 281 |

### 4.7 Yardımcı araçlar (2)

| # | Hesap | İçerik | Referans |
|---|---|---|---|
| 7.1 | Birim dönüştürücü | Güç, tork, basınç, sıcaklık, uzunluk, AWG ↔ mm² | ISO 80000, ASTM B258 |
| 7.2 | Standart değer serileri | E6–E192, en yakın standart değer | IEC 60063 |

## 5. Önemli notlar ve riskler

1. **Standart telif hakkı:** IEC/ISO standartlarının tabloları (ör. IEC 60364-5-52 akım
   taşıma kapasitesi tabloları) telif hakkıyla korunur. Sitede standart adı ve madde numarası
   referans gösterilebilir; tabloların birebir yayınlanması için lisans gerekebilir. Alternatif:
   kablo üreticilerinin kamuya açık katalog değerleri veya TSE'den lisans.
2. **Sorumluluk:** Hesaplar mühendislik kararının yerine geçmez; her sayfada ve raporda
   sorumluluk reddi bulunmalı.
3. **Doğrulama:** Her hesap, bilinen çözümlü örneklerle (standart ekleri, ders kitapları)
   otomatik testlerle doğrulanmalı.
4. **Yönetmelik güncelliği:** Türkiye'ye özgü sınırlar (EİTY gerilim düşümü, EPDK reaktif
   sınırları) değişebilir; bu değerler koddan ayrı, güncellenebilir bir yapılandırmada tutulmalı.

## 6. Uygulama sırası (öneri)

Kapsam 50 hesabın tamamıdır; teslim aşamalı yapılır:

| Faz | İçerik |
|---|---|
| Faz 0 | Altyapı: kullanıcı hesabı, hesap motoru çatısı, birim sistemi, formül gösterimi |
| Faz 1 | Temel elektrik + Motor/sürücü + Otomasyon/PLC + Yardımcı araçlar (21 hesap) |
| Faz 2 | Kaydetme/projeler, karşılaştırma, PDF rapor |
| Faz 3 | Elektrik tesisat (8) + Mekatronik/mekanik (9) |
| Faz 4 | Elektronik (12) |
