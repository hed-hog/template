import { itemTranslations } from '@hed-hog/api';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
} from './constants/pagination.constants';
import { AbstractDatabase, Database, DatabaseFactory } from './databases';
import { PageOrderDirection } from './enums/patination.enums';
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
      orderBy?: any;
    }) {

      try {

      const {
        page = 1,
        pageSize = 10,
        search,
        sortField = 'id',
        sortOrder = 'desc',
        validSortFields = ['id'],
        searchFields = [],
        where: customWhere,
        include,
        select,
        orderBy: customOrderBy,
      } = options;

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

      const orderBy = customOrderBy ?? (
        sortField && typeof sortField === 'string' && validSortFields.includes(sortField)
          ? { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' }
          : { id: 'desc' }
      );

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

      if (sortField && !customOrderBy) {
        const invalid = this.isInvalidField(sortField, model);
        let localeInvalid = false;
                
        if (invalid) {
          localeInvalid = this.isInvalidLocaleField(sortField, model);
          
          if (localeInvalid) {
            this.logger.error(`Invalid field: ${sortField}`);
            throw new BadRequestException(
              `Invalid field: ${sortField}. Valid columns are: ${this.extractFieldNames(
                model,
              ).join(', ')}`,
            );
          } else {
            // Field exists in the locale table - needs to use raw query
            localeTableName = `${(model as any).name}_locale`;
            localeSortField = sortField;
            needsRawQueryOrdering = true;
          }
        } else {
          sortOrderCondition = { [sortField]: sortOrder };
        }
      }

      if (customOrderBy) {
        sortOrderCondition = customOrderBy;
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

      // Always count the total with regular Prisma
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

        // Use raw query for ordering by a related table field
        data = await this.paginateWithLocaleOrdering(
          model,
          localeTableName,
          localeSortField,
          sortOrder,
          skip,
          pageSize,
          localeOrderQuery,
        );
      } else {
        // Use regular Prisma
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
   * Helper method for pagination with ordering by locale table fields
   * Uses raw query for ordering, but keeps Prisma's nested structure
   */
  private async paginateWithLocaleOrdering(
    model: any,
    localeTableName: string,
    sortField: string,
    sortOrder: string,
    skip: number,
    take: number,
    customQuery?: any,
  ): Promise<any[]> {
    try {
      const tableName = (model as any).name;
      const db = await this.getDb(model);
      
      // Detect locale code from include (if available)
      let localeCode = 'en'; // fallback
      if (customQuery?.include?.[localeTableName]?.where?.locale?.code) {
        localeCode = customQuery.include[localeTableName].where.locale.code;
      }

      // Build the raw query's WHERE clause
      const whereConditions: string[] = [];
      let whereParams: any[] = [];
      let paramIndex = 1;

      if (customQuery?.where) {
        const { conditions, params, nextIndex } = this.buildWhereClause(
          customQuery.where,
          tableName,
          db,
          paramIndex,
        );
        whereConditions.push(...conditions);
        whereParams.push(...params);
        paramIndex = nextIndex;
      }

      // Add locale filter
      whereConditions.push(`l.code = $${paramIndex}`);
      whereParams.push(localeCode);
      paramIndex++;

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Query to fetch ordered IDs
      const orderDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const orderByClause = `ORDER BY tl.${db.escapeIdentifier(sortField)} ${orderDirection}`;
      
      const rawQuery = `
        SELECT DISTINCT t.id
        FROM ${db.escapeIdentifier(tableName)} t
        LEFT JOIN ${db.escapeIdentifier(localeTableName)} tl ON t.id = tl.${tableName}_id
        LEFT JOIN locale l ON tl.locale_id = l.id
        ${whereClause}
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      whereParams.push(take, skip);

      // Execute raw query to get ordered IDs
      const orderedIds = await db.queryRaw(rawQuery, whereParams);
      
      if (!orderedIds || orderedIds.length === 0) {
        return [];
      }

      const ids = orderedIds.map((row: any) => row.id);

      // Fetch full data with Prisma while keeping the nested structure
      const query: any = {
        where: {
          id: { in: ids },
          ...(customQuery?.where || {}),
        },
      };

      if (customQuery?.include) {
        query.include = customQuery.include;
      }

      if (customQuery?.select) {
        query.select = customQuery.select;
      }

      const data = await model.findMany(query);

      // Reorder data to keep the raw query's order
      const orderedData = ids
        .map(id => data.find((item: any) => item.id === id))
        .filter(Boolean);

      return orderedData;

    } catch (error: any) {
      this.logger.error(`Error in paginateWithLocaleOrdering: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Failed to paginate with locale ordering: ${error.message}`
      );
    }
  }

  /**
   * Builds the WHERE clause for raw queries
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
        continue; // Simplification: ignore OR/AND for now
      }

      const value = where[key];

      if (typeof value === 'object' && value !== null) {
        // Special Prisma operators
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
        // Simple value
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

  isInvalidLocaleField(sortField: string, model: any): boolean {
    const fields = model['$parent'][`${model.name}_locale`].fields;

    return model && fields ? !fields[sortField] : true;
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
