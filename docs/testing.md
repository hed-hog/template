# Automated Testing — HedHog Lab v2

Guide to the monorepo's testing foundation: what exists, how to run each layer, and how
the contract between API and frontend is protected. For the quick local e2e setup of the
API (docker-compose + `.env`), also see [TESTING.md](../TESTING.md).

---

## 1. Strategy — the testing pyramid

| Layer                         | What it guarantees                                         | Tool                                      | Where                             |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------- | --------------------------------- |
| **Contract** (single source)  | Pagination envelope + error format identical on both sides | **zod** in `@hed-hog/api-types/contracts` | back (e2e) + front (Vitest)       |
| **Unit — backend**            | Services/subscribers do not regress                        | **Jest + ts-jest**                        | `apps/api/src`, `libraries/*/src` |
| **Unit/component — frontend** | Hooks and components do not regress                        | **Vitest + Testing Library**              | `apps/admin/src`                  |
| **E2E — API**                 | Routes respond with correct auth and shape                 | **Jest + supertest** (live server)        | `apps/api/test`                   |
| **Typecheck**                 | No type errors                                             | `tsc --noEmit`                            | apps                              |
| **Gate (CI)**                 | Everything above runs on every PR                          | **GitHub Actions + Turbo**                | .github/workflows                 |

---

## 2. Current state (base template)

This template ships with two apps (`admin`, `api`) and no library installed —
`libraries/` is only created and populated by the CLI (`hedhog dev create-library`).
The counts below grow as libraries are added to the project.

**Backend (Jest):** `apps/api/src` has specs for the app-shell modules
(`cors`, `filters`, `security`, `language`). Each installed library brings its
own specs in `libraries/<library>/src`.

**Coverage with gate:** `collectCoverage` is enabled on `api`; adjust
`coverageThreshold` as libraries are installed and gain specs.

**Frontend (Vitest + Testing Library + MSW):** shared config in
`@hed-hog/vitest-config`. `admin` covers the provider (interceptors, 401 refresh,
403/forbidden, logout, login), utils, and generic components
(`PaginationFooter`, `SearchBar`, `ViewModeToggle`, `FileTypeIcon`).

**App E2E (Playwright):** `apps/admin/e2e` includes a minimal smoke test
(`smoke.spec.ts` + `auth.setup.ts`) that works on a fresh checkout: login and
home loading without redirecting to `/login`. When installing a library, add
a dedicated spec covering its real routes (pattern: `expectPageLoads` from
`apps/admin/e2e/support.ts`). Requires a live app + API + browsers. Runs
automated (nightly + manual) in [`ci-e2e.yml`](../.github/workflows/ci-e2e.yml).

**API E2E (supertest, live server):** `apps/api/test/*.e2e-spec.ts` —
`auth`, `health`, `settings`, `all-endpoints` (401/public/route.yaml drift,
recognizes `@NoRole`), `contract` (shapes against the zod schemas), `security`
(helmet headers + authz). Run with `DISABLE_RATE_LIMIT=true` on the server
(see §5 and [TESTING.md](../TESTING.md)).

---

## 3. How to run (Windows / PowerShell)

### Everything at once (the gate)

```powershell
pnpm turbo run test        # all unit tests (Jest + Vitest)
pnpm turbo run typecheck   # tsc --noEmit on api/admin (+ installed libraries)
pnpm turbo run lint        # eslint across all workspaces
```

### Per package

```powershell
pnpm --filter api test                 # backend unit tests (NestJS)
pnpm --filter <library> test           # unit tests of an installed library
pnpm --filter admin test               # admin frontend (Vitest)
pnpm --filter admin test:watch         # Vitest in watch mode
```

### A single file / a single test

```powershell
pnpm --filter api exec jest src/cors                    # a single file
pnpm --filter admin exec vitest run use-pagination-fetch
```

---

## 4. Contract layer (single source of truth)

The place where the API tends to "silently break the frontend" is the **shape of
responses** — the pagination envelope and error format used to be re-declared by
hand in each hook. Now there is a single source in zod:

- [`packages/api-types/src/contracts/pagination.ts`](../packages/api-types/src/contracts/pagination.ts)
  → `paginationEnvelope(itemSchema)`, `anyPaginationEnvelope`, type `PaginationEnvelope<T>`
- [`packages/api-types/src/contracts/error.ts`](../packages/api-types/src/contracts/error.ts)
  → `apiErrorSchema`, type `ApiError`

Re-exported from the main entry point:

```ts
import {
  paginationEnvelope,
  apiErrorSchema,
  type PaginationEnvelope,
} from '@hed-hog/api-types';
```

**Who consumes it today:**

- Front: [`use-pagination-fetch.ts`](../apps/admin/src/hooks/use-pagination-fetch.ts) uses `PaginationEnvelope<T>` instead of re-declaring it.
- Back (e2e): [`contract.e2e-spec.ts`](../apps/api/test/contract.e2e-spec.ts) validates real responses against the schemas.
- Front (unit): [`use-pagination-fetch.test.ts`](../apps/admin/src/hooks/use-pagination-fetch.test.ts) validates the fixture against the same schema.

