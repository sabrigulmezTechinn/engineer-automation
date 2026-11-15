/**
 * Karşılaştırma ve tarama testleri. Gerçek hesap tanımları (1.1 Ohm yasası, 1.2 seri/paralel) ve gerçek birim
 * sistemiyle çalışır. Beklenen değerler elle hesaplanmıştır (V = I·R, P = V²/R, seri R = ΣRᵢ).
 */
import { describe, expect, it } from "vitest";
import { ohmYasasi } from "@/lib/calc/defs/temel-elektrik/ohm-yasasi";
import { seriParalel } from "@/lib/calc/defs/temel-elektrik/seri-paralel";
import { acGuc } from "@/lib/calc/defs/temel-elektrik/ac-guc";
import { defaultState } from "@/lib/calc/engine";
import type { CalcDefinition, InputState } from "@/lib/calc/types";
import { TaramaHatasi, enKotuSeviye, karsilastirmaOlustur, taramaYap, type Senaryo, type TaramaAyari } from "./index";

/** Ohm yasası senaryosu; verilmeyen alanlar tanımın varsayılanlarına (motor) bırakılır. */
function ohm(id: string, state: InputState): Senaryo {
  return { id, ad: id, state };
}

const vr = (V: string, Vu: string, R: string, Ru: string): InputState => ({
  mod: { value: "V-R" },
  V: { value: V, unit: Vu },
  R: { value: R, unit: Ru },
});

function satir(k: ReturnType<typeof karsilastirmaOlustur>, tur: "girdi" | "cikti", key: string) {
  const s = k.satirlar.find((r) => r.tur === tur && r.key === key);
  if (!s) throw new Error(`satır yok: ${tur}/${key}`);
  return s;
}

