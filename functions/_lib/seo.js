// ─── Edge SEO meta injection ────────────────────────────────────────────────
// Injects route-specific <title>, <meta>, OG tags, and JSON-LD into the static
// SPA shell so that crawlers / social-media link-preview bots see the correct
// metadata without executing client-side JavaScript.
//
// Usage: call `rewriteHtmlSeo(response, pathname)` on any HTML response before
// returning it from the middleware.

const BASE_URL = 'https://www.sustainabilitysignals.com';
const SITE_NAME = 'Sustainability Signals';
const OG_IMAGE = `${BASE_URL}/og-image.png`;
const OG_IMAGE_ALT = 'Sustainability Signals — Evidence-Grounded ESG Ratings';

// ── Route → meta map ───────────────────────────────────────────────────────
const STATIC_ROUTES = {
  '/': {
    title: 'Sustainability Signals | Evidence-Grounded ESG Ratings',
    description:
      'Sustainability Signals builds transparent, auditable ESG ratings. Start with Disclosure Quality scoring, evidence-grounded chat, and entity extraction across 900+ CSRD-aligned sustainability disclosures.',
    keywords:
      'sustainability signals, ESG ratings, disclosure quality, sustainability reports, CSRD, ESG entity extraction, evidence-grounded ESG',
  },
  '/about': {
    title: 'About Sustainability Signals | Disclosure Quality and ESG Ratings Roadmap',
    description:
      'Learn how Sustainability Signals turns disclosures into evidence-grounded scores and entities, and how the platform is evolving toward transparent ESG ratings.',
    keywords:
      'about sustainability signals, esg methodology, disclosure quality scoring, ESG platform, sustainability data',
  },
  '/methodology': {
    title: 'Methodology | How Disclosure Quality Scoring Works — Sustainability Signals',
    description:
      'See the end-to-end methodology: report ingestion, FinBERT ESG routing, entity extraction, and weighted Disclosure Quality scoring with evidence highlights across sustainability disclosures.',
    keywords:
      'disclosure quality methodology, ESG scoring model, FinBERT ESG, entity extraction, sustainability scoring methodology',
  },
  '/reports': {
    title: 'Sustainability Reports Database & Disclosure Quality Scores | Sustainability Signals',
    description:
      'Explore the Sustainability Signals coverage universe — browse sustainability reports, run Disclosure Quality scoring, review evidence highlights, and extract ESG entities across 900+ CSRD-aligned disclosures.',
    keywords:
      'sustainability reports database, disclosure quality score, ESG evidence extraction, CSRD reports',
  },
  '/disclosure': {
    title: 'Disclosure | Sustainability Signals',
    description:
      'Student project disclosure for Sustainability Signals: transparency about the platform\'s nature, limitations, and intended use.',
    keywords: '',
  },
  '/privacy': {
    title: 'Privacy Policy | Sustainability Signals',
    description: 'Privacy policy for Sustainability Signals — how we handle data and protect your privacy.',
    keywords: '',
  },
  '/terms': {
    title: 'Terms of Service | Sustainability Signals',
    description: 'Terms of service for using the Sustainability Signals platform.',
    keywords: '',
  },
};

/**
 * Try to build meta for a dynamic /reports/:slug route.
 * Returns null if the path doesn't match the pattern.
 */
function buildReportMeta(pathname) {
  const match = pathname.match(/^\/reports\/(.+)$/);
  if (!match) return null;
  const slug = match[1];

  // Attempt to extract company name and year from slug pattern: "company-name-YYYY"
  const yearMatch = slug.match(/-(\d{4})(?:-\d+)?$/);
  const year = yearMatch ? yearMatch[1] : '';
  const companySlug = yearMatch ? slug.slice(0, yearMatch.index) : slug;
  const company = companySlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const title = year
    ? `${company} ${year} Disclosure Quality & Evidence | ${SITE_NAME}`
    : `${company} Disclosure Quality & Evidence | ${SITE_NAME}`;

  const description = year
    ? `Review ${company}'s ${year} sustainability disclosure with Disclosure Quality scoring, evidence highlights, and ESG entity extraction on Sustainability Signals.`
    : `Review ${company}'s sustainability disclosure with Disclosure Quality scoring, evidence highlights, and ESG entity extraction on Sustainability Signals.`;

  return { title, description, keywords: `${company}, sustainability report, disclosure quality, ESG analysis` };
}

