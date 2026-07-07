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
DATABASE_URL=postgresql://hub:changeme@localhost:5444/hub
JWT_SECRET=ZUZWNU1LM3ZtYkRHSzNHanZqcG1ab2sweDVSeDBBWGJPSGE3TGp5OTAzUQ==
JWT_EXPIRES_IN=7d
PEPPER=QWFLNW5pV21kUDlGb2NtZGJ5NWRmUQ==
ENCRYPTION_SECRET=RDBJYWY2UXZWQVVJeHJ2MDREWXQwVEJVQkp6am9qbzdGUFlmSUczQllyTQ==
CORS_ALLOWED_ORIGINS=http://localhost:3200
```

(User/port/database come from `docker-compose.yaml`: `hub` / `5444` / `hub`.)

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
