
import { KEY_MANAGER } from "./geminiService";
import { debugService } from "./debugService";
import { SECURITY_MATRIX } from "./securityMatrix";

export interface StandardMessage {
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

// Recursively cleans Google Schema types (UPPERCASE) to OpenAI Schema types (lowercase)
function cleanSchemaTypes(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;
    
    // Deep clone to avoid mutation side-effects
    const clean = Array.isArray(schema) ? [...schema] : { ...schema };

    if (clean.type) {
        const typeMap: Record<string, string> = {
            'STRING': 'string',
            'NUMBER': 'number',
            'INTEGER': 'integer',
            'BOOLEAN': 'boolean',
            'ARRAY': 'array',
            'OBJECT': 'object',
            'NULL': 'null'
        };
        
        if (typeof clean.type === 'string') {
            if (typeMap[clean.type]) {
                clean.type = typeMap[clean.type];
            } else {
                clean.type = clean.type.toLowerCase();
            }
        }
    }

    if (clean.properties) {
        const newProps: any = {};
        for (const key in clean.properties) {
            newProps[key] = cleanSchemaTypes(clean.properties[key]);
        }
        clean.properties = newProps;
    }
    
    if (clean.items) {
        clean.items = cleanSchemaTypes(clean.items);
    }

    return clean;
}

function convertToolsToOpenAI(googleTools: any[]): any[] | undefined {
    if (!googleTools || googleTools.length === 0) return undefined;
    const openaiTools: any[] = [];
    googleTools.forEach(toolBlock => {
        if (toolBlock.functionDeclarations) {
            toolBlock.functionDeclarations.forEach((fd: any) => {
                let parameters = JSON.parse(JSON.stringify(fd.parameters || {}));
                
                // Normalizing types is CRITICAL for Groq/OpenAI to avoid 400 errors
                parameters = cleanSchemaTypes(parameters);

                openaiTools.push({
                    type: "function",
                    function: {
                        name: fd.name,
                        description: fd.description,
                        parameters: parameters
                    }
                });
            });
        }
    });
    return openaiTools.length > 0 ? openaiTools : undefined;
}

const getSecureEndpoint = (provider: string): string => {
    switch (provider) {
        case 'GROQ': return SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,97,112,105,46,103,114,111,113,46,99,111,109,47,111,112,101,110,97,105,47,118,49,47,99,104,97,116,47,99,111,109,112,108,101,116,105,111,110,115]);
        case 'DEEPSEEK': return SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,97,112,105,46,100,101,101,112,115,101,101,107,46,99,111,109,47,99,104,97,116,47,99,111,109,112,108,101,116,105,111,110,115]);
        case 'OPENAI': return SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,97,112,105,46,111,112,101,110,97,105,46,99,111,109,47,118,49,47,99,104,97,116,47,99,111,109,112,108,101,116,105,111,110,115]);
        case 'XAI': return SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,97,112,105,46,120,46,97,105,47,118,49,47,99,104,97,116,47,99,111,109,112,108,101,116,105,111,110,115]);
        case 'OPENROUTER': return SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,111,112,101,110,114,111,117,116,101,114,46,97,105,47,97,112,105,47,118,49,47,99,104,97,116,47,99,111,109,112,108,101,116,105,111,110,115]);
        // MISTRAL: https://api.mistral.ai/v1/chat/completions
        case 'MISTRAL': return SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,97,112,105,46,109,105,115,116,114,97,108,46,97,105,47,118,49,47,99,104,97,116,47,99,111,109,112,108,101,116,105,111,110,115]);
        default: return '';
    }
};

const getVisionEndpoint = (provider: string): string => getSecureEndpoint(provider);

