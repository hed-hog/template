# Testing the API Locally

> This file covers the **local setup for the API's E2E tests** (live server).
> The full testing base guide (backend/frontend unit tests, coverage,
> thresholds, Playwright, CI) is at [docs/testing.md](docs/testing.md).

## Quick Setup

### 1. Make sure PostgreSQL is running

```powershell
docker compose up -d postgres redis
```

### 2. Configure .env (apps/api/.env)

```env
DATABASE_URL=postgresql://hedhog:changeme@localhost:5444/hedhog
# `pnpm init:env` generates these on first run. To regenerate one by hand:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
JWT_SECRET=<generate-me>
JWT_EXPIRES_IN=7d
PEPPER=<generate-me>
ENCRYPTION_SECRET=<generate-me>
CORS_ALLOWED_ORIGINS=http://localhost:3200
```

(User/port/database come from `docker-compose.yaml`: `hedhog` / `5444` / `hedhog`.)

### 3. Generate Prisma Client and apply migrations

```powershell
cd apps/api
pnpm prisma generate
pnpm prisma:deploy
```

### 4. Start the server (Terminal 1)

```powershell
# DISABLE_RATE_LIMIT prevents 429s from the /auth rate limit during the E2E suite
# (which performs many logins in a row). NEVER use in production.
$env:DISABLE_RATE_LIMIT = "true"
cd apps/api
pnpm dev
```

### 5. Call /install (Terminal 2 - after the server starts)

```powershell
$body = @{
    appName = "HedHog"
    slogan = "Administration Panel"
    userName = "Root User"
    email = "root@hedhog.com"
    password = "changeme"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3100/install" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

### 6. Run tests (Terminal 2)

```powershell
cd apps/api
$env:API_URL = "http://localhost:3100"
pnpm test:e2e                                  # entire E2E suite
pnpm test:e2e --testPathPattern=contract       # contract only (response shapes)
pnpm test:e2e --testPathPattern=security       # security only (headers/authz)
pnpm test:endpoints                            # all-endpoints only (401/public/drift)
```

## Testing the bootstrap before pushing

Everything above tests **this checkout**. It does not answer the question that
matters for a template repo: _does `hedhog new` still produce a working project
from the current code?_

```powershell
pnpm test:bootstrap
```

[`test/smoke-bootstrap.ps1`](test/smoke-bootstrap.ps1) runs the real `hedhog new`
(which internally already runs `hedhog add core`) and then walks the same
sequence as [`ci.yml`](.github/workflows/ci.yml): `build:libs` → unit tests →
`nest build` + `copy:core-assets` → `prisma:deploy` → `start:prod` → `/health` →
`POST /install` → `pnpm test:e2e`.

### Why a plain `hedhog new` is not enough

The CLI clones a hardcoded URL — `https://github.com/hed-hog/template.git` —
with no flag for a branch, a local path, or an alternate template. Run bare, it
validates what is **already on GitHub**, which is exactly the code you have not
pushed yet.

The script redirects that clone to your local working copy using git's
`insteadOf`, supplied through environment variables:

```text
GIT_CONFIG_COUNT=1
GIT_CONFIG_KEY_0=url.<repo-path>.insteadOf
GIT_CONFIG_VALUE_0=https://github.com/hed-hog/template.git
```

The CLI spawns git with `env: { ...process.env }`, so the child inherits it. The
script asserts the redirect resolved to your local `HEAD` before doing any work,
and aborts rather than silently testing the wrong code.

### It cannot dirty the repo

- The generated project lives **outside** the repo, under
  `%LOCALAPPDATA%\Temp\hedhog-smoke\<timestamp>`, and is removed at the end
  (`-KeepSandbox` keeps it).
- The redirect is process-scoped: no `git config` is ever written, `.git/config`
  is untouched, and cloning from a local path is read-only on the source.
- Postgres and Redis come from
  [`test/docker-compose.smoke.yaml`](test/docker-compose.smoke.yaml) on ports
  55432/56379 under the separate compose project `hedhog-smoke`, so `down -v`
  can never reach your dev containers on 5444/6379.
- The script ends by asserting `git status --porcelain` is still clean.

### Flags

| Flag             | Effect                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `-AllowDirty`    | Proceed with a dirty tree (uncommitted changes are **not** tested — only `HEAD` is cloned) |
| `-SkipUnitTests` | Skip `pnpm turbo run test`, the longest step                                               |
| `-KeepSandbox`   | Keep the generated project for inspection                                                  |
| `-ApiPort <n>`   | Serve on a port other than 3100                                                            |

Only the committed `HEAD` is cloned, so the script refuses to run on a dirty tree
unless you pass `-AllowDirty`. Commit first, test, then push.

## Testing with act-cli

### Install act

```powershell
winget install nektos.act
```

### Run workflow locally

```powershell
# List jobs
act -l

# Run workflow
act push

# NOTE: Services (PostgreSQL) may not work perfectly in act
# It is recommended to use the local docker-compose PostgreSQL
```

## Test Structure

The E2E tests run against a **running server**; they do not initialize the AppModule directly.

- `auth.e2e-spec.ts` — login/refresh (cookie and body), invalid credentials
- `app.e2e-spec.ts` / `health.e2e-spec.ts` — health check
- `locale.e2e-spec.ts` — /locale
- `settings.e2e-spec.ts` — /setting/initial
- `all-endpoints.e2e-spec.ts` — protected routes → 401; `@Public` → never 401; bidirectional
  drift between controllers ↔ `route.yaml` (`@NoRole` is recognized and does not require route.yaml)
- `contract.e2e-spec.ts` — responses validated against the shared zod schemas
  (`@hed-hog/api-types`): pagination envelope and error format
- `security.e2e-spec.ts` — live helmet headers + positive/negative authz

> **Note:** the `/auth` credential endpoints are rate-limited (10/min per IP).
> The full E2E suite exceeds this — which is why step 4 uses `DISABLE_RATE_LIMIT=true`
> (the 429 mechanism is covered by `apps/api/src/security/throttler.spec.ts`).

## Unit tests (no server)

```powershell
pnpm turbo run test        # full gate: 18 packages (backend Jest + frontend Vitest)
pnpm --filter api test     # API only
pnpm --filter admin test   # admin only (Vitest, with coverage)
```

Coverage/threshold details, Playwright, and CI: [docs/testing.md](docs/testing.md).

## Troubleshooting

### Error: Prisma schema validation

Remove quotes from DATABASE_URL in .env:

```env
# ❌ Wrong
DATABASE_URL="postgresql://..."

# ✅ Correct
DATABASE_URL=postgresql://...
```

### Error: RuntimeException when initializing AppModule

The tests were updated to not initialize the AppModule.
They now run against the running server.

### Server does not start

```powershell
# Check whether port 3100 is in use
Get-NetTCPConnection -LocalPort 3100

# Kill the process on that port
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3100).OwningProcess -Force
```
