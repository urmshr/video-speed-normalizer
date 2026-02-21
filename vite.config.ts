import { defineConfig } from "vite";
import { crx, defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

const manifest = defineManifest({
  manifest_version: 3,
  name: "__MSG_extName__",
  version: pkg.version,
  description: "__MSG_extDescription__",
  default_locale: "en",
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
