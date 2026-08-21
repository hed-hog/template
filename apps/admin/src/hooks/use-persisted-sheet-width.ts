'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getFormDraftOwnerKey } from '@/hooks/use-form-draft';

type UsePersistedSheetWidthOptions = {
  sheetId: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  enabled?: boolean;
};

function isClient() {
  return typeof window !== 'undefined';
}

function clampWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.max(minWidth, Math.min(maxWidth, width));
}

function getStorageKey(sheetId: string, ownerKey: string | null) {
  return ownerKey
    ? `sheet-width:${sheetId}:${ownerKey}`
    : `sheet-width:${sheetId}:anonymous`;
}

export function usePersistedSheetWidth({
  sheetId,
  defaultWidth,
  minWidth,
  maxWidth,
  enabled = true,
}: UsePersistedSheetWidthOptions) {
  const { accessToken, user } = useApp();
  const ownerKey = useMemo(
    () =>
      getFormDraftOwnerKey(
        accessToken,
        user?.id ?? (user === null ? null : undefined)
      ),
    [accessToken, user]
  );

  const [width, setWidthState] = useState(() =>
    clampWidth(defaultWidth, minWidth, maxWidth)
  );

  useEffect(() => {
    if (!enabled || !isClient()) {
      return;
    }

    const storageKey = getStorageKey(sheetId, ownerKey);

    try {
      const storedWidth = Number(window.localStorage.getItem(storageKey));

      if (!Number.isFinite(storedWidth)) {
        setWidthState(clampWidth(defaultWidth, minWidth, maxWidth));
        return;
      }

      setWidthState(clampWidth(storedWidth, minWidth, maxWidth));
    } catch {
      setWidthState(clampWidth(defaultWidth, minWidth, maxWidth));
    }
  }, [defaultWidth, enabled, maxWidth, minWidth, ownerKey, sheetId]);

  const setWidth = useCallback(
    (nextWidth: number) => {
      const validWidth = clampWidth(nextWidth, minWidth, maxWidth);
      setWidthState(validWidth);

      if (!enabled || !isClient()) {
        return;
      }

      const storageKey = getStorageKey(sheetId, ownerKey);

      try {
        window.localStorage.setItem(storageKey, String(validWidth));
      } catch {
        // Ignore storage write failures.
      }
    },
    [enabled, maxWidth, minWidth, ownerKey, sheetId]
  );

  return [width, setWidth] as const;
}
