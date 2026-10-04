import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ accessToken: 'token-de-teste', user: { id: 7 } }),
}));

// Mesmo recorte de `page-header.test.tsx`: o dropdown do Radix não abre em
// jsdom, então o conteúdo do menu de colunas é renderizado direto.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="menu-de-colunas">{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: ReactNode;
    onSelect?: () => void;
  }) => (
    <div role="menuitem" onClick={onSelect}>
      {children}
    </div>
  ),
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    disabled,
    onCheckedChange,
  }: {
    children: ReactNode;
    checked?: boolean;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <div
      role="menuitemcheckbox"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={disabled ? undefined : () => onCheckedChange?.(!checked)}
    >
      {children}
    </div>
  ),
}));

import {
  useEntityColumns,
  type EntityTableColumn,
} from '@/hooks/use-entity-columns';
import { EntityTable } from './entity-table';

type Pedido = { id: number; cliente: string; valor: string };

const PEDIDOS: Pedido[] = [
  { id: 1, cliente: 'Maria', valor: 'R$ 10,00' },
  { id: 2, cliente: 'João', valor: 'R$ 20,00' },
];

const CHAVE = 'entity-table-test-columns-v1';

function colunas(aoEditar?: (item: Pedido) => void): EntityTableColumn<Pedido>[] {
  return [
    { id: 'cliente', label: 'Cliente', cell: (item) => item.cliente },
    {
      id: 'valor',
      label: 'Valor',
      align: 'right',
      className: 'text-right',
      cell: (item) => item.valor,
    },
    {
      id: 'actions',
      label: 'Ações',
      align: 'right',
      hideable: false,
      stopClickPropagation: true,
      cell: (item) => (
        <button type="button" onClick={() => aoEditar?.(item)}>
          editar {item.id}
        </button>
      ),
    },
  ];
}

function Tela({
  onRowClick,
  onRowDoubleClick,
  rowProps,
  onEdit,
}: {
  onRowClick?: (item: Pedido) => void;
  onRowDoubleClick?: (item: Pedido) => void;
  rowProps?: (item: Pedido) => Record<string, unknown>;
  onEdit?: (item: Pedido) => void;
}) {
  const columns = useEntityColumns<Pedido>({
    storageKey: CHAVE,
    columns: colunas(onEdit),
  });

  return (
    <EntityTable
      columns={columns}
      items={PEDIDOS}
      getRowKey={(item) => item.id}
      onRowClick={onRowClick}
      onRowDoubleClick={onRowDoubleClick}
      rowProps={rowProps}
    />
  );
}

const cabecalhos = () =>
  screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());

describe('EntityTable + useEntityColumns', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('monta cabeçalho e corpo a partir da mesma lista de colunas', () => {
    render(<Tela />);

    expect(cabecalhos()).toEqual(['Cliente', 'Valor', 'Ações']);
    expect(screen.getAllByRole('row')).toHaveLength(3); // cabeçalho + 2 pedidos
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('R$ 20,00')).toBeInTheDocument();
  });

  it('esconder uma coluna tira o cabeçalho E a célula, e grava a preferência', () => {
    render(<Tela />);

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Valor' }));

    expect(cabecalhos()).toEqual(['Cliente', 'Ações']);
    expect(screen.queryByText('R$ 20,00')).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CHAVE) ?? '{}')).toMatchObject(
      { hidden: ['valor'] }
    );
  });

  it('coluna travada não esconde nem arrasta', () => {
    render(<Tela />);

    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Ações' })
    ).toHaveAttribute('aria-disabled', 'true');

    const th = screen
      .getAllByRole('columnheader')
      .find((head) => head.textContent?.includes('Ações'));
    expect(
      within(th as HTMLElement).queryByRole('button', {
        name: /dragHandle/i,
      })
    ).not.toBeInTheDocument();
  });

  it('respeita a ordem já salva no localStorage', () => {
    window.localStorage.setItem(
      CHAVE,
      JSON.stringify({ order: ['valor', 'cliente', 'actions'], hidden: [] })
    );

    render(<Tela />);

    expect(cabecalhos()).toEqual(['Valor', 'Cliente', 'Ações']);
  });

  it('clique na linha abre o item, mas o clique na célula de ações não vaza', () => {
    const onRowClick = vi.fn();
    const onEdit = vi.fn();
    render(<Tela onRowClick={onRowClick} onEdit={onEdit} />);

    fireEvent.click(screen.getByText('Maria'));
    expect(onRowClick).toHaveBeenCalledWith(PEDIDOS[0]);

    fireEvent.click(screen.getByRole('button', { name: 'editar 2' }));
    expect(onEdit).toHaveBeenCalledWith(PEDIDOS[1]);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('sem onRowClick a linha não vira clicável', () => {
    render(<Tela />);

    const linha = screen.getByText('Maria').closest('tr');
    expect(linha).not.toHaveClass('cursor-pointer');
  });

  it('só com onRowDoubleClick o clique simples não abre, o duplo abre', () => {
    const onRowDoubleClick = vi.fn();
    render(<Tela onRowDoubleClick={onRowDoubleClick} />);

    fireEvent.click(screen.getByText('Maria'));
    expect(onRowDoubleClick).not.toHaveBeenCalled();

    fireEvent.doubleClick(screen.getByText('Maria'));
    expect(onRowDoubleClick).toHaveBeenCalledWith(PEDIDOS[0]);

    // a aforância tem que acompanhar: quem só abre no duplo também é clicável.
    expect(screen.getByText('Maria').closest('tr')).toHaveClass(
      'cursor-pointer'
    );
  });

  it('rowProps chega na linha sem derrubar o que o componente montou', () => {
    const onRowClick = vi.fn();
    const onAuxClick = vi.fn();
    render(
      <Tela
        onRowClick={onRowClick}
        rowProps={(item) => ({ onAuxClick, 'data-pedido': item.id })}
      />
    );

    const linha = screen.getByText('Maria').closest('tr') as HTMLElement;
    expect(linha).toHaveAttribute('data-pedido', '1');

    // `fireEvent.auxClick` não existe nesta versão; o evento vai na mão.
    fireEvent(linha, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(onAuxClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Maria'));
    expect(onRowClick).toHaveBeenCalledWith(PEDIDOS[0]);
    expect(linha).toHaveClass('cursor-pointer');
  });
});
