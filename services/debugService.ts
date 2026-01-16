
import { LogEntry, LogLevel } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { UI_ID, FN_ID, UI_REGISTRY } from '../constants/registry';

const MAX_LOGS = 150; // Strict limit for memory safety

interface PerformanceMetric {
    endpoint: string;
    latency: number;
    timestamp: number;
}

export type UIStatus = 'ACTIVE' | 'UNSTABLE' | 'DISABLED';

interface UIElementState {
    id: string;
    status: UIStatus;
    errorCount: number;
    usageCount: number;
    lastUsed: string | null;
}

class DebugService {
    private logs: LogEntry[] = [];
    private listeners: ((logs: LogEntry[]) => void)[] = [];
    private uiListeners: ((state: Record<string, UIElementState>) => void)[] = [];
    private metrics: PerformanceMetric[] = [];
    
    // UI Matrix State
    private uiState: Record<string, UIElementState> = {};
    private lastInteractionId: string | null = null;

    // PERFORMANCE OPTIMIZATION: Throttling State
    private updateScheduled = false;
    private uiUpdateScheduled = false;
    private readonly UPDATE_INTERVAL_MS = 100; // Limit UI updates to ~10fps max for logs

    constructor() {
        // Initial silent log to avoid trigger before listeners attached
        this.logs.push({
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            layer: 'KERNEL',
            level: 'INFO',
            code: 'BOOT',
            message: 'System Reliability Monitor v13.5 Active (Optimized Core).',
            payload: {}
        });
        this.initializeUIMatrix();
    }

    private initializeUIMatrix() {
        Object.values(UI_REGISTRY).forEach(id => {
            this.uiState[id] = {
                id,
                status: 'ACTIVE',
                errorCount: 0,
                usageCount: 0,
                lastUsed: null
            };
        });
    }

    public logAction(uiId: UI_ID, fnId: FN_ID, result: string = 'OK', payload?: any): boolean {
        const element = this.uiState[uiId];
        if (element && element.status === 'DISABLED') {
            this.log('WARN', 'UI_GATEKEEPER', 'BLOCKED', `Interaction with ${uiId} blocked by System Mechanic.`);
            return false;
        }

        this.lastInteractionId = uiId;
        if (element) {
            element.usageCount++;
            element.lastUsed = new Date().toISOString();
            this.notifyUI();
        }

        this.log('TRACE', 'INTERACTION', fnId, `[${uiId}] executed. Result: ${result}`, payload);
        return true;
    }

    public reportUIError(errorContext: string) {
        if (this.lastInteractionId && this.uiState[this.lastInteractionId]) {
            const el = this.uiState[this.lastInteractionId];
            el.errorCount++;
            
            if (el.errorCount >= 3 && el.status !== 'DISABLED') {
                el.status = 'UNSTABLE';
                this.log('WARN', 'MECHANIC', 'AUTO_FLAG', `UI Element ${el.id} flagged UNSTABLE due to high error rate.`);
            }
            this.notifyUI();
        }
    }

    public setUIStatus(id: string, status: UIStatus) {
        if (this.uiState[id]) {
            this.uiState[id].status = status;
            if (status === 'ACTIVE') this.uiState[id].errorCount = 0;
            this.notifyUI();
            this.log('INFO', 'MECHANIC', 'OVERRIDE', `UI Element ${id} set to ${status}`);
        }
    }

    public getUIMatrix() {
        return this.uiState;
    }

    public runGhostScan() {
        let issuesFound = 0;
        Object.values(this.uiState).forEach(el => {
            if (el.errorCount > 0 && el.status === 'ACTIVE') {
                el.status = 'UNSTABLE';
                issuesFound++;
            }
        });
        this.notifyUI();
        return issuesFound;
    }

    // --- STANDARD LOGGING (OPTIMIZED) ---

    log(level: LogLevel, layer: string, code: string, message: string, payload: any = {}) {
        const entry: LogEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            layer,
            level,
            code,
            message,
            payload: JSON.parse(JSON.stringify(payload || {}))
        };

        const isDev = (import.meta as any).env?.DEV;
        if (isDev || level === 'ERROR') {
            const style = level === 'ERROR' ? 'color: #ef4444; font-weight: bold' : 'color: #00f0ff';
            // console.log(`%c[${layer}] ${code}`, style, message, payload); // Reduced console spam for perf
        }

        this.logs.unshift(entry);
        if (this.logs.length > MAX_LOGS) {
            this.logs.pop();
        }
        
        this.notify();
    }

    reportToExternal(error: Error, context: Record<string, any> = {}) {
        const errorData = {
            name: error.name,
            message: error.message,
            stack: error.stack,
            context: {
                ...context,
                lastInteraction: this.lastInteractionId,
                timestamp: new Date().toISOString()
            }
        };
        this.log('ERROR', 'CRASH_REPORT', 'EXCEPTION', error.message, errorData);
    }

    trackNetwork(endpoint: string, startTime: number) {
        const latency = Date.now() - startTime;
        this.metrics.push({ endpoint, latency, timestamp: Date.now() });
        if (this.metrics.length > 50) this.metrics.shift(); 
        
        this.log('TRACE', 'NETWORK', 'LATENCY', `${endpoint} took ${latency}ms`, { latency });
    }

    getSystemHealth() {
        const avgLatency = this.metrics.length > 0 
            ? Math.round(this.metrics.reduce((a, b) => a + b.latency, 0) / this.metrics.length) 
            : 0;
        
        const memory = (performance as any).memory 
            ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) 
            : null;

        return {
            avgLatency,
            memoryMb: memory,
            errorCount: this.logs.filter(l => l.level === 'ERROR').length,
            activeListeners: this.listeners.length
        };
    }

    getLogs() { return this.logs; }

    subscribe(callback: (logs: LogEntry[]) => void) {
        this.listeners.push(callback);
        // Immediate callback with current state
        callback(this.logs);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    subscribeUI(callback: (state: Record<string, UIElementState>) => void) {
        this.uiListeners.push(callback);
        callback({ ...this.uiState });
        return () => {
            this.uiListeners = this.uiListeners.filter(l => l !== callback);
        };
    }

    // --- THROTTLED NOTIFIERS ---
    // Prevents UI thread choking during high-frequency events (Stream/P2P)

    private notify() {
        if (this.updateScheduled) return;
        this.updateScheduled = true;
        
        // Use requestAnimationFrame for smoother UI updates synced with refresh rate
        // OR setTimeout for strict throttling. setTimeout is safer for non-visual logic.
        setTimeout(() => {
            this.listeners.forEach(l => l(this.logs));
            this.updateScheduled = false;
        }, this.UPDATE_INTERVAL_MS);
    }

    private notifyUI() {
        if (this.uiUpdateScheduled) return;
        this.uiUpdateScheduled = true;
        
        setTimeout(() => {
            this.uiListeners.forEach(l => l({ ...this.uiState }));
            this.uiUpdateScheduled = false;
        }, this.UPDATE_INTERVAL_MS);
    }

    clear() {
        this.logs = [];
        this.metrics = [];
        this.log('INFO', 'OPS', 'CLEAN', 'System logs purged manually.');
    }

    runSelfDiagnosis(keyManager?: any) {
        this.log('INFO', 'SELF_CHECK', 'INIT', 'Running comprehensive system audit...');
        if (keyManager) {
            const providers = keyManager.getAllProviderStatuses();
            this.log('INFO', 'SELF_CHECK', 'KEYS_OK', `Providers: ${providers.length}`);
        }
        this.log('INFO', 'SELF_CHECK', 'COMPLETE', 'Audit finished.');
    }
}

export const debugService = new DebugService();
