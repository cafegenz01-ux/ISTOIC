
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { type FeatureID } from './constants';
// Eager load Dashboard for instant perceived performance
import DashboardView from './features/dashboard/DashboardView'; 
import { TutorialOverlay } from './components/TutorialOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import useLocalStorage from './hooks/useLocalStorage';
import { useIDB } from './hooks/useIDB'; 
import { useChatLogic } from './features/aiChat/hooks/useChatLogic';
import { type Note, type IncomingConnection, type GlobalPeerState } from './types';
import { DebugConsole } from './components/DebugConsole';
import { debugService } from './services/debugService';
import { KEY_MANAGER } from './services/geminiService';
import { UI_REGISTRY, FN_REGISTRY } from './constants/registry';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { LiveSessionProvider } from './contexts/LiveSessionContext';
import { LiveMiniPlayer } from './components/LiveMiniPlayer';
import { useIndexedDBSync } from './hooks/useIndexedDBSync';
import { AuthView } from './features/auth/AuthView'; 
import { AppSelector } from './features/auth/AppSelector';
import { GenerativeSessionProvider } from './contexts/GenerativeSessionContext';
import { activatePrivacyShield } from './utils/privacyShield';
import { useGlobalPeer } from './hooks/useGlobalPeer';
import { ConnectionNotification } from './features/istok/components/ConnectionNotification';
import { decryptData, encryptData } from './utils/crypto';
import { IStokUserIdentity } from './features/istok/services/istokIdentity';

// --- LAZY LOAD HEAVY MODULES ---
const SmartNotesView = lazy(() => import('./features/smartNotes/SmartNotesView').then(module => ({ default: module.SmartNotesView })));
const AIChatView = lazy(() => import('./features/aiChat/AIChatView'));
const AIToolsView = lazy(() => import('./features/aiTools/AIToolsView'));
const SettingsView = lazy(() => import('./features/settings/SettingsView'));
const SystemHealthView = lazy(() => import('./features/systemHealth/SystemHealthView').then(module => ({ default: module.SystemHealthView })));
const IStokView = lazy(() => import('./features/istok/IStokView').then(module => ({ default: module.IStokView })));
const TeleponanView = lazy(() => import('./features/teleponan/TeleponanView').then(module => ({ default: module.TeleponanView })));

export const THEME_COLORS: Record<string, string> = {
  cyan: '#00F0FF',
  lime: '#CCFF00',
  purple: '#BF00FF',
  orange: '#FF5F00',
  silver: '#FFFFFF',
  blue: '#0066FF',
  green: '#00FF94',
  red: '#FF003C',
  pink: '#FF0099',
  gold: '#FFD700'
};

// Loading Fallback Component
const ViewLoader = () => (
    <div className="h-full w-full flex flex-col items-center justify-center text-neutral-500 gap-4 animate-pulse">
        <Loader2 size={32} className="animate-spin text-accent" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">LOADING_MODULE...</span>
    </div>
);

