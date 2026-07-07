import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import request from 'supertest';

const BASE_URL = process.env.API_URL || 'http://localhost:3100';

interface RouteEntry {
  url: string;
  method: string;
  type?: string;
}

interface PublicRoute {
  method: string;
  // url in route.yaml format (with :params) — used to exclude from protected set
  url: string;
  // actual URL to request; defaults to url when omitted
  testUrl?: string;
}

interface ControllerRoute {
  file: string;
  method: string;
  url: string;
  isPublic: boolean;
  // @NoRole(): authenticated but without a specific role — the RoleGuard SKIPS
  // it (like @Public), so these routes don't need an entry in route.yaml.
  isNoRole: boolean;
}

// Routes marked @Public in controllers — must never return 401.
// When the route has path params, set testUrl to a concrete URL (params normalized to 0).
const PUBLIC_ROUTES: PublicRoute[] = [
  { method: 'GET', url: '/' },
  { method: 'GET', url: '/health' },
  { method: 'GET', url: '/setting/initial' },
  { method: 'GET', url: '/setting/group' },
  { method: 'GET', url: '/install' },
  { method: 'POST', url: '/auth/login' },
  { method: 'POST', url: '/auth/forgot' },
  { method: 'GET', url: '/core/pdf/example' },
  // @Public but require a valid token/id — return 400 (not 401) with a dummy value
  { method: 'GET', url: '/file/open/:token', testUrl: '/file/open/0' },
  { method: 'GET', url: '/file/download/:token', testUrl: '/file/download/0' },
  { method: 'GET', url: '/file/image/:id', testUrl: '/file/image/0' },
];

// ---------------------------------------------------------------------------
// YAML helpers
// ---------------------------------------------------------------------------

function loadProtectedRoutes(): RouteEntry[] {
  const libsDir = path.resolve(__dirname, '../../../libraries');
  const routes: RouteEntry[] = [];

  for (const lib of fs.readdirSync(libsDir)) {
    const file = path.join(libsDir, lib, 'hedhog/data/route.yaml');
    if (!fs.existsSync(file)) continue;
    const entries = yaml.load(fs.readFileSync(file, 'utf8')) as RouteEntry[];
    if (Array.isArray(entries)) {
      routes.push(
        ...entries
          .filter((r) => r.type === 'HTTP' || !r.type)
          .map((r) => ({ url: r.url, method: r.method })),
      );
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Controller scanning helpers
// ---------------------------------------------------------------------------

function findControllerFiles(): string[] {
  const roots = [
    path.resolve(__dirname, '../../../libraries'),
    path.resolve(__dirname, '../../../packages'),
    path.resolve(__dirname, '../src'),
  ];
  const files: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
        files.push(full);
      }
    }
  }

  for (const root of roots) walk(root);
  return files;
}

// Parses a single controller file and returns every HTTP route found.
// Handles multiple @Controller classes within the same file.
// Assumptions (valid for this codebase):
//   - Prefixes are string literals, never variables or template literals.
//   - @Public() always appears on its own line immediately before the target decorator.
function parseControllerFile(filePath: string): ControllerRoute[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const routes: ControllerRoute[] = [];

  // Find every @Controller occurrence and treat each as a separate block.
  const controllerRegex = /@Controller\(['"`]?([^'"`\)]*?)['"`]?\)/g;
  const controllerPositions: Array<{ pos: number; prefix: string }> = [];
  let cm: RegExpExecArray | null;
  while ((cm = controllerRegex.exec(content)) !== null) {
    controllerPositions.push({ pos: cm.index, prefix: cm[1] ?? '' });
  }

  for (let ci = 0; ci < controllerPositions.length; ci++) {
    const { pos, prefix } = controllerPositions[ci];
    const end =
      ci < controllerPositions.length - 1
        ? controllerPositions[ci + 1].pos
        : content.length;

    // Check if @Public()/@NoRole() appears in the few lines directly before @Controller.
    const before = content.substring(Math.max(0, pos - 160), pos);
    const beforeLines = before.split('\n').slice(-5).map((l) => l.trim());
    const classPublic = beforeLines.some((l) => l === '@Public()');
    const classNoRole = beforeLines.some((l) => l === '@NoRole()');

    const block = content.substring(pos, end).split('\n');
    let pendingPublic = false;
    let pendingNoRole = false;

    for (const line of block) {
      const trimmed = line.trim();

      if (trimmed === '@Public()') {
        pendingPublic = true;
        continue;
      }

      if (trimmed === '@NoRole()') {
        pendingNoRole = true;
        continue;
      }

      const httpMatch = trimmed.match(
        /^@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`\)\s]*)['"`]?\s*\)/i,
      );
      if (httpMatch) {
        const method = httpMatch[1].toUpperCase();
        const routePath = httpMatch[2] ?? '';
        const parts = [prefix, routePath].filter(Boolean);
        const url = ('/' + parts.join('/')).replace(/\/+/g, '/') || '/';

        routes.push({
          file: filePath,
          method,
          url,
          isPublic: classPublic || pendingPublic,
          isNoRole: classNoRole || pendingNoRole,
        });
        pendingPublic = false;
        pendingNoRole = false;
        continue;
      }

      // Non-decorator line resets the pending flags.
      if (trimmed && !trimmed.startsWith('@') && !trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed !== '{') {
        pendingPublic = false;
        pendingNoRole = false;
      }
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function normalizeUrl(url: string): string {
  return url.replace(/:[\w]+/g, '0');
}

