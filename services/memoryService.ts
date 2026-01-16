
import { v4 as uuidv4 } from 'uuid';
import { ChatThread, Note } from '../types';
import { HANISAH_KERNEL } from './melsaKernel';
import { VectorDB } from './vectorDb';
import { LocalDB } from './db';
import { debugService } from './debugService';

export const MemoryService = {
    async summarizeAndStore(thread: ChatThread, existingNotes: Note[], setNotes: (n: Note[]) => void) {
        // Only memorize substantial conversations
        if (!thread || thread.messages.length < 4) return;

        // Prevent duplicate memories for the same thread update (simple check)
        // In a real app, we'd track 'lastSummarized' timestamp on the thread.
        
        const conversation = thread.messages
            .filter(m => m.text && typeof m.text === 'string')
            .map(m => `${m.role.toUpperCase()}: ${m.text}`)
            .join('\n');
        
        debugService.log('INFO', 'MEMORY_CORE', 'SUMMARIZING', `Processing thread ${thread.id.slice(0,8)}...`);

        const prompt = `
        [TASK: EXTRACT_CORE_MEMORY]
        Analyze the following conversation.
        Extract PERMANENT facts about the user (preferences, projects, tech stack, life details) and key insights.
        Ignore greetings, small talk, and temporary context.
        
        CONVERSATION:
        ${conversation.slice(0, 15000)}

        OUTPUT FORMAT:
        Return ONLY a concise paragraph or bullet points. If nothing worth remembering, return "NO_DATA".
        `;

        try {
            const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            const summary = response.text?.trim();

            if (!summary || summary.includes("NO_DATA") || summary.length < 10) {
                debugService.log('INFO', 'MEMORY_CORE', 'SKIP', 'No salient facts found.');
                return;
            }

            // Create Memory Note
            const memoryNote: Note = {
                id: uuidv4(),
                title: `🧠 MEMORY: ${new Date().toLocaleDateString()} (${thread.title})`,
                content: summary,
                tags: ['CORE_MEMORY', 'AUTO_GENERATED'],
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                is_archived: true, // Hidden from main view by default
                is_pinned: false,
                user: 'System'
            };

            // 1. Save to DB
            await LocalDB.put(LocalDB.STORES.NOTES, memoryNote);
            
            // 2. Update UI State
            setNotes([memoryNote, ...existingNotes]);

            // 3. Vector Indexing (Background)
            await VectorDB.indexNotes([memoryNote]);
            
            debugService.log('INFO', 'MEMORY_CORE', 'STORED', 'Long-term memory consolidated.');

        } catch (e: any) {
            debugService.log('ERROR', 'MEMORY_CORE', 'FAIL', e.message);
        }
    },

    async recall(query: string, notes: Note[]): Promise<string> {
        try {
            if (!query || query.length < 3) return "";

            // Search Vector DB
            const ids = await VectorDB.search(query, 3);
            
            // Filter for Core Memories ONLY
            const relevantMemories = notes
                .filter(n => ids.includes(n.id) && n.tags?.includes('CORE_MEMORY'))
                .map(n => n.content);

            if (relevantMemories.length === 0) return "";

            debugService.log('INFO', 'MEMORY_CORE', 'RECALL', `Retrieved ${relevantMemories.length} memories.`);
            
            return `
[LONG_TERM_MEMORY_RECALL]
The following facts about the user are retrieved from the Memory Core:
${relevantMemories.map(m => `- ${m}`).join('\n')}
`;
        } catch (e) {
            return "";
        }
    }
};