describe("karsilastirmaOlustur — ortak birim", () => {
  // S1: 10 V / 2 kΩ → I = 5 mA, P = 50 mW; S2: 12 V / 10 Ω → I = 1,2 A, P = 14,4 W
  const senaryolar = [ohm("S1", vr("10", "V", "2", "kohm")), ohm("S2", vr("12", "V", "10", "ohm"))];

  it("5 mA ve 1,2 A aynı satırda tek birimle (en büyük değere göre A) gösterilir", () => {
    const k = karsilastirmaOlustur(ohmYasasi, senaryolar);
    const I = satir(k, "cikti", "I");
    expect(I.birim).toBe("A");
    expect(I.birimSembolu).toBe("A");
    expect(I.degerler).toEqual(["0,005", "1,2"]);
    expect(I.sayisal[0]).toBeCloseTo(0.005, 12);
    expect(I.sayisal[1]).toBeCloseTo(1.2, 12);
    expect(I.farkli).toBe(true);

    const P = satir(k, "cikti", "P");
    expect(P.birim).toBe("W");
    expect(P.degerler).toEqual(["0,05", "14,4"]);

    // Çıktı R: 2000 Ω ve 10 Ω → en büyüğe göre kΩ
    const R = satir(k, "cikti", "R");
    expect(R.birim).toBe("kohm");
    expect(R.birimSembolu).toBe("kΩ");
    expect(R.degerler).toEqual(["2", "0,01"]);
  });

  it("satır sırası: görünen girdiler (tanım sırası), sonra çıktılar; aynı anahtar girdi ve çıktıda ayrı satır", () => {
    const k = karsilastirmaOlustur(ohmYasasi, senaryolar);
    expect(k.satirlar.map((s) => `${s.tur}:${s.key}`)).toEqual([
      "girdi:mod",
      "girdi:V",
      "girdi:R",
      "cikti:V",
      "cikti:I",
      "cikti:R",
      "cikti:P",
    ]);
    expect(k).toMatchObject({ hesapSlug: "ohm-yasasi", hesapId: "1.1", baslik: ohmYasasi.title });
  });

  it("farklı birimle girilmiş girdiler ilk senaryonun birimine çevrilir", () => {
    const k = karsilastirmaOlustur(ohmYasasi, senaryolar);
    const R = satir(k, "girdi", "R");
    expect(R.birim).toBe("kohm");
    expect(R.birimSembolu).toBe("kΩ");
    expect(R.degerler).toEqual(["2", "0,01"]);
    expect(R.sayisal).toEqual([2, 0.01]);

    // Ters sırada ortak birim Ω olur
    const ters = karsilastirmaOlustur(ohmYasasi, [senaryolar[1], senaryolar[0]]);
    expect(satir(ters, "girdi", "R").degerler).toEqual(["10", "2000"]);

    // Aynı değer farklı birimlerle yazılmışsa fark yoktur: 0,23 kV = 230 V
    const ayni = karsilastirmaOlustur(ohmYasasi, [ohm("a", vr("230", "V", "1", "ohm")), ohm("b", vr("0,23", "kV", "1", "ohm"))]);
    const V = satir(ayni, "girdi", "V");
    expect(V.degerler).toEqual(["230", "230"]);
    expect(V.farkli).toBe(false);
  });

  it("kullanıcının çıktı birimi seçimi (outputUnits) satırın birimini belirler", () => {
    const k = karsilastirmaOlustur(ohmYasasi, senaryolar, { outputUnits: { I: "mA" } });
    const I = satir(k, "cikti", "I");
    expect(I.birim).toBe("mA");
    expect(I.degerler).toEqual(["5", "1200"]);
    // İzinli olmayan birim yok sayılır
    expect(satir(karsilastirmaOlustur(ohmYasasi, senaryolar, { outputUnits: { I: "kW" } }), "cikti", "I").birim).toBe("A");
  });

  it("tercih edilen birim (preferredUnits) otomatik seçimden önce gelir; anlamlı basamak tercihi uygulanır", () => {
    const k = karsilastirmaOlustur(ohmYasasi, senaryolar, { preferredUnits: { guc: "kW" }, significant: 3 });
    const P = satir(k, "cikti", "P");
    expect(P.birim).toBe("kW");
    expect(P.degerler[1]).toBe("0,0144");
    // 10 V / 3 Ω = 3,3333… A → 3 anlamlı basamak
    const uc = karsilastirmaOlustur(ohmYasasi, [ohm("x", vr("10", "V", "3", "ohm"))], { significant: 3 });
    expect(satir(uc, "cikti", "I").degerler).toEqual(["3,33"]);
  });

  it("girdiler yüksek hassasiyetle biçimlenir: küçük farklar kaybolmaz", () => {
    const k = karsilastirmaOlustur(ohmYasasi, [ohm("a", vr("12", "V", "1,23456", "kohm")), ohm("b", vr("12", "V", "1,23457", "kohm"))]);
    const R = satir(k, "girdi", "R");
    expect(R.degerler).toEqual(["1,23456", "1,23457"]);
    expect(R.farkli).toBe(true);
  });

  it("aynı senaryolarda hiçbir satır farklı değildir; tek senaryoda farkli false", () => {
    const k = karsilastirmaOlustur(ohmYasasi, [senaryolar[0], { ...senaryolar[0], id: "kopya" }]);
    expect(k.satirlar.every((s) => !s.farkli)).toBe(true);
    expect(karsilastirmaOlustur(ohmYasasi, [senaryolar[0]]).satirlar.some((s) => s.farkli)).toBe(false);
  });

  it("senaryo yoksa satır da yoktur", () => {
    const k = karsilastirmaOlustur(ohmYasasi, []);
    expect(k.senaryolar).toEqual([]);
    expect(k.satirlar).toEqual([]);
  });
});

