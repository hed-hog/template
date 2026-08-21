import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Controller, Post } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

// Reproduz a mesma proteção aplicada aos endpoints de credencial do /auth
// (@UseGuards(ThrottlerGuard) + @Throttle) e verifica que estourar o limite por
// IP resulta em 429 — regressão para o formato da config do rate-limit.
@Controller('login-like')
class LoginLikeController {
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Post()
  login() {
    return { ok: true };
  }
}

describe('Rate-limit (ThrottlerGuard) nos endpoints de credencial', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
      controllers: [LoginLikeController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloqueia com 429 após exceder o limite por IP', async () => {
    const server = app.getHttpServer();

    expect((await request(server).post('/login-like')).status).toBe(201);
    expect((await request(server).post('/login-like')).status).toBe(201);
    // 3ª tentativa dentro da janela → limite (2) excedido.
    expect((await request(server).post('/login-like')).status).toBe(429);
  });
});
