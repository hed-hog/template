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
      // A chave ausente precisa ser tratada ANTES da conversao: Number(null)
      // e 0, e 0 e finito, entao a guarda abaixo nao disparava e o clamp
      // jogava toda folha para o minWidth na primeira abertura — o
      // defaultWidth nunca valia nada. O mesmo vale para "" (Number('') === 0).
      const rawWidth = window.localStorage.getItem(storageKey);
      const storedWidth = rawWidth === null ? Number.NaN : Number(rawWidth);

      if (!Number.isFinite(storedWidth) || storedWidth <= 0) {
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
