import { debugService } from './debugService';

// --- TYPES ---
export interface StreamChunk {
  text?: string;
  metadata?: {
    provider?: string;
    keyId?: string;
    latency?: number;
  };
  isError?: boolean;
}

/**
 * ⚡ OMNI RACE KERNEL (CLIENT BRIDGE V3)
 * * Modul ini adalah "Jembatan Penghubung" antara UI Chat dengan "Otak" di Server Vercel.
 * Tidak ada API Key yang disimpan di sini (Aman).
 * Tugasnya:
 * 1. Mengirim prompt ke Server API (/api/routeomnirace).
 * 2. Menerima aliran data (Stream) JSON dari server.
 * 3. Menyusun ulang potongan data menjadi teks yang bisa dibaca manusia.
 * 4. Menangani kondisi darurat (Offline/Server Down).
 */
export class OmniRaceKernel {
  
  /**
   * Memulai stream permintaan ke server.
   * @param prompt Text input dari user
   * @param systemInstruction Instruksi persona AI
   * @param context Konteks percakapan sebelumnya
   */
  public async *raceStream(
    prompt: string, 
    systemInstruction: string = "You are a helpful assistant.",
    context?: string
  ): AsyncGenerator<StreamChunk> {
    
    const raceId = crypto.randomUUID().slice(0, 4);
    debugService.log('INFO', 'OMNI_CLIENT', `REQ_${raceId}`, '🛰️ Uplinking to Hydra Server Node...');

    try {
        // 1. Dial Server API
        const response = await fetch('/api/routeomnirace', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // Header opsional untuk memberitahu server kita butuh stream
                'Accept': 'text/event-stream' 
            },
            body: JSON.stringify({ 
                prompt, 
                system: systemInstruction, 
                context 
            })
        });

        // Handle HTTP Errors (4xx, 5xx)
        if (!response.ok) {
             throw new Error(`Server Uplink Error: ${response.status} (${response.statusText})`);
        }
        
        if (!response.body) throw new Error("Server returned empty signal (No Body)");

        // 2. Initialize Stream Reader
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        // 3. Process Stream Loop
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode chunk binary ke text
            const chunkStr = decoder.decode(value, { stream: true });
            buffer += chunkStr;

            // 4. ROBUST JSON PARSER LOGIC
            // Tantangan: Server mengirim concatenated JSON: {"text":"A"}{"text":"B"}
            // Kita harus memisahkan objek-objek ini dengan presisi.
            
            let boundaryFound = true;
            while (boundaryFound) {
                boundaryFound = false;
                
                // Cari posisi akhir objek JSON pertama '}'
                // Strategi sederhana: Cari '}' lalu coba parse substring dari awal sampai '}'
                // Jika gagal, cari '}' berikutnya.
                
                const openBrace = buffer.indexOf('{');
                if (openBrace === -1) {
                    // Tidak ada objek dimulai, buang sampah jika buffer kepanjangan
                    if (buffer.length > 100) buffer = ''; 
                    break;
                }

                // Kita iterasi cari penutup '}'
                for (let i = openBrace + 1; i < buffer.length; i++) {
                    if (buffer[i] === '}') {
                        // Potensi JSON lengkap ditemukan
                        const potentialJson = buffer.slice(openBrace, i + 1);
                        
                        try {
                            const parsed = JSON.parse(potentialJson);
                            
                            // VALID JSON FOUND!
                            if (parsed.text) {
                                yield { 
                                    text: parsed.text, 
                                    metadata: { 
                                        provider: parsed.provider,
                                        keyId: parsed.keyId 
                                    } 
                                };
                            } else if (parsed.error) {
                                debugService.log('ERROR', 'OMNI_CLIENT', 'SERVER_MSG', parsed.text);
                            }

                            // Hapus bagian yang sudah diproses dari buffer
                            buffer = buffer.slice(i + 1);
                            boundaryFound = true; // Ulangi loop untuk sisa buffer
                            break; // Break for loop, continue while loop

                        } catch (e) {
                            // Parsing gagal, berarti '}' ini mungkin bagian dari teks konten, bukan penutup JSON.
                            // Lanjut cari '}' berikutnya.
                            continue;
                        }
                    }
                }
            }
        }

    } catch (error: any) {
        console.error("🔥 OmniClient Fatal:", error);
        debugService.log('ERROR', 'OMNI_CLIENT', 'FALLBACK', error.message);
        
        // 5. EMERGENCY FALLBACK (OFFLINE SIMULATION)
        // Jika server mati total atau internet putus, jalankan simulasi lokal
        // agar User Experience tidak rusak (tetap ada respon).
        
        yield { 
            text: "\n\n> ⚠️ **System Notice**: Server connection unstable. Engaging offline backup protocol.\n\n",
            isError: true 
        };
        
        const offlineResponses = [
            "Maaf, koneksi ke server AI utama terputus.",
            "Sistem sedang mencoba memulihkan jalur data.",
            "Silakan periksa koneksi internet Anda atau coba lagi beberapa saat lagi.",
            "[Offline Mode Active]"
        ];
        
        // Pilih respon acak atau gabungan
        const msg = offlineResponses.join(" ");
        const words = msg.split(" ");
        
        for (const w of words) {
            await new Promise(r => setTimeout(r, 50)); // Efek ketik
            yield { text: w + " " };
        }
    }
  }
}

// Export Singleton Instance
export const OMNI_KERNEL = new OmniRaceKernel();
