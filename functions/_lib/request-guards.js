import { safeString, fnv1a } from "./utils.js";

const ADMIN_HOST = "admin.sustainabilitysignals.com";
const COVERAGE_HOSTS = new Set([
  "sustainabilitysignals.com",
  "www.sustainabilitysignals.com",
  "sustainability-signals.pages.dev",
]);
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

function normalizeHost(value) {
  return safeString(value).trim().toLowerCase().split(":")[0];
}

function hostFromHeaderUrl(value) {
  const raw = safeString(value).trim();
  if (!raw) return "";
  try {
    return normalizeHost(new URL(raw).hostname);
  } catch {
    return "";
  }
}

function isPreviewPagesHost(host) {
  return /^[a-z0-9-]+\.sustainability-signals\.pages\.dev$/i.test(host);
}

function isLocalDevHost(host) {
  if (!host) return false;
  if (LOCAL_DEV_HOSTS.has(host)) return true;
  return host.endsWith(".localhost");
}

function isCoverageHost(host) {
  if (!host) return false;
  if (isLocalDevHost(host)) return true;
  if (COVERAGE_HOSTS.has(host)) return true;
  return isPreviewPagesHost(host);
}

function isAdminHost(host) {
  if (!host) return false;
  if (isLocalDevHost(host)) return true;
  return host === ADMIN_HOST;
}

/**
 * @param {Request} request
 */
export function requestProvenance(request) {
  const host = normalizeHost(request.headers.get("Host"));
  const originHost = hostFromHeaderUrl(request.headers.get("Origin"));
  const refererHost = hostFromHeaderUrl(request.headers.get("Referer"));
  return { host, originHost, refererHost };
}

/**
 * Allow coverage ingest only from first-party coverage hosts.
 * In production, require at least Origin or Referer for browser provenance.
 *
 * @param {Request} request
 * @returns {{ ok: boolean; reason?: string; details: { host: string; originHost: string; refererHost: string } }}
 */
export function validateCoverageRequestSource(request) {
  const details = requestProvenance(request);
  const { host, originHost, refererHost } = details;

  if (!isCoverageHost(host)) {
    return { ok: false, reason: "Upload endpoint is restricted to first-party coverage hosts", details };
  }
  if (originHost && !isCoverageHost(originHost)) {
    return { ok: false, reason: "Invalid request origin for upload endpoint", details };
  }
  if (refererHost && !isCoverageHost(refererHost)) {
    return { ok: false, reason: "Invalid request referer for upload endpoint", details };
  }
  if (!originHost && !refererHost && !isLocalDevHost(host)) {
    return { ok: false, reason: "Upload requests must include Origin or Referer headers", details };
  }

  return { ok: true, details };
}

/**
 * Allow deletion only from the admin host (or localhost in development).
 *
 * @param {Request} request
 * @returns {{ ok: boolean; reason?: string; details: { host: string; originHost: string; refererHost: string } }}
 */
export function validateAdminDeleteRequestSource(request) {
  const details = requestProvenance(request);
  const { host, originHost, refererHost } = details;

  if (!isAdminHost(host)) {
    return { ok: false, reason: "Delete endpoint is restricted to the admin host", details };
  }
  if (originHost && !isAdminHost(originHost)) {
    return { ok: false, reason: "Invalid request origin for admin delete endpoint", details };
  }
  if (refererHost && !isAdminHost(refererHost)) {
    return { ok: false, reason: "Invalid request referer for admin delete endpoint", details };
  }
  if (!originHost && !refererHost && !isLocalDevHost(host)) {
    return { ok: false, reason: "Admin delete requests must include Origin or Referer headers", details };
  }

  return { ok: true, details };
}

function requestClientIp(request) {
  const xff = safeString(request.headers.get("X-Forwarded-For")).split(",")[0].trim();
  return safeString(request.headers.get("CF-Connecting-IP") || xff).trim();
}

function requestUserAgent(request) {
  return safeString(request.headers.get("User-Agent")).trim().slice(0, 512);
}

/**
 * Hash request identity fields so stage tokens can be bound to origin session
 * without storing raw IP/UA strings in R2.
 *
 * @param {Request} request
 */
export function buildRequestFingerprint(request) {
  const provenance = requestProvenance(request);
  const ip = requestClientIp(request);
  const ua = requestUserAgent(request).toLowerCase();

  return {
    ...provenance,
    ipHash: ip ? fnv1a(ip) : "",
    uaHash: ua ? fnv1a(ua) : "",
  };
}

/**
 * Accept if either hashed IP or hashed UA matches.
 *
 * @param {any} staged
 * @param {{ ipHash: string; uaHash: string }} current
 */
export function fingerprintMatches(staged, current) {
  const stagedIpHash = safeString(staged?.ipHash).trim();
  const stagedUaHash = safeString(staged?.uaHash).trim();
  if (!stagedIpHash && !stagedUaHash) return false;

  const sameIp = stagedIpHash && stagedIpHash === safeString(current?.ipHash).trim();
  const sameUa = stagedUaHash && stagedUaHash === safeString(current?.uaHash).trim();
  return Boolean(sameIp || sameUa);
}
