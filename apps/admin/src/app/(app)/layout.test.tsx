import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cookies } from 'next/headers';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock('@/components/maintenance/maintenance-alert-banner', () => ({
  MaintenanceAlertBanner: () => <div data-testid="maintenance-alert-banner" />,
}));

vi.mock('@/components/mcp-floating-chat', () => ({
  McpFloatingChat: () => <div data-testid="mcp-floating-chat" />,
}));

vi.mock('@/components/page/guard-page', () => ({
  GuardPage: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard-page">{children}</div>
  ),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: (props: { defaultOpen?: boolean; children?: React.ReactNode }) => (
    <div data-testid="sidebar-provider" data-default-open={String(props.defaultOpen)}>
      {props.children}
    </div>
  ),
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-inset">{children}</div>
  ),
}));

import Layout from './layout';

describe('(app) Layout', () => {
  it('define defaultOpen como false quando o cookie sidebar_state é "false"', async () => {
    (cookies as unknown as Mock).mockResolvedValue({
      get: (name: string) => (name === 'sidebar_state' ? { value: 'false' } : undefined),
    });

    const jsx = await Layout({ children: <div>conteúdo</div> });
    render(jsx);

    expect(screen.getByTestId('sidebar-provider')).toHaveAttribute('data-default-open', 'false');
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('maintenance-alert-banner')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-floating-chat')).toBeInTheDocument();
    expect(screen.getByTestId('guard-page')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-inset')).toBeInTheDocument();
  });

  it('define defaultOpen como true quando o cookie sidebar_state é "true"', async () => {
    (cookies as unknown as Mock).mockResolvedValue({
      get: (name: string) => (name === 'sidebar_state' ? { value: 'true' } : undefined),
    });

    const jsx = await Layout({ children: <div>conteúdo</div> });
    render(jsx);

    expect(screen.getByTestId('sidebar-provider')).toHaveAttribute('data-default-open', 'true');
  });

  it('define defaultOpen como true quando o cookie sidebar_state está ausente', async () => {
    (cookies as unknown as Mock).mockResolvedValue({
      get: () => undefined,
    });

    const jsx = await Layout({ children: <div>conteúdo</div> });
    render(jsx);

    expect(screen.getByTestId('sidebar-provider')).toHaveAttribute('data-default-open', 'true');
  });
});
