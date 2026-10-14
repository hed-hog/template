# Entity List Components

Reusable components for entity list pages following the HedHog design pattern.

## Components

### PageHeader

Generic header component with breadcrumbs and action buttons.

```tsx
import { PageHeader } from '@/components/entity-list';

<PageHeader
  breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Users' }]}
  actions={[
    {
      label: 'Add User',
      onClick: () => setIsDialogOpen(true),
      variant: 'default',
      icon: <UserPlus className="h-4 w-4" />,
    },
  ]}
/>;
```

### KpiCard / KpiCardsGrid

Standard KPI summary cards. Use `KpiCardsGrid` to lay out a row of `KpiCard`s.

```tsx
import { KpiCardsGrid } from '@/components/ui/kpi-cards-grid';
import type { KpiCardItem } from '@/components/ui/kpi-card';

const items: KpiCardItem[] = [
  { key: 'total', title: 'Total Users', value: 1234, icon: Users },
  { key: 'new', title: 'New (7d)', value: 42, icon: UserPlus },
];

<KpiCardsGrid items={items} />;
```

### SearchBar

Generic search bar with optional filters.

```tsx
import { SearchBar } from '@/components/entity-list';

<SearchBar
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  onSearch={() => refetch()}
  placeholder="Search users..."
  filters={{
    value: statusFilter,
    onChange: (value) => setStatusFilter(value),
    placeholder: 'Filter users',
    options: [
      { label: 'All', value: 'all' },
      { label: 'Active', value: 'active' },
      { label: 'Blocked', value: 'blocked' },
    ],
  }}
/>;
```

### PaginationFooter

Generic pagination footer with page size selector and navigation.

```tsx
import { PaginationFooter } from '@/components/entity-list';

<PaginationFooter
  currentPage={page}
  pageSize={pageSize}
  totalItems={totalItems}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
  pageSizeOptions={[6, 12, 24, 48]}
  selectedCount={selectedCount}
/>;
```

### SortableTableHead

Column header with **server-side** sorting. Wraps the shadcn `TableHead`, so it drops into the
plain-JSX tables used across the admin without pulling in a table library.

Sorting is paired with `useTableSort` (`@/hooks/use-table-sort`), which holds the state and — most
importantly — an **allowlist** of sortable fields. That list is the contract with the backend:
`@Pagination()` answers 400 for a field that does not exist on the model, so a field outside the
list must never reach the query string.

The canonical wiring, in four steps:

```tsx
// 1. Allowlist at the top of the module. Only columns that answer a real
//    question — a hex color or an icon name sorts to nothing useful.
type CategorySortField = 'id' | 'name' | 'slug' | 'status';

const CATEGORY_SORT_FIELDS = ['id', 'name', 'slug', 'status'] as const;
const CATEGORY_SORT_COLUMNS: readonly SortableColumn<CategorySortField>[] =
  CATEGORY_SORT_FIELDS;

// `id desc` rather than the backend default `id asc`: with ascending order a
// freshly created record lands on the last page and looks like it was not saved.
const CATEGORY_DEFAULT_SORT = { field: 'id', order: 'desc' } as const;

// 2. State. Put it in the URL so the sorted list is a shareable link and
//    survives a round trip to a detail screen.
const { page, setPage, sort: urlSort, setSort: setUrlSort /* … */ } =
  useListUrlState({
    filters: CATEGORY_LIST_FILTERS,
    sort: {
      default: CATEGORY_DEFAULT_SORT,
      allowedFields: CATEGORY_SORT_FIELDS,
    },
  });

const sort = useTableSort<CategorySortField>({
  columns: CATEGORY_SORT_COLUMNS,
  defaultSort: CATEGORY_DEFAULT_SORT,
  value: urlSort ?? CATEGORY_DEFAULT_SORT,
  onValueChange: setUrlSort,
});

// 3. Query. `sortField`/`sortOrder` MUST be in the queryKey, otherwise
//    react-query serves the previous order's cache and clicking does nothing.
useQuery({
  queryKey: ['categories', debouncedSearch, page, pageSize, sort.sortField, sort.sortOrder],
  queryFn: () =>
    request({
      url: '/category',
      params: { search, page, pageSize, sortField: sort.sortField, sortOrder: sort.sortOrder },
    }),
});

// 4. Headers. Every column uses the same component; only the sortable ones get
//    `getSortProps`, the rest degrade to a plain TableHead.
<SortableTableHead label={t('name')} {...sort.getSortProps('name')} />
<SortableTableHead label={t('color')} />
<SortableTableHead label={t('total')} align="right" {...sort.getSortProps('total')} />
```

