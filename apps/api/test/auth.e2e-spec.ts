import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

describe('Auth API (e2e)', () => {
  const baseUrl = process.env.API_URL || 'http://localhost:3100';

  it('should respond to health check', async () => {
    const response = await request(baseUrl).get('/health');
    expect(response.status).toBe(200);
  });

  it('should accept login with valid credentials', async () => {
    const response = await request(baseUrl)
      .post('/auth/login')
      .set('User-Agent', 'JestE2E/1.0')
      .send({
        email: 'root@hedhog.com',
        password: 'changeme',
      })
      .set('Content-Type', 'application/json');

    expect([200, 201]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body).toHaveProperty('refreshToken');
      expect(typeof response.body.refreshToken).toBe('string');
    }
  });

  it('should reject login with invalid credentials', async () => {
    const response = await request(baseUrl)
      .post('/auth/login')
      .set('User-Agent', 'JestE2E/1.0')
      .send({
        email: 'invalid@example.com',
        password: 'wrongpassword',
      })
      .set('Content-Type', 'application/json');

    expect([400, 401]).toContain(response.status);
  });

  it('should reject login with missing email', async () => {
    const response = await request(baseUrl)
      .post('/auth/login')
      .set('User-Agent', 'JestE2E/1.0')
      .send({
        password: 'changeme',
      })
      .set('Content-Type', 'application/json');

    expect([400, 422]).toContain(response.status);
  });

  it('should reject login with missing password', async () => {
    const response = await request(baseUrl)
      .post('/auth/login')
      .set('User-Agent', 'JestE2E/1.0')
      .send({
        email: 'root@hedhog.com',
      })
      .set('Content-Type', 'application/json');

    expect([400, 422]).toContain(response.status);
  });

  it('should reject refresh without refreshToken', async () => {
    const response = await request(baseUrl)
      .post('/auth/refresh')
      .send({})
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(401);
  });

  it('should reject refresh with invalid refreshToken', async () => {
    const response = await request(baseUrl)
      .post('/auth/refresh')
      .send({
        refreshToken: 'invalid.jwt.token',
      })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(401);
  });

  it('should refresh access token using the issued refresh cookie', async () => {
    const loginResponse = await request(baseUrl)
      .post('/auth/login')
      .set('User-Agent', 'JestE2E/1.0')
      .send({
        email: 'root@hedhog.com',
        password: 'changeme',
      })
      .set('Content-Type', 'application/json');

    expect([200, 201]).toContain(loginResponse.status);
    const cookies = loginResponse.headers['set-cookie'] ?? [];
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.some((value: string) => value.includes('rt='))).toBe(true);

    const refreshResponse = await request(baseUrl)
      .post('/auth/refresh')
      .set('Cookie', cookies)
      .send({})
      .set('Content-Type', 'application/json');

    expect([200, 201]).toContain(refreshResponse.status);
    expect(refreshResponse.body).toHaveProperty('accessToken');
    expect(typeof refreshResponse.body.accessToken).toBe('string');
    expect(refreshResponse.body).toHaveProperty('refreshToken');
    expect(typeof refreshResponse.body.refreshToken).toBe('string');
  });

  it('should refresh access token using the refreshToken body fallback', async () => {
    const loginResponse = await request(baseUrl)
      .post('/auth/login')
      .set('User-Agent', 'JestE2E/1.0')
      .send({
        email: 'root@hedhog.com',
        password: 'changeme',
      })
      .set('Content-Type', 'application/json');

    expect([200, 201]).toContain(loginResponse.status);
    expect(typeof loginResponse.body.refreshToken).toBe('string');

    const refreshResponse = await request(baseUrl)
      .post('/auth/refresh')
      .send({
        refreshToken: loginResponse.body.refreshToken,
      })
      .set('Content-Type', 'application/json');

    expect([200, 201]).toContain(refreshResponse.status);
    expect(refreshResponse.body).toHaveProperty('accessToken');
    expect(typeof refreshResponse.body.accessToken).toBe('string');
    expect(refreshResponse.body).toHaveProperty('refreshToken');
    expect(typeof refreshResponse.body.refreshToken).toBe('string');
  });
});