/**
 * Resolve meta tags for a given pathname.
 * Falls back to the homepage meta if the path is unknown.
 */
function resolveMeta(pathname) {
  // Strip trailing slash for matching (except root)
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

  if (STATIC_ROUTES[normalizedPath]) {
    return STATIC_ROUTES[normalizedPath];
  }

  const reportMeta = buildReportMeta(normalizedPath);
  if (reportMeta) return reportMeta;

  // Fallback to homepage meta
  return STATIC_ROUTES['/'];
}

// ── HTMLRewriter handlers ──────────────────────────────────────────────────

class MetaRewriter {
  constructor(meta, canonicalUrl) {
    this.meta = meta;
    this.canonicalUrl = canonicalUrl;
    this.injected = false;
  }

  element(element) {
    const name = element.getAttribute('name');
    const property = element.getAttribute('property');
    const rel = element.getAttribute('rel');

    // Rewrite existing tags
    if (name === 'description') {
      element.setAttribute('content', this.meta.description);
    } else if (name === 'keywords' && this.meta.keywords) {
      element.setAttribute('content', this.meta.keywords);
    } else if (name === 'twitter:title') {
      element.setAttribute('content', this.meta.title);
    } else if (name === 'twitter:description') {
      element.setAttribute('content', this.meta.description);
    } else if (property === 'og:title') {
      element.setAttribute('content', this.meta.title);
    } else if (property === 'og:description') {
      element.setAttribute('content', this.meta.description);
    } else if (property === 'og:url') {
      element.setAttribute('content', this.canonicalUrl);
    } else if (rel === 'canonical') {
      element.setAttribute('href', this.canonicalUrl);
    }
  }
}

class TitleRewriter {
  constructor(title) {
    this.title = title;
  }

  element(element) {
    element.setInnerContent(this.title);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Determines whether the request is likely from a bot / crawler / link-preview
 * scraper that does NOT execute JavaScript.
 */
export function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return /bot|crawl|spider|slurp|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegram|discord|slack|embedly|quora|outbrain|pinterest|vkshare|w3c_validator|googlebot|bingbot|yandex|baiduspider|duckduckbot|sogou|exabot|ia_archiver|semrush|ahref|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|anthropic|perplexity/i.test(
    ua
  );
}

/**
 * Apply HTMLRewriter to inject route-specific meta tags into an HTML response.
 * Only rewrites if the response Content-Type is text/html.
 *
 * @param {Response} response - The original HTML response
 * @param {string} pathname - The request URL pathname (e.g., "/about")
 * @returns {Response} The rewritten response (or original if not HTML)
 */
export function rewriteHtmlSeo(response, pathname) {
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;

  const meta = resolveMeta(pathname);
  const canonicalUrl = `${BASE_URL}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;

  return new HTMLRewriter()
    .on('title', new TitleRewriter(meta.title))
    .on('meta[name="description"]', new MetaRewriter(meta, canonicalUrl))
    .on('meta[name="keywords"]', new MetaRewriter(meta, canonicalUrl))
    .on('meta[name="twitter:title"]', new MetaRewriter(meta, canonicalUrl))
    .on('meta[name="twitter:description"]', new MetaRewriter(meta, canonicalUrl))
    .on('meta[property="og:title"]', new MetaRewriter(meta, canonicalUrl))
    .on('meta[property="og:description"]', new MetaRewriter(meta, canonicalUrl))
    .on('meta[property="og:url"]', new MetaRewriter(meta, canonicalUrl))
    .on('link[rel="canonical"]', new MetaRewriter(meta, canonicalUrl))
    .transform(response);
}
