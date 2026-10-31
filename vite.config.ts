import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function offlineServiceWorker(): Plugin {
  return {
    name: "mwecau-offline-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((file) =>
        /\.(?:js|css|svg|woff2?)$/.test(file)
      );
      const precache = ["/", "/index.html", "/manifest.webmanifest", "/icons/guider-icon.svg", ...assets.map((file) => `/${file}`)];
      const version = assets.join("|").length.toString(36);
      const source = `const CACHE_NAME = "mwecau-guider-shell-${version}";
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
    event.respondWith(fetch(request).catch(async () => (await caches.match("/index.html")) || (await caches.match("/"))));
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname) || url.pathname.startsWith("/assets/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    }
  };
}

export default defineConfig({
  plugins: [react(), offlineServiceWorker()]
});