> When changing a contract, change **only** the zod schema and run `pnpm --filter @hed-hog/api-types build`. Both sides then see the change.

### Runtime smoke test (no server)

```powershell
pnpm --filter @hed-hog/api-types build
cd packages/api-types
node -e "const {paginationEnvelope}=require('./dist');const z=require('zod');const P=paginationEnvelope(z.object({id:z.number()}));console.log('valido:',P.safeParse({data:[{id:1}],total:1,lastPage:1,page:1,pageSize:10,prev:null,next:null}).success);console.log('invalido:',P.safeParse({data:[{id:1}],total:'x',lastPage:1,page:1,pageSize:10,prev:null,next:null}).success)"
```

Expected: `valido: true` / `invalido: false`.

---

## 5. API E2E test (live server)

The specs in `apps/api/test/*.e2e-spec.ts` hit `API_URL` over HTTP
(supertest); they **do not** bootstrap the `AppModule`. They require Postgres + Redis + the
API running + seeding via `/install`.

```powershell
# 1. Infra
docker-compose up -d

# 2. Server (terminal 1) — make sure apps/api/.env is set (see TESTING.md)
#    DISABLE_RATE_LIMIT=true prevents the /auth rate limit from blocking the suite
#    (which performs many logins in a row). Production must NOT set this flag.
$env:DISABLE_RATE_LIMIT="true"; cd apps/api; pnpm dev

# 3. Seed + tests (terminal 2)
Invoke-WebRequest -Uri "http://localhost:3100/install" -Method POST -ContentType "application/json" `
  -Body '{"appName":"HedHog","slogan":"Panel","userName":"Root","email":"root@hedhog.com","password":"changeme"}'
$env:API_URL="http://localhost:3100"
pnpm --filter api test:e2e                               # the whole e2e suite
pnpm --filter api test:e2e --testPathPattern=contract    # just the contract test
pnpm --filter api test:endpoints                         # just all-endpoints (authz/drift)
```

**What `all-endpoints.e2e-spec.ts` already validates** (cross-checking `route.yaml` against the
controllers): protected routes → 401 without a token; `@Public` routes → never 401;
bidirectional drift (controller without `route.yaml` and vice versa).

**What `contract.e2e-spec.ts` validates:** error responses match
`apiErrorSchema`; list endpoints that return `data` match the pagination
envelope.

---

## 5b. App E2E test (Playwright)

Config in `apps/admin` ([playwright.config.ts](../apps/admin/playwright.config.ts),
`apps/admin/e2e/`). Requires the **app + API to be live** (Next's dev server proxies
`/api` → `:3100`), a seeded user, and Playwright's browsers.

```powershell
# once: download the browser
pnpm --filter admin exec playwright install chromium

