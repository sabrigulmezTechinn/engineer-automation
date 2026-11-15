import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // PDF raporları: MathJax dinamik yazı tipi modüllerini Node çözümlemesiyle yükler; pdfmake/pdfkit Node API'leri kullanır.
  serverExternalPackages: ["@mathjax/src", "@mathjax/mathjax-newcm-font", "pdfmake"],
  // Rapor yazı tipleri çalışma anında fs ile okunur; dağıtım çıktısına dahil edilsin.
  outputFileTracingIncludes: { "/api/rapor/**": ["./src/lib/rapor/fonts/**"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
