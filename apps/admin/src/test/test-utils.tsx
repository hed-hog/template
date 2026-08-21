import type { ReactElement, ReactNode } from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, QueryClient as AppQueryClient } from '@hed-hog/next-app-provider';

export * from '@testing-library/react';

/**
 * Wraps `ui` in a fresh QueryClientProvider (retry disabled) so components
 * using `useQuery`/`useMutation` render without needing a real network layer
 * (pair with MSW handlers from `@hed-hog/vitest-config` for data).
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient },
) {
  const queryClient =
    options?.queryClient ??
    new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, ...rtlRender(ui, { wrapper: Wrapper, ...options }) };
}

/* v8 ignore next */
const noop = () => {};
const toastStub = Object.assign(noop, { error: noop, success: noop, warning: noop, info: noop });

/**
 * Wrapper for components that call `useApp()` (from `@hed-hog/next-app-provider`).
 * The test file importing this MUST declare these two mocks (vi.mock is hoisted
 * per-file, so they can't live here) BEFORE any other imports:
 *
 *   const push = vi.fn();
 *   vi.mock('next/navigation', () => ({
 *     useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
 *   }));
 *   vi.mock('@bprogress/next', () => ({
 *     AppProgressProvider: ({ children }: { children: React.ReactNode }) => children,
 *   }));
 *
 * See `src/test/app-provider.integration.test.tsx` for the full pattern.
 */
export function makeAppProviderWrapper({
  apiBaseUrl = 'http://api.test',
  queryClient = new AppQueryClient({ defaultOptions: { queries: { retry: false } } }),
}: { apiBaseUrl?: string; queryClient?: AppQueryClient } = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider
        toast={toastStub as never}
        settings={{ 'api-base-url': apiBaseUrl }}
        locales={[]}
        queryClient={queryClient}
      >
        {children}
      </AppProvider>
    );
  };
}

/** Passthrough `t(key) => key` stub matching the repo's established next-intl mock convention. */
export function identityTranslations(key: string) {
  return key;
}
