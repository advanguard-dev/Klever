import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/** SharedArrayBuffer / Moonshine WASM need cross-origin isolation. */
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@moonshine-ai/moonshine-wasm"],
    // Avoid esbuild "all goroutines are asleep" deadlocks on first crawl.
    holdUntilCrawlEnd: false,
  },
  assetsInclude: ["**/*.wasm"],
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
  },
  server: {
    host: "127.0.0.1",
    headers: isolationHeaders,
    // Don't block the HTML response on a full dep crawl (white page / hung TCP).
    preTransformRequests: false,
  },
  preview: {
    headers: isolationHeaders,
  },
});
