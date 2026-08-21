import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { withConnectionRetry } from './connection-retry';
import { applyPrismaPoolParams } from './datasource-url';
import {
  applyPersonNameToArgs,
  isLikelyCompanyDocument,
} from './format-person-name';
import { PrismaClient } from './generated-client';

/**
 * `data.document` aceita a string direta ou o envelope `{ set: '...' }` do Prisma —
 * mesma forma que `readName`/`writeName` tratam em format-person-name.ts, mas isolado
 * aqui porque é específico do formato de `args` do `commerce_customer`.
 */
function readDocument(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const raw = (data as Record<string, unknown>).document;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof (raw as any).set === 'string') {
    return (raw as any).set;
  }
  return undefined;
}

/**
 * Nome de pessoa sempre pessoa física, sem coluna de tipo a resolver (ver `user`).
 * `field` é a coluna a normalizar — a maioria é `name`, mas `sac_ticket` usa
 * `requester_name`, `sac_ticket_message` usa `author_name`, e `ceia_partner` e
 * `whatsapp_conversation` usam `contact_name` (`ceia_partner` tem as duas colunas ao
 * mesmo tempo: `name` é a organização, `contact_name` é a pessoa).
 */
function alwaysIndividualNameExtension(field: string = 'name') {
  return {
    async $allOperations({ operation, args, query }: any) {
      return query(
        await applyPersonNameToArgs(operation, args, async () => true, field),
      );
    },
  };
}

/**
 * Transformer (late-bound) que decifra integration_profile.config nas leituras. É
 * registrado pelo core (IntegrationCredentialCryptoService) no boot. Fica aqui como
 * função pura para não acoplar este pacote à lógica de cripto do core. Se não houver
 * transformer registrado, é no-op (config segue como veio).
 */
let integrationConfigTransformer: ((config: any) => any) | null = null;

export function registerIntegrationConfigTransformer(
  fn: (config: any) => any,
): void {
  integrationConfigTransformer = fn;
}

// Módulo, e não propriedade da classe: o constructor devolve o client estendido, então
// `this` é descartado e nada declarado como campo sobreviveria. O nome vai literal
// porque a classe ainda está na zona morta temporal quando este módulo é carregado.
const logger = new Logger('PrismaService');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  [key: string]: any;

  constructor() {
    // Aplica o teto de conexões do pool antes de instanciar o client (ver datasource-url.ts).
    // Sem PRISMA_CONNECTION_LIMIT no ambiente devolve undefined e o Prisma resolve o
    // datasource sozinho, preservando o comportamento anterior.
    const datasourceUrl = applyPrismaPoolParams(process.env.DATABASE_URL);
    super(datasourceUrl ? { datasourceUrl } : {});

    // Client sem as extensions, usado só pela normalização de nome para descobrir o
    // tipo da pessoa. Não passa pela extension de novo (é leitura) e, dentro de uma
    // transação interativa, lê pelo MVCC sem esperar o lock de quem está escrevendo.
    const base = this as any;

    // $use foi removido no Prisma 6; usamos uma query extension (substituto oficial).
    // O return-from-constructor faz `new PrismaService()` devolver o client estendido,
    // que encaminha métodos/propriedades customizados desta classe.
    //
    // `$extends` é acessado via `as any` de propósito: no build do Docker o schema.prisma
    // é o stub sem modelos (não há banco para `prisma db pull`), então o client gerado tem
    // um type map vazio e o TS rejeitaria a chave `integration_profile` (TS2353). Em runtime
    // o client real tem o modelo e a extension dispara normalmente. Não tipar aqui é coerente
    // com o resto do arquivo, que já trata o client como `any` (index signature na classe).
    return (this.$extends as any)({
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
        // Nome de pessoa é escrito por ~30 chamadores (CRUD do CRM, import de CSV,
        // cadastro social, provisionamento do legado, checkout, SAC, LMS...), e
        // nenhum deles normalizava a caixa. A regra fica aqui em vez de em cada
        // serviço para valer também para os chamadores que ainda serão escritos.
        // Ver format-person-name.ts para o porquê da regra ser conservadora.
        person: {
          async $allOperations({ operation, args, query }: any) {
            return query(
              await applyPersonNameToArgs(operation, args, async () => {
                // Só chega aqui quando o nome de fato mudaria e a escrita não
                // declara o tipo — um update que mexe só no nome. Pessoa jurídica
                // fica de fora, então na dúvida não normaliza.
                const id = args?.where?.id;
                if (typeof id !== 'number') return false;

                const current = await base.person.findUnique({
                  where: { id },
                  select: { type: true },
                });

                return current?.type === 'individual';
              }),
            );
          },
        },
        user: alwaysIndividualNameExtension(),
        // As cinco a seguir também escrevem nome de pessoa (formulário público de
        // ticket, contato de parceiro, lista de campanha, pushName do WhatsApp) e não
        // têm coluna de tipo — sempre pessoa física, mesmo tratamento que `user`.
        sac_ticket: alwaysIndividualNameExtension('requester_name'),
        sac_ticket_message: alwaysIndividualNameExtension('author_name'),
        ceia_partner: alwaysIndividualNameExtension('contact_name'),
        campaign_recipient: alwaysIndividualNameExtension(),
        whatsapp_conversation: alwaysIndividualNameExtension('contact_name'),
        // commerce_customer também não tem coluna de tipo, mas tem `document`
        // (CPF ou CNPJ). Ver isLikelyCompanyDocument: documento de 14 dígitos não
        // normaliza, o resto (11 dígitos, formato estranho, ausente) normaliza.
        commerce_customer: {
          async $allOperations({ operation, args, query }: any) {
            return query(
              await applyPersonNameToArgs(operation, args, async () => {
                const declared =
                  readDocument(args?.data) ??
                  readDocument(args?.create) ??
                  readDocument(args?.update);
                if (declared !== undefined) return !isLikelyCompanyDocument(declared);

                const id = args?.where?.id;
                if (typeof id !== 'number') return true;

                const current = await base.commerce_customer.findUnique({
                  where: { id },
                  select: { document: true },
                });

                return !isLikelyCompanyDocument(current?.document ?? null);
              }),
            );
          },
        },
      },
    })
      // Extension separada, e aplicada DEPOIS, de propósito: a composição do Prisma
      // coloca a primeira extension por fora, então esta fica na camada mais interna,
      // envolvendo a chamada ao banco. A repetição refaz só a query — não passa de
      // novo pela normalização de nome acima. Vale para todos os models, inclusive os
      // sete que têm override próprio ali em cima.
      .$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }: any) {
              return withConnectionRetry(operation, () => query(args), {
                onRetry: (error) =>
                  logger.warn(
                    `Conexão derrubada pelo servidor em ${model}.${operation}; repetindo uma vez: ${
                      error instanceof Error ? error.message : String(error)
                    }`,
                  ),
              });
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
