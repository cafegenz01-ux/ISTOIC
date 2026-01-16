
// --- CONFIGURATION ---
// Gunakan Edge Runtime untuk kecepatan maksimal (Cold start ~0ms)
export const config = {
  runtime: 'edge',
};

// --- CONSTANTS ---
const RACE_TIMEOUT_MS = 30000; // 30s max per provider
const MAX_BUFFER_SIZE = 50000; // 50KB buffer limit
const STREAM_CHUNK_SIZE = 8192; // 8KB chunks for better performance

// --- TYPES ---
interface RacerMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamPayload {
  text: string;
  provider?: string;
  keyId?: string; // ID mask untuk debug key mana yang dipakai
  timestamp?: number; // For latency tracking
}

interface RacerConfig {
  provider: string;
  url: string;
  model: string;
  envKey: string;
  priority: number; // Lower = higher priority
  timeout?: number; // Custom timeout per provider
}

interface RaceResult {
  stream: ReadableStream;
  provider: string;
  keyMask: string;
  latency?: number; // Response time in ms
}

// --- UTILS: SMART KEY ROTATOR ---
/**
 * Mengambil satu key secara acak dari daftar key yang dipisah koma.
 * Contoh Env: "sk-123, sk-456, sk-789" -> Output: "sk-456" (Random)
 * Improved: Better validation and caching
 */
function getRandomKey(envVarName: string): string | null {
  const rawValue = process.env[envVarName];
  if (!rawValue) return null;

  // Split koma, hapus spasi, hapus entry kosong
  const keys = rawValue.split(',').map(k => k.trim()).filter(k => k.length > 0);
  
  if (keys.length === 0) return null;

  // Pilih acak dengan crypto-secure random jika available
  const randomIndex = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(1))[0] % keys.length
    : Math.floor(Math.random() * keys.length);
  
  return keys[randomIndex];
}

/**
 * Mask API key untuk logging (security)
 */
function maskKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `${key.slice(0, 2)}...${key.slice(-4)}`;
}

// --- HELPER: Promise.any Polyfill for Older Edge Runtimes ---
/**
 * Improved race with timeout and better error handling
 */
