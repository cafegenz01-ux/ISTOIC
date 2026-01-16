
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { editImage } from '../../../services/geminiService';
import { analyzeMultiModalMedia } from '../../../services/providerEngine';
import { 
    Camera, Layout, Trash2, X, Aperture, Image as ImageIcon, 
    AlertCircle, ScanEye, Mic, Copy, Volume2, Upload, 
    Maximize2, Wand2, RefreshCw, Layers, Box, Check, ArrowRight,
    Zap, Monitor
} from 'lucide-react';
import Markdown from 'react-markdown';
import { ToolGroup } from './ToolGroup';
import { useAIProvider } from '../../../hooks/useAIProvider';
import { VisualModelSelector, type ProviderGroup } from './VisualModelSelector';
import { UI_REGISTRY, FN_REGISTRY } from '../../../constants/registry';
import { debugService } from '../../../services/debugService';
import { speakWithHanisah } from '../../../services/elevenLabsService';
import { useGenerativeSession } from '../../../contexts/GenerativeSessionContext';
import { optimizeImageForAI } from '../../../utils/imageOptimizer';

interface NeuralVisionProps {
    isOpen: boolean;
    onToggle: () => void;
    icon: React.ReactNode;
}

const PROVIDERS: ProviderGroup[] = [
    { 
        id: 'GEMINI', 
        name: 'Google Gemini', 
        models: [
            { 
                id: 'gemini-3-flash-preview', 
                name: 'Gemini 3 Flash',
                description: 'Fastest multimodal analysis. Best for real-time.',
                tags: ['FREE', 'FAST'],
                specs: { speed: 'INSTANT', quality: 'STD' }
            },
            { 
                id: 'gemini-3-pro-preview', 
                name: 'Gemini 3 Pro',
                description: 'Deep reasoning on complex visual data.',
                tags: ['PRO', 'DEEP'],
                specs: { speed: 'FAST', quality: 'ULTRA' }
            }
        ]
    },
    { 
        id: 'GROQ', 
        name: 'Groq Llama', 
        models: [
            { 
                id: 'llama-3.2-90b-vision-preview', 
                name: 'Llama 3.2 90B',
                description: 'Open source vision model on LPU.',
                tags: ['OPEN', 'FAST'],
                specs: { speed: 'INSTANT', quality: 'HD' }
            }
        ]
    },
    { 
        id: 'OPENAI', 
        name: 'OpenAI', 
        models: [
            { 
                id: 'gpt-4o', 
                name: 'GPT-4o Omni',
                description: 'Industry standard for visual understanding.',
                tags: ['PRO', 'SMART'],
                specs: { speed: 'FAST', quality: 'ULTRA' }
            }
        ]
    }
];

