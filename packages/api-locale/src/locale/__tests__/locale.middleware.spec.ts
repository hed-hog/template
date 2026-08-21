import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { localeStorage } from '../locale-context';
import { LocaleMiddleware } from '../locale.middleware';

const makeMiddleware = () => {
  const prisma = {
    locale: {
      findMany: jest.fn(async () => [{ code: 'en' }, { code: 'pt' }]),
    },
  };
  return { middleware: new LocaleMiddleware(prisma as any), prisma };
};

const run = async (middleware: LocaleMiddleware, acceptLanguage?: string) => {
  const req: any = { headers: {} };
  if (acceptLanguage !== undefined) req.headers['accept-language'] = acceptLanguage;

  let seen: any = null;
  await middleware.use(req, {} as any, () => {
    seen = localeStorage.getStore();
  });

  return { req, seen };
};

describe('LocaleMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reduz a tag regional ao code suportado', async () => {
    const { middleware } = makeMiddleware();
    const { req } = await run(middleware, 'pt-BR,pt;q=0.9');

    expect(req.locale).toBe('pt');
    expect(req.localeDetected).toBe(true);
  });

  // O ponto do flag: `en` escolhido pelo cliente e `en` por falta de header
  // precisam ser distinguíveis, senão a preferência gravada seria uma ficção.
  it('marca como não detectado quando o header não vem', async () => {
    const { middleware } = makeMiddleware();
    const { req } = await run(middleware);

    expect(req.locale).toBe('en');
    expect(req.localeDetected).toBe(false);
  });

  it('marca como detectado o `en` que o cliente realmente pediu', async () => {
    const { middleware } = makeMiddleware();
    const { req } = await run(middleware, 'en-US');

    expect(req.locale).toBe('en');
    expect(req.localeDetected).toBe(true);
  });

  it('não aceita idioma fora dos suportados', async () => {
    const { middleware } = makeMiddleware();
    const { req } = await run(middleware, 'de-DE');

    expect(req.locale).toBe('en');
    expect(req.localeDetected).toBe(false);
  });

  // Sem isto, quem está longe do controller (fila, notificação) leria store vazio.
  it('abre o contexto para o resto da cadeia', async () => {
    const { middleware } = makeMiddleware();
    const { seen } = await run(middleware, 'pt-BR');

    expect(seen).toEqual({ locale: 'pt', detected: true });
  });

  it('consulta os idiomas do banco uma única vez', async () => {
    const { middleware, prisma } = makeMiddleware();
    await run(middleware, 'pt');
    await run(middleware, 'en');

    expect(prisma.locale.findMany).toHaveBeenCalledTimes(1);
  });
});
