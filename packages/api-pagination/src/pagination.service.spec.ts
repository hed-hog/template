import { BadRequestException } from '@nestjs/common';

import { PaginationService } from './pagination.service';
import { PageOrderDirection } from './enums/patination.enums';
import { defineSortable } from '@hed-hog/api-types';

type FakeModelOptions = {
  name?: string;
  fields?: Record<string, { typeName: string }>;
  localeFields?: Record<string, { typeName: string }> | null;
  rows?: any[];
  total?: number;
  rawIds?: Array<{ id: number }>;
};

/**
 * Delegate falso do Prisma. Reproduz só o que o `paginate` toca: `fields`,
 * `name`, `$parent` (o client estendido, de onde saem o `$queryRawUnsafe` e o
 * delegate `<model>_locale`), `findMany` e `count`.
 */
function fakeModel({
  name = 'category',
  fields = {
    id: { typeName: 'Int' },
    slug: { typeName: 'String' },
    status: { typeName: 'String' },
  },
  localeFields = { name: { typeName: 'String' } },
  rows = [{ id: 1 }, { id: 2 }, { id: 3 }],
  total = 3,
  rawIds = [{ id: 3 }, { id: 1 }, { id: 2 }],
}: FakeModelOptions = {}) {
  const findMany = jest.fn(async (args: any) => {
    if (args?.select?.id === true && args?.where) {
      return rows.map((row) => ({ id: row.id }));
    }
    if (args?.where?.id?.in) {
      // O Prisma devolve na ordem do banco, não na dos ids pedidos — é
      // justamente isso que a reordenação em memória tem que corrigir.
      const wanted = new Set(args.where.id.in);
      return rows.filter((row) => wanted.has(row.id));
    }
    return rows;
  });

  const queryRawUnsafe = jest.fn(async () => rawIds);
  const count = jest.fn(async () => total);

  const parent: any = { $queryRawUnsafe: queryRawUnsafe };
  if (localeFields) {
    parent[`${name}_locale`] = { fields: localeFields };
  }

  return {
    name,
    fields,
    findMany,
    count,
    $parent: parent,
    __queryRawUnsafe: queryRawUnsafe,
  } as any;
}

function params(overrides: Record<string, any> = {}) {
  return {
    page: 1,
    pageSize: 10,
    search: '',
    sortField: 'id',
    sortOrder: PageOrderDirection.Asc,
    fields: '',
    ...overrides,
  } as any;
}

const INCLUDE_LOCALE = {
  include: { category_locale: { where: { locale_id: 7 } } },
};

