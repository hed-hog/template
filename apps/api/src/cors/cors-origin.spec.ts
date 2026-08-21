import { describe, expect, it } from '@jest/globals';
import {
  getCorsDomains,
  getCorsOrigins,
  isCorsOriginAllowed,
  isHostUnderDomain,
  normalizeDomain,
  normalizeOrigin,
  parseSettingOrigins,
} from './cors-origin';

describe('cors-origin', () => {
  describe('normalizeOrigin', () => {
    it('lowercases and strips trailing slashes/quotes', () => {
      expect(normalizeOrigin('https://Class.HCODE.com.br/')).toBe(
        'https://class.hcode.com.br'
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
      expect(isHostUnderDomain('class.hcode.com.br', 'hcode.com.br')).toBe(
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
        isCorsOriginAllowed('https://class.hcode.com.br', allowed)
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
        isCorsOriginAllowed('https://class.hcode.com.br', onlyOrigins)
      ).toBe(false);
    });

    /**
     * `cors-allowed-origins` is what lets a self-hosted install accept the
     * published extension without editing env vars and restarting the API.
     * A malformed value must cost one rejected origin, never an exception in
     * the CORS middleware — which runs on every single request.
     */
    describe('origins from the setting', () => {
      it('accepts the array the setting component produces', () => {
        expect(
          parseSettingOrigins(['chrome-extension://abc', 'https://Example.com/'])
        ).toEqual(['chrome-extension://abc', 'https://example.com']);
      });

      it('accepts a raw string, for a hand-seeded value', () => {
        expect(parseSettingOrigins('https://a.com, https://b.com')).toEqual([
          'https://a.com',
          'https://b.com',
        ]);
      });

      it('drops duplicates and empties instead of throwing', () => {
        expect(parseSettingOrigins(['https://a.com', 'https://a.com/', '', '  '])).toEqual([
          'https://a.com',
        ]);
      });

      it('returns an empty list for anything else', () => {
        for (const value of [null, undefined, 42, {}, true]) {
          expect(parseSettingOrigins(value)).toEqual([]);
        }
      });

      it('feeds isCorsOriginAllowed like the env allowlist does', () => {
        const origins = parseSettingOrigins([
          'chrome-extension://ojimnolpmeegaaindaaceiodhmlbaljn',
        ]);
        expect(
          isCorsOriginAllowed(
            'chrome-extension://ojimnolpmeegaaindaaceiodhmlbaljn',
            { origins }
          )
        ).toBe(true);
        expect(
          isCorsOriginAllowed('chrome-extension://outra', { origins })
        ).toBe(false);
      });
    });

    /**
     * The HedHog Vaults browser extension (apps/hedhog-vaults-extension) sends
     * `Origin: chrome-extension://<id>`. The scheme is non-special, so
     * `new URL(...).origin` is the literal string "null" — matching on it would
     * silently allow every extension on earth. normalizeOrigin uses
     * protocol + host instead, and this test is what keeps it that way.
     */
    describe('chrome-extension origins', () => {
      const STORE_ID = 'ojimnolpmeegaaindaaceiodhmlbaljn';
      const extension = { origins: [`chrome-extension://${STORE_ID}`] };

      it('allows the exact published extension id', () => {
        expect(
          isCorsOriginAllowed(`chrome-extension://${STORE_ID}`, extension)
        ).toBe(true);
      });

      it('rejects any other extension id', () => {
        expect(
          isCorsOriginAllowed(
            'chrome-extension://gcjdclnalkkapoajodppjbcmifnadgok',
            extension
          )
        ).toBe(false);
      });

      it('is not widened by CORS_ALLOWED_DOMAINS', () => {
        // The extension id is the host here, so no base domain can ever cover
        // it — an extension must always be listed explicitly.
        expect(
          isCorsOriginAllowed(`chrome-extension://${STORE_ID}`, {
            domains: ['hcode.com.br'],
          })
        ).toBe(false);
      });
    });
  });
});
