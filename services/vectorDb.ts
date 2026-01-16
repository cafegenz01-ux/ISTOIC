
import { GoogleGenAI } from "@google/genai";
import { LocalDB } from "./db";
import { Note } from "../types";
import { KEY_MANAGER } from "./geminiService";
import { debugService } from "./debugService";

const EMBEDDING_MODEL = "text-embedding-004";

// Simple Cosine Similarity
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Batch Helper
const chunkArray = <T>(array: T[], size: number): T[][] => {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Yield to main thread to prevent blocking UI
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

export const VectorDB = {
    
    async generateEmbedding(text: string): Promise<number[] | null> {
        const apiKey = KEY_MANAGER.getKey('GEMINI');
        if (!apiKey) return null;

        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: [{ parts: [{ text }] }]
            });
            
            return response.embeddings?.[0]?.values || null;
        } catch (e: any) {
            if (e.message?.includes('429')) {
                debugService.log('WARN', 'VECTOR_DB', 'RATE_LIMIT', 'Pausing for rate limit...');
                await delay(2000); // Simple retry delay
            }
            console.error("Embedding generation failed", e);
            return null;
        }
    },

    async indexNotes(notes: Note[], onProgress?: (current: number, total: number) => void): Promise<number> {
        let indexedCount = 0;
        const total = notes.length;

        // Fetch existing vectors to skip unchanged notes
        const existingVectors = await LocalDB.getAll<{ id: string, noteId: string, embedding: number[], hash: string }>(LocalDB.STORES.VECTORS);
        const vectorMap = new Map(existingVectors.map(v => [v.noteId, v]));

        // 1. Filter notes that actually need indexing
        const notesToProcess = notes.filter(note => {
            const contentHash = note.id + note.updated.slice(0, 19);
            const existing = vectorMap.get(note.id);
            if (existing && existing.hash === contentHash) {
                indexedCount++; // Count as done
                return false;
            }
            return true;
        });

        // 2. Process in Batches to avoid Rate Limits
        const BATCH_SIZE = 3; // Conservative batch size
        const DELAY_MS = 1500; // Delay between batches
        const batches = chunkArray(notesToProcess, BATCH_SIZE);

        for (const batch of batches) {
            await Promise.all(batch.map(async (note) => {
                const contentHash = note.id + note.updated.slice(0, 19);
                const contextText = `Title: ${note.title}\nTags: ${note.tags?.join(', ')}\nContent: ${note.content.slice(0, 8000)}`;
                
                const embedding = await this.generateEmbedding(contextText);
                
                if (embedding) {
                    await LocalDB.put(LocalDB.STORES.VECTORS, {
                        id: note.id,
                        noteId: note.id,
                        embedding,
                        hash: contentHash,
                        lastUpdated: new Date().toISOString()
                    });
                    debugService.log('TRACE', 'VECTOR_DB', 'INDEXED', `Note ${note.id.slice(0,4)} indexed.`);
                }
                indexedCount++;
            }));

            if (onProgress) onProgress(indexedCount, total);
            
            // Artificial delay to respect API limits
            await delay(DELAY_MS);
        }
        
        return indexedCount;
    },

    async search(query: string, limit: number = 5): Promise<string[]> {
        const queryEmbedding = await this.generateEmbedding(query);
        if (!queryEmbedding) return [];

        const vectors = await LocalDB.getAll<{ id: string, embedding: number[] }>(LocalDB.STORES.VECTORS);
        
        const scored = [];
        // Non-blocking loop for large datasets
        for (let i = 0; i < vectors.length; i++) {
            // Yield every 100 items to avoid freezing UI
            if (i % 100 === 0) await yieldToMain();
            
            scored.push({
                id: vectors[i].id,
                score: cosineSimilarity(queryEmbedding, vectors[i].embedding)
            });
        }

        // Sort descending by score
        scored.sort((a, b) => b.score - a.score);

        // Filter meaningful results
        const results = scored.filter(s => s.score > 0.45).slice(0, limit);
        
        debugService.log('INFO', 'VECTOR_DB', 'SEARCH', `Query: "${query}" matched ${results.length} vectors.`);
        return results.map(r => r.id);
    }
};
