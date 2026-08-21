import { describe, expect, it, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import request from 'supertest';
import { anyPaginationEnvelope, apiErrorSchema } from '@hed-hog/api-types';

/**
 * Testes de CONTRATO: garantem que a API responde no shape que os apps assumem.
 * Usam os schemas zod compartilhados em @hed-hog/api-types/contracts como fonte
 * única de verdade — os mesmos schemas que os hooks do frontend passam a consumir
 * (ex.: apps/admin/src/hooks/use-pagination-fetch.ts). Se a API mudar o envelope
 * de paginação ou o formato de erro, estes testes quebram ANTES de o front quebrar.
 *
 * Roda contra um servidor vivo (API_URL); faz parte da suíte E2E (ci-e2e.yml).
 */
const BASE_URL = process.env.API_URL || 'http://localhost:3100';

interface RouteEntry {
  url: string;
  method: string;
  type?: string;
}

// Descobre rotas de listagem (GET sem path param) declaradas nos route.yaml de
// todas as libraries — a superfície que tipicamente retorna o envelope paginado.
function loadListRoutes(): string[] {
  const libsDir = path.resolve(__dirname, '../../../libraries');
  const urls = new Set<string>();

  for (const lib of fs.readdirSync(libsDir)) {
    const file = path.join(libsDir, lib, 'hedhog/data/route.yaml');
    if (!fs.existsSync(file)) continue;
    const entries = yaml.load(fs.readFileSync(file, 'utf8')) as RouteEntry[];
    if (!Array.isArray(entries)) continue;

    for (const r of entries) {
      const isHttp = r.type === 'HTTP' || !r.type;
      if (isHttp && r.method === 'GET' && !r.url.includes(':')) {
        urls.add(r.url);
      }
    }
  }

  return [...urls].sort();
}

describe('Contract — API response shapes', () => {
  let token: string | null = null;

  beforeAll(async () => {
    try {
      const res = await request(BASE_URL)
        .post('/auth/login')
        .set('User-Agent', 'JestE2E/1.0')
        .set('Content-Type', 'application/json')
        .timeout({ deadline: 8000 })
        .send({ email: 'root@hedhog.com', password: 'changeme' });
      if (res.status === 200 || res.status === 201) {
        token = res.body?.accessToken ?? null;
      }
    } catch {
      token = null;
    }
  });

  it('error responses match the shared apiErrorSchema', async () => {
    // Rota protegida sem token → erro no formato padrão do HttpExceptionFilter.
    const res = await request(BASE_URL).get('/user').timeout({ deadline: 8000 });
    expect([401, 403]).toContain(res.status);

    const parsed = apiErrorSchema.safeParse(res.body);
    if (!parsed.success) {
      throw new Error(
        `Resposta de erro fora do contrato apiErrorSchema:\n${JSON.stringify(res.body)}\n` +
          parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
      );
    }
  });

  it('list endpoints that return data respect the pagination envelope', async () => {
    if (!token) {
      console.warn(
        '\n  [contract] sem token de auth (servidor não instalado?) — pulando validação de envelope.',
      );
      return;
    }

    const routes = loadListRoutes();
    const failures: string[] = [];
    let validated = 0;
    let skipped = 0;

    for (const url of routes) {
      let res;
      try {
        res = await request(BASE_URL)
          .get(url)
          .set('Authorization', `Bearer ${token}`)
          .timeout({ deadline: 8000 });
      } catch {
        continue;
      }

      // Só validamos quando a rota respondeu 200 com um envelope PAGINADO — `data`
      // como array E ao menos um campo de paginação (total/page/lastPage). Listas
      // simples `{ data }` (não paginadas) e outros shapes são ignorados: o objetivo
      // é validar o contrato ONDE ele se aplica, não impor paginação a toda rota.
      if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) {
        skipped++;
        continue;
      }

      const looksPaginated =
        'total' in res.body || 'page' in res.body || 'lastPage' in res.body;
      if (!looksPaginated) {
        skipped++;
        continue;
      }

      const parsed = anyPaginationEnvelope.safeParse(res.body);
      if (parsed.success) {
        validated++;
      } else {
        failures.push(
          `  GET ${url} → ${parsed.error.issues
            .map((i) => i.path.join('.') || '(root)')
            .join(', ')}`,
        );
      }
    }

    console.log(
      `\n  [contract] ${validated} endpoint(s) validados contra o envelope de paginação` +
        ` | ${skipped} ignorados (não-lista/inativos)` +
        (failures.length ? ` | ${failures.length} violam o contrato` : ''),
    );

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} endpoint(s) violam o envelope de paginação:\n${failures.join('\n')}`,
      );
    }
  }, 120000);
});
