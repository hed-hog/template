'use client';

import { useApp } from '@hed-hog/next-app-provider';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';

interface RealtimeContextValue {
  connected: boolean;
  /** Ref-counted join of realtime channels (rooms `channel:{name}`). */
  addChannels: (channels: string[]) => void;
  removeChannels: (channels: string[]) => void;
  /** Register a handler for a realtime event; returns an unsubscribe fn. */
  on: (event: string, handler: (payload: any) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  addChannels: () => undefined,
  removeChannels: () => undefined,
  on: () => () => undefined,
});

/**
 * Single shared WebSocket connection (`/realtime`) for the whole authenticated
 * app. Generic: any feature subscribes to channels and listens to events. The
 * socket is (re)created when the access token changes; channel subscriptions and
 * event listeners survive reconnects. No UI.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useApp();
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const channelCounts = useRef<Map<string, number>>(new Map());
  const listeners = useRef<Map<string, Set<(payload: any) => void>>>(new Map());

  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

  // Attach a single dispatcher per event to the current socket.
  const attachAllListeners = useCallback((socket: Socket) => {
    for (const event of listeners.current.keys()) {
      socket.on(event, (payload: any) => {
        listeners.current.get(event)?.forEach((h) => h(payload));
      });
    }
  }, []);

  useEffect(() => {
    if (!accessToken || !baseUrl) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // (Re)subscribe to all active channels after a (re)connect.
      const active = [...channelCounts.current.entries()]
        .filter(([, c]) => c > 0)
        .map(([ch]) => ch);
      if (active.length) socket.emit('subscribe', { channels: active });
    });
    socket.on('disconnect', () => setConnected(false));
    attachAllListeners(socket);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, baseUrl, attachAllListeners]);

  const addChannels = useCallback((channels: string[]) => {
    const toJoin: string[] = [];
    for (const ch of channels) {
      const next = (channelCounts.current.get(ch) ?? 0) + 1;
      channelCounts.current.set(ch, next);
      if (next === 1) toJoin.push(ch);
    }
    if (toJoin.length && socketRef.current?.connected) {
      socketRef.current.emit('subscribe', { channels: toJoin });
    }
  }, []);

  const removeChannels = useCallback((channels: string[]) => {
    const toLeave: string[] = [];
    for (const ch of channels) {
      const next = Math.max(0, (channelCounts.current.get(ch) ?? 0) - 1);
      if (next === 0) {
        channelCounts.current.delete(ch);
        toLeave.push(ch);
      } else {
        channelCounts.current.set(ch, next);
      }
    }
    if (toLeave.length && socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', { channels: toLeave });
    }
  }, []);

  const on = useCallback(
    (event: string, handler: (payload: any) => void) => {
      let set = listeners.current.get(event);
      if (!set) {
        set = new Set();
        listeners.current.set(event, set);
        // First listener for this event → attach the dispatcher to the socket.
        socketRef.current?.on(event, (payload: any) => {
          listeners.current.get(event)?.forEach((h) => h(payload));
        });
      }
      set.add(handler);
      return () => {
        listeners.current.get(event)?.delete(handler);
      };
    },
    [],
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({ connected, addChannels, removeChannels, on }),
    [connected, addChannels, removeChannels, on],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
