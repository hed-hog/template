'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Safety: React 18+ silently ignores setState on unmounted components, but an
// explicit isMounted guard avoids scheduling any state updates after teardown,
// which eliminates a class of subtle re-render cascades in development / Strict Mode.

const ANONYMOUS_DRAFT_OWNER_KEY = 'anonymous';
const FORM_DRAFT_STORAGE_MARKER = '-draft';

export type StoredFormDraft<T> = {
  payload: T;
  savedAt: string;
  version: number;
  ownerKey?: string | null;
};

type UseFormDraftOptions<T> = {
  storageKey: string;
  value: T;
  hasData: boolean;
  enabled?: boolean;
  debounceMs?: number;
  ttlMs?: number;
  version?: number;
};

function isClient() {
  return typeof window !== 'undefined';
}

export function getFormDraftOwnerKey(
  accessToken?: string,
  userId?: string | number | null
) {
  if (!accessToken) {
    return ANONYMOUS_DRAFT_OWNER_KEY;
  }

  if (userId === undefined || userId === null || userId === '') {
    return null;
  }

  return `user:${String(userId)}`;
}

export function isFormDraftStorageKey(storageKey: string) {
  return storageKey.includes(FORM_DRAFT_STORAGE_MARKER);
}

function normalizeStoredDraft<T>(
  rawValue: unknown,
  fallbackVersion: number
): StoredFormDraft<T> | null {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  const record = rawValue as {
    payload?: T;
    savedAt?: string;
    version?: number;
    ownerKey?: string | null;
  };

  if ('payload' in record) {
    // Unreachable: rawValue always comes from JSON.parse, and JSON has no
    // `undefined` literal, so a parsed object with the `payload` key can
    // only ever hold a JSON-representable value, never `undefined`.
    /* v8 ignore next 3 */
    if (record.payload === undefined) {
      return null;
    }

    return {
      payload: record.payload,
      savedAt:
        typeof record.savedAt === 'string'
          ? record.savedAt
          : new Date().toISOString(),
      version:
        typeof record.version === 'number' ? record.version : fallbackVersion,
      ownerKey:
        typeof record.ownerKey === 'string' || record.ownerKey === null
          ? record.ownerKey
          : null,
    };
  }

  return {
    payload: rawValue as T,
    savedAt: new Date().toISOString(),
    version: fallbackVersion,
    ownerKey: null,
  };
}

export function useFormDraft<T>({
  storageKey,
  value,
  hasData,
  enabled = true,
  debounceMs = 800,
  ttlMs = 1000 * 60 * 60 * 24 * 3,
  version = 1,
}: UseFormDraftOptions<T>) {
  const { accessToken, user } = useApp();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // Guard against state updates after this hook's host component has unmounted.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep a ref to the latest value so saveDraft never needs value in its deps.
  const valueRef = useRef(value);
  valueRef.current = value;

  const ownerKey = useMemo(
    () =>
      getFormDraftOwnerKey(
        accessToken,
        user?.id ?? (user === null ? null : undefined)
      ),
    [accessToken, user]
  );
  const isOwnerReady = !accessToken || ownerKey !== null;

  const clearDraft = useCallback(() => {
    // SSR-only guard: `isClient()` is always true in the jsdom test
    // environment (`window` is always defined), so this branch is
    // unreachable from tests and only guards a real server-render call.
    /* v8 ignore next 3 */
    if (!isClient()) {
      return;
    }

    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage clear failures.
    }

    if (isMountedRef.current) {
      setSavedAt(null);
      setHasDraft(false);
    }
  }, [storageKey]);

  const loadDraft = useCallback((): StoredFormDraft<T> | null => {
    if (!isClient() || !isOwnerReady || ownerKey === null) {
      return null;
    }

    try {
      const rawDraft = window.localStorage.getItem(storageKey);

      if (!rawDraft) {
        if (isMountedRef.current) {
          setSavedAt(null);
          setHasDraft(false);
        }
        return null;
      }

      const parsedDraft = JSON.parse(rawDraft) as unknown;
      const normalizedDraft = normalizeStoredDraft<T>(parsedDraft, version);

      if (!normalizedDraft) {
        clearDraft();
        return null;
      }

      if (accessToken) {
        if (
          !normalizedDraft.ownerKey ||
          normalizedDraft.ownerKey !== ownerKey
        ) {
          clearDraft();
          return null;
        }
      } else if (
        normalizedDraft.ownerKey &&
        normalizedDraft.ownerKey !== ownerKey
      ) {
        clearDraft();
        return null;
      }

      if (
        typeof ttlMs === 'number' &&
        ttlMs > 0 &&
        Date.now() - new Date(normalizedDraft.savedAt).getTime() > ttlMs
      ) {
        clearDraft();
        return null;
      }

      if (isMountedRef.current) {
        setSavedAt(normalizedDraft.savedAt);
        setHasDraft(true);
      }
      return normalizedDraft;
    } catch {
      clearDraft();
      return null;
    }
  }, [
    accessToken,
    clearDraft,
    isOwnerReady,
    ownerKey,
    storageKey,
    ttlMs,
    version,
  ]);

  const saveDraft = useCallback(
    (nextValue?: T) => {
      if (!enabled || !isOwnerReady || ownerKey === null) {
        return;
      }

      if (!hasData) {
        clearDraft();
        return;
      }

      // SSR-only guard: `isClient()` is always true in the jsdom test
      // environment (`window` is always defined), so this branch is
      // unreachable from tests and only guards a real server-render call.
      /* v8 ignore next 3 */
      if (!isClient()) {
        return;
      }

      const actualValue =
        nextValue !== undefined ? nextValue : valueRef.current;
      const nextSavedAt = new Date().toISOString();
      const payload: StoredFormDraft<T> = {
        payload: actualValue,
        savedAt: nextSavedAt,
        version,
        ownerKey,
      };

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
        if (isMountedRef.current) {
          setSavedAt(nextSavedAt);
          setHasDraft(true);
        }
      } catch {
        // Ignore storage write failures.
      }
    },
    // value is intentionally excluded — accessed via valueRef to avoid
    // recreating saveDraft on every render when value is an object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearDraft, enabled, hasData, isOwnerReady, ownerKey, storageKey, version]
  );

  // Serialize value so the auto-save effect only re-runs when content changes,
  // not when the object reference changes (e.g. after every useWatch call).
  const serializedValue = JSON.stringify(value);

  useEffect(() => {
    if (!enabled || !isOwnerReady) {
      return;
    }

    loadDraft();
  }, [enabled, isOwnerReady, loadDraft]);

  useEffect(() => {
    if (!enabled || !isOwnerReady) {
      return;
    }

    const timeout = window.setTimeout(() => {
      saveDraft(valueRef.current);
    }, debounceMs);

    return () => window.clearTimeout(timeout);
    // serializedValue used instead of value to avoid firing on every object re-creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceMs, enabled, isOwnerReady, saveDraft, serializedValue]);

  return {
    clearDraft,
    loadDraft,
    saveDraft,
    savedAt,
    hasDraft,
  };
}
