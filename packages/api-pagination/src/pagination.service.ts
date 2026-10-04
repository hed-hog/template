import { itemTranslations } from '@hed-hog/api';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
} from './constants/pagination.constants';
import { AbstractDatabase, Database, DatabaseFactory } from './databases';
import { PageOrderDirection } from './enums/patination.enums';
import type { Sortable } from '@hed-hog/api-types';
import type { FindManyArgs, PaginationParams } from './types/pagination.types';

@Injectable()
export class PaginationService {

    private readonly logger = new Logger(PaginationService.name);
  private db: any = null;

  private getModelFieldType(model: any, field: string): string | null {
    return model?.fields?.[field]?.typeName ?? null;
  }

  private coerceValueByType(value: any, typeName: string | null): any {
    if (value === undefined || value === null || !typeName) {
      return undefined;
    }

    if (typeName === 'String') {
      return value;
    }

    if (typeName === 'Int' || typeName === 'BigInt') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    if (typeName === 'Float' || typeName === 'Decimal') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    if (typeName === 'Boolean') {
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        if (normalized === 'true') {
          return true;
        }
        if (normalized === 'false') {
          return false;
        }

        return undefined;
      }
    }

    return undefined;
  }

  private sanitizeWhereForModel(where: any, model: any): any {
    if (!where || typeof where !== 'object') {
      return where;
    }

    if (Array.isArray(where)) {
      const sanitizedArray = where
        .map((item) => this.sanitizeWhereForModel(item, model))
        .filter((item) => {
          if (item === undefined || item === null) {
            return false;
          }

          if (Array.isArray(item)) {
            return item.length > 0;
          }

          if (typeof item === 'object') {
            return Object.keys(item).length > 0;
          }

          return true;
        });

      return sanitizedArray;
    }

    const result: any = {};

    for (const [key, value] of Object.entries(where)) {
      if (key === 'OR' || key === 'AND' || key === 'NOT') {
        const sanitizedLogical = this.sanitizeWhereForModel(value, model);

        if (Array.isArray(sanitizedLogical) && sanitizedLogical.length > 0) {
          result[key] = sanitizedLogical;
        } else if (
          sanitizedLogical &&
          typeof sanitizedLogical === 'object' &&
          Object.keys(sanitizedLogical).length > 0
        ) {
          result[key] = sanitizedLogical;
        }

        continue;
      }

      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        result[key] = value;
        continue;
      }

      const fieldType = this.getModelFieldType(model, key);
      const normalizedValue: any = { ...value };

      if (
        Object.prototype.hasOwnProperty.call(normalizedValue, 'contains') &&
        fieldType !== 'String'
      ) {
        const containsValue = normalizedValue.contains;
        delete normalizedValue.contains;
        delete normalizedValue.mode;

        if (!Object.prototype.hasOwnProperty.call(normalizedValue, 'equals')) {
          const coercedContains = this.coerceValueByType(containsValue, fieldType);
          if (coercedContains !== undefined) {
            normalizedValue.equals = coercedContains;
          }
        }
      }

      if (Object.prototype.hasOwnProperty.call(normalizedValue, 'equals')) {
        const coercedEquals = this.coerceValueByType(
          normalizedValue.equals,
          fieldType,
        );

        if (coercedEquals === undefined) {
          delete normalizedValue.equals;
        } else {
          normalizedValue.equals = coercedEquals;
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(normalizedValue, 'mode') &&
        !Object.prototype.hasOwnProperty.call(normalizedValue, 'contains')
      ) {
        delete normalizedValue.mode;
      }

      if (Object.keys(normalizedValue).length > 0) {
        result[key] = normalizedValue;
      }
    }

    return result;
  }

  private createSearchConditionForField(
    model: any,
    field: string,
    searchValue: string,
  ): any {
    const fieldType = this.getModelFieldType(model, field);

    if (!fieldType || fieldType === 'String') {
      return { [field]: { contains: searchValue, mode: 'insensitive' } };
    }

    const coercedValue = this.coerceValueByType(searchValue, fieldType);

    if (coercedValue === undefined) {
      return null;
    }

    return {
      [field]: {
        equals: coercedValue,
      },
    };
  }
    
    async paginatePrismaModel(model: any, options: {
      page?: number;
      pageSize?: number;
      search?: string;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      validSortFields?: string[];
      searchFields?: string[];
      where?: any;
      include?: any;
      select?: any;
      /**
       * Ordem quando o cliente NÃO pede — não é mais uma trava. Prefira
       * `defaultSortField`/`defaultSortOrder`, ou o descritor em `sort`.
       */
      orderBy?: any;
      /** Descritor `defineSortable`: allowlist, default e desempate num objeto só. */
      sort?: Sortable<string>;
      defaultSortField?: string;
      defaultSortOrder?: 'asc' | 'desc';
    }) {

      try {

      const {
        page = 1,
        pageSize = 10,
        search,
        // Sem default: `sortField` ausente significa "o cliente não pediu
        // ordem", e é isso que permite ao service ter uma ordem padrão sem
        // precisar travar o `orderBy`.
        sortField,
        sortOrder = 'desc',
        validSortFields = ['id'],
        searchFields = [],
        where: customWhere,
        include,
        select,
        orderBy: customOrderBy,
        sort,
        defaultSortField,
        defaultSortOrder,
      } = options;

      if (sort && customOrderBy) {
        this.logger.error(
          'paginatePrismaModel: `sort` e `orderBy` juntos — o `orderBy` é ignorado. ' +
            'Mova a ordem padrão para defineSortable({...}, { default, defaultOrder }).',
        );
      }

      const currentPage = Math.max(Number(page) || 1, 1);
      const limit = Math.max(Number(pageSize) || 10, 1);
      const skip = (currentPage - 1) * limit;

      let where = customWhere || {};
      if (search && searchFields.length > 0) {
        const searchConditions = searchFields
          .map((field) => this.createSearchConditionForField(model, field, search))
          .filter(Boolean);

        where = {
          ...where,
          OR: searchConditions,
        };
      }

      where = this.sanitizeWhereForModel(where, model);

      // Precedência: o que o CLIENTE pediu vence; na falta, a ordem padrão do
      // service; na falta dela, o id. Era o contrário — `customOrderBy` vencia
      // sempre, e por isso metade dos endpoints ignorava o `sortField`.
      const askedSortField =
        typeof sortField === 'string' ? sortField.trim() : '';

      const orderBy = sort
        ? sort.toPrismaOrderBy({ sortField: askedSortField, sortOrder })
        : askedSortField && validSortFields.includes(askedSortField)
          ? { [askedSortField]: sortOrder === 'asc' ? 'asc' : 'desc' }
          : (customOrderBy ??
            // Reproduz os dois ramos antigos: sem `sortOrder` dá `{id:'desc'}`
            // (o fallback), e com `sortOrder:'asc'` dá `{id:'asc'}` — que é o
            // que as duas rotas de sessão recebem hoje.
            {
              [defaultSortField ?? 'id']:
                defaultSortOrder ?? (sortOrder === 'asc' ? 'asc' : 'desc'),
            });

      const findManyQuery: any = { skip, take: limit, where, orderBy };

      if (include) {
        findManyQuery.include = include;
      } else if (select) {
        findManyQuery.select = select;
      }

      const [data, total] = await Promise.all([
        model.findMany(findManyQuery),
        model.count({ where }),
      ]);

      const lastPage = Math.max(1, Math.ceil(total / limit));

      return {
        total,
        lastPage,
        page: currentPage,
        pageSize: limit,
        data,
      };

    } catch (error) {
      this.logger.error('Pagination Error:', error);
      throw new BadRequestException(`Failed to paginate: ${error}`);
    }
    }

  async paginate<T, M extends any>(
    model: M,
    paginationParams: PaginationParams,
    customQuery?: FindManyArgs<M>,
    translationKey?: string,
    // 5º parâmetro porque o 4º está ocupado em 61 chamadas — `translationKey`
    // é passado posicionalmente por vehicle e api-locale.
    options?: {
      sort?: Sortable<string>;
      defaultSortField?: string;
      defaultSortOrder?: PageOrderDirection | 'asc' | 'desc';
    },
  ) /*: Promise<PaginatedResult<T>>*/ {

    try {
      if (!model) {
        throw new BadRequestException('Model is required');
      }

      const page = Number(paginationParams.page || DEFAULT_PAGE);
      const pageSize = Number(paginationParams.pageSize || DEFAULT_PAGE_SIZE);
      const search = paginationParams.search || null;
      const sortField = paginationParams.sortField || null;
      const sortOrder = paginationParams.sortOrder || PageOrderDirection.Asc;
      const customOrderBy = (customQuery as any)?.orderBy;
      const fields = paginationParams.fields
        ? paginationParams.fields.split(',')
        : null;

      if (page < 1 || pageSize < 1) {
        throw new BadRequestException(
          'Page and pageSize must be greater than 0',
        );
      }

      let selectCondition = undefined;
      let sortOrderCondition: any = {
        id: paginationParams.sortOrder || PageOrderDirection.Asc,
      };
      let needsRawQueryOrdering = false;
      let localeTableName = '';
      let localeSortField = '';

      // Três camadas, da mais fraca para a mais forte. A ordem das atribuições
      // é o que muda em relação a antes: o `customOrderBy` era aplicado por
      // último e vencia o pedido do cliente, o que fazia metade dos endpoints
      // aceitar `sortField` e ignorá-lo em silêncio.

      // 1) Base — o que este método já respondia sem ordem de ninguém.
      // 2) A ordem padrão do service passa a ser default, não trava.
      if (options?.sort) {
        sortOrderCondition = options.sort.toPrismaOrderBy();
      } else if (customOrderBy) {
        sortOrderCondition = customOrderBy;
      } else if (options?.defaultSortField) {
        sortOrderCondition = {
          [options.defaultSortField]: options.defaultSortOrder ?? sortOrder,
        };
      }

      // 3) O que o cliente pediu vence — e é só aqui que ele é validado.
      if (sortField) {
        if (options?.sort) {
          // Fora da allowlist cai no default, sem 400: mesma escolha que o
          // `useListUrlState` do admin faz ao ler a URL.
          if (options.sort.is(sortField)) {
            sortOrderCondition = options.sort.toPrismaOrderBy({
              sortField,
              sortOrder,
            });
          }
        } else if (this.isInvalidField(sortField, model)) {
          if (this.isInvalidLocaleField(sortField, model)) {
            this.logger.error(`Invalid field: ${sortField}`);
            throw new BadRequestException(
              `Invalid field: ${sortField}. Valid columns are: ${this.extractFieldNames(
                model,
              ).join(', ')}`,
            );
          }

          // Campo existe na tabela locale - precisa usar raw query
          localeTableName = `${(model as any).name}_locale`;
          localeSortField = sortField;
          needsRawQueryOrdering = true;
        } else if (sortField === 'id' || this.isInvalidField('id', model)) {
          sortOrderCondition = { [sortField]: sortOrder };
        } else {
          // Desempate: ordenar por coluna não-única com OFFSET faz linha
          // repetir e sumir entre páginas. O caminho de locale já fazia isso
          // (`, t.id ASC`); o caminho Prisma nunca fez.
          sortOrderCondition = [{ [sortField]: sortOrder }, { id: sortOrder }];
        }
      }

      if (search) {
        if (typeof search !== 'string') {
          this.logger.error('Search must be a string');
          throw new BadRequestException('Search must be a string');
        }
      }

      if (fields) {
        const invalidFields = this.isInvalidFields(fields, model);

        if (invalidFields) {
          this.logger.error(
            `Invalid fields: ${fields.join(', ')}. Valid columns are: ${this.extractFieldNames(
              model,
            ).join(', ')}`,
          );

          throw new BadRequestException(
            `Invalid fields: ${fields.join(', ')}. Valid columns are: ${this.extractFieldNames(
              model,
            ).join(', ')}`,
          );
        }

        selectCondition = fields.reduce((acc, field) => {
          acc[field] = true;
          return acc;
        }, {});
      }

      const skip = page > 0 ? pageSize * (page - 1) : 0;

      if (
        (customQuery as any).where &&
        (customQuery as any).where.OR &&
        (customQuery as any).where.OR.length === 0
      ) {
        delete (customQuery as any).where.OR;
      }

      // Contar total sempre com Prisma normal
      const sanitizedWhere = this.sanitizeWhereForModel(
        (customQuery as any)?.where || {},
        model,
      );

      const total = await (model as any).count({ 
        where: sanitizedWhere 
      });

      let data: any[];

      if (needsRawQueryOrdering) {
        const localeOrderQuery = {
          ...(customQuery as any),
          where: sanitizedWhere,
        };

        // Usar raw query para ordenação por campo de tabela relacionada
        const orderedByLocale = await this.paginateWithLocaleOrdering(
          model,
          localeTableName,
          localeSortField,
          sortOrder,
          skip,
          pageSize,
          localeOrderQuery,
          total,
        );

        if (orderedByLocale !== null) {
          data = orderedByLocale;
        } else {
          // Degradação: a listagem responde ordenada por id em vez de dar erro
          // por causa de um cabeçalho clicado.
          const fallbackQuery: any = {
            where: sanitizedWhere,
            orderBy: { id: sortOrder },
            take: pageSize,
            skip,
          };

          if ((customQuery as any)?.include) {
            fallbackQuery.include = (customQuery as any).include;
          } else if (selectCondition) {
            fallbackQuery.select = selectCondition;
          }

          data = await (model as any).findMany(fallbackQuery);
        }
      } else {
        // Usar Prisma normal
        const query: any = {
          select: selectCondition,
          where: sanitizedWhere,
          orderBy: sortOrderCondition,
          take: pageSize,
          skip,
        };

        if ((customQuery as any)?.include) {
          query.include = (customQuery as any)?.include;
          delete query.select;
        }

        data = await (model as any).findMany(query);
      }

      const lastPage = Math.ceil(total / pageSize);

      if (translationKey !== undefined && translationKey !== null) {
        data = data.map((item: any) => {
          return itemTranslations(translationKey, item);
        });
      }

      return {
        total,
        lastPage,
        page,
        pageSize,
        prev: page > 1 ? page - 1 : null,
        next: page < lastPage ? page + 1 : null,
        data,
      };
    } catch (error: any) {
      this.logger.error('Pagination Error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Failed to paginate: ${error.message || error}`);
    }
  }

  /**
   * Teto de ids materializados em memória para ordenar por campo traduzido.
   * Acima disso a ordenação degrada para `id`, com aviso no log — preferível a
   * carregar um array gigante e mandá-lo como parâmetro de query.
   */
  private static readonly LOCALE_SORT_ID_LIMIT = 20_000;

  /**
   * Paginação ordenada por coluna da tabela `<model>_locale`.
   *
   * O Prisma não ordena por campo de relação to-many (`<model>_locale` tem uma
   * linha por idioma), então o ORDER BY precisa ser SQL. O **filtro**, porém,
   * continua sendo resolvido pelo Prisma: é o mesmo objeto `where` usado no
   * `count`, com OR/AND e relações, então página e total nunca divergem.
   *
   * Devolve `null` quando não dá para ordenar com segurança (locale não
   * resolvível no include, ou conjunto filtrado grande demais); nesse caso o
   * chamador cai no ordenamento por `id` em vez de estourar a requisição.
   */
  private async paginateWithLocaleOrdering(
    model: any,
    localeTableName: string,
    sortField: string,
    sortOrder: string,
    skip: number,
    take: number,
    customQuery: any,
    total: number,
  ): Promise<any[] | null> {
    try {
      const prisma = model['$parent'];
      const tableName = model.name as string;
      const where = customQuery?.where ?? {};
      const hasFilter = Object.keys(where).length > 0;

      // Sem saber o idioma, o JOIN traria uma linha por tradução e o ORDER BY
      // sairia arbitrário — melhor degradar do que ordenar errado em silêncio.
      const localeFilter = this.extractLocaleFilter(
        customQuery,
        localeTableName,
      );

      if (!localeFilter) {
        this.logger.warn(
          `Sort by "${sortField}" on ${tableName} ignored: locale not resolvable from the include.`,
        );
        return null;
      }

      if (hasFilter && total > PaginationService.LOCALE_SORT_ID_LIMIT) {
        this.logger.warn(
          `Sort by "${sortField}" on ${tableName} ignored: ${total} rows exceed the locale-sort limit.`,
        );
        return null;
      }

      // `sortField` já passou por `model.fields` / `<model>_locale.fields` e
      // `tableName` vem do metadado do Prisma — nenhum dos dois é string livre
      // do usuário. É essa allowlist que impede injeção, e NÃO o
      // `escapeIdentifier` (que devolve o identificador cru; ver
      // databases/abstract.database.ts).
      const params: any[] = [];
      const conditions: string[] = [];

      let joinCondition = `tl.${tableName}_id = t.id`;

      if (localeFilter.kind === 'id') {
        params.push(localeFilter.value);
        joinCondition += ` AND tl.locale_id = $${params.length}`;
      } else {
        params.push(localeFilter.value);
        joinCondition += ` AND tl.locale_id = (SELECT id FROM locale WHERE code = $${params.length})`;
      }

      if (hasFilter) {
        const filtered = await model.findMany({ where, select: { id: true } });

        if (filtered.length === 0) {
          return [];
        }

        params.push(filtered.map((row: any) => row.id));
        conditions.push(`t.id = ANY($${params.length}::int[])`);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';
      const direction =
        String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

      params.push(take);
      const limitIndex = params.length;
      params.push(skip);
      const offsetIndex = params.length;

      // LEFT JOIN + NULLS LAST: registro sem tradução no idioma pedido continua
      // aparecendo, no fim da lista, em vez de sumir da listagem e fazer a
      // página divergir do `total`.
      // `t.id` como desempate: sem ele, nomes repetidos fazem linhas aparecerem
      // duas vezes ou sumirem entre páginas.
      const sql = `
        SELECT t.id
        FROM "${tableName}" t
        LEFT JOIN "${localeTableName}" tl ON ${joinCondition}
        ${whereClause}
        ORDER BY tl."${sortField}" ${direction} NULLS LAST, t.id ASC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `;

      const ordered: Array<{ id: number }> = await prisma.$queryRawUnsafe(
        sql,
        ...params,
      );
      const orderedIds = ordered.map((row) => row.id);

      if (orderedIds.length === 0) {
        return [];
      }

      const hydrateQuery: any = { where: { id: { in: orderedIds } } };

      if (customQuery?.include) {
        hydrateQuery.include = customQuery.include;
      } else if (customQuery?.select) {
        hydrateQuery.select = customQuery.select;
      }

      const data = await model.findMany(hydrateQuery);
      const byId = new Map<number, any>(
        data.map((item: any) => [item.id, item]),
      );

      return orderedIds.map((id) => byId.get(id)).filter(Boolean);
    } catch (error: any) {
      this.logger.error(
        `Error in paginateWithLocaleOrdering: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to paginate with locale ordering: ${error.message}`,
      );
    }
  }

  /**
   * Descobre o idioma da ordenação a partir do `include` de quem chamou —
   * `where: { locale_id }` (formato usado pelos services) ou
   * `where: { locale: { code } }`. Sem nenhum dos dois, devolve `null` e a
   * ordenação por campo traduzido é abandonada.
   */
  private extractLocaleFilter(
    customQuery: any,
    localeTableName: string,
  ): { kind: 'id'; value: number } | { kind: 'code'; value: string } | null {
    const where = customQuery?.include?.[localeTableName]?.where;

    if (!where) {
      return null;
    }

    const localeId =
      typeof where.locale_id === 'number'
        ? where.locale_id
        : typeof where.locale_id?.equals === 'number'
          ? where.locale_id.equals
          : null;

    if (localeId !== null) {
      return { kind: 'id', value: localeId };
    }

    const code =
      typeof where.locale?.code === 'string'
        ? where.locale.code
        : typeof where.locale?.code?.equals === 'string'
          ? where.locale.code.equals
          : null;

    if (code !== null) {
      return { kind: 'code', value: code };
    }

    return null;
  }

  /**
   * Constrói cláusula WHERE para raw queries
   */
  private buildWhereClause(
    where: any,
    tableName: string,
    db: any,
    startIndex: number = 1,
  ): { conditions: string[]; params: any[]; nextIndex: number } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startIndex;

    for (const key in where) {
      if (key === 'OR' || key === 'AND') {
        continue; // Simplificação: ignorar OR/AND por enquanto
      }

      const value = where[key];

      if (typeof value === 'object' && value !== null) {
        // Operadores especiais do Prisma
        if ('in' in value) {
          const placeholders = value.in.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`t.${db.escapeIdentifier(key)} IN (${placeholders})`);
          params.push(...value.in);
        } else if ('contains' in value) {
          conditions.push(`t.${db.escapeIdentifier(key)} ILIKE $${paramIndex}`);
          params.push(`%${value.contains}%`);
          paramIndex++;
        } else if ('equals' in value) {
          conditions.push(`t.${db.escapeIdentifier(key)} = $${paramIndex}`);
          params.push(value.equals);
          paramIndex++;
        }
      } else {
        // Valor simples
        conditions.push(`t.${db.escapeIdentifier(key)} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    return { conditions, params, nextIndex: paramIndex };
  }

  extractFieldNames(model: Record<string, any>): string[] {
    const fieldNames: string[] = [];

    const fields = model.fields;

    for (const key in fields) {
      if (fields && fields.hasOwnProperty(key)) {
        fieldNames.push(key);
      }
    }

    return fieldNames;
  }

  isInvalidField(sortField: string, model: any): boolean {
    return model && model.fields ? !model.fields[sortField] : true;
  }

  /**
   * Model sem tabela `<model>_locale` é o caso comum, não um erro: devolver
   * `true` faz o chamador lançar o `Invalid field: ...` legível. Antes o acesso
   * direto estourava `TypeError` e a API respondia
   * "Cannot read properties of undefined".
   */
  isInvalidLocaleField(sortField: string, model: any): boolean {
    const fields = model?.['$parent']?.[`${model.name}_locale`]?.fields;

    return fields ? !fields[sortField] : true;
  }

  isInvalidFields(fields: string[], model: any): boolean {
    return !fields.every((field) =>
      model.fields ? model && model.fields[field] : false,
    );
  }

  isInvalidLocaleFields(fields: string[], model: any): boolean {
    const localeFields = model['$parent'][`${model.name}_locale`].fields;

    return !fields.every((field) =>
      localeFields ? !localeFields[field] : false,
    );
  }

  async getDb(model: any): Promise<any> {
    const {
      DATABASE_URL,
      DB_HOST,
      DB_PORT,
      DB_USERNAME,
      DB_PASSWORD,
      DB_DATABASE,
    } = model['$parent']._engine.config.env;

    const type = DATABASE_URL.split(':')[0];

    this.db = DatabaseFactory.create(
      type === 'mysql' ? Database.MYSQL : Database.POSTGRES,
      DB_HOST,
      DB_USERNAME,
      DB_PASSWORD,
      DB_DATABASE,
      Number(DB_PORT),
    );

    return this.db;
  }

  async getBuilder(
    model: any,
    tableName: string,
    query: any,
    builder: any,
  ): Promise<any> {
    const db = await this.getDb(model);

    if (!builder) {
      builder = {
        joinTables: [],
        select: [],
        where: [],
        order: [],
        join: [],
        from: db.getColumnNameWithScaping(tableName),
      };
    }

    if (query.orderBy) {
      for (const key in query.orderBy) {
        if (typeof query.orderBy[key] === 'object') {
          if (!builder.joinTables.includes(key)) {
            builder.joinTables.push(key);
            const foreignKey = await db.getColumnNameFromRelation(
              tableName,
              `${tableName}_locale`,
            );

            const primaryKeys = await db.getPrimaryKeys(tableName);

            if (primaryKeys.length !== 1) {
              throw new Error('Only single primary key is supported');
            }

            const primaryKey = primaryKeys[0];

            builder.join.push(
              `LEFT JOIN ${db.getColumnNameWithScaping(key)} ON ${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(foreignKey)} = ${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(primaryKey)}`,
            );

            for (const k in query.orderBy[key]) {
              builder.order.push(
                `${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(k)} ${query.orderBy[key][k]}`,
              );
            }
          }
        }
      }
    }

    if (query.select) {
      builder.select = [
        ...builder.select,
        ...Object.keys(query.select).map(
          (key) =>
            `${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(key)}`,
        ),
      ];
      for (const key in query.select) {
        if (typeof query.select[key] === 'object') {
          builder = await this.getBuilder(
            model,
            key,
            query.select[key],
            builder,
          );
        }
      }
    } else if (query.include) {
      builder.select = [
        ...builder.select,
        `${db.getColumnNameWithScaping(tableName)}.*`,
      ];
      for (const key in query.include) {
        if (typeof query.include[key] === 'object') {
          if (!builder.joinTables.includes(key)) {
            builder.joinTables.push(key);

            const foreignKey = await db.getColumnNameFromRelation(
              tableName,
              key,
            );

            const primaryKeys = await db.getPrimaryKeys(tableName);

            const primaryKey = primaryKeys[0];

            builder.join.push(
              `LEFT JOIN ${db.getColumnNameWithScaping(key)} ON ${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(foreignKey)} = ${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(primaryKey)}`,
            );

            builder = await this.getBuilder(
              model,
              key,
              query.include[key],
              builder,
            );
          }
        }
      }
    }

    if (query.where) {
      for (const key in query.where) {
        if (typeof query.where[key] === 'object') {
          if (!builder.joinTables.includes(key)) {
            builder.joinTables.push(key);
            const foreignKey = await db.getColumnNameFromRelation(
              key,
              tableName,
            );
            const primaryKeys = await db.getPrimaryKeys(key);

            builder.join.push(
              `LEFT JOIN ${db.getColumnNameWithScaping(key)} ON ${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(primaryKeys[0])} = ${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(foreignKey)}`,
            );

            for (const k in query.where[key]) {
              builder.where.push(
                `${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(k)} = ${AbstractDatabase.addSimpleQuotes(query.where[key][k])}`,
              );
            }
          }
        } else {
          builder.where.push(
            `${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(key)} = ${AbstractDatabase.addSimpleQuotes(query.where[key])}`,
          );
        }
      }
    }

    return builder;
  }

  async query(model: any, query: any): Promise<any[]> {
    const db = await this.getDb(model);
    const builder = await this.getBuilder(model, model.name, query, null);

    const sql = [];

    sql.push(`SELECT ${builder.select.join(', ')}`);
    sql.push(`FROM ${builder.from}`);
    if (builder.join.length) sql.push(builder.join.join(' '));
    if (builder.where.length) sql.push(`WHERE ${builder.where.join(' AND ')}`);
    if (builder.order.length) sql.push(`ORDER BY ${builder.order.join(', ')}`);
    if (query.take >= 0 && query.skip >= 0)
      sql.push(db.getLimit(query.take, query.skip));

    const result = await db.query(sql.join(' '));

    return result;
  }
}
