import { describe, it, expect } from 'vitest';

import { defineSortable } from './sort';

const SORT = defineSortable(
  {
    id: true,
    name: { column: 'p.name' },
    status: true,
    created_at: { initialOrder: 'desc', column: 'p.created_at' },
    interno: { mcp: false },
  },
  { default: 'id', defaultOrder: 'desc' }
);

describe('normalize', () => {
  it('clampa page para no mínimo 1', () => {
    expect(SORT.normalize({ page: 0 }).page).toBe(1);
    expect(SORT.normalize({ page: -3 }).page).toBe(1);
    expect(SORT.normalize({ page: 'abc' }).page).toBe(1);
    expect(SORT.normalize({ page: '4' }).page).toBe(4);
  });

  it('clampa pageSize no teto default de 100', () => {
    expect(SORT.normalize({ pageSize: 5000 }).pageSize).toBe(100);
    expect(SORT.normalize({}).pageSize).toBe(10);
    expect(SORT.normalize({ pageSize: 25 }).pageSize).toBe(25);
  });

  it('pageSize zero, negativo ou não numérico cai no default, não em 1', () => {
    // Mesmo comportamento do `normalizePaginationParams` do operations, que
    // este primitivo promove: 0 não é um tamanho de página com significado.
    expect(SORT.normalize({ pageSize: 0 }).pageSize).toBe(10);
    expect(SORT.normalize({ pageSize: 'abc' }).pageSize).toBe(10);
    expect(SORT.normalize({ pageSize: -5 }).pageSize).toBe(1);
  });

  it('maxPageSize null remove o teto', () => {
    // `locale` pede pageSize 1000 no bootstrap dos apps; um teto global
    // quebraria o seletor de idioma.
    const semTeto = defineSortable({ id: true }, { default: 'id', maxPageSize: null });
    expect(semTeto.normalize({ pageSize: 5000 }).pageSize).toBe(5000);
  });

  it('calcula o offset a partir de page e pageSize', () => {
    expect(SORT.normalize({ page: 3, pageSize: 20 }).offset).toBe(40);
  });

  it('marca requested apenas para campo da allowlist', () => {
    expect(SORT.normalize({ sortField: 'name' }).requested).toBe(true);
    expect(SORT.normalize({}).requested).toBe(false);
    expect(SORT.normalize({ sortField: '' }).requested).toBe(false);
    expect(SORT.normalize({ sortField: '   ' }).requested).toBe(false);
    expect(SORT.normalize({ sortField: 'hack' }).requested).toBe(false);
  });

  it('sem campo pedido, ignora o sortOrder do cliente e usa o defaultOrder', () => {
    // O `@Pagination()` manda `sortOrder: 'asc'` sempre. Honrá-lo sem campo
    // apagaria o default de todo serviço — é o caso que mais importa aqui.
    const r = SORT.normalize({ sortOrder: 'asc' });
    expect(r.requested).toBe(false);
    expect(r.order).toBe('desc');
    expect(r.field).toBe('id');
  });

  it('campo fora da allowlist cai no default, sem lançar', () => {
    expect(SORT.normalize({ sortField: 'hack', sortOrder: 'asc' })).toMatchObject({
      field: 'id',
      order: 'desc',
      requested: false,
    });
  });

  it('respeita o initialOrder declarado por campo', () => {
    expect(SORT.normalize({ sortField: 'created_at' }).order).toBe('desc');
    expect(SORT.normalize({ sortField: 'name' }).order).toBe('asc');
  });

  it('o sortOrder explícito vence o initialOrder', () => {
    expect(SORT.normalize({ sortField: 'created_at', sortOrder: 'asc' }).order).toBe('asc');
    expect(SORT.normalize({ sortField: 'name', sortOrder: 'DESC' }).order).toBe('desc');
  });

  it('descarta espaços em volta do campo e da direção', () => {
    expect(SORT.normalize({ sortField: '  name  ', sortOrder: ' ASC ' })).toMatchObject({
      field: 'name',
      order: 'asc',
    });
  });
});

