import { ModelMetadata } from "../types";

export const MODEL_IDS = {
    GEMINI_FLASH: 'gemini-3-flash-preview',
    GEMINI_PRO: 'gemini-3-pro-preview',
    GEMINI_FLASH_V2: 'gemini-2.0-flash-exp',
    HYDRA_OMNI: 'auto-best',
    LLAMA_70B: 'llama-3.3-70b-versatile',
    LLAMA_8B: 'llama-3.1-8b-instant',
    MISTRAL_LARGE: 'mistral-large-latest',
    MISTRAL_MEDIUM: 'mistral-medium-latest',
    DEEPSEEK_CHAT: 'deepseek-chat',
    DEEPSEEK_R1: 'deepseek-reasoner',
    GPT_4O_MINI: 'gpt-4o-mini',
    GPT_4O: 'gpt-4o'
};

export const MASTER_MODEL_CATALOG: ModelMetadata[] = [
    { 
        id: MODEL_IDS.GEMINI_FLASH, 
        name: 'Gemini 3 Flash', 
        category: 'GEMINI_3', 
        provider: 'GEMINI', 
        description: 'Titanium V25 Standard: Ultra-fast reasoning with 1M context.', 
        specs: { context: '1M', contextLimit: 1000000, speed: 'INSTANT', intelligence: 9.5 } 
    },
    { 
        id: MODEL_IDS.GEMINI_PRO, 
        name: 'Gemini 3 Pro', 
        category: 'GEMINI_3', 
        provider: 'GEMINI', 
        description: 'Titanium V25 Deep: Complex reasoning and STEM solver.', 
        specs: { context: '2M', contextLimit: 2000000, speed: 'THINKING', intelligence: 10.0 } 
    },
    {
        id: MODEL_IDS.HYDRA_OMNI,
        name: 'Hydra Omni V25',
        category: 'GEMINI_2_5', 
        provider: 'GEMINI', 
        description: 'Parallel Execution Engine. Fastest node wins.',
        specs: { context: 'AUTO', contextLimit: 128000, speed: 'INSTANT', intelligence: 9.9 } 
    },
    { 
        id: MODEL_IDS.LLAMA_70B, 
        name: 'Llama 3.3 70B', 
        category: 'GROQ_VELOCITY', 
        provider: 'GROQ', 
        description: 'Open Source standard running on LPU hardware.', 
        specs: { context: '128K', contextLimit: 128000, speed: 'INSTANT', intelligence: 9.3 } 
    },
    {
        id: MODEL_IDS.LLAMA_8B,
        name: 'Llama 3 8B',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'Extremely fast Llama 3 via Groq LPU.',
        specs: { context: '8K', contextLimit: 8192, speed: 'INSTANT', intelligence: 8.5 }
    },
    {
        id: MODEL_IDS.MISTRAL_LARGE,
        name: 'Mistral Large',
        category: 'MISTRAL_NATIVE',
        provider: 'MISTRAL',
        description: 'Mistral flagship model. Top-tier reasoning capabilities.',
        specs: { context: '32K', contextLimit: 32000, speed: 'FAST', intelligence: 9.7 }
    },
    {
        id: MODEL_IDS.DEEPSEEK_R1,
        name: 'DeepSeek R1',
        category: 'DEEPSEEK_OFFICIAL',
        provider: 'DEEPSEEK',
        description: 'Advanced reasoning and logic (CoT).',
        specs: { context: '64K', contextLimit: 64000, speed: 'THINKING', intelligence: 9.9 }
    },
    {
        id: MODEL_IDS.GPT_4O,
        name: 'GPT-4o',
        category: 'OPEN_ROUTER_ELITE',
        provider: 'OPENAI',
        description: 'Flagship omni-model.',
        specs: { context: '128K', contextLimit: 128000, speed: 'FAST', intelligence: 9.8 }
    }
];

export const getModelById = (id: string): ModelMetadata | undefined => {
    return MASTER_MODEL_CATALOG.find(m => m.id === id);
};

export const getModelsByProvider = (provider: string): ModelMetadata[] => {
    return MASTER_MODEL_CATALOG.filter(m => m.provider === provider);
};
