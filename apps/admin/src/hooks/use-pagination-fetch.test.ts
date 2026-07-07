import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { anyPaginationEnvelope, type PaginationEnvelope } from '@hed-hog/api-types';

// usePaginationFetch depends on useApp().request (shared provider). We mock
// only the request; vi.hoisted ensures the reference exists when the factory runs.
const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ request: requestMock }),
}));

import { usePaginationFetch } from './use-pagination-fetch';

describe('usePaginationFetch — contrato de paginação', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('processa um envelope de paginação válido conforme o contrato compartilhado', async () => {
    // The fixture is validated against the SAME zod schema as the backend — this way
    // the test cannot silently drift from the real API contract.
    const payload: PaginationEnvelope<{ id: number; name: string }> = {
      data: [{ id: 1, name: 'Ada' }],
      total: 1,
      lastPage: 1,
      page: 1,
      pageSize: 10,
      prev: null,
      next: null,
    };
    expect(anyPaginationEnvelope.safeParse(payload).success).toBe(true);

    requestMock.mockResolvedValue({ data: payload });

    const { result } = renderHook(() =>
      usePaginationFetch<{ id: number; name: string }>({ url: '/lms/instructors' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/lms/instructors',
        params: expect.objectContaining({ page: 1, pageSize: 10 }),
      }),
    );
    expect(result.current.data.data).toEqual(payload.data);
    expect(result.current.data.total).toBe(1);
  });

  it('mantém estado seguro quando a API responde 401 (sessão expirada)', async () => {
    requestMock.mockRejectedValue({ response: { status: 401 } });

    const { result } = renderHook(() =>
      usePaginationFetch({ url: '/lms/instructors' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // No crash; the state remains in the envelope shape (empty list).
    expect(Array.isArray(result.current.data.data)).toBe(true);
    expect(result.current.data.data).toHaveLength(0);
  });

  it('usa page e pageSize explícitos quando são números válidos', async () => {
    requestMock.mockResolvedValue({
      data: { data: [], total: 0, lastPage: 0, page: 3, pageSize: 25, prev: null, next: null },
    });

    const { result } = renderHook(() =>
      usePaginationFetch({ url: '/x', page: 3, pageSize: 25 }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ page: 3, pageSize: 25 }),
      }),
    );
  });

  it('normaliza page/pageSize inválidos (NaN, negativo, string, Infinity) para os defaults', async () => {
    requestMock.mockResolvedValue({
      data: { data: [], total: 0, lastPage: 0, page: 1, pageSize: 10, prev: null, next: null },
    });

    const { result } = renderHook(() =>
      usePaginationFetch({
        url: '/x',
        page: -1,
        pageSize: Number.POSITIVE_INFINITY,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, pageSize: 10 }),
      }),
    );
  });

  it('envia fields, search, sortField e sortOrder quando fornecidos', async () => {
    requestMock.mockResolvedValue({
      data: { data: [], total: 0, lastPage: 0, page: 1, pageSize: 10, prev: null, next: null },
    });

    const { result } = renderHook(() =>
      usePaginationFetch({
        url: '/x',
        fields: ['id', 'name'],
        search: 'ada',
        sortField: 'name',
        sortOrder: 'asc',
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          fields: ['id', 'name'],
          search: 'ada',
          sortField: 'name',
          sortOrder: 'asc',
        }),
      }),
    );
  });

  it('ignora fields vazio, search/sortField/sortOrder em branco', async () => {
    requestMock.mockResolvedValue({
      data: { data: [], total: 0, lastPage: 0, page: 1, pageSize: 10, prev: null, next: null },
    });

    const { result } = renderHook(() =>
      usePaginationFetch({
        url: '/x',
        fields: [],
        search: '   ',
        sortField: '   ',
        sortOrder: '   ',
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const params = requestMock.mock.calls[0][0].params;
    expect(params).not.toHaveProperty('fields');
    expect(params).not.toHaveProperty('search');
    expect(params).not.toHaveProperty('sortField');
    expect(params).not.toHaveProperty('sortOrder');
  });

  describe('debounce quando há search', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('adia a busca em 400ms quando search está presente', async () => {
      requestMock.mockResolvedValue({
        data: { data: [], total: 0, lastPage: 0, page: 1, pageSize: 10, prev: null, next: null },
      });

      renderHook(() => usePaginationFetch({ url: '/x', search: 'ada' }));

      expect(requestMock).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(requestMock).toHaveBeenCalledTimes(1);
    });

    it('cancela o timeout anterior ao desmontar', async () => {
      requestMock.mockResolvedValue({
        data: { data: [], total: 0, lastPage: 0, page: 1, pageSize: 10, prev: null, next: null },
      });

      const { unmount } = renderHook(() => usePaginationFetch({ url: '/x', search: 'ada' }));
      unmount();

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(requestMock).not.toHaveBeenCalled();
    });

    it('cancela o timeout anterior quando search muda antes de disparar', async () => {
      requestMock.mockResolvedValue({
        data: { data: [], total: 0, lastPage: 0, page: 1, pageSize: 10, prev: null, next: null },
      });

      const { rerender } = renderHook(
        ({ search }) => usePaginationFetch({ url: '/x', search }),
        { initialProps: { search: 'a' } },
      );

      rerender({ search: 'ab' });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // Only the last debounced call should have fired.
      expect(requestMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldIgnoreAuthFetchError (via console.warn)', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('registra warn quando o erro não é um objeto', async () => {
      requestMock.mockRejectedValue('falha de rede simples');

      const { result } = renderHook(() => usePaginationFetch({ url: '/x' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(warnSpy).toHaveBeenCalled();
    });

    it('não registra warn para status 403', async () => {
      requestMock.mockRejectedValue({ response: { status: 403 } });

      const { result } = renderHook(() => usePaginationFetch({ url: '/x' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('não registra warn quando a mensagem do backend indica falha ao renovar o token', async () => {
      requestMock.mockRejectedValue({
        response: { data: { message: 'Failed to refresh token' } },
      });

      const { result } = renderHook(() => usePaginationFetch({ url: '/x' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('registra warn quando a mensagem do backend é outra', async () => {
      requestMock.mockRejectedValue({
        response: { data: { message: 'Internal Server Error' } },
      });

      const { result } = renderHook(() => usePaginationFetch({ url: '/x' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(warnSpy).toHaveBeenCalled();
    });

    it('usa error.message quando não há response.data.message e não registra warn se indicar falha de token', async () => {
      requestMock.mockRejectedValue({ message: 'failed to refresh token: expired' });

      const { result } = renderHook(() => usePaginationFetch({ url: '/x' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('registra warn quando não há response nem message reconhecíveis', async () => {
      requestMock.mockRejectedValue({});

      const { result } = renderHook(() => usePaginationFetch({ url: '/x' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
