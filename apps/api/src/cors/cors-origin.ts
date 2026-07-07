/**
 * CORS origin matching helpers.
 *
 * Two allowlist mechanisms are combined (an origin is allowed if EITHER matches):
 * - CORS_ALLOWED_ORIGINS: exact origins (scheme + host), e.g. "http://localhost:3200".
 * - CORS_ALLOWED_DOMAINS: trusted base domains; any subdomain AND the apex are allowed,
 *   e.g. "hcode.com.br,hcode.training" permits https://class2026.hcode.com.br,
 *   https://partners.hcode.com.br, https://hcode.training, etc.
 *
 * This module intentionally has no NestJS imports or side effects so the matching
 * logic can be unit-tested without booting the application from main.ts.
 */

export function normalizeOrigin(url?: string | null): string {
  const normalized = String(url ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '');

  if (!normalized) return '';

  try {
    const parsed = new URL(normalized);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return normalized.toLowerCase();
  }
}

export function parseOriginList(rawValue?: string | null): string[] {
  return String(rawValue ?? '')
    .split(/[\n,;]+/)
    .map((url) => normalizeOrigin(url))
    .filter(Boolean);
}

export function getCorsOrigins(
  rawValue: string | null | undefined = process.env.CORS_ALLOWED_ORIGINS
): string[] {
  const configuredOrigins = parseOriginList(rawValue);

  if (configuredOrigins.length > 0) {
    return Array.from(new Set(configuredOrigins));
  }

  return [];
}

export function normalizeDomain(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^[a-z]+:\/\//i, '') // strip an accidental scheme
    .replace(/\/.*$/, '') // strip any path
    .replace(/\.+$/, '') // strip trailing dots
    .toLowerCase();
}

export function parseDomainList(rawValue?: string | null): string[] {
  return String(rawValue ?? '')
    .split(/[\n,;]+/)
    .map((value) => normalizeDomain(value))
    .filter(Boolean);
}

export function getCorsDomains(
  rawValue: string | null | undefined = process.env.CORS_ALLOWED_DOMAINS
): string[] {
  return Array.from(new Set(parseDomainList(rawValue)));
}

function getOriginHost(normalizedOrigin: string): string {
  try {
    return new URL(normalizedOrigin).host.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * True when `host` is the base `domain` itself or one of its subdomains.
 * The leading dot in the suffix check prevents lookalike bypasses such as
 * "evilhcode.com.br" or "hcode.com.br.attacker.com" matching "hcode.com.br".
 */
export function isHostUnderDomain(host: string, domain: string): boolean {
  if (!host || !domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

export function isCorsOriginAllowed(
  origin: string | undefined | null,
  allowed: { origins?: string[]; domains?: string[] }
): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  const origins = allowed.origins ?? [];
  if (origins.includes(normalizedOrigin)) return true;

  const domains = allowed.domains ?? [];
  if (domains.length === 0) return false;

  const host = getOriginHost(normalizedOrigin);
  if (!host) return false;

  return domains.some((domain) => isHostUnderDomain(host, domain));
}
