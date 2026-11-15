/**
 * Senaryo paneli her hesap sayfasında (özel arayüzlü olanlar dahil) çalışır: kayıtlı her hesap tanımı
 * karşılaştırma, tarama ve grafikten fırlatmadan, NaN üretmeden geçmelidir.
 */
import { describe, expect, it } from "vitest";
import { defaultState, numberToInputText, runCalc, visibleInputs } from "@/lib/calc/engine";
import { allCalcs } from "@/lib/calc/registry";
import type { InputState } from "@/lib/calc/types";
import { getUnit, parseNumber } from "@/lib/units";
import { cizgiGrafikSvg } from "./grafik";
import { karsilastirmaOlustur, taramaYap } from "./index";

const hesaplar = allCalcs();

describe.each(hesaplar.map((def) => [def.id, def] as const))("%s", (_id, def) => {
  const s1 = defaultState(def);
  const girdi = visibleInputs(def, s1).find((i) => i.kind === "number");
  const v = girdi ? parseNumber(s1[girdi.key]?.value ?? "") : null;
  const s2: InputState = girdi ? { ...s1, [girdi.key]: { ...s1[girdi.key], value: numberToInputText(v ? v * 2 : 1) } } : s1;

  it("karsilastirmaOlustur: varsayılan ve değiştirilmiş senaryo", () => {
    const k = karsilastirmaOlustur(def, [
      { id: "a", ad: "A", state: s1 },
      { id: "b", ad: "B", state: s2 },
    ]);
    expect(JSON.stringify(k)).not.toMatch(/NaN|Infinity/);
    expect(k.senaryolar[0].durum.ok).toBe(true);
    expect(k.satirlar.some((s) => s.tur === "cikti")).toBe(true);
    for (const s of k.satirlar) {
      expect(s.degerler).toHaveLength(2);
      if (s.birim !== "") expect(getUnit(s.birim).symbol).not.toBe("-");
      // Satır başına tek birim: sayısal değer biçimlenmiş metinle tutarlı
      for (const [i, n] of s.sayisal.entries()) if (n !== null) expect(s.degerler[i]).not.toBeNull();
    }
  });

  it("taramaYap + cizgiGrafikSvg: ilk sayı girdisi, ilk hesaplanan çıktı", () => {
    if (!girdi || girdi.kind !== "number") return;
    const run = runCalc(def, s1);
    if (!run.ok) throw new Error("varsayılan durum hesaplanamadı");
    const cikti = def.outputs.find((o) => o.key !== girdi.key && o.key in run.result.outputs);
    if (!cikti) return;
    const [baslangic, bitis] = !v ? [0, 1] : v > 0 ? [v / 2, v * 2] : [v * 2, v / 2];
    const seri = taramaYap(def, { id: "a", ad: "A", state: s1 }, {
      girdiKey: girdi.key,
      ciktiKey: cikti.key,
      baslangic,
      bitis,
      birim: s1[girdi.key]?.unit ?? girdi.defaultUnit,
      noktaSayisi: 7,
    });
    expect(seri.noktalar).toHaveLength(7);
    expect(seri.noktalar.some((p) => p.y !== null)).toBe(true);
    for (const genislik of [640, 320]) {
      const svg = cizgiGrafikSvg(seri, { genislik });
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(svg.startsWith("<svg ")).toBe(true);
    }
  });
});
