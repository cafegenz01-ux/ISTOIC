
import React, { useState, useEffect, memo, useCallback } from 'react';
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

// Haptic feedback helper for mobile/PWA feel
const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(2); // Ultra-short tick for UI feedback
    }
};

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

  // Reduced Polling Frequency for Health Check to save CPU
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
      // Increase interval to 5000ms to reduce main thread load
      const interval = setInterval(checkHealth, 5000);
      const unsubscribe = debugService.subscribeUI((state) => setUiMatrix(state));
      
      return () => { 
          clearInterval(interval);
          unsubscribe(); 
      };
  }, [features.AUTO_DIAGNOSTICS]);
  
  const getLabel = useCallback((id: string) => {
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
      if (id === 'raw') return "Raw mode";
      return transKey ? getText('sidebar', transKey) : id.toUpperCase();
  }, []);

  const handleNavClick = useCallback((id: FeatureID, uiId: string) => {
      // Direct call to avoid re-render overhead inside logAction if possible
      triggerHaptic();
      if (debugService.logAction(uiId as any, FN_REGISTRY.NAVIGATE_TO_FEATURE, id)) {
          setActiveFeature(id);
      }
  }, [setActiveFeature]);

  // CSS for GPU Acceleration
  const transitionClass = "transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform transform-gpu";

  return (
    <>
      {/* 1. DYNAMIC SPACER */}
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
          hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-[1200] select-none
          bg-surface/98 backdrop-blur-xl 
          border-r border-border
          ${transitionClass}
          ${isExpanded 
              ? 'w-[280px] shadow-[20px_0_60px_-12px_rgba(0,0,0,0.25)] translate-x-0' 
              : 'w-[88px] translate-x-0'}
          ${isForcedStealth ? 'opacity-0 pointer-events-none -translate-x-10' : 'opacity-100'}
        `}
        aria-label="Main Navigation"
      >
        <div className="flex flex-col h-full w-full overflow-hidden py-6 pt-[env(safe-area-inset-top,24px)] pb-[env(safe-area-inset-bottom,20px)] relative">
          
          {/* Ambient Glow Gradient */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-accent/3 to-transparent pointer-events-none" />

          {/* === LOGO & BRANDING === */}
          <div className={`px-6 mb-8 transition-all duration-500 flex flex-col relative z-10 ${isExpanded ? 'items-start' : 'items-center'}`}>
              <div className="flex items-center justify-between w-full">
                  <button 
                    onClick={() => handleNavClick('dashboard', UI_REGISTRY.SIDEBAR_BTN_LOGO)}
                    className="relative group outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-[18px] transition-all sheen touch-manipulation"
                    title="Dashboard"
                  >
                    <div className={`
                      shrink-0 w-11 h-11 rounded-[18px] flex items-center justify-center 
                      bg-gradient-to-br from-surface to-surface-2
                      border border-border
                      shadow-sm group-hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] group-hover:border-accent/40
                      transition-all duration-300 transform group-hover:scale-[1.06]
                    `}>
                      <div className={`text-text transition-colors duration-300 group-hover:text-accent font-bold`}>
                          {personaMode === 'hanisah' ? <Flame size={22} strokeWidth={2.5} /> : <Cpu size={22} strokeWidth={2.5} />}
                      </div>
                    </div>
                  </button>

                  <div className={`transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      <button 
                        onClick={() => setIsExpanded(false)}
                        className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-2 active:scale-90 transition-all outline-none touch-manipulation"
                      >
                          <PanelLeftClose size={18} />
                      </button>
                  </div>
              </div>

              <div className={`absolute top-0 right-0 left-0 flex justify-center transition-all duration-300 ${!isExpanded ? 'opacity-100 translate-y-14' : 'opacity-0 pointer-events-none translate-y-10'}`}>
                  <button 
                    onClick={() => setIsExpanded(true)}
                    className="p-2 rounded-xl text-text-muted hover:text-accent hover:bg-accent/10 active:scale-90 transition-all outline-none touch-manipulation"
                  >
                      <PanelLeft size={20} strokeWidth={2} />
                  </button>
              </div>

              <div className={`mt-5 overflow-hidden whitespace-nowrap transition-all duration-500 ease-out flex flex-col ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                  <h1 className="text-lg font-bold text-text leading-none flex items-center gap-2 tracking-tight">
                    ISTOIC
                  </h1>
                  <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5 font-medium">
                    <Command size={12} /> Ctrl+B
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
                    relative flex items-center rounded-lg transition-all duration-300 group outline-none sheen touch-manipulation
                    ${isExpanded ? 'w-full px-4 py-3 gap-3' : 'w-12 h-12 justify-center mx-auto aspect-square'}
                    ${isDisabled 
                        ? 'opacity-40 cursor-not-allowed grayscale' 
                        : isActive 
                            ? 'bg-accent text-text-invert font-semibold shadow-sm' 
                            : 'hover:bg-surface-2 text-text-muted hover:text-text'
                    }
                    focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50
                  `}
                  title={!isExpanded ? label : undefined}
                >
                  <div className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-105' : 'group-hover:scale-110 group-active:scale-95'}`}>
                    {isDisabled 
                        ? <AlertTriangle size={20} className="text-danger" /> 
                        : React.cloneElement(feature.icon as React.ReactElement<any>, { 
                            size: 22, 
                            strokeWidth: isActive ? 2.5 : 2,
                            className: isActive ? 'drop-shadow-sm' : ''
                        })
                    }
                  </div>

                  <div className={`
                    overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] 
                    flex-1
                    ${isExpanded ? 'opacity-100 max-w-full translate-x-0' : 'opacity-0 max-w-0 -translate-x-2'}
                  `}>
                    <span className={`text-sm font-medium ${isDisabled ? 'text-danger line-through' : ''}`}>
                        {label}
                    </span>
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
                    rounded-lg transition-all w-full text-left group relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sheen touch-manipulation
                    ${isExpanded 
                        ? 'p-3.5 bg-surface-2 border border-border hover:border-accent/50 hover:bg-surface-2' 
                        : 'p-0 border-transparent bg-transparent justify-center flex'
                    }
                `}
                title={!isExpanded ? `Integrity: ${healthScore}%` : undefined}
             >
                {isExpanded ? (
                    <>
                        <div className="flex justify-between items-center text-xs text-text-muted mb-2 group-hover:text-text transition-colors relative z-10 font-medium">
                            <span className="flex items-center gap-2">
                                {features.AUTO_DIAGNOSTICS ? <Activity size={12} className={healthScore < 80 ? 'animate-pulse text-warning' : 'text-success'}/> : <AlertTriangle size={12} />} 
                                System
                            </span>
                            <span className={`text-sm font-bold ${healthScore < 80 ? 'text-danger' : 'text-success'}`}>{healthScore}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden relative z-10">
                            <div 
                                className={`h-full ${features.AUTO_DIAGNOSTICS ? healthColor : 'bg-text-muted'} transition-all duration-1000 ease-out rounded-full`} 
                                style={{ width: `${healthScore}%` }}
                            ></div>
                        </div>
                    </>
                ) : (
                    <div className={`w-3 h-3 rounded-full ${features.AUTO_DIAGNOSTICS ? healthColor : 'bg-text-muted'} transition-all duration-500 mb-4 ring-2 ring-surface`}></div>
                )}
             </button>

             <div className={`h-[1px] bg-gradient-to-r from-transparent via-border to-transparent mx-2 transition-all duration-500 ${isExpanded ? 'opacity-100' : 'opacity-0'}`} />

             {/* Settings Link */}
             <button 
                onClick={() => handleNavClick('settings', UI_REGISTRY.SIDEBAR_BTN_SETTINGS)}
                className={`
                  flex items-center rounded-lg transition-all duration-300 group outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sheen touch-manipulation
                  ${isExpanded ? 'w-full px-4 py-3 gap-3 bg-transparent hover:bg-surface-2 text-text-muted hover:text-text' : 'w-12 h-12 justify-center mx-auto hover:bg-surface-2 text-text-muted'}
                  ${activeFeature === 'settings' ? 'text-accent' : ''}
                `}
                title={!isExpanded ? 'SETTINGS' : undefined}
             >
                <Settings size={22} className={`${activeFeature === 'settings' ? 'animate-spin-slow text-accent' : 'group-hover:rotate-45 transition-transform'} shrink-0`} strokeWidth={1.5} />
                <div className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-out ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'}`}>
                    <span className="text-sm font-medium">Settings</span>
                </div>
             </button>
          </div>

        </div>
      </aside>
    </>
  );
});
