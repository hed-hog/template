import { describe, expect, it } from '@jest/globals';
import {
  getCorsDomains,
  getCorsOrigins,
  isCorsOriginAllowed,
  isHostUnderDomain,
  normalizeDomain,
  normalizeOrigin,
} from './cors-origin';

describe('cors-origin', () => {
  describe('normalizeOrigin', () => {
    it('lowercases and strips trailing slashes/quotes', () => {
      expect(normalizeOrigin('https://App.EXAMPLE.com/')).toBe(
        'https://app.example.com'
      );
      expect(normalizeOrigin('"https://admin.example.com"')).toBe(
        'https://admin.example.com'
      );
    });

    it('returns empty string for nullish/blank input', () => {
      expect(normalizeOrigin(undefined)).toBe('');
      expect(normalizeOrigin('   ')).toBe('');
    });
  });

  describe('normalizeDomain', () => {
    it('strips scheme, path and trailing dots', () => {
      expect(normalizeDomain('https://example.com/')).toBe('example.com');
      expect(normalizeDomain('EXAMPLE.ORG.')).toBe('example.org');
    });
  });

  describe('getCorsOrigins / getCorsDomains', () => {
    it('parses comma/semicolon/newline separated lists', () => {
      expect(
        getCorsOrigins('https://admin.example.com, https://example.org')
      ).toEqual(['https://admin.example.com', 'https://example.org']);
      expect(getCorsDomains('example.com;example.org')).toEqual([
        'example.com',
        'example.org',
      ]);
    });

    it('returns empty arrays when unset', () => {
      expect(getCorsOrigins('')).toEqual([]);
      expect(getCorsDomains(undefined)).toEqual([]);
    });
  });

  describe('isHostUnderDomain', () => {
    it('matches the apex and any subdomain', () => {
      expect(isHostUnderDomain('example.com', 'example.com')).toBe(true);
      expect(isHostUnderDomain('app.example.com', 'example.com')).toBe(
        true
      );
      expect(
        isHostUnderDomain('deep.nested.example.com', 'example.com')
      ).toBe(true);
    });

    it('rejects lookalike / suffix-injection hosts', () => {
      expect(isHostUnderDomain('evilexample.com', 'example.com')).toBe(false);
      expect(
        isHostUnderDomain('example.com.attacker.com', 'example.com')
      ).toBe(false);
      expect(isHostUnderDomain('', 'example.com')).toBe(false);
    });
  });

  describe('isCorsOriginAllowed', () => {
    const allowed = {
      origins: ['http://localhost:3200'],
      domains: ['example.com', 'example.org'],
    };

    it('allows an exact configured origin', () => {
      expect(isCorsOriginAllowed('http://localhost:3200', allowed)).toBe(true);
    });

    it('allows any subdomain of a trusted base domain', () => {
      expect(
        isCorsOriginAllowed('https://app.example.com', allowed)
      ).toBe(true);
      expect(
        isCorsOriginAllowed('https://partners.example.com', allowed)
      ).toBe(true);
      expect(isCorsOriginAllowed('https://www.example.com', allowed)).toBe(
        true
      );
      expect(isCorsOriginAllowed('https://example.org', allowed)).toBe(true);
    });

    it('rejects untrusted and lookalike origins', () => {
      expect(isCorsOriginAllowed('https://evil.com', allowed)).toBe(false);
      expect(isCorsOriginAllowed('https://evilexample.com', allowed)).toBe(
        false
      );
      expect(
        isCorsOriginAllowed('https://example.com.attacker.com', allowed)
      ).toBe(false);
    });

    it('rejects when no origin is provided', () => {
      expect(isCorsOriginAllowed('', allowed)).toBe(false);
      expect(isCorsOriginAllowed(undefined, allowed)).toBe(false);
    });

    it('falls back to exact origins when no domains are configured', () => {
      const onlyOrigins = { origins: ['https://admin.example.com'] };
      expect(
        isCorsOriginAllowed('https://admin.example.com', onlyOrigins)
      ).toBe(true);
      expect(
        isCorsOriginAllowed('https://app.example.com', onlyOrigins)
      ).toBe(false);
    });
  });
});