describe("karsilastirmaOlustur — select, liste, gizli girdi", () => {
  it("select girdileri seçenek etiketiyle; gizli girdi null ve farklı sayılır", () => {
    const k = karsilastirmaOlustur(ohmYasasi, [
      ohm("vr", vr("12", "V", "6", "ohm")),
      ohm("ir", { mod: { value: "I-R" }, I: { value: "2", unit: "A" }, R: { value: "6", unit: "ohm" } }),
    ]);
    const mod = satir(k, "girdi", "mod");
    expect(mod.degerler).toEqual(["Gerilim ve direnç biliniyor", "Akım ve direnç biliniyor"]);
    expect(mod.birim).toBe("");
    expect(mod.birimSembolu).toBe("");
    expect(mod.sayisal).toEqual([null, null]);
    expect(mod.farkli).toBe(true);

    // V yalnızca V-R'de, I yalnızca I-R'de görünür; P hiçbirinde görünmez
    expect(satir(k, "girdi", "V").degerler).toEqual(["12", null]);
    expect(satir(k, "girdi", "I").degerler).toEqual([null, "2"]);
    expect(satir(k, "girdi", "I").farkli).toBe(true);
    expect(k.satirlar.some((s) => s.tur === "girdi" && s.key === "P")).toBe(false);
    // İki devre de aynı: 12 V, 2 A, 6 Ω, 24 W
    expect(satir(k, "cikti", "V").farkli).toBe(false);
    expect(satir(k, "cikti", "P").degerler).toEqual(["24", "24"]);
  });

  it("numberList değerleri ortak birimde '100; 220; 470' biçiminde", () => {
    const seri = (R: string, unit: string): Senaryo => ({
      id: R,
      ad: R,
      state: { bilesen: { value: "direnc" }, baglanti: { value: "seri" }, R: { value: R, unit } },
    });
    const k = karsilastirmaOlustur(seriParalel, [seri("100; 220; 470", "ohm"), seri("0,1; 0,22; 1", "kohm")]);
    const R = satir(k, "girdi", "R");
    expect(R.birim).toBe("ohm");
    expect(R.degerler).toEqual(["100; 220; 470", "100; 220; 1000"]);
    expect(R.sayisal).toEqual([null, null]);
    expect(R.farkli).toBe(true);
    expect(satir(k, "girdi", "bilesen").degerler).toEqual(["Direnç (R)", "Direnç (R)"]);
    expect(satir(k, "girdi", "baglanti").degerler).toEqual(["Seri", "Seri"]);
    // Gizli liste girdileri (C, L) satır olmaz; hesaplanmayan çıktılar (Ceq, Leq) da
    expect(k.satirlar.map((s) => `${s.tur}:${s.key}`)).toEqual(["girdi:bilesen", "girdi:baglanti", "girdi:R", "cikti:Req"]);
    // Seri: 790 Ω ve 1320 Ω → tek birim kΩ
    const Req = satir(k, "cikti", "Req");
    expect(Req.birim).toBe("kohm");
    expect(Req.degerler).toEqual(["0,79", "1,32"]);
  });
});

describe("karsilastirmaOlustur — birimsiz satırlar", () => {
  it("sembolü '-' olan birimde birim ve birim sembolü boş (sözleşme)", () => {
    const s1 = defaultState(acGuc);
    const s2 = { ...s1, cosphi: { value: "0,9", unit: "unitless" } };
    const k = karsilastirmaOlustur(acGuc, [
      { id: "a", ad: "a", state: s1 },
      { id: "b", ad: "b", state: s2 },
    ]);
    const cos = satir(k, "girdi", "cosphi");
    expect(cos.birim).toBe("");
    expect(cos.birimSembolu).toBe("");
    expect(cos.degerler).toEqual(["0,8", "0,9"]);
    expect(cos.sayisal).toEqual([0.8, 0.9]);
    // Birimli satırlar birim kimliğini taşır
    expect(satir(k, "cikti", "P").birim).not.toBe("");
  });
});

