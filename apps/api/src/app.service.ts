import { PaginationService } from '@hed-hog/api-pagination';
import {
  classifyDatabaseInfraError,
  PrismaService,
} from '@hed-hog/api-prisma';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Teto de espera pelo banco na readiness. Bem abaixo do `pool_timeout` de 20s do
 * Prisma (ver packages/api-prisma/datasource-url.ts) e do `timeoutSeconds: 5` da
 * probe: banco lento a este ponto já não serve request nenhuma.
 */
const READINESS_TIMEOUT_MS = 2000;

/**
 * Por quanto tempo depois do último `SELECT 1` bem-sucedido a probe tolera um sinal
 * inconclusivo (timeout da própria probe ou erro de pool).
 *
 * Existe porque a readiness disputa o MESMO pool que esgota: com
 * `PRISMA_CONNECTION_LIMIT=5` por pod, uma rajada que ocupe as cinco conexões faz o
 * `SELECT 1` ficar na fila e estourar os 2s. O pod continua perfeitamente capaz de
 * servir, mas era marcado `degraded`, saía do Service pelo `failureThreshold: 3` e
 * jogava seu tráfego nas réplicas — que estão no mesmo banco saturado. Tirar pod de
 * um cluster sobrecarregado é exatamente o contrário do que se quer.
 *
 * A graça é temporal, e não um simples "timeout vira ok", porque banco fora também
 * se manifesta como query pendurada (ver o teste do pool_timeout): o que separa os
 * dois casos é ter falado com o banco recentemente. Sem nenhum sucesso registrado —
 * pod recém-subido que nunca alcançou o Postgres — não há o que tolerar, e a probe
 * degrada como antes. 60s cobre com folga os 30s do failureThreshold.
 */
const READINESS_GRACE_MS = 60_000;

/** Timeout da própria probe, para separá-lo de um erro vindo do banco. */
class ReadinessTimeoutError extends Error {}

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
  /** Epoch do último SELECT 1 que respondeu. 0 = o pod ainda não falou com o banco. */
  private lastDatabaseSuccessAt = 0;

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
      this.lastDatabaseSuccessAt = Date.now();
      return { status: 'ok', database: 'up', version: this.version };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Saturação do pool e timeout da probe não provam que o banco caiu — e a
      // readiness disputa o mesmo pool. Enquanto houver sucesso recente, o pod fica
      // no Service: ele ainda serve, e removê-lo empurra a carga para réplicas que
      // estão no mesmo banco. Erro que identifica o banco como inalcançável não
      // passa por aqui: degrada na hora, que é o motivo de a probe existir.
      if (this.isInconclusiveReadinessError(error) && this.hasRecentDatabaseSuccess()) {
        this.logger.warn(
          `Readiness sob contenção do banco, mantendo o pod no Service: ${message}`,
        );
        return { status: 'ok', database: 'degraded', version: this.version };
      }

      this.logger.error(`Readiness degradada: ${message}`);
      return { status: 'degraded', database: 'down', version: this.version };
    }
  }

  private hasRecentDatabaseSuccess(): boolean {
    return (
      this.lastDatabaseSuccessAt > 0 &&
      Date.now() - this.lastDatabaseSuccessAt < READINESS_GRACE_MS
    );
  }

  private isInconclusiveReadinessError(error: unknown): boolean {
    return (
      error instanceof ReadinessTimeoutError ||
      classifyDatabaseInfraError(error) === 'pool'
    );
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
                new ReadinessTimeoutError(
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
