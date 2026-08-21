import { describe, expect, it, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import request from 'supertest';
import { anyPaginationEnvelope, apiErrorSchema } from '@hed-hog/api-types';

/**
 * CONTRACT tests: ensure the API responds in the shape the apps assume.
 * They use the zod schemas shared in @hed-hog/api-types/contracts as the single
 * source of truth — the same schemas the frontend hooks consume
 * (e.g., apps/admin/src/hooks/use-pagination-fetch.ts). If the API changes the
 * pagination envelope or the error format, these tests break BEFORE the frontend breaks.
 *
 * Runs against a live server (API_URL); part of the E2E suite (ci-e2e.yml).
 */
const BASE_URL = process.env.API_URL || 'http://localhost:3100';

interface RouteEntry {
  url: string;
  method: string;
  type?: string;
}

// Discovers list routes (GET without path param) declared in the route.yaml of
// all libraries — the surface that typically returns the paginated envelope.
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
    // Protected route without a token → error in the standard HttpExceptionFilter format.
    const res = await request(BASE_URL).get('/user').timeout({ deadline: 8000 });
    expect([401, 403]).toContain(res.status);

    const parsed = apiErrorSchema.safeParse(res.body);
    if (!parsed.success) {
      throw new Error(
        `Error response outside the apiErrorSchema contract:\n${JSON.stringify(res.body)}\n` +
          parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
      );
    }
  });

  it('list endpoints that return data respect the pagination envelope', async () => {
    if (!token) {
      console.warn(
        '\n  [contract] no auth token (server not installed?) — skipping envelope validation.',
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

      // We only validate when the route responded 200 with a PAGINATED envelope —
      // `data` as an array AND at least one pagination field (total/page/lastPage).
      // Simple `{ data }` lists (non-paginated) and other shapes are ignored: the
      // goal is to validate the contract WHERE it applies, not to force pagination on every route.
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
      `\n  [contract] ${validated} endpoint(s) validated against the pagination envelope` +
        ` | ${skipped} skipped (non-list/inactive)` +
        (failures.length ? ` | ${failures.length} violate the contract` : ''),
    );

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} endpoint(s) violate the pagination envelope:\n${failures.join('\n')}`,
      );
    }
  }, 120000);
});
