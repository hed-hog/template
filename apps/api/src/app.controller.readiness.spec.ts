import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

/**
 * Integração: os specs unitários chamam o handler direto e não provam que a rota
 * existe. Aqui sobe um app Nest de verdade para verificar o que a probe do kubelet
 * vai encontrar — o path `/health/ready` registrado e o status HTTP na resposta,
 * que sai de `@Res({ passthrough: true })` e não de uma exception (exception seria
 * reportada ao Sentry a cada probe).
 */
describe('GET /health/ready (integração)', () => {
  let app: INestApplication;

  const appService = {
    getReadiness: jest.fn<() => Promise<Record<string, string>>>(),
    getHealth: jest.fn<() => Promise<Record<string, unknown>>>(),
    getHello: jest.fn<() => Promise<Record<string, unknown>>>(),
  };

  beforeAll(async () => {
    appService.getHealth.mockResolvedValue({ status: 'ok', version: '1.2.3' });

    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: appService },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('responde 200 quando o banco responde', async () => {
    appService.getReadiness.mockResolvedValue({
      status: 'ok',
      database: 'up',
      version: '1.2.3',
    });

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('responde 503 com o corpo do diagnóstico quando o banco está fora', async () => {
    appService.getReadiness.mockResolvedValue({
      status: 'degraded',
      database: 'down',
      version: '1.2.3',
    });

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 'degraded', database: 'down' });
  });

  it('/health continua 200 com o banco fora — é o alvo de liveness e startup', async () => {
    appService.getReadiness.mockResolvedValue({
      status: 'degraded',
      database: 'down',
      version: '1.2.3',
    });

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
  });
});
