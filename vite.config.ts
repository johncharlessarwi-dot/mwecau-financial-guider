import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function offlinePrecachePlugin(): Plugin {
  let precacheAssets: string[] = [];

  return {
    name: "mwecau-guider-offline-precache",
    apply: "build",
    generateBundle(_options, bundle) {
      precacheAssets = Object.keys(bundle)
        .filter((file) => /\.(?:js|css|woff2?|svg|png|webp|ico)$/.test(file))
        .map((file) => `/${file}`);
      precacheAssets.push("/", "/index.html", "/manifest.webmanifest", "/icons/guider-icon.svg");
      precacheAssets = [...new Set(precacheAssets)].sort();
    },
    closeBundle() {
      const cacheVersion = precacheAssets.join("|").split("").reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261).toString(36);
      const worker = `const CACHE_NAME = "mwecau-guider-shell-${cacheVersion}";
const PRECACHE_ASSETS = ${JSON.stringify(precacheAssets)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting()));
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

  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
`;
      writeFileSync(resolve("dist/sw.js"), worker, "utf8");
    },
  };
}

export default defineConfig({
  plugins: [react(), offlinePrecachePlugin()],
});
