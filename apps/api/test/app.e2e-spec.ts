import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

describe('Application (e2e)', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3100';

  it('should respond to health check', async () => {
    const response = await request(baseUrl).get('/health');
    expect(response.status).toBe(200);
  });

  it('should have healthy status', async () => {
    const response = await request(baseUrl).get('/health');
    expect(response.body).toHaveProperty('status');
  });
});
