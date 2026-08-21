import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// next-intl's `getRequestConfig` in a Client Component resolution (which is what
// vitest/jsdom resolves to, absent Next's "react-server" export condition) throws
// "not supported in Client Components" instead of passing the callback through.
// Mock it to behave like the real react-server build: identity passthrough.
vi.mock('next-intl/server', () => ({
  getRequestConfig: (fn: unknown) => fn,
}));

const cookieStore = { get: vi.fn() };
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}));

type FsNode =
  | { type: 'dir'; entries: string[] }
  | { type: 'file'; content: string };

function buildFsTree(root: string, tree: Record<string, unknown>) {
  const map = new Map<string, FsNode>();

  function build(base: string, obj: Record<string, unknown>) {
    const entries = Object.keys(obj);
    map.set(base, { type: 'dir', entries });
    for (const name of entries) {
      const value = obj[name];
      const full = path.join(base, name);
      if (typeof value === 'string') {
        map.set(full, { type: 'file', content: value });
      } else {
        build(full, value as Record<string, unknown>);
      }
    }
  }

  build(root, tree);
  return map;
}

let fsMap: Map<string, FsNode> = new Map();

vi.mock('fs', () => ({
  default: {
    existsSync: (p: string) => fsMap.has(p),
    readdirSync: (p: string) => {
      const node = fsMap.get(p);
      if (!node || node.type !== 'dir') return [];
      return node.entries.map((name) => {
        const childPath = path.join(p, name);
        const child = fsMap.get(childPath);
        return {
          name,
          isDirectory: () => child?.type === 'dir',
          isFile: () => child?.type === 'file',
        };
      });
    },
    readFileSync: (p: string) => {
      const node = fsMap.get(p);
      if (!node || node.type !== 'file') {
        throw new Error(`ENOENT: no such file, ${p}`);
      }
      return node.content;
    },
  },
}));

const messagesDir = path.join(process.cwd(), 'messages');

describe('i18n/request', () => {
  beforeEach(() => {
    fsMap = new Map();
    cookieStore.get.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('usa "en" como locale padrão quando não há cookie de locale', async () => {
    cookieStore.get.mockReturnValue(undefined);
    fsMap = buildFsTree(messagesDir, {
      'en.json': JSON.stringify({ hello: 'Hello' }),
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(result.locale).toBe('en');
    expect(result.messages).toEqual({ hello: 'Hello' });
  });

  it('usa o locale do cookie quando presente', async () => {
    cookieStore.get.mockReturnValue({ value: 'pt' });
    fsMap = buildFsTree(messagesDir, {
      'pt.json': JSON.stringify({ ola: 'Ola' }),
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(result.locale).toBe('pt');
    expect(result.messages).toEqual({ ola: 'Ola' });
  });

  it('retorna mensagens vazias quando o diretório de mensagens não existe', async () => {
    cookieStore.get.mockReturnValue(undefined);
    fsMap = new Map(); // messagesDir não existe

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(result.messages).toEqual({});
  });

  it('mescla mensagens de subdiretórios sob um namespace aninhado', async () => {
    cookieStore.get.mockReturnValue(undefined);
    fsMap = buildFsTree(messagesDir, {
      'en.json': JSON.stringify({ root: 'Root' }),
      admin: {
        'en.json': JSON.stringify({ title: 'Admin Title' }),
      },
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(result.messages).toEqual({
      root: 'Root',
      admin: { title: 'Admin Title' },
    });
  });

  it('mescla mensagens de subdiretórios aninhados em múltiplos níveis', async () => {
    cookieStore.get.mockReturnValue(undefined);
    fsMap = buildFsTree(messagesDir, {
      admin: {
        users: {
          'en.json': JSON.stringify({ list: 'Users list' }),
        },
      },
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(result.messages).toEqual({
      admin: { users: { list: 'Users list' } },
    });
  });

  it('ignora arquivos que não correspondem a "<locale>.json"', async () => {
    cookieStore.get.mockReturnValue(undefined);
    fsMap = buildFsTree(messagesDir, {
      'en.json': JSON.stringify({ hello: 'Hello' }),
      'readme.txt': 'not a locale file',
      'pt.json': JSON.stringify({ ola: 'Ola' }),
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(result.messages).toEqual({ hello: 'Hello' });
  });

  it('retorna objeto vazio para um diretório de locale que não possui o arquivo do locale', async () => {
    cookieStore.get.mockReturnValue({ value: 'fr' });
    fsMap = buildFsTree(messagesDir, {
      'en.json': JSON.stringify({ hello: 'Hello' }),
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(result.messages).toEqual({});
  });

  it('registra erro e continua quando um JSON de mensagens está malformado', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    cookieStore.get.mockReturnValue(undefined);
    fsMap = buildFsTree(messagesDir, {
      'en.json': '{ not valid json',
      admin: {
        'en.json': JSON.stringify({ title: 'Admin Title' }),
      },
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(errorSpy).toHaveBeenCalled();
    expect(result.messages).toEqual({ admin: { title: 'Admin Title' } });

    errorSpy.mockRestore();
  });

  it('mescla profundamente chaves de objeto conflitantes entre root e subdiretório', async () => {
    cookieStore.get.mockReturnValue(undefined);
    fsMap = buildFsTree(messagesDir, {
      'en.json': JSON.stringify({ common: { a: 1, nested: { x: 1 } } }),
      common: {
        'en.json': JSON.stringify({ b: 2 }),
      },
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    // 'common' from root is an object; 'common' namespace from subdir nests as { common: { b: 2 } }
    // deepMerge should combine both into a single object.
    expect(result.messages).toEqual({
      common: { a: 1, nested: { x: 1 }, b: 2 },
    });
  });

  it('sobrescreve quando a chave de origem é objeto mas o alvo não é objeto', async () => {
    cookieStore.get.mockReturnValue(undefined);
    fsMap = buildFsTree(messagesDir, {
      'en.json': JSON.stringify({ common: 'not an object' }),
      common: {
        'en.json': JSON.stringify({ b: 2 }),
      },
    });

    const requestConfig = (await import('./request')).default as (
      ...args: unknown[]
    ) => Promise<{ locale: string; messages: Record<string, unknown> }>;

    const result = await requestConfig();
    expect(result.messages).toEqual({ common: { b: 2 } });
  });
});
