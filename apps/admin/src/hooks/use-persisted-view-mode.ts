'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type UsePersistedViewModeOptions<T extends string> = {
  storageKey: string;
  defaultValue: T;
  allowedValues: readonly T[];
};

function isClient() {
  return typeof window !== 'undefined';
}

function getValidViewMode<T extends string>(
  value: string | null,
  allowedValues: readonly T[],
  defaultValue: T
) {
  return allowedValues.includes(value as T) ? (value as T) : defaultValue;
}

export function usePersistedViewMode<T extends string>({
  storageKey,
  defaultValue,
  allowedValues,
}: UsePersistedViewModeOptions<T>) {
  const [viewMode, setViewModeState] = useState<T>(defaultValue);
  const allowedValuesKey = useMemo(
    () => allowedValues.join('\0'),
    [allowedValues]
  );
  const normalizedAllowedValues = useMemo(
    () => allowedValues,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedValuesKey]
  );

  useEffect(() => {
    // SSR-only guard: `isClient()` is always true in the jsdom test
    // environment (`window` is always defined), so this branch is
    // unreachable from tests and only guards a real server-render call.
    /* v8 ignore next 3 */
    if (!isClient()) {
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        setViewModeState(
          getValidViewMode(
            window.localStorage.getItem(storageKey),
            normalizedAllowedValues,
            defaultValue
          )
        );
      } catch {
        setViewModeState(defaultValue);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [defaultValue, normalizedAllowedValues, storageKey]);

  const setViewMode = useCallback(
    (nextViewMode: T) => {
      const validViewMode = getValidViewMode(
        nextViewMode,
        normalizedAllowedValues,
        defaultValue
      );

      setViewModeState(validViewMode);

      // SSR-only guard: `isClient()` is always true in the jsdom test
      // environment (`window` is always defined), so this branch is
      // unreachable from tests and only guards a real server-render call.
      /* v8 ignore next 3 */
      if (!isClient()) {
        return;
      }

      try {
        window.localStorage.setItem(storageKey, validViewMode);
      } catch {
        // Ignore storage write failures.
      }
    },
    [defaultValue, normalizedAllowedValues, storageKey]
  );

  return [viewMode, setViewMode] as const;
}
