
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Radio, Flame, Brain, Code, History, Infinity, ArrowDown,
  Sparkles as SparklesIcon, Zap, Image as ImageIcon, Lock, Loader2
} from 'lucide-react';
import { ChatHistory } from './components/ChatHistory';
import { ModelPicker } from './components/ModelPicker';
import { ImageModelPicker } from './components/ImageModelPicker';
import { NeuralLinkOverlay } from './components/NeuralLinkOverlay';
import { ChatInput } from './components/ChatInput'; 
import { ChatWindow } from './components/ChatWindow'; 
import { VaultPinModal } from '../../components/VaultPinModal';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { useNavigationIntelligence } from '../../hooks/useNavigationIntelligence';
import { useFeatures } from '../../contexts/FeatureContext';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { debugService } from '../../services/debugService';

interface AIChatViewProps {
    chatLogic: any;
}

const PersonaToggle: React.FC<{ mode: 'hanisah' | 'stoic'; onToggle: () => void; }> = React.memo(({ mode, onToggle }) => {
    return (
        <button 
            onClick={onToggle}
            className={cn(
                'group relative flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-300 font-semibold',
                mode === 'hanisah'
                    ? 'bg-gradient-to-r from-[var(--accent)]/15 to-[var(--accent)]/5 border-[color:var(--accent)]/40 text-[var(--accent)]'
                    : 'bg-gradient-to-r from-[var(--accent-2)]/15 to-[var(--accent-2)]/5 border-[color:var(--accent-2)]/40 text-[var(--accent-2)]'
            )}
        >
            <div className={cn('w-2 h-2 rounded-full transition-all duration-300', mode === 'hanisah' ? 'bg-[var(--accent)]' : 'bg-[var(--accent-2)]')} />
            <span className="caption font-bold leading-none text-[13px]">{mode === 'hanisah' ? 'Hanisah' : 'Stoic'}</span>
            <div className="w-[1px] h-4 bg-current opacity-30 mx-0.5"></div>
            {mode === 'hanisah' ? <Flame size={14} strokeWidth={2.5} /> : <Brain size={14} strokeWidth={2.5} />}
        </button>
    );
});

const SuggestionCard: React.FC<{ icon: React.ReactNode, label: string, desc: string, onClick: () => void, tone?: string, delay?: number }> = React.memo(({ icon, label, desc, onClick, tone = "bento-blue", delay = 0 }) => (
    <Card
        as="button"
        interactive
        padding="bento"
        bento
        tone={tone as any}
        onClick={onClick}
        style={{ animationDelay: `${delay}ms` }}
        className="bento-card animate-slide-up"
    >
        <div className="bento-card-content flex items-center gap-4">
            <div className="bento-card-icon">
                {React.cloneElement(icon as React.ReactElement<any>, { size: 24, strokeWidth: 2.2 })}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="bento-card-title text-[15px]">{label}</h4>
                <p className="bento-card-description text-[13px] truncate">{desc}</p>
            </div>
            <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                <Code size={18} strokeWidth={2} />
            </div>
        </div>
    </Card>
));

