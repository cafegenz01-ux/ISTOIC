
import React, { createContext, useContext, useState, useCallback } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

interface HistoryItem {
    id: string;
    url: string;
    type: 'IMAGE' | 'VIDEO';
    prompt: string;
    timestamp: number;
    metadata?: { provider: string; model: string; };
}

interface GenerativeSessionContextType {
    // --- GENERATIVE STUDIO STATE ---
    prompt: string;
    setPrompt: (val: string) => void;
    aspectRatio: '1:1' | '16:9' | '9:16';
    setAspectRatio: (val: '1:1' | '16:9' | '9:16') => void;
    stylePreset: string;
    setStylePreset: (val: string) => void;
    
    resultUrl: string | null;
    setResultUrl: (val: string | null) => void;
    resultType: 'IMAGE' | 'VIDEO' | null;
    setResultType: (val: 'IMAGE' | 'VIDEO' | null) => void;
    resultMeta: { provider: string, model: string } | null;
    setResultMeta: (val: { provider: string, model: string } | null) => void;
    
    isProcessing: boolean;
    setIsProcessing: (val: boolean) => void;
    statusMsg: string;
    setStatusMsg: (val: string) => void;
    errorMsg: string | null;
    setErrorMsg: (val: string | null) => void;

    selectedProvider: string;
    setSelectedProvider: (val: string) => void;
    selectedModel: string;
    setSelectedModel: (val: string) => void;

    // --- NEURAL VISION STATE (NEW) ---
    visionPrompt: string;
    setVisionPrompt: (val: string) => void;
    visionResult: string | null;
    setVisionResult: (val: string | null) => void;
    visionInputImage: string | null; // Base64
    setVisionInputImage: (val: string | null) => void;
    visionInputType: string | null; // MimeType
    setVisionInputType: (val: string | null) => void;
    visionLoading: 'ANALYZE' | 'EDIT' | null;
    setVisionLoading: (val: 'ANALYZE' | 'EDIT' | null) => void;
    visionEditResult: string | null;
    setVisionEditResult: (val: string | null) => void;
    visionProvider: string;
    setVisionProvider: (val: string) => void;
    visionModel: string;
    setVisionModel: (val: string) => void;

    // --- HISTORY ---
    history: HistoryItem[];
    addToHistory: (url: string, type: 'IMAGE' | 'VIDEO', promptText: string, meta: { provider: string, model: string }) => void;
}

const GenerativeSessionContext = createContext<GenerativeSessionContextType | undefined>(undefined);

export const GenerativeSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- GENERATIVE STUDIO PERSISTENCE ---
    const [prompt, setPrompt] = useLocalStorage<string>('gen_studio_prompt', '');
    const [aspectRatio, setAspectRatio] = useLocalStorage<'1:1' | '16:9' | '9:16'>('gen_studio_ratio', '1:1');
    const [stylePreset, setStylePreset] = useLocalStorage<string>('gen_studio_style', 'NONE');
    
    const [resultUrl, setResultUrl] = useState<string | null>(null); // Memory only (Too large for LS usually)
    const [resultType, setResultType] = useState<'IMAGE' | 'VIDEO' | null>(null);
    const [resultMeta, setResultMeta] = useState<{ provider: string, model: string } | null>(null);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMsg, setStatusMsg] = useState('IDLE');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [selectedProvider, setSelectedProvider] = useLocalStorage<string>('gen_studio_provider', 'HYDRA');
    const [selectedModel, setSelectedModel] = useLocalStorage<string>('gen_studio_model', 'hydra-smart-route');

    // --- NEURAL VISION PERSISTENCE ---
    const [visionPrompt, setVisionPrompt] = useLocalStorage<string>('vision_prompt', '');
    const [visionResult, setVisionResult] = useLocalStorage<string | null>('vision_result', null);
    
    // Images kept in memory to prevent LS quota exceeded, but persist during navigation
    const [visionInputImage, setVisionInputImage] = useState<string | null>(null); 
    const [visionInputType, setVisionInputType] = useState<string | null>(null);
    const [visionEditResult, setVisionEditResult] = useState<string | null>(null);
    
    const [visionLoading, setVisionLoading] = useState<'ANALYZE' | 'EDIT' | null>(null);
    
    const [visionProvider, setVisionProvider] = useLocalStorage<string>('vision_provider', 'GEMINI');
    const [visionModel, setVisionModel] = useLocalStorage<string>('vision_model', 'gemini-3-flash-preview');

    // --- HISTORY ---
    const [history, setHistory] = useLocalStorage<HistoryItem[]>('gen_studio_history', []);

    const addToHistory = useCallback((url: string, type: 'IMAGE' | 'VIDEO', promptText: string, meta: { provider: string, model: string }) => {
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            url,
            type,
            prompt: promptText,
            timestamp: Date.now(),
            metadata: meta
        };
        setHistory(prev => [newItem, ...prev].slice(0, 20)); 
    }, [setHistory]);

    return (
        <GenerativeSessionContext.Provider value={{
            prompt, setPrompt,
            aspectRatio, setAspectRatio,
            stylePreset, setStylePreset,
            resultUrl, setResultUrl,
            resultType, setResultType,
            resultMeta, setResultMeta,
            isProcessing, setIsProcessing,
            statusMsg, setStatusMsg,
            errorMsg, setErrorMsg,
            selectedProvider, setSelectedProvider,
            selectedModel, setSelectedModel,
            
            visionPrompt, setVisionPrompt,
            visionResult, setVisionResult,
            visionInputImage, setVisionInputImage,
            visionInputType, setVisionInputType,
            visionLoading, setVisionLoading,
            visionEditResult, setVisionEditResult,
            visionProvider, setVisionProvider,
            visionModel, setVisionModel,

            history, addToHistory
        }}>
            {children}
        </GenerativeSessionContext.Provider>
    );
};

export const useGenerativeSession = () => {
    const context = useContext(GenerativeSessionContext);
    if (!context) throw new Error('useGenerativeSession must be used within GenerativeSessionProvider');
    return context;
};
