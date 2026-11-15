/**
 * Eşzamanlı istekler: tek MathJax belgesi paylaşılır ve \text{…} içindeki Türkçe harfler için yazı tipi
 * modülleri ilk kullanımda yüklenir. Ayrı dosya: MathJax modülü bu testte soğuk başlar. Bir formül
 * çizilemezse belgeler.ts LaTeX kaynağını düz metin yazar; bu yüzden PDF metninde "\" olmamalı.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { defaultState } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import { hesapRaporuPdf } from "./belgeler";
import { hesapRaporuOlustur } from "./model";

const SLUGLAR = [
  "seri-paralel", // R_{\text{eş}}
  "rs485-modbus", // T_{\text{çevrim}}
  "vfd-secimi-frenleme-direnci", // I_{\text{sürücü}}, k_{\text{aşırı}}
  "pt100-termokupl", // E_{\text{ölç}}
  "dongu-yuk-direnci", // R_{\text{yük}}
  "motor-verimi-enerji-tasarrufu",
];

it("aynı anda üretilen raporlarda tüm formüller SVG olarak çizilir (LaTeX kaynağına düşülmez)", async () => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "pipe" });
  } catch {
    throw new Error("pdftotext bulunamadı: PDF metin testleri için poppler-utils kurulu olmalı.");
  }
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "rapor-eszamanli-"));
  try {
    const pdfler = await Promise.all(
      SLUGLAR.map((slug) => {
        const def = getCalc(slug);
        if (!def) throw new Error(`hesap yok: ${slug}`);
        return hesapRaporuPdf({ baslik: def.title, tarih: "2026-11-15T12:00:00Z" }, hesapRaporuOlustur(def, defaultState(def)));
      }),
    );
    for (const [i, pdf] of pdfler.entries()) {
      const dosya = path.join(dizin, `${i}.pdf`);
      fs.writeFileSync(dosya, pdf);
      const metin = execFileSync("pdftotext", ["-enc", "UTF-8", dosya, "-"], { encoding: "utf8" });
      expect(metin, SLUGLAR[i]).not.toContain("\\");
      expect(metin).toContain("Ara adımlar");
    }
  } finally {
    fs.rmSync(dizin, { recursive: true, force: true });
  }
}, 60_000);
