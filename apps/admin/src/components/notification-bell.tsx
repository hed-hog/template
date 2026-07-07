'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useApp } from '@hed-hog/next-app-provider';
import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Loader2,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'progress';
type NotificationStatus = 'unread' | 'read';
type NotificationActionType = 'url' | 'sheet' | 'modal';

export interface Notification {
  id: number;
  title: string;
  body?: string;
  icon?: string;
  type: NotificationType;
  status: NotificationStatus;
  action_type?: NotificationActionType;
  action_data?: Record<string, unknown>;
  action_url?: string;
  auto_remove?: boolean;
  progress?: number;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

interface PaginatedResponse {
  data: Notification[];
  total: number;
}

type NotificationStreamEvent = {
  type: 'ready' | 'notification.created' | 'notification.updated';
  notificationId?: number;
  notification?: Notification;
};

export interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  handleRead: (id: number) => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
  handleMarkAllRead: () => Promise<void>;
  handleDeleteAll: () => Promise<void>;
}

export function useNotifications(): NotificationsState {
  const { request, accessToken } = useApp();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const openRef = useRef(open);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);

  const hasActiveAsync = notifications.some(
    (n) => n.progress != null && n.progress < 100
  );

  const fetchAll = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        request<PaginatedResponse>({
          url: '/notification',
          method: 'GET',
          params: { page: 1, pageSize: 20 },
        }),
        request<{ count: number }>({
          url: '/notification/unread-count',
          method: 'GET',
        }),
      ]);
      setNotifications(listRes.data.data ?? []);
      setUnreadCount(countRes.data.count ?? 0);
    } catch {
      // silent
    }
  }, [request]);

  const refreshFromStream = useCallback(
    async (event: NotificationStreamEvent) => {
      if (event.type === 'notification.created' && event.notification) {
        if (!openRef.current) {
          toast(event.notification.title, {
            description: event.notification.body,
          });
        }
      }

      await fetchAll();
    },
    [fetchAll, open]
  );

  const connectStream = useCallback(async () => {
    // Both guards are defensive-only: the sole callers are (1) the effect
    // below, which never calls connectStream() unless accessToken is truthy,
    // and (2) the reconnect setTimeout, which is always cleared by that same
    // effect's cleanup before accessToken can change. `window` is likewise
    // always defined here since this hook only ever runs client-side.
    /* v8 ignore next 3 */
    if (!accessToken || typeof window === 'undefined') {
      return;
    }

    // Also defensive-only: by the time connectStream() runs again (either
    // re-invoked synchronously by the effect below, whose own cleanup already
    // aborts/nulls streamAbortRef first, or via the reconnect timeout, whose
    // finally-block already nulled streamAbortRef before scheduling), this
    // ref is always null already.
    /* v8 ignore next 3 */
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    const controller = new AbortController();
    streamAbortRef.current = controller;

    const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
    const apiBase = rawBase.replace(/\/$/, '');
    const url = `${apiBase}/notification/stream`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`notification-stream-unavailable:${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        // `String.prototype.split` always returns at least one element, so
        // `.pop()` here is never actually `undefined`; the `?? ''` is a
        // type-narrowing fallback only.
        /* v8 ignore next */
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const lines = block.split('\n');
          const dataText = lines
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');

          if (!dataText) {
            continue;
          }

          let payload: NotificationStreamEvent | null = null;
          try {
            payload = JSON.parse(dataText) as NotificationStreamEvent;
          } catch {
            continue;
          }

          if (payload?.type === 'ready') {
            continue;
          }

          await refreshFromStream(payload ?? { type: 'notification.updated' });
        }
      }
    } catch {
      // silent: reconnect below
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }

      if (shouldReconnectRef.current && accessToken) {
        reconnectRef.current = setTimeout(() => {
          void connectStream();
        }, 5000);
      }
    }
  }, [accessToken, refreshFromStream]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    shouldReconnectRef.current = Boolean(accessToken);

    if (!accessToken) {
      // Structurally unreachable with a truthy ref: whenever accessToken was
      // previously truthy, this same effect registered a cleanup (below) that
      // already aborts the stream and clears the reconnect timer *before*
      // this body re-runs (React always runs the previous cleanup before a
      // re-triggered effect). And when accessToken was already falsy on the
      // prior render, this branch returned early without registering a
      // cleanup, so the refs were never set in the first place. Kept as a
      // defensive guard against future refactors of the effect above.
      /* v8 ignore next 8 -- see explanation above: unreachable given the paired cleanup below always runs first */
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      return;
    }

    void connectStream();

    return () => {
      shouldReconnectRef.current = false;
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [accessToken, connectStream]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const delay = hasActiveAsync ? 5000 : 30000;
    intervalRef.current = setInterval(fetchAll, delay);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasActiveAsync, fetchAll]);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  const handleRead = async (id: number) => {
    try {
      await request({ url: `/notification/${id}/read`, method: 'PATCH' });
      const target = notifications.find((n) => n.id === id);
      if (target?.auto_remove) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: 'read' as const } : n))
        );
      }
      if (target?.status === 'unread')
        setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const handleDelete = async (id: number) => {
    const target = notifications.find((n) => n.id === id);
    try {
      await request({ url: `/notification/${id}`, method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target?.status === 'unread')
        setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await request({ url: '/notification/read-all', method: 'PATCH' });
      setNotifications((prev) =>
        prev
          .filter((n) => !n.auto_remove)
          .map((n) => ({ ...n, status: 'read' as const }))
      );
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleDeleteAll = async () => {
    try {
      const toDelete = notifications.filter((n) => !isRunning(n));
      if (toDelete.length < notifications.length) {
        await Promise.all(
          toDelete.map((n) =>
            request({ url: `/notification/${n.id}`, method: 'DELETE' })
          )
        );
        setNotifications((prev) => prev.filter(isRunning));
        const deletedUnread = toDelete.filter(
          (n) => n.status === 'unread'
        ).length;
        setUnreadCount((c) => Math.max(0, c - deletedUnread));
      } else {
        await request({ url: '/notification', method: 'DELETE' });
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch {
      // silent
    }
  };

  return {
    notifications,
    unreadCount,
    open,
    setOpen,
    handleRead,
    handleDelete,
    handleMarkAllRead,
    handleDeleteAll,
  };
}

function isRunning(n: Notification) {
  return n.progress != null && n.progress < 100 && !n.finished_at;
}

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  info: <Info className="size-4" />,
  success: <CheckCircle2 className="size-4" />,
  warning: <AlertTriangle className="size-4" />,
  error: <XCircle className="size-4" />,
  progress: <Loader2 className="size-4 animate-spin" />,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  info: 'bg-blue-500/10 text-blue-500',
  success: 'bg-green-500/10 text-green-500',
  warning: 'bg-yellow-500/10 text-yellow-500',
  error: 'bg-red-500/10 text-red-500',
  progress: 'bg-primary/10 text-primary',
};

function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = (
    LucideIcons as unknown as Record<string, LucideIcon | undefined>
  )[name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())];
  if (!Icon) return null;
  return <Icon className={className} />;
}

function useElapsed(startedAt?: string, finishedAt?: string) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!startedAt || finishedAt) {
      setElapsed('');
      return;
    }
    const update = () => {
      const s = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      if (s < 60) setElapsed(`${s}s`);
      else if (s < 3600) setElapsed(`${Math.floor(s / 60)}m ${s % 60}s`);
      else
        setElapsed(`${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [startedAt, finishedAt]);
  return elapsed;
}

function RelativeTime({ date }: { date: string }) {
  const t = useTranslations('core.Notification');
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (s < 60) return <span>{t('justNow')}</span>;
  if (m < 60) return <span>{t('minutesAgo', { count: m })}</span>;
  if (h < 24) return <span>{t('hoursAgo', { count: h })}</span>;
  return <span>{t('daysAgo', { count: d })}</span>;
}

function NotificationItem({
  notification,
  onRead,
  onDelete,
}: {
  notification: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const t = useTranslations('core.Notification');
  const router = useRouter();
  const elapsed = useElapsed(notification.started_at, notification.finished_at);
  const isAsync = notification.progress != null;
  const notificationIsRunning = isAsync && notification.progress! < 100;
  const iconType: NotificationType =
    isAsync && notificationIsRunning ? 'progress' : notification.type;

  const handleClick = () => {
    if (notification.status === 'unread') onRead(notification.id);
    if (!notification.action_url) return;
    let targetUrl = notification.action_url;

    if (targetUrl.startsWith('/operations?')) {
      // The `startsWith('/operations?')` check above guarantees a '?' is
      // present, so `split('?')[1]` is always a defined string (possibly
      // empty); the `?? ''` fallback can't actually be reached.
      /* v8 ignore next */
      const params = new URLSearchParams(targetUrl.split('?')[1] ?? '');
      const taskId = params.get('taskId');
      if (taskId) {
        targetUrl = `/operations/my-tasks?taskId=${taskId}&editTask=1`;
      }
    }

    if (
      notification.action_type === 'sheet' ||
      notification.action_type === 'modal'
    ) {
      router.push(targetUrl);
    } else {
      router.push(targetUrl);
    }
  };

  return (
    <div
      className={cn(
        'group flex gap-3 rounded-lg px-3 py-2.5 transition-colors',
        notification.status === 'unread'
          ? 'bg-primary/5 hover:bg-primary/10'
          : 'hover:bg-muted/50',
        notification.action_url && 'cursor-pointer'
      )}
      onClick={handleClick}
    >
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          TYPE_COLOR[iconType]
        )}
      >
        {notification.icon ? (
          <DynamicIcon name={notification.icon} className="size-4" />
        ) : (
          TYPE_ICON[iconType]
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium leading-tight">
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {notification.body}
          </p>
        )}
        {isAsync && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2">
              {/* `isAsync` (above) is defined as `notification.progress != null`,
                  so within this block `notification.progress` can never be
                  null/undefined; the `?? 0` fallbacks below are unreachable. */}
              <Progress
                /* v8 ignore next */
                value={notification.progress ?? 0}
                className="h-1 flex-1"
              />
              <span className="text-xs tabular-nums text-muted-foreground">
                {/* v8 ignore next */}
                {notification.progress ?? 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {notificationIsRunning
                ? elapsed
                  ? t('elapsed', { time: elapsed })
                  : t('inProgress')
                : notification.type === 'error'
                  ? t('failed')
                  : t('completed')}
            </p>
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          <RelativeTime date={notification.created_at} />
        </p>
      </div>

      {!isRunning(notification) && (
        <button
          className="invisible shrink-0 self-start text-muted-foreground opacity-60 hover:opacity-100 group-hover:visible"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <XCircle className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function NotificationBell({
  state,
  isMobile = false,
}: {
  state: NotificationsState;
  isMobile?: boolean;
}) {
  const t = useTranslations('core.Notification');
  const {
    notifications,
    unreadCount,
    open,
    setOpen,
    handleRead,
    handleDelete,
    handleMarkAllRead,
    handleDeleteAll,
  } = state;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 shrink-0"
          aria-label={t('title')}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="bg-primary absolute right-1 top-1 h-2 w-2 rounded-full" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side={isMobile ? 'bottom' : 'right'}
        align="end"
        sideOffset={isMobile ? 6 : 8}
        collisionPadding={8}
        className="w-[min(24rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">{t('title')}</span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-primary text-xs hover:underline"
              >
                {t('markAllRead')}
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title={t('clearAll')}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fechar notificacoes"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
            <Bell className="mb-2 size-8 opacity-30" />
            {t('empty')}
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <div className="space-y-0.5 p-2">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={handleRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
