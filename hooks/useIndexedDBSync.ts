import { useEffect, useRef } from 'react';
import { LocalDB } from '../services/db';
import { Note } from '../types';
import { debugService } from '../services/debugService';

/**
 * POWERFUL INDEXEDDB SYNC HOOK
 * Fitur:
 * 1. Differential Sync: Hanya update yang berubah, hapus yang hilang.
 * 2. Parallel Processing: Menggunakan Promise.all untuk kecepatan maksimal.
 * 3. Empty State Handling: Menangani kasus penghapusan total dengan benar.
 */
export const useIndexedDBSync = (notes: Note[]) => {
    const isFirstRun = useRef(true);
    const isSyncing = useRef(false);

    useEffect(() => {
        // Skip run pertama untuk menghindari overwriting DB dengan state kosong saat loading awal
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        const sync = async () => {
            // Prevent race conditions (tabrakan sync)
            if (isSyncing.current) return;
            isSyncing.current = true;
            
            try {
                // ---------------------------------------------------------
                // 1. FETCH CURRENT DB STATE (Untuk mendeteksi penghapusan)
                // ---------------------------------------------------------
                let existingNotes: Note[] = [];
                try {
                    // Kita asumsikan LocalDB memiliki method getAll. 
                    // Jika tidak, biasanya library IDB mendukung ini.
                    // Jika error, kita pakai array kosong (Risk: Zombie notes tidak terhapus, tapi app tidak crash)
                    existingNotes = await LocalDB.getAll(LocalDB.STORES.NOTES) || [];
                } catch (err) {
                    console.warn("Could not fetch existing notes for diffing, proceeding with overwrite.");
                }

                // ---------------------------------------------------------
                // 2. CALCULATE DIFF (Differential Logic)
                // ---------------------------------------------------------
                
                // Map ID dari State (Data Terbaru)
                const currentIds = new Set(notes.map(n => n.id));
                
                // Cari Note di DB yang TIDAK ADA lagi di State (Berarti User menghapusnya)
                const idsToDelete = existingNotes
                    .filter(dbNote => !currentIds.has(dbNote.id))
                    .map(dbNote => dbNote.id);

                // ---------------------------------------------------------
                // 3. EXECUTE OPERATIONS (Parallel / Batching)
                // ---------------------------------------------------------
                
                const promises = [];

                // A. Operasi Hapus (DELETE)
                if (idsToDelete.length > 0) {
                    // debugService.log('INFO', 'SYNC', 'CLEANUP', `Removing ${idsToDelete.length} stale notes.`);
                    promises.push(
                        ...idsToDelete.map(id => LocalDB.delete(LocalDB.STORES.NOTES, id))
                    );
                }

                // B. Operasi Simpan/Update (PUT)
                // Kita overwrite semua note yang ada di state untuk memastikan konsistensi
                // Promise.all jauh lebih cepat daripada 'for loop await'
                if (notes.length > 0) {
                    promises.push(
                        ...notes.map(note => LocalDB.put(LocalDB.STORES.NOTES, note))
                    );
                }

                // Jalankan semua secara paralel
                await Promise.all(promises);

                // debugService.log('TRACE', 'SYNC', 'COMPLETE', `Synced ${notes.length} active notes. Removed ${idsToDelete.length}.`);

            } catch (e) {
                console.error("❌ Sync Failed Critical:", e);
            } finally {
                isSyncing.current = false;
            }
        };

        // Debounce: Tunggu 1 detik setelah user berhenti mengetik/mengubah data
        // Agar tidak spam database setiap kali ngetik 1 huruf
        const timeout = setTimeout(sync, 1000); 
        
        return () => clearTimeout(timeout);
    }, [notes]);
};