Behaviour worth knowing:

- Two states per column (asc ↔ desc), not three. Server-side pagination always needs a stable
  order, and a third click that "turns sorting off" only reintroduces the default by another name.
- Switching columns **resets** the direction instead of inheriting the previous one — a new column
  opening reversed is always a surprise. Override the opening direction per column with
  `{ field: 'created_at', initialOrder: 'desc' }`.
- `aria-sort` lives on the `<th>`, never on the button, and the neutral arrow only shows on
  hover/focus.
- **The page must go back to 1 when the order changes.** With `useListUrlState` that is automatic.
  Without it, pass `onSortChange: () => setPage(1)` — sorting while on page 3 shows an arbitrary
  slice of the new order.
- Sorting by a translatable column (`locale_varchar`, which lives in `<table>_locale`) is handled
  by `PaginationService.paginate`; it needs the caller's `include` to carry the locale, which the
  generated services already do.
- In "cards" view mode the order still applies — it is server-side — there is just no header to
  click.

### EntityTable — the standard listing table

**Start here for any listing table.** `EntityTable` + `useEntityColumns` is the default shape of a
list in the admin: sortable headers, drag-to-reorder columns, a "which columns are visible"
dropdown, and the user's choice preserved between visits (per user, in `localStorage`). The
`create-crud` generator already emits it, so a screen made by the scaffold is born with all of it.

The screen declares its columns **once**; the hook is the state half and the component the render
half, and both read the same list — so header and body can't drift apart.

```tsx
const columns = useEntityColumns<Ticket>({
  // Estável e única por tabela. Inclua a entidade quando a tela serve mais de uma.
  storageKey: 'sac-tickets-columns-v1',
  columns: [
    {
      id: 'protocol',
      label: t('columnProtocol'),
      sortProps: sort.getSortProps('protocol'), // ausente = cabeçalho sem seta
      className: 'font-mono text-xs',
      cell: (ticket) => ticket.protocol,
    },
    {
      id: 'status',
      label: t('columnStatus'),
      sortProps: sort.getSortProps('status'),
      cell: (ticket) => <Badge>{statusT(ticket.status)}</Badge>,
    },
    {
      id: 'actions',
      label: t('columnActions'),
      align: 'right',
      className: 'text-right',
      hideable: false, // trava: não esconde e não arrasta
      stopClickPropagation: true, // o clique nos botões não vira clique na linha
      cell: (ticket) => renderRowActions(ticket),
    },
  ],
});

<EntityTable
  columns={columns}
  items={paginate.data}
  getRowKey={(ticket) => ticket.id}
  onRowClick={(ticket) => setDetailTicketId(ticket.id)}
/>;
```

What the column fields do:

| campo | efeito |
| --- | --- |
| `id` | o que a preferência do usuário guarda — renomear muda a chave, então troque a `storageKey` junto |
| `label` | cabeçalho e rótulo no menu de colunas (obrigatório: uma coluna sem rótulo é invisível no menu) |
| `labelHidden: true` | o rótulo sai do cabeçalho mas continua no menu de colunas e no leitor de tela (`sr-only`), para a coluna que se explica sozinha — a de seleção, por exemplo. Não confunda com `label` vazio, que apagaria a entrada do menu |
| `sortProps` | `sort.getSortProps('campo')` de `useTableSort`; sem ele o cabeçalho não tem seta |
| `align` | alinhamento do `<th>`; o da célula vai em `className` |
| `className` / `headClassName` | classe da célula / do `<th>` (largura fixa, truncate, cor) |
| `hideable: false` | coluna travada: fora do esconde-mostra e sem alça de arrastar |
| `draggable: true` | com `hideable: false`, a coluna fica sempre visível mas mantém a alça (código, nome) |
| `stopClickPropagation` | a célula não deixa o clique subir para a linha (célula de ações) |
| `cell` | o conteúdo, a partir do item |

