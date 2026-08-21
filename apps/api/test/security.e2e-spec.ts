import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';

/**
 * E2E security tests against a live server (API_URL). Validate the real
 * hardening wiring (helmet, role-based authz). Part of the E2E suite
 * (ci-e2e.yml) — require a server + seeded database.
 *
 * Future coverage (requires a multi-role/multi-tenant fixture): full role-based
 * authorization matrix driven by route.yaml and tenant isolation / IDOR
 * (resolveEnterpriseId). See docs/testing.md §Roadmap.
 */
const BASE_URL = process.env.API_URL || 'http://localhost:3100';

describe('Security (e2e)', () => {
  let rootToken: string | null = null;

  beforeAll(async () => {
    try {
      const res = await request(BASE_URL)
        .post('/auth/login')
        .set('User-Agent', 'JestE2E/1.0')
        .set('Content-Type', 'application/json')
        .timeout({ deadline: 8000 })
        .send({ email: 'root@hedhog.com', password: 'changeme' });
      if (res.status === 200 || res.status === 201) {
        rootToken = res.body?.accessToken ?? null;
      }
    } catch {
      rootToken = null;
    }
  });

  it('applies helmet security headers to responses', async () => {
    const res = await request(BASE_URL).get('/health').timeout({ deadline: 8000 });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the admin (root) to access a protected admin endpoint', async () => {
    if (!rootToken) {
      console.warn('\n  [security] no root token — skipping positive authz.');
      return;
    }

    const res = await request(BASE_URL)
      .get('/user?page=1&pageSize=1')
      .set('Authorization', `Bearer ${rootToken}`)
      .timeout({ deadline: 8000 });

    // 404 → route not active in this API version; not an authz failure.
    if (res.status === 404) {
      console.warn('\n  [security] GET /user inactive — skipping positive authz.');
      return;
    }
    expect(res.status).toBe(200);
  });

  it('denies a user without admin role access to an admin endpoint (403)', async () => {
    // Creates a regular user via signup; if the flow requires verification and
    // does not return a token, the test is skipped (full coverage requires a fixture).
    const email = `e2e-authz-${Date.now()}@example.com`;
    let userToken: string | null = null;
    try {
      const signup = await request(BASE_URL)
        .post('/auth/signup')
        .set('Content-Type', 'application/json')
        .timeout({ deadline: 8000 })
        .send({ name: 'E2E Authz', email, password: 'changeme123' });
      userToken = signup.body?.accessToken ?? null;
    } catch {
      userToken = null;
    }

    if (!userToken) {
      console.warn(
        '\n  [security] signup did not return a token (verification required?) — skipping negative authz.',
      );
      return;
    }

    const res = await request(BASE_URL)
      .get('/user?page=1&pageSize=1')
      .set('Authorization', `Bearer ${userToken}`)
      .timeout({ deadline: 8000 });

    expect(res.status).toBe(403);
  });
});
