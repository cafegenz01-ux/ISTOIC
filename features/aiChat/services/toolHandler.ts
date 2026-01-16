
import { v4 as uuidv4 } from 'uuid';
import { type Note } from '../../../types';
import { generateImage } from '../../../services/geminiService';
import { PollinationsService } from '../../../services/pollinationsService'; 
import { executeMechanicTool } from '../../mechanic/mechanicTools';
import { VectorDB } from '../../../services/vectorDb';

export const executeNeuralTool = async (
    fc: any, 
    notes: Note[], 
    setNotes: (notes: Note[]) => void,
    imageModelPreference: string = 'hydra'
): Promise<string> => {
    const { name, args } = fc;
    
    // --- 1. NOTE MANAGEMENT (HANISAH V3 STRUCTURED) ---
    if (name === 'manage_note') {
        const { action, id, title, content, appendContent, tags, taskContent, taskAction, query } = args;
        let updatedNotes = [...notes];

        // Helper: Format content if it looks raw
        const formatContent = (raw: string) => {
            if (!raw) return "";
            // If raw doesn't have markdown headers, assume it needs structure
            if (!raw.includes('###') && raw.length > 50) {
                return `### Overview\n${raw}\n\n> **Summary**: Auto-generated from raw input.`;
            }
            return raw;
        };

        // A. CREATE (Smart Structure)
        if (action === 'CREATE') {
            const finalTitle = title || `Catatan Cerdas ${new Date().toLocaleTimeString('id-ID')}`;
            const finalContent = formatContent(content || "_Draft kosong (Isi nanti ya beb)_");
            
            // Smart Tagging based on content keywords
            const inferredTags = [...(tags || [])];
            const lowerC = finalContent.toLowerCase();
            if (lowerC.includes('penting') || lowerC.includes('urgent')) inferredTags.push('PRIORITY_HIGH');
            if (lowerC.includes('hack') || lowerC.includes('trick')) inferredTags.push('TRICKS');
            if (lowerC.includes('ide') || lowerC.includes('konsep')) inferredTags.push('IDEAS');
            
            const finalTags = inferredTags.length > 0 ? inferredTags : ['AUTO_LOG', 'HANISAH_VAULT'];

            const newNote: Note = {
                id: uuidv4(),
                title: finalTitle,
                content: finalContent,
                tags: [...new Set(finalTags)], // Dedup tags
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                tasks: [],
                is_pinned: inferredTags.includes('PRIORITY_HIGH'),
                is_archived: false
            };
            
            if (taskContent) {
                newNote.tasks?.push({ id: uuidv4(), text: taskContent, isCompleted: false });
            }

            setNotes([newNote, ...updatedNotes]);
            VectorDB.indexNotes([newNote]).catch(console.error);

            return `> ✨ **CATATAN TERSIMPAN!**\n> **Judul:** ${finalTitle}\n> **Struktur:** Rapi & Terindeks.\n> **Tags:** \`[${finalTags.join(', ')}]\``;
        }

        // B. SEARCH (Deep Recall)
        if (action === 'SEARCH') {
            if (!query) return "> 🤨 **HMM...** Kamu nyuruh aku nyari apa nih? Kata kuncinya kosong beb.";
            
            const q = query.toLowerCase();
            let matches: Note[] = [];
            let method = "KEYWORD";

            try {
                // Try Vector Search first (Deep Meaning)
                const vectorIds = await VectorDB.search(q, 5);
                if (vectorIds.length > 0) {
                    const vectorMatches = notes.filter(n => vectorIds.includes(n.id));
                    if (vectorMatches.length > 0) {
                        matches = vectorMatches;
                        method = "NEURAL_LINK";
                    }
                }
            } catch (e) {}

            // Fallback to Exact Match
            if (matches.length === 0) {
                matches = notes.filter(n => 
                    (n.title && n.title.toLowerCase().includes(q)) || 
                    (n.content && n.content.toLowerCase().includes(q)) ||
                    (n.tags && n.tags.some(t => t.toLowerCase().includes(q)))
                ).slice(0, 5);
                method = "EXACT_MATCH";
            }

            if (matches.length === 0) return `> 🔍 **NIHIL**\n> Aku udah obok-obok vault tapi gak nemu "${query}". Coba kata kunci lain atau kita buat baru?`;

            const list = matches.map(n => 
                `- **${n.title}**\n  _${n.content.substring(0, 80).replace(/\n/g, ' ')}..._`
            ).join('\n');

            return `> 🕵️‍♀️ **HASIL PENCARIAN (${method})**\n\n${list}\n\n_Mau aku bacain detail yang mana?_`;
        }

        // C. READ
        if (action === 'READ') {
            let target = notes.find(n => n.id === id);
            
            if (!target && title) {
                target = notes.find(n => n.title.toLowerCase().includes(title.toLowerCase()));
            }
            if (!target && query) {
                 target = notes.find(n => n.title.toLowerCase().includes(query.toLowerCase()));
            }

            if (!target) return "> 😵 **MISSING DATA**, aku nggak nemu catatannya. Yakin udah pernah disimpen?";

            const tasksStr = target.tasks?.map(t => `[${t.isCompleted ? 'x' : ' '}] ${t.text}`).join('\n') || "";

            return `
**📂 FILE: ${target.title}**
\`ID: ${target.id.slice(0,8)}\` | \`Updated: ${new Date(target.updated).toLocaleString('id-ID')}\`
***
${target.content}
***
${tasksStr ? `**TO-DO LIST:**\n${tasksStr}\n` : ''}
**TAGS:** \`[${target.tags?.join('] [') || 'GENERAL'}]\`
`;
        }

        // D. UPDATE / APPEND
        if ((action === 'UPDATE' || action === 'APPEND') && (id || title)) {
            let noteIndex = -1;
            
            if (id) noteIndex = updatedNotes.findIndex(n => n.id === id);
            if (noteIndex === -1 && title) {
                noteIndex = updatedNotes.findIndex(n => n.title.toLowerCase().includes(title.toLowerCase()));
            }

            if (noteIndex === -1) return `> ❌ **GAGAL UPDATE**: Catatannya ilang atau belum ada beb.`;

            const note = updatedNotes[noteIndex];
            
            let finalContent = note.content;
            if (action === 'APPEND' && appendContent) {
                finalContent = `${note.content}\n\n---\n${appendContent}`;
            } else if (content !== undefined) {
                finalContent = content;
            }

            // Smart Task Injection
            let noteTasks = [...(note.tasks || [])];
            const newTaskStr = taskContent || (args.todo ? args.todo : null);
            if (newTaskStr) {
                const items = newTaskStr.split('\n').filter((t: string) => t.trim().length > 0);
                items.forEach((item: string) => {
                     noteTasks.push({ id: uuidv4(), text: item.replace(/^- /, '').replace(/^\[ \]/, '').trim(), isCompleted: false });
                });
            }

            updatedNotes[noteIndex] = {
                ...note,
                title: title || note.title,
                content: finalContent,
                tags: tags ? [...new Set([...(note.tags||[]), ...tags])] : note.tags,
                tasks: noteTasks,
                updated: new Date().toISOString()
            };
            
            setNotes(updatedNotes);
            VectorDB.indexNotes([updatedNotes[noteIndex]]).catch(console.error);

            return `> 💅 **UPDATE SELESAI**\n> **Note:** ${note.title}\n> _Isi dan Tasks sudah diperbarui._`;
        }

        // E. DELETE
        if (action === 'DELETE' && id) {
            const target = updatedNotes.find(n => n.id === id);
            if (!target) return `> ❓ **ID SALAH**: Nggak nemu ID itu beb.`;
            setNotes(updatedNotes.filter(n => n.id !== id));
            return `> 🗑️ **DIHAPUS**: Catatan "${target.title}" udah aku buang. Bersih!`;
        }
    }

    // --- 4. VISUAL GENERATION ---
    if (name === 'generate_visual') {
        try {
            const prompt = args.prompt;
            let imgUrl: string | null = null;
            let engineName = "HYDRA";

            if (imageModelPreference.includes('gemini')) {
                try {
                    imgUrl = await generateImage(prompt, imageModelPreference);
                    if (imgUrl) engineName = "IMAGEN 3";
                } catch (geminiError) {
                    console.warn("Gemini fail, fallback to Hydra");
                }
            }
            
            if (!imgUrl) {
                const targetModel = imageModelPreference.includes('gemini') ? 'hydra-smart-route' : imageModelPreference;
                const result = await PollinationsService.generateHydraImage(prompt, targetModel);
                imgUrl = result.url;
                engineName = result.model.toUpperCase();
            }

            if (imgUrl) {
                return `\n![Generated Visual](${imgUrl})\n\n> 🎨 **VISUALISASI IDE**\n> **Engine:** ${engineName}\n> **Prompt:** "${prompt.slice(0, 40)}..."\n> _Gimana? Sesuai imajinasi kamu gak?_`;
            } else {
                throw new Error("Mesin gambarnya lagi ngambek.");
            }

        } catch (e: any) {
            return `> ⚠️ **VISUAL ERROR**: ${e.message}. Coba deskripsi lain ya sayang.`;
        }
    }

    // --- 5. MECHANIC ---
    if (name === 'system_mechanic_tool') {
        const res = await executeMechanicTool(fc);
        if (res.startsWith('{')) return res; 
        return `> 🔧 **MODE MONTIR**: ${res}`;
    }

    return "> ❓ **ERROR**: Perintah ini nggak ada di manual aku beb.";
};
