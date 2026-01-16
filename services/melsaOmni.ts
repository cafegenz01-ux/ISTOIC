import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { GLOBAL_VAULT, type Provider } from "./hydraVault"; 
import { HANISAH_BRAIN } from "./melsaBrain";

// ============================================================================
// HYDRA ENGINE v20.0 (Titanium Omni-Race)
// ============================================================================

let activeController: AbortController | null = null;
const MAX_RETRIES = 2;

// V20 OPTIMIZED CANDIDATES
const CANDIDATES = [
  { provider: 'google', model: 'gemini-3-flash-preview', speed: 1, label: 'GEMINI 3 FLASH' },
  { provider: 'google', model: 'gemini-3-pro-preview', speed: 1, label: 'GEMINI 3 PRO' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', speed: 1, label: 'LLAMA 3.3 70B' }, 
  { provider: 'groq', model: 'llama-3.1-8b-instant', speed: 1, label: 'LLAMA 3.1 8B' }, 
];

interface RaceResult {
    text: string;
    model: string;
    provider: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const stopResponse = () => {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
};

const callSingleApi = async (candidate: any, messages: any[], systemInstruction: string, signal: AbortSignal): Promise<RaceResult> => {
    const providerEnum: Provider = candidate.provider === 'google' ? 'GEMINI' : 'GROQ';

    for (let i = 0; i < MAX_RETRIES; i++) {
        const key = GLOBAL_VAULT.getKey(providerEnum);

        if (!key) {
            await delay(500); 
            continue;
        }

        try {
            if (candidate.provider === 'google') {
                const client = new GoogleGenAI({ apiKey: key });
                
                const contents = messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));

                const response = await client.models.generateContent({
                  model: candidate.model,
                  contents: contents,
                  config: { 
                    systemInstruction: systemInstruction,
                    temperature: 0.8,
                    maxOutputTokens: 2048,
                  }
                });
                
                if (signal.aborted) throw new Error("Dibatalkan.");

                GLOBAL_VAULT.reportSuccess(providerEnum);
                return {
                    text: response.text || "",
                    model: candidate.label,
                    provider: providerEnum
                };
            }

            else if (candidate.provider === 'groq') {
                const client = new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
                
                const groqMessages = [
                  { role: 'system', content: systemInstruction },
                  ...messages
                ];
                
                const completion = await client.chat.completions.create({
                  messages: groqMessages as any,
                  model: candidate.model,
                  temperature: 0.7,
                  max_tokens: 2048,
                  stream: false,
                }, { signal: signal });
                
                GLOBAL_VAULT.reportSuccess(providerEnum);
                return {
                    text: completion.choices[0]?.message?.content || "",
                    model: candidate.label,
                    provider: providerEnum
                };
            }
        } catch (error: any) {
            if (signal.aborted || error.name === 'AbortError') throw new Error("Dibatalkan.");
            GLOBAL_VAULT.reportFailure(providerEnum, key, error);
            
            const errStr = JSON.stringify(error);
            if (errStr.includes('429')) throw new Error("Rate Limit");
            continue;
        }
    }
    throw new Error(`Gagal menghubungi ${candidate.provider}.`);
};

export const runHanisahRace = async (message: string, imageData: any = null, historyContext: any[] = []): Promise<RaceResult> => {
  stopResponse(); 
  activeController = new AbortController();
  const signal = activeController.signal;

  // Fix: Await getSystemInstruction call
  const systemInstruction = await HANISAH_BRAIN.getSystemInstruction('hanisah');
  
  const recentHistory = historyContext.slice(-12).map(h => ({
      role: h.role,
      content: Array.isArray(h.parts) ? h.parts[0].text : h.content
  }));

  const fullMessages = [...recentHistory, { role: 'user', content: message }];

  if (imageData) {
    const googleCandidate = CANDIDATES.find(c => c.provider === 'google');
    if (googleCandidate) {
        const client = new GoogleGenAI({ apiKey: GLOBAL_VAULT.getKey('GEMINI') || '' });
        const mixedContent = [
            ...recentHistory.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
            { role: 'user', parts: [{ inlineData: { mimeType: imageData.mimeType, data: imageData.data } }, { text: message }] }
        ];
        
        try {
            const res = await client.models.generateContent({
                model: 'gemini-3-flash-preview', // Force vision capable model
                contents: mixedContent as any,
                config: { systemInstruction }
            });
            return { text: res.text || "", model: "GEMINI 3 VISION", provider: 'GEMINI' };
        } catch(e) {
            throw new Error("Vision processing failed.");
        }
    }
  } 
  
  const racePromises = CANDIDATES.map(candidate => 
      callSingleApi(candidate, fullMessages, systemInstruction, signal)
      .then(res => ({ result: res, status: 'success' }))
      .catch(err => ({ error: err, status: 'fail' }))
  );

  const raceTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("RACE TIMEOUT")), 25000)); 

  try {
      const winner: any = await Promise.race([
          new Promise((resolve, reject) => {
              let failCount = 0;
              racePromises.forEach(p => {
                  p.then((res: any) => {
                      if (res.status === 'success') resolve(res.result);
                      else {
                          failCount++;
                          if (failCount === CANDIDATES.length) reject(new Error("ALL_ENGINES_FAILED"));
                      }
                  });
              });
          }),
          raceTimeout
      ]);

      if (activeController) {
          activeController.abort();
          activeController = null;
      }

      return winner;

  } catch (e: any) {
      if (e.message === "Dibatalkan.") throw e;
      throw new Error("Hydra V20 Overload. Please retry.");
  }
};