# Admin App

Estas instrucoes se aplicam a `apps/admin`.

## Estrutura de pagina

- Todas as paginas devem renderizar `Page` contendo `PageHeader`.
- Manter consistencia com o layout e os componentes ja existentes no app.
- Em CRUDs/listagens, usar a tela de Assentos como referencia principal de densidade compacta e distribuicao visual.

## Padrao de listagem

- Use `apps/admin/src/app/(app)/(libraries)/contact/accounts/page.tsx` as the canonical reference for admin CRUD/list page layout.
- For pages with search/filter + alternate visualizations, keep a single flat toolbar row: `SearchBar` on the left and the `Tabela/Cards` `ToggleGroup` on the right, following `accounts`.
- Do not wrap the toolbar or the main list block in an extra parent `Card`, and do not add duplicate list titles/descriptions below `PageHeader` unless the flow truly needs a separate contextual alert.
- Para paginas de listagem, seguir o fluxo visual: `PageHeader` -> `StatsCards` (quando houver KPIs) -> `SearchBar` -> lista -> `PaginationFooter`.
- Em linhas, cards ou itens de lista clicaveis, aplicar `cursor-pointer` (ou estilo equivalente) como indicacao visual obrigatoria de interacao.
- A acao principal de cadastro deve ficar em `PageHeader.actions`.
- Em listagens CRUD, a acao principal normalmente deve abrir um `Sheet` lateral direito para create/edit.
- Quando houver metricas uteis, buscar pelo menos 4 KPIs ou mais para manter a mesma densidade visual entre telas.
- O `SearchBar` deve ficar logo abaixo dos KPIs, com busca, filtros e botao de busca alinhados na mesma linha quando houver espaco.
- A linha de filtros tambem pode incluir datas, agrupamentos e outros filtros recorrentes, mas deve permanecer um unico bloco horizontal quando a largura permitir.
- Nao colocar o botao primario de cadastro no mesmo bloco horizontal do `SearchBar`; a linha abaixo dos KPIs deve ficar reservada para busca, filtros e botao `Buscar`.
- Renderizar os itens logo abaixo, em tabela ou grid de cards conforme o caso.
- Quando nao houver itens, renderizar um empty state padrao com contorno pontilhado cinza claro, icone central, titulo/descricao e botao primario para criar o primeiro registro.
- Preferir tabela para dados operacionais com varias colunas, badges e acoes em linha; usar grid/card para itens mais visuais.
- Em linhas ou cards, manter uma linguagem recorrente: avatar ou logo quando aplicavel, nome principal com subtitulo secundario como email em cinza, badges compactos e acoes por icone ou botoes pequenos.
- Evitar um `Card` contêiner principal envolvendo busca/filtros e a listagem inteira; preferir estrutura plana como na tela de usuarios e nas listagens do `catalog`.
- Reaproveitar primeiro os componentes de `apps/admin/src/components/entity-list` antes de criar outra variacao estrutural.

## Dados e contexto

- Usar `useQuery` e `useApp` de `@hed-hog/next-app-provider`.
- Nao importar `@tanstack/react-query` diretamente.
- Usar `request` de `useApp()` para chamadas autenticadas ao backend.

## Formularios

- Todos os formularios devem usar `react-hook-form` com `zodResolver`.
- Todos os campos devem ser renderizados com `FormField` e primitives de formulario do Shadcn.
- Evitar formularios HTML simples ou inputs nao controlados.
- Reutilizar o mesmo componente para create e edit quando isso reduzir duplicacao sem piorar a clareza.
- Em listagens CRUD, preferir `Sheet` lateral para create/edit em vez de dialog com JSON bruto.
- O botao primario de create/edit deve ter texto contextual por entidade, como `Nova Marca`, `Novo Site`, `Novo Produto`.
- Campos devem ocupar toda a largura disponivel do bloco/coluna em que estiverem.
- Adicionar placeholders orientativos nos campos; em campos ricos, expor dica equivalente quando placeholder nativo nao existir.
- Para relacoes frequentes, usar autocomplete/combobox com busca, selecao, limpar selecao e, quando fizer sentido, criacao inline em um novo `Sheet`.
- For searchable entity relation fields with inline creation, use the shared `EntityPicker` from `@/components/ui/entity-picker` as the default implementation. Do not create new library-scoped `*FieldWithCreate` or `*SelectWithCreate` variants unless they are thin semantic adapters over `EntityPicker`.
- Para formularios administrativos que precisam de rascunho, usar o hook compartilhado em `apps/admin/src/hooks/use-form-draft.ts` em vez de logica local isolada. Os drafts devem permanecer no localStorage com isolamento por usuario, restaurar apenas para o mesmo usuario apos expiracao involuntaria da sessao, ser limpos no submit bem-sucedido e removidos no logout manual.
- Nunca persistir senhas, tokens ou arquivos/blob brutos no draft.
- Reservar `Select` simples para enums/status; nao usar select simples para relacoes se ja houver componente de autocomplete compartilhado.
- Para campos de upload, incluir progresso, feedback visual do arquivo vinculado, troca e remocao.
- Para upload de imagem, incluir preview da imagem atual e placeholder visual quando vazio.
- No rodape do `Sheet`, preferir apenas o botao principal de submit em largura total quando o fechamento pelo `X` for suficiente.
- Campos de descricao editavel devem preferir `RichTextEditor`.
- `Switch` deve ser renderizado sem moldura extra de input fake.
- `RichTextEditor` deve ficar contido no `Sheet`, respeitando largura do container e sem overflow horizontal.
- Para logo/avatar, preferir preview quadrado pequeno ao lado das acoes do upload, sem card contêiner grande.

## Componentes compartilhados

- Componentes genericos, independentes de dominio e reutilizaveis em varios fluxos devem morar em `apps/admin/src/components`.
- Componentes especializados de um modulo podem morar no proprio modulo e ainda assim serem importados por outros modulos quando esse reuso fizer sentido.
- Se um componente deixar de ser especifico de um modulo e passar a atender o admin de forma ampla, promova-o para `apps/admin/src/components`.
- Antes de criar um componente novo, verificar se o caso pode ser atendido por um componente compartilhado ja existente ou por extensao pequena de um componente atual.

## Confirmacoes e UX

- Para acoes destrutivas ou irreversiveis, usar `AlertDialog` do Shadcn.
- Nao usar `window.confirm`.
- Manter textos localizados com `useTranslations()`.

## Tabelas e listagens

- Em footers de paginacao, seguir o padrao responsivo ja adotado no projeto.
- Reaproveitar componentes, hooks e convencoes visuais existentes antes de introduzir nova variacao.
- Em relatorios e dashboards, usar paletas coloridas com cores distintas por serie/categoria e evitar barras/pizzas monocromaticas.

## Utilitarios

- Para imagem por id, usar `getPhotoUrl` quando esse for o padrao do ponto de uso.
- Para obter email do usuario, usar `getUserEmail` quando aplicavel.

## Assets para libraries

- Sempre que houver mudancas em `apps/admin/src/app/(app)/(libraries)` ou em `apps/admin/messages`, executar `hedhog dev assets-to-library` com as libraries afetadas.
- Descobrir a library pelo path:
  - `apps/admin/src/app/(app)/(libraries)/<library>/...`
  - `apps/admin/messages/<library>/...`
- Exemplos:
  - `hedhog dev assets-to-library core`
  - `hedhog dev assets-to-library core lms finance`
