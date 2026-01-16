
import { HANISAH_BRAIN } from "./melsaBrain";
import { GLOBAL_VAULT, Provider } from "./hydraVault";
import { MASTER_MODEL_CATALOG, MODEL_IDS } from "./modelRegistry";
import { Note } from "../types";
import { StreamChunk } from "./melsaKernel";
import { debugService } from "./debugService";

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

class StoicLogicKernel {
  private history: any[] = [];

  // FORCE PROXY EXECUTION (Server-Side Routing)
  async *streamExecute(msg: string, modelId: string, contextNotes: Note[] | string = [], attachment?: any, configOverride?: any): AsyncGenerator<StreamChunk> {
    const systemPrompt = await HANISAH_BRAIN.getSystemInstruction('stoic', msg, contextNotes);
    const signal = configOverride?.signal; 
    let effectiveId = modelId === 'auto-best' ? MODEL_IDS.GEMINI_FLASH : modelId;

    // Fallback Plan: Preferred -> Gemini Flash -> OpenAI Mini
    const plan = [...new Set([effectiveId, MODEL_IDS.GEMINI_FLASH, MODEL_IDS.GPT_4O_MINI])];

    let hasYielded = false;

    for (let i = 0; i < plan.length; i++) {
        if (signal?.aborted) break;
        const currentId = plan[i];
        const model = MASTER_MODEL_CATALOG.find(m => m.id === currentId) || MASTER_MODEL_CATALOG[0];

        debugService.log('INFO', 'STOIC_KERNEL', 'PROXY_REQ', `Routing to /api/chat for ${model.provider} [${model.name}]...`);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg, 
                    modelId: model.id,
                    provider: model.provider,
                    context: systemPrompt // Send full context to server
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
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });

                // PARSE TOOLS FROM STREAM PROTOCOL
                const toolRegex = /::TOOL::(.*)::ENDTOOL::/s;
                let match;
                
                while ((match = toolRegex.exec(buffer)) !== null) {
                    const [fullMatch, jsonStr] = match;
                    
                    const textBefore = buffer.slice(0, match.index);
                    if (textBefore) {
                        yield { text: textBefore };
                        hasYielded = true;
                    }
                    
                    try {
                        const toolData = JSON.parse(jsonStr);
                        yield { functionCall: toolData };
                        hasYielded = true;
                    } catch (e) {
                        console.error("Tool Parse Error", e);
                    }
                    
                    buffer = buffer.slice(match.index + fullMatch.length);
                }

                if (!buffer.includes("::TOOL::")) {
                    if (buffer) {
                        yield { text: buffer };
                        buffer = "";
                        hasYielded = true;
                    }
                }
            }
            
            if (buffer) {
                yield { text: buffer };
                hasYielded = true;
            }

            if (hasYielded) {
                this.updateHistory(msg, "[Stream Complete]");
                return; // Success
            }

        } catch (err: any) {
            console.error(`Stoic Provider Fail (${model.provider}):`, err);
            debugService.log('WARN', 'STOIC_KERNEL', 'FAIL', `${model.provider} proxy failed: ${err.message}`);
            
            if (i < plan.length - 1) {
                yield { metadata: { systemStatus: `Logic path obstructed. Rerouting to ${plan[i+1]}...`, isRerouting: true } };
            }
        }
    }

    // FALLBACK
    if (!hasYielded) {
         yield { text: `> **LOGIC CORE OFFLINE**: Unable to reach Neural Server Nodes. Please check internet connection.` };
    }
  }

  private updateHistory(user: string, assistant: string) {
    this.history.push({ role: 'user', parts: [{ text: user }] }, { role: 'model', parts: [{ text: assistant }] });
    if (this.history.length > 40) this.history = this.history.slice(-40);
  }

  async execute(msg: string, modelId: string, contextNotes?: Note[] | string): Promise<any> {
    const it = this.streamExecute(msg, modelId, contextNotes || []);
    let fullText = "";
    for await (const chunk of it) if (chunk.text) fullText += chunk.text;
    return { text: fullText };
  }
}

export const STOIC_KERNEL = new StoicLogicKernel();
