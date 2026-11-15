/**
 * Karşılaştırma tablosu: satırlar girdiler ve çıktılar, sütunlar senaryolar (karsilastirmaOlustur çıktısı).
 * Senaryolar arasında farklı değerler vurgulanır (renk + "≠" işareti), uyarı/hata olan senaryo sütun başlığında
 * ikon + metinle işaretlenir. Dar ekranda tablo kendi içinde yatay kaydırılır. Hook kullanmaz; senaryo paneli ve
 * /karsilastir sayfası (istemci bileşenleri) aynı görünümü kullanır.
 */
import type { Check, CheckLevel } from "@/lib/calc/types";
import type { Karsilastirma, KarsilastirmaSatiri, SenaryoDurumu } from "@/lib/karsilastirma/types";
import { cx } from "@/components/ui/cx";

/** Boş ad yerine sıra numarası */
export function senaryoAdi(ad: string, i: number): string {
  return ad.trim() || `Senaryo ${i + 1}`;
}

type RozetTuru = CheckLevel | "hesaplanamadi";

const ROZET: Record<RozetTuru, { metin: string; sinif: string; ikon: string }> = {
  ok: { metin: "Uygun", sinif: "border-ok-line bg-ok-bg text-ok", ikon: "M5 12.5l4.5 4.5L19 7.5" },
  // enKotuSeviye "bilgi"yi hüküm saymaz; tür bütünlüğü için.
  bilgi: { metin: "Bilgi", sinif: "border-line bg-surface-muted text-accent", ikon: "M12 11v6M12 7.2v.3" },
  uyari: { metin: "Uyarı", sinif: "border-uyari-line bg-uyari-bg text-uyari", ikon: "M12 7.5v6M12 17.2v.3" },
  hata: { metin: "Hata", sinif: "border-hata-line bg-hata-bg text-hata", ikon: "M7 7l10 10M17 7L7 17" },
  hesaplanamadi: { metin: "Hesaplanamadı", sinif: "border-hata-line bg-hata-bg text-hata", ikon: "M7 7l10 10M17 7L7 17" },
};

function rozetTuru(durum: SenaryoDurumu): RozetTuru | null {
  if (!durum.ok) return "hesaplanamadi";
  return durum.enKotu;
}

