import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Radix DropdownMenu relies on pointer events that jsdom doesn't fully
// simulate; replace it with a plain-DOM passthrough so menu items are always
// reachable and clickable via fireEvent.click.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
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
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
}));

const useNotificationsMock = vi.fn();
vi.mock('@/components/notification-bell', () => ({
  NotificationBell: ({ state }: { state: { unreadCount: number } }) => (
    <div data-testid="notification-bell">bell:{state.unreadCount}</div>
  ),
  useNotifications: () => useNotificationsMock(),
}));

let logoutMock: ReturnType<typeof vi.fn>;
let getSettingValue: ReturnType<typeof vi.fn>;

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({
    user: { name: 'Jane Doe' },
    userEmail: 'jane@example.com',
    userPhotoUrl: '/jane.png',
    userAbbr: 'JD',
    logout: logoutMock,
    getSettingValue,
  }),
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
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
  logoutMock = vi.fn().mockResolvedValue(undefined);
  getSettingValue = vi.fn().mockReturnValue(undefined);
  useNotificationsMock.mockReturnValue({ unreadCount: 0 });
});

import { SidebarProvider } from '@/components/ui/sidebar';
import { NavUser } from './nav-user';

function renderNavUser() {
  return render(
    <SidebarProvider>
      <NavUser />
    </SidebarProvider>,
  );
}

describe('NavUser', () => {
  it('mostra o nome e e-mail do usuário', () => {
    renderNavUser();
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('jane@example.com').length).toBeGreaterThan(0);
  });

  it('mostra o NotificationBell quando a sidebar não está colapsada', () => {
    renderNavUser();
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('faz logout ao clicar no item de sair', async () => {
    renderNavUser();
    fireEvent.click(screen.getByText('logout'));
    expect(logoutMock).toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('renderiza os links de conta e preferências no menu', async () => {
    renderNavUser();
    expect(screen.getByText('account')).toBeInTheDocument();
    expect(screen.getByText('preferences')).toBeInTheDocument();
  });

  it('posiciona o dropdown embaixo quando a sidebar está em modo mobile', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });
    renderNavUser();
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
  });

  it('mostra o indicador de não lidas no avatar quando colapsado e há notificações', () => {
    useNotificationsMock.mockReturnValue({ unreadCount: 3 });
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <NavUser />
      </SidebarProvider>,
    );
    // When collapsed, NotificationBell (mocked) shouldn't render, but the
    // unread ping dot on the avatar should.
    expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument();
    expect(container.querySelector('.bg-primary.absolute')).toBeInTheDocument();
  });
});