Behaviour worth knowing:

- **O menu de colunas vem junto**, acima da tabela e alinhado à direita. Se a tela já tem uma barra
  de filtros onde ele encaixa melhor, passe `showColumnsMenu={false}` e renderize
  `<ColumnsVisibilityMenu {...columns.menuProps} />` no lugar que quiser — é o que o
  `CommerceEntityPage` faz.
- **Linha clicável**: `onRowClick` já cuida do `cursor-pointer`. Quando só algumas linhas abrem algo,
  combine com `isRowClickable`.
- **Duplo clique**: `onRowDoubleClick` para a listagem onde abrir no clique simples atrapalha (o
  clique único já seleciona, ou a navegação acidental custa caro). Os dois convivem, e quem passa só
  o duplo também ganha o `cursor-pointer`; `isRowClickable` vale para ambos.
- `rowProps` é o escape hatch para o resto — abrir em nova aba no clique do meio
  (`onAuxClick`/`onMouseDown`), um `data-*`, um `title`. Vai por último na linha, então sobrescreve
  o que o componente montou; prefira `onRowClick` e `rowClassName` enquanto eles resolverem.
- `body` substitui o corpo inteiro — para um skeleton de carregamento com o mesmo cabeçalho.
- A preferência é por usuário (mesma derivação de dono do `useFormDraft`), então não vaza entre
  contas num navegador compartilhado, e ler/gravar `localStorage` nunca estoura para fora do hook.
- Coluna que sai da declaração é ignorada ao ler a preferência salva; coluna nova entra no fim.
- `ColumnDragContext` envolve a `<Table>` inteira por dentro do componente — dentro de `<thead>` o
  div de acessibilidade do dnd-kit seria HTML inválido e erro de hidratação. Por isso as peças
  soltas (`ColumnDragContext`, `DraggableTableHead`) raramente precisam ser usadas à mão.

### Column ordering & visibility com TanStack

As 16 telas do financeiro montam a tabela com `ColumnDef` + `useReactTable`, e ali o mesmo recurso
sai do `columnOrder`/`columnVisibility` do próprio TanStack, com `@dnd-kit` no arrastar e
`useColumnPreferences` (`@/hooks/use-column-preferences`) guardando a escolha — o mesmo
armazenamento por usuário, protegido por try/catch, do `useFormDraft`. **Em tela nova prefira
`EntityTable`**; esta seção documenta o que já existe.

Vale para páginas que já usam `ColumnDef` + `useReactTable` (veja
`apps/admin/src/app/(app)/(libraries)/crm/accounts/page.tsx`), porque `row.getVisibleCells()` já
respeita `columnOrder` e `columnVisibility`.

The canonical wiring, in five steps:

