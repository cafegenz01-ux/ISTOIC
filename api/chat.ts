
import { GoogleGenAI } from "@google/genai";

// Konfigurasi Edge Runtime (Wajib untuk Vercel agar streaming cepat & murah)
export const config = {
  runtime: 'edge',
};

// --- HELPER: ROTASI KEY (LOAD BALANCER) ---
// Fungsi ini penting karena di .env Anda ada banyak key (Key1,Key2,Key3...)
// Kode ini memilih satu secara acak agar tidak kena Rate Limit.
function getActiveKey(envVar: string | undefined): string | undefined {
  if (!envVar) return undefined;
  // Hapus spasi, split berdasarkan koma
  const keys = envVar.split(',').map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) return undefined;
  // Ambil acak
  return keys[Math.floor(Math.random() * keys.length)];
}

// --- CONFIGURATION & KEYS ---
// Kita ambil key saat request masuk (runtime) agar rotasi random berjalan
const getKeys = () => ({
  GEMINI: getActiveKey(process.env.GEMINI_API_KEY),
  OPENAI: getActiveKey(process.env.OPENAI_API_KEY),
  GROQ: getActiveKey(process.env.GROQ_API_KEY),
  DEEPSEEK: getActiveKey(process.env.DEEPSEEK_API_KEY),
  MISTRAL: getActiveKey(process.env.MISTRAL_API_KEY),
  OPENROUTER: getActiveKey(process.env.OPENROUTER_API_KEY),
});

// --- MAIN HANDLER ---
export async function POST(request: Request) {
  try {
    const { message, modelId, provider, context } = await request.json();
    const KEYS = getKeys(); // Generate keys acak untuk request ini

    if (!message) return new Response("Message required", { status: 400 });

    // Tentukan Provider default jika tidak dikirim
    const activeProvider = (provider || 'GEMINI').toUpperCase();
    const activeModel = modelId || getFallbackModel(activeProvider);

    // Gabungkan Context (System Prompt)
    const finalPrompt = context ? `${context}\n\nUser: ${message}` : message;

    // --- ROUTING LOGIC ---
    switch (activeProvider) {
      case 'GEMINI':
        return await streamGemini(finalPrompt, activeModel, KEYS.GEMINI);
      
      case 'OPENAI':
        return await streamOpenAICompatible(
          'https://api.openai.com/v1/chat/completions',
          KEYS.OPENAI,
          activeModel,
          finalPrompt
        );

      case 'GROQ':
        return await streamOpenAICompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          KEYS.GROQ,
          activeModel,
          finalPrompt
        );

      case 'DEEPSEEK':
        return await streamOpenAICompatible(
          'https://api.deepseek.com/chat/completions',
          KEYS.DEEPSEEK,
          activeModel,
          finalPrompt
        );
      
      case 'MISTRAL':
        return await streamOpenAICompatible(
          'https://api.mistral.ai/v1/chat/completions',
          KEYS.MISTRAL,
          activeModel,
          finalPrompt
        );

      case 'OPENROUTER':
        return await streamOpenAICompatible(
          'https://openrouter.ai/api/v1/chat/completions',
          KEYS.OPENROUTER,
          activeModel,
          finalPrompt,
          // OpenRouter butuh header tambahan
          { 
            "HTTP-Referer": "https://istoic.app", 
            "X-Title": "IStoic AI" 
          }
        );

      default:
        return new Response(`Provider ${activeProvider} not supported`, { status: 400 });
    }

  } catch (error: any) {
    console.error("Server Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// --- HELPER 1: GEMINI STREAMING (New @google/genai SDK) ---
async function streamGemini(prompt: string, modelId: string, apiKey: string | undefined) {
  if (!apiKey) throw new Error("GEMINI_API_KEY exhaustion or missing");
  
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  // Menggunakan SDK terbaru untuk streaming
  // Menggunakan try-catch khusus untuk model agar fallback aman
  try {
    const result = await ai.models.generateContentStream({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: prompt }] }] // Format standard content
    });

    const stream = new ReadableStream({
        async start(controller) {
        const encoder = new TextEncoder();
        try {
            for await (const chunk of result) {
                // FIXED: Access text as a property, not a method
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

    return new Response(stream, { headers: { "Content-Type": "text/plain" } });

  } catch(e: any) {
      throw new Error(`Gemini Error: ${e.message}`);
  }
}

// --- HELPER 2: OPENAI-COMPATIBLE STREAMING (Raw Fetch) ---
async function streamOpenAICompatible(
  endpoint: string, 
  apiKey: string | undefined, 
  model: string, 
  prompt: string,
  extraHeaders: Record<string, string> = {}
) {
  if (!apiKey) throw new Error(`API Key for endpoint ${endpoint} is missing (Check server .env)`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      stream: true, 
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Provider Error (${response.status}): ${err}`);
  }

  // Transform Stream: Mengubah format "data: JSON" menjadi "text biasa"
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
                  const content = json.choices?.[0]?.delta?.content || "";
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (e) {
                  // Ignore parse errors on partial chunks
                }
              }
            }
          }
          controller.close();
      } catch (e) {
          controller.error(e);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain" } });
}

// --- UTILS ---
function getFallbackModel(provider: string): string {
  switch (provider) {
    case 'GEMINI': return 'gemini-1.5-flash'; // Fallback aman
    case 'OPENAI': return 'gpt-4o-mini';
    case 'GROQ': return 'llama-3.3-70b-versatile';
    case 'DEEPSEEK': return 'deepseek-chat';
    case 'MISTRAL': return 'mistral-medium';
    default: return 'gpt-3.5-turbo';
  }
}
