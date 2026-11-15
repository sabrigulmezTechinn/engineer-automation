import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { KayitKarsilastirma } from "@/components/karsilastirma/kayit-karsilastirma";
import { buttonClass } from "@/components/ui/button";
import { SENARYO_SINIRI } from "@/lib/karsilastirma";
import { requireSession } from "@/lib/session";
import { runSecenekleri } from "@/lib/tercihler";
import { kayitKarsilastirmasiHazirla, kayitKimlikleriniAyikla, type KarsilastirmaHazirligi } from "./_lib/hazirla";

export const metadata: Metadata = { title: "Kayıtlı hesapları karşılaştır" };

/**
 * Kayıtlı hesap karşılaştırma (KAPSAM §3.4): /karsilastir?kayitlar=<id>,<id>. Giriş gerektirir.
 * Oturum, arama parametreleri ve veritabanı isteğe özgü olduğu için içerik <Suspense> içinde okunur
 * (cacheComponents); başlık statik kabukta kalır.
 */
export default function KarsilastirPage({ searchParams }: PageProps<"/karsilastir">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Kayıtlı hesapları karşılaştır</h1>
        <p className="mt-2 leading-relaxed text-muted">
          Aynı hesabın kayıtlı varyantları yan yana gösterilir; senaryolar arasında farklı değerler vurgulanır, uyarı
          ya da hata veren kayıtlar işaretlenir.
        </p>
      </header>
      <div className="mt-8">
        <Suspense fallback={<Iskelet />}>
          <Icerik searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

function Iskelet() {
  return (
    <div aria-hidden="true" className="animate-pulse space-y-4">
      <div className="h-6 w-64 rounded bg-surface-muted" />
      <div className="h-64 rounded-lg border border-line bg-surface" />
    </div>
  );
}

function Bilgi({ baslik, children, uyari = false }: { baslik: string; children: ReactNode; uyari?: boolean }) {
  return (
    <div
      role={uyari ? "alert" : undefined}
      className="max-w-2xl rounded-lg border border-line bg-surface px-5 py-4 shadow-xs"
    >
      <h2 className="font-semibold">{baslik}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

const HESAPLAR_BAGLANTISI = (
  <Link href="/hesaplar" className={buttonClass("secondary")}>
    Hesaplar listesi
  </Link>
);

async function Icerik({ searchParams }: { searchParams: PageProps<"/karsilastir">["searchParams"] }) {
  const sp = await searchParams;
  const ayiklama = kayitKimlikleriniAyikla(sp.kayitlar);
  const donusYolu =
    ayiklama.durum === "tamam" ? `/karsilastir?kayitlar=${ayiklama.kimlikler.map(encodeURIComponent).join(",")}` : "/karsilastir";
  const { user } = await requireSession(donusYolu);

  if (ayiklama.durum === "bos") {
    return (
      <Bilgi baslik="Karşılaştırılacak kayıt seçilmedi">
        <p>
          Kayıtlı hesaplarınızdan aynı hesaba ait en az iki kaydı seçip karşılaştırın. Tek bir hesabın farklı girdilerini
          denemek için hesap sayfasındaki “Senaryo karşılaştırma” bölümünü de kullanabilirsiniz.
        </p>
        <p>{HESAPLAR_BAGLANTISI}</p>
      </Bilgi>
    );
  }
  if (ayiklama.durum === "fazla") {
    return (
      <Bilgi baslik="Çok fazla kayıt seçildi" uyari>
        <p>En çok {SENARYO_SINIRI} kayıt yan yana karşılaştırılabilir. Daha az kayıt seçip yeniden deneyin.</p>
      </Bilgi>
    );
  }

  let hazirlik: KarsilastirmaHazirligi;
  if (ayiklama.durum === "gecersiz") {
    hazirlik = { durum: "bulunamadi" };
  } else {
    try {
      hazirlik = await kayitKarsilastirmasiHazirla(user.id, ayiklama.kimlikler);
    } catch (error) {
      console.error("Karşılaştırma kayıtları okunamadı", error);
      return (
        <Bilgi baslik="Kayıtlar şu anda okunamadı" uyari>
          <p>Kayıtlı hesaplarınıza şu anda ulaşılamıyor. Biraz sonra yeniden deneyin.</p>
        </Bilgi>
      );
    }
  }

  if (hazirlik.durum === "bulunamadi") {
    return (
      <Bilgi baslik="Kayıt bulunamadı" uyari>
        <p>Seçilen kayıtlardan biri ya da birkaçı bulunamadı. Silinmiş olabilir ya da bu hesaba ait olmayabilir.</p>
        <p>{HESAPLAR_BAGLANTISI}</p>
      </Bilgi>
    );
  }
  if (hazirlik.durum === "farkliHesap") {
    return (
      <Bilgi baslik="Kayıtlar farklı hesaplara ait" uyari>
        <p>
          Seçilen kayıtlar farklı hesap türlerinden: {hazirlik.hesaplar.join(", ")}. Yalnızca aynı hesabın kayıtları yan
          yana karşılaştırılabilir.
        </p>
      </Bilgi>
    );
  }

  const tercihler = runSecenekleri({ anlamliBasamak: user.decimals, birimSistemi: user.unitSystem });
  return (
    <div className="space-y-4">
      {hazirlik.senaryolar.length === 1 && (
        <p className="rounded-md border border-line bg-surface-muted px-3.5 py-2.5 text-sm text-muted">
          Yalnızca bir kayıt seçildi. Karşılaştırmak için aynı hesaba ait başka kayıtlar da seçin.
        </p>
      )}
      <KayitKarsilastirma
        // Başka kayıt kümesine geçildiğinde tarama ayarları sıfırlansın.
        key={hazirlik.senaryolar.map((s) => s.id).join(",")}
        hesapSlug={hazirlik.hesapSlug}
        senaryolar={hazirlik.senaryolar}
        outputUnits={hazirlik.outputUnits}
        tercihler={tercihler}
      />
    </div>
  );
}
