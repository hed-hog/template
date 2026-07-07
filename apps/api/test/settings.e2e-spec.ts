import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

describe('Settings Module (e2e)', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3100';

  it('should get initial settings', async () => {
    const response = await request(baseUrl).get('/setting/initial');
    expect(response.status).toBe(200);
  });

  it('should return settings object', async () => {
    const response = await request(baseUrl).get('/setting/initial');
    expect(response.body).toBeDefined();
  });
});
