import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';

// SidebarContent calls usePathname() directly.
vi.mock('next/navigation', () => ({
  usePathname: () => '/current-path',
}));

// The mobile Sidebar renders inside Sheet/ResizableSheetContent (Radix Dialog +
// next-intl). We replace them with lightweight passthroughs, matching the
// convention used by entity-picker.test.tsx, so mobile tests don't need a full
// next-intl/Radix portal setup.
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock('@/components/ui/resizable-sheet-content', () => ({
  ResizableSheetContent: ({
    children,
    sheetId: _sheetId,
    defaultWidth: _defaultWidth,
    minWidth: _minWidth,
    maxWidth: _maxWidth,
    enableResize: _enableResize,
    ...domProps
  }: {
    children: React.ReactNode;
    sheetId?: string;
    defaultWidth?: number;
    minWidth?: number;
    maxWidth?: number;
    enableResize?: boolean;
  } & Record<string, unknown>) => <div {...domProps}>{children}</div>,
}));

// Radix Tooltip only mounts its content on hover/focus; the sidebar convention
// (see pagination-footer.test.tsx) is to replace it with a passthrough so the
// `hidden`/children props on SidebarMenuButton's tooltip are directly assertable.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: ({
    children,
    hidden,
  }: {
    children?: React.ReactNode;
    hidden?: boolean;
  }) => (hidden ? null : <div data-testid="tooltip-content">{children}</div>),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// SidebarProvider reads menu-width from useApp().getSettingValue.
const { appState } = vi.hoisted(() => ({
  appState: {
    getSettingValue: vi.fn((_key: string) => undefined as string | undefined),
  },
}));
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => appState,
}));

// useIsMobile is mocked per describe-block below to force both branches.
const { isMobileState } = vi.hoisted(() => ({ isMobileState: { value: false } }));
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileState.value,
}));

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './sidebar';

// SidebarRail also exposes an accessible name of "Toggle Sidebar", so we can't
// disambiguate SidebarTrigger by role/name alone when both are rendered.
function getTrigger() {
  return document.querySelector(
    '[data-slot="sidebar-trigger"]'
  ) as HTMLButtonElement;
}

function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

function FullSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  return (
    <SidebarProvider>
      <Sidebar {...props}>
        <SidebarHeader>Header</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Group Label</SidebarGroupLabel>
            <SidebarGroupAction>Action</SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Tooltip text">
                    Menu Item
                  </SidebarMenuButton>
                  <SidebarMenuAction>MenuAction</SidebarMenuAction>
                  <SidebarMenuBadge>3</SidebarMenuBadge>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="#">Sub item</SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarInput placeholder="Search" />
        </SidebarContent>
        <SidebarFooter>Footer</SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>Inset content</SidebarInset>
      <SidebarTrigger />
    </SidebarProvider>
  );
}

describe('useSidebar', () => {
  it('lança erro quando usado fora de um SidebarProvider', () => {
    // Suppress the expected React error boundary console output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSidebar())).toThrow(
      'useSidebar must be used within a SidebarProvider.'
    );
    spy.mockRestore();
  });
});

