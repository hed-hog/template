/**
 * Descritor de ordenação — a fonte única dos campos que uma listagem aceita em
 * `sortField`.
 *
 * Antes disso, cada serviço improvisava a mesma lista de um jeito diferente
 * (`validSortFields` inline, `Set` manual, `@IsIn` no DTO, mapa campo→coluna
 * SQL) e a lista era reescrita à mão no tool MCP ao lado — que foi como
 * `sac` e `scheduling` acabaram com allowlist e enum divergentes. Com o
 * descritor, service, DTO e MCP leem o **mesmo objeto**: divergir deixa de ser
 * possível por construção, não por teste.
 *
 * Mora neste pacote, e não em `api-pagination`, porque aqui só há TypeScript
 * puro: `api-pagination` arrasta `@nestjs/common`, `pg`, `mysql2` e `typeorm`,
 * que não podem entrar no bundle do admin. `api-pagination` reexporta o que
 * está aqui, então nenhuma library precisa de dependência nova.
 */

export type SortOrder = 'asc' | 'desc';

export interface SortFieldSpec {
  /** Direção do primeiro clique nesta coluna. Default `'asc'`. */
  initialOrder?: SortOrder;
  /**
   * Coluna ou expressão SQL, para as listagens que paginam com `$queryRaw`.
   *
   * Nunca vem da requisição — é literal de módulo. É essa allowlist que impede
   * injeção, e não escaping: o `escapeIdentifier` do `api-pagination` devolve o
   * identificador cru.
   */
  column?: string;
  /**
   * Escape hatch para ordem composta ou por relação, quando `{ [campo]: dir }`
   * não dá conta:
   *
   *     order: { orderBy: (dir) => [{ order: dir }, { name: 'asc' }] }
   */
  orderBy?: (order: SortOrder) => unknown;
  /**
   * Contraparte de `orderBy` para quem pagina em SQL cru, quando a ordem tem
   * mais de um nível e `column` não dá conta:
   *
   *     sort_order: { sqlOrderBy: (dir) => `a.sort_order ${dir}, a.name ASC` }
   *
   * Recebe a direção já em maiúsculas. O desempate configurado continua sendo
   * acrescentado depois.
   */
  sqlOrderBy?: (direction: 'ASC' | 'DESC') => string;
  /** `false` tira o campo do enum do MCP, mas mantém no HTTP. */
  mcp?: boolean;
}

export type SortFieldMap = Record<string, SortFieldSpec | true>;

export interface SortableOptions<TField extends string> {
  default: TField;
  /**
   * Direção usada quando ninguém pediu ordenação. Sem isso, cai no
   * `initialOrder` do campo default e, na falta dele, em `'asc'`.
   */
  defaultOrder?: SortOrder;
  /** Campo de desempate. `null` desliga. Default `'id'`. */
  tiebreaker?: string | null;
  /** `'follow'` usa a mesma direção do campo principal. Default `'follow'`. */
  tiebreakerOrder?: SortOrder | 'follow';
  /** Coluna SQL do desempate (ex.: `'t.id'`). Default: o próprio `tiebreaker`. */
  tiebreakerColumn?: string;
  defaultPageSize?: number;
  /** Teto de `pageSize`. `null` remove o teto. Default 100. */
  maxPageSize?: number | null;
}

export interface SortInput {
  page?: number | string | null;
  pageSize?: number | string | null;
  search?: string | null;
  sortField?: string | null;
  sortOrder?: string | null;
}

export interface NormalizedSort<TField extends string> {
  field: TField;
  order: SortOrder;
  /**
   * `true` quando o cliente pediu um campo da allowlist. É este o sinal que
   * separa "pediu por id" de "não pediu nada" — sem ele, um serviço não tem
   * como declarar ordem padrão a não ser travando o `orderBy`.
   */
  requested: boolean;
  page: number;
  pageSize: number;
  offset: number;
  search: string;
}

export interface Sortable<TField extends string> {
  readonly fields: readonly TField[];
  readonly default: Readonly<{ field: TField; order: SortOrder }>;
  is(value: unknown): value is TField;
  normalize(input?: SortInput): NormalizedSort<TField>;
  toPrismaOrderBy(input?: SortInput | NormalizedSort<TField>): unknown[];
  toSqlOrderBy(input?: SortInput | NormalizedSort<TField>): string;
  toValidSortFields(): TField[];
  toMcpProperties(options?: { pagination?: boolean }): Record<string, unknown>;
}

/**
 * Identificadores e expressões legítimas: `LOWER(p.name)`, `t."created_at"`,
 * `a.type::text`. O `:` do cast do Postgres é permitido — sozinho ele não
 * separa comando; quem faz isso é o `;`, e o `--` do comentário, ambos
 * barrados abaixo.
 */