export async function* streamOpenAICompatible(
    provider: 'GROQ' | 'DEEPSEEK' | 'OPENAI' | 'XAI' | 'MISTRAL' | 'OPENROUTER',
    modelId: string,
    messages: StandardMessage[],
    systemInstruction?: string,
    tools: any[] = [],
    signal?: AbortSignal
): AsyncGenerator<{ text?: string; functionCall?: any; }> {

    const apiKey = KEY_MANAGER.getKey(provider);
    
    if (!apiKey) {
        yield { text: `\n\n⚠️ **SISTEM HALT**: Kunci API untuk **${provider}** tidak valid atau habis.` };
        return;
    }

    // FIX: PREVENT 401 LOOP IF KEY IS SERVER-SIDE PLACEHOLDER
    if (apiKey === 'server-side-managed') {
        yield { text: `\n\n🔒 **SECURE MODE ACTIVE**: Client-side execution disabled for ${provider}. Please enable VITE_USE_SECURE_BACKEND to route this request through the server.` };
        return;
    }

    const fullMessages: any[] = [
        { role: 'system', content: systemInstruction || "You are a helpful assistant." },
        ...messages
    ];

    const endpoint = getSecureEndpoint(provider);
    
    const headers: any = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    if (provider === 'OPENROUTER') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'IStoicAI Platinum';
    }

    const body: any = {
        model: modelId,
        messages: fullMessages,
        stream: true,
        temperature: 0.7,
        // Set max_tokens to prevent some providers from rejecting open-ended requests
        max_tokens: 4096
    };

    // Mistral has strict tool requirements, safer to disable tools if not explicitly compatible
    // But basic OpenAI tool schema should work for function calling models
    if (modelId !== 'deepseek-reasoner' && tools && tools.length > 0) {
        const compatibleTools = convertToolsToOpenAI(tools);
        if (compatibleTools) {
            body.tools = compatibleTools;
            body.tool_choice = "auto";
        }
    }

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal
        });
    } catch (e: any) {
        if (e.name === 'AbortError') throw e;
        debugService.log('ERROR', provider, 'NET_ERR', e.message);
        throw new Error(`Network Error (${provider}): ${e.message}`);
    }

    if (!response.ok) {
        let errorText = "";
        try { errorText = await response.text(); } catch {}
        debugService.log('ERROR', provider, `API_${response.status}`, errorText);
        throw new Error(`API Error ${response.status} from ${provider}: ${errorText.slice(0, 100)}...`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    // BUFFERING LOGIC FOR FRAGMENTED CHUNKS
    let buffer = "";
    let toolCallAccumulator: any = {};
    let isAccumulatingTool = false;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (signal?.aborted) break;
            
            // Append new bits to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines only
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);

                if (!line || line === 'data: [DONE]') continue;
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    try {
                        const json = JSON.parse(jsonStr);
                        const choice = json.choices?.[0];
                        if (!choice) continue;

                        const delta = choice.delta;

                        // 1. Text Content
                        if (delta?.content) {
                            yield { text: delta.content };
                        }

                        // 2. Reasoning (DeepSeek)
                        if ((delta as any)?.reasoning_content) {
                            yield { text: `\n<think>${(delta as any).reasoning_content}</think>` };
                        }

                        // 3. Tool Calls (Accumulation)
                        if (delta?.tool_calls) {
                            isAccumulatingTool = true;
                            for (const tc of delta.tool_calls) {
                                const idx = tc.index;
                                if (!toolCallAccumulator[idx]) {
                                    toolCallAccumulator[idx] = { 
                                        name: tc.function?.name || "", 
                                        args: tc.function?.arguments || "",
                                        id: tc.id 
                                    };
                                } else {
                                    if (tc.function?.arguments) toolCallAccumulator[idx].args += tc.function.arguments;
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors on partial chunks
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    if (isAccumulatingTool && !signal?.aborted) {
        for (const idx in toolCallAccumulator) {
            const tc = toolCallAccumulator[idx];
            try {
                const args = JSON.parse(tc.args);
                yield { 
                    functionCall: {
                        name: tc.name,
                        args: args
                    } 
                };
            } catch (e) {
                console.error("Failed to parse tool arguments", e, tc.args);
                yield { text: `\n\n[SYSTEM WARNING: Tool Arguments Malformed. Raw: ${tc.args}]` };
            }
        }
    }
}

export async function analyzeMultiModalMedia(provider: string, modelId: string, data: string, mimeType: string, prompt: string): Promise<string> {
    const { GoogleGenAI } = await import("@google/genai"); 
    const apiKey = KEY_MANAGER.getKey(provider);
    if (!apiKey) throw new Error(`API Key for ${provider} not found`);

    if (provider === 'GEMINI') {
        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: modelId || 'gemini-3-flash-preview',
                contents: { parts: [{ inlineData: { data, mimeType } }, { text: prompt }] }
            });
            KEY_MANAGER.reportSuccess('GEMINI');
            return response.text || "No response.";
        } catch (e: any) {
            KEY_MANAGER.reportFailure('GEMINI', apiKey, e);
            throw new Error(`Gemini Vision Failed: ${e.message}`);
        }
    }

    if (['GROQ', 'OPENAI', 'OPENROUTER', 'MISTRAL'].includes(provider)) {
        // Mistral also supports vision via pixtral, reuse generic vision endpoint logic if model supports it
        const endpoint = getVisionEndpoint(provider);
        const headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        if (provider === 'OPENROUTER') {
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'IStoicAI Platinum';
        }
        const body = {
            model: modelId,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } }
                    ]
                }
            ],
            max_tokens: 1024
        };

        try {
            const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Vision API Error: ${err}`);
            }
            const json = await response.json();
            KEY_MANAGER.reportSuccess(provider);
            return json.choices[0]?.message?.content || "No analysis generated.";
        } catch (e: any) {
            KEY_MANAGER.reportFailure(provider, apiKey, e);
            throw new Error(`${provider} Vision Error: ${e.message}`);
        }
    }
    return `Provider ${provider} does not support visual analysis in this kernel.`;
}

// ... existing code for generateMultiModalImage (unchanged)
export async function generateMultiModalImage(provider: string, modelId: string, prompt: string, options: any): Promise<string> {
    const { GoogleGenAI } = await import("@google/genai");
    const apiKey = KEY_MANAGER.getKey(provider);
    if (!apiKey) throw new Error(`API Key for ${provider} not found`);
    
    if (provider === 'GEMINI') {
        try {
            const ai = new GoogleGenAI({ apiKey });
            const validRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];
            const ratio = validRatios.includes(options?.aspectRatio) ? options.aspectRatio : "1:1";
            const targetModel = (modelId === 'gemini-2.0-flash-exp' || !modelId) ? 'gemini-2.5-flash-image' : modelId;

            const response = await ai.models.generateContent({
                model: targetModel, 
                contents: { parts: [{ text: prompt }] },
                config: { imageConfig: { aspectRatio: ratio } } 
            });
            
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    KEY_MANAGER.reportSuccess('GEMINI');
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            throw new Error("No image data returned from Gemini.");
        } catch(e) {
            KEY_MANAGER.reportFailure('GEMINI', apiKey, e);
            throw e;
        }
    }

    if (provider === 'OPENAI') {
        try {
            let size = "1024x1024";
            if (modelId === 'dall-e-3') {
                if (options?.aspectRatio === '16:9') size = "1792x1024";
                else if (options?.aspectRatio === '9:16') size = "1024x1792";
            }
            const endpoint = SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,97,112,105,46,111,112,101,110,97,105,46,99,111,109,47,118,49,47,99,104,97,116,47,99,111,109,112,108,101,116,105,111,110,115]);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: modelId || "dall-e-3",
                    prompt: prompt,
                    n: 1,
                    size: size,
                    response_format: "b64_json",
                    quality: "standard",
                    style: "vivid"
                })
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`DALL-E Error: ${err}`);
            }
            const json = await response.json();
            const b64 = json.data[0].b64_json;
            if (b64) {
                KEY_MANAGER.reportSuccess('OPENAI');
                return `data:image/png;base64,${b64}`;
            }
            throw new Error("No image data returned from OpenAI.");
        } catch(e) {
            KEY_MANAGER.reportFailure('OPENAI', apiKey, e);
            throw e;
        }
    }
    throw new Error(`Provider ${provider} not supported for Image Generation.`);
}
