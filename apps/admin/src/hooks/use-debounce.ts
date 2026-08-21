import { DEBOUNCE_MILLISECONDS } from '@/constants/debounce-milliseconds';
import { useEffect, useState } from 'react';

export function useDebounce<T>(
  value: T,
  delay: number = DEBOUNCE_MILLISECONDS
): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
