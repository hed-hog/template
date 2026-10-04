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

  /**
   * A readiness disputa o MESMO pool que esgota. Marcar o pod como degraded por
   * contenção passageira o tira do Service e joga a carga nas réplicas, que estão no
   * mesmo banco — a lentidão vira queda. O que separa "pool cheio" de "banco fora" é
   * ter falado com o banco recentemente, não o formato do erro: os dois se manifestam
   * como query pendurada.
   */
  describe('contenção de pool não tira o pod do Service', () => {
    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    const succeedOnce = async () => {
      prismaService.$queryRaw.mockReturnValue(Promise.resolve([{ '?column?': 1 }]));
      await service.getReadiness();
    };

    it('mantém ok no timeout quando houve sucesso recente', async () => {
      await succeedOnce();

      jest.useFakeTimers();
      prismaService.$queryRaw.mockReturnValue(new Promise(() => {}));

      const readiness = service.getReadiness();
      await jest.advanceTimersByTimeAsync(2_100);

      await expect(readiness).resolves.toMatchObject({
        status: 'ok',
        database: 'degraded',
      });
    });

    it('mantém ok quando o Prisma devolve P2028 e houve sucesso recente', async () => {
      await succeedOnce();

      const poolError: any = new Error(
        'Transaction API error: Unable to start a transaction in the given time.',
      );
      poolError.code = 'P2028';
      prismaService.$queryRaw.mockReturnValue(Promise.reject(poolError));

      await expect(service.getReadiness()).resolves.toMatchObject({
        status: 'ok',
        database: 'degraded',
      });
    });

    it('degrada quando o sucesso mais recente já saiu da janela de graça', async () => {
      await succeedOnce();

      jest.useFakeTimers();
      // Passa dos 60s de graça antes de a próxima probe rodar. Contenção que dura
      // isso tudo não é mais passageira, e aí o pod sai mesmo.
      jest.setSystemTime(Date.now() + 61_000);
      prismaService.$queryRaw.mockReturnValue(new Promise(() => {}));

      const readiness = service.getReadiness();
      await jest.advanceTimersByTimeAsync(2_100);

      await expect(readiness).resolves.toMatchObject({
        status: 'degraded',
        database: 'down',
      });
    });

    it('degrada num banco inalcançável mesmo com sucesso recente', async () => {
      await succeedOnce();

      // 'unreachable' é evidência direta de que o banco sumiu: é o caso que a probe
      // existe para pegar, e a graça não se aplica a ele.
      prismaService.$queryRaw.mockReturnValue(
        Promise.reject(new Error("Can't reach database server at `db`:5432")),
      );

      await expect(service.getReadiness()).resolves.toMatchObject({
        status: 'degraded',
        database: 'down',
      });
    });
  });
});
