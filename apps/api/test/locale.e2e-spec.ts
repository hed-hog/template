import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

describe('Database Connection (e2e)', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3100';

  it('should list locales', async () => {
    const response = await request(baseUrl).get('/locale');
    expect([200, 401]).toContain(response.status);
  });
});
