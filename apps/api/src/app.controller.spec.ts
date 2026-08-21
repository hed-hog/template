import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  const appService = {
    getHello: jest.fn<() => Promise<{ version: string }>>(),
    getHealth: jest.fn<() => Promise<{ status: string; version: string }>>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    appService.getHello.mockResolvedValue({ version: '1.2.3' });
    appService.getHealth.mockResolvedValue({ status: 'ok', version: '1.2.3' });
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
});
