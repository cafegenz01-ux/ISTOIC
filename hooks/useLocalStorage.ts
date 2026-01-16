import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const isNative = () => Capacitor.isNativePlatform();

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const currentStoredValue = useRef<T>(storedValue);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value;

        try {
          const native = isNative();

          if (!native && typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
            window.dispatchEvent(
              new CustomEvent('local-storage-update', {
                detail: { key, newValue: valueToStore },
              })
            );
          }

          if (native) {
            Preferences.set({ key, value: JSON.stringify(valueToStore) }).catch((error) => {
              console.warn(`Error saving native storage key "${key}":`, error);
            });
            // Avoid leaking sensitive values to Web Storage on native platforms
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(key);
            }
          }
        } catch (error) {
          console.warn(`Error saving localStorage key "${key}":`, error);
        }

        currentStoredValue.current = valueToStore;
        return valueToStore;
      });
    },
    [key]
  );

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      if (event instanceof StorageEvent) {
        if (event.key === key && event.newValue) {
          setStoredValue(JSON.parse(event.newValue));
        }
      } else if (event instanceof CustomEvent) {
        if (event.detail.key === key) {
          setStoredValue(event.detail.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleStorageChange as EventListener);
    };
  }, [key]);

  useEffect(() => {
    if (!isNative()) return;
    let isMounted = true;

    Preferences.get({ key })
      .then(({ value }) => {
        if (!isMounted || value === null || value === undefined) return;
        try {
          const parsed = JSON.parse(value) as T;
          setStoredValue(parsed);
        } catch (error) {
          console.warn(`Error parsing native storage key "${key}":`, error);
        }
      })
      .catch((error) => {
        console.warn(`Error reading native storage key "${key}":`, error);
      });

    return () => {
      isMounted = false;
    };
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;
