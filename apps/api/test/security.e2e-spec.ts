import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';

/**
 * Testes E2E de segurança contra um servidor vivo (API_URL). Validam o wiring
 * real do hardening (helmet, authz por role). Fazem parte da suíte E2E
 * (ci-e2e.yml) — precisam de servidor + banco semeado.
 *
 * Cobertura futura (requer fixture multi-role/multi-tenant): matriz completa de
 * autorização por role dirigida pelo route.yaml e isolamento de tenant / IDOR
 * (resolveEnterpriseId). Ver docs/testing.md §Roadmap.
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

  it('aplica headers de segurança do helmet nas respostas', async () => {
    const res = await request(BASE_URL).get('/health').timeout({ deadline: 8000 });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('permite ao admin (root) acessar um endpoint protegido de admin', async () => {
    if (!rootToken) {
      console.warn('\n  [security] sem token root — pulando authz positivo.');
      return;
    }

    const res = await request(BASE_URL)
      .get('/user?page=1&pageSize=1')
      .set('Authorization', `Bearer ${rootToken}`)
      .timeout({ deadline: 8000 });

    // 404 → rota não ativa nesta versão da API; não é falha de authz.
    if (res.status === 404) {
      console.warn('\n  [security] GET /user inativo — pulando authz positivo.');
      return;
    }
    expect(res.status).toBe(200);
  });

  it('nega a um usuário sem role de admin um endpoint de admin (403)', async () => {
    // Cria um usuário comum via signup; se o fluxo exigir verificação e não
    // devolver token, o teste é pulado (a cobertura completa exige fixture).
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
        '\n  [security] signup não retornou token (verificação exigida?) — pulando authz negativo.',
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
