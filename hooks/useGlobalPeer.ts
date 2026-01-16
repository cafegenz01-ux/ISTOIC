
import { useState, useEffect, useRef, useCallback } from 'react';
import { IStokUserIdentity } from '../features/istok/services/istokIdentity';
import { debugService } from '../services/debugService';

export const useGlobalPeer = (identity: IStokUserIdentity | null) => {
    const peerRef = useRef<any>(null);
    const [incomingConnection, setIncomingConnection] = useState<any>(null);
    const [status, setStatus] = useState<'INIT' | 'CONNECTING' | 'READY' | 'DISCONNECTED' | 'ERROR' | 'RATE_LIMITED' | 'ID_TAKEN'>('INIT');
    const [peerId, setPeerId] = useState<string | null>(null);
    const [isPeerReady, setIsPeerReady] = useState(false);
    
    const identityRef = useRef(identity);
    const statusRef = useRef(status);
    
    // Retry Logic State
    const retryCount = useRef(0);
    const healthCheckInterval = useRef<any>(null);
    const retryTimeout = useRef<any>(null);

    // Sync Refs
    useEffect(() => { identityRef.current = identity; }, [identity]);
    useEffect(() => { statusRef.current = status; }, [status]);

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

    const scheduleReconnect = useCallback((isFatalError: boolean = false, specificDelay?: number) => {
        if (retryTimeout.current) clearTimeout(retryTimeout.current);
        
        // Max retries limit
        if (isFatalError && retryCount.current > 10) {
             console.error("[HYDRA] Max retries reached. Stopping to prevent spam.");
             setStatus('ERROR');
             return;
        }

        // Exponential Backoff atau Custom Delay
        const delay = specificDelay || Math.min(2000 * Math.pow(1.5, retryCount.current), 15000);
        
        console.log(`[HYDRA] Reclaiming ID in ${delay}ms (Attempt ${retryCount.current + 1})...`);
        
        retryTimeout.current = setTimeout(() => {
            retryCount.current++;
            initGlobalPeer(); 
        }, delay);
    }, []); 

    const initGlobalPeer = useCallback(async () => {
        const currentUser = identityRef.current;
        if (!currentUser || !currentUser.istokId) return;

        // Prevent double init
        if (statusRef.current === 'CONNECTING' || (statusRef.current === 'READY' && peerRef.current && !peerRef.current.disconnected)) {
            return;
        }

        // Clean up previous instance explicitly
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        setStatus('CONNECTING');
        console.log(`[HYDRA] INITIALIZING ENGINE... TARGET ID: ${currentUser.istokId}`);

        try {
            const { Peer } = await import('peerjs');
            
            // Default Google STUN servers as fallback
            let iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ];

            const meteredKey = (import.meta as any).env.VITE_METERED_API_KEY;
            const meteredDomain = (import.meta as any).env.VITE_METERED_DOMAIN || 'istoic.metered.live';

            if (meteredKey) {
                try {
                    console.log("[HYDRA] Fetching TURN credentials from Metered...");
                    // Increased timeout for robust fetching on slow mobile networks
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    const response = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`, { 
                        signal: controller.signal 
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const ice = await response.json();
                        if (Array.isArray(ice)) {
                            // Prepend TURN servers so they are tried first if STUN fails/is blocked
                            iceServers = [...ice, ...iceServers];
                            console.log("[HYDRA] TURN RELAY: ACTIVATED (Enhanced Stability)");
                        }
                    } else {
                        console.warn(`[HYDRA] TURN Fetch Failed: ${response.status}`);
                    }
                } catch (e) {
                    console.warn("[HYDRA] TURN FETCH SKIPPED (Using Standard STUN). Reason:", e);
                }
            } else {
                console.log("[HYDRA] No Metered API Key found. Using default STUN.");
            }

            // FORCE USE ORIGINAL ID - NO RANDOM SUFFIXES
            const targetPeerId = currentUser.istokId;

            const peer = new Peer(targetPeerId, {
                debug: 0, 
                config: { 
                    iceServers: iceServers,
                    iceTransportPolicy: 'all', 
                    iceCandidatePoolSize: 10,
                    sdpSemantics: 'unified-plan'
                },
                // Ping lebih sering agar server tahu kita masih hidup
                pingInterval: 5000, 
            } as any);

            // --- EVENTS ---
            
            peer.on('open', (id) => {
                console.log('[HYDRA] ONLINE & STABLE:', id);
                setStatus('READY');
                setIsPeerReady(true);
                setPeerId(id);
                retryCount.current = 0;
            });

            peer.on('connection', (conn) => {
                console.log(`[HYDRA] INCOMING SIGNAL from ${conn.peer}`);
                
                // NOTIFIKASI INSTAN: Trigger state segera saat ada koneksi masuk
                // Tidak menunggu data pertama agar terasa "cepat"
                setIncomingConnection({ 
                    conn, 
                    firstData: null, 
                    status: 'HANDSHAKING' 
                });

                conn.on('data', (data: any) => {
                    if (data.type === 'SYS' || data.type === 'HANDSHAKE_SYN') {
                        // Update data handshake saat paket tiba
                        setIncomingConnection((prev: any) => ({ 
                            ...prev,
                            conn, // Ensure conn ref is fresh
                            firstData: data,
                            status: 'READY' 
                        }));
                    }
                });

                conn.on('close', () => setIncomingConnection(null));
                conn.on('error', () => setIncomingConnection(null));
            });

            peer.on('disconnected', () => {
                console.warn('[HYDRA] SIGNAL LOST. Auto-Reconnecting...');
                setStatus('DISCONNECTED');
                // Jangan destroy, coba reconnect ke ID yang sama
                if (!peer.destroyed) {
                    peer.reconnect();
                }
            });

            peer.on('close', () => {
                console.error('[HYDRA] PEER DESTROYED.');
                setStatus('DISCONNECTED');
                setIsPeerReady(false);
                setPeerId(null);
            });

            peer.on('error', (err) => {
                console.error("[HYDRA] ERROR:", err.type, err.message);
                
                // --- CRITICAL FIX: ID TAKEN (STABILITAS ID) ---
                if ((err.type as string) === 'unavailable-id') {
                    console.warn("[HYDRA] ID SEDANG DIPAKAI (Ghost Session). Mencoba merebut kembali...");
                    setStatus('ID_TAKEN');
                    
                    // JANGAN GANTI ID. Tunggu sebentar lalu coba lagi.
                    // Server PeerJS akan membersihkan ID lama setelah timeout (sekitar bbrp detik)
                    // Kita retry agresif setiap 2 detik sampai berhasil.
                    scheduleReconnect(true, 2000); 
                    return; 
                }

                if (err.type === 'network' || err.type === 'peer-unavailable' || err.type === 'socket-error' || err.type === 'webrtc') {
                     scheduleReconnect(false, 3000);
                } else if (err.message && (err.message.includes('Insufficient resources') || err.message.includes('Rate limit'))) {
                    setStatus('RATE_LIMITED');
                    scheduleReconnect(true, 10000);
                } else {
                    setStatus('ERROR');
                    scheduleReconnect(true);
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

    // Watchdog: Memastikan koneksi tetap hidup
    useEffect(() => {
        healthCheckInterval.current = setInterval(() => {
            if (!peerRef.current) return;
            
            if (peerRef.current.disconnected && !peerRef.current.destroyed) {
                console.log("[HYDRA] WATCHDOG: Reconnecting signal...");
                peerRef.current.reconnect();
            }
        }, 5000);

        return () => clearInterval(healthCheckInterval.current);
    }, []);

    // Network Recovery
    useEffect(() => {
        const handleOnline = () => {
            console.log("[HYDRA] NETWORK RESTORED. Re-initializing...");
            if (peerRef.current && peerRef.current.disconnected) {
                peerRef.current.reconnect();
            } else if (!peerRef.current || peerRef.current.destroyed) {
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
             console.log("[HYDRA] MANUAL FORCE RECONNECT");
             retryCount.current = 0;
             if (peerRef.current) peerRef.current.destroy();
             initGlobalPeer();
        }
    };
};
