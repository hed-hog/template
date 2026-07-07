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
      expect(normalizeOrigin('https://Class2026.HCODE.com.br/')).toBe(
        'https://class2026.hcode.com.br'
      );
      expect(normalizeOrigin('"https://hub.hcode.com.br"')).toBe(
        'https://hub.hcode.com.br'
      );
    });

    it('returns empty string for nullish/blank input', () => {
      expect(normalizeOrigin(undefined)).toBe('');
      expect(normalizeOrigin('   ')).toBe('');
    });
  });

  describe('normalizeDomain', () => {
    it('strips scheme, path and trailing dots', () => {
      expect(normalizeDomain('https://hcode.com.br/')).toBe('hcode.com.br');
      expect(normalizeDomain('HCODE.TRAINING.')).toBe('hcode.training');
    });
  });

  describe('getCorsOrigins / getCorsDomains', () => {
    it('parses comma/semicolon/newline separated lists', () => {
      expect(
        getCorsOrigins('https://hub.hcode.com.br, https://hcode.training')
      ).toEqual(['https://hub.hcode.com.br', 'https://hcode.training']);
      expect(getCorsDomains('hcode.com.br;hcode.training')).toEqual([
        'hcode.com.br',
        'hcode.training',
      ]);
    });

    it('returns empty arrays when unset', () => {
      expect(getCorsOrigins('')).toEqual([]);
      expect(getCorsDomains(undefined)).toEqual([]);
    });
  });

  describe('isHostUnderDomain', () => {
    it('matches the apex and any subdomain', () => {
      expect(isHostUnderDomain('hcode.com.br', 'hcode.com.br')).toBe(true);
      expect(isHostUnderDomain('class2026.hcode.com.br', 'hcode.com.br')).toBe(
        true
      );
      expect(
        isHostUnderDomain('deep.nested.hcode.com.br', 'hcode.com.br')
      ).toBe(true);
    });

    it('rejects lookalike / suffix-injection hosts', () => {
      expect(isHostUnderDomain('evilhcode.com.br', 'hcode.com.br')).toBe(false);
      expect(
        isHostUnderDomain('hcode.com.br.attacker.com', 'hcode.com.br')
      ).toBe(false);
      expect(isHostUnderDomain('', 'hcode.com.br')).toBe(false);
    });
  });

  describe('isCorsOriginAllowed', () => {
    const allowed = {
      origins: ['http://localhost:3200'],
      domains: ['hcode.com.br', 'hcode.training'],
    };

    it('allows an exact configured origin', () => {
      expect(isCorsOriginAllowed('http://localhost:3200', allowed)).toBe(true);
    });

    it('allows any subdomain of a trusted base domain', () => {
      expect(
        isCorsOriginAllowed('https://class2026.hcode.com.br', allowed)
      ).toBe(true);
      expect(
        isCorsOriginAllowed('https://partners.hcode.com.br', allowed)
      ).toBe(true);
      expect(isCorsOriginAllowed('https://hedhog.hcode.com.br', allowed)).toBe(
        true
      );
      expect(isCorsOriginAllowed('https://hcode.training', allowed)).toBe(true);
    });

    it('rejects untrusted and lookalike origins', () => {
      expect(isCorsOriginAllowed('https://evil.com', allowed)).toBe(false);
      expect(isCorsOriginAllowed('https://evilhcode.com.br', allowed)).toBe(
        false
      );
      expect(
        isCorsOriginAllowed('https://hcode.com.br.attacker.com', allowed)
      ).toBe(false);
    });

    it('rejects when no origin is provided', () => {
      expect(isCorsOriginAllowed('', allowed)).toBe(false);
      expect(isCorsOriginAllowed(undefined, allowed)).toBe(false);
    });

    it('falls back to exact origins when no domains are configured', () => {
      const onlyOrigins = { origins: ['https://hub.hcode.com.br'] };
      expect(
        isCorsOriginAllowed('https://hub.hcode.com.br', onlyOrigins)
      ).toBe(true);
      expect(
        isCorsOriginAllowed('https://class2026.hcode.com.br', onlyOrigins)
      ).toBe(false);
    });
  });
});
