import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

// useWidgetData combines useApp().request with useQuery. We isolate the hook by
// mocking the provider: `useApp` returns a fake request and `useQuery` is the real one
// from @tanstack/react-query (not mocked), so the QueryClientProvider below works.
const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@hed-hog/next-app-provider', async () => {
  const rq = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );
  return {
    useApp: () => ({ request: mockRequest }),
    useQuery: rq.useQuery,
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWidgetData } from './use-widget-data';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useWidgetData', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('carrega e expõe os dados em caso de sucesso', async () => {
    mockRequest.mockResolvedValue({ data: { total: 5 } });
    const { result } = renderHook(
      () => useWidgetData({ endpoint: '/w/summary', queryKey: 'ok' }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ total: 5 });
    expect(result.current.isError).toBe(false);
    expect(result.current.isAccessDenied).toBe(false);
    expect(mockRequest).toHaveBeenCalledWith({
      url: '/w/summary',
      method: 'GET',
    });
  });

  it('aplica o select ao resultado', async () => {
    mockRequest.mockResolvedValue({ data: { total: 10 } });
    const { result } = renderHook(
      () =>
        useWidgetData<{ total: number }, number>({
          endpoint: '/w/summary',
          queryKey: 'sel',
          select: (d) => d.total,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(10);
  });

  it('marca isAccessDenied em erro 401', async () => {
    mockRequest.mockRejectedValue({ response: { status: 401 } });
    const { result } = renderHook(
      () => useWidgetData({ endpoint: '/w/denied', queryKey: 'denied' }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isAccessDenied).toBe(true);
  });

  it('erro não-401 não marca isAccessDenied', async () => {
    mockRequest.mockRejectedValue({ response: { status: 500 } });
    const { result } = renderHook(
      () => useWidgetData({ endpoint: '/w/boom', queryKey: 'boom' }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Optional chaining results in falsy (undefined), not literal false.
    expect(result.current.isAccessDenied).toBeFalsy();
  });

  it('marca isAccessDenied quando error.status é 401 diretamente (sem response)', async () => {
    mockRequest.mockRejectedValue({ status: 401 });
    const { result } = renderHook(
      () => useWidgetData({ endpoint: '/w/denied2', queryKey: 'denied2' }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isAccessDenied).toBe(true);
  });

  it('marca isAccessDenied quando error.message contém "401"', async () => {
    mockRequest.mockRejectedValue({ message: 'Request failed with status code 401' });
    const { result } = renderHook(
      () => useWidgetData({ endpoint: '/w/denied3', queryKey: 'denied3' }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isAccessDenied).toBe(true);
  });

  it('marca isAccessDenied quando error.message contém "Unauthorized"', async () => {
    mockRequest.mockRejectedValue({ message: 'Unauthorized access' });
    const { result } = renderHook(
      () => useWidgetData({ endpoint: '/w/denied4', queryKey: 'denied4' }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isAccessDenied).toBe(true);
  });

  it('com enabled=false não dispara a requisição', async () => {
    const { result } = renderHook(
      () =>
        useWidgetData({
          endpoint: '/w/off',
          queryKey: 'off',
          enabled: false,
        }),
      { wrapper: makeWrapper() }
    );

    expect(mockRequest).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
