import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const toastFn = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign((...args: unknown[]) => toastFn(...args), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

let requestMock: ReturnType<typeof vi.fn>;
let accessToken: string | null = null;

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ request: requestMock, accessToken }),
}));

// Socket compartilhado, controlado pelo teste: `emitRealtime` faz o papel do
// servidor empurrando o evento, e `realtime.connected` decide se o fallback de
// polling deve estar ligado.
const realtime = { connected: false };
const realtimeHandlers = new Map<string, Set<(payload: any) => void>>();

function emitRealtime(payload: unknown, event = 'notification:event') {
  realtimeHandlers.get(event)?.forEach((handler) => handler(payload));
}

vi.mock('@/components/realtime/realtime-provider', () => ({
  useRealtime: () => ({
    connected: realtime.connected,
    addChannels: vi.fn(),
    removeChannels: vi.fn(),
    on: (event: string, handler: (payload: any) => void) => {
      let set = realtimeHandlers.get(event);
      if (!set) {
        set = new Set();
        realtimeHandlers.set(event, set);
      }
      set.add(handler);
      return () => {
        realtimeHandlers.get(event)?.delete(handler);
      };
    },
  }),
}));

import {
  NotificationBell,
  NotificationsProvider,
  useNotifications,
} from './notification-bell';

