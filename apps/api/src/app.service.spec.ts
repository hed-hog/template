import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Foco: `getReadiness`. É a única parte do AppService que sai do processo, e ela
 * decide se o pod continua no Service — um falso "ok" devolve tráfego para um pod
 * que não alcança o banco (o cenário da issue API-E do Sentry).
 */
describe('AppService.getReadiness', () => {
  const prismaService = { $queryRaw: jest.fn() };
  let service: AppService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new AppService(prismaService as any, {} as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reporta ok quando o banco responde', async () => {
    prismaService.$queryRaw.mockReturnValue(Promise.resolve([{ '?column?': 1 }]));

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });

  it('reporta degraded quando a query falha', async () => {
    prismaService.$queryRaw.mockReturnValue(
      Promise.reject(new Error("Can't reach database server")),
    );

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'degraded',
      database: 'down',
    });
  });

  it('não espera o pool_timeout de 20s: desiste em 2s e reporta degraded', async () => {
    jest.useFakeTimers();
    // Banco inalcançável não rejeita na hora — a query fica pendurada até o
    // pool_timeout, tempo demais para uma probe que desiste em 5s.
    prismaService.$queryRaw.mockReturnValue(new Promise(() => {}));

    const readiness = service.getReadiness();
    await jest.advanceTimersByTimeAsync(2_100);

    await expect(readiness).resolves.toMatchObject({
      status: 'degraded',
      database: 'down',
    });
  });

  it('uma rejeição que chega DEPOIS do timeout não derruba o processo', async () => {
    jest.useFakeTimers();

    // Promise.race não cancela a query perdedora. Sem o catch preventivo em
    // checkDatabase, esta rejeição tardia viraria unhandled rejection — e o SDK do
    // Sentry roda com onUnhandledRejectionIntegration em mode:'strict', que mata o pod.
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    try {
      let rejectLate: (reason: Error) => void = () => {};
      prismaService.$queryRaw.mockReturnValue(
        new Promise((_, reject) => {
          rejectLate = reject;
        }),
      );

      const readiness = service.getReadiness();
      await jest.advanceTimersByTimeAsync(2_100);
      await expect(readiness).resolves.toMatchObject({ status: 'degraded' });

      rejectLate(new Error('conexão caiu tarde'));
      await jest.advanceTimersByTimeAsync(10);
      // Dá uma volta no event loop real para o handler de unhandledRejection rodar.
      jest.useRealTimers();
      await new Promise((resolve) => setImmediate(resolve));

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
