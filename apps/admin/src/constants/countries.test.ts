import { describe, expect, it } from 'vitest';

import { COUNTRIES } from './countries';

describe('COUNTRIES', () => {
  it('exporta uma lista com todos os países esperados', () => {
    expect(Array.isArray(COUNTRIES)).toBe(true);
    expect(COUNTRIES.length).toBe(243);
  });

  it('cada item possui as propriedades name e code no formato correto', () => {
    for (const country of COUNTRIES) {
      expect(typeof country.name).toBe('string');
      expect(country.name.length).toBeGreaterThan(0);
      expect(typeof country.code).toBe('string');
      expect(country.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('contém entradas conhecidas', () => {
    expect(COUNTRIES).toContainEqual({ name: 'Brazil', code: 'BR' });
    expect(COUNTRIES).toContainEqual({ name: 'United States', code: 'US' });
    expect(COUNTRIES).toContainEqual({ name: 'Zimbabwe', code: 'ZW' });
  });
});