export const NeuralVision: React.FC<NeuralVisionProps> = ({ isOpen, onToggle, icon }) => {
    // --- GLOBAL SESSION STATE ---
    const {
        visionPrompt: prompt, setVisionPrompt: setPrompt,
        visionResult: analysisResult, setVisionResult: setAnalysisResult,
        visionInputImage: inputBase64, setVisionInputImage: setInputBase64,
        visionInputType: inputType, setVisionInputType: setInputType,
        visionLoading: loading, setVisionLoading: setLoading,
        visionEditResult: editResult, setVisionEditResult: setEditResult,
        visionProvider: selectedProvider, setVisionProvider: setSelectedProvider,
        visionModel: selectedModel, setVisionModel: setSelectedModel,
    } = useGenerativeSession();

    // --- LOCAL STATE ---
    const [localStatus, setLocalStatus] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    
    // --- REFS ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { isHealthy, status: providerStatus } = useAIProvider(selectedProvider);

    // --- EFFECTS ---
    useEffect(() => {
        if (!loading) { setLocalStatus(null); return; }
        const msgs = loading === 'ANALYZE' 
            ? ["Analyzing image...", "Identifying details...", "Preparing response...", "Finalizing..."]
            : ["Uploading asset...", "Applying edits...", "Rendering preview...", "Finalizing..."];
        
        let i = 0;
        setLocalStatus(msgs[0]);
        const interval = setInterval(() => {
            i = (i + 1) % msgs.length;
            setLocalStatus(msgs[i]);
        }, 1500);
        return () => clearInterval(interval);
    }, [loading]);

    useEffect(() => {
        if (isCameraActive && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraActive]);

    // Cleanup camera on unmount or close
    useEffect(() => {
        return () => stopCamera();
    }, []);

    // --- HANDLERS ---

    const handleToggle = () => {
        debugService.logAction(UI_REGISTRY.TOOLS_BTN_TAB_VIS, FN_REGISTRY.NAVIGATE_TO_FEATURE, isOpen ? 'CLOSE' : 'OPEN');
        if (isCameraActive) stopCamera();
        onToggle();
    };

    const startCamera = async () => {
        debugService.logAction(UI_REGISTRY.TOOLS_VIS_BTN_CAMERA, FN_REGISTRY.TOOL_CAMERA_CAPTURE, 'INIT');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1920 } } 
            });
            streamRef.current = stream;
            setIsCameraActive(true);
            setAnalysisResult(null);
            setEditResult(null);
        } catch (err) {
            alert("Camera access denied or unavailable.");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    };

    const captureFrame = useCallback(() => {
        if (!videoRef.current) return;
        
        const video = videoRef.current;
        // High-res capture logic similar to optimizeImageForAI
        const MAX_DIM = 1280;
        let w = video.videoWidth;
        let h = video.videoHeight;
        
        if (w > h) { if (w > MAX_DIM) { h *= MAX_DIM / w; w = MAX_DIM; } }
        else { if (h > MAX_DIM) { w *= MAX_DIM / h; h = MAX_DIM; } }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            
            setInputBase64(dataUrl.split(',')[1]);
            setInputType('image/jpeg');
            stopCamera();
            
            debugService.logAction(UI_REGISTRY.TOOLS_VIS_BTN_CAMERA, FN_REGISTRY.TOOL_CAMERA_CAPTURE, 'CAPTURED');
        }
    }, [setInputBase64, setInputType]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            try {
                const optimized = await optimizeImageForAI(file);
                setInputBase64(optimized.base64);
                setInputType(optimized.mimeType);
                setAnalysisResult(null);
                setEditResult(null);
            } catch(err) {
                alert("Failed to process image.");
            }
        }
        e.target.value = ''; // Reset
    };

    const executeAnalysis = async () => {
        if (!inputBase64 || !inputType) return;
        if (!isHealthy) { setAnalysisResult(`ERROR: ${selectedProvider} OFFLINE`); return; }

        setLoading('ANALYZE');
        setAnalysisResult(null);
        setEditResult(null);

        try {
            debugService.logAction(UI_REGISTRY.TOOLS_VIS_BTN_UPLOAD, FN_REGISTRY.TOOL_ANALYZE_IMAGE, selectedModel);
            const res = await analyzeMultiModalMedia(
                selectedProvider, 
                selectedModel, 
                inputBase64, 
                inputType, 
                prompt || "Analyze this image in detail. Identify objects, text, and context."
            );
            setAnalysisResult(res);
        } catch (e: any) {
            setAnalysisResult(`Analysis Failed: ${e.message}`);
        } finally {
            setLoading(null);
        }
    };

    const executeEdit = async () => {
        if (!inputBase64 || !inputType || !prompt) {
            alert("Prompt required for editing.");
            return;
        }
        if (selectedProvider !== 'GEMINI') {
            alert("Editing currently only supported on Gemini models.");
            return;
        }

        setLoading('EDIT');
        setEditResult(null);
        setAnalysisResult(null);

        try {
            debugService.logAction(UI_REGISTRY.TOOLS_VIS_BTN_EDIT, FN_REGISTRY.TOOL_GENERATE_IMAGE, 'EDIT_IMG');
            const res = await editImage(inputBase64, inputType, prompt);
            setEditResult(res);
        } catch (e: any) {
            setAnalysisResult(`Edit Failed: ${e.message}`);
        } finally {
            setLoading(null);
        }
    };

    const handleSpeak = () => {
        if (analysisResult) {
            speakWithHanisah(analysisResult.replace(/[*#_`]/g, ''));
        }
    };

    const handleCopy = () => {
        if (analysisResult) {
            navigator.clipboard.writeText(analysisResult);
        }
    };

    const clearAll = () => {
        setInputBase64(null);
        setAnalysisResult(null);
        setEditResult(null);
        setPrompt('');
        if (isCameraActive) stopCamera();
    };

    // --- UI RENDER ---
    return (
        <ToolGroup 
            title="Vision analysis" 
            icon={icon} 
            subtitle="Analyze and edit images" 
            isOpen={isOpen} 
            onToggle={handleToggle} 
            isLoading={!!loading} 
            loadingText={localStatus || ''}
        >
            <div className="flex flex-col h-full bg-surface text-text font-sans relative overflow-hidden">
                
                {/* 1. TOP BAR: SETTINGS & STATUS */}
                <div className="p-4 md:p-6 border-b border-border/70 bg-surface-2/50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center relative z-20 shadow-[var(--shadow-soft)]">
                    <div className="flex-1 w-full md:w-auto">
                        <VisualModelSelector 
                            label="Model"
                            selectedProviderId={selectedProvider}
                            selectedModelId={selectedModel}
                            providers={PROVIDERS}
                            onSelect={(p, m) => { setSelectedProvider(p); setSelectedModel(m); }}
                            disabled={!!loading}
                        />
                    </div>
                    
                    <div className="flex items-center gap-3">
                         <div className={`px-3 py-1 rounded-lg border caption font-semibold flex items-center gap-2 ${isHealthy ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                              {providerStatus}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleToggle(); }} className="p-2 hover:bg-surface rounded-full transition-colors text-text-muted hover:text-text">
                              <X size={18} />
                          </button>
                    </div>
                </div>

                {/* 2. MAIN WORKSPACE */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                    
                    {/* LEFT: VISUAL INPUT (CAMERA / IMAGE) */}
                    <div className="lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-border/70 relative bg-surface-2/30">
                        
                        <div 
                            className={`flex-1 relative flex items-center justify-center overflow-hidden transition-all p-4 md:p-8 
                                ${isDragOver ? 'bg-accent/5 ring-2 ring-inset ring-accent/50' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => { 
                                e.preventDefault(); setIsDragOver(false); 
                                if(e.dataTransfer.files[0]) handleFileSelect({ target: { files: e.dataTransfer.files } } as any); 
                            }}
                        >
                            {/* A. CAMERA MODE */}
                            {isCameraActive ? (
                                <div className="relative w-full h-full max-h-[600px] bg-black rounded-[24px] overflow-hidden border border-border shadow-2xl group">
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                    
                                    {/* HUD Overlay */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute top-4 left-4 flex gap-2">
                                            <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-[11px] font-semibold border border-red-500/30">Live</span>
                                            <span className="px-2 py-0.5 bg-black/50 text-white text-[9px] font-mono border border-white/10">1080p_HQ</span>
                                        </div>
                                        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/20"></div>
                                        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/20"></div>
                                        <div className="absolute inset-0 border-[40px] border-black/10"></div>
                                        {/* Scanner Line */}
                                        <div className="absolute top-0 left-0 w-full h-1 bg-accent/50 shadow-[0_0_15px_var(--accent-glow)] animate-scan"></div>
                                    </div>

                                    {/* Capture Controls */}
                                    <div className="absolute bottom-6 inset-x-0 flex justify-center items-center gap-6 z-20 pointer-events-auto">
                                        <button onClick={stopCamera} className="p-3 bg-white/10 hover:bg-red-500/20 text-white hover:text-red-500 rounded-full backdrop-blur-md transition-all"><X size={24}/></button>
                                        <button onClick={captureFrame} className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center group-active:scale-95 transition-all">
                                            <div className="w-16 h-16 bg-white rounded-full shadow-[0_0_20px_white]"></div>
                                        </button>
                                    </div>
                                </div>
                            ) : inputBase64 ? (
                                /* B. IMAGE PREVIEW MODE */
                                <div className="relative w-full h-full flex flex-col items-center justify-center animate-fade-in group">
                                    <div className="relative max-w-full max-h-full rounded-[24px] overflow-hidden border border-border shadow-2xl">
                                        <img 
                                            src={`data:${inputType};base64,${inputBase64}`} 
                                            alt="Analysis Target" 
                                            className="w-full h-full object-contain max-h-[60vh] lg:max-h-[70vh]"
                                        />
                                        {/* Delete Overlay */}
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={clearAll} className="p-2 bg-black/60 backdrop-blur text-white hover:text-red-500 rounded-lg border border-white/10 hover:border-red-500/50 transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded-lg border border-white/10 text-[11px] font-semibold text-white/70">
                                        Source locked
                                    </div>
                                </div>
                            ) : (
                                /* C. EMPTY STATE / DROPZONE */
                                <div className="text-center space-y-6 max-w-sm">
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-24 h-24 mx-auto rounded-[32px] bg-surface border border-border flex items-center justify-center text-text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/5 cursor-pointer transition-all duration-500 group shadow-inner"
                                    >
                                        <Upload size={32} className="group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div>
                                        <h3 className="section-title text-text mb-2">Add an image</h3>
                                        <p className="body-sm text-text-muted">
                                            Upload an image for analysis or editing. Supports JPG, PNG, and WEBP.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 justify-center">
                                        <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-accent text-text-invert hover:opacity-90 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg">
                                            Upload file
                                        </button>
                                        <button onClick={startCamera} className="px-5 py-2.5 bg-surface-2 text-text hover:bg-surface rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border border-border">
                                            <Camera size={14} /> Camera
                                        </button>
                                    </div>
                                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: CONTROL & OUTPUT */}
                    <div className="lg:w-1/2 flex flex-col bg-surface border-l border-border/70">
                        
                        {/* 1. CONTROLS */}
                        <div className="p-6 border-b border-border/70 space-y-4 shrink-0 bg-surface-2/40 shadow-[var(--shadow-soft)]">
                            <div className="relative">
                                <div className="absolute top-0 left-0 px-2 py-1 bg-surface-2 rounded-br-lg border-r border-b border-border caption text-text-muted">
                                    Prompt
                                </div>
                                <textarea 
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe what you want to know or change..."
                                    className="w-full h-24 bg-surface-2/50 border border-border rounded-2xl p-4 pt-8 text-sm text-text focus:border-accent/50 focus:outline-none resize-none placeholder:text-text-muted transition-all font-medium"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={executeAnalysis}
                                    disabled={!inputBase64 || !!loading}
                                    className={`
                                        flex-1 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all
                                        ${!inputBase64 || loading 
                                            ? 'bg-surface-2 text-text-muted cursor-not-allowed border border-border' 
                                            : 'bg-accent text-text-invert shadow-sm hover:scale-[1.01] active:scale-95'
                                        }
                                    `}
                                >
                                    <ScanEye size={16} /> Analyze
                                </button>
                                <button 
                                    onClick={executeEdit}
                                    disabled={!inputBase64 || !prompt || !!loading || selectedProvider !== 'GEMINI'}
                                    className={`
                                        flex-1 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border
                                        ${!inputBase64 || !prompt || loading || selectedProvider !== 'GEMINI'
                                            ? 'bg-transparent border-border text-text-muted cursor-not-allowed' 
                                            : 'bg-surface-2 border-border text-text hover:bg-surface hover:border-accent/50 hover:text-accent'
                                        }
                                    `}
                                    title={selectedProvider !== 'GEMINI' ? "Switch to Gemini for Editing" : "Modify Image"}
                                >
                                    <Wand2 size={16} /> Edit
                                </button>
                            </div>
                        </div>

                        {/* 2. OUTPUT LOG */}
                        <div className="flex-1 overflow-y-auto custom-scroll p-6 relative">
                            {/* Placeholder */}
                            {!analysisResult && !editResult && !loading && (
                                <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-40 gap-3">
                                    <Monitor size={32} strokeWidth={1} />
                                    <p className="caption">Waiting for input</p>
                                </div>
                            )}

                            {/* Text Result */}
                            {analysisResult && (
                                <div className="space-y-4 animate-slide-up">
                                    <div className="flex items-center justify-between">
                                        <h4 className="caption font-semibold text-accent flex items-center gap-2">
                                            <Aperture size={12}/> Analysis report
                                        </h4>
                                        <div className="flex gap-2">
                                            <button onClick={handleSpeak} className="p-1.5 hover:bg-surface-2 rounded-lg text-text-muted hover:text-text transition-colors"><Volume2 size={14}/></button>
                                            <button onClick={handleCopy} className="p-1.5 hover:bg-surface-2 rounded-lg text-text-muted hover:text-text transition-colors"><Copy size={14}/></button>
                                        </div>
                                    </div>
                                    <div className="prose dark:prose-invert prose-sm max-w-none text-text font-medium text-xs leading-loose p-4 bg-surface-2 rounded-2xl border border-border">
                                        <Markdown>{analysisResult}</Markdown>
                                    </div>
                                </div>
                            )}

                            {/* Edit Result */}
                            {editResult && (
                                <div className="space-y-4 animate-slide-up">
                                    <h4 className="caption font-semibold text-accent flex items-center gap-2">
                                        <Layers size={12}/> Edited image
                                    </h4>
                                    <div className="rounded-2xl overflow-hidden border border-border shadow-xl bg-black">
                                        <img src={editResult} alt="Edit Result" className="w-full h-auto" />
                                    </div>
                                    <a href={editResult} download="edited_image.png" className="block w-full py-3 text-center bg-surface-2 hover:bg-surface rounded-xl text-sm font-semibold text-text transition-all">
                                        Download image
                                    </a>
                                </div>
                            )}

                            {/* Loading Overlay */}
                            {loading && (
                                <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-6 animate-fade-in">
                                    <div className="w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                                    <div className="text-center">
                                        <p className="caption font-semibold text-accent animate-pulse">{localStatus}</p>
                                        <p className="caption text-text-muted mt-1">Processing request</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
            <style>{`
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan { animation: scan 2s linear infinite; }
            `}</style>
        </ToolGroup>
    );
};