const AIChatView: React.FC<AIChatViewProps> = ({ chatLogic }) => {
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false); 
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    
    const { isFeatureEnabled } = useFeatures();
    const isLiveLinkEnabled = isFeatureEnabled('LIVE_LINK');
    const { shouldShowNav } = useNavigationIntelligence();
    const isMobileNavVisible = shouldShowNav && window.innerWidth < 768; 

    const { threads, setThreads, activeThread, activeThreadId, setActiveThreadId, input, setInput, isLoading, activeModel, personaMode, handleNewChat, sendMessage, retryMessage, stopGeneration, togglePinThread, deleteThread, renameThread, isVaultSynced, setIsVaultSynced, isVaultConfigEnabled, setIsLiveModeActive, setGlobalModelId, generateWithPollinations, imageModelId, setImageModelId, isThreadsLoaded } = chatLogic;

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isAutoScrolling = useRef(true);
    const isStoic = personaMode === 'stoic';

    const { isLive, isMinimized, status: liveStatus, transcript: transcriptHistory, interimTranscript, startSession, stopSession, toggleMinimize, analyser, activeTool } = useLiveSession();

    useEffect(() => { if (setIsLiveModeActive) setIsLiveModeActive(isLive); }, [isLive, setIsLiveModeActive]);

    useEffect(() => {
        const root = document.documentElement;
        const updateViewport = () => {
            if (!window.visualViewport) {
                root.style.setProperty('--keyboard-offset', '0px');
                return;
            }
            const viewport = window.visualViewport;
            const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            root.style.setProperty('--keyboard-offset', `${offset}px`);
            
            // Prevent body scroll when keyboard is open
            if (offset > 0) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        };

        updateViewport();
        window.visualViewport?.addEventListener('resize', updateViewport);
        window.visualViewport?.addEventListener('scroll', updateViewport);

        return () => {
            window.visualViewport?.removeEventListener('resize', updateViewport);
            window.visualViewport?.removeEventListener('scroll', updateViewport);
            root.style.setProperty('--keyboard-offset', '0px');
            document.body.style.overflow = '';
        };
    }, []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            requestAnimationFrame(() => {
                messagesEndRef.current?.scrollIntoView({ behavior, block: 'nearest' });
            });
            isAutoScrolling.current = true;
            setShowScrollBtn(false);
        }
    }, []);

    if (!isThreadsLoaded) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-bg text-text animate-fade-in">
                <Loader2 size={32} className="animate-spin text-accent" />
                <span className="caption text-text-muted">Loading conversations...</span>
            </div>
        );
    }

    const handleVaultToggle = useCallback(() => {
        if (!isVaultConfigEnabled || isTransitioning) return;
        if (isVaultSynced) setIsVaultSynced(false); else setShowPinModal(true);
    }, [isVaultSynced, isTransitioning, setIsVaultSynced, isVaultConfigEnabled]);

    const changePersona = async () => {
        const target = personaMode === 'hanisah' ? 'stoic' : 'hanisah';
        setIsTransitioning(true);
        await handleNewChat(target);
        setTimeout(() => setIsTransitioning(false), 300);
    };

    const showEmptyState = !isLoading && (!activeThreadId || !activeThread || (activeThread.messages?.length || 0) <= 1);
    const isHydraActive = activeModel?.id === 'auto-best';

    return (
        <div className="min-app-dvh w-full relative bg-noise flex flex-col bg-[var(--bg)]" style={{ overscrollBehavior: 'contain', position: 'relative' }}>
            <VaultPinModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} onSuccess={() => setIsVaultSynced(true)} />
            
            <header className="shrink-0 z-50 pt-[calc(max(0.5rem,env(safe-area-inset-top)))] px-4 sm:px-5 md:px-6">
                <div className="mx-auto w-full max-w-[860px]">
                    <Card tone="bento-purple" padding="bento" bento className="bento-card shadow-[0_24px_90px_-60px_rgba(var(--accent-rgb),0.9)]">
                        <div className="bento-card-content">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-11 px-4 rounded-[var(--radius-md)] bg-white/10 hover:bg-white/20 border-white/20 text-white"
                                        onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_BTN_MODEL_PICKER, FN_REGISTRY.CHAT_SELECT_MODEL, 'OPEN'); setShowModelPicker(true); }}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${isHydraActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white'}`}>
                                                {isHydraActive ? <Infinity size={16} className="animate-pulse" strokeWidth={2.5} /> : <Zap size={16} strokeWidth={2.5} />}
                                            </span>
                                            <span className="caption font-semibold text-white">{isHydraActive ? 'Hydra' : (activeModel?.name?.split(' ')[0] || 'Model')}</span>
                                        </span>
                                    </Button>
                                    <PersonaToggle mode={personaMode} onToggle={changePersona} />
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-semibold border border-white/20">{isVaultSynced ? 'Vault sinkron' : 'Vault off'}</span>
                                        <span className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-semibold border border-white/20">{threads.length} sesi</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-10 w-10 p-0 rounded-[var(--radius-md)] text-white hover:bg-white/20"
                                        disabled={isStoic}
                                        onClick={() => !isStoic && setShowImagePicker(true)}
                                    >
                                        {isStoic ? <Lock size={18} strokeWidth={2.5} /> : <ImageIcon size={18} strokeWidth={2.5} />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-10 w-10 p-0 rounded-[var(--radius-md)] text-white hover:bg-white/20"
                                        onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_BTN_HISTORY, FN_REGISTRY.CHAT_LOAD_HISTORY, 'OPEN'); setShowHistoryDrawer(true); }}
                                    >
                                        <History size={18} strokeWidth={2.5} />
                                    </Button>
                                    <Button
                                        variant={isLive ? 'destructive' : 'ghost'}
                                        size="sm"
                                        className="h-10 w-10 p-0 rounded-[var(--radius-md)] text-white hover:bg-white/20"
                                        disabled={!isLiveLinkEnabled}
                                        onClick={() => { if (isLiveLinkEnabled) { isLive ? stopSession() : startSession(personaMode); } }}
                                    >
                                        <Radio size={18} strokeWidth={2.5} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll relative w-full max-w-[860px] mx-auto px-4 sm:px-5 md:px-6 pt-4">
                {showEmptyState ? (
                    <div className="flex flex-col h-full justify-center items-center w-full pb-20 animate-fade-in overflow-y-auto custom-scroll px-4 sm:px-6">
                            <div className="text-center mb-12 space-y-5">
                            <Card tone={personaMode === 'hanisah' ? "bento-orange" : "bento-teal"} padding="bento" bento className="bento-card inline-block">
                                <div className="bento-card-content">
                                    <div className="bento-card-icon mx-auto mb-4">
                                        {personaMode === 'hanisah' ? <Flame size={40} strokeWidth={1.5} /> : <Brain size={40} strokeWidth={1.5} />}
                                    </div>
                                    <h2 className="bento-card-title text-2xl md:text-3xl">{personaMode === 'hanisah' ? 'Hanisah' : 'Stoic'}</h2>
                                    <p className="bento-card-description mt-2 text-[15px]">{personaMode === 'hanisah' ? 'Percakapan natural, empatik & kreatif' : 'Analisis runtut, logis & objektif'}</p>
                                </div>
                            </Card>
                            </div>
                        <div className="w-full max-w-2xl mx-auto animate-slide-up relative z-20" style={{ animationDelay: '100ms' }}>
                            <ChatInput input={input} setInput={setInput} isLoading={isLoading} onSubmit={sendMessage} onStop={stopGeneration} onNewChat={() => handleNewChat(personaMode)} onFocusChange={() => {}} aiName={personaMode.toUpperCase()} isVaultSynced={isVaultSynced} onToggleVaultSync={handleVaultToggle} personaMode={personaMode} isVaultEnabled={isVaultConfigEnabled} onTogglePersona={changePersona} variant="hero" onPollinations={generateWithPollinations} disableVisuals={isStoic} />
                        </div>

                        <div className="bento-grid grid grid-cols-1 md:grid-cols-2 gap-[var(--bento-gap)] w-full max-w-2xl mx-auto mt-10">
                            {!isStoic ? <SuggestionCard icon={<SparklesIcon />} label="Buat Visual" desc="Buatkan gambar beresolusi tinggi." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'GEN_IMG'); setInput("Buatkan gambar pemandangan cinematic dengan pencahayaan hangat."); }} tone="bento-orange" delay={150} /> : <SuggestionCard icon={<Brain />} label="First Principles" desc="Urai masalah kompleks dari dasar." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'LOGIC'); setInput("Analisis masalah ini dengan first principles: [Masalah]"); }} tone="bento-teal" delay={150} />}
                            <SuggestionCard icon={<Code />} label="Code Audit" desc="Debug & optimalkan algoritma." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'CODE_AUDIT'); setInput("Analisis algoritma ini untuk kompleksitas: [Kode]"); }} tone="bento-green" delay={200} />
                        </div>
                    </div>
                ) : (
                    <ChatWindow 
                        key={activeThreadId || 'new'} 
                        messages={activeThread?.messages || []} 
                        personaMode={personaMode} 
                        isLoading={isLoading} 
                        messagesEndRef={messagesEndRef} 
                        onRetry={retryMessage}
                        onAtBottomChange={(atBottom) => setShowScrollBtn(!atBottom)}
                    />
                )}
            </div>
            {!showEmptyState && (
                <div
                    className={`shrink-0 z-50 w-full flex justify-center px-4 sm:px-5 md:px-6 transition-all duration-300 bg-[var(--bg)] ${isMobileNavVisible ? 'mb-16' : ''}`}
                    style={{ paddingBottom: 'calc(max(0.5rem, env(safe-area-inset-bottom)) + var(--keyboard-offset, 0px) + 1rem)' }}
                >
                    <div className="w-full max-w-[860px] pointer-events-auto relative">
                        {showScrollBtn && (
                            <button onClick={() => scrollToBottom()} className="absolute -top-20 right-0 md:right-4 z-20 w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] shadow-xl border border-[color:var(--accent)]/40 flex items-center justify-center text-white animate-bounce active:scale-90 transition-all duration-200">
                                <ArrowDown size={22} strokeWidth={2.5} />
                            </button>
                        )}
                        <ChatInput input={input} setInput={setInput} isLoading={isLoading} onSubmit={sendMessage} onStop={stopGeneration} onNewChat={() => handleNewChat(personaMode)} onFocusChange={() => {}} aiName={personaMode.toUpperCase()} isVaultSynced={isVaultSynced} onToggleVaultSync={handleVaultToggle} personaMode={personaMode} isVaultEnabled={isVaultConfigEnabled} onTogglePersona={changePersona} variant="standard" onPollinations={generateWithPollinations} disableVisuals={isStoic} />
                    </div>
                </div>
            )}

            <ModelPicker isOpen={showModelPicker} onClose={() => setShowModelPicker(false)} activeModelId={activeModel?.id || ''} onSelectModel={(id) => { setGlobalModelId(id); if (activeThreadId) setThreads((prev: any[]) => prev.map((t: any) => t.id === activeThreadId ? { ...t, model_id: id } : t)); setShowModelPicker(false); }} />
            <ImageModelPicker isOpen={showImagePicker} onClose={() => setShowImagePicker(false)} activeModelId={imageModelId || 'hydra'} onSelectModel={setImageModelId} />
            <ChatHistory isOpen={showHistoryDrawer} onClose={() => setShowHistoryDrawer(false)} threads={threads} activeThreadId={activeThreadId} onSelectThread={setActiveThreadId} onDeleteThread={deleteThread} onRenameThread={renameThread} onTogglePin={togglePinThread} onNewChat={() => handleNewChat(personaMode)} />
            <NeuralLinkOverlay isOpen={isLive && !isMinimized} status={liveStatus} personaMode={personaMode} transcriptHistory={transcriptHistory} interimTranscript={interimTranscript} onTerminate={stopSession} onMinimize={toggleMinimize} activeTool={activeTool} analyser={analyser} />
        </div>
    );
};

export default React.memo(AIChatView);