function raceToSuccess<T>(promises: Promise<T>[], timeoutMs: number = RACE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    if (promises.length === 0) {
      reject(new Error("No racers available"));
      return;
    }

    let resolved = false;
    let rejectionCount = 0;
    const errors: Error[] = [];
    
    // Timeout handler
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Race timeout after ${timeoutMs}ms. Errors: ${errors.map(e => e.message).join('; ')}`));
      }
    }, timeoutMs);

    // Race all promises
    for (const p of promises) {
      p.then(
        (result) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(result);
          }
        },
        (error) => {
          errors.push(error instanceof Error ? error : new Error(String(error)));
          rejectionCount++;
          if (rejectionCount === promises.length && !resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            reject(new Error(`All racers failed: ${errors.map(e => e.message).join('; ')}`));
          }
        }
      );
    }
  });
}

// --- MAIN HANDLER ---
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, system, context } = await req.json();
    
    if (!prompt) {
      return new Response('Missing prompt', { status: 400 });
    }

    // Contextual Prompt Construction
    const systemPrompt = system || "You are a helpful, secure AI assistant.";
    const fullSystemContent = context 
      ? `${systemPrompt}\n\n[CURRENT CONTEXT]:\n${context}` 
      : systemPrompt;

    const messages: RacerMessage[] = [
      { role: 'system', content: fullSystemContent },
      { role: 'user', content: prompt }
    ];

    // --- PREPARE RACERS (Load Balanced Engines) ---
    // Improved: Better organization with config array and priority-based ordering
    const controllers: Map<string, AbortController> = new Map();
    const racers: Promise<RaceResult>[] = [];
    
    // Racer configurations (priority order: lower = higher priority)
    const racerConfigs: RacerConfig[] = [
      {
        provider: 'GROQ',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        envKey: 'GROQ_API_KEY',
        priority: 1,
        timeout: 25000 // 25s for Groq (fastest)
      },
      {
        provider: 'GEMINI',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent',
        model: 'gemini-2.0-flash-exp',
        envKey: 'GEMINI_API_KEY',
        priority: 2,
        timeout: 28000 // 28s for Gemini
      },
      {
        provider: 'OPENAI',
        url: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
        envKey: 'OPENAI_API_KEY',
        priority: 3,
        timeout: 30000 // 30s for OpenAI
      },
      {
        provider: 'DEEPSEEK',
        url: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-chat',
        envKey: 'DEEPSEEK_API_KEY',
        priority: 4,
        timeout: 30000
      },
      {
        provider: 'MISTRAL',
        url: 'https://api.mistral.ai/v1/chat/completions',
        model: 'mistral-large-latest',
        envKey: 'MISTRAL_API_KEY',
        priority: 5,
        timeout: 30000
      },
      {
        provider: 'OPENROUTER',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        model: 'google/gemini-flash-1.5',
        envKey: 'OPENROUTER_API_KEY',
        priority: 6,
        timeout: 30000
      }
    ];

    // Build racers from configs
    for (const config of racerConfigs) {
      const apiKey = getRandomKey(config.envKey);
      if (!apiKey) continue;

      const controller = new AbortController();
      controllers.set(config.provider, controller);

      // Create racer promise with timeout
      const racerPromise = (config.provider === 'GEMINI'
        ? fetchGemini(config.provider, apiKey, config.model, messages, controller.signal)
        : fetchOpenAICompatible(config.provider, config.url, apiKey, config.model, messages, controller.signal)
      ).catch((error) => {
        // Enhanced error logging
        console.error(`[RACER FAIL] ${config.provider} (${maskKey(apiKey)}):`, error.message);
        throw error;
      });

      racers.push(racerPromise);
    }

    // CHECK: Any Drivers?
    if (racers.length === 0) {
      return new Response(
        JSON.stringify({ text: "⚠️ SERVER ERROR: No valid API Keys found in Environment." }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- THE RACE (Winner Takes All) ---
    const raceStartTime = Date.now();
    const winner = await raceToSuccess(racers, RACE_TIMEOUT_MS);
    const raceLatency = Date.now() - raceStartTime;

    // KILL LOSERS: Abort all other controllers immediately for resource efficiency
    for (const [provider, controller] of controllers.entries()) {
      if (provider !== winner.provider) {
        try {
          controller.abort();
        } catch (e) {
          // Ignore abort errors
        }
      }
    }

    // --- STREAM RESPONSE (Enhanced with better buffering and error handling) ---
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let streamBuffer = '';
    let firstChunkTime: number | null = null;
    
    const customStream = new ReadableStream({
      async start(controller) {
        const reader = winner.stream.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            if (firstChunkTime === null) {
              firstChunkTime = Date.now();
            }
            
            // Decode raw text chunk dari helper
            const chunkText = decoder.decode(value, { stream: true });
            
            if (chunkText) {
              streamBuffer += chunkText;
              
              // Process buffer in chunks to avoid memory issues
              if (streamBuffer.length > STREAM_CHUNK_SIZE) {
                const toSend = streamBuffer.slice(0, STREAM_CHUNK_SIZE);
                streamBuffer = streamBuffer.slice(STREAM_CHUNK_SIZE);
                
                const payload: StreamPayload = { 
                  text: toSend, 
                  provider: winner.provider,
                  keyId: winner.keyMask,
                  timestamp: Date.now()
                };
                controller.enqueue(encoder.encode(JSON.stringify(payload)));
              }
            }
          }
          
          // Flush remaining buffer
          if (streamBuffer) {
            const payload: StreamPayload = { 
              text: streamBuffer, 
              provider: winner.provider,
              keyId: winner.keyMask,
              timestamp: Date.now()
            };
            controller.enqueue(encoder.encode(JSON.stringify(payload)));
            streamBuffer = '';
          }
          
        } catch (err) {
          console.error(`[STREAM ERROR] ${winner.provider}:`, err);
          const errorPayload: StreamPayload = { 
            text: "\n[Connection Interrupted]", 
            provider: winner.provider,
            keyId: winner.keyMask,
            timestamp: Date.now()
          };
          controller.enqueue(encoder.encode(JSON.stringify(errorPayload)));
        } finally {
          try {
            reader.releaseLock();
          } catch (e) {
            // Ignore release errors
          }
          controller.close();
        }
      }
    });

    // Enhanced response headers with metrics
    const timeToFirstByte = firstChunkTime ? firstChunkTime - raceStartTime : raceLatency;
    
    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'X-Winner-Provider': winner.provider,
        'X-Key-Mask': winner.keyMask,
        'X-Race-Latency': `${raceLatency}ms`,
        'X-Time-To-First-Byte': `${timeToFirstByte}ms`,
        'X-Content-Type-Options': 'nosniff'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[OMNI-RACE FATAL]:", errorMessage);
    
    // More informative error response
    const errorResponse = {
      text: `⚠️ All AI Nodes Failed\n\nReason: ${errorMessage}\n\nPlease check:\n- API keys are valid\n- Network connection\n- Rate limits`,
      error: true,
      timestamp: Date.now()
    };
    
    return new Response(
      JSON.stringify(errorResponse), 
      { 
        status: 503, 
        headers: { 
          'Content-Type': 'application/json',
          'X-Error-Type': 'OMNI_RACE_FAILURE'
        } 
      }
    );
  }
}

// --- HELPER 1: OpenAI Compatible Fetcher (Enhanced) ---
async function fetchOpenAICompatible(
  providerName: string,
  url: string,
  key: string,
  model: string,
  messages: RacerMessage[],
  signal: AbortSignal
): Promise<RaceResult> {
  
  const startTime = Date.now();
  const keyMask = maskKey(key);

  // Enhanced request with better error handling
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'User-Agent': 'IStoicAI-OmniRace/1.0',
      ...(providerName === 'OPENROUTER' && {
        'HTTP-Referer': 'https://istoic.app',
        'X-Title': 'IStoic AI'
      })
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000, // Increased from 1500 for better responses
    }),
    signal: signal
  });

  const latency = Date.now() - startTime;

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`${providerName} (${keyMask}) HTTP ${res.status}: ${errorText.slice(0, 200)}`);
  }
  
  if (!res.body) {
    throw new Error(`${providerName} (${keyMask}): No response body`);
  }

  // Transform Stream: SSE -> Raw Text (Enhanced with better buffering)
  const rawStream = res.body;
  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          if (signal.aborted) {
            controller.close();
            return;
          }
          
          buffer += decoder.decode(value, { stream: true });
          
          // Prevent buffer overflow
          if (buffer.length > MAX_BUFFER_SIZE) {
            console.warn(`[${providerName}] Buffer overflow, truncating`);
            buffer = buffer.slice(-MAX_BUFFER_SIZE);
          }
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') {
              continue;
            }
            
            if (trimmed.startsWith('data: ')) {
              try {
                const jsonStr = trimmed.replace('data: ', '');
                const json = JSON.parse(jsonStr);
                
                // Support standard OpenAI format
                const content = json.choices?.[0]?.delta?.content;
                
                // Support DeepSeek reasoning format
                const reasoning = json.choices?.[0]?.delta?.reasoning_content;
                
                if (reasoning) {
                  controller.enqueue(encoder.encode(`<think>${reasoning}</think>`));
                  chunkCount++;
                }
                
                if (content) {
                  controller.enqueue(encoder.encode(content));
                  chunkCount++;
                }
              } catch (e) {
                // Silently ignore malformed JSON chunks (common in streaming)
                if (chunkCount === 0) {
                  // Only log if we haven't received any valid chunks yet
                  console.debug(`[${providerName}] Chunk parse error:`, e);
                }
              }
            }
          }
        }
        
        // Flush remaining buffer
        if (buffer.trim()) {
          try {
            const json = JSON.parse(buffer.replace('data: ', ''));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          } catch (e) {
            // Ignore final buffer parse errors
          }
        }
      } catch (e) {
        if (!signal.aborted) {
          console.error(`[${providerName}] Stream error:`, e);
          controller.error(e);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch (e) {
          // Ignore
        }
        controller.close();
      }
    }
  });

  return { 
    stream: transformedStream, 
    provider: providerName, 
    keyMask,
    latency 
  };
}

// --- HELPER 2: Google Gemini Fetcher (Enhanced) ---
async function fetchGemini(
  providerName: string,
  key: string,
  model: string,
  messages: RacerMessage[],
  signal: AbortSignal
): Promise<RaceResult> {
  
  const startTime = Date.now();
  const keyMask = maskKey(key);
  
  // Format messages with better handling
  const contents = messages
    .filter(m => m.content && m.content.trim().length > 0)
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  if (contents.length === 0) {
    throw new Error(`${providerName}: No valid messages to send`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'User-Agent': 'IStoicAI-OmniRace/1.0'
    },
    body: JSON.stringify({ contents }),
    signal: signal
  });

  const latency = Date.now() - startTime;

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`${providerName} (${keyMask}) HTTP ${res.status}: ${errorText.slice(0, 200)}`);
  }
  
  if (!res.body) {
    throw new Error(`${providerName} (${keyMask}): No response body`);
  }

  const rawStream = res.body;
  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (signal.aborted) {
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          
          // Prevent buffer overflow
          if (buffer.length > MAX_BUFFER_SIZE) {
            console.warn(`[${providerName}] Buffer overflow, truncating`);
            buffer = buffer.slice(-MAX_BUFFER_SIZE);
          }
          
          // Enhanced regex untuk ambil teks Gemini dengan better escaping
          // Support both "text" and "text": fields
          const textPattern = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
          const matches = Array.from(buffer.matchAll(textPattern));
          
          if (matches.length > 0) {
            let lastIndex = 0;
            for (const match of matches) {
              // Process text before match
              if (match.index !== undefined && match.index > lastIndex) {
                // Try to extract any text between matches
                const betweenText = buffer.slice(lastIndex, match.index);
                const betweenMatches = betweenText.match(/"text":\s*"((?:[^"\\]|\\.)*)"/);
                if (betweenMatches) {
                  let text = betweenMatches[1];
                  text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                    chunkCount++;
                  }
                }
              }
              
              // Process matched text
              let text = match[1];
              text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              if (text) {
                controller.enqueue(encoder.encode(text));
                chunkCount++;
              }
              
              lastIndex = (match.index || 0) + match[0].length;
            }
            
            // Clear processed buffer
            buffer = buffer.slice(lastIndex);
          }
          
          // Safety: Clear buffer if it gets too large without matches
          if (buffer.length > 20000 && chunkCount > 0) {
            buffer = buffer.slice(-5000); // Keep last 5KB
          }
        }
        
        // Final flush: try to extract any remaining text
        if (buffer.trim()) {
          const finalMatch = buffer.match(/"text":\s*"((?:[^"\\]|\\.)*)"/);
          if (finalMatch) {
            let text = finalMatch[1];
            text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        }
      } catch (e) {
        if (!signal.aborted) {
          console.error(`[${providerName}] Stream error:`, e);
          controller.error(e);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch (e) {
          // Ignore
        }
        controller.close();
      }
    }
  });

  return { 
    stream: transformedStream, 
    provider: providerName, 
    keyMask,
    latency 
  };
}
