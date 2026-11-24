import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url);
const files = await readdir(dist);
assert.ok(files.includes("sw.js"), "production build must emit a root service worker");
assert.ok(files.includes("manifest.webmanifest"), "production build must include the PWA manifest");

const worker = await readFile(join(dist.pathname, "sw.js"), "utf8");
const match = worker.match(/const PRECACHE_URLS = (\[[^;]+\]);/);
assert.ok(match, "service worker must contain a generated precache manifest");
const urls = JSON.parse(match[1]);
const basePath = process.env.VITE_BASE_PATH || "/";
assert.ok(urls.includes(basePath), "precache must include the app root");
assert.ok(urls.includes("/index.html"), "precache must include the app document");
assert.ok(urls.some((url) => /\/assets\/.*\.js$/.test(url)), "precache must include the hashed JavaScript entry");
assert.ok(urls.some((url) => /\/assets\/.*\.css$/.test(url)), "precache must include the hashed stylesheet");
assert.ok(worker.includes('url.pathname.startsWith("/api/")'), "finance API paths must remain excluded from caching");
assert.ok(worker.includes('url.pathname.startsWith("/sanctum/")'), "session and CSRF paths must remain excluded from caching");

console.log("PWA production artifact checks passed.");
