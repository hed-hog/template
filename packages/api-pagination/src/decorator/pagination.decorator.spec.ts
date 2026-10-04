import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { Pagination } from './pagination.decorator';
import { PageOrderDirection } from '../enums/patination.enums';

/**
 * `createParamDecorator` não expõe a fábrica; o caminho suportado é aplicar o
 * decorator num método e ler o metadado de rota que o Nest guarda.
 */
function getFactory() {
  class Probe {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@Pagination() params: unknown) {}
  }

  const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler');
  return meta[Object.keys(meta)[0]].factory as (
    data: unknown,
    ctx: unknown
  ) => any;
}

function callWith(query: Record<string, unknown>, body: Record<string, unknown> = {}) {
  const factory = getFactory();
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ query, body }) }),
  };
  return factory(undefined, ctx);
}

describe('@Pagination()', () => {
  describe('sortField', () => {
    it('OMITE a chave quando o cliente não pediu ordenação', () => {
      const result = callWith({});

      // `in`, não `toBeUndefined()`: a diferença é o ponto do teste.
      // `Object.assign({ sortField: 'code' }, params)` — o padrão de
      // api-locale/locale.service.ts — copia chave própria mesmo com valor
      // `undefined`, e sobrescreveria o default do service. Se este teste
      // passar a aceitar `undefined`, o seletor de idioma de todos os apps
      // volta a sair ordenado por id.
      expect('sortField' in result).toBe(false);
    });

    it('a omissão sobrevive ao Object.assign do api-locale', () => {
      const comDefaultDoService = Object.assign(
        { sortField: 'code' },
        callWith({})
      );

      expect(comDefaultDoService.sortField).toBe('code');
    });

    it('omite a chave para string vazia ou só espaços', () => {
      expect('sortField' in callWith({ sortField: '' })).toBe(false);
      expect('sortField' in callWith({ sortField: '   ' })).toBe(false);
    });

    it('mantém o campo pedido, sem os espaços em volta', () => {
      expect(callWith({ sortField: '  name  ' }).sortField).toBe('name');
    });

    it('lê o campo também do corpo da requisição', () => {
      expect(callWith({}, { sortField: 'created_at' }).sortField).toBe(
        'created_at'
      );
    });

    it('a query vence o corpo', () => {
      expect(
        callWith({ sortField: 'da_query' }, { sortField: 'do_body' }).sortField
      ).toBe('da_query');
    });
  });

  describe('sortOrder', () => {
    it('continua com default asc quando ausente', () => {
      // Tirar este default faria os `sortOrder ?? 'desc'` dos services
      // dispararem e inverteria as rotas de sessão.
      expect(callWith({}).sortOrder).toBe(PageOrderDirection.Asc);
    });

    it('valor inválido cai no default, sem lançar', () => {
      expect(callWith({ sortOrder: 'sideways' }).sortOrder).toBe(
        PageOrderDirection.Asc
      );
    });

    it('aceita desc', () => {
      expect(callWith({ sortOrder: 'desc' }).sortOrder).toBe(
        PageOrderDirection.Desc
      );
    });
  });

  describe('demais campos', () => {
    it('mantém os defaults de page, pageSize, search e fields', () => {
      expect(callWith({})).toMatchObject({
        page: 1,
        pageSize: 20,
        search: '',
        fields: '',
      });
    });

    it('repassa o que o cliente mandou', () => {
      expect(callWith({ page: 3, pageSize: 50, search: 'acme' })).toMatchObject({
        page: 3,
        pageSize: 50,
        search: 'acme',
      });
    });
  });
});
