import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  const appService = {
    getHello: jest.fn<() => Promise<{ version: string }>>(),
    getHealth: jest.fn<() => Promise<{ status: string; version: string }>>(),
    getReadiness:
      jest.fn<() => Promise<{ status: string; database: string; version: string }>>(),
  };

  function mockResponse() {
    return { status: jest.fn() } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    appService.getHello.mockResolvedValue({ version: '1.2.3' });
    appService.getHealth.mockResolvedValue({ status: 'ok', version: '1.2.3' });
    appService.getReadiness.mockResolvedValue({
      status: 'ok',
      database: 'up',
      version: '1.2.3',
    });
    // ConfigService is unused by the tested handlers, so a stub is enough.
    appController = new AppController(appService as any, {} as any);
  });

  describe('root', () => {
    it('delegates to the service and returns the app version payload', async () => {
      await expect(appController.getHello()).resolves.toEqual({ version: '1.2.3' });
      expect(appService.getHello).toHaveBeenCalledTimes(1);
    });
  });

  describe('health', () => {
    it('delegates to the service health check', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        version: '1.2.3',
      });
      expect(appService.getHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe('readiness', () => {
    it('keeps the default 200 while the database answers', async () => {
      const response = mockResponse();

      await expect(appController.getReadiness(response)).resolves.toEqual({
        status: 'ok',
        database: 'up',
        version: '1.2.3',
      });
      expect(response.status).not.toHaveBeenCalled();
    });

    it('answers 503 when the database is unreachable, so the pod leaves the Service', async () => {
      appService.getReadiness.mockResolvedValue({
        status: 'degraded',
        database: 'down',
        version: '1.2.3',
      });
      const response = mockResponse();

      const body = await appController.getReadiness(response);

      expect(response.status).toHaveBeenCalledWith(503);
      expect(body.database).toBe('down');
    });
  });
});
