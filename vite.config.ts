import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const basePath = (process.env.VITE_BASE_PATH || "/").replace(/\/?$/, "/");

function offlineServiceWorker(): Plugin {
  return {
    name: "mwecau-offline-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((file) =>
        /\.(?:js|css|svg|woff2?)$/.test(file)
      );
      const precache = [basePath, `${basePath}index.html`, `${basePath}manifest.webmanifest`, `${basePath}icons/guider-icon.svg`, ...assets.map((file) => `${basePath}${file}`)];
      const version = [...assets.sort().join("|")].reduce((hash, char) =>
        Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261).toString(36);
      const source = `const BASE_PATH = ${JSON.stringify(basePath)};\nconst CACHE_NAME = "mwecau-guider-shell-${version}";
const PRECACHE_URLS = ${JSON.stringify([...new Set(precache)])};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("mwecau-guider-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/sanctum/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(BASE_PATH + "index.html")) || (await caches.match(BASE_PATH))));
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname) || url.pathname.startsWith(BASE_PATH + "assets/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    }
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), offlineServiceWorker()]
});
