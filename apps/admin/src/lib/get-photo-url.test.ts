import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getPhotoUrl } from './get-photo-url';

// getPhotoUrl reads the env at call time, so it's enough to stub it per test.
const BASE = 'http://api.test';

describe('getPhotoUrl', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', BASE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('positive numeric id builds the avatar URL', () => {
    expect(getPhotoUrl(12)).toBe(`${BASE}/user/avatar/12`);
  });

  it('numeric string is converted', () => {
    expect(getPhotoUrl('34')).toBe(`${BASE}/user/avatar/34`);
  });

  it('non-numeric string falls back to placeholder', () => {
    expect(getPhotoUrl('abc')).toBe('/placeholder.png');
  });

  it('zero, negative, null and undefined fall back to placeholder', () => {
    expect(getPhotoUrl(0)).toBe('/placeholder.png');
    expect(getPhotoUrl(-3)).toBe('/placeholder.png');
    expect(getPhotoUrl(null)).toBe('/placeholder.png');
    expect(getPhotoUrl(undefined)).toBe('/placeholder.png');
  });
});
