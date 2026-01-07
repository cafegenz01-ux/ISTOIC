
import { useState, useEffect, useRef, useCallback } from 'react';
import { IStokUserIdentity } from '../features/istok/services/istokIdentity';
import { debugService } from '../services/debugService';

export const useGlobalPeer = (identity: IStokUserIdentity | null) => {
    const peerRef = useRef<any>(null);
    const [incomingConnection, setIncomingConnection] = useState<any>(null);
    const [status, setStatus] = useState<'INIT' | 'CONNECTING' | 'READY' | 'DISCONNECTED' | 'ERROR' | 'RATE_LIMITED'>('INIT');
    const [peerId, setPeerId] = useState<string | null>(null);
    const [isPeerReady, setIsPeerReady] = useState(false);
    
    // Retry Logic State
    const retryCount = useRef(0);
    const healthCheckInterval = useRef<any>(null);
    const retryTimeout = useRef<any>(null);

    // CLEANUP FUNCTION
    const destroyPeer = () => {
        if (peerRef.current) {
            // Remove listeners to prevent zombie callbacks
            peerRef.current.removeAllListeners();
            peerRef.current.destroy();
            peerRef.current = null;
        }
        setIsPeerReady(false);
        setPeerId(null);
        if (healthCheckInterval.current) clearInterval(healthCheckInterval.current);
        if (retryTimeout.current) clearTimeout(retryTimeout.current);
    };

    const scheduleReconnect = useCallback((isError: boolean = false) => {
        // Stop any pending retries
        if (retryTimeout.current) clearTimeout(retryTimeout.current);

        // Exponential Backoff: 2s, 4s, 8s, 16s... max 30s
        const baseDelay = 2000;
        let delay = Math.min(baseDelay * Math.pow(2, retryCount.current), 30000);
        
        // If we hit Rate Limit error, force a longer cooldown immediately
        if (status === 'RATE_LIMITED') delay = 20000; 

        console.log(`[HYDRA] Scheduling recovery in ${delay}ms (Attempt ${retryCount.current + 1})...`);
        
        retryTimeout.current = setTimeout(() => {
            retryCount.current++;
            initGlobalPeer();
        }, delay);
    }, [status]); // Depend on status to catch RATE_LIMITED updates

    const initGlobalPeer = useCallback(async () => {
        if (!identity || !identity.istokId) return;

        // Prevent double init if currently connecting
        if (status === 'CONNECTING') return;

        // Clean up previous instance hard before new one
        if (peerRef.current) {
            if (!peerRef.current.destroyed) peerRef.current.destroy();
            peerRef.current = null;
        }

        setStatus('CONNECTING');
        console.log(`[HYDRA] INITIALIZING ENGINE (Attempt ${retryCount.current})...`);

        try {
            const { Peer } = await import('peerjs');
            
            // DEFAULT ICE SERVERS (Google STUN) - Reliable for home WiFi
            let iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ];

            const meteredKey = (import.meta as any).env.VITE_METERED_API_KEY;
            const meteredDomain = (import.meta as any).env.VITE_METERED_DOMAIN || 'istoic.metered.live';

            // ATTEMPT TURN RELAY FETCH (Critical for 4G/Corporate Networks)
            if (meteredKey) {
                try {
                    const response = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`);
                    const ice = await response.json();
                    if (Array.isArray(ice)) {
                        iceServers = [...ice, ...iceServers];
                        console.log("[HYDRA] TURN RELAY: ACTIVATED (Firewall Penetration Ready)");
                    }
                } catch (e) {
                    console.warn("[HYDRA] TURN FETCH FAILED. FALLING BACK TO STANDARD STUN.", e);
                }
            } else {
                console.warn("[HYDRA] NO METERED KEY FOUND. RUNNING IN STANDARD P2P MODE (May fail on 4G).");
            }

            const peer = new Peer(identity.istokId, {
                debug: 1, // Log errors but not excessive info
                config: { 
                    iceServers: iceServers,
                    iceTransportPolicy: meteredKey ? 'relay' : 'all', // Prefer relay if key exists for stability
                    iceCandidatePoolSize: 10
                },
                pingInterval: 5000, 
            } as any);

            // --- EVENTS ---
            
            peer.on('open', (id) => {
                console.log('[HYDRA] ONLINE:', id);
                setStatus('READY');
                setIsPeerReady(true);
                setPeerId(id);
                retryCount.current = 0; // Reset backoff on success
            });

            peer.on('connection', (conn) => {
                debugService.log('INFO', 'GLOBAL', 'INCOMING', `Signal from ${conn.peer}`);
                
                setIncomingConnection({ 
                    conn, 
                    firstData: null, 
                    status: 'HANDSHAKING' 
                });

                conn.on('data', (data: any) => {
                    if (data.type === 'SYS' || data.type === 'HANDSHAKE_SYN') {
                        setIncomingConnection({ 
                            conn, 
                            firstData: data,
                            status: 'READY' 
                        });
                    }
                });

                conn.on('close', () => setIncomingConnection(null));
                conn.on('error', () => setIncomingConnection(null));
            });

            peer.on('disconnected', () => {
                console.warn('[HYDRA] SIGNAL LOST (Disconnected).');
                setStatus('DISCONNECTED');
                setIsPeerReady(false);
                // Soft reconnect attempt
                peer.reconnect();
            });

            peer.on('close', () => {
                console.error('[HYDRA] PEER DESTROYED (Close).');
                setStatus('DISCONNECTED');
                setIsPeerReady(false);
                setPeerId(null);
                
                // Trigger full re-init via backoff
                scheduleReconnect();
            });

            peer.on('error', (err) => {
                console.error("[HYDRA] ERROR:", err.type, err.message);
                
                // CRITICAL: Handle "Insufficient resources" / Rate Limiting
                if (err.message && (err.message.includes('Insufficient resources') || err.message.includes('Rate limit'))) {
                    setStatus('RATE_LIMITED');
                    // Force a very long wait
                    retryCount.current = 5; // Jump to high backoff tier
                } else {
                    setStatus('ERROR');
                }

                // If fatal ID error, don't retry immediately
                if (err.type === 'unavailable-id') {
                    console.error("[HYDRA] ID TAKEN. Closing.");
                    // Maybe user has another tab open?
                    return; 
                }

                // Retry for network/server errors
                scheduleReconnect(true);
            });

            peerRef.current = peer;

        } catch (e) {
            console.error("[HYDRA] FATAL INIT FAIL", e);
            setStatus('ERROR');
            scheduleReconnect(true);
        }
    }, [identity, scheduleReconnect]); // Added scheduleReconnect to deps

    // Initial Setup
    useEffect(() => {
        if (identity?.istokId) {
            retryCount.current = 0;
            initGlobalPeer();
        }
        return () => destroyPeer();
    }, [identity, initGlobalPeer]);

    // Watchdog
    useEffect(() => {
        healthCheckInterval.current = setInterval(() => {
            if (!peerRef.current) return;
            
            if (peerRef.current.disconnected && !peerRef.current.destroyed) {
                console.log("[HYDRA] WATCHDOG: Reconnecting...");
                peerRef.current.reconnect();
            }
        }, 10000); // Relaxed check to 10s

        return () => clearInterval(healthCheckInterval.current);
    }, []);

    // Network Recovery
    useEffect(() => {
        const handleOnline = () => {
            console.log("[HYDRA] NETWORK RESTORED. RESETTING BACKOFF...");
            retryCount.current = 0;
            if (peerRef.current) peerRef.current.destroy();
            initGlobalPeer();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && (!peerRef.current || peerRef.current.disconnected)) {
                console.log("[HYDRA] TAB AWAKE. CHECKING SIGNAL...");
                if (peerRef.current?.disconnected) peerRef.current.reconnect();
                else initGlobalPeer();
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [initGlobalPeer]);

    return {
        peer: peerRef.current,
        isPeerReady: status === 'READY',
        status, 
        peerId, 
        incomingConnection,
        clearIncoming: () => setIncomingConnection(null),
        forceReconnect: () => {
             console.log("[HYDRA] MANUAL RECONNECT TRIGGERED");
             retryCount.current = 0; // Reset backoff on manual trigger
             if (peerRef.current) peerRef.current.destroy();
             initGlobalPeer();
        }
    };
};
