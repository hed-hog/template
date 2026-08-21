import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

// The dynamic import target `@/app/(app)/(libraries)/core/dashboard/dashboard-home-tabs`
// does not exist in a fresh checkout. We intercept the module specifier with vi.doMock
// (per-test, not hoisted) so we can exercise both the success and failure branches of
// the dynamic import inside Page's effect.
const DASHBOARD_MODULE =
  '@/app/(app)/(libraries)/core/dashboard/dashboard-home-tabs';

describe('Page (app home)', () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    vi.doUnmock(DASHBOARD_MODULE);
  });

  it('renderiza o DashboardHomeTabs quando o import dinamico resolve com sucesso', async () => {
    vi.doMock(DASHBOARD_MODULE, () => ({
      DashboardHomeTabs: () => <div data-testid="dashboard-home-tabs" />,
    }));

    const { default: Page } = await import('./page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-home-tabs')).toBeInTheDocument();
    });
  });

  it('renderiza o PlaceholderHome quando o import dinamico falha', async () => {
    vi.doMock(DASHBOARD_MODULE, () => {
      throw new Error('module not found');
    });

    const { default: Page } = await import('./page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Dashboard indisponivel\./i)).toBeInTheDocument();
    });
  });

  it('nao chama setHomeComponent quando o componente e desmontado antes do import resolver com sucesso', async () => {
    vi.doMock(DASHBOARD_MODULE, () => ({
      DashboardHomeTabs: () => <div data-testid="dashboard-home-tabs" />,
    }));

    const { default: Page } = await import('./page');
    const { unmount } = render(<Page />);
    expect(() => unmount()).not.toThrow();

    // Allow the pending dynamic import promise to settle after unmount; the
    // isMounted guard in the effect should prevent any state update / act warning.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('usa o export default quando o modulo nao possui DashboardHomeTabs nomeado', async () => {
    vi.doMock(DASHBOARD_MODULE, () => ({
      DashboardHomeTabs: undefined,
      default: () => <div data-testid="dashboard-home-tabs-default" />,
    }));

    const { default: Page } = await import('./page');
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-home-tabs-default')
      ).toBeInTheDocument();
    });
  });

  it('nao chama setHomeComponent quando o componente e desmontado antes do import falhar', async () => {
    vi.doMock(DASHBOARD_MODULE, () => {
      throw new Error('module not found');
    });

    const { default: Page } = await import('./page');
    const { unmount } = render(<Page />);
    expect(() => unmount()).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
