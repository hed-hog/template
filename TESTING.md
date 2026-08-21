# Testando API Localmente

> Este arquivo cobre o **setup local dos testes E2E da API** (servidor vivo).
> O guia completo da base de testes (unitários backend/frontend, cobertura,
> thresholds, Playwright, CI) está em [docs/testing.md](docs/testing.md).

## Setup Rápido

### 1. Certificar que PostgreSQL está rodando
```powershell
docker compose up -d postgres redis
```

### 2. Configurar .env (apps/api/.env)
```env
DATABASE_URL=postgresql://hub:changeme@localhost:5444/hub
JWT_SECRET=ZUZWNU1LM3ZtYkRHSzNHanZqcG1ab2sweDVSeDBBWGJPSGE3TGp5OTAzUQ==
JWT_EXPIRES_IN=7d
PEPPER=QWFLNW5pV21kUDlGb2NtZGJ5NWRmUQ==
ENCRYPTION_SECRET=RDBJYWY2UXZWQVVJeHJ2MDREWXQwVEJVQkp6am9qbzdGUFlmSUczQllyTQ==
CORS_ALLOWED_ORIGINS=http://localhost:3200
```

(Usuário/porta/banco vêm do `docker-compose.yaml`: `hub` / `5444` / `hub`.)

### 3. Gerar Prisma Client e aplicar migrations
```powershell
cd apps/api
pnpm prisma generate
pnpm prisma:deploy
```

### 4. Iniciar servidor (Terminal 1)
```powershell
# DISABLE_RATE_LIMIT evita 429 do rate-limit do /auth durante a suíte E2E
# (que faz muitos logins seguidos). NUNCA usar em produção.
$env:DISABLE_RATE_LIMIT = "true"
cd apps/api
pnpm dev
```

### 5. Chamar /install (Terminal 2 - após servidor iniciar)
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

### 6. Rodar testes (Terminal 2)
```powershell
cd apps/api
$env:API_URL = "http://localhost:3100"
pnpm test:e2e                                  # toda a suíte E2E
pnpm test:e2e --testPathPattern=contract       # só contrato (shapes de resposta)
pnpm test:e2e --testPathPattern=security       # só segurança (headers/authz)
pnpm test:e2e --testPathPattern=vaults-security  # matriz de authz/IDOR dos cofres
pnpm test:endpoints                            # só all-endpoints (401/públicas/drift)
```

## Testando com act-cli

### Instalar act
```powershell
winget install nektos.act
```

### Rodar workflow localmente
```powershell
# Listar jobs
act -l

# Rodar workflow
act push

# NOTA: Services (PostgreSQL) podem não funcionar perfeitamente no act
# Recomenda-se usar o PostgreSQL local do docker-compose
```

## Estrutura dos Testes

Os testes E2E testam contra um **servidor rodando**, não inicializam o AppModule diretamente.

- `auth.e2e-spec.ts` — login/refresh (cookie e body), credenciais inválidas
- `app.e2e-spec.ts` / `health.e2e-spec.ts` — health check
- `locale.e2e-spec.ts` — /locale
- `settings.e2e-spec.ts` — /setting/initial
- `all-endpoints.e2e-spec.ts` — protegidas → 401; `@Public` → nunca 401; drift
  bidirecional controllers ↔ `route.yaml` (`@NoRole` é reconhecido e não exige route.yaml)
- `contract.e2e-spec.ts` — respostas validadas contra os schemas zod compartilhados
  (`@hed-hog/api-types`): envelope de paginação e formato de erro
- `security.e2e-spec.ts` — headers do helmet ao vivo + authz positivo/negativo
- `vaults-security.e2e-spec.ts` — matriz de authz por papel de cofre
  (OWNER/ADMIN/EDITOR/READER/estranho) e isolamento entre cofres (IDOR).
  Provisiona 5 usuários dedicados `e2e-vaults-*@hedhog.com` com cripto real
  (~5 s de Argon2id no primeiro `beforeAll`) e é idempotente: reseta os keystores
  com `DELETE /crypto/me` antes de montar. **Rodar só contra banco de
  desenvolvimento/CI.** Sem servidor, os casos se pulam informando o motivo.
- `finance-reports.e2e-spec.ts` / `contact-reports.e2e-spec.ts` — relatórios
  (o login desses testes exige header `User-Agent`)

> **Nota:** os endpoints de credencial do `/auth` têm rate-limit (10/min por IP).
> A suíte E2E completa excede isso — por isso o passo 4 usa `DISABLE_RATE_LIMIT=true`
> (o mecanismo de 429 é coberto por `apps/api/src/security/throttler.spec.ts`).

## Testes unitários (sem servidor)

```powershell
pnpm turbo run test        # gate completo: 18 pacotes (backend Jest + frontend Vitest)
pnpm --filter api test     # só a API
pnpm --filter admin test   # só o admin (Vitest, com cobertura)
```

Detalhes de cobertura/thresholds, Playwright e CI: [docs/testing.md](docs/testing.md).

## Troubleshooting

### Erro: Prisma schema validation
Remova aspas do DATABASE_URL no .env:
```env
# ❌ Errado
DATABASE_URL="postgresql://..."

# ✅ Correto
DATABASE_URL=postgresql://...
```

### Erro: RuntimeException ao inicializar AppModule
Os testes foram atualizados para não inicializar o AppModule.
Eles agora testam contra o servidor rodando.

### Servidor não inicia
```powershell
# Verificar se porta 3100 está em uso
Get-NetTCPConnection -LocalPort 3100

# Matar processo na porta
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3100).OwningProcess -Force
```
