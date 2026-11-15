import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Bileşen testleri dosya başında `// @vitest-environment jsdom` ile jsdom'a geçer.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
