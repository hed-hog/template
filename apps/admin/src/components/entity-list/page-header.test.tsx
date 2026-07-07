import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: (props: Record<string, unknown>) => (
    <button data-testid="sidebar-trigger" {...props} />
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
    asChild,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    asChild?: boolean;
  }) =>
    asChild ? (
      <>{children}</>
    ) : (
      <div
        role="menuitem"
        aria-disabled={disabled}
        onClick={disabled ? undefined : onClick}
      >
        {children}
      </div>
    ),
}));

const useIsMobileMock = vi.fn();
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => useIsMobileMock(),
}));

import { PageHeader, type PageHeaderAction } from './page-header';

describe('PageHeader — desktop', () => {
  it('renderiza breadcrumbs simples (sem href) separados corretamente', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<PageHeader breadcrumbs={[{ label: 'Início' }, { label: 'Atual' }]} />);
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Atual')).toBeInTheDocument();
  });

  it('renderiza breadcrumb com href como link', () => {
    useIsMobileMock.mockReturnValue(false);
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Início', href: '/inicio' }, { label: 'Atual' }]}
      />
    );
    const link = screen.getByText('Início').closest('a');
    expect(link).toHaveAttribute('href', '/inicio');
  });

  it('sem título nem descrição, não renderiza o bloco de título', () => {
    useIsMobileMock.mockReturnValue(false);
    const { container } = render(
      <PageHeader breadcrumbs={[{ label: 'Único' }]} />
    );
    expect(container.querySelector('h1')).not.toBeInTheDocument();
  });

  it('renderiza título, descrição e extraContent quando informados', () => {
    useIsMobileMock.mockReturnValue(false);
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Único' }]}
        title="Meu título"
        description="Minha descrição"
        extraContent={<span data-testid="extra">extra</span>}
      />
    );
    expect(screen.getByText('Meu título')).toBeInTheDocument();
    expect(screen.getByText('Minha descrição')).toBeInTheDocument();
    expect(screen.getByTestId('extra')).toBeInTheDocument();
  });

  it('renderiza título como ReactNode', () => {
    useIsMobileMock.mockReturnValue(false);
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Único' }]}
        title={<span data-testid="title-node">Título Node</span>}
      />
    );
    expect(screen.getByTestId('title-node')).toBeInTheDocument();
  });

  it('actions como array vazio não renderiza nenhuma ação', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<PageHeader breadcrumbs={[{ label: 'Único' }]} actions={[]} />);
    expect(screen.queryByRole('button', { name: /ação/i })).not.toBeInTheDocument();
  });

  it('actions como ReactNode renderiza o conteúdo diretamente', () => {
    useIsMobileMock.mockReturnValue(false);
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Único' }]}
        actions={<button data-testid="custom-action">Custom</button>}
      />
    );
    expect(screen.getByTestId('custom-action')).toBeInTheDocument();
  });

  it('renderiza ações padrão (não iconOnly) com ícone, label e variant default', () => {
    useIsMobileMock.mockReturnValue(false);
    const onClick = vi.fn();
    const actions: PageHeaderAction[] = [
      { label: 'Salvar', onClick, icon: <span data-testid="save-icon" /> },
    ];
    render(<PageHeader breadcrumbs={[{ label: 'Único' }]} actions={actions} />);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId('save-icon')).toBeInTheDocument();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renderiza ação disabled sem ícone', () => {
    useIsMobileMock.mockReturnValue(false);
    const actions: PageHeaderAction[] = [
      { label: 'Bloqueada', onClick: vi.fn(), disabled: true },
    ];
    render(<PageHeader breadcrumbs={[{ label: 'Único' }]} actions={actions} />);
    expect(screen.getByRole('button', { name: 'Bloqueada' })).toBeDisabled();
  });

  it('renderiza ação iconOnly dentro de Tooltip usando ariaLabel', () => {
    useIsMobileMock.mockReturnValue(false);
    const actions: PageHeaderAction[] = [
      {
        label: 'Excluir',
        ariaLabel: 'Excluir item',
        onClick: vi.fn(),
        icon: <span data-testid="icon-only-icon" />,
        iconOnly: true,
      },
    ];
    render(<PageHeader breadcrumbs={[{ label: 'Único' }]} actions={actions} />);
    const button = screen.getByRole('button', { name: 'Excluir item' });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'Excluir item'
    );
    expect(screen.getByTestId('icon-only-icon')).toBeInTheDocument();
  });

  it('renderiza ação iconOnly usando label como ariaLabel de fallback e size customizado', () => {
    useIsMobileMock.mockReturnValue(false);
    const actions: PageHeaderAction[] = [
      {
        label: 'Config',
        onClick: vi.fn(),
        iconOnly: true,
        size: 'icon-lg',
      },
    ];
    render(<PageHeader breadcrumbs={[{ label: 'Único' }]} actions={actions} />);
    expect(screen.getByRole('button', { name: 'Config' })).toBeInTheDocument();
  });
});

