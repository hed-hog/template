import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

// Monta um ArgumentsHost mínimo capturando o status e o corpo JSON enviados.
function mockHost(url = '/x', locale = 'en') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, setHeader }),
      getRequest: () => ({ url, locale }),
    }),
  } as any;
  return { host, status, json, setHeader };
}

describe('HttpExceptionFilter', () => {
  beforeEach(() => {
    // Silencia o log ruidoso de erro não tratado durante os testes.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('não vaza mensagem/nome internos em erro genérico (500)', () => {
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
    // Nenhum detalhe interno vaza para o corpo da resposta.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('db.internal');
    expect(serialized).not.toContain('p@ssw0rd');
  });

  it('localiza a mensagem genérica em pt', () => {
    const { host, json } = mockHost('/x', 'pt');
    new HttpExceptionFilter().catch(new Error('boom'), host);
    const body = (json as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(body.message).toBe('Erro interno do servidor.');
  });

  it('preserva a mensagem de uma HttpException (ex.: 403)', () => {
    const { host, status, json } = mockHost('/x');
    new HttpExceptionFilter().catch(new ForbiddenException('Sem acesso'), host);

    expect(status).toHaveBeenCalledWith(403);
    const body = (json as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(body.message).toBe('Sem acesso');
  });

  it('entrega os campos extras que a exceção colocou no corpo', () => {
    const { host, json } = mockHost('/vaults/invites/accept');
    new HttpExceptionFilter().catch(
      new ForbiddenException({
        code: 'INVITE_WRONG_ACCOUNT',
        inviteEmail: 'co*****@test.com',
        message: 'Este convite foi enviado para outro endereço de e-mail.',
      }),
      host,
    );

    const body = (json as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(body.code).toBe('INVITE_WRONG_ACCOUNT');
    expect(body.inviteEmail).toBe('co*****@test.com');
    expect(body.message).toBe(
      'Este convite foi enviado para outro endereço de e-mail.',
    );
  });

  it('não deixa os extras sobrescreverem o envelope canônico', () => {
    const { host, status, json } = mockHost('/x');
    new HttpExceptionFilter().catch(
      new ForbiddenException({
        message: 'Sem acesso',
        statusCode: 200,
        path: '/outro',
        timestamp: 'ontem',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(403);
    const body = (json as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(body.statusCode).toBe(403);
    expect(body.path).toBe('/x');
    expect(body.timestamp).not.toBe('ontem');
  });
});
