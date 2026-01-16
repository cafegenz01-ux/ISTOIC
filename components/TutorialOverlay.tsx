
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    X, ChevronLeft, ArrowRight, 
    Terminal, Brain, CircuitBoard, 
    DatabaseZap, Activity, Zap, ShieldCheck 
} from 'lucide-react';
import { FeatureID } from '../constants';

interface TutorialStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  targetId?: string; // DOM ID to highlight
  navigateTo?: FeatureID; // Feature to switch to
}

interface TutorialOverlayProps {
  onComplete: () => void;
  onNavigate: (feature: FeatureID) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete, onNavigate }) => {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const steps: TutorialStep[] = [
    {
      id: "INIT",
      title: "SYSTEM ONLINE",
      subtitle: "ISTOIC TITANIUM v101.0",
      description: "Selamat datang, Operator. Sistem ini adalah terminal kognitif berkinerja tinggi yang menggabungkan keamanan lokal dengan kecerdasan multi-engine.",
      icon: <Terminal size={48} />,
      color: "text-white",
      targetId: "nav-logo", // Just for focus
      navigateTo: 'dashboard'
    },
    {
      id: "DASHBOARD",
      title: "COMMAND CENTER",
      subtitle: "PUSAT KONTROL",
      description: "Ini adalah Dashboard utama Anda. Pantau metrik sistem, status sinkronisasi, dan akses cepat ke modul-modul penting.",
      icon: <Activity size={48} />,
      color: "text-blue-500",
      targetId: "nav-dashboard",
      navigateTo: 'dashboard'
    },
    {
      id: "NOTES",
      title: "SMART VAULT",
      subtitle: "MEMORI TERENKRIPSI",
      description: "Simpan aset intelektual Anda di sini. Didukung oleh pencarian semantik (Vector DB) dan enkripsi lokal tingkat militer.",
      icon: <DatabaseZap size={48} />,
      color: "text-purple-500",
      targetId: "nav-notes",
      navigateTo: 'notes'
    },
    {
      id: "NEURAL",
      title: "DUAL CORE AI",
      subtitle: "HANISAH & STOIC",
      description: "Pilih mode operasi: 'HANISAH' untuk kreativitas tinggi, atau 'STOIC' untuk logika murni. Beralih instan melalui header.",
      icon: <Brain size={48} />,
      color: "text-orange-500",
      targetId: "nav-chat",
      navigateTo: 'chat'
    },
    {
      id: "TOOLS",
      title: "ELITE ARSENAL",
      subtitle: "GENERATIVE SUITE",
      description: "Studio Generatif untuk visual 8K, analisis visi komputer, dan alat bantu kognitif lainnya siap digunakan.",
      icon: <Zap size={48} />,
      color: "text-yellow-500",
      targetId: "nav-tools",
      navigateTo: 'tools'
    },
    {
      id: "SYSTEM",
      title: "SYSTEM MECHANIC",
      subtitle: "SELF-HEALING",
      description: "Modul pemeliharaan otomatis. Memantau kesehatan API, rotasi kunci, dan optimasi memori secara real-time.",
      icon: <CircuitBoard size={48} />,
      color: "text-emerald-500",
      targetId: "nav-system",
      navigateTo: 'system'
    }
  ];

  const updateSpotlight = useCallback((targetId?: string) => {
      if (!targetId) {
          setSpotlightStyle({});
          return;
      }
      const element = document.getElementById(targetId);
      if (element) {
          const rect = element.getBoundingClientRect();
          // Calculate spotlight position
          setSpotlightStyle({
              top: rect.top - 10,
              left: rect.left - 10,
              width: rect.width + 20,
              height: rect.height + 20,
              opacity: 1,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.85), 0 0 30px rgba(var(--accent-rgb), 0.5)'
          });
      } else {
          setSpotlightStyle({});
      }
  }, []);

  const handleNext = useCallback(() => {
    if (step < steps.length - 1) {
        const nextStep = steps[step + 1];
        setStep(prev => prev + 1);
        
        // Execute Navigation
        if (nextStep.navigateTo) {
            onNavigate(nextStep.navigateTo);
        }

        // Update Spotlight after a slight delay to allow UI transition
        setTimeout(() => updateSpotlight(nextStep.targetId), 300);
    } else {
      finish();
    }
  }, [step, steps.length, onNavigate, updateSpotlight]);

  const handlePrev = useCallback(() => {
    if (step > 0) {
        const prevStep = steps[step - 1];
        setStep(prev => prev - 1);
        
        if (prevStep.navigateTo) {
            onNavigate(prevStep.navigateTo);
        }
        
        setTimeout(() => updateSpotlight(prevStep.targetId), 300);
    }
  }, [step, onNavigate, updateSpotlight]);

  const finish = () => {
    setIsVisible(false);
    setTimeout(onComplete, 500);
  };

  // Initial setup for step 0
  useEffect(() => {
      const currentStep = steps[step];
      if (currentStep.navigateTo) onNavigate(currentStep.navigateTo);
      setTimeout(() => updateSpotlight(currentStep.targetId), 500);
  }, []); // Run once on mount

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const currentStep = steps[step];

  return (
    <div className={`fixed inset-0 z-[9999] transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Spotlight Overlay */}
        <div 
            className="absolute transition-all duration-500 ease-out rounded-2xl pointer-events-none border border-[var(--accent-color)]/50"
            style={{
                position: 'fixed',
                zIndex: 9998,
                opacity: 0, // Hidden initially
                ...spotlightStyle
            }}
        />
        
        {/* Main Content Card - Centered but avoids spotlight if possible (simplified to center for now) */}
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-auto">
            <div className={`
                relative w-full max-w-2xl bg-[#0a0a0b] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden
                flex flex-col md:flex-row transform transition-all duration-500 ring-1 ring-white/5
                ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-10 scale-95'}
            `}>
                
                {/* LEFT PANEL: VISUAL */}
                <div className="relative w-full md:w-5/12 h-40 md:h-auto bg-zinc-900/50 flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay" />
                    
                    {/* Dynamic Glow */}
                    <div className={`absolute inset-0 opacity-20 transition-colors duration-700 ${currentStep.color.replace('text-', 'bg-')}`} style={{ filter: 'blur(60px)' }}></div>

                    <div className={`
                        relative z-10 w-20 h-20 md:w-28 md:h-28 rounded-[24px] 
                        flex items-center justify-center 
                        bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl
                        transition-all duration-500 group
                    `}>
                        <div className={`transition-all duration-500 ${currentStep.color} group-hover:scale-110 drop-shadow-[0_0_15px_currentColor]`}>
                            {currentStep.icon}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: CONTENT */}
                <div className="flex-1 flex flex-col relative p-6 md:p-10">
                    {/* Skip Button */}
                    <button 
                        onClick={finish} 
                        className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg flex items-center gap-2 group z-50"
                    >
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Skip</span>
                        <X size={18} />
                    </button>

                    <div className="flex-1 flex flex-col justify-center space-y-5">
                        {/* Step Indicator Pill */}
                        <div className="animate-slide-up">
                            <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 w-fit">
                                <span className="text-[9px] font-mono text-neutral-400">MODULE_0{step + 1}</span>
                                <div className="h-3 w-[1px] bg-white/10"></div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${currentStep.color}`}>{currentStep.id}</span>
                            </div>
                        </div>

                        <div key={step} className="animate-fade-in space-y-3">
                            <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter text-white uppercase leading-[0.9]">
                                {currentStep.title}
                            </h2>
                            
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] border-l-2 border-white/10 pl-3">
                                {currentStep.subtitle}
                            </p>

                            <p className="text-sm text-neutral-400 font-medium leading-relaxed">
                                {currentStep.description}
                            </p>
                        </div>
                    </div>

                    {/* Footer / Navigation */}
                    <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/5">
                        {/* Dots */}
                        <div className="flex gap-1.5">
                            {steps.map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? `w-8 ${currentStep.color.replace('text-', 'bg-')}` : 'w-2 bg-white/10'}`} 
                                />
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handlePrev}
                                disabled={step === 0}
                                className={`
                                    p-3 rounded-xl border border-white/10 text-white transition-all duration-300
                                    ${step === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-white/5 hover:border-white/20 active:scale-95'}
                                `}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            
                            <button 
                                onClick={handleNext} 
                                className="
                                    h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] 
                                    flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]
                                    bg-white text-black hover:scale-[1.02] active:scale-95
                                "
                            >
                                {step === steps.length - 1 ? 'SELESAI' : 'LANJUT'}
                                {step === steps.length - 1 ? <ShieldCheck size={14} /> : <ArrowRight size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
