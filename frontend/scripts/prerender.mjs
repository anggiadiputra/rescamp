/**
 * prerender.mjs — SSG untuk SEO beranda jual domain (dash.ekstensi.id).
 *
 * Alur:
 *   1. Build SSR (`vite build --config vite.ssr.config.ts`) → dist-server/entry-server.cjs
 *   2. Render LandingPage ke HTML statis (konten lengkap: hero, harga, fitur).
 *   3. Injeksi hasil render ke <div id="root"> di dist/index.html (hasil `vite build`).
 *
 * SEO Meta (title/description/OG) diambil dari endpoint publik `/settings/public`
 * saat build, lalu menimpa blok `SEO:META:START..END` di dist/index.html.
 * Jika API tidak bisa diakses saat build → TIDAK mengganti apa pun (meta statis
 * default di index.html tetap terpakai) dan build tetap sukses.
 *
 * Berjalan pada build frontend sebelum rsync ke production. Dipanggil dari `npm run build`.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const distIndex = join(root, "dist", "index.html");
const serverBundle = join(root, "dist-server", "entry-server.cjs");
const settingsApi = "https://api.ekstensi.id/api/settings/public";

// Stub browser-only API yang dipakai pada render server-side (Navbar/Settings).
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Ambil setting SEO dari API. Mengembalikan objek, atau null kalau gagal. */
async function fetchSeoSettings() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5s timeout, jangan hambat build
    const res = await fetch(`${settingsApi}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data && typeof json.data === "object" ? json.data : json;
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (err) {
    console.warn(`⚠  Api settings tidak dapat dijangkau (${err?.message || err}). Pakai meta statis default.`);
    return null;
  }
}

/** Bangun blok SEO meta (menggantikan blok SEO:META di index.html). */
function buildMetaBlock(s) {
  const title = s?.seo_title || s?.brand_name
    ? String(s.seo_title || `${s.brand_name} — Domain Registrar`)
    : "";

  const useDefaults = !s || !(s.seo_title || s.seo_description || s.seo_keywords);
  if (useDefaults) return null; // tidak ada data berguna → biarkan statis

  const desc = escapeHtml(s.seo_description || "");
  const keywords = escapeHtml(s.seo_keywords || "");
  const ogTitle = escapeHtml(title);
  const twitterTitle = escapeHtml(title);
  const ogDesc = escapeHtml(s.seo_description || "");
  const twitterDesc = escapeHtml(s.seo_description || "");

  return `    <!-- ===================== SEO:META:START ===================== -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${desc}" />
    <meta name="keywords" content="${keywords}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://dash.ekstensi.id/" />
    <meta name="theme-color" content="#000000" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(s.brand_name || "Ekstensi.id")}" />
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDesc}" />
    <meta property="og:url" content="https://dash.ekstensi.id/" />
    <meta property="og:locale" content="id_ID" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${twitterTitle}" />
    <meta name="twitter:description" content="${twitterDesc}" />

    <!-- Structured data: WebSite + SearchAction -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": ${JSON.stringify(String(s.brand_name || "Ekstensi.id"))},
      "url": "https://dash.ekstensi.id/",
      "description": ${JSON.stringify(String(s.seo_description || ""))},
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": "https://dash.ekstensi.id/domains/register?search={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    }
    </script>
    <!-- ===================== SEO:META:END ===================== -->`;
}

if (!existsSync(distIndex)) {
  console.error("✖ dist/index.html belum ada. Jalankan 'vite build' dulu (atau 'npm run build' biar terurut).");
  process.exit(1);
}

console.log("→ SSR build (vite.ssr.config.ts)…");
try {
  execSync(`${process.execPath} ${join(root, "node_modules", "vite", "bin", "vite.js")} build --config vite.ssr.config.ts --logLevel warn`, {
    cwd: root,
    stdio: "inherit",
  });
} catch (e) {
  console.error("✖ SSR build gagal:", e.message);
  process.exit(1);
}

let renderLandingHtml;
try {
  ({ renderLandingHtml } = await import(serverBundle));
} catch (e) {
  console.error("✖ Gagal memuat bundle SSR:", e.message);
  process.exit(1);
}

console.log("→ Merender konten landing ke HTML…");
const prerendered = renderLandingHtml();

let indexHtml = readFileSync(distIndex, "utf8");
if (!indexHtml.includes('<div id="root">')) throw new Error('dist/index.html tidak punya <div id="root">');

indexHtml = indexHtml.replace(
  '<div id="root">',
  () => `<div id="root">${prerendered}`,
);

// Timpa blok SEO meta dari Settings bila API tersedia
const settings = await fetchSeoSettings();
if (settings && !(settings?.seo_title == null && settings?.seo_description == null && settings?.seo_keywords == null)) {
  const newMeta = buildMetaBlock(settings);
  const startMarker = "<!-- ===================== SEO:META:START ===================== -->";
  const endMarker = "<!-- ===================== SEO:META:END ===================== -->";
  const startIdx = indexHtml.indexOf(startMarker);
  const endIdx = indexHtml.indexOf(endMarker);
  if (newMeta && startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    indexHtml = indexHtml.slice(0, startIdx) + newMeta + indexHtml.slice(endIdx + endMarker.length);
    console.log("✔ Meta SEO diambil dari Settings (API /settings/public) dan dimasukkan ke HTML.");
  } else {
    console.warn("⚠  Marker blok SEO tidak ditemukan — meta statis default dibiarkan.");
  }
} else {
  console.log("→ Meta SEO statis default dipakai (Settings tidak tersedia/tidak di-set saat build).");
}

writeFileSync(distIndex, indexHtml, "utf8");

const kb = (indexHtml.length / 1024).toFixed(1);
console.log(`✔ Beranda ter-prerender: ${prerendered.length} karakter konten diinjeksikan ke #root (HTML total ${kb} KB).`);
