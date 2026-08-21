import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertSafePath, ScaffoldPathError, toPosixPath } from './paths';

const ROOT = path.resolve('/repo');

describe('assertSafePath', () => {
  it('aceita caminhos dentro das raízes permitidas', () => {
    const resolved = assertSafePath(
      ROOT,
      'libraries/crm/hedhog/table/service_order.yaml'
    );

    expect(toPosixPath(resolved)).toContain(
      'repo/libraries/crm/hedhog/table/service_order.yaml'
    );
  });

  it('aceita o diretório de páginas do admin', () => {
    expect(() =>
      assertSafePath(ROOT, 'apps/admin/src/app/(app)/(libraries)/crm/x/page.tsx')
    ).not.toThrow();
  });

  it('recusa travessia de diretório', () => {
    expect(() =>
      assertSafePath(ROOT, 'libraries/../../etc/passwd')
    ).toThrow(ScaffoldPathError);
  });

  it('recusa caminho absoluto posix', () => {
    expect(() => assertSafePath(ROOT, '/etc/passwd')).toThrow(ScaffoldPathError);
  });

  it('recusa caminho absoluto windows', () => {
    expect(() => assertSafePath(ROOT, 'C:/Windows/system32')).toThrow(
      ScaffoldPathError
    );
  });

  it('recusa destino fora das raízes permitidas', () => {
    expect(() => assertSafePath(ROOT, 'apps/api/src/main.ts')).toThrow(
      ScaffoldPathError
    );
    expect(() => assertSafePath(ROOT, 'package.json')).toThrow(ScaffoldPathError);
  });

  it('recusa caminho vazio', () => {
    expect(() => assertSafePath(ROOT, '')).toThrow(ScaffoldPathError);
  });
});
