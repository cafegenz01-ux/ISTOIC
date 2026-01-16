
import { GoogleGenAI, Type, FunctionDeclaration, Schema } from "@google/genai";
import { debugService } from './debugService';
import { GLOBAL_VAULT, Provider } from "./hydraVault";
import { SECURITY_MATRIX } from "./securityMatrix";

// --- CONSTANTS & CONFIG ---
export const SANITIZED_ERRORS: Record<string, string> = {
  DEFAULT: "An obstacle has arisen. We shall navigate around it.",
  QUOTA: "Resources exhausted. System is rotating keys.",
  BALANCE: "Node balance insufficient. Switching providers.",
  NETWORK: "The signal is faint. We await clarity."
};

export interface ProviderStatus {
    id: string;
    status: 'HEALTHY' | 'COOLDOWN';
    keyCount: number;
    cooldownRemaining: number;
}

// --- KEY MANAGER PROXY ---
// Maintains compatibility with existing app architecture while utilizing the new HydraVault
class KeyManagerProxy {
  public refreshPools() {
    GLOBAL_VAULT.refreshPools();
  }

  public isProviderHealthy(provider: string): boolean {
    return GLOBAL_VAULT.isProviderHealthy(provider as Provider);
  }

  public reportFailure(provider: string, keyOrError: any, errorContext?: any) {
      if (errorContext !== undefined) {
          GLOBAL_VAULT.reportFailure(provider as Provider, keyOrError, errorContext);
      } else {
          // Backward compatibility for older calls
          debugService.log('WARN', 'KEY_MGR', 'FAIL_REPORT', `Provider ${provider} reported failure without key context.`);
      }
  }

  public reportSuccess(provider: string) {
      GLOBAL_VAULT.reportSuccess(provider as Provider);
  }

  public getKey(provider: string): string | null {
    return GLOBAL_VAULT.getKey(provider as Provider);
  }

  public getAllProviderStatuses(): ProviderStatus[] {
      return GLOBAL_VAULT.getAllProviderStatuses();
  }
}

export const KEY_MANAGER = new KeyManagerProxy();

// --- HELPER: GEMINI IMAGE GENERATION ---
async function generateGeminiImage(prompt: string, apiKey: string, modelId: string): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey });
    
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            // Perbaikan struktur contents menjadi array agar sesuai spesifikasi SDK terbaru
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        
        // Parsing response untuk mencari inlineData (gambar Base64)
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    return `data:${mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
    } catch (e: any) {
        console.error("Gemini Image Generation Error:", e);
        throw e; // Lempar ke handler utama
    }
    return null;
}

// --- HELPER: OPENAI DALL-E (FALLBACK) ---
async function generateOpenAIImage(prompt: string, apiKey: string): Promise<string | null> {
    // Obfuscated endpoint construction for security
    const endpoint = SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,97,112,105,46,111,112,101,110,97,105,46,99,111,109,47,118,49,47,105,109,97,103,101,115,47,103,101,110,101,114,97,116,105,111,110,115]);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "OpenAI Image Generation Failed");
    }

    const data = await response.json();
    return data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null;
}

// --- MAIN IMAGE GENERATION FUNCTION ---
export async function generateImage(prompt: string, modelId: string = 'gemini-2.5-flash-image'): Promise<string | null> {
  const geminiKey = KEY_MANAGER.getKey('GEMINI');
  const openaiKey = KEY_MANAGER.getKey('OPENAI');
  
  let lastError = "";

  // STRATEGY 1: Prioritize Gemini (Faster & Cheaper)
  if (geminiKey && modelId.includes('gemini')) {
      try {
          const result = await generateGeminiImage(prompt, geminiKey, modelId);
          if (result) {
              KEY_MANAGER.reportSuccess('GEMINI');
              return result;
          }
      } catch (e: any) {
          debugService.log('WARN', 'IMG_GEN', 'PRIMARY_FAIL', `Gemini ${modelId} failed: ${e.message}`);
          lastError = e.message;
          GLOBAL_VAULT.reportFailure('GEMINI', geminiKey, e);
      }
  }

  // STRATEGY 2: Fallback to OpenAI DALL-E 3
  if (openaiKey) {
      try {
          debugService.log('INFO', 'IMG_GEN', 'FALLBACK_OPENAI', 'Attempting fallback to OpenAI DALL-E 3...');
          const result = await generateOpenAIImage(prompt, openaiKey);
          if (result) {
              KEY_MANAGER.reportSuccess('OPENAI');
              return result;
          }
      } catch (e: any) {
          debugService.log('ERROR', 'IMG_GEN', 'FALLBACK_OPENAI_FAIL', `DALL-E 3 failed: ${e.message}`);
          GLOBAL_VAULT.reportFailure('OPENAI', openaiKey, e);
          lastError = e.message;
      }
  }

  // Error Analysis
  if (lastError.includes('429')) {
      throw new Error("QUOTA_EXCEEDED: Image generation limit reached. Please wait or switch providers.");
  } else if (!geminiKey && !openaiKey) {
      throw new Error("NO_KEYS: No API keys available for Image Generation. Please check your settings.");
  }

  throw new Error(`GENERATION_FAILED: ${lastError.slice(0, 100)}...`);
}

// --- VIDEO GENERATION (VEO) ---
export async function generateVideo(prompt: string, config: any): Promise<string | null> {
    const key = KEY_MANAGER.getKey('GEMINI');
    if (!key) return null;
    
    const ai = new GoogleGenAI({ apiKey: key });
    
    try {
        // Veo Model Handling
        // Note: 'generateVideos' might be part of specific beta endpoints. 
        // Ensure your API Key has access to Veo.
        if (!ai.models['generateVideos']) {
             console.warn("generateVideos method not found on this SDK version.");
             return null;
        }

        let operation = await (ai.models as any).generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: config.resolution || '720p',
                aspectRatio: config.aspectRatio || '16:9'
            }
        });

        // Polling loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5s interval
            // Refresh operation status
            if (ai.operations && ai.operations.getVideosOperation) {
                 operation = await ai.operations.getVideosOperation({ operation: operation });
            } else {
                 break; // Safety break if SDK lacks operations support
            }
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return null;

        // Fetch video blob
        const response = await fetch(`${downloadLink}&key=${key}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);

    } catch (e) {
        console.error("Video Gen Error:", e);
        GLOBAL_VAULT.reportFailure('GEMINI', key, e);
    }
    return null;
}