```tsx
// 1. Columns keep their existing ColumnDef shape — `id` (or `accessorKey`) is the
//    stable id used everywhere else (storage, drag order, visibility map).
const columns = useMemo<ColumnDef<Titulo>[]>(() => [
  { accessorKey: 'document_number', meta: { label: t('columnDocument'), sortField: 'document_number' } satisfies SortableColumnMeta, cell: ... },
  { accessorKey: 'counterpart_name', meta: { label: t('columnSupplier') } satisfies SortableColumnMeta, cell: ... },
  { id: 'actions', meta: { label: t('columnActions') } satisfies SortableColumnMeta, cell: ... },
], [t]);

const columnIds = useMemo(() => columns.map((c) => c.id ?? (c as { accessorKey: string }).accessorKey), [columns]);

// 2. Preferences. storageKey must be stable and unique per table (e.g. `${entity}-columns-v1`).
const columnPrefs = useColumnPreferences({
  storageKey: 'finance-ap-installments-columns-v1',
  columnIds,
  requiredIds: ['actions'], // never hideable
});

// 3. Table: columnOrder/columnVisibility become controlled state fed by the hook.
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  state: { columnOrder: columnPrefs.order, columnVisibility: columnPrefs.visibility },
  onColumnOrderChange: (updater) =>
    columnPrefs.setOrder(typeof updater === 'function' ? updater(columnPrefs.order) : updater),
  onColumnVisibilityChange: (updater) => {
    const next = typeof updater === 'function' ? updater(columnPrefs.visibility) : updater;
    columnIds.forEach((id) => columnPrefs.toggleColumn(id, next[id] ?? true));
  },
});

// 4. Toolbar: one dropdown, listing columns in their current order.
<ColumnsVisibilityMenu
  columns={table.getAllLeafColumns().map((c) => ({ id: c.id, label: (c.columnDef.meta as SortableColumnMeta)?.label ?? c.id, hideable: c.id !== 'actions' }))}
  hidden={columnIds.filter((id) => !columnPrefs.visibility[id])}
  onToggle={columnPrefs.toggleColumn}
  onReset={columnPrefs.reset}
/>

// 5. Wrap the WHOLE <Table> in ColumnDragContext — not just the header row — and
//    swap SortableTableHead for DraggableTableHead in the header.
<ColumnDragContext columnOrder={columnPrefs.order} onReorder={columnPrefs.setOrder}>
  <Table>
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta as SortableColumnMeta | undefined;
            return (
              <DraggableTableHead
                key={header.id}
                columnId={header.column.id}
                label={meta?.label ?? ''}
                align={meta?.align}
                dragDisabled={header.column.id === 'actions'}
                {...(meta?.sortField ? sort.getSortProps(meta.sortField) : {})}
              />
            );
          })}
        </TableRow>
      ))}
    </TableHeader>
    <TableBody>{/* ...row.getVisibleCells()/flexRender, as usual... */}</TableBody>
  </Table>
</ColumnDragContext>
```

Behaviour worth knowing:

- **`ColumnDragContext` must wrap the entire `<Table>`, never just `<TableHeader>` or the header
  `<TableRow>`.** It renders `DndContext` under the hood, which mounts a hidden accessibility `<div>`
  (screen-reader drag instructions/live region, via `@dnd-kit/accessibility`) as a child of wherever
  it's placed. Put it inside `<TableHeader>` and that `<div>` ends up as a direct child of `<thead>` —
  invalid HTML, and React throws "In HTML, `<div>` cannot be a child of `<thead>`. This will cause a
  hydration error." `useSortable`/`DraggableTableHead` don't care where in the tree `ColumnDragContext`
  sits (they resolve it through React context, not DOM proximity), so wrapping the whole `<Table>`
  costs nothing and keeps the div outside the table entirely.
- `requiredIds` (e.g. `['actions']`) both disables the drag handle and disables its checkbox in the
  dropdown — an actions column with no label and no data to sort makes little sense hidden or moved.
- Preferences are scoped per logged-in user (same owner-key derivation as `useFormDraft`), so they
  don't leak between accounts on a shared browser, and reading/writing `localStorage` never throws
  past the hook.
- Reordering only rearranges — `row.getVisibleCells()` already returns cells in `columnOrder`, so the
  body needs no change beyond already using `getVisibleCells()`/`flexRender()` (as `crm/accounts`
  does).

#### `useEntityColumnTable` + `EntityTable`

The five-step wiring above is what the first pages (Financeiro) hand-rolled, and it repeats near
verbatim across every page that adopts the feature. New pages should use
`useEntityColumnTable` (`@/hooks/use-entity-column-table`) and `EntityTable`
(`@/components/entity-list`) instead of repeating it — Financeiro is left as-is, not migrated.

```tsx
const columns = useMemo<ColumnDef<Course>[]>(() => [
  { accessorKey: 'name', meta: { label: t('columnName'), sortField: 'name' } satisfies EntityColumnMeta, cell: ... },
  { accessorKey: 'status', meta: { label: t('columnStatus') } satisfies EntityColumnMeta, cell: ... },
  { id: 'actions', cell: ... }, // sem meta: fica de fora do drag/visibilidade, sempre por último
], [t]);

const { table, columnPrefs, visibilityMenuProps } = useEntityColumnTable({
  storageKey: 'lms-courses-columns-v1',
  columns,
  data: courses,
});

// Toolbar
<ColumnsVisibilityMenu {...visibilityMenuProps} />

// Onde antes ia <Table>...</Table> por completo
<EntityTable table={table} columnPrefs={columnPrefs} getSortProps={sort.getSortProps} />
```

