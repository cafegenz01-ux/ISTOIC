
import { debugService } from './debugService';

const DB_NAME = 'IStoicAI_Vault_v1';
const STORES = {
    CHATS: 'chat_threads',
    NOTES: 'smart_notes',
    AUDIO_CACHE: 'audio_blobs'
};

class StorageEngine {
    private dbPromise: Promise<IDBDatabase>;

    constructor() {
        this.dbPromise = new Promise((resolve, reject) => {
            if (typeof window === 'undefined') return;
            
            const request = indexedDB.open(DB_NAME, 2);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORES.CHATS)) db.createObjectStore(STORES.CHATS, { keyPath: 'id' });
                if (!db.objectStoreNames.contains(STORES.NOTES)) db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
                if (!db.objectStoreNames.contains(STORES.AUDIO_CACHE)) db.createObjectStore(STORES.AUDIO_CACHE, { keyPath: 'id' });
            };

            request.onsuccess = (event: any) => {
                debugService.log('INFO', 'STORAGE', 'INIT', 'IndexedDB Mounted.');
                resolve(event.target.result);
            };

            request.onerror = (event: any) => {
                debugService.log('ERROR', 'STORAGE', 'FAIL', 'IndexedDB Failed.', event);
                reject(event.target.error);
            };
        });
    }

    private async perform<T>(storeName: string, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = callback(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // --- GENERIC API ---

    public async saveItem(store: 'CHATS' | 'NOTES', item: any) {
        return this.perform(STORES[store], 'readwrite', (s) => s.put(item));
    }

    public async saveAll(store: 'CHATS' | 'NOTES', items: any[]) {
        const db = await this.dbPromise;
        const tx = db.transaction(STORES[store], 'readwrite');
        const s = tx.objectStore(STORES[store]);
        items.forEach(item => s.put(item));
        return new Promise<void>((resolve) => {
            tx.oncomplete = () => resolve();
        });
    }

    public async getAll<T>(store: 'CHATS' | 'NOTES'): Promise<T[]> {
        return this.perform(STORES[store], 'readonly', (s) => s.getAll());
    }

    public async deleteItem(store: 'CHATS' | 'NOTES', id: string) {
        return this.perform(STORES[store], 'readwrite', (s) => s.delete(id));
    }

    // --- AUDIO CACHE SPECIFIC ---
    
    public async getAudio(hashId: string): Promise<Blob | null> {
        try {
            const record = await this.perform<{ id: string, blob: Blob }>(STORES.AUDIO_CACHE, 'readonly', (s) => s.get(hashId));
            return record ? record.blob : null;
        } catch (e) { return null; }
    }

    public async saveAudio(hashId: string, blob: Blob) {
        try {
            await this.perform(STORES.AUDIO_CACHE, 'readwrite', (s) => s.put({ id: hashId, blob, timestamp: Date.now() }));
        } catch (e) {}
    }
}

export const db = new StorageEngine();
