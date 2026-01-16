/**
 * useLocalStorageWithSync Hook
 * Enhanced localStorage with automatic syncing and type safety
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseLocalStorageOptions {
  syncTabs?: boolean;
  persist?: boolean;
  debounceMs?: number;
  validator?: (value: unknown) => boolean;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for localStorage with sync support
 */
export function useLocalStorageWithSync<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions = {}
): [T, (value: T | ((prev: T) => T)) => void, { isSynced: boolean; error: Error | null }] {
  const {
    syncTabs = true,
    persist = true,
    debounceMs = 0,
    validator,
    onError
  } = options;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      
      if (item) {
        const parsed = JSON.parse(item);
        if (validator && !validator(parsed)) {
          throw new Error(`Validation failed for key: ${key}`);
        }
        return parsed;
      }
      return initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      onError?.(error as Error);
      return initialValue;
    }
  });

  const [isSynced, setIsSynced] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const isUpdatingRef = useRef(false);

  // Write to localStorage
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Validate before storing
      if (validator && !validator(valueToStore)) {
        throw new Error(`Validation failed for value`);
      }

      setStoredValue(valueToStore);
      setError(null);

      if (!persist || typeof window === 'undefined') return;

      // Debounce localStorage writes
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        try {
          isUpdatingRef.current = true;
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          setIsSynced(true);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
        } finally {
          isUpdatingRef.current = false;
        }
      }, debounceMs);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [storedValue, key, persist, validator, debounceMs, onError]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    if (!syncTabs || typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue && !isUpdatingRef.current) {
        try {
          const newValue = JSON.parse(e.newValue);
          if (validator && !validator(newValue)) {
            throw new Error(`Validation failed for synced value`);
          }
          setStoredValue(newValue);
          setIsSynced(true);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, syncTabs, validator, onError]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return [storedValue, setValue, { isSynced, error }];
}
