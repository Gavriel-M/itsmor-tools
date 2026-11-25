import { fileURLToPath } from "node:url";
import { PALETTE } from "@itsmor/tokens";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

function themeColor(): Plugin {
  return {
    name: "itsmor-theme-color",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { name: "theme-color", content: PALETTE.background },
        injectTo: "head",
      },
    ],
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), themeColor()],
  assetsInclude: ["**/*.heic"],
  optimizeDeps: {
    include: ["comlink", "exifr"],
    exclude: ["@jsquash/jpeg"],
  },
  worker: { format: "es" },
  build: {
    rolldownOptions: {
      input: {
        index: entry("./index.html"),
        convert: entry("./convert/index.html"),
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.{ts,mjs}"],
          exclude: ["tests/browser/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }, { browser: "webkit" }],
          },
        },
      },
    ],
  },
});
