
import { GoogleGenAI } from "@google/genai";

// Konfigurasi Edge Runtime (Wajib untuk Vercel agar streaming cepat & murah)
export const config = {
  runtime: 'edge',
};

// --- HELPER: ROTASI KEY (LOAD BALANCER) ---
function getActiveKey(envVar: string | undefined): string | undefined {
  if (!envVar) return undefined;
  const keys = envVar.split(',').map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) return undefined;
  return keys[Math.floor(Math.random() * keys.length)];
}

// --- CONFIGURATION & KEYS ---
const getKeys = () => ({
  GEMINI: getActiveKey(process.env.GEMINI_API_KEY),
  OPENAI: getActiveKey(process.env.OPENAI_API_KEY),
  GROQ: getActiveKey(process.env.GROQ_API_KEY),
  DEEPSEEK: getActiveKey(process.env.DEEPSEEK_API_KEY),
  MISTRAL: getActiveKey(process.env.MISTRAL_API_KEY),
  OPENROUTER: getActiveKey(process.env.OPENROUTER_API_KEY),
});

// --- MAIN HANDLER (POST) ---
export async function POST(request: Request) {
  try {
    const { message, modelId, provider, context } = await request.json();
    const KEYS = getKeys(); 

    if (!message) return new Response("Message required", { status: 400 });

    // Normalize Provider ID
    const activeProvider = (provider || 'GEMINI').toUpperCase();
    let activeModel = modelId;

    // Gabungkan Context (System Prompt) agar AI ingat instruksi
    // Note: Beberapa provider support 'system' role di messages, tapi penggabungan manual lebih aman untuk konsistensi context.
    const systemInstruction = context || "You are a helpful assistant.";
    
    // --- INTELLIGENT ROUTING ---
    switch (activeProvider) {
      case 'GEMINI':
      case 'GOOGLE':
        return await streamGemini(message, systemInstruction, activeModel || 'gemini-1.5-flash', KEYS.GEMINI);
      
      case 'OPENAI':
        return await streamOpenAICompatible(
          'https://api.openai.com/v1/chat/completions',
          KEYS.OPENAI,
          activeModel || 'gpt-4o-mini',
          message,
          systemInstruction
        );

      case 'GROQ':
        return await streamOpenAICompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          KEYS.GROQ,
          activeModel || 'llama-3.3-70b-versatile',
          message,
          systemInstruction
        );

      case 'DEEPSEEK':
        return await streamOpenAICompatible(
          'https://api.deepseek.com/chat/completions',
          KEYS.DEEPSEEK,
          activeModel || 'deepseek-chat',
          message,
          systemInstruction
        );
      
      case 'MISTRAL':
        return await streamOpenAICompatible(
          'https://api.mistral.ai/v1/chat/completions',
          KEYS.MISTRAL,
          activeModel || 'mistral-large-latest',
          message,
          systemInstruction
        );

      case 'OPENROUTER':
        return await streamOpenAICompatible(
          'https://openrouter.ai/api/v1/chat/completions',
          KEYS.OPENROUTER,
          activeModel || 'google/gemini-flash-1.5',
          message,
          systemInstruction,
          { 
            "HTTP-Referer": "https://istoic.app", 
            "X-Title": "IStoic AI" 
          }
        );

      default:
        // Default Fallback to Gemini if unknown provider
        return await streamGemini(message, systemInstruction, 'gemini-1.5-flash', KEYS.GEMINI);
    }

  } catch (error: any) {
    console.error("[API ERROR]:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown Server Error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// --- HELPER 1: GEMINI STREAMING ---
async function streamGemini(userMsg: string, systemMsg: string, modelId: string, apiKey: string | undefined) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing in server environment.");
  
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  try {
    const result = await ai.models.generateContentStream({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        config: {
            systemInstruction: systemMsg
        }
    });

    const stream = new ReadableStream({
        async start(controller) {
        const encoder = new TextEncoder();
        try {
            for await (const chunk of result) {
                const text = chunk.text;
                if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
        } catch (e) {
            console.error("Gemini Stream Error:", e);
            controller.error(e);
        }
        },
    });

    return new Response(stream, { 
        headers: { "Content-Type": "text/plain; charset=utf-8" } 
    });

  } catch(e: any) {
      throw new Error(`Gemini Error: ${e.message}`);
  }
}

// --- HELPER 2: OPENAI-COMPATIBLE STREAMING (Unified for Groq, DeepSeek, OpenAI) ---
async function streamOpenAICompatible(
  endpoint: string, 
  apiKey: string | undefined, 
  model: string, 
  userMsg: string,
  systemMsg: string,
  extraHeaders: Record<string, string> = {}
) {
  if (!apiKey) throw new Error(`API Key for ${model} is missing in server environment.`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model: model,
      messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Provider API Error (${response.status}): ${errText}`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      if (!reader) { controller.close(); return; }

      try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              
              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.replace('data: ', ''));
                  // Standard OpenAI Content
                  const content = json.choices?.[0]?.delta?.content || "";
                  
                  // DeepSeek Reasoner Content
                  const reasoning = json.choices?.[0]?.delta?.reasoning_content || "";
                  
                  if (reasoning) {
                      controller.enqueue(encoder.encode(`<think>${reasoning}</think>`));
                  }
                  
                  if (content) {
                      controller.enqueue(encoder.encode(content));
                  }
                } catch (e) { }
              }
            }
          }
          controller.close();
      } catch (e) {
          controller.error(e);
      }
    },
  });

  return new Response(stream, { 
      headers: { "Content-Type": "text/plain; charset=utf-8" } 
  });
}