// --- IMAGE EDITING ---
export async function editImage(base64: string, mimeType: string, prompt: string): Promise<string | null> {
    const key = KEY_MANAGER.getKey('GEMINI');
    if (!key) return null;
    
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { data: base64, mimeType } },
                    { text: `Edit instruction: ${prompt}` },
                ],
            }],
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    const mime = part.inlineData.mimeType || 'image/png';
                    return `data:${mime};base64,${part.inlineData.data}`;
                }
            }
        }
    } catch (e) {
        GLOBAL_VAULT.reportFailure('GEMINI', key, e);
    }
    return null;
}

// --- AUDIO UTILS ---
export function encodeAudio(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeAudio(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- V25 TOOL DEFINITIONS (UPGRADED) ---

const manageNoteTool: FunctionDeclaration = {
  name: 'manage_note',
  description: 'The PRIMARY tool for note management. Creates, updates, appends content, searches, or reads notes in the secure vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { 
          type: Type.STRING, 
          enum: ['CREATE', 'UPDATE', 'APPEND', 'DELETE', 'SEARCH', 'READ'],
          description: 'The operation to perform.' 
      },
      id: { type: Type.STRING, description: 'Target Note ID (Required for UPDATE, APPEND, DELETE, READ)' },
      title: { type: Type.STRING, description: 'Note Title' },
      content: { type: Type.STRING, description: 'Main content of the note' },
      appendContent: { type: Type.STRING, description: 'Text to append to the end of an existing note (for APPEND action)' },
      tags: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING }, 
          description: 'Tags for categorization' 
      },
      query: { type: Type.STRING, description: 'Search keywords for SEARCH action' }
    },
    required: ['action']
  }
};

const searchNotesTool: FunctionDeclaration = {
    name: 'search_notes',
    description: 'Legacy tool. Prefer manage_note with action=SEARCH.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: { type: Type.STRING, description: 'Keywords to search for.' }
        },
        required: ['query']
    }
};

// --- VISUAL GENERATION TOOL ---
const generateVisualTool: FunctionDeclaration = {
    name: 'generate_visual',
    description: 'Generate images using AI models. Triggered by requests like "Draw", "Imagine", "Gambarin".',
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: { 
                type: Type.STRING, 
                description: 'A detailed description of the image to generate, in English.' 
            }
        },
        required: ['prompt']
    }
};

const googleSearchTool = { googleSearch: {} };

export const noteTools = { functionDeclarations: [manageNoteTool, searchNotesTool] };
export const visualTools = { functionDeclarations: [generateVisualTool] }; 
export const searchTools = [googleSearchTool]; 

// Universal tools for Non-Gemini providers (OpenAI Compatible)
export const universalTools = {
    functionDeclarations: [manageNoteTool, generateVisualTool]
};
