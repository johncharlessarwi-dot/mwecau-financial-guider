import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const workerPath = join(dist, "sw.js");
assert.ok(existsSync(workerPath), "Production build must emit dist/sw.js");

const worker = readFileSync(workerPath, "utf8");
const match = worker.match(/const PRECACHE_ASSETS = (\\[[^;]+\\]);/);
assert.ok(match, "Service worker must contain a generated precache asset list");

const assets = JSON.parse(match[1]);
assert.ok(assets.includes("/index.html"), "Offline navigation fallback must be precached");
assert.ok(assets.includes("/manifest.webmanifest"), "PWA manifest must be precached");
assert.ok(assets.includes("/icons/guider-icon.svg"), "App icon must be precached");
assert.ok(assets.some((asset) => asset.startsWith("/assets/") && asset.endsWith(".js")), "Hashed application JavaScript must be precached");
assert.ok(assets.some((asset) => asset.startsWith("/assets/") && asset.endsWith(".css")), "Hashed application CSS must be precached");
assert.ok(!assets.some((asset) => asset.startsWith("/api/") || asset.startsWith("/sanctum/")), "Authenticated API data must never be precached");
assert.match(worker, /request\\.mode === "navigate"/, "Offline navigation fallback must be installed");
assert.match(worker, /url\\.pathname\\.startsWith\\("\/api\/"\\)/, "Runtime API cache exclusion must be installed");
assert.match(worker, /url\\.pathname\\.startsWith\\("\/sanctum\/"\\)/, "Runtime session cache exclusion must be installed");

for (const asset of assets) {
  if (asset.startsWith("/assets/") || asset.startsWith("/icons/")) {
    assert.ok(existsSync(join(dist, asset.slice(1))), `Precached build asset is missing: ${asset}`);
  }
}

console.log(`PWA build verification passed: ${assets.length} app-shell assets precached; finance API/session endpoints excluded.`);
