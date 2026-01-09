
import React, { useState, useEffect, memo } from 'react';
import { type FeatureID, FEATURES } from '../constants';
import useLocalStorage from '../hooks/useLocalStorage';
import { Settings, Flame, Cpu, Activity, AlertTriangle, PanelLeftClose, ChevronRight, Command, PanelLeft } from 'lucide-react';
import { useNavigationIntelligence } from '../hooks/useNavigationIntelligence';
import { getText } from '../services/i18n';
import { debugService } from '../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../constants/registry';
import { useFeatures } from '../contexts/FeatureContext';

interface SidebarProps {
  activeFeature: FeatureID;
  setActiveFeature: (feature: FeatureID) => void;
  chatLogic: any;
}

export const Sidebar: React.FC<SidebarProps> = memo(({ activeFeature, setActiveFeature }) => {
  const [personaMode] = useLocalStorage<'hanisah' | 'stoic'>('ai_persona_mode', 'hanisah');
  
  // Persistent Expansion State
  const [isExpanded, setIsExpanded] = useLocalStorage<boolean>('sidebar_expanded', false);
  
  const { isForcedStealth } = useNavigationIntelligence();
  const { features } = useFeatures();
  
  const [healthScore, setHealthScore] = useState(100);
  const [healthColor, setHealthColor] = useState('bg-emerald-500');
  
  // UI Matrix State
  const [uiMatrix, setUiMatrix] = useState<Record<string, any>>(debugService.getUIMatrix());

  // KEYBOARD SHORTCUT: Ctrl+B to Toggle Sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            setIsExpanded(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsExpanded]);

  useEffect(() => {
      if (!features.AUTO_DIAGNOSTICS) {
          setHealthScore(0);
          setHealthColor('bg-neutral-600');
          return;
      }

      const checkHealth = () => {
          const stats = debugService.getSystemHealth();
          let score = 100;
          if (stats.avgLatency > 500) score -= 10;
          if (stats.avgLatency > 1500) score -= 20;
          score -= (stats.errorCount * 5);
          if (stats.memoryMb && stats.memoryMb > 500) score -= 10;
          score = Math.max(0, Math.min(100, score));
          
          setHealthScore(score);
          if (score >= 80) setHealthColor('bg-emerald-500 shadow-[0_0_15px_#10b981]');
          else if (score >= 50) setHealthColor('bg-amber-500 shadow-[0_0_15px_#f59e0b]');
          else setHealthColor('bg-red-500 shadow-[0_0_15px_#ef4444]');
      };

      checkHealth();
      const interval = setInterval(checkHealth, 3000);
      const unsubscribe = debugService.subscribeUI((state) => setUiMatrix(state));
      
      return () => { 
          clearInterval(interval);
          unsubscribe(); 
      };
  }, [features.AUTO_DIAGNOSTICS]);
  
  const getLabel = (id: string) => {
      const keyMap: Record<string, string> = {
          dashboard: 'dashboard',
          notes: 'notes',
          chat: 'chat',
          tools: 'tools',
          system: 'system',
          settings: 'settings',
          raw: 'raw'
      };
      const transKey = keyMap[id];
      if (id === 'raw') return "RAW_MODE";
      return transKey ? getText('sidebar', transKey) : id.toUpperCase();
  };

  const handleNavClick = (id: FeatureID, uiId: string) => {
      if (debugService.logAction(uiId as any, FN_REGISTRY.NAVIGATE_TO_FEATURE, id)) {
          setActiveFeature(id);
      }
  };

  return (
    <>
      {/* 1. DYNAMIC SPACER (Invisible but crucial for layout flow) */}
      <div 
        className={`
            hidden md:block h-full flex-none shrink-0 
            transition-[width] duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)
            ${isExpanded ? 'w-[280px]' : 'w-[88px]'}
        `} 
      />

      {/* 2. THE DOCK (Floating Rail) */}
      <aside 
        className={`
          hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-[1200] 
          /* VISUALS: Glassmorphism & Borders */
          bg-skin-card/90 backdrop-blur-2xl 
          border-r border-skin-border
          /* MOTION: Hyper-smooth Bezier */
          transition-[width,transform,opacity,box-shadow] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
          ${isExpanded ? 'w-[280px] shadow-[20px_0_50px_-10px_rgba(0,0,0,0.15)] dark:shadow-[20px_0_50px_-10px_rgba(0,0,0,0.4)]' : 'w-[88px]'}
          ${isForcedStealth ? 'opacity-0 pointer-events-none -translate-x-10' : 'opacity-100 translate-x-0'}
        `}
        aria-label="Main Navigation"
      >
        <div className="flex flex-col h-full w-full overflow-hidden py-6 pt-safe pb-safe relative">
          
          {/* Ambient Glow Gradient (Subtle top light) */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />

          {/* === LOGO & BRANDING === */}
          <div className={`px-6 mb-8 transition-all duration-500 flex flex-col relative z-10 ${isExpanded ? 'items-start' : 'items-center'}`}>
              <div className="flex items-center justify-between w-full">
                  <button 
                    onClick={() => handleNavClick('dashboard', UI_REGISTRY.SIDEBAR_BTN_LOGO)}
                    className="relative group outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-[18px] transition-all"
                    title="Dashboard"
                  >
                    <div className={`
                      shrink-0 w-11 h-11 rounded-[18px] flex items-center justify-center 
                      bg-gradient-to-br from-skin-card to-skin-surface
                      border border-skin-border
                      shadow-sm group-hover:shadow-[0_0_25px_var(--accent-glow)] group-hover:border-accent/40
                      transition-all duration-300 transform group-hover:scale-105
                    `}>
                      <div className={`text-skin-text transition-colors duration-300 group-hover:text-accent`}>
                          {personaMode === 'hanisah' ? <Flame size={22} strokeWidth={2.5} /> : <Cpu size={22} strokeWidth={2.5} />}
                      </div>
                    </div>
                  </button>

                  {/* Collapse Button (Only visible when expanded) */}
                  <div className={`transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      <button 
                        onClick={() => setIsExpanded(false)}
                        className="p-2 rounded-xl text-skin-muted hover:text-skin-text hover:bg-skin-surface active:scale-90 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                          <PanelLeftClose size={18} />
                      </button>
                  </div>
              </div>

              {/* Expand Button (Only visible when collapsed) */}
              <div className={`absolute top-0 right-0 left-0 flex justify-center transition-all duration-300 ${!isExpanded ? 'opacity-100 translate-y-14' : 'opacity-0 pointer-events-none translate-y-10'}`}>
                   <button 
                    onClick={() => setIsExpanded(true)}
                    className="p-2 rounded-xl text-skin-muted hover:text-accent hover:bg-accent/5 active:scale-90 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                      <PanelLeft size={20} strokeWidth={2} />
                  </button>
              </div>

              {/* Branding Text */}
              <div className={`mt-5 overflow-hidden whitespace-nowrap transition-all duration-500 ease-out flex flex-col ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                  <h1 className="text-lg font-black tracking-tighter text-skin-text leading-none uppercase flex items-center gap-2">
                    ISTOIC <span className="text-accent">TITANIUM</span> 
                  </h1>
                  <p className="text-[9px] font-mono text-skin-muted mt-1.5 flex items-center gap-1.5 opacity-70">
                    <Command size={10} /> + B TO TOGGLE
                  </p>
              </div>
          </div>

          {/* === NAVIGATION LINKS === */}
          <nav className="flex-1 flex flex-col gap-1.5 px-3 w-full relative z-10" aria-label="Feature Links">
            {FEATURES.map((feature) => {
              const isActive = activeFeature === feature.id;
              const label = getLabel(feature.id);
              const uiId = (UI_REGISTRY as any)[`SIDEBAR_BTN_${feature.id.toUpperCase()}`] || UI_REGISTRY.SIDEBAR_BTN_DASHBOARD;
              const isDisabled = uiMatrix[uiId]?.status === 'DISABLED';

              return (
                <button
                  key={feature.id}
                  onClick={() => !isDisabled && handleNavClick(feature.id as FeatureID, uiId)}
                  disabled={isDisabled}
                  className={`
                    relative flex items-center rounded-[18px] transition-all duration-300 group outline-none
                    ${isExpanded ? 'w-full px-4 py-3.5 gap-4' : 'w-12 h-12 justify-center mx-auto aspect-square'}
                    ${isDisabled 
                        ? 'opacity-40 cursor-not-allowed grayscale' 
                        : isActive 
                            ? 'bg-gradient-to-r from-accent/10 via-accent/5 to-transparent border-l-2 border-accent text-accent' 
                            : 'hover:bg-skin-surface text-skin-muted hover:text-skin-text border-l-2 border-transparent'
                    }
                    focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50
                  `}
                  title={!isExpanded ? label : undefined}
                >
                  {/* Active Glow Backdrop */}
                  {isActive && !isDisabled && (
                      <div className="absolute inset-0 bg-accent/5 blur-md rounded-[18px] opacity-50"></div>
                  )}

                  <div className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-105' : 'group-hover:scale-110 group-active:scale-95'}`}>
                    {isDisabled 
                        ? <AlertTriangle size={20} className="text-red-500" /> 
                        : React.cloneElement(feature.icon as React.ReactElement<any>, { 
                            size: 22, 
                            strokeWidth: isActive ? 2.5 : 2,
                            className: isActive ? 'drop-shadow-sm' : ''
                        })
                    }
                  </div>

                  {/* Label with Staggered Fade */}
                  <div className={`
                    overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] 
                    flex-1 flex justify-between items-center
                    ${isExpanded ? 'opacity-100 max-w-full pl-1 translate-x-0' : 'opacity-0 max-w-0 -translate-x-2'}
                  `}>
                    <span className={`text-[11px] font-bold tracking-[0.15em] uppercase ${isDisabled ? 'text-red-500 line-through' : ''}`}>
                        {label}
                    </span>
                    {isActive && <ChevronRight size={14} className="text-accent opacity-80 animate-pulse" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* === SYSTEM FOOTER === */}
          <div className="mt-auto px-4 flex flex-col gap-3 relative z-10">
             
             {/* Health Indicator */}
             <button 
                onClick={() => handleNavClick('system', UI_REGISTRY.SIDEBAR_BTN_SYSTEM)}
                className={`
                    rounded-[20px] transition-all w-full text-left group relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                    ${isExpanded 
                        ? 'p-3.5 bg-skin-surface/50 border border-skin-border hover:border-accent/30 hover:bg-skin-surface' 
                        : 'p-0 border-transparent bg-transparent justify-center flex'
                    }
                `}
                title={!isExpanded ? `Integrity: ${healthScore}%` : undefined}
             >
                {isExpanded ? (
                    <>
                        <div className="flex justify-between items-center text-[9px] font-black text-skin-muted uppercase tracking-widest mb-2 group-hover:text-skin-text transition-colors relative z-10">
                            <span className="flex items-center gap-2">
                                {features.AUTO_DIAGNOSTICS ? <Activity size={12} className={healthScore < 80 ? 'animate-pulse text-amber-500' : 'text-emerald-500'}/> : <AlertTriangle size={12} />} 
                                SYSTEM_HEALTH
                            </span>
                            <span className={`font-mono ${healthScore < 80 ? 'text-red-500' : 'text-emerald-500'}`}>{healthScore}%</span>
                        </div>
                        {/* Custom Progress Bar */}
                        <div className="w-full h-1.5 bg-skin-main rounded-full overflow-hidden relative z-10">
                            <div 
                                className={`h-full ${features.AUTO_DIAGNOSTICS ? healthColor : 'bg-neutral-600'} transition-all duration-1000 ease-out rounded-full`} 
                                style={{ width: `${healthScore}%` }}
                            ></div>
                        </div>
                    </>
                ) : (
                    <div className={`w-3 h-3 rounded-full ${features.AUTO_DIAGNOSTICS ? healthColor : 'bg-neutral-600'} transition-all duration-500 mb-4 ring-2 ring-skin-card`}></div>
                )}
             </button>

             <div className={`h-[1px] bg-gradient-to-r from-transparent via-skin-border to-transparent mx-2 transition-all duration-500 ${isExpanded ? 'opacity-100' : 'opacity-0'}`} />

             {/* Settings Link */}
             <button 
                onClick={() => handleNavClick('settings', UI_REGISTRY.SIDEBAR_BTN_SETTINGS)}
                className={`
                  flex items-center rounded-[18px] transition-all duration-300 group outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                  ${isExpanded ? 'w-full px-4 py-3 gap-3 bg-transparent hover:bg-skin-surface text-skin-muted hover:text-skin-text' : 'w-12 h-12 justify-center mx-auto hover:bg-skin-surface text-skin-muted'}
                  ${activeFeature === 'settings' ? 'text-accent' : ''}
                `}
                title={!isExpanded ? 'SETTINGS' : undefined}
             >
                <Settings size={22} className={`${activeFeature === 'settings' ? 'animate-spin-slow text-accent' : 'group-hover:rotate-45 transition-transform'} shrink-0`} strokeWidth={1.5} />
                <div className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-out ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'}`}>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase">CONFIG</span>
                </div>
             </button>
          </div>

        </div>
      </aside>
    </>
  );
});