Behaviour worth knowing:

- `columnIds` defaults to every column id/`accessorKey` except `id: 'actions'` — the same convention
  Financeiro uses (excluding it from `COLUMN_IDS` rather than passing `requiredIds`). Pass an explicit
  `columnIds` only when a page has a different fixed column or more than one.
- `EntityTable` renders the whole `<Table>` (header + body), so it already wraps itself in
  `ColumnDragContext` — don't wrap it again. Use `rowProps`/`cellClassName` for the per-row/per-cell
  customization (`onDoubleClick`, `className`) that pages used to put directly on `TableRow`/`TableCell`.
- Wide tables keep their horizontal scrollbar pinned to the bottom of the window
  (`StickyHorizontalScroll`), in both modes: with many rows the native bar would only show up after the
  last row. Nothing to configure — give the table a `min-w-*` via `tableClassName`/`className` and it
  appears whenever the columns overflow.
- `getSortProps` is optional — omit it on a page with no server-side sort, and columns with
  `meta.sortField` simply render without the sort affordance.
- Still needs `ColumnDef` + real per-column `cell` functions; a hand-rolled `<TableHead>`/`<TableCell>`
  page has to move its JSX into `cell` first, same prerequisite as the manual pattern above.

### EntityCard

Generic card component for displaying entity items in a grid.

```tsx
import { EntityCard } from '@/components/entity-list';

<EntityCard
  avatar={{
    src: getPhotoUrl(user.photo_id),
    fallback: user.name.charAt(0),
  }}
  title={user.name}
  description={user.email}
  badges={[
    { label: 'Active', variant: 'default' },
    { label: 'Verified', variant: 'secondary' },
  ]}
  metadata={[
    {
      label: 'ID',
      value: `#${user.id}`,
      icon: <Fingerprint className="h-3 w-3" />,
    },
    {
      label: 'Created',
      value: '2 days ago',
      icon: <Clock className="h-3 w-3" />,
    },
  ]}
  actions={[
    { label: 'Edit', onClick: () => handleEdit(user), variant: 'outline' },
    {
      label: 'Delete',
      onClick: () => handleDelete(user),
      variant: 'destructive',
    },
  ]}
  onClick={() => handleView(user)}
/>;
```

## Pattern

The standard entity list page follows this structure:

1. **PageHeader** - Breadcrumbs and action buttons
2. **KpiCardsGrid** - Statistics overview (from `@/components/ui/kpi-cards-grid`)
3. **SearchBar** - Search input and filters
4. **Entity Grid/List** - Display entities (can use EntityCard)
5. **PaginationFooter** - Pagination controls

For admin list pages, prefer a flat layout for these sections instead of wrapping search and list content inside one parent `Card`. This matches the users screen and the catalog resource pages.

### On phones (below `sm`)

The shared components already handle the phone layout. A page only has to avoid undoing it:

- **KPIs:** with 5 or more KPIs, `KpiCardsGrid` becomes a horizontally scrollable strip, so the list is visible without scrolling past three rows of cards. With 4 or fewer it stays a 2-column grid.
- **Filters:** the `SearchBar` search input takes its own row, and the `controls` form a 2-column grid of equal width. The last control spans the row when the count is odd. Give a control `sm:w-*` widths, never a fixed `w-*`, which would break the grid on phones. A `custom` control should render `w-full sm:w-*` for the same reason.
- **Period, columns and view mode:** keep them on one row next to the filters. `DateRangePicker` stretches with `className="min-w-0 flex-1 sm:flex-none"` and `triggerClassName="min-w-0 flex-1 justify-start"`. `ColumnsVisibilityMenu` shows only its icon on phones. Render it in that row (`showColumnsMenu={false}` on `EntityTable`) instead of on a line of its own above the table.

Reference: `apps/admin/src/app/(app)/(libraries)/social/posts/page.tsx`.

## Example Usage

See the first generated page under `apps/admin/src/app/(app)/(libraries)/<library>/<entity>/page.tsx` for a complete example of using these components together (this folder is empty in a fresh template checkout — it is generated by `hedhog dev create-library` / `assets-to-library`).
