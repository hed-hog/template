import { PaginationService } from '@hed-hog/api-pagination';
import { PrismaService } from '@hed-hog/api-prisma';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Teto de espera pelo banco na readiness. Bem abaixo do `pool_timeout` de 20s do
 * Prisma (ver packages/api-prisma/datasource-url.ts) e do `timeoutSeconds: 5` da
 * probe: banco lento a este ponto já não serve request nenhuma.
 */
const READINESS_TIMEOUT_MS = 2000;

function getPackageVersion() {
  const packagePaths = [
    join(__dirname, '../package.json'),
    join(__dirname, '../../../../package.json'),
  ];

  const packagePath = packagePaths.find((path) => existsSync(path));

  return packagePath ? require(packagePath).version : '0.0.0';
}

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private readonly version = getPackageVersion();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly pagination: PaginationService
  ) {}

  onModuleInit() {
    const queue = this.getQueueHealth();
    this.logger.log(
      `Queue runtime profile: mode=${queue.mode}, enabled=${queue.workerEnabled}, databaseEnabled=${queue.databaseEnabled}, queues=${queue.allowedQueues.length > 0 ? queue.allowedQueues.join(',') : 'ALL'}`
    );
  }

  async getHealth() {
    return {
      status: 'ok',
      version: this.version,
      queue: this.getQueueHealth(),
    };
  }

  /**
   * Readiness: diferente de `getHealth`, ESTA consulta o banco. O pod só é útil
   * se alcança o Postgres — sem isso ele seguia `Ready` durante uma queda do banco,
   * recebia 100% do tráfego e devolvia 500 em toda request autenticada.
   *
   * Só a readinessProbe usa esta rota. Liveness e startup continuam em `/health`,
   * senão o kubelet reiniciaria a API inteira junto com o banco.
   */
  async getReadiness() {
    try {
      await this.checkDatabase();
      return { status: 'ok', database: 'up', version: this.version };
    } catch (error) {
      this.logger.error(
        `Readiness degradada: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { status: 'degraded', database: 'down', version: this.version };
    }
  }

  private async checkDatabase(): Promise<void> {
    const query = this.prismaService.$queryRaw`SELECT 1`;

    // Promise.race NÃO cancela a query perdedora: sem este catch, a rejeição que
    // chega depois do timeout vira unhandled rejection — e o SDK do Sentry roda
    // com onUnhandledRejectionIntegration em mode:'strict', que derruba o processo.
    query.catch(() => undefined);

    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        query,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  `database check timed out after ${READINESS_TIMEOUT_MS}ms`,
                ),
              ),
            READINESS_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async getHello() {
    return { version: this.version };
  }

  private getQueueHealth() {
    const workerEnabled = this.resolveBoolean(
      process.env.QUEUE_WORKER_ENABLED,
      false
    );
    const databaseEnabled = this.resolveBoolean(
      process.env.QUEUE_DATABASE_ENABLED,
      true
    );
    const allowedQueues = this.parseQueueNames(process.env.QUEUE_WORKER_NAMES);

    return {
      mode: workerEnabled ? 'worker-plane' : 'control-plane',
      workerEnabled,
      databaseEnabled,
      workerId: process.env.QUEUE_WORKER_ID || null,
      allowedQueues,
      workerConcurrency: this.resolveNumber(
        process.env.QUEUE_WORKER_CONCURRENCY
      ),
      heartbeatIntervalSeconds: this.resolveNumber(
        process.env.QUEUE_WORKER_HEARTBEAT_INTERVAL
      ),
      lockTimeoutSeconds: this.resolveNumber(
        process.env.QUEUE_WORKER_LOCK_TIMEOUT
      ),
      maxRuntimeSeconds: this.resolveNumber(
        process.env.QUEUE_WORKER_MAX_RUNTIME_SECONDS
      ),
      tokenConfigured: !!process.env.QUEUE_WORKER_TOKEN,
      tokenExpectedConfigured: !!process.env.QUEUE_WORKER_TOKEN_EXPECTED,
    };
  }

  private resolveBoolean(
    value: string | undefined,
    fallback: boolean
  ): boolean {
    if (value === undefined) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private resolveNumber(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private parseQueueNames(value: string | undefined): string[] {
    if (!value) return [];
    const normalizedNames = [
      ...new Set(
        value
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
      ),
    ];

    if (normalizedNames.some((name) => name.toUpperCase() === 'ALL')) {
      return [];
    }

    return normalizedNames;
  }
}