describe("karsilastirmaOlustur — senaryo durumu", () => {
  it("başarılı senaryoda kontroller ve en kötü seviye", () => {
    const k = karsilastirmaOlustur(ohmYasasi, [
      ohm("vr", vr("12", "V", "6", "ohm")),
      // P-R modunda karekök notu "bilgi" seviyesinde: hüküm değil, en kötü seviye null
      ohm("pr", { mod: { value: "P-R" }, P: { value: "50", unit: "W" }, R: { value: "2", unit: "ohm" } }),
      // V-I, I = 0 → direnç tanımsız uyarısı, R çıktısı yok
      ohm("vi", { mod: { value: "V-I" }, V: { value: "12", unit: "V" }, I: { value: "0", unit: "A" } }),
    ]);
    expect(k.senaryolar.map((s) => s.durum.ok)).toEqual([true, true, true]);
    expect(k.senaryolar.map((s) => s.durum.enKotu)).toEqual([null, null, "uyari"]);
    expect(k.senaryolar[2].durum.kontroller[0].message).toMatch(/tanımsız/);
    expect(satir(k, "cikti", "R").degerler).toEqual(["6", "2", null]);
  });

  it("alan hatası olan senaryo: ok false, hata kontrolü, girdi metni ve boş çıktılar", () => {
    const k = karsilastirmaOlustur(ohmYasasi, [
      ohm("iyi", vr("12", "V", "6", "ohm")),
      ohm("bos", vr("12", "V", "", "ohm")),
      ohm("bozuk", vr("12", "V", "abc", "ohm")),
    ]);
    const [iyi, bos, bozuk] = k.senaryolar;
    expect(iyi.durum).toEqual({ ok: true, enKotu: null, kontroller: [] });
    expect(bos.durum.ok).toBe(false);
    expect(bos.durum.enKotu).toBe("hata");
    expect(bos.durum.kontroller).toEqual([{ level: "hata", message: "Direnç: Bu alan zorunludur" }]);
    expect(bozuk.durum.kontroller).toEqual([{ level: "hata", message: "Direnç: Geçerli bir sayı girin" }]);

    const R = satir(k, "girdi", "R");
    expect(R.degerler).toEqual(["6", null, "abc"]);
    expect(R.sayisal).toEqual([6, null, null]);
    expect(satir(k, "cikti", "I").degerler).toEqual(["2", null, null]);
  });

  it("validate hatası (zıt işaretli V ve I) kontrol olarak gelir", () => {
    const k = karsilastirmaOlustur(ohmYasasi, [
      ohm("zit", { mod: { value: "V-I" }, V: { value: "12", unit: "V" }, I: { value: "-2", unit: "A" } }),
    ]);
    expect(k.senaryolar[0].durum.ok).toBe(false);
    expect(k.senaryolar[0].durum.enKotu).toBe("hata");
    expect(k.senaryolar[0].durum.kontroller[0].message).toMatch(/zıt işaretli/);
    // Hiçbir senaryoda hesaplanmayan çıktılar satır olmaz
    expect(k.satirlar.every((s) => s.tur === "girdi")).toBe(true);
  });

  it("bozuk kayıtlı durum (bilinmeyen birim, eksik alan) fırlatmaz", () => {
    const k = karsilastirmaOlustur(ohmYasasi, [
      ohm("garip", { mod: { value: "V-R" }, V: { value: "12", unit: "uydurma" }, R: { value: "6" } }),
      ohm("yanlis-secim", { mod: { value: "yok-boyle-mod" } }),
    ]);
    expect(k.senaryolar[0].durum.ok).toBe(false);
    expect(satir(k, "girdi", "V").degerler[0]).toBe("12");
    // Birim yazılmamışsa tanımın varsayılanı (Ω) kullanılır
    expect(satir(k, "girdi", "R").degerler[0]).toBe("6");
    expect(satir(k, "girdi", "mod").degerler[1]).toBe("yok-boyle-mod");
  });
});

describe("enKotuSeviye", () => {
  it("hata > uyari > ok; boşta null", () => {
    expect(enKotuSeviye([])).toBeNull();
    expect(enKotuSeviye([{ level: "ok", message: "" }])).toBe("ok");
    expect(enKotuSeviye([{ level: "uyari", message: "" }, { level: "ok", message: "" }])).toBe("uyari");
    expect(enKotuSeviye([{ level: "ok", message: "" }, { level: "hata", message: "" }, { level: "uyari", message: "" }])).toBe("hata");
  });

  it("bilgi notları hüküm sayılmaz", () => {
    expect(enKotuSeviye([{ level: "bilgi", message: "" }])).toBeNull();
    expect(enKotuSeviye([{ level: "bilgi", message: "" }, { level: "ok", message: "" }])).toBe("ok");
    expect(enKotuSeviye([{ level: "uyari", message: "" }, { level: "bilgi", message: "" }])).toBe("uyari");
  });
});