function makeNotification(overrides: Partial<any> = {}) {
  return {
    id: 1,
    title: 'Título',
    body: 'Corpo da notificação',
    type: 'info',
    status: 'unread',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('useNotifications', () => {
  beforeEach(() => {
    realtimeHandlers.clear();
    realtime.connected = false;
    accessToken = null;
    requestMock = vi.fn().mockImplementation(({ url }: { url: string }) => {
      if (url === '/notification') {
        return Promise.resolve({ data: { data: [makeNotification()], total: 1 } });
      }
      if (url === '/notification/unread-count') {
        return Promise.resolve({ data: { count: 1 } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('busca notificações e contagem de não lidas no mount', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.unreadCount).toBe(1);
  });

  it('usa os fallbacks [] e 0 quando a API não retorna data/count', async () => {
    requestMock = vi.fn().mockImplementation(({ url }: { url: string }) => {
      if (url === '/notification') {
        return Promise.resolve({ data: {} });
      }
      if (url === '/notification/unread-count') {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: {} });
    });
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('trata falha silenciosamente ao buscar notificações', async () => {
    requestMock = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    expect(result.current.notifications).toEqual([]);
  });

  it('marca uma notificação como lida (sem auto_remove)', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.handleRead(1);
    });

    expect(requestMock).toHaveBeenCalledWith({
      url: '/notification/1/read',
      method: 'PATCH',
    });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0]?.status).toBe('read');
  });

  it('marca apenas a notificação lida quando há mais de uma na lista', async () => {
    requestMock = vi.fn().mockImplementation(({ url }: { url: string }) => {
      if (url === '/notification') {
        return Promise.resolve({
          data: {
            data: [
              makeNotification({ id: 1, status: 'unread' }),
              makeNotification({ id: 2, status: 'unread' }),
            ],
            total: 2,
          },
        });
      }
      if (url === '/notification/unread-count') {
        return Promise.resolve({ data: { count: 2 } });
      }
      return Promise.resolve({ data: {} });
    });
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.handleRead(1);
    });

    expect(result.current.notifications.find((n) => n.id === 1)?.status).toBe(
      'read',
    );
    expect(result.current.notifications.find((n) => n.id === 2)?.status).toBe(
      'unread',
    );
  });

  it('remove a notificação lida quando auto_remove é verdadeiro', async () => {
    requestMock = vi.fn().mockImplementation(({ url }: { url: string }) => {
      if (url === '/notification') {
        return Promise.resolve({
          data: { data: [makeNotification({ auto_remove: true })], total: 1 },
        });
      }
      if (url === '/notification/unread-count') {
        return Promise.resolve({ data: { count: 1 } });
      }
      return Promise.resolve({ data: {} });
    });
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.handleRead(1);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('lida com falha ao marcar como lida silenciosamente', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    requestMock.mockRejectedValueOnce(new Error('fail'));

    await act(async () => {
      await result.current.handleRead(1);
    });
    // still has the notification because the PATCH failed
    expect(result.current.notifications).toHaveLength(1);
  });

  it('deleta uma notificação', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.handleDelete(1);
    });

    expect(requestMock).toHaveBeenCalledWith({
      url: '/notification/1',
      method: 'DELETE',
    });
    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('lida com falha ao deletar silenciosamente', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    requestMock.mockRejectedValueOnce(new Error('fail'));

    await act(async () => {
      await result.current.handleDelete(1);
    });
    expect(result.current.notifications).toHaveLength(1);
  });

  it('marca todas como lidas', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.handleMarkAllRead();
    });

    expect(requestMock).toHaveBeenCalledWith({
      url: '/notification/read-all',
      method: 'PATCH',
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it('lida com falha ao marcar todas como lidas', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    requestMock.mockRejectedValueOnce(new Error('fail'));

    await act(async () => {
      await result.current.handleMarkAllRead();
    });
  });

  it('deleta todas as notificações (nenhuma em execução)', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.handleDeleteAll();
    });

    expect(requestMock).toHaveBeenCalledWith({
      url: '/notification',
      method: 'DELETE',
    });
    expect(result.current.notifications).toHaveLength(0);
  });

  it('deleta apenas notificações concluídas quando há uma em execução', async () => {
    requestMock = vi.fn().mockImplementation(({ url }: { url: string }) => {
      if (url === '/notification') {
        return Promise.resolve({
          data: {
            data: [
              makeNotification({ id: 1, status: 'unread' }),
              makeNotification({ id: 2, progress: 50, status: 'unread' }),
            ],
            total: 2,
          },
        });
      }
      if (url === '/notification/unread-count') {
        return Promise.resolve({ data: { count: 2 } });
      }
      return Promise.resolve({ data: {} });
    });
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.handleDeleteAll();
    });

    expect(requestMock).toHaveBeenCalledWith({
      url: '/notification/1',
      method: 'DELETE',
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.id).toBe(2);
  });

  it('lida com falha ao deletar todas silenciosamente', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    requestMock.mockRejectedValueOnce(new Error('fail'));

    await act(async () => {
      await result.current.handleDeleteAll();
    });
  });

  it('abre e fecha o popover via setOpen, refazendo a busca ao abrir', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    requestMock.mockClear();

    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);
    await waitFor(() => expect(requestMock).toHaveBeenCalled());
  });

  it('não faz polling enquanto o socket está conectado', async () => {
    vi.useFakeTimers();
    realtime.connected = true;
    const { unmount } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());
    const afterSeed = requestMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(requestMock.mock.calls.length).toBe(afterSeed);
    unmount();
    vi.useRealTimers();
  });

  it('faz polling quando o socket está desconectado', async () => {
    vi.useFakeTimers();
    realtime.connected = false;
    const { unmount } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());
    const afterSeed = requestMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(requestMock.mock.calls.length).toBeGreaterThan(afterSeed);
    unmount();
    vi.useRealTimers();
  });
});