describe('toPrismaOrderBy', () => {
  it('embute o desempate por id', () => {
    expect(SORT.toPrismaOrderBy({ sortField: 'name', sortOrder: 'asc' })).toEqual([
      { name: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('não duplica o desempate quando o campo já é o id', () => {
    expect(SORT.toPrismaOrderBy({ sortField: 'id', sortOrder: 'asc' })).toEqual([
      { id: 'asc' },
    ]);
  });

  it('tiebreakerOrder fixo não segue a direção do campo', () => {
    const s = defineSortable(
      { id: true, created_at: true },
      { default: 'created_at', tiebreakerOrder: 'desc' }
    );
    expect(s.toPrismaOrderBy({ sortField: 'created_at', sortOrder: 'asc' })).toEqual([
      { created_at: 'asc' },
      { id: 'desc' },
    ]);
  });

  it('tiebreaker null desliga o desempate', () => {
    const s = defineSortable({ id: true, name: true }, { default: 'id', tiebreaker: null });
    expect(s.toPrismaOrderBy({ sortField: 'name' })).toEqual([{ name: 'asc' }]);
  });

  it('achata a ordem composta do escape hatch e ainda desempata', () => {
    const s = defineSortable(
      {
        id: true,
        order: { orderBy: (dir) => [{ order: dir }, { name: 'asc' }] },
      },
      { default: 'order' }
    );
    expect(s.toPrismaOrderBy({ sortField: 'order', sortOrder: 'asc' })).toEqual([
      { order: 'asc' },
      { name: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('sem input usa o default do descritor', () => {
    expect(SORT.toPrismaOrderBy()).toEqual([{ id: 'desc' }]);
  });

  it('aceita um NormalizedSort já resolvido, sem renormalizar', () => {
    const normalizado = SORT.normalize({ sortField: 'name', sortOrder: 'desc' });
    expect(SORT.toPrismaOrderBy(normalizado)).toEqual([
      { name: 'desc' },
      { id: 'desc' },
    ]);
  });
});

describe('toSqlOrderBy', () => {
  it('usa a coluna declarada e acrescenta o desempate', () => {
    expect(SORT.toSqlOrderBy({ sortField: 'name', sortOrder: 'asc' })).toBe(
      'ORDER BY p.name ASC, id ASC'
    );
  });

  it('cai no nome do campo quando não há coluna declarada', () => {
    expect(SORT.toSqlOrderBy({ sortField: 'status', sortOrder: 'desc' })).toBe(
      'ORDER BY status DESC, id DESC'
    );
  });

  it('sqlOrderBy expressa ordem de mais de um nivel, e o desempate vem depois', () => {
    // Reproduz o `ORDER BY a.sort_order ASC, a.name ASC, a.id ASC` que estava
    // fixo em achievement.service.ts.
    const s = defineSortable(
      {
        id: true,
        sort_order: {
          sqlOrderBy: (dir) => `a.sort_order ${dir}, a.name ASC`,
        },
      },
      {
        default: 'sort_order',
        tiebreaker: 'id',
        tiebreakerColumn: 'a.id',
        tiebreakerOrder: 'asc',
      }
    );

    expect(s.toSqlOrderBy()).toBe('ORDER BY a.sort_order ASC, a.name ASC, a.id ASC');
    expect(s.toSqlOrderBy({ sortField: 'sort_order', sortOrder: 'desc' })).toBe(
      'ORDER BY a.sort_order DESC, a.name ASC, a.id ASC'
    );
  });

  it('aceita cast do Postgres na coluna', () => {
    const s = defineSortable(
      { id: true, type: { column: 'a.type::text' } },
      { default: 'type' }
    );
    expect(s.toSqlOrderBy({ sortField: 'type' })).toBe(
      'ORDER BY a.type::text ASC, id ASC'
    );
  });

  it('usa a coluna de desempate quando declarada', () => {
    const s = defineSortable(
      { id: true, name: { column: 'ct.name' } },
      { default: 'name', tiebreakerColumn: 'ct.id', tiebreakerOrder: 'asc' }
    );
    expect(s.toSqlOrderBy({ sortField: 'name', sortOrder: 'desc' })).toBe(
      'ORDER BY ct.name DESC, ct.id ASC'
    );
  });
});

describe('validação na definição', () => {
  it('lança quando o default está fora da allowlist', () => {
    expect(() =>
      // @ts-expect-error default fora da allowlist é erro de tipo e de runtime
      defineSortable({ id: true }, { default: 'nao_existe' })
    ).toThrow(/nao esta na allowlist/);
  });

  it('lança em coluna SQL com ponto e vírgula ou comentário', () => {
    expect(() =>
      defineSortable(
        { id: true, x: { column: 'ct.name; DROP TABLE users' } },
        { default: 'id' }
      )
    ).toThrow(/coluna SQL insegura/);

    expect(() =>
      defineSortable({ id: true, x: { column: 'ct.name --' } }, { default: 'id' })
    ).toThrow(/coluna SQL insegura/);
  });

  it('aceita expressão SQL legítima', () => {
    expect(() =>
      defineSortable(
        { id: true, name: { column: 'LOWER(p.name)' } },
        { default: 'name' }
      )
    ).not.toThrow();
  });
});

describe('toMcpProperties', () => {
  it('o enum sai da mesma fonte da allowlist, menos os campos mcp:false', () => {
    const props = SORT.toMcpProperties() as Record<string, { enum?: string[] }>;
    expect(props.sortField.enum).toEqual(['id', 'name', 'status', 'created_at']);
    expect(SORT.toValidSortFields()).toContain('interno');
  });

  it('inclui page/pageSize/search por padrão e sabe omiti-los', () => {
    expect(Object.keys(SORT.toMcpProperties())).toEqual([
      'page',
      'pageSize',
      'search',
      'sortField',
      'sortOrder',
    ]);
    expect(Object.keys(SORT.toMcpProperties({ pagination: false }))).toEqual([
      'sortField',
      'sortOrder',
    ]);
  });
});

describe('tipagem', () => {
  it('is() estreita para o union de campos', () => {
    expect(SORT.is('name')).toBe(true);
    expect(SORT.is('hack')).toBe(false);
    expect(SORT.is(42)).toBe(false);
    // @ts-expect-error 'hack' não pertence ao union do descritor
    const _: (typeof SORT.fields)[number] = 'hack';
    void _;
  });

  it('expõe o default congelado', () => {
    expect(SORT.default).toEqual({ field: 'id', order: 'desc' });
  });
});
