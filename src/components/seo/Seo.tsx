import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Sustainability Signals';
const BASE_URL = 'https://www.sustainabilitysignals.com';
const DEFAULT_IMAGE_PATH = '/og-image.png';
const DEFAULT_IMAGE_ALT = 'Sustainability Signals — Evidence-Grounded ESG Ratings';
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;

type JsonLd = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface SeoProps {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  noindex?: boolean;
  keywords?: string[];
  structuredData?: JsonLd | JsonLd[];
  breadcrumbs?: BreadcrumbItem[];
  /** ISO date string for article publish date */
  datePublished?: string;
  /** ISO date string for article modification date */
  dateModified?: string;
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `${BASE_URL}${pathOrUrl}`;
  return `${BASE_URL}/${pathOrUrl}`;
}

function normalizePath(path: string): string {
  if (!path) return '/';
  if (path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function Seo({
  title,
  description,
  path = '/',
  type = 'website',
  image = DEFAULT_IMAGE_PATH,
  imageAlt = DEFAULT_IMAGE_ALT,
  imageWidth = DEFAULT_IMAGE_WIDTH,
  imageHeight = DEFAULT_IMAGE_HEIGHT,
  noindex = false,
  keywords = [],
  structuredData,
  breadcrumbs,
  datePublished,
  dateModified,
}: SeoProps) {
  const normalizedPath = normalizePath(path);
  const canonicalUrl = toAbsoluteUrl(normalizedPath);
  const imageUrl = toAbsoluteUrl(image);
  const robots = noindex
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  const baseSchemas: JsonLd[] = [];
  if (!noindex) {
    baseSchemas.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: SITE_NAME,
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: toAbsoluteUrl('/logo-white.png'),
      },
    });

    baseSchemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      name: title,
      description,
      url: canonicalUrl,
      inLanguage: 'en-US',
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#website`,
        name: SITE_NAME,
        url: BASE_URL,
      },
      ...(datePublished ? { datePublished } : {}),
      ...(dateModified ? { dateModified } : {}),
    });

    // BreadcrumbList structured data
    if (breadcrumbs && breadcrumbs.length > 0) {
      const allCrumbs = [{ name: 'Home', path: '/' }, ...breadcrumbs];
      baseSchemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: allCrumbs.map((crumb, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: crumb.name,
          item: toAbsoluteUrl(crumb.path),
        })),
      });
    }
  }

  const extraSchemas = structuredData
    ? (Array.isArray(structuredData) ? structuredData : [structuredData])
    : [];
  const allSchemas = [...baseSchemas, ...extraSchemas];

  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="author" content={SITE_NAME} />
      {keywords.length > 0 ? <meta name="keywords" content={keywords.join(', ')} /> : null}

      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {allSchemas.map((schema, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