const SAFE_COLUMN = /^[A-Za-z0-9_.:"'(), ]+$/;

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_MAX_PAGE_SIZE = 100;

export function defineSortable<const TMap extends SortFieldMap>(
  spec: TMap,
  options: SortableOptions<Extract<keyof TMap, string>>
): Sortable<Extract<keyof TMap, string>> {
  type TField = Extract<keyof TMap, string>;

  const fields = Object.keys(spec) as TField[];

  const specOf = (field: TField): SortFieldSpec => {
    const entry = spec[field];
    return entry === true ? {} : (entry as SortFieldSpec);
  };

  if (!fields.includes(options.default)) {
    throw new Error(
      `defineSortable: default "${options.default}" nao esta na allowlist [${fields.join(', ')}].`
    );
  }

  for (const field of fields) {
    const column = specOf(field).column;
    if (
      column !== undefined &&
      (!SAFE_COLUMN.test(column) || column.includes('--'))
    ) {
      throw new Error(
        `defineSortable: coluna SQL insegura em "${field}": ${column}`
      );
    }
  }

  const defaultOrder: SortOrder =
    options.defaultOrder ?? specOf(options.default).initialOrder ?? 'asc';
  const tiebreaker = options.tiebreaker === undefined ? 'id' : options.tiebreaker;
  const tiebreakerOrder = options.tiebreakerOrder ?? 'follow';
  const tiebreakerColumn = options.tiebreakerColumn ?? tiebreaker;
  const defaultPageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize =
    options.maxPageSize === undefined ? DEFAULT_MAX_PAGE_SIZE : options.maxPageSize;

  const is = (value: unknown): value is TField =>
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(spec, value);

  function normalize(input: SortInput = {}): NormalizedSort<TField> {
    const page = Math.max(Math.trunc(Number(input.page ?? 1)) || 1, 1);
    const asked = Math.max(
      Math.trunc(Number(input.pageSize ?? defaultPageSize)) || defaultPageSize,
      1
    );
    const pageSize = maxPageSize === null ? asked : Math.min(asked, maxPageSize);

    const rawField =
      typeof input.sortField === 'string' ? input.sortField.trim() : '';
    const requested = is(rawField);
    const field = requested ? (rawField as TField) : options.default;

    // Direção sem campo é ambígua, e o `@Pagination()` manda `sortOrder`
    // sempre ('asc' por omissão): honrá-la sem campo apagaria o `defaultOrder`
    // de todo serviço. Os dois parâmetros andam juntos — a mesma regra que o
    // `useListUrlState` do admin aplica ao ler a URL.
    const rawOrder =
      typeof input.sortOrder === 'string'
        ? input.sortOrder.trim().toLowerCase()
        : '';
    const order: SortOrder = requested
      ? rawOrder === 'asc' || rawOrder === 'desc'
        ? rawOrder
        : (specOf(field).initialOrder ?? 'asc')
      : defaultOrder;

    return {
      field,
      order,
      requested,
      page,
      pageSize,
      offset: (page - 1) * pageSize,
      search: typeof input.search === 'string' ? input.search.trim() : '',
    };
  }

  const resolve = (
    input?: SortInput | NormalizedSort<TField>
  ): NormalizedSort<TField> =>
    input && 'requested' in input
      ? (input as NormalizedSort<TField>)
      : normalize(input as SortInput | undefined);

  function toPrismaOrderBy(
    input?: SortInput | NormalizedSort<TField>
  ): unknown[] {
    const { field, order } = resolve(input);
    const build = specOf(field).orderBy;
    const primary = build ? build(order) : { [field]: order };
    const list = Array.isArray(primary) ? [...primary] : [primary];

    // Desempate obrigatório: com OFFSET, duas linhas de mesmo valor trocam de
    // posição entre requisições e a paginação repete ou pula registro.
    if (tiebreaker && field !== tiebreaker) {
      list.push({
        [tiebreaker]: tiebreakerOrder === 'follow' ? order : tiebreakerOrder,
      });
    }

    return list;
  }

  function toSqlOrderBy(input?: SortInput | NormalizedSort<TField>): string {
    const { field, order } = resolve(input);
    const direction = order.toUpperCase() as 'ASC' | 'DESC';
    const spec = specOf(field);
    const parts = [
      spec.sqlOrderBy
        ? spec.sqlOrderBy(direction)
        : `${spec.column ?? field} ${direction}`,
    ];

    if (tiebreakerColumn && field !== tiebreaker) {
      parts.push(
        `${tiebreakerColumn} ${
          tiebreakerOrder === 'follow'
            ? direction
            : tiebreakerOrder.toUpperCase()
        }`
      );
    }

    return `ORDER BY ${parts.join(', ')}`;
  }

  function toMcpProperties({ pagination = true } = {}): Record<string, unknown> {
    const enumFields = fields.filter((field) => specOf(field).mcp !== false);

    return {
      ...(pagination
        ? {
            page: { type: 'number', description: 'Page number (default: 1)' },
            pageSize: {
              type: 'number',
              description: `Items per page (default: ${defaultPageSize}${
                maxPageSize === null ? '' : `, max: ${maxPageSize}`
              })`,
            },
            search: { type: 'string', description: 'Search term' },
          }
        : {}),
      sortField: {
        type: 'string',
        enum: enumFields,
        description: `Field to sort by (default: ${options.default})`,
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: `Sort direction (default: ${defaultOrder}); only applied together with sortField`,
      },
    };
  }

  return {
    fields,
    default: Object.freeze({ field: options.default, order: defaultOrder }),
    is,
    normalize,
    toPrismaOrderBy,
    toSqlOrderBy,
    toValidSortFields: () => [...fields],
    toMcpProperties,
  };
}