/** Senaryonun durumu: ikon + metin (renk tek başına anlam taşımaz). Kontrol yoksa hiçbir şey göstermez. */
export function SenaryoDurumRozeti({ durum, className }: { durum: SenaryoDurumu; className?: string }) {
  const tur = rozetTuru(durum);
  if (!tur) return null;
  const r = ROZET[tur];
  return (
    <span
      data-durum={tur}
      className={cx(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs leading-none font-medium whitespace-nowrap",
        r.sinif,
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d={r.ikon} />
      </svg>
      {r.metin}
    </span>
  );
}

function Hucre({ deger }: { deger: string | null }) {
  if (deger === null) {
    return (
      <>
        <span aria-hidden="true" className="text-muted">
          —
        </span>
        <span className="sr-only">yok</span>
      </>
    );
  }
  return <>{deger}</>;
}

function Satir({ satir, sutunSayisi }: { satir: KarsilastirmaSatiri; sutunSayisi: number }) {
  const vurgu = satir.farkli && sutunSayisi > 1;
  return (
    <tr data-satir={`${satir.tur}:${satir.key}`} data-farkli={vurgu ? "true" : undefined} className="border-t border-line">
      <th
        scope="row"
        className={cx(
          "sticky left-0 z-[1] max-w-[14rem] px-3 py-2 text-left align-top font-normal",
          vurgu ? "bg-accent-soft" : "bg-surface",
        )}
      >
        <span className="flex items-baseline gap-1.5">
          <span>
            {satir.label}
            {satir.birimSembolu && <span className="text-muted"> ({satir.birimSembolu})</span>}
          </span>
          {vurgu && (
            <span className="ml-auto shrink-0 font-semibold text-accent" title="Senaryolar arasında farklı">
              <span aria-hidden="true">≠</span>
              <span className="sr-only">, senaryolar arasında farklı</span>
            </span>
          )}
        </span>
      </th>
      {satir.degerler.map((deger, i) => (
        <td
          key={i}
          className={cx(
            "px-3 py-2 text-right align-top whitespace-nowrap tabular-nums",
            vurgu && "bg-accent-soft font-medium",
          )}
        >
          <Hucre deger={deger} />
        </td>
      ))}
    </tr>
  );
}

function GrupBasligi({ metin, sutunSayisi }: { metin: string; sutunSayisi: number }) {
  return (
    <tr className="border-t border-line bg-surface-muted">
      <th scope="rowgroup" colSpan={sutunSayisi + 1} className="px-3 py-1.5 text-left text-xs font-semibold tracking-wide text-muted">
        <span className="sticky left-3">{metin}</span>
      </th>
    </tr>
  );
}

export function KarsilastirmaTablosu({ karsilastirma, baslikId }: { karsilastirma: Karsilastirma; baslikId?: string }) {
  const { senaryolar, satirlar } = karsilastirma;
  const girdiler = satirlar.filter((s) => s.tur === "girdi");
  const ciktilar = satirlar.filter((s) => s.tur === "cikti");
  const n = senaryolar.length;
  const farkliSayisi = n > 1 ? satirlar.filter((s) => s.farkli).length : 0;

  return (
    <div className="space-y-2">
      <div
        role="region"
        aria-labelledby={baslikId}
        aria-label={baslikId ? undefined : "Karşılaştırma tablosu"}
        tabIndex={0}
        // relative: hücrelerdeki sr-only (absolute) metinler kaydırma kabına bağlı kalsın; yoksa sayfayı yatay taşırırlar.
        className="relative overflow-x-auto rounded-md border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">
            Satırlar girdiler ve çıktılar, sütunlar senaryolar. Senaryolar arasında farklı olan satırlar işaretlidir.
          </caption>
          <thead>
            <tr className="bg-surface-muted">
              <th scope="col" className="sticky left-0 z-[1] bg-surface-muted px-3 py-2 text-left font-medium text-muted">
                Büyüklük
              </th>
              {senaryolar.map((s, i) => (
                <th
                  key={s.id}
                  scope="col"
                  data-senaryo={s.id}
                  data-durum={rozetTuru(s.durum) ?? undefined}
                  className="px-3 py-2 text-right align-bottom font-semibold"
                >
                  <span className="ml-auto block max-w-[12rem] truncate" title={senaryoAdi(s.ad, i)}>
                    {senaryoAdi(s.ad, i)}
                  </span>
                  <SenaryoDurumRozeti durum={s.durum} className="mt-1" />
                </th>
              ))}
            </tr>
          </thead>
          {girdiler.length > 0 && (
            <tbody>
              <GrupBasligi metin="Girdiler" sutunSayisi={n} />
              {girdiler.map((s) => (
                <Satir key={`girdi:${s.key}`} satir={s} sutunSayisi={n} />
              ))}
            </tbody>
          )}
          <tbody>
            <GrupBasligi metin="Çıktılar" sutunSayisi={n} />
            {ciktilar.map((s) => (
              <Satir key={`cikti:${s.key}`} satir={s} sutunSayisi={n} />
            ))}
            {ciktilar.length === 0 && (
              <tr className="border-t border-line">
                <td colSpan={n + 1} className="px-3 py-2 text-muted">
                  Hiçbir senaryoda hesaplanan çıktı yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {n > 1 && (
        <p className="text-xs text-muted">
          {farkliSayisi > 0 ? (
            <>
              <span aria-hidden="true" className="font-semibold text-accent">
                ≠
              </span>{" "}
              Vurgulu {farkliSayisi} satır senaryolar arasında farklı.
            </>
          ) : (
            "Tüm senaryolar aynı değerleri veriyor."
          )}
        </p>
      )}
      <KontrolOzeti karsilastirma={karsilastirma} />
    </div>
  );
}

/** Uyarı ve hata mesajları senaryo adıyla (ör. "Senaryo 2 — Uyarı: …"). */
function KontrolOzeti({ karsilastirma }: { karsilastirma: Karsilastirma }) {
  const maddeler: { anahtar: string; ad: string; kontrol: Check }[] = [];
  for (const [i, s] of karsilastirma.senaryolar.entries()) {
    for (const [j, kontrol] of s.durum.kontroller.entries()) {
      if (kontrol.level !== "uyari" && kontrol.level !== "hata") continue;
      maddeler.push({ anahtar: `${s.id}-${j}`, ad: senaryoAdi(s.ad, i), kontrol });
    }
  }
  if (maddeler.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold">Uyarılar ve hatalar</h4>
      <ul className="mt-1.5 space-y-1 text-sm">
        {maddeler.map(({ anahtar, ad, kontrol }) => (
          <li key={anahtar} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-medium">{ad}</span>
            <SenaryoDurumRozeti durum={{ ok: true, enKotu: kontrol.level, kontroller: [kontrol] }} />
            <span className="min-w-0">{kontrol.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
