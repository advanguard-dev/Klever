import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/** SharedArrayBuffer / Moonshine WASM need cross-origin isolation. */
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@moonshine-ai/moonshine-wasm"],
    // Don't hold the first page on a full Rolldown dep crawl (white screen / hung TCP).
    holdUntilCrawlEnd: false,
  },
  assetsInclude: ["**/*.wasm"],
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
    sourcemap: false,
    modulePreload: {
      polyfill: false,
    },
    // Avoid Rolldown napi warning-bridge deadlocks on large transforms (vite 8).
    rolldownOptions: {
      logLevel: "silent",
    },
  },
  server: {
    host: "127.0.0.1",
    headers: isolationHeaders,
    // Don't block the HTML response on a full dep crawl (white page / hung TCP).
    preTransformRequests: false,
    watch: {
      ignored: ["**/release/**", "**/dist/**", "**/web/**", "**/docs/**"],
    },
  },
  preview: {
    headers: isolationHeaders,
  },
});
