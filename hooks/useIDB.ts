import { useState, useEffect, useCallback, useRef } from 'react';

// --- CONFIG: SINGLETON DATABASE CONNECTION ---
const DB_NAME = 'istoic-core-v4-titanium'; // Nama baru untuk reset total database yang korup
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error("IndexedDB not supported"));
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { dbPromise = null; reject(request.error); };
    });
  }
  return dbPromise;
};

// --- HELPER FUNCTIONS ---
const get = async <T>(key: string): Promise<T | undefined> => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
  } catch (e) { return undefined; }
};

const set = async (key: string, val: any): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) { console.error("IDB Set Error", e); }
};

// --- MAIN HOOK (POWERFUL & SAFE) ---
export function useIDB<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void, boolean] {
  const [value, setInternalValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const mounted = useRef(true);

  // 1. Load Data Saat Mount (Sekali Saja)
  useEffect(() => {
    mounted.current = true;
    get<T>(key).then((dbValue) => {
      if (mounted.current) {
        if (dbValue !== undefined) setInternalValue(dbValue);
        setIsLoaded(true);
      }
    });
    return () => { mounted.current = false; };
  }, [key]);

  // 2. Setter "Fire-and-Forget" (UI Update Instan)
  const setValue = useCallback((val: T | ((prev: T) => T)) => {
    setInternalValue((prev) => {
      const newValue = val instanceof Function ? val(prev) : val;
      // Simpan ke DB di background (JANGAN AWAIT agar UI smooth)
      set(key, newValue);
      return newValue;
    });
  }, [key]);

  return [value, setValue, isLoaded];
}