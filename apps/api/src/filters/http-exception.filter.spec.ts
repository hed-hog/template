import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

// Builds a minimal ArgumentsHost capturing the status and JSON body sent.
function mockHost(url = '/x', locale = 'en') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url, locale }),
    }),
  } as any;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  beforeEach(() => {
    // Silences the noisy unhandled error log during the tests.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not leak internal message/name on generic error (500)', () => {
    const { host, status, json } = mockHost('/secret');
    const filter = new HttpExceptionFilter();

    filter.catch(
      new Error('Connection to db.internal failed with password p@ssw0rd'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    const body = (json as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(body.message).toBe('Internal server error.');
    expect(body.error).toBe('Internal Server Error');
    expect(body.path).toBe('/secret');
    // No internal detail leaks into the response body.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('db.internal');
    expect(serialized).not.toContain('p@ssw0rd');
  });

  it('localizes the generic message in pt', () => {
    const { host, json } = mockHost('/x', 'pt');
    new HttpExceptionFilter().catch(new Error('boom'), host);
    const body = (json as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(body.message).toBe('Erro interno do servidor.');
  });

  it('preserves the message from an HttpException (e.g.: 403)', () => {
    const { host, status, json } = mockHost('/x');
    new HttpExceptionFilter().catch(new ForbiddenException('Sem acesso'), host);

    expect(status).toHaveBeenCalledWith(403);
    const body = (json as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(body.message).toBe('Sem acesso');
  });
});