describe('PaginationService.paginate', () => {
  let service: PaginationService;

  beforeEach(() => {
    service = new PaginationService();
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  describe('coluna da tabela base', () => {
    it('ordena pelo Prisma, com desempate por id, e não toca em SQL cru', async () => {
      const model = fakeModel();

      await service.paginate(model, params({ sortField: 'slug' }), {});

      // O desempate não é enfeite: com OFFSET, duas linhas de mesmo `slug`
      // trocam de posição entre requisições e a paginação repete ou pula
      // registro.
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ slug: 'asc' }, { id: 'asc' }] }),
      );
      expect(model.__queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('respeita sortOrder desc', async () => {
      const model = fakeModel();

      await service.paginate(
        model,
        params({ sortField: 'slug', sortOrder: PageOrderDirection.Desc }),
        {},
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ slug: 'desc' }, { id: 'desc' }] }),
      );
    });

    it('ordenar por id não duplica o desempate', async () => {
      const model = fakeModel();

      await service.paginate(model, params({ sortField: 'id' }), {});

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { id: 'asc' } }),
      );
    });
  });

  describe('campo inválido', () => {
    it('lança BadRequestException listando as colunas válidas', async () => {
      const model = fakeModel();

      await expect(
        service.paginate(model, params({ sortField: 'nao_existe' }), {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('model sem tabela _locale devolve erro legível, não TypeError', async () => {
      const model = fakeModel({ name: 'locale', localeFields: null });

      await expect(
        service.paginate(model, params({ sortField: 'nao_existe' }), {}),
      ).rejects.toThrow(/Invalid field: nao_existe/);
    });
  });

  describe('coluna traduzível', () => {
    it('monta o SQL com LEFT JOIN, NULLS LAST e desempate por id', async () => {
      const model = fakeModel();

      await service.paginate(
        model,
        params({ sortField: 'name' }),
        INCLUDE_LOCALE,
      );

      const [sql] = model.__queryRawUnsafe.mock.calls[0];
      expect(sql).toContain('LEFT JOIN "category_locale" tl');
      expect(sql).toContain('ORDER BY tl."name" ASC NULLS LAST, t.id ASC');
      // SELECT DISTINCT + ORDER BY por coluna fora do select é inválido no
      // Postgres — era um dos motivos deste caminho nunca ter funcionado.
      expect(sql).not.toContain('DISTINCT');
    });

    it('devolve as linhas na ordem dos ids do SQL, não na do findMany', async () => {
      const model = fakeModel({ rawIds: [{ id: 3 }, { id: 1 }, { id: 2 }] });

      const result: any = await service.paginate(
        model,
        params({ sortField: 'name' }),
        INCLUDE_LOCALE,
      );

      expect(result.data.map((row: any) => row.id)).toEqual([3, 1, 2]);
    });

    it('sem filtro não materializa ids (fast path)', async () => {
      const model = fakeModel();

      await service.paginate(
        model,
        params({ sortField: 'name' }),
        INCLUDE_LOCALE,
      );

      const idOnlyCalls = model.findMany.mock.calls.filter(
        ([args]: any[]) => args?.select?.id === true,
      );
      expect(idOnlyCalls).toHaveLength(0);
    });

    it('com filtro OR/AND usa o mesmo where do count', async () => {
      const model = fakeModel();
      const where = {
        OR: [{ slug: { contains: 'a' } }],
        AND: [{ status: 'active' }],
      };

      await service.paginate(model, params({ sortField: 'name' }), {
        ...INCLUDE_LOCALE,
        where,
      });

      const countWhere = model.count.mock.calls[0][0].where;
      const idOnlyCall = model.findMany.mock.calls.find(
        ([args]: any[]) => args?.select?.id === true,
      );

      expect(idOnlyCall).toBeDefined();
      expect(idOnlyCall[0].where).toEqual(countWhere);
    });

    it('locale não resolvível degrada para ordenação por id', async () => {
      const model = fakeModel();

      await service.paginate(model, params({ sortField: 'name' }), {
        include: { category_locale: {} },
      });

      expect(model.__queryRawUnsafe).not.toHaveBeenCalled();
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { id: 'asc' } }),
      );
    });

    it('aceita o locale declarado por code', async () => {
      const model = fakeModel();

      await service.paginate(model, params({ sortField: 'name' }), {
        include: { category_locale: { where: { locale: { code: 'pt' } } } },
      });

      const [sql, ...args] = model.__queryRawUnsafe.mock.calls[0];
      expect(sql).toContain('SELECT id FROM locale WHERE code');
      expect(args[0]).toBe('pt');
    });

    it('conjunto filtrado acima do teto degrada para id', async () => {
      const model = fakeModel({ total: 20_001 });

      await service.paginate(model, params({ sortField: 'name' }), {
        ...INCLUDE_LOCALE,
        where: { AND: [{ status: 'active' }] },
      });

      expect(model.__queryRawUnsafe).not.toHaveBeenCalled();
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { id: 'asc' } }),
      );
    });

    it('mantém o include na hidratação das linhas ordenadas', async () => {
      const model = fakeModel();

      await service.paginate(
        model,
        params({ sortField: 'name' }),
        INCLUDE_LOCALE,
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: INCLUDE_LOCALE.include }),
      );
    });
  });

  describe('precedência', () => {
    // A matriz que protege os 50 endpoints cujo `orderBy` era trava e passou a
    // ser default. Cada linha aqui corresponde a um comportamento que existia
    // antes da inversão e precisa continuar existindo.

    it('sem pedido do cliente, o orderBy do service continua valendo', async () => {
      const model = fakeModel();

      await service.paginate(model, params({ sortField: undefined }), {
        orderBy: [{ status: 'asc' }],
      });

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ status: 'asc' }] }),
      );
    });

    it('o campo pedido pelo cliente vence o orderBy do service', async () => {
      const model = fakeModel();

      await service.paginate(model, params({ sortField: 'slug' }), {
        orderBy: [{ status: 'asc' }],
      });

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ slug: 'asc' }, { id: 'asc' }] }),
      );
    });

    it('sem pedido e sem orderBy, ordena por id na direção recebida', async () => {
      const model = fakeModel();

      await service.paginate(
        model,
        params({ sortField: undefined, sortOrder: PageOrderDirection.Asc }),
        {},
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { id: 'asc' } }),
      );
    });

    it('defaultSortField define a ordem padrão sem travar o cliente', async () => {
      const model = fakeModel();

      await service.paginate(model, params({ sortField: undefined }), {}, undefined, {
        defaultSortField: 'created_at',
        defaultSortOrder: 'desc',
      });

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { created_at: 'desc' } }),
      );
    });

    it('com descritor, campo fora da allowlist cai no default em vez de 400', async () => {
      const model = fakeModel();
      const sort = defineSortable(
        { id: true, slug: true },
        { default: 'slug', defaultOrder: 'asc' },
      );

      await service.paginate(model, params({ sortField: 'hack' }), {}, undefined, {
        sort,
      });

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ slug: 'asc' }, { id: 'asc' }] }),
      );
    });

    it('com descritor, o campo pedido é honrado', async () => {
      const model = fakeModel();
      const sort = defineSortable(
        { id: true, slug: true, status: true },
        { default: 'id', defaultOrder: 'desc' },
      );

      await service.paginate(
        model,
        params({ sortField: 'status', sortOrder: PageOrderDirection.Desc }),
        {},
        undefined,
        { sort },
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ status: 'desc' }, { id: 'desc' }],
        }),
      );
    });
  });
});
