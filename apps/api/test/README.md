# API E2E Tests

Este diretório contém os testes end-to-end (E2E) da API usando Supertest.

## Estrutura de Testes

Os testes estão organizados por funcionalidade:

- **[app.e2e-spec.ts](app.e2e-spec.ts)** - Testes gerais da aplicação
- **[health.e2e-spec.ts](health.e2e-spec.ts)** - Testes de health check
- **[auth.e2e-spec.ts](auth.e2e-spec.ts)** - Testes de autenticação e autorização
- **[settings.e2e-spec.ts](settings.e2e-spec.ts)** - Testes de configurações do sistema
- **[locale.e2e-spec.ts](locale.e2e-spec.ts)** - Testes de internacionalização

## Executando os Testes

### Localmente

```bash
# Execute todos os testes E2E
pnpm test:e2e

# Execute testes com watch mode
pnpm test:watch

# Execute um arquivo específico
pnpm test:e2e -- health.e2e-spec.ts
```

### No CI/CD (GitHub Actions)

Os testes são executados automaticamente no workflow `.github/workflows/test.yaml` quando:
- Há push nas branches `main` ou `develop`
- Há pull request para as branches `main` ou `develop`

## Padrão de Testes

Todos os testes seguem este padrão:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Feature (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should test endpoint', () => {
    return request(app.getHttpServer())
      .get('/endpoint')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('property');
      });
  });
});
```

## Adicionando Novos Testes

Para adicionar testes de uma nova funcionalidade:

1. Crie um arquivo `feature.e2e-spec.ts` neste diretório
2. Siga o padrão acima
3. Teste cenários de sucesso e falha
4. Teste com e sem autenticação quando aplicável
5. Teste validação de dados de entrada

## Ambiente de Testes

Os testes E2E utilizam:
- **Banco de dados PostgreSQL 18** (via Docker no CI ou local)
- **Variáveis de ambiente de teste** (definidas em `.github/workflows/test.yaml`)
- **Migrations do Prisma** aplicadas via `prisma:deploy`

## Credenciais de Teste (CI)

```env
DATABASE_URL=postgresql://hedhog_test:test_password@localhost:5432/hedhog_test
JWT_SECRET=5fba2ef81e3121c215cb1a022ef0119e1b245c95a6c15640c06f4763cdc51626
ENCRYPTION_SECRET=RDBJYWY2UXZWQVVJeHJ2MDREWXQwVEJVQkp6am9qbzdGUFlmSUczQllyTQ==
```

## Boas Práticas

- Use `beforeAll` para setup único (mais rápido que `beforeEach`)
- Sempre feche a aplicação em `afterAll`
- Teste casos de erro (401, 400, 404, etc.)
- Valide estrutura de resposta com `expect(res.body).toHaveProperty()`
- Agrupe testes relacionados com `describe` aninhado
- Use nomes descritivos para os testes