describe('PageHeader — mobile', () => {
  it('com apenas 1 breadcrumb, usa o layout padrão de lista (não o menu mobile)', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<PageHeader breadcrumbs={[{ label: 'Único' }]} />);
    expect(screen.getByText('Único')).toBeInTheDocument();
    expect(screen.queryByTestId('dropdown-content')).not.toBeInTheDocument();
  });

  it('com múltiplos breadcrumbs, mostra home (sem href) + atual, sem dropdown de níveis intermediários', () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Início' }, { label: 'Atual' }]}
      />
    );
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Atual')).toBeInTheDocument();
  });

  it('com múltiplos breadcrumbs e home com href, renderiza link para home', () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <PageHeader
        breadcrumbs={[
          { label: 'Início', href: '/inicio' },
          { label: 'Meio' },
          { label: 'Atual' },
        ]}
      />
    );
    const link = screen.getByText('Início').closest('a');
    expect(link).toHaveAttribute('href', '/inicio');
    expect(screen.getByText('Atual')).toBeInTheDocument();
  });

  it('com breadcrumbs intermediários, exibe o menu de níveis com itens (href e sem href)', () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <PageHeader
        breadcrumbs={[
          { label: 'Início' },
          { label: 'Meio 1', href: '/meio-1' },
          { label: 'Meio 2' },
          { label: 'Atual' },
        ]}
      />
    );
    expect(screen.getByText('Meio 1')).toBeInTheDocument();
    expect(screen.getByText('Meio 2')).toBeInTheDocument();
    const middleLink = screen.getByText('Meio 1').closest('a');
    expect(middleLink).toHaveAttribute('href', '/meio-1');
  });

  it('actions vazias não renderizam o menu de ações mobile', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<PageHeader breadcrumbs={[{ label: 'Único' }]} actions={[]} />);
    expect(screen.queryByTestId('dropdown-content')).not.toBeInTheDocument();
  });

  it('renderiza menu mobile de ações com ícone e item desabilitado, e dispara onClick', () => {
    useIsMobileMock.mockReturnValue(true);
    const onClick = vi.fn();
    const onClickDisabled = vi.fn();
    const actions: PageHeaderAction[] = [
      { label: 'Editar', onClick, icon: <span data-testid="edit-icon" /> },
      { label: 'Excluir', onClick: onClickDisabled, disabled: true },
    ];
    render(<PageHeader breadcrumbs={[{ label: 'Único' }]} actions={actions} />);
    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
    const editItem = screen.getByText('Editar').closest('[role="menuitem"]')!;
    (editItem as HTMLElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);

    const deleteItem = screen.getByText('Excluir').closest('[role="menuitem"]')!;
    expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
    (deleteItem as HTMLElement).click();
    expect(onClickDisabled).not.toHaveBeenCalled();
  });

  it('actions como ReactNode no mobile renderiza o conteúdo diretamente', () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Único' }]}
        actions={<button data-testid="custom-mobile-action">Custom</button>}
      />
    );
    expect(screen.getByTestId('custom-mobile-action')).toBeInTheDocument();
  });
});
