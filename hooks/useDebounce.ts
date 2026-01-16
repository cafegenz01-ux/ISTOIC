/**
 * useDebounce Hook
 * Debounce values with cleanup and custom options
 */

import { useState, useEffect } from 'react';

interface UseDebouncedOptions {
  delayMs?: number;
  onDebounce?: () => void;
  onResolve?: (value: unknown) => void;
}

/**
 * Custom hook for debouncing values
 */
export function useDebounce<T>(
  value: T,
  options: UseDebouncedOptions = {}
): [T, boolean] {
  const { delayMs = 500, onDebounce, onResolve } = options;
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    setIsDebouncing(true);
    onDebounce?.();

    const handler = setTimeout(() => {
      setDebouncedValue(value);
      setIsDebouncing(false);
      onResolve?.(value);
    }, delayMs);

    return () => clearTimeout(handler);
  }, [value, delayMs, onDebounce, onResolve]);

  return [debouncedValue, isDebouncing];
}
