
import React, { memo } from 'react';
import { type FeatureID, FEATURES } from '../constants';
import { Settings } from 'lucide-react';
import { useNavigationIntelligence } from '../hooks/useNavigationIntelligence';

interface MobileNavProps {
  activeFeature: FeatureID;
  setActiveFeature: (feature: FeatureID) => void;
  chatLogic?: any;
}

export const MobileNav: React.FC<MobileNavProps> = memo(({ activeFeature, setActiveFeature }) => {
  const { shouldShowNav, isInputFocused } = useNavigationIntelligence();

  // FIX: Ensure visibility logic handles focus correctly on mobile
  const isVisible = shouldShowNav && !isInputFocused;

  return (
    <div 
      className={`
        md:hidden fixed left-1/2 -translate-x-1/2 
        transition-all cubic-bezier(0.2, 0.8, 0.2, 1) 
        will-change-transform w-auto max-w-[calc(100vw-32px)]
        z-[1000] ${isVisible ? 'pointer-events-auto' : 'pointer-events-none'}
        /* SAFE AREA FIX: Calculate bottom position including notch area + margin */
        ${isVisible 
          ? 'bottom-[calc(1.2rem+env(safe-area-inset-bottom))] opacity-100 translate-y-0 scale-100 duration-500 delay-100' 
          : 'bottom-0 opacity-0 translate-y-10 scale-90 duration-300' 
        }
      `}
      role="navigation"
      aria-label="Navigasi Utama"
    >
      <nav className="
        flex items-center gap-1 p-2
        bg-surface/95 backdrop-blur-xl 
        border border-border
        rounded-2xl 
        shadow-[0_12px_40px_-14px_rgba(0,0,0,0.3)]
        ring-1 ring-white/5
      ">
        
        {FEATURES.map((f) => {
          const isActive = activeFeature === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFeature(f.id as FeatureID)}
              aria-label={`Buka ${f.name}`}
              aria-current={isActive ? 'page' : undefined}
              className={`
                relative w-12 h-12 min-w-[44px] min-h-[44px] touch-target flex flex-col items-center justify-center rounded-lg 
                transition-all duration-300 group
                pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]
                ${isActive 
                  ? 'bg-accent text-text-invert font-semibold shadow-sm' 
                  : 'text-text-muted hover:text-text hover:bg-surface-2'}
              `}
            >
              <div className={`transition-transform duration-300 ${isActive ? '-translate-y-1 scale-110' : 'group-active:scale-95'}`}>
                {React.cloneElement(f.icon as React.ReactElement<any>, { size: 20, strokeWidth: isActive ? 2.5 : 2 })}
              </div>
            </button>
          );
        })}

        <div className="w-[1px] h-6 bg-border mx-1"></div>

        <div className="flex items-center gap-1">
            <button 
                onClick={() => setActiveFeature('settings')} 
                aria-label="Buka Pengaturan"
                className={`
                    w-12 h-12 min-w-[44px] min-h-[44px] touch-target flex items-center justify-center rounded-lg transition-all pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]
                    ${activeFeature === 'settings' 
                        ? 'bg-accent text-text-invert shadow-sm' 
                        : 'text-text-muted hover:text-text hover:bg-surface-2'}
                `}
            >
                <Settings size={20} className={activeFeature === 'settings' ? 'animate-spin-slow' : ''} />
            </button>
        </div>

      </nav>
    </div>
  );
});


