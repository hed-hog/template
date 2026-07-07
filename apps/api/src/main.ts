import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { helmetOptions } from './security/helmet-options';
import {
  getCorsDomains,
  getCorsOrigins,
  isCorsOriginAllowed,
  normalizeOrigin,
} from './cors/cors-origin';
import { HttpExceptionFilter } from './filters/http-exception.filter';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    // 'debug' and 'verbose' turned off for now to reduce console noise.
    logger: ['error', 'warn', 'log', 'fatal'],
  });

  // Backward compatibility: accept both '/resource' and '/api/resource'.
  app.use((req: any, _res: any, next: any) => {
    const rewritten = String(req.url ?? '').replace(/^\/api(?=\/|$)/, '');
    if (rewritten !== req.url) {
      req.url = rewritten.startsWith('?') ? `/${rewritten}` : rewritten || '/';
    }
    return next();
  });

  // Security headers (nosniff, X-Frame-Options, HSTS, etc.) and removal of
  // X-Powered-By. Config in ./security/helmet-options (shared with the tests).
  app.use(helmet(helmetOptions));

  // Body size limit: this template has no `core` library (and its
  // settings-driven `api-body-size-limit`) installed, so it's configured via
  // env var instead, same convention as CORS below.
  const bodySizeLimitMb = Number(process.env.API_BODY_SIZE_LIMIT_MB ?? 50);

  app.use(
    express.json({ limit: `${bodySizeLimitMb}mb` }),
    express.urlencoded({ limit: `${bodySizeLimitMb}mb`, extended: true })
  );

  const corsOrigins = getCorsOrigins();
  const corsDomains = getCorsDomains();

  if (
    process.env.NODE_ENV === 'production' &&
    corsDomains.length === 0 &&
    corsOrigins.every((origin) => origin.includes('localhost'))
  ) {
    bootstrapLogger.warn(
      'CORS is using localhost defaults in production. Configure CORS_ALLOWED_ORIGINS and/or CORS_ALLOWED_DOMAINS explicitly.'
    );
  }

  // Configure class-validator to use NestJS DI container
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Configure CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, false);
      }

      if (isCorsOriginAllowed(origin, { origins: corsOrigins, domains: corsDomains })) {
        return callback(null, normalizeOrigin(origin));
      }

      bootstrapLogger.warn(
        `CORS blocked request: origin=${normalizeOrigin(origin) || 'unknown'} allowedOrigins=${corsOrigins.join(', ') || '(none)'} allowedDomains=${corsDomains.join(', ') || '(none)'}; check CORS_ALLOWED_ORIGINS/CORS_ALLOWED_DOMAINS`
      );
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept-Language',
      'X-Requested-With',
      'X-Browser-ID',
    ],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  app.set('trust proxy', 1);

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.reduce(
          (acc, error) => {
            acc[error.property] = Object.values(error.constraints ?? {});
            return acc;
          },
          {} as Record<string, string[]>
        );
        return new BadRequestException({ message: messages });
      },
    })
  );

  // Enables lifecycle hooks (onModuleDestroy) on SIGTERM/SIGINT — required for graceful
  // draining of queue workers during autoscaling scale-down (stop picking up new jobs
  // and wait for in-flight ones before the pod shuts down).
  app.enableShutdownHooks();

  const port = process.env.PORT || 3100;

  await app.listen(port).then(() => {
    console.log('+++++++++++++++++++++++++++++++++++');
    console.log(
      `API server is running on \x1b[36mhttp://localhost:${port}\x1b[0m`
    );
    console.log(
      `CORS_ALLOWED_ORIGINS: \x1b[36m${corsOrigins.join(', ') || '(empty)'}\x1b[0m`
    );
    console.log(
      `CORS_ALLOWED_DOMAINS: \x1b[36m${corsDomains.join(', ') || '(empty)'}\x1b[0m`
    );
    console.log('+++++++++++++++++++++++++++++++++++');
  });
}
bootstrap();
