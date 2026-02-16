import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.sustainabilitysignals.com';
const ROOT = process.cwd();
const REPORTS_INDEX_PATH = path.join(ROOT, 'src', 'data', 'reportsIndex.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'sitemap.xml');

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

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const raw = await fs.readFile(REPORTS_INDEX_PATH, 'utf-8');
  const rows = JSON.parse(raw);

  const staticRoutes = [
    { path: '/', changefreq: 'weekly', priority: 1.0 },
    { path: '/reports', changefreq: 'daily', priority: 0.9 },
    { path: '/methodology', changefreq: 'weekly', priority: 0.8 },
    { path: '/about', changefreq: 'monthly', priority: 0.7 },
    { path: '/disclosure', changefreq: 'monthly', priority: 0.6 },
    { path: '/privacy', changefreq: 'yearly', priority: 0.4 },
    { path: '/terms', changefreq: 'yearly', priority: 0.4 },
  ];

  const slugCounts = new Map();
  const reportRoutes = rows.map((r) => {
    const year = Number.isFinite(r.y) ? r.y : 0;
    const base = `${slugify(r.c)}-${year}`;
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count + 1}`;
    return {
      path: `/reports/${slug}`,
      changefreq: 'monthly',
      priority: 0.7,
    };
  });

  const nodes = [
    ...staticRoutes.map((r) =>
      buildUrlNode({
        loc: `${BASE_URL}${r.path}`,
        changefreq: r.changefreq,
        priority: r.priority,
        lastmod: today,
      })
    ),
    ...reportRoutes.map((r) =>
      buildUrlNode({
        loc: `${BASE_URL}${r.path}`,
        changefreq: r.changefreq,
        priority: r.priority,
        lastmod: today,
      })
    ),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...nodes,
    '</urlset>',
    '',
  ].join('\n');

  await fs.writeFile(OUTPUT_PATH, xml, 'utf-8');
  console.log(`Generated sitemap with ${nodes.length} URLs -> ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
