'use client';

import { useRealtime } from '@/components/realtime/realtime-provider';
import { useApp } from '@hed-hog/next-app-provider';
import { useEffect } from 'react';

/** How often the browser pings the heartbeat while the tab is visible. */
const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * HTTP heartbeat FALLBACK: only used while the realtime socket is disconnected.
 * When the socket is connected the server derives app-presence from the live
 * connection, so no HTTP ping is needed. Mounted once in the app layout. No UI.
 */
export function PresenceHeartbeat() {
  const { request, user } = useApp();
  const { connected } = useRealtime();
  const userId = (user as { id?: number } | null | undefined)?.id;

  useEffect(() => {
    // Socket connected → server-side heartbeat handles it; skip HTTP pings.
    if (!userId || connected) return;

    let cancelled = false;
    const beat = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      request({ url: '/presence/heartbeat', method: 'POST' }).catch(() => undefined);
    };

    beat(); // immediate
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, request, connected]);

  return null;
}
