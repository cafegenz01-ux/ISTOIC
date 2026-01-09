
import { debugService } from "./debugService";
import { HANISAH_BRAIN } from "./melsaBrain";
import { noteTools, visualTools, searchTools } from "./geminiService";
import { mechanicTools } from "../features/mechanic/mechanicTools";
import { MASTER_MODEL_CATALOG, MODEL_IDS } from "./modelRegistry";
import { Note } from "../types";

export const MODEL_CATALOG = MASTER_MODEL_CATALOG;

export interface StreamChunk {
  text?: string;
  functionCall?: any;
  groundingChunks?: any[];
  metadata?: any;
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export class HanisahKernel {
  private history: any[] = [];

  // Used only for tool definition passing, logic execution happens on client result
  private getActiveTools(provider: string, currentMsg: string = ''): any[] {
      // Logic retained for tool definitions, but execution is client-side post-stream
      const configStr = localStorage.getItem('hanisah_tools_config');
      const config = configStr ? JSON.parse(configStr) : { search: true, vault: true, visual: true };
      const tools: any[] = [];
      const lowerMsg = currentMsg.toLowerCase();
      
      if (config.vault && noteTools && ['catat', 'simpan', 'ingat', 'note', 'task', 'list'].some(k => lowerMsg.includes(k))) tools.push(noteTools);
      if (config.visual && visualTools && ['gambar', 'foto', 'visual', 'imagine'].some(k => lowerMsg.includes(k))) tools.push(visualTools);
      if (config.search && searchTools && ['cari', 'berita', 'update', 'harga', 'cuaca'].some(k => lowerMsg.includes(k))) tools.push(searchTools); 
      if (mechanicTools) tools.push(mechanicTools);
      return tools;
  }

  // FORCE PROXY EXECUTION
  async *streamExecute(msg: string, initialModelId: string, contextNotes: Note[] | string = [], imageData?: { data: string, mimeType: string }, configOverride?: any): AsyncGenerator<StreamChunk> {
    const systemPrompt = configOverride?.systemInstruction || await HANISAH_BRAIN.getSystemInstruction('hanisah', msg, contextNotes);
    const signal = configOverride?.signal; 
    let currentModelId = initialModelId === 'auto-best' ? MODEL_IDS.GEMINI_FLASH : initialModelId;
    
    // Fallback Plan
    const plan = [...new Set([currentModelId, MODEL_IDS.GEMINI_FLASH, MODEL_IDS.GPT_4O_MINI])];
    
    let attempts = 0;
    let hasYielded = false;

    for (let i = 0; i < plan.length; i++) {
        if (signal?.aborted) break;
        const modelId = plan[i];
        const model = MASTER_MODEL_CATALOG.find(m => m.id === modelId) || MASTER_MODEL_CATALOG[0];

        attempts++;
        debugService.log('INFO', 'KERNEL', 'PROXY_REQ', `Routing to /api/chat for ${model.provider}...`);

        try {
            // --- STRICT SERVER-SIDE ROUTING ---
            // We no longer check for local keys. We assume the server has them.
            
            // Build simple history for context (Client -> Server state transfer)
            const standardHistory = this.history.map(h => ({ 
                role: h.role === 'model' ? 'assistant' : 'user', 
                content: h.parts ? h.parts[0].text : h.content 
            }));
            
            // Note: The /api/chat endpoint currently accepts a simplified payload. 
            // Ideally, it should accept the full history array. 
            // For V101 stability, we concatenate relevant context into the system prompt 
            // or rely on the server to handle the single-turn + prompt injection efficiently.
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg, 
                    modelId: model.id,
                    provider: model.provider,
                    context: systemPrompt // Sending Full System Prompt + Context as context
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server Error (${response.status}): ${errText}`);
            }
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunkText = decoder.decode(value, { stream: true });
                fullText += chunkText;
                yield { text: chunkText };
                hasYielded = true;
            }

            if (hasYielded) {
                this.updateHistory(msg, fullText);
                return; // Success, exit loop
            }

        } catch (err: any) {
            console.error(`Kernel Provider Fail (${model.provider}):`, err);
            debugService.log('WARN', 'KERNEL', 'FAIL', `${model.provider} unreachable via proxy: ${err.message}`);
            
            if (i < plan.length - 1) {
                yield { metadata: { systemStatus: `Rerouting to ${plan[i+1]}...`, isRerouting: true } };
            }
        }
    }

    // FINAL FALLBACK
    if (!hasYielded) {
         yield { text: `\n\n> ⚠️ **SYSTEM FAILURE**\n\nUnable to reach AI Server Nodes. Please check your internet connection or Vercel logs.` };
    }
  }

  private updateHistory(user: string, assistant: string) {
    this.history.push({ role: 'user', parts: [{ text: user }] }, { role: 'model', parts: [{ text: assistant }] });
    if (this.history.length > 20) this.history = this.history.slice(-20);
  }

  async execute(msg: string, modelId: string, contextNotes?: Note[] | string): Promise<StreamChunk> {
    const it = this.streamExecute(msg, modelId, contextNotes || []);
    let fullText = "";
    let finalChunk: StreamChunk = {};
    for await (const chunk of it) {
        if (chunk.text) fullText += chunk.text;
        if (chunk.functionCall) finalChunk.functionCall = chunk.functionCall;
    }
    finalChunk.text = fullText;
    return finalChunk;
  }
}

export const HANISAH_KERNEL = new HanisahKernel();
