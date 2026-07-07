'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type UsePersistedPageSizeOptions = {
  storageKey: string;
  defaultValue: number;
  allowedValues: readonly number[];
};

function isClient() {
  return typeof window !== 'undefined';
}

function getValidPageSize(
  value: string | null,
  allowedValues: readonly number[],
  defaultValue: number
) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return defaultValue;
  }

  return allowedValues.includes(parsedValue) ? parsedValue : defaultValue;
}

export function usePersistedPageSize({
  storageKey,
  defaultValue,
  allowedValues,
}: UsePersistedPageSizeOptions) {
  const allowedValuesKey = useMemo(
    () => allowedValues.join('\0'),
    [allowedValues]
  );

  const normalizedAllowedValues = useMemo(
    () => allowedValues,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedValuesKey]
  );

  const [pageSize, setPageSizeState] = useState(() => {
    // SSR-only guard: `isClient()` is always true in the jsdom test
    // environment (`window` is always defined), so this branch is
    // unreachable from tests and only guards a real server-render call.
    /* v8 ignore next 3 */
    if (!isClient()) {
      return defaultValue;
    }

    try {
      return getValidPageSize(
        window.localStorage.getItem(storageKey),
        normalizedAllowedValues,
        defaultValue
      );
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    // SSR-only guard: `isClient()` is always true in the jsdom test
    // environment (`window` is always defined), so this branch is
    // unreachable from tests and only guards a real server-render call.
    /* v8 ignore next 3 */
    if (!isClient()) {
      return;
    }

    try {
      setPageSizeState(
        getValidPageSize(
          window.localStorage.getItem(storageKey),
          normalizedAllowedValues,
          defaultValue
        )
      );
    } catch {
      setPageSizeState(defaultValue);
    }
  }, [defaultValue, normalizedAllowedValues, storageKey]);

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      const validPageSize = getValidPageSize(
        String(nextPageSize),
        normalizedAllowedValues,
        defaultValue
      );

      setPageSizeState(validPageSize);

      // SSR-only guard: `isClient()` is always true in the jsdom test
      // environment (`window` is always defined), so this branch is
      // unreachable from tests and only guards a real server-render call.
      /* v8 ignore next 3 */
      if (!isClient()) {
        return;
      }

      try {
        window.localStorage.setItem(storageKey, String(validPageSize));
      } catch {
        // Ignore storage write failures.
      }
    },
    [defaultValue, normalizedAllowedValues, storageKey]
  );

  return [pageSize, setPageSize] as const;
}
