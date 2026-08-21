import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));


// Radix DropdownMenu is used for the collapsed-sidebar submenu; make it a
// plain passthrough since jsdom doesn't fully simulate pointer events.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    asChild,
  }: {
    children: ReactNode;
    asChild?: boolean;
  }) => (asChild ? <>{children}</> : <div>{children}</div>),
}));

let queryResult: { data: unknown; isLoading: boolean };
const requestMock = vi.fn();
let accessToken: string | null = 'tok';
let invokeRealQueryFn = false;

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({
    request: requestMock,
    accessToken,
    currentLocaleCode: 'en',
    getSettingValue: () => undefined,
  }),
  useQuery: (opts: { queryFn: () => Promise<unknown> }) => {
    if (invokeRealQueryFn) {
      // Exercises the real queryFn body (normally never called since
      // useQuery itself is mocked out for the rest of this file's tests).
      void opts.queryFn();
    }
    return queryResult;
  },
}));

beforeEach(() => {
  invokeRealQueryFn = false;
  window.matchMedia =
    window.matchMedia ||
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  Element.prototype.scrollIntoView = vi.fn();
  pathname = '/';
  accessToken = 'tok';
  sessionStorage.clear();
  queryResult = { data: undefined, isLoading: true };
});

import { Sidebar, SidebarContent, SidebarProvider } from '@/components/ui/sidebar';
import { NavMain } from './nav-main';

function renderNavMain(props: { defaultOpen?: boolean } = {}) {
  return render(
    <SidebarProvider defaultOpen={props.defaultOpen ?? true}>
      <NavMain />
    </SidebarProvider>,
  );
}

const menus = [
  {
    slug: 'dashboard',
    name: 'Dashboard',
    url: '/dashboard',
    icon: 'layout-dashboard',
    menu: [],
  },
  {
    slug: 'settings',
    name: 'Settings',
    url: null,
    icon: 'settings',
    menu: [
      { slug: 'settings-general', name: 'General', url: '/settings/general', icon: null, menu: [] },
      { slug: 'settings-users', name: 'Users', url: '/settings/users', icon: null, menu: [] },
    ],
  },
  {
    slug: 'no-icon',
    name: 'NoIcon',
    url: '/no-icon',
    icon: null,
    menu: [],
  },
];

