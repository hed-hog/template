'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getFormDraftOwnerKey } from '@/hooks/use-form-draft';

export type ChatLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UsePersistedChatLayoutOptions = {
  storageId: string;
  defaultLayout: ChatLayout;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  enabled?: boolean;
};

function isClient() {
  return typeof window !== 'undefined';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type ChatLayoutBounds = {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
};

export function clampChatLayout(
  layout: ChatLayout,
  { minWidth, maxWidth, minHeight, maxHeight }: ChatLayoutBounds
): ChatLayout {
  return clampLayout(layout, minWidth, maxWidth, minHeight, maxHeight);
}

function clampLayout(
  layout: ChatLayout,
  minWidth: number,
  maxWidth: number,
  minHeight: number,
  maxHeight: number
): ChatLayout {
  const width = clamp(layout.width, minWidth, maxWidth);
  const height = clamp(layout.height, minHeight, maxHeight);
  const maxX = isClient() ? Math.max(0, window.innerWidth - width) : layout.x;
  const maxY = isClient()
    ? Math.max(0, window.innerHeight - height)
    : layout.y;

  return {
    x: clamp(layout.x, 0, maxX),
    y: clamp(layout.y, 0, maxY),
    width,
    height,
  };
}

function getStorageKey(storageId: string, ownerKey: string | null) {
  return `${storageId}-layout:${ownerKey ?? 'anonymous'}`;
}

export function usePersistedChatLayout({
  storageId,
  defaultLayout,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  enabled = true,
}: UsePersistedChatLayoutOptions) {
  const { accessToken, user } = useApp();
  const ownerKey = useMemo(
    () =>
      getFormDraftOwnerKey(
        accessToken,
        user?.id ?? (user === null ? null : undefined)
      ),
    [accessToken, user]
  );

  const [layout, setLayoutState] = useState<ChatLayout>(() =>
    clampLayout(defaultLayout, minWidth, maxWidth, minHeight, maxHeight)
  );

  useEffect(() => {
    if (!enabled || !isClient()) {
      return;
    }

    const storageKey = getStorageKey(storageId, ownerKey);

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setLayoutState(
          clampLayout(defaultLayout, minWidth, maxWidth, minHeight, maxHeight)
        );
        return;
      }

      const parsed = JSON.parse(raw) as Partial<ChatLayout>;
      if (
        typeof parsed.x !== 'number' ||
        typeof parsed.y !== 'number' ||
        typeof parsed.width !== 'number' ||
        typeof parsed.height !== 'number' ||
        ![parsed.x, parsed.y, parsed.width, parsed.height].every(
          Number.isFinite
        )
      ) {
        setLayoutState(
          clampLayout(defaultLayout, minWidth, maxWidth, minHeight, maxHeight)
        );
        return;
      }

      setLayoutState(
        clampLayout(
          parsed as ChatLayout,
          minWidth,
          maxWidth,
          minHeight,
          maxHeight
        )
      );
    } catch {
      setLayoutState(
        clampLayout(defaultLayout, minWidth, maxWidth, minHeight, maxHeight)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ownerKey, storageId]);

  const setLayout = useCallback(
    (nextLayout: ChatLayout) => {
      const validLayout = clampLayout(
        nextLayout,
        minWidth,
        maxWidth,
        minHeight,
        maxHeight
      );
      setLayoutState(validLayout);

      if (!enabled || !isClient()) {
        return;
      }

      const storageKey = getStorageKey(storageId, ownerKey);

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(validLayout));
      } catch {
        // Ignore storage write failures.
      }
    },
    [enabled, maxHeight, maxWidth, minHeight, minWidth, ownerKey, storageId]
  );

  return [layout, setLayout] as const;
}
