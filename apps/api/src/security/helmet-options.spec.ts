import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import request from 'supertest';
import { helmetOptions } from './helmet-options';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

// Bootstraps a minimal Nest app with THE SAME helmet options as main.ts and
// verifies that the security headers are applied — a regression check in case
// someone loosens/removes the helmet config.
describe('helmet security headers', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(helmet(helmetOptions));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies security headers and removes X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/ping');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    // CORP relaxed for cross-origin (front-end loads files served by the API).
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});
