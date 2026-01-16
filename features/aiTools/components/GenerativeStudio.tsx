
// ... (imports remain)
import React, { useEffect, useState } from 'react';
import { generateVideo } from '../../../services/geminiService';
import { generateMultiModalImage } from '../../../services/providerEngine';
import { HANISAH_KERNEL } from '../../../services/melsaKernel';
import { PollinationsService, HYDRA_MODELS } from '../../../services/pollinationsService'; 
import { ImageIcon, Video, Sparkles, Download, Trash2, Monitor, AlertCircle, Wand2, Palette, Layers, Zap, X, Dices, History, Cpu, Box } from 'lucide-react';
import { ToolGroup } from './ToolGroup';
import { useAIProvider } from '../../../hooks/useAIProvider';
import { VisualModelSelector, type ProviderGroup } from './VisualModelSelector';
import { UI_REGISTRY, FN_REGISTRY } from '../../../constants/registry';
import { debugService } from '../../../services/debugService';
import { useGenerativeSession } from '../../../contexts/GenerativeSessionContext';

// ... (PROPS & PRESETS remain)
interface GenerativeStudioProps {
    isOpen: boolean;
    onToggle: () => void;
    icon: React.ReactNode;
}

const STYLE_PRESETS = [
    { id: 'NONE', label: 'RAW', prompt: '', color: 'bg-zinc-500' },
    { id: 'CYBERPUNK', label: 'CYBERPUNK', prompt: ', cyberpunk style, neon lights, high tech, futuristic city, detailed, 8k resolution, cinematic lighting', color: 'bg-cyan-500' },
    { id: 'PHOTOREAL', label: 'PHOTOREAL', prompt: ', photorealistic, 8k, highly detailed, shot on 35mm, f/1.8, bokeh, professional photography', color: 'bg-emerald-500' },
    { id: 'ANIME', label: 'ANIME', prompt: ', anime style, studio ghibli style, vibrant colors, cel shaded, highly detailed', color: 'bg-pink-500' },
    { id: 'OIL', label: 'OIL PAINT', prompt: ', oil painting style, textured brush strokes, artistic, masterpiece', color: 'bg-amber-500' },
    { id: '3D', label: '3D RENDER', prompt: ', 3d render, octane render, unreal engine 5, ray tracing, highly detailed', color: 'bg-blue-500' }
];

const SURPRISE_PROMPTS = [
    "A futuristic city built inside a giant glass bubble on Mars, cinematic lighting, 8k",
    "A portrait of a cyborg woman with neon glowing eyes, cyberpunk style, detailed",
    "An isometric view of a magical library with floating books, fantasy art",
    "A cute robot gardener watering plants in a greenhouse, pixar style, 3d render",
    "A surreal landscape with melting clocks and floating islands, salvador dali style"
];

