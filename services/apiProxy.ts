
import { z } from 'zod';
import { debugService } from './debugService';
import { apiClient } from './apiClient';

/**
 * IStoicAI v101.0 ENTERPRISE PROXY
 * STRICT SERVER-SIDE ROUTING
 */

// Schema Definitions
export const AIResponseSchema = z.object({
  text: z.string(),
  modelUsed: z.string(),
  tokenCount: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(0), // Allow empty string drafts
  content: z.string(),
  tags: z.array(z.string()),
  created: z.string(),
  updated: z.string(),
  is_pinned: z.boolean().default(false),
  is_archived: z.boolean().default(false),
  tasks: z.array(z.object({
    id: z.string(),
    text: z.string(),
    isCompleted: z.boolean(),
    dueDate: z.string().optional()
  })).optional()
});

export type ValidatedNote = z.infer<typeof NoteSchema>;

// FORCED CONFIGURATION
const USE_SECURE_BACKEND = true; // Hardcoded to TRUE for V101 security mandate
const BACKEND_URL = '/api/chat';

class ApiProxyService {
  
  async generateText(
    prompt: string, 
    provider: 'GEMINI' | 'OPENAI' | 'GROQ' | 'DEEPSEEK' | 'MISTRAL', 
    modelId: string,
    context?: string
  ): Promise<AIResponse> {
    
    debugService.log('INFO', 'PROXY', 'OUTBOUND', `Routing to ${BACKEND_URL} [${provider}]`);

    try {
        const response = await apiClient.requestRaw({
            path: BACKEND_URL,
            method: 'POST',
            body: { 
                message: prompt, 
                provider, 
                modelId, 
                context 
            },
            timeoutMs: 20000
        });

        // CONSUME STREAM
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });
            }
        }

        return {
            text: fullText,
            modelUsed: modelId,
            metadata: { timestamp: new Date().toISOString(), source: 'SERVER_STREAM' }
        };

    } catch (serverError: any) {
        console.error("Server Proxy Failed:", serverError);
        const details = serverError.details || serverError.message;
        throw new Error(`Secure Backend Failure: ${details}`);
    }
  }

  validateNote(data: unknown): ValidatedNote {
    const result = NoteSchema.safeParse(data);
    if (!result.success) {
      console.error("Data Integrity Error:", result.error);
      throw new Error("Note Integrity Check Failed");
    }
    return result.data;
  }
}

export const ApiProxy = new ApiProxyService();