const SERVER_NOT_RUNNING_MSG =
  `\n\n  ╔══════════════════════════════════════════════════════════╗\n` +
  `  ║  API server is not running at ${BASE_URL.padEnd(28)}║\n` +
  `  ║                                                          ║\n` +
  `  ║  Start it in another terminal before running this suite: ║\n` +
  `  ║                                                          ║\n` +
  `  ║    pnpm --filter api dev                                 ║\n` +
  `  ║                                                          ║\n` +
  `  ╚══════════════════════════════════════════════════════════╝\n`;

async function assertServerRunning(): Promise<void> {
  try {
    await makeRequest('GET', '/health');
  } catch {
    throw new Error(SERVER_NOT_RUNNING_MSG);
  }
}

async function makeRequest(method: string, url: string) {
  const agent = request(BASE_URL);
  switch (method.toUpperCase()) {
    case 'GET':    return agent.get(url);
    case 'POST':   return agent.post(url);
    case 'PUT':    return agent.put(url);
    case 'PATCH':  return agent.patch(url);
    case 'DELETE': return agent.delete(url);
    default:       return agent.get(url);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Smoke Test — Unauthenticated', () => {
  const publicSet = new Set(PUBLIC_ROUTES.map((r) => `${r.method}:${r.url}`));
  const allYamlRoutes = loadProtectedRoutes();
  const protectedRoutes = allYamlRoutes.filter((r) => !publicSet.has(`${r.method}:${r.url}`));

  const controllerFiles = findControllerFiles();
  const allControllerRoutes: ControllerRoute[] = [];
  for (const file of controllerFiles) {
    allControllerRoutes.push(...parseControllerFile(file));
  }

  it('protected routes return 401 without auth', async () => {
    await assertServerRunning();
    const failures: string[] = [];
    let count401 = 0;
    let count404 = 0;

    for (const { url, method } of protectedRoutes) {
      let status: number;
      try {
        const res = await makeRequest(method, normalizeUrl(url));
        status = res.status;
      } catch {
        status = 0;
      }

      // 401 → correctly rejected by auth guard
      // 404 → route not active in this API version; not a security risk
      if (status === 401) {
        count401++;
      } else if (status === 404) {
        count404++;
      } else {
        failures.push(`  ${method} ${url} → ${status || 'ECONNREFUSED'}`);
      }
    }

    console.log(
      `\n  [protected] ${protectedRoutes.length} routes tested` +
        ` — ${count401} returned 401` +
        ` | ${count404} returned 404 (not active in API)` +
        (failures.length ? ` | ${failures.length} unexpected` : ''),
    );

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} route(s) did not return 401 or 404:\n${failures.join('\n')}`,
      );
    }
  }, 60000);

  it('public routes are accessible without auth (not 401)', async () => {
    await assertServerRunning();
    const failures: string[] = [];
    let countOk = 0;

    for (const route of PUBLIC_ROUTES) {
      const url = route.testUrl ?? route.url;
      let status: number;
      try {
        const res = await makeRequest(route.method, url);
        status = res.status;
      } catch {
        status = 0;
      }

      if (status === 401) {
        failures.push(`  ${route.method} ${url} → 401 (should be public)`);
      } else if (status === 0) {
        failures.push(`  ${route.method} ${url} → ECONNREFUSED`);
      } else {
        countOk++;
      }
    }

    console.log(
      `\n  [public] ${PUBLIC_ROUTES.length} routes tested` +
        ` — ${countOk} accessible` +
        (failures.length ? ` | ${failures.length} failed` : ''),
    );

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} public route(s) failed:\n${failures.join('\n')}`,
      );
    }
  }, 60000);

  it('all non-public controller routes are registered in route.yaml', () => {
    const yamlRouteSet = new Set([
      ...allYamlRoutes.map((r) => `${r.method}:${r.url}`),
      ...PUBLIC_ROUTES.map((r) => `${r.method}:${r.url}`),
    ]);

    const publicCount = allControllerRoutes.filter((r) => r.isPublic).length;
    const noRoleCount = allControllerRoutes.filter((r) => r.isNoRole && !r.isPublic).length;
    const protectedCount = allControllerRoutes.filter((r) => !r.isPublic && !r.isNoRole).length;

    // @Public and @NoRole are skipped by the RoleGuard → they don't need route.yaml.
    const unregistered = allControllerRoutes.filter(
      (r) => !r.isPublic && !r.isNoRole && !yamlRouteSet.has(`${r.method}:${r.url}`),
    );

    console.log(
      `\n  [controller coverage] ${allControllerRoutes.length} routes found in ${controllerFiles.length} files` +
        ` — ${publicCount} @Public | ${noRoleCount} @NoRole | ${protectedCount} protected` +
        ` | ${unregistered.length} not in any route.yaml`,
    );

    if (unregistered.length > 0) {
      const details = unregistered
        .map((r) => `  ${r.method} ${r.url}  (${path.basename(r.file)})`)
        .join('\n');
      throw new Error(
        `${unregistered.length} protected route(s) not registered in any route.yaml:\n${details}`,
      );
    }
  });

  it('all route.yaml entries have a matching controller route', () => {
    const controllerRouteSet = new Set([
      ...allControllerRoutes.map((r) => `${r.method}:${r.url}`),
      ...PUBLIC_ROUTES.map((r) => `${r.method}:${r.url}`),
    ]);

    const orphaned = allYamlRoutes.filter(
      (r) => !controllerRouteSet.has(`${r.method}:${r.url}`),
    );

    console.log(
      `\n  [yaml coverage] ${allYamlRoutes.length} yaml routes checked` +
        ` — ${orphaned.length} without a matching controller`,
    );

    if (orphaned.length > 0) {
      const details = orphaned
        .map((r) => `  ${r.method} ${r.url}`)
        .join('\n');
      throw new Error(
        `${orphaned.length} route(s) in route.yaml have no matching controller:\n${details}`,
      );
    }
  });
});
