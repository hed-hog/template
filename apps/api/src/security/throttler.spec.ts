import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Controller, Post } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

// Reproduces the same protection applied to the /auth credential endpoints
// (@UseGuards(ThrottlerGuard) + @Throttle) and verifies that exceeding the
// per-IP limit results in 429 — a regression check for the rate-limit config shape.
@Controller('login-like')
class LoginLikeController {
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Post()
  login() {
    return { ok: true };
  }
}

describe('Rate-limit (ThrottlerGuard) on credential endpoints', () => {
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

  it('blocks with 429 after exceeding the per-IP limit', async () => {
    const server = app.getHttpServer();

    expect((await request(server).post('/login-like')).status).toBe(201);
    expect((await request(server).post('/login-like')).status).toBe(201);
    // 3rd attempt within the window → limit (2) exceeded.
    expect((await request(server).post('/login-like')).status).toBe(429);
  });
});