describe('SidebarProvider - desktop', () => {
  beforeEach(() => {
    isMobileState.value = false;
    clearCookies();
    appState.getSettingValue.mockReturnValue(undefined);
  });

  afterEach(() => {
    clearCookies();
  });

  it('renderiza expandido por padrão (defaultOpen=true) e persiste no cookie ao alternar', () => {
    render(<FullSidebar />);

    const sidebarEl = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebarEl).toHaveAttribute('data-state', 'expanded');

    fireEvent.click(getTrigger());

    expect(document.cookie).toContain('sidebar_state=false');
  });

  it('respeita defaultOpen=false', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarContent>content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );

    const sidebarEl = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebarEl).toHaveAttribute('data-state', 'collapsed');
  });

  it('usa open/onOpenChange controlados quando fornecidos', () => {
    const onOpenChange = vi.fn();

    function Controlled() {
      const [open, setOpen] = require('react').useState(true);
      return (
        <SidebarProvider
          open={open}
          onOpenChange={(value: boolean) => {
            onOpenChange(value);
            setOpen(value);
          }}
        >
          <Sidebar>
            <SidebarContent>content</SidebarContent>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>
      );
    }

    render(<Controlled />);
    fireEvent.click(getTrigger());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('alterna a sidebar com o atalho de teclado Ctrl+B', () => {
    render(<FullSidebar />);

    const sidebarEl = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebarEl).toHaveAttribute('data-state', 'expanded');

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

    expect(document.cookie).toContain('sidebar_state=false');
  });

  it('alterna a sidebar com o atalho de teclado Cmd+B (metaKey)', () => {
    render(<FullSidebar />);
    fireEvent.keyDown(window, { key: 'b', metaKey: true });
    expect(document.cookie).toContain('sidebar_state=false');
  });

  it('ignora teclas que não são o atalho configurado', () => {
    render(<FullSidebar />);
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    const sidebarEl = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebarEl).toHaveAttribute('data-state', 'expanded');
  });

  it('usa a largura de menu customizada quando getSettingValue retorna um valor', () => {
    appState.getSettingValue.mockReturnValue('20');
    render(<FullSidebar />);
    const wrapper = document.querySelector(
      '[data-slot="sidebar-wrapper"]'
    ) as HTMLElement;
    expect(wrapper.style.getPropertyValue('--sidebar-width')).toBe('20rem');
  });

  it('renderiza collapsible="none" sem wrapper responsivo', () => {
    render(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <SidebarContent>plain content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );
    const sidebarEl = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebarEl).not.toHaveAttribute('data-state');
    expect(screen.getByText('plain content')).toBeInTheDocument();
  });

  it('renderiza variantes floating e inset e o lado direito', () => {
    const { rerender } = render(
      <SidebarProvider>
        <Sidebar variant="floating" side="right">
          <SidebarContent>content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );
    let sidebarEl = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebarEl).toHaveAttribute('data-variant', 'floating');
    expect(sidebarEl).toHaveAttribute('data-side', 'right');

    rerender(
      <SidebarProvider>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarContent>content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );
    sidebarEl = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebarEl).toHaveAttribute('data-variant', 'inset');
  });

  it('restaura e persiste a posição de rolagem via sessionStorage', () => {
    sessionStorage.setItem('hedhog:nav:scrollTop', '42');

    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent data-testid="sc">content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );

    const content = screen.getByTestId('sc');
    expect(content.scrollTop).toBe(42);

    Object.defineProperty(content, 'scrollTop', {
      value: 100,
      writable: true,
    });
    fireEvent.scroll(content);
    expect(sessionStorage.getItem('hedhog:nav:scrollTop')).toBe('100');

    sessionStorage.clear();
  });

  it('não restaura/persiste rolagem quando colapsada', () => {
    sessionStorage.setItem('hedhog:nav:scrollTop', '42');

    render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarContent data-testid="sc">content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );

    const content = screen.getByTestId('sc');
    expect(content.scrollTop).toBe(0);

    fireEvent.scroll(content);
    expect(sessionStorage.getItem('hedhog:nav:scrollTop')).toBe('42');

    sessionStorage.clear();
  });

  it('ignora um valor de rolagem inválido armazenado', () => {
    sessionStorage.setItem('hedhog:nav:scrollTop', 'not-a-number');

    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent data-testid="sc">content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );

    const content = screen.getByTestId('sc');
    expect(content.scrollTop).toBe(0);

    sessionStorage.clear();
  });

  it('chama o onScroll customizado além de persistir a posição', () => {
    const onScroll = vi.fn();

    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent data-testid="sc" onScroll={onScroll}>
            content
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );

    fireEvent.scroll(screen.getByTestId('sc'));
    expect(onScroll).toHaveBeenCalled();
  });

  it('encaminha ref de callback e de objeto para o elemento de conteúdo', () => {
    const callbackRef = vi.fn();
    const objectRef = React.createRef<HTMLDivElement>();

    const { rerender } = render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent ref={callbackRef}>content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );
    expect(callbackRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));

    rerender(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent ref={objectRef}>content</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );
    expect(objectRef.current).toBeInstanceOf(HTMLDivElement);
  });

  it('setOpen aceita um valor booleano direto, não apenas uma função updater', () => {
    function DirectSetter() {
      const { setOpen, state } = useSidebar();
      return (
        <>
          <span data-testid="state">{state}</span>
          <button onClick={() => setOpen(false)}>Set Closed</button>
        </>
      );
    }

    render(
      <SidebarProvider>
        <DirectSetter />
      </SidebarProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set Closed' }));
    expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
  });
});

