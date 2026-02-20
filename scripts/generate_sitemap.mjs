import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.sustainabilitysignals.com';
const ROOT = process.cwd();
const REPORTS_INDEX_PATH = path.join(ROOT, 'src', 'data', 'reportsIndex.json');
const OUTPUT_DIR = path.join(ROOT, 'public');
const SITEMAP_INDEX_PATH = path.join(OUTPUT_DIR, 'sitemap.xml');
const SITEMAP_PAGES_PATH = path.join(OUTPUT_DIR, 'sitemap-pages.xml');
const SITEMAP_REPORTS_PATH = path.join(OUTPUT_DIR, 'sitemap-reports.xml');

// Max URLs per sitemap file (Google limit is 50,000)
const MAX_URLS_PER_SITEMAP = 5000;

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildUrlNode({ loc, changefreq, priority, lastmod }) {
  const lines = [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
  ];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  lines.push('  </url>');
  return lines.join('\n');
}

function wrapUrlset(nodes) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...nodes,
    '</urlset>',
    '',
  ].join('\n');
}

function buildSitemapIndex(sitemapUrls, lastmod) {
  const entries = sitemapUrls.map(
    (url) =>
      `  <sitemap>\n    <loc>${xmlEscape(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</sitemapindex>',
    '',
  ].join('\n');
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const raw = await fs.readFile(REPORTS_INDEX_PATH, 'utf-8');
  const rows = JSON.parse(raw);

  // ── Static pages ──
  const staticRoutes = [
    { path: '/', changefreq: 'weekly', priority: 1.0 },
    { path: '/reports', changefreq: 'daily', priority: 0.9 },
    { path: '/methodology', changefreq: 'weekly', priority: 0.8 },
    { path: '/about', changefreq: 'monthly', priority: 0.7 },
    { path: '/disclosure', changefreq: 'monthly', priority: 0.6 },
    { path: '/privacy', changefreq: 'yearly', priority: 0.3 },
    { path: '/terms', changefreq: 'yearly', priority: 0.3 },
  ];

  const pageNodes = staticRoutes.map((r) =>
    buildUrlNode({
      loc: `${BASE_URL}${r.path}`,
      changefreq: r.changefreq,
      priority: r.priority,
      lastmod: today,
    })
  );

  // ── Report pages ──
  const slugCounts = new Map();
  const reportNodes = rows.map((r) => {
    const year = Number.isFinite(r.y) ? r.y : 0;
    const base = `${slugify(r.c)}-${year}`;
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count + 1}`;
    return buildUrlNode({
      loc: `${BASE_URL}/reports/${slug}`,
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: today,
    });
  });

  // Write separate sitemaps
  await fs.writeFile(SITEMAP_PAGES_PATH, wrapUrlset(pageNodes), 'utf-8');
  console.log(`  sitemap-pages.xml: ${pageNodes.length} URLs`);

  // Split reports into chunks if needed
  const reportChunks = [];
  for (let i = 0; i < reportNodes.length; i += MAX_URLS_PER_SITEMAP) {
    reportChunks.push(reportNodes.slice(i, i + MAX_URLS_PER_SITEMAP));
  }

  const sitemapUrls = [`${BASE_URL}/sitemap-pages.xml`];

  if (reportChunks.length === 1) {
    await fs.writeFile(SITEMAP_REPORTS_PATH, wrapUrlset(reportChunks[0]), 'utf-8');
    sitemapUrls.push(`${BASE_URL}/sitemap-reports.xml`);
    console.log(`  sitemap-reports.xml: ${reportChunks[0].length} URLs`);
  } else {
    for (let i = 0; i < reportChunks.length; i++) {
      const chunkPath = path.join(OUTPUT_DIR, `sitemap-reports-${i + 1}.xml`);
      await fs.writeFile(chunkPath, wrapUrlset(reportChunks[i]), 'utf-8');
      sitemapUrls.push(`${BASE_URL}/sitemap-reports-${i + 1}.xml`);
      console.log(`  sitemap-reports-${i + 1}.xml: ${reportChunks[i].length} URLs`);
    }
  }

  // Write sitemap index
  const indexXml = buildSitemapIndex(sitemapUrls, today);
  await fs.writeFile(SITEMAP_INDEX_PATH, indexXml, 'utf-8');

  const totalUrls = pageNodes.length + reportNodes.length;
  console.log(`Generated sitemap index with ${sitemapUrls.length} sitemaps, ${totalUrls} total URLs -> public/sitemap.xml`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