describe('useNotifications (push pelo socket)', () => {
  beforeEach(() => {
    realtimeHandlers.clear();
    accessToken = 'tok';
    realtime.connected = true;
    requestMock = vi.fn().mockImplementation(({ url }: { url: string }) => {
      if (url === '/notification') {
        return Promise.resolve({ data: { data: [makeNotification()], total: 1 } });
      }
      if (url === '/notification/unread-count') {
        return Promise.resolve({ data: { count: 1 } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('assina o evento de notificação e busca de novo quando ele chega', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    const afterSeed = requestMock.mock.calls.length;

    await act(async () => {
      emitRealtime({ type: 'notification.created', notification: makeNotification({ id: 9 }) });
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(requestMock.mock.calls.length).toBeGreaterThan(afterSeed);
  });

  it('toasta a notificação criada quando o popover está fechado', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      emitRealtime({
        type: 'notification.created',
        notification: makeNotification({ id: 9, title: 'Nova', body: 'Corpo' }),
      });
    });

    expect(toastFn).toHaveBeenCalledWith('Nova', { description: 'Corpo' });
  });

  // Uma rajada de progresso emite dezenas de eventos; sem o debounce cada um
  // viraria duas requisições — pior que o poll que este trabalho removeu.
  it('coalesce uma rajada de eventos em um único refetch', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    const afterSeed = requestMock.mock.calls.length;

    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        emitRealtime({ type: 'notification.updated', notificationId: 1 });
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // duas chamadas: a lista e o contador, uma única vez.
    expect(requestMock.mock.calls.length).toBe(afterSeed + 2);
  });

  it('aplica o progresso vindo no payload sem esperar o refetch', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      emitRealtime({
        type: 'notification.updated',
        notification: makeNotification({ id: 1, progress: 42 }),
      });
    });

    expect(result.current.notifications[0]?.progress).toBe(42);
  });

  it('ignora reward.granted, que é do aluno e não desta tela', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    const afterSeed = requestMock.mock.calls.length;

    await act(async () => {
      emitRealtime({ type: 'reward.granted' });
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(requestMock.mock.calls.length).toBe(afterSeed);
  });

  // O socket não guarda histórico: o que passou enquanto a aba esteve fora do ar
  // só se recupera perguntando de novo na volta.
  it('busca de novo ao (re)conectar', async () => {
    realtime.connected = false;
    const { result, rerender } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    const afterSeed = requestMock.mock.calls.length;

    realtime.connected = true;
    await act(async () => {
      rerender();
    });

    await waitFor(() =>
      expect(requestMock.mock.calls.length).toBeGreaterThan(afterSeed),
    );
  });

  it('lança sem o provider, em vez de voltar calado a estado por consumidor', () => {
    expect(() => renderHook(() => useNotifications())).toThrow(
      /NotificationsProvider/,
    );
  });
});

describe('NotificationBell (componente)', () => {
  function renderBell(
    overrides: Partial<Parameters<typeof useNotifications>> = {} as Partial<
      Parameters<typeof useNotifications>
    >,
  ) {
    const state = {
      notifications: [makeNotification()],
      unreadCount: 1,
      open: true,
      setOpen: vi.fn(),
      handleRead: vi.fn(),
      handleDelete: vi.fn(),
      handleMarkAllRead: vi.fn(),
      handleDeleteAll: vi.fn(),
      ...overrides,
    };
    render(<NotificationBell state={state as any} />);
    return state;
  }

  it('mostra o indicador de não lidas quando unreadCount > 0', () => {
    renderBell();
    expect(screen.getByRole('button', { name: 'title' })).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há notificações', () => {
    renderBell({ notifications: [], unreadCount: 0 } as any);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('chama handleMarkAllRead ao clicar em "marcar todas como lidas"', () => {
    const state = renderBell();
    fireEvent.click(screen.getByText('markAllRead'));
    expect(state.handleMarkAllRead).toHaveBeenCalled();
  });

  it('chama handleDeleteAll ao clicar no ícone de lixeira', () => {
    const state = renderBell();
    fireEvent.click(screen.getByTitle('clearAll'));
    expect(state.handleDeleteAll).toHaveBeenCalled();
  });

  it('fecha o popover ao clicar no X', () => {
    const state = renderBell();
    fireEvent.click(screen.getByLabelText('Fechar notificacoes'));
    expect(state.setOpen).toHaveBeenCalledWith(false);
  });

  it('marca como lida e navega ao clicar em uma notificação com action_url', () => {
    const state = renderBell({
      notifications: [
        makeNotification({ action_url: '/some/page', status: 'unread' }),
      ],
    } as any);
    fireEvent.click(screen.getByText('Título'));
    expect(state.handleRead).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith('/some/page');
  });

  it('redireciona operations?taskId= para /operations/my-tasks', () => {
    renderBell({
      notifications: [
        makeNotification({
          action_url: '/operations?taskId=42',
          action_type: 'sheet',
          status: 'read',
        }),
      ],
    } as any);
    fireEvent.click(screen.getByText('Título'));
    expect(push).toHaveBeenCalledWith('/operations/my-tasks?taskId=42&editTask=1');
  });

  it('não navega quando a notificação não possui action_url', () => {
    push.mockClear();
    renderBell({
      notifications: [makeNotification({ action_url: undefined, status: 'read' })],
    } as any);
    fireEvent.click(screen.getByText('Título'));
    expect(push).not.toHaveBeenCalled();
  });

  it('deleta a notificação ao clicar no X, sem propagar o clique do item', () => {
    const state = renderBell({
      notifications: [makeNotification({ status: 'read' })],
    } as any);
    const deleteButtons = document.querySelectorAll('button svg.lucide-circle-x');
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!.closest('button')!);
    expect(state.handleDelete).toHaveBeenCalledWith(1);
  });

  it('mostra o tempo decorrido em segundos quando há started_at', () => {
    renderBell({
      notifications: [
        makeNotification({
          progress: 40,
          status: 'unread',
          started_at: new Date(Date.now() - 5000).toISOString(),
        }),
      ],
    } as any);
    expect(screen.getByText(/elapsed/)).toBeInTheDocument();
  });

  it('mostra o tempo decorrido em minutos', () => {
    renderBell({
      notifications: [
        makeNotification({
          progress: 40,
          status: 'unread',
          started_at: new Date(Date.now() - 90_000).toISOString(),
        }),
      ],
    } as any);
    expect(screen.getByText(/elapsed/)).toBeInTheDocument();
  });

  it('mostra o tempo decorrido em horas', () => {
    renderBell({
      notifications: [
        makeNotification({
          progress: 40,
          status: 'unread',
          started_at: new Date(Date.now() - 2 * 3_600_000 - 60_000).toISOString(),
        }),
      ],
    } as any);
    expect(screen.getByText(/elapsed/)).toBeInTheDocument();
  });

  it('não mostra o botão de deletar quando a notificação está em execução', () => {
    renderBell({
      notifications: [
        makeNotification({ progress: 40, status: 'unread', finished_at: undefined }),
      ],
    } as any);
    expect(screen.getByText(/inProgress|elapsed/)).toBeInTheDocument();
  });

  it('mostra "completed" quando a notificação assíncrona terminou com sucesso', () => {
    renderBell({
      notifications: [
        makeNotification({
          progress: 100,
          type: 'success',
          finished_at: new Date().toISOString(),
        }),
      ],
    } as any);
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('mostra "failed" quando a notificação assíncrona terminou com erro', () => {
    renderBell({
      notifications: [
        makeNotification({
          progress: 100,
          type: 'error',
          finished_at: new Date().toISOString(),
        }),
      ],
    } as any);
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('renderiza um ícone dinâmico a partir do nome informado', () => {
    renderBell({
      notifications: [makeNotification({ icon: 'alert-triangle' })],
    } as any);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('ignora ícone dinâmico desconhecido', () => {
    renderBell({
      notifications: [makeNotification({ icon: 'not-a-real-icon-xyz' })],
    } as any);
    expect(screen.getByText('Título')).toBeInTheDocument();
  });

  it('mostra tempo relativo em minutos, horas e dias', () => {
    const now = Date.now();
    renderBell({
      notifications: [
        makeNotification({
          id: 10,
          title: 'Recente',
          created_at: new Date(now - 5000).toISOString(),
        }),
        makeNotification({
          id: 11,
          title: 'Minutos',
          created_at: new Date(now - 5 * 60_000).toISOString(),
        }),
        makeNotification({
          id: 12,
          title: 'Horas',
          created_at: new Date(now - 5 * 3_600_000).toISOString(),
        }),
        makeNotification({
          id: 13,
          title: 'Dias',
          created_at: new Date(now - 3 * 86_400_000).toISOString(),
        }),
      ],
    } as any);
    expect(screen.getByText('justNow')).toBeInTheDocument();
  });

  it('renderiza no modo mobile', () => {
    renderBell();
    const { container } = render(<NotificationBell state={
      {
        notifications: [],
        unreadCount: 0,
        open: false,
        setOpen: vi.fn(),
        handleRead: vi.fn(),
        handleDelete: vi.fn(),
        handleMarkAllRead: vi.fn(),
        handleDeleteAll: vi.fn(),
      } as any
    } isMobile />);
    expect(container).toBeTruthy();
  });
});