// ... (GenerativePreview remains the same)
const GenerativePreview: React.FC<{
    mediaUrl: string | null;
    type: 'IMAGE' | 'VIDEO' | null;
    isLoading: boolean;
    loadingStage: string;
    aspectRatio: string;
    onClear: () => void;
    error: string | null;
    metadata?: { provider: string; model: string; } | null;
}> = ({ mediaUrl, type, isLoading, loadingStage, aspectRatio, onClear, error, metadata }) => {
    const [isMediaLoaded, setIsMediaLoaded] = useState(false);
    const [displayError, setDisplayError] = useState<string | null>(null);

    // Reset local state when url changes
    useEffect(() => {
        if (!mediaUrl && !isLoading) {
            setIsMediaLoaded(false);
            setDisplayError(null);
        }
        if (error) setDisplayError(error);
        if (mediaUrl) setIsMediaLoaded(false); // Reset load state on new url
    }, [mediaUrl, isLoading, error]);

    // Aspect Ratio Calculation for Container
    const getAspectClass = () => {
        switch (aspectRatio) {
            case '16:9': return 'aspect-video';
            case '9:16': return 'aspect-[9/16]';
            case '4:3': return 'aspect-[4/3]';
            default: return 'aspect-square'; // 1:1
        }
    };

    // If nothing is happening, return null
    if (!isLoading && !mediaUrl && !error) return null;

    return (
        <div className="w-full max-w-2xl mx-auto mt-8 animate-slide-up">
            <div className={`relative w-full rounded-[24px] overflow-hidden border border-border bg-surface shadow-2xl transition-all duration-500 ${getAspectClass()}`}>
                
                {/* 1. LOADING STATE / DREAMING ANIMATION */}
                {(isLoading || (!isMediaLoaded && !displayError)) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-surface overflow-hidden">
                        {/* Pulse Orb */}
                        <div className="absolute w-[200%] h-[200%] bg-gradient-to-tr from-accent/10 to-purple-500/10 animate-[spin_8s_linear_infinite] blur-[100px] opacity-30"></div>
                        
                        {/* Scanning Grid */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(128,128,128,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(128,128,128,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                        
                        {/* Center Loader */}
                        <div className="relative z-10 flex flex-col items-center gap-6">
                            <div className="relative w-20 h-20">
                                <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-4 bg-accent/10 rounded-full animate-pulse blur-md"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles size={20} className="text-text animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <h4 className="text-sm font-semibold text-text animate-pulse">{loadingStage}</h4>
                                <p className="caption text-text-muted">Generating output</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. ERROR STATE */}
                {displayError && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-950/20 backdrop-blur-md p-8 text-center animate-fade-in">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                            <AlertCircle size={32} className="text-red-500" />
                        </div>
                        <h3 className="section-title text-danger mb-2">Generation failed</h3>
                        <p className="caption text-danger max-w-md break-words leading-relaxed">{displayError}</p>
                        <button 
                            onClick={onClear}
                            className="mt-6 px-6 py-3 bg-danger/10 hover:bg-danger hover:text-text-invert text-danger border border-danger/20 rounded-xl text-sm font-semibold transition-all"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* 3. MEDIA DISPLAY */}
                {mediaUrl && !displayError && (
                    <div className={`relative w-full h-full group ${isMediaLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-1000`}>
                        
                        {type === 'IMAGE' ? (
                            <img 
                                src={mediaUrl} 
                                alt="Generated Output" 
                                className="w-full h-full object-cover"
                                onLoad={() => setIsMediaLoaded(true)}
                                onError={() => setDisplayError("Image data corrupted or unreadable.")}
                            />
                        ) : (
                            <video 
                                src={mediaUrl} 
                                autoPlay 
                                loop 
                                controls 
                                className="w-full h-full object-cover"
                                onLoadedData={() => setIsMediaLoaded(true)}
                                onError={() => setDisplayError("Video stream unavailable.")}
                            />
                        )}

                        {/* OVERLAY CONTROLS (Fade in on hover) */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-6">
                            <div className="flex justify-between items-start">
                                <span className="px-3 py-1 bg-black/60 backdrop-blur rounded-lg text-[11px] font-semibold text-white border border-white/10 flex items-center gap-2">
                                    {type === 'IMAGE' ? <ImageIcon size={10}/> : <Video size={10}/>}
                                    {type === 'IMAGE' ? 'Image' : 'Video'}
                                </span>
                                <button onClick={onClear} className="p-2 bg-black/60 backdrop-blur rounded-full text-white hover:bg-red-500 transition-colors border border-white/10 hover:border-red-500">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => window.open(mediaUrl)}
                                    className="p-3 bg-white text-black rounded-xl hover:bg-accent transition-all shadow-lg active:scale-95 flex items-center gap-2 font-semibold text-[11px]"
                                    title="Download"
                                >
                                    <Download size={16} /> Download
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* METADATA FOOTER */}
            {metadata && !isLoading && !displayError && isMediaLoaded && (
                <div className="mt-4 flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl opacity-0 animate-slide-up shadow-sm" style={{ animationDelay: '0.2s', opacity: 1 }}>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Cpu size={14} className="text-accent" />
                            <span className="caption text-text">{metadata.provider}</span>
                        </div>
                        <div className="w-[1px] h-3 bg-border"></div>
                        <div className="flex items-center gap-2">
                            <Box size={14} className="text-text-muted" />
                            <span className="caption text-text-muted">{metadata.model}</span>
                        </div>
                    </div>
                    <span className="caption text-text-muted bg-surface-2 px-2 py-1 rounded">
                        {aspectRatio}
                    </span>
                </div>
            )}
        </div>
    );
};

export const GenerativeStudio: React.FC<GenerativeStudioProps> = ({ isOpen, onToggle, icon }) => {
    const {
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
        history, addToHistory
    } = useGenerativeSession();

    const { isHealthy, status: providerStatus } = useAIProvider(selectedProvider === 'HYDRA' ? 'GEMINI' : selectedProvider); 

    useEffect(() => {
        if (!isProcessing) return;
        const messages = resultType === 'VIDEO' ? [
            "Preparing video pipeline...", "Generating frames...", "Stabilizing sequence...", "Finalizing output..."
        ] : [
            "Preparing model...", "Generating details...", "Refining output...", "Finalizing image..."
        ];

        let msgIdx = 0;
        setStatusMsg(messages[0]);
        const interval = setInterval(() => {
            msgIdx = (msgIdx + 1) % messages.length;
            setStatusMsg(messages[msgIdx]);
        }, 2500);
        return () => clearInterval(interval);
    }, [isProcessing, resultType, setStatusMsg]);

    const handleGenerate = async (type: 'IMAGE' | 'VIDEO') => {
        if (!prompt.trim() || isProcessing) return;
        
        setIsProcessing(true);
        setErrorMsg(null);
        setResultUrl(null); 
        setResultType(type);
        setResultMeta(null);
        
        debugService.logAction(
            type === 'IMAGE' ? UI_REGISTRY.TOOLS_GEN_BTN_IMAGE : UI_REGISTRY.TOOLS_GEN_BTN_VIDEO, 
            FN_REGISTRY.TOOL_GENERATE_IMAGE, 
            selectedModel
        );

        const styleSuffix = STYLE_PRESETS.find(s => s.id === stylePreset)?.prompt || '';
        const finalPrompt = prompt + styleSuffix;

        try {
            let result: string | null = null;
            let meta = { provider: selectedProvider, model: selectedModel };

            if (type === 'VIDEO') {
                if (selectedProvider !== 'GEMINI') throw new Error("Video generation is only supported on Gemini Veo models.");
                result = await generateVideo(finalPrompt, { aspectRatio, resolution: '720p' });
            } else {
                if (selectedProvider === 'HYDRA') {
                    const genResult = await PollinationsService.generateHydraImage(finalPrompt, selectedModel);
                    result = genResult.url;
                    meta = { provider: genResult.provider, model: genResult.model };
                } else {
                    if (!isHealthy) throw new Error(`Provider ${selectedProvider} is currently ${providerStatus}.`);
                    
                    if (selectedModel === 'gemini-3-pro-image-preview') {
                        const aistudio = (window as any).aistudio;
                        if (aistudio && !(await aistudio.hasSelectedApiKey())) {
                            try { await aistudio.openSelectKey(); } catch(e) { throw new Error("API Key Selection Cancelled"); }
                        }
                    }

                    result = await generateMultiModalImage(selectedProvider, selectedModel, finalPrompt, { aspectRatio });
                }
            }

            if (!result) throw new Error("Engine returned empty data.");

            setResultUrl(result);
            setResultMeta(meta);
            addToHistory(result, type, prompt, meta);

        } catch (e: any) {
            console.error("Generation Error:", e);
            let userMsg = e.message || "Unknown synthesis error.";
            
            if (userMsg.includes("429") || userMsg.includes("RESOURCE_EXHAUSTED")) {
                userMsg = `QUOTA EXCEEDED: The ${selectedModel} model is busy. Try switching to Hydra (Free).`;
            } else if (userMsg.includes("HF_API")) {
                userMsg = "Hugging Face Model is loading. Please try again in 30 seconds.";
            }

            setErrorMsg(userMsg);
            setResultType(null); 
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRandomPrompt = () => setPrompt(SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)]);

    const handleEnhancePrompt = async () => {
        if (!prompt || isProcessing) return;
        setStatusMsg("Enhancing prompt...");
        setIsProcessing(true);
        try {
            const instruction = `Rewrite this image prompt to be highly detailed, descriptive, and optimized for Stable Diffusion/Flux. Keep it under 50 words. Input: "${prompt}"`;
            const result = await HANISAH_KERNEL.execute(instruction, 'gemini-3-flash-preview');
            if (result.text) setPrompt(result.text.trim());
        } catch(e) {}
        setIsProcessing(false);
    };

    const providers: ProviderGroup[] = [
        {
            id: 'HYDRA',
            name: 'Hydra Image Engine',
            models: [
                { id: 'hydra-smart-route', name: 'Hydra Smart Router', description: 'Auto-selects best model based on prompt.', tags: ['SMART', 'AUTO'], specs: { speed: 'FAST', quality: 'ULTRA' } },
                { id: HYDRA_MODELS.flux, name: 'Flux (Pollinations)', description: 'Excellent text rendering and general detail.', tags: ['FREE', 'TEXT'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: HYDRA_MODELS.fluxRealism, name: 'Flux Realism', description: 'Photorealistic output.', tags: ['FREE', 'REAL'], specs: { speed: 'FAST', quality: 'ULTRA' } },
                { id: HYDRA_MODELS.fluxAnime, name: 'Flux Anime', description: 'Anime/Manga style.', tags: ['FREE', '2D'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: HYDRA_MODELS.flux3d, name: 'Flux 3D', description: '3D Render style.', tags: ['FREE', '3D'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: HYDRA_MODELS.turbo, name: 'Turbo (Pollinations)', description: 'Fastest generation, lower detail.', tags: ['FREE', 'SPEED'], specs: { speed: 'INSTANT', quality: 'STD' } }
            ]
        },
        { 
            id: 'GEMINI', 
            name: 'Google Gemini', 
            models: [
                { id: 'gemini-2.5-flash-image', name: 'Imagen 3 Fast', description: 'Optimized for speed (Flash Image).', tags: ['FREE', 'FAST'], specs: { speed: 'INSTANT', quality: 'STD' } },
                { id: 'gemini-3-pro-image-preview', name: 'Imagen 3 Pro', description: 'Highest fidelity (Requires Paid Key).', tags: ['PRO', 'ULTRA'], specs: { speed: 'FAST', quality: 'ULTRA' } }
            ]
        },
        { 
            id: 'OPENAI', 
            name: 'OpenAI', 
            models: [
                { id: 'dall-e-3', name: 'DALL-E 3', description: 'State-of-the-art semantic instruction following.', tags: ['HD', 'VIVID'], specs: { speed: 'SLOW', quality: 'ULTRA' } }
            ]
        }
    ];

    const handleToggle = () => {
        debugService.logAction(UI_REGISTRY.TOOLS_BTN_TAB_GEN, FN_REGISTRY.NAVIGATE_TO_FEATURE, isOpen ? 'CLOSE' : 'OPEN');
        onToggle();
    };

    return (
        <ToolGroup 
            title="Image generator" 
            icon={icon} 
            subtitle="Image and video models" 
            isOpen={isOpen} 
            onToggle={handleToggle} 
            isLoading={isProcessing} 
            loadingText={statusMsg}
        >
            <div className="space-y-6 animate-fade-in p-4 md:p-6 relative">
                
                <button onClick={(e) => { e.stopPropagation(); handleToggle(); }} className="absolute top-2 right-2 md:top-4 md:right-4 p-2 rounded-full hover:bg-surface-2 text-text-muted hover:text-text transition-colors z-20" title="Minimize Studio">
                    <X size={20} />
                </button>

                {/* --- 1. CONFIGURATION DECK --- */}
                <div className="bg-surface rounded-[24px] border border-border/70 p-5 flex flex-col xl:flex-row gap-6 shadow-[var(--shadow-soft)] relative z-10">
                    <div className="flex-1 space-y-3">
                        <VisualModelSelector 
                            label="Rendering Engine"
                            selectedProviderId={selectedProvider}
                            selectedModelId={selectedModel}
                            providers={providers}
                            onSelect={(p, m) => { setSelectedProvider(p); setSelectedModel(m); }}
                            disabled={isProcessing}
                        />
                    </div>

                    <div className="space-y-3 xl:w-72">
                        <label className="caption text-text-muted pl-1 flex items-center gap-2">
                            <Monitor size={12} /> Aspect ratio
                        </label>
                <div className="flex bg-surface-2 p-1 rounded-xl border border-border/70 h-[64px] items-center shadow-[var(--shadow-soft)]">
                            {['1:1', '16:9', '9:16'].map(r => (
                                <button 
                                    key={r} 
                                    onClick={() => setAspectRatio(r as any)} 
                                    disabled={isProcessing}
                                    className={`flex-1 h-full rounded-lg text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 ${aspectRatio === r ? 'bg-surface text-accent shadow-sm border border-border' : 'text-text-muted hover:text-text'}`}
                                >
                                    <div className={`border-2 rounded-[2px] ${aspectRatio === r ? 'border-current' : 'border-border'} ${r === '1:1' ? 'w-3 h-3' : r === '16:9' ? 'w-5 h-2.5' : 'w-2.5 h-5'}`}></div>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- 2. PROMPT AREA --- */}
                <div className="relative group">
                    <div className="absolute top-4 left-5 z-10 flex items-center gap-2">
                        <span className="caption bg-surface/90 backdrop-blur-md px-2 py-1 rounded text-text flex items-center gap-1.5 border border-border shadow-sm">
                            <Zap size={10} className="text-accent"/> Prompt
                        </span>
                    </div>
                    
                    <div className="absolute top-4 right-4 z-10 flex gap-1.5">
                        <button onClick={handleRandomPrompt} disabled={isProcessing} className="p-2 bg-surface-2 hover:bg-surface text-text-muted hover:text-text rounded-lg border border-border/70 transition-all shadow-sm active:scale-95 disabled:opacity-0">
                            <Dices size={14} />
                        </button>
                        <button onClick={handleEnhancePrompt} disabled={isProcessing || !prompt} className="px-3 py-1.5 bg-accent/10 hover:bg-accent text-accent hover:text-text-invert rounded-lg border border-accent/20 transition-all shadow-sm group/wand disabled:opacity-0 flex items-center gap-1.5 text-xs font-semibold active:scale-95">
                            <Wand2 size={12} className="group-hover/wand:rotate-12 transition-transform" /> Enhance
                        </button>
                    </div>

                    <textarea 
                        value={prompt} 
                        onChange={(e) => setPrompt(e.target.value)} 
                        disabled={isProcessing}
                        placeholder="Describe your vision in high fidelity..." 
                        className="w-full bg-surface p-6 pt-16 rounded-[var(--radius-lg)] border border-border focus:border-accent/50 focus:shadow-[0_0_30px_-10px_var(--accent-glow)] outline-none text-text font-medium text-base h-40 resize-none transition-all placeholder:text-text-muted leading-relaxed font-sans" 
                    />
                </div>

                {/* --- 3. STYLE & ACTIONS --- */}
                <div className="space-y-3">
                    <label className="caption text-text-muted pl-1 flex items-center gap-2">
                        <Palette size={12} /> Style presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {STYLE_PRESETS.map(style => (
                            <button 
                                key={style.id} 
                                onClick={() => setStylePreset(style.id)}
                                disabled={isProcessing}
                                className={`
                                    relative px-4 py-2 rounded-lg text-sm font-semibold border transition-all overflow-hidden group
                                    ${stylePreset === style.id 
                                        ? 'border-accent text-text shadow-sm bg-surface' 
                                        : 'bg-surface-2 border-border text-text-muted hover:text-text hover:border-accent/40'
                                    }
                                `}
                            >
                                {stylePreset === style.id && <div className={`absolute inset-0 opacity-10 ${style.color}`}></div>}
                                <span className="relative z-10">{style.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/50">
                    <button 
                        onClick={() => handleGenerate('IMAGE')} 
                        disabled={isProcessing || !prompt.trim()} 
                        className="flex-1 py-4 bg-accent text-text-invert rounded-[var(--radius-md)] font-semibold text-sm flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all duration-300 group relative overflow-hidden"
                    >
                        <ImageIcon size={18} className="group-hover:scale-110 transition-transform" /> 
                        {isProcessing && resultType === 'IMAGE' ? 'Rendering...' : 'Generate image'}
                    </button>
                    
                    {selectedProvider === 'GEMINI' && (
                        <button 
                            onClick={() => handleGenerate('VIDEO')} 
                            disabled={isProcessing || !prompt.trim()} 
                            className="flex-1 py-4 bg-surface text-text rounded-[var(--radius-md)] font-semibold text-sm flex items-center justify-center gap-3 border border-border hover:border-accent/50 disabled:opacity-40 transition-all duration-300 shadow-sm hover:shadow-md group"
                        >
                            <Video size={18} className="group-hover:scale-110 transition-transform" /> 
                            {isProcessing && resultType === 'VIDEO' ? 'Synthesizing...' : 'Generate video'}
                        </button>
                    )}
                </div>

                {/* --- 4. RESULT DISPLAY (Persistent) --- */}
                {(resultUrl || isProcessing || errorMsg) && (
                    <GenerativePreview 
                        mediaUrl={resultUrl}
                        type={resultType}
                        isLoading={isProcessing}
                        loadingStage={statusMsg}
                        aspectRatio={aspectRatio}
                        onClear={() => { setResultUrl(null); setErrorMsg(null); setResultType(null); }}
                        error={errorMsg}
                        metadata={resultMeta}
                    />
                )}

                {/* --- 5. HISTORY STRIP --- */}
                {history.length > 0 && (
                    <div className="mt-6 border-t border-border pt-6">
                        <h4 className="caption text-text-muted mb-4 flex items-center gap-2">
                            <History size={12} /> Recent generations
                        </h4>
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                            {history.map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => { setResultUrl(item.url); setResultType(item.type); setPrompt(item.prompt); setErrorMsg(null); setResultMeta(item.metadata || null); }}
                                    className="relative w-24 h-16 rounded-lg overflow-hidden border border-border hover:border-accent/50 transition-all group shrink-0 active:scale-95 bg-surface-2"
                                >
                                    {item.type === 'IMAGE' ? (
                                        <img src={item.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="History" />
                                    ) : (
                                        <div className="w-full h-full bg-surface-2 flex items-center justify-center opacity-70 group-hover:opacity-100">
                                            <Video size={14} className="text-text" />
                                        </div>
                                    )}
                                    {item.metadata && (
                                        <div className="absolute top-1 right-1 bg-surface/90 px-1 py-0.5 rounded text-[9px] font-semibold text-accent border border-border backdrop-blur-sm">
                                            {item.metadata.provider.split(' ')[0]}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ToolGroup>
    );
};