describe('SidebarProvider - mobile', () => {
  beforeEach(() => {
    isMobileState.value = true;
    clearCookies();
    appState.getSettingValue.mockReturnValue(undefined);
  });

  afterEach(() => {
    clearCookies();
  });

  it('renderiza a sidebar dentro de um Sheet quando openMobile é true, e o trigger abre/fecha', () => {
    render(<FullSidebar />);

    // Mobile sheet starts closed.
    expect(document.querySelector('[data-mobile="true"]')).not.toBeInTheDocument();

    fireEvent.click(getTrigger());

    expect(document.querySelector('[data-mobile="true"]')).toBeInTheDocument();
  });

  it('o atalho de teclado alterna openMobile em vez do cookie', () => {
    render(<FullSidebar />);

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

    expect(document.querySelector('[data-mobile="true"]')).toBeInTheDocument();
    // Cookie is not touched on mobile toggles.
    expect(document.cookie).not.toContain('sidebar_state=');
  });

  it('SidebarTrigger reflete o estado aberto/fechado via aria-expanded', () => {
    render(<FullSidebar />);
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('chama o onClick customizado do SidebarTrigger além de alternar', () => {
    const onClick = vi.fn();
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>content</SidebarContent>
        </Sidebar>
        <SidebarTrigger onClick={onClick} />
      </SidebarProvider>
    );
    fireEvent.click(getTrigger());
    expect(onClick).toHaveBeenCalled();
  });
});

describe('componentes compostos', () => {
  beforeEach(() => {
    isMobileState.value = false;
    clearCookies();
    appState.getSettingValue.mockReturnValue(undefined);
  });

  it('SidebarMenuButton renderiza variantes, tamanhos, isActive e asChild', () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton variant="outline" size="lg" isActive data-testid="btn">
          Item
        </SidebarMenuButton>
        <SidebarMenuButton asChild size="sm">
          <a href="#link">Link Item</a>
        </SidebarMenuButton>
      </SidebarProvider>
    );

    const btn = screen.getByTestId('btn');
    expect(btn).toHaveAttribute('data-active', 'true');
    expect(btn).toHaveAttribute('data-size', 'lg');
    expect(screen.getByRole('link', { name: 'Link Item' })).toBeInTheDocument();
  });

  it('SidebarMenuButton exibe tooltip como string quando colapsado no desktop', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarMenuButton tooltip="Dica simples">Item</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'Dica simples'
    );
  });

  it('SidebarMenuButton aceita tooltip como objeto de props', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarMenuButton
          tooltip={{ children: 'Dica objeto', side: 'right' }}
        >
          Item
        </SidebarMenuButton>
      </SidebarProvider>
    );
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'Dica objeto'
    );
  });

  it('SidebarMenuButton oculta o tooltip quando expandida no desktop', () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton tooltip="Dica oculta">Item</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
  });

  it('SidebarMenuButton sem tooltip renderiza apenas o botão', () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton data-testid="no-tooltip">Item</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(screen.getByTestId('no-tooltip')).toBeInTheDocument();
    expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
  });

  it('SidebarGroupLabel e SidebarGroupAction suportam asChild', () => {
    render(
      <>
        <SidebarGroupLabel asChild>
          <span data-testid="label-slot">Label</span>
        </SidebarGroupLabel>
        <SidebarGroupAction asChild>
          <a href="#action" data-testid="action-slot">
            Action
          </a>
        </SidebarGroupAction>
      </>
    );
    expect(screen.getByTestId('label-slot')).toBeInTheDocument();
    expect(screen.getByTestId('action-slot')).toBeInTheDocument();
  });

  it('SidebarMenuAction suporta showOnHover e asChild', () => {
    render(
      <>
        <SidebarMenuAction showOnHover data-testid="hover-action" />
        <SidebarMenuAction asChild>
          <button data-testid="action-slot-child">Action</button>
        </SidebarMenuAction>
      </>
    );
    expect(screen.getByTestId('hover-action')).toBeInTheDocument();
    expect(screen.getByTestId('action-slot-child')).toBeInTheDocument();
  });

  it('SidebarMenuSubButton suporta tamanhos, isActive e asChild', () => {
    render(
      <>
        <SidebarMenuSubButton data-testid="sub-sm" size="sm" isActive>
          Sub
        </SidebarMenuSubButton>
        <SidebarMenuSubButton asChild size="md">
          <a href="#sub" data-testid="sub-slot">
            Sub Link
          </a>
        </SidebarMenuSubButton>
      </>
    );
    const sub = screen.getByTestId('sub-sm');
    expect(sub).toHaveAttribute('data-active', 'true');
    expect(sub).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('sub-slot')).toBeInTheDocument();
  });

  it('SidebarMenuSkeleton renderiza com e sem ícone', () => {
    const { rerender } = render(<SidebarMenuSkeleton data-testid="skeleton" />);
    expect(
      document.querySelector('[data-sidebar="menu-skeleton-icon"]')
    ).not.toBeInTheDocument();

    rerender(<SidebarMenuSkeleton showIcon data-testid="skeleton" />);
    expect(
      document.querySelector('[data-sidebar="menu-skeleton-icon"]')
    ).toBeInTheDocument();
  });

  it('renderiza SidebarMenu, SidebarMenuItem, SidebarMenuBadge e SidebarSeparator', () => {
    render(
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuBadge>5</SidebarMenuBadge>
        </SidebarMenuItem>
      </SidebarMenu>
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renderiza SidebarInset e SidebarInput com className customizada', () => {
    render(
      <>
        <SidebarInset className="custom-inset" data-testid="inset" />
        <SidebarInput className="custom-input" placeholder="busca" />
      </>
    );
    expect(screen.getByTestId('inset')).toHaveClass('custom-inset');
    expect(screen.getByPlaceholderText('busca')).toHaveClass('custom-input');
  });
});
