
import { useState, useEffect, useRef, useCallback } from 'react';
import { IStokUserIdentity } from '../features/istok/services/istokIdentity';
import { debugService } from '../services/debugService';

export const useGlobalPeer = (identity: IStokUserIdentity | null) => {
    const peerRef = useRef<any>(null);
    const [incomingConnection, setIncomingConnection] = useState<any>(null);
    const [status, setStatus] = useState<'INIT' | 'CONNECTING' | 'READY' | 'DISCONNECTED' | 'ERROR' | 'RATE_LIMITED'>('INIT');
    const [peerId, setPeerId] = useState<string | null>(null);
    const [isPeerReady, setIsPeerReady] = useState(false);
    
    // Refs for stable access inside async functions without triggering re-renders
    const identityRef = useRef(identity);
    const statusRef = useRef(status);
    
    // Retry Logic State
    const retryCount = useRef(0);
    const healthCheckInterval = useRef<any>(null);
    const retryTimeout = useRef<any>(null);

    // Sync Refs
    useEffect(() => { identityRef.current = identity; }, [identity]);
    useEffect(() => { statusRef.current = status; }, [status]);

    // CLEANUP FUNCTION
    const destroyPeer = useCallback(() => {
        if (peerRef.current) {
            peerRef.current.removeAllListeners();
            peerRef.current.destroy();
            peerRef.current = null;
        }
        setIsPeerReady(false);
        setPeerId(null);
        if (healthCheckInterval.current) clearInterval(healthCheckInterval.current);
        if (retryTimeout.current) clearTimeout(retryTimeout.current);
    }, []);

    const scheduleReconnect = useCallback((isFatalError: boolean = false) => {
        if (retryTimeout.current) clearTimeout(retryTimeout.current);
        if (isFatalError && retryCount.current > 5) {
             console.error("[HYDRA] Max retries reached on fatal error. Stopping.");
             setStatus('ERROR');
             return;
        }

        // Exponential Backoff: 2s, 5s, 10s... max 30s
        const baseDelay = 2000;
        let delay = Math.min(baseDelay * Math.pow(1.5, retryCount.current), 30000);
        
        if (statusRef.current === 'RATE_LIMITED') delay = 60000; // 1 min for rate limit

        console.log(`[HYDRA] Scheduling recovery in ${delay}ms (Attempt ${retryCount.current + 1})...`);
        
        retryTimeout.current = setTimeout(() => {
            retryCount.current++;
            initGlobalPeer(); // Retry with original logic
        }, delay);
    }, []); 

    const initGlobalPeer = useCallback(async (overrideId?: string) => {
        const currentUser = identityRef.current;
        if (!currentUser || !currentUser.istokId) return;

        // Prevent double init if currently connecting or ready
        // Exception: If overrideId is present, we are forcing a retry with a new ID
        if (!overrideId && (statusRef.current === 'CONNECTING' || (statusRef.current === 'READY' && peerRef.current && !peerRef.current.disconnected))) {
            return;
        }

        // Clean up previous instance
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        setStatus('CONNECTING');
        console.log(`[HYDRA] INITIALIZING ENGINE (Attempt ${retryCount.current})... ID: ${overrideId || currentUser.istokId}`);

        try {
            const { Peer } = await import('peerjs');
            
            // DEFAULT ICE SERVERS (Google STUN)
            let iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ];

            const meteredKey = (import.meta as any).env.VITE_METERED_API_KEY;
            const meteredDomain = (import.meta as any).env.VITE_METERED_DOMAIN || 'istoic.metered.live';

            if (meteredKey) {
                try {
                    const response = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`);
                    const ice = await response.json();
                    if (Array.isArray(ice)) {
                        iceServers = [...ice, ...iceServers];
                        console.log("[HYDRA] TURN RELAY: ACTIVATED");
                    }
                } catch (e) {
                    console.warn("[HYDRA] TURN FETCH FAILED. USING STANDARD STUN.");
                }
            }

            // Use override ID (fallback) or original ID
            const targetPeerId = overrideId || currentUser.istokId;

            const peer = new Peer(targetPeerId, {
                debug: 0, 
                config: { 
                    iceServers: iceServers,
                    iceTransportPolicy: 'all', 
                    iceCandidatePoolSize: 10
                }
            } as any);

            // --- EVENTS ---
            
            peer.on('open', (id) => {
                console.log('[HYDRA] ONLINE:', id);
                setStatus('READY');
                setIsPeerReady(true);
                setPeerId(id);
                retryCount.current = 0;
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
                // Only trigger disconnected if not explicitly destroyed by us for a retry
                if (peer.destroyed) return;
                console.warn('[HYDRA] SIGNAL LOST (Disconnected).');
                setStatus('DISCONNECTED');
                setIsPeerReady(false);
                peer.reconnect();
            });

            peer.on('close', () => {
                console.error('[HYDRA] PEER DESTROYED (Close).');
                setStatus('DISCONNECTED');
                setIsPeerReady(false);
                setPeerId(null);
                // Do NOT schedule reconnect here if it was caused by 'unavailable-id' handling
                // The 'error' handler will take care of unique ID logic.
                // Only schedule if it wasn't an intentional destroy.
            });

            peer.on('error', (err) => {
                console.error("[HYDRA] ERROR:", err.type, err.message);
                
                // --- CRITICAL FIX: ID COLLISION HANDLER ---
                if (err.type === 'unavailable-id') {
                    console.warn("[HYDRA] ID TAKEN. Applying Auto-Fallback...");
                    // Generate a semi-random suffix to guarantee uniqueness
                    const suffix = Math.floor(Math.random() * 900) + 100;
                    const fallbackId = `${currentUser.istokId}-${suffix}`;
                    // Retry immediately with new ID
                    initGlobalPeer(fallbackId);
                    return; 
                }

                if (err.message && (err.message.includes('Insufficient resources') || err.message.includes('Rate limit'))) {
                    setStatus('RATE_LIMITED');
                    retryCount.current = 5; // Long wait
                } else {
                    setStatus('ERROR');
                }

                // If not an ID error, standard reconnect schedule
                if (err.type !== 'unavailable-id') {
                    scheduleReconnect(true); // Treat as potentially fatal/retry-able
                }
            });

            peerRef.current = peer;

        } catch (e) {
            console.error("[HYDRA] FATAL INIT FAIL", e);
            setStatus('ERROR');
            scheduleReconnect(true);
        }
    }, []); 

    // Initial Setup
    useEffect(() => {
        if (identity?.istokId && !peerRef.current) {
            retryCount.current = 0;
            initGlobalPeer();
        }
        
        return () => {
            destroyPeer();
        };
    }, [identity?.istokId]); 

    // Watchdog
    useEffect(() => {
        healthCheckInterval.current = setInterval(() => {
            if (!peerRef.current) return;
            
            if (peerRef.current.disconnected && !peerRef.current.destroyed) {
                console.log("[HYDRA] WATCHDOG: Reconnecting...");
                peerRef.current.reconnect();
            }
        }, 5000);

        return () => clearInterval(healthCheckInterval.current);
    }, []);

    // Network Recovery
    useEffect(() => {
        const handleOnline = () => {
            console.log("[HYDRA] NETWORK RESTORED.");
            if (peerRef.current && peerRef.current.disconnected) {
                peerRef.current.reconnect();
            } else if (!peerRef.current) {
                initGlobalPeer();
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
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
             retryCount.current = 0;
             if (peerRef.current) peerRef.current.destroy();
             initGlobalPeer(); // Will reset to original ID
        }
    };
};