interface AppContentProps {
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    onOpenTeleponan: () => void;
    // Strictly typed props
    globalPeer: any; // PeerJS instance remains any to avoid heavy lib import in types, but handled in hooks
    incomingRequest: IncomingConnection | null;
    onAcceptRequest: (req: IncomingConnection) => void;
    onDeclineRequest: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ 
    notes, setNotes, onOpenTeleponan,
    globalPeer, incomingRequest, onAcceptRequest, onDeclineRequest
}) => {
  const [activeFeature, setActiveFeature] = useState<FeatureID>('dashboard');
  const [isTutorialComplete, setIsTutorialComplete] = useLocalStorage<boolean>('app_tutorial_complete', false);
  
  // REACTIVE SETTINGS
  const [theme] = useLocalStorage<string>('app_theme', 'cyan');
  const [colorScheme] = useLocalStorage<'system' | 'light' | 'dark'>('app_color_scheme', 'system');
  const [language] = useLocalStorage<string>('app_language', 'id');
  
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [registryValid, setRegistryValid] = useState<boolean>(false);

  // Neural Chat Global State
  const chatLogic = useChatLogic(notes, setNotes);
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
      `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : 
      '6 182 212'; 
  };

  const getContrastColor = (hexColor: string) => {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
  };

  useEffect(() => {
      const validateRegistry = () => {
          if (!UI_REGISTRY.SIDEBAR_BTN_DASHBOARD || !UI_REGISTRY.DEBUG_TOGGLE) {
              console.error("FATAL: UI REGISTRY CORRUPTED");
              return false;
          }
          if (!FN_REGISTRY.NAVIGATE_TO_FEATURE || !FN_REGISTRY.TRIGGER_DEBUG) {
              console.error("FATAL: FN REGISTRY CORRUPTED");
              return false;
          }
          debugService.logAction(UI_REGISTRY.DEBUG_TOGGLE, FN_REGISTRY.VALIDATE_REGISTRY, 'PASSED');
          return true;
      };

      if (validateRegistry()) {
          setRegistryValid(true);
          debugService.runSelfDiagnosis(KEY_MANAGER);
      } else {
          setRegistryValid(false);
      }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let activeScheme = colorScheme;
    if (colorScheme === 'system') {
      activeScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (activeScheme === 'dark') { root.classList.add('dark'); root.classList.remove('light'); } 
    else { root.classList.add('light'); root.classList.remove('dark'); }

    let targetColor = THEME_COLORS[theme] || THEME_COLORS.cyan;
    if (theme === 'silver' && activeScheme === 'light') targetColor = '#475569';

    const onAccentColor = getContrastColor(targetColor);
    const onAccentRgb = hexToRgb(onAccentColor);
    const rgb = hexToRgb(targetColor);
    
    root.style.setProperty('--accent-color', targetColor);
    root.style.setProperty('--accent-rgb', rgb);
    root.style.setProperty('--on-accent-color', onAccentColor);
    root.style.setProperty('--on-accent-rgb', onAccentRgb);
    root.style.setProperty('--accent-glow', `rgba(${rgb.replace(/ /g, ', ')}, 0.45)`); 
    
    const navAccent = targetColor === '#000000' ? '#ffffff' : targetColor;
    root.style.setProperty('--nav-accent', navAccent);
  }, [theme, colorScheme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        debugService.logAction(UI_REGISTRY.DEBUG_TOGGLE, FN_REGISTRY.TRIGGER_DEBUG, 'TOGGLE');
        setIsDebugOpen(prev => !prev);
      }
    };
    
    const handleDebugToggle = () => setIsDebugOpen(prev => !prev);
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('istoic-toggle-debug', handleDebugToggle);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('istoic-toggle-debug', handleDebugToggle);
    };
  }, []);

  // --- HANDLE INCOMING REQUEST DATA ---
  const [requestIdentity, setRequestIdentity] = useState<string>('');
  
  useEffect(() => {
      if (incomingRequest) {
          // IMMEDIATE FEEDBACK: If no data yet, show loading
          if (!incomingRequest.firstData) {
              setRequestIdentity('ESTABLISHING LINK...');
              return;
          }

          const process = async () => {
              const { firstData } = incomingRequest;
              // Try basic pins + default '000000'
              const payload = await decryptData(firstData.payload, '000000') || await decryptData(firstData.payload, '123456');
              
              if (payload) {
                  try {
                    const json = JSON.parse(payload);
                    setRequestIdentity(json.identity || 'Unknown Agent');
                  } catch(e) { setRequestIdentity('Encrypted Signal'); }
              } else {
                  setRequestIdentity('Encrypted Signal (PIN Required)');
              }
          };
          process();
      } else {
          setRequestIdentity('');
      }
  }, [incomingRequest]);

  if (!registryValid) {
      return (
          <div className="h-screen w-screen bg-black flex items-center justify-center text-red-600 flex-col gap-4">
              <ShieldAlert size={64} />
              <h1 className="text-4xl font-black uppercase tracking-widest">SYSTEM HALT</h1>
              <p className="text-sm font-mono text-red-400">REGISTRY INTEGRITY CHECK FAILED.</p>
          </div>
      );
  }

  const renderContent = () => {
    return (
        <Suspense fallback={<ViewLoader />}>
            {(() => {
                switch (activeFeature) {
                    case 'dashboard': return <ErrorBoundary viewName="DASHBOARD"><DashboardView key={language} onNavigate={setActiveFeature} notes={notes} /></ErrorBoundary>;
                    case 'notes': return <ErrorBoundary viewName="ARCHIVE_VAULT"><SmartNotesView key={language} notes={notes} setNotes={setNotes} /></ErrorBoundary>;
                    case 'chat': return <ErrorBoundary viewName="NEURAL_LINK"><AIChatView key={language} chatLogic={chatLogic} /></ErrorBoundary>;
                    case 'tools': return <ErrorBoundary viewName="NEURAL_ARSENAL"><AIToolsView key={language} /></ErrorBoundary>;
                    case 'system': return <ErrorBoundary viewName="SYSTEM_HEALTH"><SystemHealthView key={language} /></ErrorBoundary>;
                    case 'settings': return <ErrorBoundary viewName="CORE_CONFIG"><SettingsView key={language} onNavigate={setActiveFeature} /></ErrorBoundary>;
                    default: return <ErrorBoundary viewName="UNKNOWN_MODULE"><DashboardView key={language} onNavigate={setActiveFeature} notes={notes} /></ErrorBoundary>;
                }
            })()}
        </Suspense>
    );
  };

  return (
    <div className="flex h-[100dvh] w-full text-skin-text font-sans bg-skin-main theme-transition overflow-hidden selection:bg-accent/30 selection:text-accent relative pl-safe pr-safe">
      
      {/* GLOBAL CONNECTION ALERT - MOVED TO ROOT LEVEL FOR Z-INDEX FIX */}
      {incomingRequest && (
          <ConnectionNotification 
              identity={requestIdentity}
              peerId={incomingRequest.conn.peer}
              onAccept={() => onAcceptRequest(incomingRequest)}
              onDecline={onDeclineRequest}
              isProcessing={!incomingRequest.firstData} // Show loading state if data not yet arrived
          />
      )}

      {/* 1. Global Ambient Background Layer */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-skin-main via-skin-main to-skin-main opacity-100"></div>
          <div className="absolute inset-0 opacity-20 dark:opacity-30 mix-blend-screen bg-gradient-to-tr from-[var(--accent-color)]/20 via-purple-500/10 to-blue-500/10 filter blur-[100px] animate-aurora"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay"></div>
      </div>

      {/* 2. Main Content */}
      <div className="flex w-full h-full relative z-10">
          <Sidebar 
            key={`sidebar-${language}`}
            activeFeature={activeFeature} 
            setActiveFeature={setActiveFeature} 
            chatLogic={chatLogic}
            onOpenTeleponan={onOpenTeleponan}
          />
          
          <main className="flex-1 relative h-full overflow-hidden bg-transparent min-w-0">
            <div id="main-scroll-container" className="h-full w-full overflow-y-auto custom-scroll pb-safe scroll-smooth">
              <div className="min-h-full pb-32 md:pb-40">
                {renderContent()}
              </div>
            </div>
          </main>
      </div>

      <MobileNav 
        activeFeature={activeFeature} 
        setActiveFeature={setActiveFeature} 
        chatLogic={chatLogic} 
      />

      <LiveMiniPlayer />

      <DebugConsole isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} />

      {!isTutorialComplete && <TutorialOverlay onComplete={() => setIsTutorialComplete(true)} />}

      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

// --- ROOT APP CONTROLLER ---
type SessionMode = 'AUTH' | 'SELECT' | 'ISTOIC' | 'ISTOK' | 'TELEPONAN';

const App: React.FC = () => {
    const [notes, setNotes] = useIDB<Note[]>('notes', []);
    const [sessionMode, setSessionMode] = useState<SessionMode>('AUTH');
    const [identity] = useLocalStorage<IStokUserIdentity | null>('istok_user_identity', null);
    
    useIndexedDBSync(notes);

    // --- GLOBAL PEER ENGINE ---
    const { peer, incomingConnection, clearIncoming } = useGlobalPeer(identity);
    
    // --- GLOBAL CONNECTION HANDLER ---
    const [acceptedConnection, setAcceptedConnection] = useState<IncomingConnection | null>(null);

    const handleAcceptConnection = async (request: IncomingConnection) => {
        setAcceptedConnection(request);
        setSessionMode('ISTOK'); // Switch to IStok View
        clearIncoming(); // Clear notification
    };

    // ACTIVATE PRIVACY SHIELD GLOBALLY
    useEffect(() => {
        activatePrivacyShield();
    }, []);

    // HYDRA DEEP LINK HANDLER (Hot-Swap)
    useEffect(() => {
        const handleDeepLink = () => {
            const hash = window.location.hash;
            const search = window.location.search;
            const params = new URLSearchParams(search);

            // DETECT ISTOK LINK (Has #connect or ?connect)
            // Priority: URL params first, then Hash params
            const connectId = params.get('connect') || new URLSearchParams(hash.replace('#', '?')).get('connect');

            if (connectId) {
                console.log("[HYDRA-LINK] Incoming P2P Connection Detected. Switching Mode.");
                setSessionMode('ISTOK');
            }
        };

        // Check on mount
        handleDeepLink();

        // Check on hash change (if app is already open)
        window.addEventListener('hashchange', handleDeepLink);
        window.addEventListener('popstate', handleDeepLink);

        return () => {
            window.removeEventListener('hashchange', handleDeepLink);
            window.removeEventListener('popstate', handleDeepLink);
        };
    }, []);
    
    if (sessionMode === 'AUTH') {
        return <AuthView onAuthSuccess={() => setSessionMode('SELECT')} />;
    }

    if (sessionMode === 'SELECT') {
        return <AppSelector onSelect={(mode) => setSessionMode(mode)} />;
    }

    if (sessionMode === 'ISTOK') {
        return (
            <Suspense fallback={<div className="h-screen w-screen bg-black flex items-center justify-center text-red-500 font-mono">INITIALIZING_SECURE_LAYER...</div>}>
                <ErrorBoundary viewName="ISTOK_SECURE_CHANNEL">
                    <IStokView 
                        onLogout={() => setSessionMode('AUTH')} 
                        globalPeer={peer} 
                        initialAcceptedConnection={acceptedConnection}
                    />
                </ErrorBoundary>
            </Suspense>
        );
    }

    if (sessionMode === 'TELEPONAN') {
        return (
            <Suspense fallback={<div className="h-screen w-screen bg-black flex items-center justify-center text-green-500 font-mono">INITIALIZING_SECURE_VOICE...</div>}>
                <ErrorBoundary viewName="TELEPONAN_SECURE_CALL">
                    <TeleponanView onClose={() => setSessionMode('ISTOIC')} />
                </ErrorBoundary>
            </Suspense>
        );
    }

    return (
        <GenerativeSessionProvider>
            <LiveSessionProvider notes={notes} setNotes={setNotes}>
                <AppContent 
                    notes={notes} 
                    setNotes={setNotes} 
                    onOpenTeleponan={() => setSessionMode('TELEPONAN')} 
                    globalPeer={peer}
                    incomingRequest={incomingConnection}
                    onAcceptRequest={handleAcceptConnection}
                    onDeclineRequest={() => { 
                        incomingConnection?.conn?.close(); 
                        clearIncoming(); 
                    }}
                />
            </LiveSessionProvider>
        </GenerativeSessionProvider>
    );
};

export default App;
