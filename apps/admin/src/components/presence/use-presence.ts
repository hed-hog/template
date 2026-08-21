'use client';

import { useApp, useQuery } from '@hed-hog/next-app-provider';
import { useEffect, useState } from 'react';
import { useRealtime } from '@/components/realtime/realtime-provider';

export type PresenceSource = 'app' | 'teams' | 'both' | 'offline';

export interface PresenceStatus {
  userId: number;
  online: boolean;
  appOnline: boolean;
  teamsOnline: boolean;
  teamsAvailability: string | null;
  source: PresenceSource;
}

export type PresenceMap = Record<number, PresenceStatus>;

/** Fallback polling cadence, used only while the socket is disconnected. */
const POLL_MS = 20_000;

/**
 * Combined presence (app heartbeat + Teams) for a set of user ids, delivered in
 * real time over the shared WebSocket: it seeds once via `GET /presence`, then
 * subscribes to `presence:{id}` channels and applies pushed updates. If the
 * socket is disconnected it transparently falls back to polling — so the return
 * shape and behavior are identical for the consuming UIs.
 */
export function usePresence(userIds: Array<number | null | undefined>): PresenceMap {
  const { request } = useApp();
  const { connected, addChannels, removeChannels, on } = useRealtime();

  const ids = [
    ...new Set(
      userIds.filter((id): id is number => Number.isInteger(id) && (id as number) > 0),
    ),
  ].sort((a, b) => a - b);
  const key = ids.join(',');

  const [map, setMap] = useState<PresenceMap>({});

  // Seed (and fallback poll while the socket is down).
  const { data, refetch } = useQuery<PresenceMap>({
    queryKey: ['presence', key],
    enabled: ids.length > 0,
    staleTime: connected ? Infinity : POLL_MS,
    refetchInterval: connected ? false : POLL_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const response = await request<PresenceMap>({
        url: `/presence?userIds=${key}`,
        method: 'GET',
      });
      return response.data ?? {};
    },
  });

  useEffect(() => {
    if (data) setMap((prev) => ({ ...prev, ...data }));
  }, [data]);

  // Re-seed on (re)connect so we don't miss changes that happened while offline.
  useEffect(() => {
    if (connected && ids.length > 0) void refetch();
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to channels + apply pushed updates.
  useEffect(() => {
    if (ids.length === 0) return;
    const channels = ids.map((id) => `presence:${id}`);
    addChannels(channels);
    const off = on('presence:update', (status: PresenceStatus) => {
      if (status && ids.includes(status.userId)) {
        setMap((prev) => ({ ...prev, [status.userId]: status }));
      }
    });
    return () => {
      removeChannels(channels);
      off();
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}
