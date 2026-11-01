import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const read = (path) => readFile(new URL(path, dist), "utf8");
const [html, robots, sitemap, manifestText, sw, headers] = await Promise.all([
  read("index.html"), read("robots.txt"), read("sitemap.xml"),
  read("manifest.webmanifest"), read("sw.js"), read("_headers")
]);
const expected = "https://mwecau-financial-guider.johncharlessarwi.workers.dev/";

assert.ok(html.includes(`rel="canonical" href="${expected}"`), "Canonical URL must target Cloudflare Pages");
assert.ok(html.includes(`property="og:url" content="${expected}"`), "Open Graph URL must match canonical");
assert.ok(html.includes('name="google-site-verification"'), "Keep Search Console verification tag");
assert.ok(!html.includes("github.io"), "Old GitHub Pages URL must not be indexed");
assert.ok(html.includes('href="/manifest.webmanifest"'), "Manifest must load from Cloudflare site root");
assert.ok(html.includes('href="/icons/guider-icon.svg"'), "Favicon must load from Cloudflare site root");

assert.ok(robots.includes("Allow: /"), "Root must be allowed for public discovery");
assert.ok(robots.includes(`Sitemap: ${expected}sitemap.xml`), "robots.txt must point to the Cloudflare sitemap");
assert.ok(sitemap.includes(`<loc>${expected}</loc>`), "Sitemap must include the Cloudflare canonical");
assert.ok(!sitemap.includes("github.io"), "Sitemap must not reference GitHub Pages");

const manifest = JSON.parse(manifestText);
assert.equal(manifest.start_url, "/", "PWA must start at the Cloudflare Pages root");
assert.equal(manifest.scope, "/", "PWA scope must remain on the same origin");
assert.ok(manifest.icons.every((icon) => icon.src.startsWith("/")), "PWA icons must be root-relative");
assert.ok(sw.includes('const BASE_PATH = "/"'), "Offline cache must be root scoped");
assert.ok(headers.includes("X-Content-Type-Options: nosniff"), "Missing basic security headers");
console.log("Cloudflare Pages output, SEO, indexing and PWA checks passed.");
