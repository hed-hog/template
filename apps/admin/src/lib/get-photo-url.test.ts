import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getPhotoUrl } from './get-photo-url';

// getPhotoUrl lê o env em tempo de chamada, então basta fixá-lo por teste.
const BASE = 'http://api.test';

describe('getPhotoUrl', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', BASE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('id numérico positivo monta a URL do avatar', () => {
    expect(getPhotoUrl(12)).toBe(`${BASE}/user/avatar/12`);
  });

  it('string numérica é convertida', () => {
    expect(getPhotoUrl('34')).toBe(`${BASE}/user/avatar/34`);
  });

  it('string não numérica cai no placeholder', () => {
    expect(getPhotoUrl('abc')).toBe('/placeholder.png');
  });

  it('zero, negativo, null e undefined caem no placeholder', () => {
    expect(getPhotoUrl(0)).toBe('/placeholder.png');
    expect(getPhotoUrl(-3)).toBe('/placeholder.png');
    expect(getPhotoUrl(null)).toBe('/placeholder.png');
    expect(getPhotoUrl(undefined)).toBe('/placeholder.png');
  });
});
