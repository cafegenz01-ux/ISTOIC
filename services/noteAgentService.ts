
import { Note } from '../types';
import { HANISAH_KERNEL } from './melsaKernel';
import { v4 as uuidv4 } from 'uuid';

export type AgentType = 'ORGANIZER' | 'INSIGHT' | 'TASKS' | 'MEMORY';

interface AgentResponse {
    updates?: Partial<Note>[];
    insight?: string;
    tasks?: { text: string, sourceNoteId: string }[];
    relatedIds?: string[];
}

const extractJson = <T>(text: string | undefined, fallback: T): T => {
    if (!text) return fallback;
    try {
        let clean = text.replace(/```json|```/g, '').trim();
        
        try { return JSON.parse(clean); } catch (e) {}

        const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
            try { return JSON.parse(arrayMatch[0]); } catch (e) {}
        }
        
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch) {
            try { return JSON.parse(objectMatch[0]); } catch (e) {}
        }

        console.warn("Agent JSON Extraction Failed. Raw:", text.slice(0, 100));
        return fallback;
    } catch (e) {
        console.error("Critical Parse Error", e);
        return fallback;
    }
};

export const NOTE_AGENTS = {
    // 1. AUTO ORGANIZER
    async runOrganizer(notes: Note[], persona: 'hanisah' | 'stoic'): Promise<Partial<Note>[]> {
        const snippet = notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content.slice(0, 300),
            tags: n.tags,
            created: n.created
        }));

        const prompt = `
        [ROLE: ${persona === 'hanisah' ? 'Creative Librarian' : 'Strict Archivist'}]
        [TASK: ORGANIZE_VAULT]
        Analyze these notes. Return a JSON Array of objects with updates.
        
        RULES:
        1. "title": Rename to be professional, concise, and descriptive (Max 5 words).
        2. "tags": Add 2-3 relevant UPPERCASE tags. Merge synonyms.
        3. "is_archived": Set to true IF note is older than 30 days AND seems inactive/done.
        4. STRICTLY OUTPUT RAW JSON. NO MARKDOWN. NO CONVERSATION.
        
        INPUT DATA:
        ${JSON.stringify(snippet)}

        OUTPUT FORMAT:
        [
            { "id": "uuid", "title": "New Title", "tags": ["TAG1"], "is_archived": boolean }
        ]
        `;

        try {
            const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            return extractJson<Partial<Note>[]>(response.text, []);
        } catch (e) {
            console.error("Organizer Agent Failed", e);
            return [];
        }
    },

    // 2. INSIGHT PATTERN
    async runInsight(notes: Note[]): Promise<string> {
        const snippet = notes.map(n => `${n.title} [Tags: ${n.tags?.join(', ')}]`).join('\n');
        
        const prompt = `
        [TASK: GENERATE_INSIGHTS]
        Analyze the user's note titles and tags to find patterns.
        
        DATA:
        ${snippet}

        OUTPUT FORMAT (Markdown):
        ## 🧠 V20 Cognitive Patterns
        - **Top Themes**: [List top 3 topics]
        - **Productivity Rhythm**: [Observation based on volume]
        - **Missing Links**: [What is the user forgetting to document?]
        
        Provide a brief, high-level strategic summary.
        `;

        const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-pro-preview');
        const text = response.text || "No insights generated.";
        return text.replace(/^> .*$/gm, '').trim(); 
    },

    // 3. ACTION EXTRACTOR (ENHANCED V2)
    async runActionExtractor(notes: Note[]): Promise<{ text: string, sourceNoteId: string }[]> {
        const recentNotes = notes.sort((a,b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()).slice(0, 10);
        
        const snippet = recentNotes.map(n => ({ id: n.id, content: n.content.slice(0, 500) }));

        const prompt = `
        [TASK: EXTRACT_TASKS_AND_PRIORITIZE]
        Scan content for action items, todos, or implied tasks.
        
        DATA:
        ${JSON.stringify(snippet)}

        RULES:
        1. Identify tasks.
        2. Assign priority labels: [URGENT], [HIGH], [NORMAL], [LATER].
        3. Prepend the label to the task text.

        OUTPUT JSON ONLY:
        [ { "text": "[URGENT] Fix server bug", "sourceNoteId": "id" } ]
        `;

        try {
            const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            return extractJson(response.text, []);
        } catch (e) {
            return [];
        }
    },

    // 4. MEMORY RECALL (Contextual)
    async runMemoryRecall(currentContent: string, allNotes: Note[], currentId?: string): Promise<string[]> {
        if (!currentContent || currentContent.length < 20) return [];

        const targets = allNotes
            .filter(n => n.id !== currentId)
            .map(n => ({ id: n.id, text: `${n.title} ${n.tags?.join(' ')} ${n.content.slice(0,100)}` }));

        const prompt = `
        [TASK: FIND_RELATED]
        Current Context: "${currentContent.slice(0, 300)}..."
        
        Database:
        ${JSON.stringify(targets)}

        Return JSON Array of IDs for notes that are highly relevant/related to the context. Max 3 IDs.
        Format: ["id1", "id2"]
        `;

        try {
            const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            return extractJson<string[]>(response.text, []);
        } catch (e) {
            return [];
        }
    }
};
