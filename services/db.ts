
const DB_NAME = 'IStoicAI_Vault_DB';
const DB_VERSION = 2; 
const STORES = {
    AUDIO: 'audio_cache',
    NOTES: 'notes_store',
    VECTORS: 'vector_index'
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = (e.target as any).result;
            
            if (!db.objectStoreNames.contains(STORES.AUDIO)) {
                db.createObjectStore(STORES.AUDIO);
            }
            
            if (!db.objectStoreNames.contains(STORES.NOTES)) {
                const noteStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
                noteStore.createIndex('updated', 'updated', { unique: false });
                noteStore.createIndex('title', 'title', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.VECTORS)) {
                const vectorStore = db.createObjectStore(STORES.VECTORS, { keyPath: 'id' });
                vectorStore.createIndex('noteId', 'noteId', { unique: true });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };
    });

    return dbPromise;
};

export const LocalDB = {
    async put(storeName: string, value: any, key?: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = key ? store.put(value, key) : store.put(value);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async get<T>(storeName: string, key: string): Promise<T | undefined> {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(undefined);
        });
    },

    async getAll<T>(storeName: string): Promise<T[]> {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    },

    async delete(storeName: string, key: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async clear(storeName: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    
    STORES
};

export const AudioCache = {
    async get(key: string): Promise<Blob | undefined> {
        try { return await LocalDB.get<Blob>(STORES.AUDIO, key); } 
        catch (e) { return undefined; }
    },
    async set(key: string, blob: Blob): Promise<void> {
        try { await LocalDB.put(STORES.AUDIO, blob, key); } 
        catch (e) { console.warn("IDB Audio Write Error", e); }
    },
    async clear(): Promise<void> {
        try { await LocalDB.clear(STORES.AUDIO); } 
        catch (e) { console.warn("Audio Cache Clear Error", e); }
    }
};