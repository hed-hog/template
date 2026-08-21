import { AppProvider, QueryClient } from '@hed-hog/next-app-provider';
// O QueryClient vem do @tanstack/react-query (e não do next-app-provider) porque
// quem usa `renderWithProviders` costuma mockar o módulo inteiro do provider:
// a classe re-exportada de lá não existiria no mock.
import {
  QueryClient as ReactQueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

/**
 * Wrapper de render para testes de componentes que consomem `useApp()`.
 *
 * Espelha o setup de `app-provider.integration.test.tsx`: o AppProvider real,
 * apontado para a base URL que o MSW intercepta. Quem usa isto precisa mockar
 * `next/navigation` e `@bprogress/next` no próprio arquivo de teste — o
 * provider importa os dois e eles não existem sob jsdom.
 */
const toastStub = Object.assign(() => {}, {
  error: () => {},
  success: () => {},
  warning: () => {},
  info: () => {},
});

export function makeAppProviderWrapper({
  apiBaseUrl,
  settings = {},
  locales = [{ code: 'en', name: 'English' }],
}: {
  apiBaseUrl: string;
  settings?: Record<string, unknown>;
  locales?: { code: string; name: string }[];
}) {
  // Um client por wrapper: cache compartilhado entre testes vazaria resultado
  // de um teste para o outro. `retry: false` faz o erro chegar de imediato.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider
        toast={toastStub as never}
        settings={{ 'api-base-url': apiBaseUrl, ...settings }}
        locales={locales}
        queryClient={queryClient}
      >
        {children}
      </AppProvider>
    );
  };
}

/**
 * Render com apenas o QueryClientProvider. Para componentes que mockam
 * `@hed-hog/next-app-provider` inteiro e só precisam do cache do react-query
 * de pé — montar o AppProvider real aqui pegaria o módulo mockado.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient,
    ...renderOptions
  }: Omit<RenderOptions, 'wrapper'> & { queryClient?: ReactQueryClient } = {}
): RenderResult & { queryClient: ReactQueryClient } {
  const client =
    queryClient ??
    new ReactQueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return { queryClient: client, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
