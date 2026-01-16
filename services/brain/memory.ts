import { Note } from "../../types";
import { MemoryService } from "../memoryService";

// Fix: Accept Note[] | string to support pre-processed context strings from various engines
export const getMemoryLayer = async (query: string, notes: Note[] | string): Promise<string> => {
    try {
        if (typeof notes === 'string') return notes;
        if (!query || !Array.isArray(notes) || notes.length === 0) return "";
        
        // Wrap MemoryService call in try-catch to prevent blocking the chat if DB fails
        let recallContext = "";
        try {
            recallContext = await MemoryService.recall(query, notes);
        } catch (memErr) {
            console.warn("Memory Recall Failed (Non-Critical):", memErr);
            recallContext = "Memory access temporary unavailable.";
        }
        
        const recentNotes = notes
            .filter(n => !n.is_archived)
            .slice(0, 15)
            .map(n => `- ${n.title} [Tags: ${n.tags?.join(', ') || 'NONE'}] (ID: ${n.id})`)
            .join('\n');

        return `
=== NEURAL_MEMORY_LAYER ===
${recallContext}

[VAULT_SNAPSHOT]
${recentNotes || 'No active notes in vault.'}
`;
    } catch (err) {
        console.error("Memory Layer Critical Error:", err);
        return ""; // Return string kosong aman daripada crash
    }
};