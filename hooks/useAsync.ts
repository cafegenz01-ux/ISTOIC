/**
 * useAsync Hook
 * Handle async operations with loading, error, and data states
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  dependencies?: React.DependencyList;
  skipOnNull?: boolean;
}

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncReturn<T> extends UseAsyncState<T> {
  retry: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for async operations
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T> {
  const {
    onSuccess,
    onError,
    dependencies = [],
    skipOnNull = false
  } = options;

  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: true,
    error: null
  });

  const isMountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const result = await asyncFunction();

      if (isMountedRef.current) {
        setState({ data: result, loading: false, error: null });
        onSuccess?.(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ data: null, loading: false, error });
        onError?.(error);
      }
    }
  }, [asyncFunction, onSuccess, onError]);

  const retry = useCallback(async () => {
    await execute();
  }, [execute]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    execute();

    return () => {
      isMountedRef.current = false;
    };
  }, dependencies);

  return {
    ...state,
    retry,
    reset
  };
}
