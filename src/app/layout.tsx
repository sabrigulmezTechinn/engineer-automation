import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// KaTeX stili globals.css'ten önce gelir; böylece globals.css'teki KaTeX düzeltmeleri üstün gelir.
import "katex/dist/katex.min.css";
import "./globals.css";
import { SITE_NAME, SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

// latin-ext: Türkçe karakterler (ş, ğ, ı, İ, ç, ö, ü) için gerekli.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    template: `%s · ${SITE_NAME}`,
    default: SITE_NAME,
  },
  description:
    "Otomasyon, mekatronik ve elektrik-elektronik mühendisleri için Türkçe hesaplama araçları: formüller, ara adımlar ve standart referanslarıyla.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-fg">
        <a
          href="#icerik"
          className="sr-only rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          İçeriğe geç
        </a>
        <SiteHeader />
        <main id="icerik" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
