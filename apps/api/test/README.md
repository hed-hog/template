# API E2E Tests

This directory contains the API's end-to-end (E2E) tests using Supertest.

## Test Structure

The tests are organized by feature:

- **[app.e2e-spec.ts](app.e2e-spec.ts)** - General application tests
- **[health.e2e-spec.ts](health.e2e-spec.ts)** - Health check tests
- **[auth.e2e-spec.ts](auth.e2e-spec.ts)** - Authentication and authorization tests
- **[settings.e2e-spec.ts](settings.e2e-spec.ts)** - System settings tests
- **[locale.e2e-spec.ts](locale.e2e-spec.ts)** - Internationalization tests

## Running the Tests

### Locally

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests in watch mode
pnpm test:watch

# Run a specific file
pnpm test:e2e -- health.e2e-spec.ts
```

### In CI/CD (GitHub Actions)

Tests run automatically in the `.github/workflows/test.yaml` workflow when:
- There's a push to the `main` or `develop` branches
- There's a pull request targeting the `main` or `develop` branches

## Test Pattern

All tests follow this pattern:

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

## Adding New Tests

To add tests for a new feature:

1. Create a `feature.e2e-spec.ts` file in this directory
2. Follow the pattern above
3. Test success and failure scenarios
4. Test with and without authentication where applicable
5. Test input data validation

## Test Environment

The E2E tests use:
- **PostgreSQL 18 database** (via Docker in CI or locally)
- **Test environment variables** (defined in `.github/workflows/test.yaml`)
- **Prisma migrations** applied via `prisma:deploy`

## Test Credentials (CI)

```env
DATABASE_URL=postgresql://hedhog_test:test_password@localhost:5432/hedhog_test
JWT_SECRET=5fba2ef81e3121c215cb1a022ef0119e1b245c95a6c15640c06f4763cdc51626
ENCRYPTION_SECRET=RDBJYWY2UXZWQVVJeHJ2MDREWXQwVEJVQkp6am9qbzdGUFlmSUczQllyTQ==
```

## Best Practices

- Use `beforeAll` for one-time setup (faster than `beforeEach`)
- Always close the application in `afterAll`
- Test error cases (401, 400, 404, etc.)
- Validate response structure with `expect(res.body).toHaveProperty()`
- Group related tests with nested `describe`
- Use descriptive names for tests
