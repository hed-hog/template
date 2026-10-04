# @hed-hog/api-pagination

Paginação e ordenação das listagens da API.

## Ordenação: declare os campos, não a ordem

Toda listagem paginada aceita `sortField` e `sortOrder`. O que decide se o
pedido é atendido é o **descritor** da entidade — uma declaração por entidade
que alimenta o service, o DTO e o tool MCP a partir do mesmo objeto.

Antes do descritor, cada service improvisava a lista de campos (`validSortFields`
inline, `Set` manual, `@IsIn` no DTO, mapa campo→coluna SQL) e a lista era
reescrita à mão no tool MCP ao lado. Era assim que `sac` e `scheduling` ficavam
com allowlist e enum divergentes.

### Declarando

Um arquivo `<entidade>.sort.ts` ao lado do service:

```ts
import { defineSortable } from '@hed-hog/api-pagination';

export const LOCATION_SORT = defineSortable(
  {
    id: true,
    name: true,
    // Escape hatch para ordem composta ou por relação.
    order: { orderBy: (dir) => [{ order: dir }, { name: 'asc' }] },
    is_active: true,
    created_at: { initialOrder: 'desc' },   // direção do 1º clique
  },
  { default: 'order', defaultOrder: 'asc' },
);
```

Para services que paginam em SQL cru, declare a coluna:

```ts
name: { column: 'LOWER(p.name)' },
created_at: { column: 'p.created_at', initialOrder: 'desc' },
```

### Usando

No service:

```ts
return this.pagination.paginatePrismaModel(this.prisma.scheduling_location, {
  page, pageSize, search,
  sortField: paginationParams.sortField,
  sortOrder: paginationParams.sortOrder,
  sort: LOCATION_SORT,          // allowlist + ordem padrão + desempate
  searchFields: ['name', 'phone'],
});
```

No tool MCP — o `enum` sai do mesmo objeto, então não tem como divergir:

```ts
inputSchema: {
  type: 'object',
  properties: {
    ...LOCATION_SORT.toMcpProperties(),
    location_id: { type: 'number', description: 'Filter by location ID' },
  },
},
```

Em SQL cru:

```ts
const sort = COLLABORATOR_SORT.normalize(paginationParams);
const rows = await this.queryRows(
  `${base} ${COLLABORATOR_SORT.toSqlOrderBy(sort)} LIMIT $1 OFFSET $2`,
  [sort.pageSize, sort.offset],
);
return buildPaginationEnvelope(rows, total, sort.page, sort.pageSize);
```

## A regra que mais importa: `orderBy` é default, não trava

A precedência é **`sortField explícito do cliente` → `orderBy`/`default` do
service → `id`**.

Um `orderBy` fixo no `customQuery` já foi uma trava: vencia o pedido do cliente,
e metade dos endpoints aceitava `sortField` e o ignorava em silêncio — resposta
200, ordem de sempre, sem erro nem log. Hoje ele é só a ordem padrão de quem não
pediu nada.

Por isso **não passe `sort` e `orderBy` juntos** — o `orderBy` é ignorado e o
service loga um erro. Mova a ordem padrão para o descritor:

```ts
// errado: a ordem padrão está em dois lugares
{ sort: LOCATION_SORT, orderBy: [{ order: 'asc' }] }

// certo: o descritor é a fonte
defineSortable({ ... }, { default: 'order', defaultOrder: 'asc' })
```

Sem descritor, `defaultSortField`/`defaultSortOrder` fazem o mesmo papel de
forma mais simples.

## Desempate

`toPrismaOrderBy` acrescenta `id` ao final por padrão. Não é enfeite: com
`OFFSET`, duas linhas de mesmo valor trocam de posição entre requisições, e a
paginação repete ou pula registro. Ajuste com `tiebreaker` e `tiebreakerOrder`,
ou desligue com `tiebreaker: null`.

## Campo inválido

- **Com descritor:** cai no default, sem erro. É a mesma escolha do
  `useListUrlState` no admin — URL colada à mão não deve derrubar a tela.
- **Sem descritor:** o `paginate` valida contra as colunas do model e responde
  **400**, com a lista de colunas válidas na mensagem.

Por isso a allowlist declarada na tela precisa bater com a do backend. O lado do
admin está documentado em
`apps/admin/src/components/entity-list/README.md`, seção `SortableTableHead`.

## Colunas traduzíveis

Ordenar por coluna que vive em `<tabela>_locale` (tipo `locale_varchar`)
funciona, desde que o `include` do service carregue o locale — por `locale_id`
ou por `locale: { code }`. Sem isso a ordenação é abandonada em silêncio, com um
`logger.warn`, e a listagem volta a sair por `id`.

O filtro continua sendo resolvido pelo Prisma (o mesmo `where` do `count`) e só
o `ORDER BY` é SQL, com `LEFT JOIN` e `NULLS LAST` — registro sem tradução no
idioma ativo continua aparecendo, no fim da lista, em vez de sumir.

## Nota de build

`apps/api` resolve este pacote pelo **source** (paths do tsconfig), mas todos os
outros consumidores pelo `dist`. Mexeu aqui, rode:

```bash
pnpm --filter @hed-hog/api-pagination build
```

Sem isso a mudança funciona em dev e não funciona em produção — e o sintoma
parece ser do frontend.
