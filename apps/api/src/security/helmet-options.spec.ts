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

// Bootstrapa um app Nest mínimo com AS MESMAS opções de helmet do main.ts e
// verifica que os headers de segurança são aplicados — regressão para o caso de
// alguém afrouxar/remover a config de helmet.
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

  it('aplica headers de segurança e remove X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/ping');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    // CORP liberado para cross-origin (front carrega arquivos servidos pela API).
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});
