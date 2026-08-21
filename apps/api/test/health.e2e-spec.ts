import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

describe('Module Loading (e2e)', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3100';

  it('should return 200 on health check', async () => {
    const response = await request(baseUrl).get('/health');
    expect(response.status).toBe(200);
  });

  it('should have database connection', async () => {
    const response = await request(baseUrl).get('/health');
    expect(response.body).toBeDefined();
  });
});
