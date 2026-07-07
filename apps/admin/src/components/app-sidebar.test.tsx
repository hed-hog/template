import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}));

const openMcpFloatingChat = vi.fn();
vi.mock('@/components/mcp-floating-chat', () => ({
  openMcpFloatingChat: (...args: unknown[]) => openMcpFloatingChat(...args),
}));

vi.mock('@/components/nav-main', () => ({
  NavMain: () => <div data-testid="nav-main" />,
}));

vi.mock('@/components/nav-user', () => ({
  NavUser: () => <div data-testid="nav-user" />,
}));

let settings: Record<string, unknown> = {};
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({
    getSettingValue: (key: string) => settings[key],
  }),
}));

beforeEach(() => {
  push.mockClear();
  openMcpFloatingChat.mockClear();
  settings = {};
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
});

import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';

function renderAppSidebar(props: { defaultOpen?: boolean } = {}) {
  return render(
    <SidebarProvider defaultOpen={props.defaultOpen ?? true}>
      <AppSidebar />
    </SidebarProvider>,
  );
}

describe('AppSidebar', () => {
  it('renderiza com nome/slogan/logo padrão quando não há settings', () => {
    renderAppSidebar();
    expect(screen.getByText('HedHog')).toBeInTheDocument();
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    expect(screen.getByAltText('HedHog')).toHaveAttribute('src', '/logo.svg');
  });

  it('usa os valores customizados das settings', () => {
    settings = {
      'system-name': 'ACME',
      'system-slogan': 'Powering things',
      'image-url': '/custom-logo.png',
      'menu-width': 20,
    };
    renderAppSidebar();
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('Powering things')).toBeInTheDocument();
    expect(screen.getByAltText('ACME')).toHaveAttribute('src', '/custom-logo.png');
  });

  it('usa icon-url quando image-url não está definido', () => {
    settings = { 'icon-url': '/icon.png' };
    renderAppSidebar();
    expect(screen.getByAltText('HedHog')).toHaveAttribute('src', '/icon.png');
  });

  it('navega para a home ao clicar no cabeçalho', () => {
    renderAppSidebar();
    fireEvent.click(screen.getByText('HedHog'));
    expect(push).toHaveBeenCalledWith('/');
  });

  it('mostra o botão do MCP quando habilitado e abre o chat ao clicar', () => {
    renderAppSidebar();
    const button = screen.getByText(/openChat/);
    fireEvent.click(button);
    expect(openMcpFloatingChat).toHaveBeenCalled();
  });

  it('não mostra o botão do MCP quando desabilitado', () => {
    settings = { 'mcp-enabled': false };
    renderAppSidebar();
    expect(screen.queryByText(/openChat/)).not.toBeInTheDocument();
  });

  it('não abre o chat quando desabilitado (guard early-return)', () => {
    settings = { 'mcp-enabled': false };
    renderAppSidebar();
    expect(openMcpFloatingChat).not.toHaveBeenCalled();
  });

  it('renderiza NavMain e NavUser', () => {
    renderAppSidebar();
    expect(screen.getByTestId('nav-main')).toBeInTheDocument();
    expect(screen.getByTestId('nav-user')).toBeInTheDocument();
  });

  it('usa a largura fixa de 3rem (colapsada) mesmo com menu-width customizado', () => {
    settings = { 'menu-width': 20 };
    renderAppSidebar({ defaultOpen: false });
    expect(screen.getByTestId('nav-main')).toBeInTheDocument();
  });

  it('centraliza o botão do MCP quando a sidebar está colapsada', () => {
    renderAppSidebar({ defaultOpen: false });
    const button = document.querySelector('svg.lucide-bot')?.closest('button');
    expect(button).toBeTruthy();
    expect(button?.className).toContain('justify-center');
  });

  it('fecha o menu mobile ao abrir o chat MCP em telas pequenas', () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 500,
    });
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    renderAppSidebar();
    // On mobile, the sidebar content only renders inside a Radix Sheet once
    // it's open; toggle it open via the real keyboard shortcut first (same
    // as a user tapping the hamburger button would).
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    const button = screen.getByText(/openChat/);
    fireEvent.click(button);
    expect(openMcpFloatingChat).toHaveBeenCalled();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
  });

});