# infra + API (see §5) must be running; then:
pnpm --filter admin test:e2e            # starts `pnpm dev` for admin and runs the specs
pnpm --filter admin exec playwright test --list   # list only (validates config, without running)
```

The `setup` project (`e2e/auth.setup.ts`) logs in once and persists the storageState;
`smoke.spec.ts` exercises the minimal flow that works on a fresh checkout of the
template (with no library installed): login and the `/` home loading without
redirecting to `/login`. Variables: `E2E_EMAIL`, `E2E_PASSWORD`,
`E2E_BASE_URL` (point to an already running server and the webServer is disabled).

When installing a library, add a dedicated spec per module covering its real
routes, using the same generic `expectPageLoads` helper (`support.ts`):
navigate, confirm it did not land on `/login`, and that `getByRole('main').first()`
becomes visible — without asserting the specific heading of each screen, since most
routes use the same `entity-list`/`PageHeader` component (the title comes from
per-module config, not per-page). URLs can be extracted from the library's
`hedhog/data/menu.yaml` (the real source for the sidebar, via `GET
/menu/system`).

---

## 6. CI (GitHub Actions)

### [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — on every PR/push

Requires no database: builds the libs and generates the Prisma client from the
committed `schema.prisma`. Steps: `install` → `build:libs` → **`test` (mandatory
gate)** → `lint` and `typecheck` (_report-only_).

> **Why report-only?** There is pre-existing lint/type debt. Once it is
> cleared, remove `continue-on-error` from the lint/typecheck steps in
> `ci.yml` to make them blocking.

### [`.github/workflows/ci-e2e.yml`](../.github/workflows/ci-e2e.yml) — nightly + manual

Starts Postgres 17 + Redis, applies migrations, seeds via `/install`, starts the API, and
runs `test:e2e`. Starts as `workflow_dispatch` + scheduled (does not block PRs)
until it stabilizes; it can later move to `pull_request`.

### [`.github/workflows/security.yml`](../.github/workflows/security.yml) — PR/push + weekly

`pnpm audit --audit-level=high` (_report-only_ — there is pre-existing debt,
mostly in transitive tooling) + **CodeQL** (JS/TS) for static analysis.

---

## 7. Proving the contract catches breakages

The best validation is watching the test turn **red** when the contract is broken
on purpose:

1. In [`pagination.ts`](../packages/api-types/src/contracts/pagination.ts),
   add a required field to `paginationEnvelope` (e.g., `hasMore: z.boolean()`).
2. Run:
   ```powershell
   pnpm --filter @hed-hog/api-types build
   pnpm --filter admin test
   ```
3. The frontend test fails (the fixture no longer satisfies the schema) — proving that
   the shape change is caught **before** it reaches the app. The E2E test would break the
   same way, since the real responses would not have the field.
4. Revert the edit.

---

## 7b. Security (hardening + tests)

**Hardening applied (with tests):**

- **helmet** ([main.ts](../apps/api/src/main.ts) + [helmet-options.ts](../apps/api/src/security/helmet-options.ts)):
  security headers + removes `X-Powered-By`. Conservative config (no CSP;
  CORP `cross-origin` so the frontend can load files from the API). Unit test for
  headers + assertion in the security E2E.
- **rate limit on `/auth`** ([auth.controller.ts](../libraries/core/src/auth/auth.controller.ts)):
  `@UseGuards(ThrottlerGuard)` + `@Throttle` (10/min per IP) on the credential
  verification endpoints (login, login-email-verification, login-code,
  login-recovery-code). 429 test. The limit accommodates the auth E2E suite (which
  performs several logins) — it can be lowered for stricter rigor by adjusting the tests.
- **no error leaking** ([http-exception.filter.ts](../apps/api/src/filters/http-exception.filter.ts)):
  a generic error (500) no longer exposes internal `message`/`name` to the client (the
  full log is preserved). Unit test.

**Security tests:** [security.e2e-spec.ts](../apps/api/test/security.e2e-spec.ts)
(live headers, positive/negative authz) and [all-endpoints.e2e-spec.ts](../apps/api/test/all-endpoints.e2e-spec.ts)
(protected → 401, `@Public` → never 401, route.yaml↔controller drift).

**Proposal — `ValidationPipe` whitelist (not applied):** today the
[ValidationPipe](../apps/api/src/main.ts) does not use `whitelist`, so unknown
properties pass through (mass-assignment surface). Recommendation:
`new ValidationPipe({ transform: true, whitelist: true })` to **strip** fields
not declared in the DTOs. It was not applied because it changes the parsing of **every**
request and could affect endpoints that rely on fields outside the DTO (e.g., those that
read raw `@Query`) — requires a sweep + validation before enabling it. `forbidNonWhitelisted`
(reject instead of stripping) is even stricter and should come afterward.

**Future security coverage:** a full authz-by-role matrix driven
by `route.yaml` and tenant isolation / IDOR (`resolveEnterpriseId`) — these require
a seeded multi-role/multi-tenant fixture.

---

## 8. Where tests live

```
apps/api/
  src/**/*.spec.ts            # unit (Jest) — jest.config.ts
  test/*.e2e-spec.ts          # e2e (supertest) — test/jest-e2e.json
apps/admin/
  src/**/*.test.{ts,tsx}      # front (Vitest) — vitest.config.ts
  e2e/support.ts              # generic expectPageLoads helper (e2e)
  e2e/*.spec.ts               # e2e (Playwright) — playwright.config.ts, 1 file/module
libraries/<lib>/
  src/**/*.spec.ts            # unit (Jest) — jest.config.ts + tsconfig.spec.json
packages/api-types/
  src/contracts/*.ts          # shared zod schemas
```

Shared Jest config: `@hed-hog/jest-config` (`base`/`nest`/`next`).
Shared Vitest config: `@hed-hog/vitest-config` (`react` + `setup` with
MSW and jest-dom).

---

## 9. Roadmap (next phases)

Already delivered: **Phase 0** (CI foundation, green specs, typecheck), **Phase 1**
(contract layer), **Phase 2** (robust frontend: shared Vitest config,
provider interceptors via MSW, hooks, component, and minimal Playwright
scaffold) and **Phase 3** (hardening: helmet, rate limit on `/auth`, no error
leaking; `pnpm audit` + CodeQL scanning — see §7b). Pending:

- **Phase 2 (remaining):** Playwright already runs end-to-end against the live stack,
  wired into CI (`ci-e2e.yml`, nightly + manual, `admin` matrix), currently with a
  minimal smoke test (see §5b). As libraries are installed: add specs
  per module covering their real routes; cover real mutation flows
  (create/edit/delete, with cleanup) — today every spec is deliberately
  read-only; expand component tests for the `entity-list` primitives.
- **Phase 3 (remaining):** full authz-by-role matrix driven by
  `route.yaml`; tenant isolation / IDOR (`resolveEnterpriseId`) with a
  multi-tenant fixture; evaluate/apply the `ValidationPipe` whitelist (§7b).
- **Phase 4 — Continuous quality:** husky + lint-staged; coverage thresholds;
  decide on the 21 orphaned composite actions in `.github/actions/`.
