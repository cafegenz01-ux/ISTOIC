
import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Sparkles, Cpu, Zap, Globe, Layers, Brain, Activity, 
    Box, Wind, Gauge, Database, CircuitBoard, CheckCircle2,
    AlertTriangle, Server, Network, Lock, Info, ChevronRight, Sliders
} from 'lucide-react';
import { MODEL_CATALOG } from '../../../services/melsaKernel';
import { KEY_MANAGER, type ProviderStatus } from '../../../services/geminiService';
import { useFeatures } from '../../../contexts/FeatureContext'; 

interface ModelPickerProps {
  isOpen: boolean;
  onClose: () => void;
  activeModelId: string;
  onSelectModel: (id: string) => void;
}

const TechStatBar: React.FC<{ label: string; value: number; max: number; color: string }> = React.memo(({ label, value, max, color }) => {
    const segments = 12;
    const filledSegments = Math.round((value / max) * segments);
    
    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between items-center">
                <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest">{label}</span>
                <span className={`text-[8px] font-mono font-bold ${color}`}>{value}/{max}</span>
            </div>
            <div className="flex gap-0.5 h-1.5">
                {Array.from({ length: segments }).map((_, i) => (
                    <div 
                        key={i} 
                        className={`flex-1 rounded-[1px] transition-all duration-500 ${
                            i < filledSegments ? color.replace('text-', 'bg-') : 'bg-white/5'
                        } ${i < filledSegments ? 'shadow-[0_0_5px_currentColor]' : ''}`}
                    />
                ))}
            </div>
        </div>
    );
});

const StatusBadge: React.FC<{ status: 'HEALTHY' | 'COOLDOWN' | 'OFFLINE'; cooldown?: number }> = React.memo(({ status, cooldown }) => {
    if (status === 'HEALTHY') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/5 border border-emerald-500/20 text-emerald-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_currentColor]"></div>
                <span className="text-[7px] font-black uppercase tracking-wider">ONLINE</span>
            </div>
        );
    }
    if (status === 'COOLDOWN') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/5 border border-amber-500/20 text-amber-500">
                <AlertTriangle size={8} />
                <span className="text-[7px] font-black uppercase tracking-wider">COOLING ({cooldown}m)</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/5 border border-red-500/20 text-red-500">
            <Lock size={8} />
            <span className="text-[7px] font-black uppercase tracking-wider">OFFLINE</span>
        </div>
    );
});

