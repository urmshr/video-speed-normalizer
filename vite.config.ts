import { defineConfig } from "vite";
import { crx, defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

const manifest = defineManifest({
  manifest_version: 3,
  name: "Video Speed Normalizer",
  version: pkg.version,
  description:
    "YouTube で設定した条件に当てはまる動画を再生したときに再生速度を自動で 1.0 倍 に戻す拡張機能",
  action: {
    default_popup: "src/popup.html",
  },
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  content_scripts: [
    {
      matches: ["https://www.youtube.com/*"],
      js: ["src/content.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage"],
});

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
