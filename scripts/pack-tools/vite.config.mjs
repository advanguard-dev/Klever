import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Isolated Vite 7 / Rollup production build. Do not import the app's Vite 8 config. */
export default defineConfig({
  root: repo,
  base: "./",
  publicDir: path.join(repo, "public"),
  envDir: repo,
  cacheDir: path.join(repo, "node_modules/.vite-pack"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.join(repo, "src"),
    },
  },
  optimizeDeps: {
    exclude: ["@moonshine-ai/moonshine-wasm"],
  },
  assetsInclude: ["**/*.wasm"],
  worker: {
    format: "es",
  },
  build: {
    outDir: path.join(repo, "dist"),
    emptyOutDir: true,
    target: "esnext",
    sourcemap: false,
    modulePreload: {
      polyfill: false,
    },
  },
});
