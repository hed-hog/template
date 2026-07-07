import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './generated-client';

/**
 * Late-bound transformer that decrypts integration_profile.config on reads. It is
 * registered by the core (IntegrationCredentialCryptoService) at boot time. It lives
 * here as a pure function to avoid coupling this package to the core's crypto logic.
 * If no transformer is registered, it is a no-op (config stays as-is).
 */
let integrationConfigTransformer: ((config: any) => any) | null = null;

export function registerIntegrationConfigTransformer(
  fn: (config: any) => any,
): void {
  integrationConfigTransformer = fn;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  [key: string]: any;

  constructor() {
    super();
    // $use was removed in Prisma 6; we use a query extension (the official replacement).
    // The return-from-constructor makes `new PrismaService()` return the extended client,
    // which forwards this class's custom methods/properties.
    return this.$extends({
      query: {
        integration_profile: {
          async $allOperations({ args, query }: any) {
            const result = await query(args);
            if (!integrationConfigTransformer) return result;
            const apply = (row: any) => {
              if (row && typeof row === 'object' && row.config) {
                row.config = integrationConfigTransformer!(row.config);
              }
              return row;
            };
            if (Array.isArray(result)) result.forEach(apply);
            else if (result) apply(result);
            return result;
          },
        },
      },
    }) as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  getProvider() {
    return (this as any)._engineConfig.activeProvider;
  }

  isPostgres() {
    return this.getProvider() === 'postgresql';
  }

  isMysql() {
    return this.getProvider() === 'mysql';
  }

  createInsensitiveSearch(
    fields: string[],
    paginationParams: { search: string },
  ): any[] {
    const searchValue = paginationParams.search;
    const OR: any[] = [];

    if (!searchValue) {
      return OR;
    }

    fields.forEach((field) => {
      if (field === 'id' && !isNaN(+searchValue) && +searchValue > 0) {
        OR.push({ id: { equals: +searchValue } });
      } else if (
        field === 'method' &&
        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(
          searchValue,
        )
      ) {
        OR.push({ method: { equals: searchValue } });
      } else if (field !== 'method') {
        if (typeof searchValue === 'string') {
          const condition = { [field]: { contains: searchValue } };

          if (this.isPostgres()) {
            (condition[field] as any).mode = 'insensitive';
          }

          OR.push(condition);
        }
      }
    });

    if (!isNaN(+searchValue) && +searchValue > 0) {
      OR.push({ id: { equals: +searchValue } });
    }

    return OR;
  }

  getFields(modelName: string, forSearch: boolean = false) {
    const model = this[modelName];
    const fields = forSearch ? Object.entries(model.fields)
      .filter(([_, meta]: [string, any]) => meta.typeName === 'String')
      .map(([field]) => field) : Object.keys(model.fields);
      
    return fields;
  }

  getValidData(modelName: string, data: any) {
    const validData: any = {};

    for (const fieldName of this.getFields(modelName)) {
      validData[fieldName] = data[fieldName];
    }

    return validData;
  }


}
