import { describe, it, expect } from 'vitest';

import { anyPaginationEnvelope, buildPaginationEnvelope } from './pagination';

describe('buildPaginationEnvelope', () => {
  it('calcula lastPage, prev e next', () => {
    expect(buildPaginationEnvelope([1, 2], 25, 2, 10)).toEqual({
      data: [1, 2],
      total: 25,
      page: 2,
      pageSize: 10,
      lastPage: 3,
      prev: 1,
      next: 3,
    });
  });

  it('primeira página não tem prev', () => {
    expect(buildPaginationEnvelope([], 25, 1, 10)).toMatchObject({
      prev: null,
      next: 2,
    });
  });

  it('última página não tem next', () => {
    expect(buildPaginationEnvelope([], 25, 3, 10)).toMatchObject({
      prev: 2,
      next: null,
    });
  });

  it('lista vazia continua com uma página', () => {
    // `lastPage: 0` faria a tela mostrar "página 1 de 0".
    expect(buildPaginationEnvelope([], 0, 1, 10)).toMatchObject({
      lastPage: 1,
      prev: null,
      next: null,
    });
  });

  it('saneia page e pageSize vindos direto da query string', () => {
    expect(buildPaginationEnvelope([], 10, 0, 0)).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(
      buildPaginationEnvelope([], 10, '2' as never, '5' as never)
    ).toMatchObject({ page: 2, pageSize: 5 });
  });

  it('total menor que uma página cabe em lastPage 1', () => {
    expect(buildPaginationEnvelope([1], 1, 1, 20)).toMatchObject({
      lastPage: 1,
      next: null,
    });
  });

  it('o que ele produz satisfaz o contrato de envelope da API', () => {
    // O mesmo schema que os testes de contrato E2E usam: se um dos dois mudar
    // de shape sem o outro, isto quebra.
    const envelope = buildPaginationEnvelope([{ id: 1 }], 3, 1, 2);
    expect(() => anyPaginationEnvelope.parse(envelope)).not.toThrow();
  });
});