export const ModelPicker: React.FC<ModelPickerProps> = ({
  isOpen,
  onClose,
  activeModelId,
  onSelectModel
}) => {
  const [activeTab, setActiveTab] = useState<'AUTO' | 'GOOGLE' | 'OPENAI' | 'GROQ' | 'DEEPSEEK' | 'MISTRAL'>('AUTO');
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const { features } = useFeatures(); 
  const [visibleTabs, setVisibleTabs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Status and Tab initialization
  useEffect(() => {
      if (isOpen) {
          const update = () => setStatuses(KEY_MANAGER.getAllProviderStatuses());
          update();
          
          let visibility: Record<string, boolean> = {};
          try {
              const stored = localStorage.getItem('provider_visibility');
              if (stored) visibility = JSON.parse(stored);
          } catch(e) {}

          const isVisible = (providerId: string) => visibility[providerId] !== false;

          const tabsToShow = ['AUTO'];
          if (isVisible('GEMINI')) tabsToShow.push('GOOGLE');
          if (isVisible('MISTRAL')) tabsToShow.push('MISTRAL');
          if (isVisible('GROQ')) tabsToShow.push('GROQ');
          if (isVisible('OPENAI')) tabsToShow.push('OPENAI');
          if (isVisible('DEEPSEEK')) tabsToShow.push('DEEPSEEK');
          
          setVisibleTabs(tabsToShow);

          if (!tabsToShow.includes(activeTab)) {
              setActiveTab(tabsToShow[0] as any);
          }

          let interval: any = null;
          if (features.AUTO_DIAGNOSTICS) {
              interval = setInterval(update, 2000);
          }
          
          return () => {
              if (interval) clearInterval(interval);
          };
      }
  }, [isOpen, features.AUTO_DIAGNOSTICS]);

  const tabs = {
    'AUTO': {
        icon: <CircuitBoard size={16}/>,
        label: 'AUTO',
        sub: 'OMNI-RACE',
        desc: 'Parallel execution. The fastest engine wins.',
        accent: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        models: MODEL_CATALOG.filter(m => m.id === 'auto-best')
    },
    'GOOGLE': { 
        icon: <Sparkles size={16}/>, 
        label: 'GEMINI', 
        sub: 'GOOGLE',
        desc: 'Native Multimodal Context Windows (2M+ Tokens).',
        accent: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        models: MODEL_CATALOG.filter(m => m.provider === 'GEMINI' && m.id !== 'auto-best') 
    },
    'MISTRAL': { 
        icon: <Wind size={16}/>, 
        label: 'MISTRAL', 
        sub: 'FRENCH AI',
        desc: 'Top-tier open weights models from France.',
        accent: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        models: MODEL_CATALOG.filter(m => m.provider === 'MISTRAL') 
    },
    'GROQ': { 
        icon: <Zap size={16}/>, 
        label: 'GROQ', 
        sub: 'LPU SPEED',
        desc: 'Ultra-Low Latency Inference running Llama.',
        accent: 'text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
        models: MODEL_CATALOG.filter(m => m.provider === 'GROQ') 
    },
    'OPENAI': { 
        icon: <Cpu size={16}/>, 
        label: 'OPENAI', 
        sub: 'STANDARD',
        desc: 'Industry standard models (GPT-4o).',
        accent: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        models: MODEL_CATALOG.filter(m => m.provider === 'OPENAI') 
    },
    'DEEPSEEK': { 
        icon: <Brain size={16}/>, 
        label: 'DEEPSEEK', 
        sub: 'REASONING',
        desc: 'Advanced reasoning (R1) and coding.',
        accent: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/20',
        models: MODEL_CATALOG.filter(m => m.provider === 'DEEPSEEK') 
    }
  };

  const currentTab = tabs[activeTab];

  // Prevent scroll propagation
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-0 md:p-4 font-sans h-full overflow-hidden">
      {/* Backdrop with Hardware Acceleration */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-fade-in transform-gpu" 
        onClick={onClose}
      />

      {/* Main Card with Premium Animation */}
      <div 
        className="relative z-10 w-full md:max-w-5xl h-[92vh] md:h-[85vh] bg-[#050505] rounded-t-[32px] md:rounded-[24px] border-t md:border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden ring-1 ring-white/5 animate-slide-up transform-gpu transition-all duration-300 ease-out"
        style={{ willChange: 'transform, opacity' }}
      >
        
        {/* Header */}
        <div className="h-16 md:h-14 border-b border-white/5 bg-white/[0.02] flex items-center justify-between px-6 shrink-0 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 shadow-inner">
                    <Layers size={16} className="text-white" />
                </div>
                <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white leading-none">
                        MODEL_SELECTION
                    </h3>
                    <p className="text-[8px] text-neutral-500 font-mono uppercase tracking-widest mt-1">
                        Architecture Selection
                    </p>
                </div>
            </div>
            <button 
                onClick={onClose} 
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all border border-white/5 active:scale-95"
            >
                <X size={16} />
            </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-[#08080a] border-b md:border-b-0 md:border-r border-white/5 flex flex-row md:flex-col p-2 gap-1 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
                {visibleTabs.map((key) => {
                    const data = tabs[key as keyof typeof tabs];
                    const isActive = activeTab === key;
                    const providerId = data.models[0]?.provider || 'UNKNOWN';
                    const status = statuses.find(s => s.id === providerId);
                    
                    const isHealthy = key === 'AUTO' ? features.OMNI_RACE : status?.status === 'HEALTHY';
                    const isDisabled = key === 'AUTO' && !features.OMNI_RACE;

                    return (
                        <button
                            key={key}
                            onClick={() => !isDisabled && setActiveTab(key as any)}
                            disabled={isDisabled}
                            className={`
                                relative p-3 rounded-xl flex md:w-full items-center gap-3 transition-all duration-200 group overflow-hidden border shrink-0 active:scale-95
                                ${isActive 
                                    ? 'bg-white/5 border-white/10 shadow-inner' 
                                    : 'bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/5'
                                }
                                ${isDisabled ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                            `}
                        >
                            {isActive && <div className={`absolute left-0 bottom-0 md:top-0 md:bottom-0 h-0.5 md:h-auto md:w-0.5 w-full ${data.bg.replace('/10', '')} shadow-[0_0_10px_currentColor]`}></div>}

                            <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0
                                ${isActive ? `${data.bg} ${data.accent} shadow-[0_0_15px_rgba(0,0,0,0.5)]` : 'bg-white/5 text-neutral-500 group-hover:text-white'}
                            `}>
                                {data.icon}
                            </div>
                            
                            <div className="text-left flex-1 min-w-0 hidden md:block">
                                <div className="flex items-center justify-between">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-white'}`}>
                                        {data.label}
                                    </span>
                                    {key !== 'AUTO' && (
                                        <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'} ${isHealthy ? 'shadow-[0_0_5px_#10b981]' : ''}`}></div>
                                    )}
                                </div>
                                <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-wide group-hover:text-neutral-500 truncate block">
                                    {data.sub}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-[#09090b] relative flex flex-col min-h-0">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
                
                {/* Description Header */}
                <div className="p-6 md:p-8 pb-4 shrink-0 relative z-10">
                    <div className="flex items-end justify-between mb-2">
                        <h2 className={`text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-white drop-shadow-md`}>
                            {currentTab.label} <span className={`text-transparent bg-clip-text bg-gradient-to-r from-white to-white/20 text-xl md:text-2xl not-italic tracking-widest opacity-50`}>// MODULE</span>
                        </h2>
                    </div>
                    <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-[0.2em] border-l-2 border-white/10 pl-3 leading-relaxed max-w-lg">
                        {currentTab.desc}
                    </p>
                </div>

                {/* Model Grid */}
                <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-8 pt-0 relative z-10 pb-20">
                    <div className="grid grid-cols-1 gap-4">
                        {currentTab.models.map(model => (
                            <ArchitectureCard 
                                key={model.id} 
                                model={model} 
                                isActive={model.id === activeModelId} 
                                onClick={() => { onSelectModel(model.id); }} 
                                accent={currentTab.accent}
                                statuses={statuses}
                            />
                        ))}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="h-10 border-t border-white/5 bg-black/40 backdrop-blur-md flex items-center px-6 justify-between shrink-0 absolute bottom-0 left-0 right-0 z-20">
                    <div className="flex items-center gap-2 text-[8px] font-mono text-neutral-600 uppercase tracking-widest">
                        <Network size={10} />
                        <span>Latency: {statuses.find(s => s.id === currentTab.models[0]?.provider)?.status === 'HEALTHY' ? 'OPTIMAL' : 'DEGRADED'}</span>
                    </div>
                    <div className="text-[8px] font-mono text-neutral-700 uppercase tracking-widest hidden md:block">
                        {currentTab.models.length} MODELS AVAILABLE
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const ArchitectureCard: React.FC<{ 
    model: any, 
    isActive: boolean, 
    onClick: () => void,
    accent: string,
    statuses: ProviderStatus[]
}> = React.memo(({ model, isActive, onClick, accent, statuses }) => {
  
  const isAuto = model.id === 'auto-best';
  const providerStatus = statuses.find(s => s.id === model.provider);
  const statusType = isAuto ? 'HEALTHY' : (providerStatus?.status || 'OFFLINE');
  
  const accentColorClass = isActive ? accent : 'text-neutral-500';
  const borderColorClass = isActive ? `border-${accent.split('-')[1]}-500/50` : 'border-white/5';
  
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full text-left transition-all duration-300 group overflow-hidden
        rounded-[20px] border p-[1px] active:scale-[0.99]
        ${isActive ? 'bg-white/[0.03]' : 'bg-transparent hover:bg-white/[0.01]'}
        ${isActive ? borderColorClass : 'hover:border-white/10'}
      `}
    >
        <div className="bg-[#0c0c0e] rounded-[19px] p-5 relative z-10 h-full flex flex-col md:flex-row gap-6">
            
            {isActive && <div className={`absolute inset-0 bg-${accent.split('-')[1]}-500/5 opacity-[0.03] pointer-events-none`}></div>}
            
            <div className="flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={`text-base md:text-lg font-black uppercase tracking-tight ${isActive ? 'text-white' : 'text-neutral-300 group-hover:text-white'} transition-colors`}>
                            {model.name}
                        </span>
                        {isAuto && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-black tracking-widest uppercase animate-pulse">
                                OMNI-RACE
                            </span>
                        )}
                        {isActive && (
                            <div className={`px-2 py-0.5 rounded bg-white/10 border border-white/10 text-[8px] font-bold uppercase tracking-wider text-white flex items-center gap-1`}>
                                <CheckCircle2 size={10} className={accent} /> ACTIVE
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-neutral-500 font-medium leading-relaxed pr-4 line-clamp-2 group-hover:text-neutral-400 transition-colors">
                        {model.description}
                    </p>
                </div>

                <div className="flex items-center gap-3 mt-4 flex-wrap">
                    <StatusBadge status={statusType as any} cooldown={providerStatus?.cooldownRemaining} />
                    
                    {model.specs.context !== 'AUTO' && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5 text-neutral-400">
                            <Database size={10} />
                            <span className="text-[7px] font-black uppercase tracking-wider">{model.specs.context} CTX</span>
                        </div>
                    )}
                    
                    {model.specs.speed === 'THINKING' && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">
                            <Brain size={10} />
                            <span className="text-[7px] font-black uppercase tracking-wider">REASONING</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full md:w-48 shrink-0 flex flex-row md:flex-col justify-between md:justify-center gap-4 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                <div className="flex-1 md:w-full">
                    <TechStatBar 
                        label="INTELLIGENCE" 
                        value={model.specs.intelligence} 
                        max={10} 
                        color={model.specs.intelligence >= 9.5 ? 'text-purple-400' : 'text-blue-400'} 
                    />
                </div>
                
                <div className="flex flex-col gap-1 items-end md:items-start">
                    <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest">VELOCITY</span>
                    <div className="flex items-center gap-2">
                        <Gauge size={12} className={model.specs.speed === 'INSTANT' ? 'text-yellow-400' : 'text-neutral-400'} />
                        <span className={`text-[9px] font-black uppercase ${model.specs.speed === 'INSTANT' ? 'text-yellow-400' : 'text-neutral-300'}`}>
                            {model.specs.speed}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </button>
  );
});
