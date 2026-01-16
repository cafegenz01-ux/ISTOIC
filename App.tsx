
import React, { useState, useEffect, Suspense, lazy, useTransition, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { type FeatureID } from './constants';
import DashboardView from './features/dashboard/DashboardView'; 
import { TutorialOverlay } from './components/TutorialOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import useLocalStorage from './hooks/useLocalStorage';
import { useIDB } from './hooks/useIDB'; 
import { useChatLogic } from './features/aiChat/hooks/useChatLogic';
import { type Note, type IncomingConnection } from './types';
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
import { decryptData } from './utils/crypto';
import { IStokUserIdentity } from './features/istok/services/istokIdentity';

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

const FEATURE_HASH_MAP: Record<string, FeatureID> = {
  dashboard: 'dashboard',
  notes: 'notes',
  chat: 'chat',
  tools: 'tools',
  system: 'system',
  settings: 'settings'
};

const ViewLoader = () => (
    <div className="h-full w-full flex flex-col items-center justify-center text-text-muted gap-3 animate-pulse">
        <Loader2 size={32} className="animate-spin text-accent" />
        <span className="text-[12px] font-semibold tracking-wide">Loading workspace...</span>
    </div>
);

interface AppContentProps {
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    isDebugOpen: boolean;
    setIsDebugOpen: React.Dispatch<React.SetStateAction<boolean>>;
    userName?: string;
    onLogout?: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ notes, setNotes, isDebugOpen, setIsDebugOpen, userName, onLogout }) => {
  const [activeFeature, setActiveFeature] = useState<FeatureID>('dashboard');
  const [isPending, startTransition] = useTransition(); 

  const [isTutorialComplete, setIsTutorialComplete] = useLocalStorage<boolean>('app_tutorial_complete_v101', false);
  const [theme] = useLocalStorage<string>('app_theme', 'cyan');
  const [colorScheme] = useLocalStorage<'system' | 'light' | 'dark'>('app_color_scheme', 'system');
  const [language] = useLocalStorage<string>('app_language', 'id');
  const [registryValid, setRegistryValid] = useState<boolean>(false);

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
    root.style.setProperty('--accent', targetColor);
    root.style.setProperty('--focus', targetColor);
    root.style.setProperty('--focus-rgb', rgb);
    
    const navAccent = targetColor === '#000000' ? '#ffffff' : targetColor;
    root.style.setProperty('--nav-accent', navAccent);
  }, [theme, colorScheme]);

  useEffect(() => {
    const resolveFeatureFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('connect')) return;
      const rawHash = window.location.hash.replace('#', '').trim();
      const cleaned = rawHash.replace(/^\/+/, '');
      const searchParams = cleaned.includes('=') ? new URLSearchParams(cleaned) : null;
      const candidate = searchParams?.get('feature') || searchParams?.get('view') || cleaned;
      if (!candidate) return;
      const normalized = candidate.toLowerCase();
      const mapped = FEATURE_HASH_MAP[normalized];
      if (mapped) {
        setActiveFeature((prev) => (prev === mapped ? prev : mapped));
      }
    };

    resolveFeatureFromLocation();
    window.addEventListener('hashchange', resolveFeatureFromLocation);
    return () => window.removeEventListener('hashchange', resolveFeatureFromLocation);
  }, [setActiveFeature]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect')) return;
    const hash = `#${activeFeature}`;
    if (window.location.hash !== hash) {
      const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
      window.history.replaceState(null, '', nextUrl);
    }
  }, [activeFeature]);

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

  // SMOOTH NAVIGATION HANDLER
  const handleNavigate = (feature: FeatureID) => {
    startTransition(() => {
        setActiveFeature(feature);
    });
  };

  if (!registryValid) {
    return (
      <div className="h-screen w-screen bg-bg flex items-center justify-center text-danger flex-col gap-4">
        <ShieldAlert size={64} />
        <h1 className="page-title text-text">System unavailable</h1>
      </div>
    );
  }

  const renderContent = () => {
    return (
        <Suspense fallback={<ViewLoader />}>
            <div className={`h-full w-full transition-opacity duration-300 ${isPending ? 'opacity-70 scale-[0.99] origin-center' : 'opacity-100 scale-100'}`}>
                {(() => {
                    switch (activeFeature) {
                        case 'dashboard': return <ErrorBoundary viewName="DASHBOARD"><DashboardView key={language} onNavigate={handleNavigate} notes={notes} userName={userName || 'Account'} onLogout={onLogout} /></ErrorBoundary>;
                        case 'notes': return <ErrorBoundary viewName="ARCHIVE_VAULT"><SmartNotesView key={language} notes={notes} setNotes={setNotes} /></ErrorBoundary>;
                        case 'chat': return <ErrorBoundary viewName="NEURAL_LINK"><AIChatView key={language} chatLogic={chatLogic} /></ErrorBoundary>;
                        case 'tools': return <ErrorBoundary viewName="NEURAL_ARSENAL"><AIToolsView key={language} /></ErrorBoundary>;
                        case 'system': return <ErrorBoundary viewName="SYSTEM_HEALTH"><SystemHealthView key={language} /></ErrorBoundary>;
                        case 'settings': return <ErrorBoundary viewName="CORE_CONFIG"><SettingsView key={language} onNavigate={handleNavigate} /></ErrorBoundary>;
                        default: return <ErrorBoundary viewName="UNKNOWN_MODULE"><DashboardView key={language} onNavigate={handleNavigate} notes={notes} userName={userName || 'Account'} onLogout={onLogout} /></ErrorBoundary>;
                    }
                })()}
            </div>
        </Suspense>
    );
  };

  return (
    <div className="flex h-[100dvh] h-screen w-full text-skin-text font-sans bg-skin-main theme-transition overflow-hidden selection:bg-accent/30 selection:text-accent relative safe-t safe-b safe-l safe-r">
      
      {/* 1. Global Ambient Background Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 transform-gpu">
          <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg to-bg-elevated opacity-100"></div>
          <div className="absolute -top-24 left-[18%] h-72 w-72 rounded-full bg-accent/10 blur-[120px]"></div>
          <div className="absolute bottom-[-12%] right-[-6%] h-80 w-80 rounded-full bg-surface-2/80 blur-[120px]"></div>
      </div>

      {/* 2. Main Content Layout */}
      <div className="flex w-full h-full relative z-10 overflow-hidden">
          <Sidebar 
            key={`sidebar-${language}`}
            activeFeature={activeFeature} 
            setActiveFeature={handleNavigate} 
            chatLogic={chatLogic}
          />
          
          <main className="flex-1 relative h-full w-full bg-transparent min-w-0 flex flex-col">
            <div className="flex-1 w-full h-full overflow-hidden relative">
                {renderContent()}
            </div>
          </main>
      </div>

      <MobileNav 
        activeFeature={activeFeature} 
        setActiveFeature={handleNavigate} 
        chatLogic={chatLogic} 
      />

      <LiveMiniPlayer />
      <DebugConsole isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} />

      {!isTutorialComplete && (
          <TutorialOverlay 
            onComplete={() => setIsTutorialComplete(true)} 
            onNavigate={handleNavigate} 
          />
      )}

      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .pt-safe { padding-top: env(safe-area-inset-top); }
      `}</style>
    </div>
  );
};

type SessionMode = 'AUTH' | 'SELECT' | 'ISTOIC' | 'ISTOK' | 'TELEPONAN';

const App: React.FC = (): React.ReactElement => {
    const [isDebugOpen, setIsDebugOpen] = useState(false);
    const [notes, setNotes] = useIDB<Note[]>('notes', []);
    const [sessionMode, setSessionMode] = useState<SessionMode>('AUTH');
    const [identity, setIdentity] = useLocalStorage<IStokUserIdentity | null>('istok_user_identity', null);
    const returnToRef = useRef<SessionMode | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    
    useIndexedDBSync(notes);
    const { peer, incomingConnection, clearIncoming } = useGlobalPeer(identity);
    const [acceptedConnection, setAcceptedConnection] = useState<IncomingConnection | null>(null);
    const [requestIdentity, setRequestIdentity] = useState<string>('');

    useEffect(() => {
        if (incomingConnection) {
            if (!incomingConnection.firstData) {
                setRequestIdentity('ESTABLISHING LINK...');
                return;
            }
            const process = async () => {
                const { firstData } = incomingConnection;
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
    }, [incomingConnection]);

    const handleAcceptConnection = async (request: IncomingConnection) => {
        setAcceptedConnection(request);
        setSessionMode('ISTOK'); 
        clearIncoming();
    };

    useEffect(() => { activatePrivacyShield(); }, []);

    useEffect(() => {
        const handleDeepLink = () => {
            const hash = window.location.hash;
            const search = window.location.search;
            const params = new URLSearchParams(search);
            const connectId = params.get('connect') || new URLSearchParams(hash.replace('#', '?')).get('connect');
            if (connectId) {
                console.log("[HYDRA-LINK] Incoming P2P Connection Detected. Switching Mode.");
                setSessionMode('ISTOK');
            }
        };
        handleDeepLink();
        window.addEventListener('hashchange', handleDeepLink);
        window.addEventListener('popstate', handleDeepLink);
        return () => {
            window.removeEventListener('hashchange', handleDeepLink);
            window.removeEventListener('popstate', handleDeepLink);
        };
    }, []);

    // If a secure mode is requested without identity, force authentication and remember target
    useEffect(() => {
        if (!identity && (sessionMode === 'ISTOIC' || sessionMode === 'ISTOK' || sessionMode === 'TELEPONAN')) {
            returnToRef.current = sessionMode;
            setSessionMode('AUTH');
        }
    }, [identity, sessionMode]);

    const handleAuthSuccess = useCallback(() => {
        setIsTransitioning(true);
        // Brief delay for auth card exit animation
        setTimeout(() => {
            const target = returnToRef.current;
            returnToRef.current = null;
            setSessionMode(target && target !== 'AUTH' ? target : 'SELECT');
            setIsTransitioning(false);
        }, 180); // Match the exit animation duration
    }, []);

    const handleSelectMode = useCallback((mode: SessionMode) => {
        if (mode === 'ISTOIC') {
            setIsTransitioning(true);
            setTimeout(() => {
                returnToRef.current = null;
                setSessionMode(mode);
                setIsTransitioning(false);
            }, 150);
        } else {
            returnToRef.current = null;
            setSessionMode(mode);
        }
    }, []);

    const handleLogout = useCallback(() => {
        try {
            setIdentity(null);
            localStorage.removeItem('active_thread_id');
        } catch (e) {
            console.warn('Logout cleanup failed', e);
        }
        setSessionMode('AUTH');
    }, [setIdentity]);

    // ANDROID BACK BUTTON HANDLER (Capacitor)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        let listenerHandle: any = null;
        let isMounted = true;
        CapApp.addListener('backButton', ({ canGoBack }) => {
            if (isDebugOpen) {
                setIsDebugOpen(false);
                return;
            }
            if (incomingConnection) {
                clearIncoming();
                return;
            }
            if (sessionMode === 'TELEPONAN') {
                setSessionMode('ISTOK');
                return;
            }
            if (sessionMode === 'ISTOK') {
                setSessionMode('SELECT');
                return;
            }
            if (sessionMode === 'ISTOIC') {
                if (canGoBack) {
                    window.history.back();
                } else {
                    setSessionMode('SELECT');
                }
            }
        }).then(handle => {
            if (isMounted) {
                listenerHandle = handle;
            } else {
                handle.remove();
            }
        });
        return () => {
            isMounted = false;
            if (listenerHandle) {
                listenerHandle.remove();
            }
        };
    }, [sessionMode, isDebugOpen, incomingConnection, clearIncoming]);
    
    const renderSession = (): React.ReactElement => {
        if (sessionMode === 'AUTH') {
            return (
                <div className={`fixed inset-0 z-[9999] ${isTransitioning ? 'animate-auth-exit' : ''}`}>
                    <ErrorBoundary viewName="AUTH_SHELL">
                        <AuthView onAuthSuccess={handleAuthSuccess} />
                    </ErrorBoundary>
                </div>
            );
        }
        if (sessionMode === 'SELECT') {
            return (
                <div className={`fixed inset-0 z-[9999] ${isTransitioning ? 'animate-auth-exit' : 'animate-dashboard-enter'}`}>
                    <ErrorBoundary viewName="SELECTOR">
                        <AppSelector onSelect={handleSelectMode} />
                    </ErrorBoundary>
                </div>
            );
        }
        if (sessionMode === 'ISTOK') {
            return (
                <div className={`fixed inset-0 z-[9999] ${isTransitioning ? 'animate-dashboard-enter' : ''}`}>
                    <Suspense
                        fallback={
                            <div className="h-screen w-screen bg-bg flex items-center justify-center text-text-muted">
                                Preparing secure session...
                            </div>
                        }
                    >
                        <ErrorBoundary viewName="ISTOK_SECURE_CHANNEL">
                            <IStokView onLogout={() => setSessionMode('AUTH')} globalPeer={peer} initialAcceptedConnection={acceptedConnection} />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            );
        }
        if (sessionMode === 'TELEPONAN') {
            return (
                <Suspense
                    fallback={
                        <div className="h-screen w-screen bg-bg flex items-center justify-center text-text-muted">
                            Preparing voice session...
                        </div>
                    }
                >
                    <ErrorBoundary viewName="TELEPONAN_SECURE_CALL">
                        <TeleponanView onClose={() => setSessionMode('ISTOK')} />
                    </ErrorBoundary>
                </Suspense>
            );
        }
        if (sessionMode === 'ISTOIC') {
            return (
                <div className={`absolute inset-0 z-[9999] ${isTransitioning ? 'animate-dashboard-enter' : ''}`}>
                    <GenerativeSessionProvider>
                        <LiveSessionProvider notes={notes} setNotes={setNotes}>
                            {incomingConnection && (
                                <ConnectionNotification 
                                    identity={requestIdentity}
                                    peerId={incomingConnection.conn.peer}
                                    onAccept={() => handleAcceptConnection(incomingConnection)}
                                    onDecline={() => { incomingConnection.conn.close(); clearIncoming(); }}
                                    isProcessing={!incomingConnection.firstData} 
                                />
                            )}
                            <AppContent 
                                notes={notes} 
                                setNotes={setNotes} 
                                isDebugOpen={isDebugOpen} 
                                setIsDebugOpen={setIsDebugOpen} 
                                userName={identity?.displayName || identity?.codename || 'Account'}
                                onLogout={handleLogout}
                            />
                        </LiveSessionProvider>
                    </GenerativeSessionProvider>
                </div>
            );
        }
        return (
            <div className={`absolute inset-0 z-[9999] ${isTransitioning ? 'animate-dashboard-enter' : ''}`}>
                <GenerativeSessionProvider>
                    <LiveSessionProvider notes={notes} setNotes={setNotes}>
                        {incomingConnection && (
                            <ConnectionNotification 
                                identity={requestIdentity}
                                peerId={incomingConnection.conn.peer}
                                onAccept={() => handleAcceptConnection(incomingConnection)}
                                onDecline={() => { incomingConnection.conn.close(); clearIncoming(); }}
                                isProcessing={!incomingConnection.firstData} 
                            />
                        )}
                        <AppContent 
                            notes={notes} 
                            setNotes={setNotes} 
                            isDebugOpen={isDebugOpen} 
                            setIsDebugOpen={setIsDebugOpen} 
                            userName={identity?.displayName || identity?.codename || 'Account'}
                            onLogout={handleLogout}
                        />
                    </LiveSessionProvider>
                </GenerativeSessionProvider>
            </div>
        );
    };

    return (
        <ErrorBoundary viewName="APP_ROOT">
            {renderSession()}
        </ErrorBoundary>
    );
};

export default App;