describe("taramaYap", () => {
  const temel = ohm("temel", vr("12", "V", "6", "ohm"));
  const ayar = (a: Partial<TaramaAyari>): TaramaAyari => ({
    girdiKey: "R",
    ciktiKey: "I",
    baslangic: 1,
    bitis: 10,
    birim: "ohm",
    noktaSayisi: 10,
    ...a,
  });

  it("eşit adımlı noktalar; I = 12 V / R", () => {
    const s = taramaYap(ohmYasasi, temel, ayar({}));
    expect(s.noktalar).toHaveLength(10);
    expect(s.noktalar.map((p) => p.x)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(s.noktalar[0].y).toBeCloseTo(12, 12);
    expect(s.noktalar[3].y).toBeCloseTo(3, 12);
    expect(s.noktalar[9].y).toBeCloseTo(1.2, 12);
    expect(s.noktalar.every((p) => p.seviye === null)).toBe(true);
    expect(s).toMatchObject({
      girdiKey: "R",
      ciktiKey: "I",
      xEtiket: "Direnç",
      yEtiket: "Akım",
      xBirim: "ohm",
      xBirimSembolu: "Ω",
      yBirim: "A",
      yBirimSembolu: "A",
    });
  });

  it("y birimi tüm noktaların en büyüğüne göre tektir (12 mA → mA); outputUnits önce gelir", () => {
    const s = taramaYap(ohmYasasi, temel, ayar({ baslangic: 1, bitis: 10, birim: "kohm" }));
    expect(s.yBirim).toBe("mA");
    expect(s.noktalar[0].y).toBeCloseTo(12, 9);
    expect(s.noktalar[9].y).toBeCloseTo(1.2, 9);
    expect(s.xBirimSembolu).toBe("kΩ");

    const a = taramaYap(ohmYasasi, temel, ayar({ birim: "kohm" }), { outputUnits: { I: "A" } });
    expect(a.yBirim).toBe("A");
    expect(a.noktalar[0].y).toBeCloseTo(0.012, 12);
  });

  it("2 nokta uçları verir; ara noktalar kayan nokta artığı taşımaz; son nokta tam bitiş", () => {
    expect(taramaYap(ohmYasasi, temel, ayar({ noktaSayisi: 2 })).noktalar.map((p) => p.x)).toEqual([1, 10]);
    const ince = taramaYap(ohmYasasi, temel, ayar({ baslangic: 0.1, bitis: 1.1, noktaSayisi: 11 }));
    expect(ince.noktalar.map((p) => p.x)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1]);
    const uc = taramaYap(ohmYasasi, temel, ayar({ baslangic: 0, bitis: 1, noktaSayisi: 4 }));
    expect(uc.noktalar[3].x).toBe(1);
    expect(uc.noktalar[1].x).toBeCloseTo(1 / 3, 10);
    expect(taramaYap(ohmYasasi, temel, ayar({ noktaSayisi: 200 })).noktalar).toHaveLength(200);
  });

  it("azalan aralık da taranır", () => {
    const s = taramaYap(ohmYasasi, temel, ayar({ baslangic: 10, bitis: 2, noktaSayisi: 5 }));
    expect(s.noktalar.map((p) => p.x)).toEqual([10, 8, 6, 4, 2]);
    expect(s.noktalar[4].y).toBeCloseTo(6, 12);
  });

  it("hesaplanamayan nokta y = null ve seviye hata (R = 0 sınır dışı)", () => {
    const s = taramaYap(ohmYasasi, temel, ayar({ baslangic: 0, bitis: 10, noktaSayisi: 11 }));
    expect(s.noktalar[0]).toEqual({ x: 0, y: null, seviye: "hata" });
    expect(s.noktalar[1].y).toBeCloseTo(12, 12);
  });

  it("kontrol seviyeleri: validate hatası, çıktısı atlanan uyarı, sorunsuz nokta", () => {
    // V-I, V = 12 V; I = −1 A (zıt işaret, hata), 0 A (R tanımsız, uyarı), 1 A (R = 12 Ω)
    const vi = ohm("vi", { mod: { value: "V-I" }, V: { value: "12", unit: "V" }, I: { value: "2", unit: "A" } });
    const s = taramaYap(ohmYasasi, vi, { girdiKey: "I", ciktiKey: "R", baslangic: -1, bitis: 1, birim: "A", noktaSayisi: 3 });
    expect(s.noktalar).toEqual([
      { x: -1, y: null, seviye: "hata" },
      { x: 0, y: null, seviye: "uyari" },
      { x: 1, y: 12, seviye: null },
    ]);
    // P-R: her noktada yalnızca karekök notu ("bilgi") var; hüküm olmadığından seviye null
    const pr = ohm("pr", { mod: { value: "P-R" }, P: { value: "50", unit: "W" }, R: { value: "2", unit: "ohm" } });
    const t = taramaYap(ohmYasasi, pr, { girdiKey: "R", ciktiKey: "V", baslangic: 2, bitis: 8, birim: "ohm", noktaSayisi: 2 });
    expect(t.noktalar.map((p) => p.seviye)).toEqual([null, null]);
    expect(t.noktalar[0].y).toBeCloseTo(10, 12); // √(50·2)
    expect(t.noktalar[1].y).toBeCloseTo(20, 12); // √(50·8)
  });

  it("temel durumu değiştirmez", () => {
    const kopya = structuredClone(temel.state);
    taramaYap(ohmYasasi, temel, ayar({}));
    expect(temel.state).toEqual(kopya);
  });

  it.each<[string, Partial<TaramaAyari>, RegExp]>([
    ["olmayan girdi", { girdiKey: "yok" }, /girdi bu hesapta yok/],
    ["select girdi", { girdiKey: "mod" }, /sayı girdisi değil/],
    ["olmayan çıktı", { ciktiKey: "yok" }, /çıktı bu hesapta yok/],
    ["gizli girdi", { girdiKey: "I", birim: "A" }, /kullanılmıyor/],
    ["geçersiz birim", { birim: "V" }, /birimi "Direnç" için geçerli değil/],
    ["1 nokta", { noktaSayisi: 1 }, /2 ile 200 arasında/],
    ["201 nokta", { noktaSayisi: 201 }, /2 ile 200 arasında/],
    ["kesirli nokta", { noktaSayisi: 2.5 }, /tam sayı/],
    ["NaN başlangıç", { baslangic: Number.NaN }, /geçerli sayılar/],
    ["sonsuz bitiş", { bitis: Number.POSITIVE_INFINITY }, /geçerli sayılar/],
    ["eşit uçlar", { baslangic: 5, bitis: 5 }, /farklı olmalıdır/],
  ])("geçersiz ayar: %s → anlaşılır hata", (_ad, degisiklik, mesaj) => {
    expect(() => taramaYap(ohmYasasi, temel, ayar(degisiklik))).toThrow(TaramaHatasi);
    expect(() => taramaYap(ohmYasasi, temel, ayar(degisiklik))).toThrow(mesaj);
  });

  it("liste girdisi taranamaz", () => {
    const seri: Senaryo = { id: "s", ad: "s", state: { bilesen: { value: "direnc" }, baglanti: { value: "seri" }, R: { value: "1; 2", unit: "ohm" } } };
    expect(() =>
      taramaYap(seriParalel as CalcDefinition, seri, { girdiKey: "R", ciktiKey: "Req", baslangic: 1, bitis: 2, birim: "ohm", noktaSayisi: 2 }),
    ).toThrow(/sayı girdisi değil/);
  });
});