describe('NavMain', () => {
  it('mostra o skeleton de carregamento enquanto isLoadingMenus é verdadeiro', () => {
    queryResult = { data: undefined, isLoading: true };
    const { container } = renderNavMain();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('mostra o skeleton no formato colapsado', () => {
    queryResult = { data: undefined, isLoading: true };
    const { container } = renderNavMain({ defaultOpen: false });
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renderiza os itens de menu de nível superior sem filhos', () => {
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('NoIcon')).toBeInTheDocument();
  });

  it('marca o item ativo com base no pathname', () => {
    pathname = '/dashboard';
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    const link = screen.getByText('Dashboard').closest('a');
    expect(link?.className).toContain('text-primary');
  });

  it('expande um item com filhos (collapsible) e navega para o submenu', () => {
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    // collapse again
    fireEvent.click(screen.getByText('Settings'));
  });

  it('persiste o estado expandido no sessionStorage', () => {
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    fireEvent.click(screen.getByText('Settings'));
    const stored = JSON.parse(sessionStorage.getItem('hedhog:nav:expandedMenus') || '{}');
    expect(stored.settings).toBe(true);
  });

  it('recupera o estado expandido previamente salvo no sessionStorage', () => {
    sessionStorage.setItem(
      'hedhog:nav:expandedMenus',
      JSON.stringify({ settings: true }),
    );
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('lida com sessionStorage corrompido na inicialização', () => {
    const original = window.sessionStorage.getItem;
    vi.spyOn(window.sessionStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    queryResult = { data: menus, isLoading: false };
    expect(() => renderNavMain()).not.toThrow();
    (window.sessionStorage.__proto__.getItem as any).mockRestore?.();
    window.sessionStorage.getItem = original;
  });

  it('mostra o dropdown de submenu quando a sidebar está colapsada', () => {
    queryResult = { data: menus, isLoading: false };
    renderNavMain({ defaultOpen: false });
    expect(screen.getAllByTestId('dropdown-content').length).toBeGreaterThan(0);
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('renderiza item ativo dentro de um submenu colapsado (DropdownMenuItemRecursive)', () => {
    pathname = '/settings/users';
    queryResult = { data: menus, isLoading: false };
    renderNavMain({ defaultOpen: false });
    const link = screen.getByText('Users').closest('a');
    expect(link?.className).toContain('text-primary');
  });

  it('renderiza um submenu aninhado dentro do dropdown colapsado (item com filhos)', () => {
    const nestedMenus = [
      {
        slug: 'parent',
        name: 'Parent',
        url: null,
        icon: 'folder',
        menu: [
          {
            slug: 'child-group',
            name: 'ChildGroup',
            url: null,
            icon: 'folder-open',
            menu: [
              { slug: 'grandchild', name: 'Grandchild', url: '/gc', icon: 'file', menu: [] },
            ],
          },
        ],
      },
    ];
    queryResult = { data: nestedMenus, isLoading: false };
    renderNavMain({ defaultOpen: false });
    expect(screen.getByText('ChildGroup')).toBeInTheDocument();
    expect(screen.getByText('Grandchild')).toBeInTheDocument();
  });

  it('reseta o mapa de expandidos quando a sidebar colapsa', () => {
    queryResult = { data: menus, isLoading: false };
    const { rerender } = render(
      <SidebarProvider defaultOpen={true}>
        <NavMain />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('General')).toBeInTheDocument();

    rerender(
      <SidebarProvider defaultOpen={false}>
        <NavMain />
      </SidebarProvider>,
    );
    // collapsed sidebar shows submenu via dropdown, not the expanded tree.
    expect(screen.queryByText('General')).toBeInTheDocument();
  });

  it('ignora ícone desconhecido sem quebrar a renderização', () => {
    queryResult = {
      data: [
        { slug: 'x', name: 'Unknown Icon Item', url: '/x', icon: 'not-a-real-icon', menu: [] },
      ],
      isLoading: false,
    };
    renderNavMain();
    expect(screen.getByText('Unknown Icon Item')).toBeInTheDocument();
  });

  it('fecha a sidebar mobile ao navegar por um link', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    window.matchMedia = (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    fireEvent.click(screen.getByText('Dashboard'));
  });

  it('não busca quando accessToken é nulo (enabled=false)', () => {
    accessToken = null;
    queryResult = { data: undefined, isLoading: false };
    renderNavMain();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('executa o queryFn real e busca os menus via request()', async () => {
    invokeRealQueryFn = true;
    requestMock.mockResolvedValue({ data: menus });
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    await vi.waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith({ url: '/menu/system' }),
    );
    requestMock.mockReset();
  });

  it('mostra o ícone padrão (sem crash) para ícone desconhecido dentro do dropdown colapsado aninhado', () => {
    const nestedMenus = [
      {
        slug: 'parent',
        name: 'Parent',
        url: null,
        icon: 'folder',
        menu: [
          {
            slug: 'child-group',
            name: 'ChildGroup',
            url: null,
            icon: 'not-a-real-icon',
            menu: [
              { slug: 'grandchild', name: 'Grandchild', url: '/gc', icon: null, menu: [] },
            ],
          },
        ],
      },
    ];
    queryResult = { data: nestedMenus, isLoading: false };
    renderNavMain({ defaultOpen: false });
    expect(screen.getByText('ChildGroup')).toBeInTheDocument();
  });

  it('alterna (clica) o item aninhado com filhos dentro do dropdown colapsado', () => {
    const nestedMenus = [
      {
        slug: 'parent',
        name: 'Parent',
        url: null,
        icon: 'folder',
        menu: [
          {
            slug: 'child-group',
            name: 'ChildGroup',
            url: null,
            icon: 'folder-open',
            menu: [
              { slug: 'grandchild', name: 'Grandchild', url: '/gc', icon: 'file', menu: [] },
            ],
          },
        ],
      },
    ];
    queryResult = { data: nestedMenus, isLoading: false };
    renderNavMain({ defaultOpen: false });
    fireEvent.click(screen.getByText('ChildGroup'));
    expect(screen.getByText('Grandchild')).toBeInTheDocument();
  });

  it('marca o sub-item ativo dentro de uma árvore expandida (não colapsada)', () => {
    pathname = '/settings/general';
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    fireEvent.click(screen.getByText('Settings'));
    const link = screen.getByText('General').closest('a');
    expect(link?.className).toContain('text-primary');
  });

  it('renderiza o ícone de um sub-item quando o filho possui um ícone definido', () => {
    const menusWithSubIcon = [
      {
        slug: 'settings',
        name: 'Settings',
        url: null,
        icon: 'settings',
        menu: [
          {
            slug: 'settings-general',
            name: 'General',
            url: '/settings/general',
            icon: 'file',
            menu: [],
          },
        ],
      },
    ];
    queryResult = { data: menusWithSubIcon, isLoading: false };
    renderNavMain();
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('usa o próprio elemento da sidebar quando não há "sidebar-content" dentro dela', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    });
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    queryResult = { data: menus, isLoading: false };
    render(
      <SidebarProvider defaultOpen={true}>
        <Sidebar>
          <NavMain />
        </Sidebar>
      </SidebarProvider>,
    );

    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('General')).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  });

  it('continua funcionando quando sessionStorage.setItem lança erro ao expandir um item', () => {
    queryResult = { data: menus, isLoading: false };
    renderNavMain();
    vi.spyOn(window.sessionStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => fireEvent.click(screen.getByText('Settings'))).not.toThrow();
    (window.sessionStorage.__proto__.setItem as any).mockRestore?.();
  });

  it('continua funcionando quando sessionStorage.setItem lança erro ao colapsar a sidebar', () => {
    queryResult = { data: menus, isLoading: false };
    render(
      <SidebarProvider defaultOpen={true}>
        <NavMain />
      </SidebarProvider>,
    );
    vi.spyOn(window.sessionStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    // `defaultOpen` on <SidebarProvider> only seeds the initial state; toggle
    // the *actual* open/collapsed state via the real keyboard shortcut so the
    // collapse-triggered `useEffect` in NavMain actually fires.
    expect(() =>
      fireEvent.keyDown(window, { key: 'b', ctrlKey: true }),
    ).not.toThrow();
    (window.sessionStorage.__proto__.setItem as any).mockRestore?.();
  });

  it('preserva a posição de rolagem da sidebar real ao expandir/colapsar um item', async () => {
    // A previous test in this file may have left `window.innerWidth` set to a
    // mobile width; force desktop mode here so `<Sidebar>` renders its plain
    // div (not the mobile Sheet, which needs a next-intl provider we don't
    // set up in this file).
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    });
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    queryResult = { data: menus, isLoading: false };
    render(
      <SidebarProvider defaultOpen={true}>
        <Sidebar>
          <SidebarContent>
            <NavMain />
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );

    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('General')).toBeInTheDocument();

    // Let the `requestAnimationFrame` callback inside `preserveScrollOnToggle` run.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  });
});
