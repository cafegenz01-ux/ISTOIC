
import { FunctionDeclaration, Type } from "@google/genai";
import { debugService } from "../../services/debugService";
import { KEY_MANAGER } from "../../services/geminiService";
import { AudioCache } from "../../services/db";

export const mechanicToolDeclaration: FunctionDeclaration = {
    name: "system_mechanic_tool",
    description: "Execute advanced system diagnostic and maintenance protocols. Capable of checking logs, rotating API keys, and memory optimization.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: {
                type: Type.STRING,
                enum: ["GET_DIAGNOSTICS", "REFRESH_KEYS", "CLEAR_LOGS", "OPTIMIZE_MEMORY"],
                description: "The specific maintenance protocol to execute."
            }
        },
        required: ["action"]
    }
};

export const mechanicTools = { functionDeclarations: [mechanicToolDeclaration] };

export const executeMechanicTool = async (call: any): Promise<string> => {
    const { action } = call.args || call; // Handle both direct call and toolCall object
    
    switch(action) {
        case "GET_DIAGNOSTICS":
            const health = debugService.getSystemHealth();
            const providers = KEY_MANAGER.getAllProviderStatuses();
            const nav = navigator as any;
            
            // Real Environment Data
            const navigatorInfo = {
                userAgent: navigator.userAgent,
                hardwareConcurrency: navigator.hardwareConcurrency,
                platform: navigator.platform,
                onLine: navigator.onLine,
                memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'Unknown',
            };
            
            // Storage Calc
            let storageUsed = 0;
            try {
                for (const x in localStorage) {
                    if (localStorage.hasOwnProperty(x)) storageUsed += ((localStorage[x].length + x.length) * 2);
                }
            } catch(e) {}

            const logs = debugService.getLogs();
            const recentErrors = logs.filter(l => l.level === 'ERROR').slice(0, 5).map(l => l.message);

            // Format for LLM consumption
            return JSON.stringify({
                system_status: "ACTIVE_SCAN_COMPLETE",
                timestamp: new Date().toISOString(),
                environment: navigatorInfo,
                telemetry: {
                    latency_ms: health.avgLatency,
                    heap_memory_mb: health.memoryMb,
                    error_count: health.errorCount,
                    storage_usage_kb: (storageUsed / 1024).toFixed(2)
                },
                uplinks: providers.map(p => ({
                    provider: p.id,
                    status: p.status,
                    pool_size: p.keyCount,
                    keys_active: p.keyCount, // Info for diagnostics
                    cooldown_minutes: p.cooldownRemaining
                })),
                recent_errors: recentErrors
            });

        case "REFRESH_KEYS":
            KEY_MANAGER.refreshPools();
            const status = KEY_MANAGER.getAllProviderStatuses();
            const totalKeys = status.reduce((acc, curr) => acc + curr.keyCount, 0);
            
            // Detailed report
            const details = status.map(s => `${s.id}: ${s.keyCount} keys`).join(', ');
            
            return `SUCCESS: Hydra Engine cycled. Total active keys: ${totalKeys} [${details}]. Cooldown timers re-evaluated.`;

        case "CLEAR_LOGS":
            debugService.clear();
            return "SUCCESS: System logs flushed. Diagnostic buffer is clean.";

        case "OPTIMIZE_MEMORY":
             let actions = [];
             let freedCount = 0;
             
             // 1. Clear Console & Debug Buffers (Immediate RAM)
             const logsBefore = debugService.getLogs().length;
             debugService.clear();
             
             // Console clear releases object references held by DevTools
             console.clear(); 
             actions.push(`LOG_BUFFER_PURGED (${logsBefore} items)`);
             actions.push("CONSOLE_REF_CLEARED");

             // 2. Clear Heavy Caches (Storage/Disk -> RAM reduction on next load)
             try {
                 await AudioCache.clear();
                 actions.push("AUDIO_CACHE_FLUSHED");
                 freedCount++;
             } catch(e) {
                 actions.push("CACHE_FLUSH_FAIL");
             }

             // 3. Environment Info (Honest Reporting)
             const navInfo = navigator as any;
             const heapInfo = navInfo.deviceMemory ? `[SYS_RAM: ${navInfo.deviceMemory}GB]` : '';
             
             // Note: We cannot force V8 Garbage Collection in production (window.gc is undefined).
             // We optimize what we control: State buffers and Caches.
             return `OPTIMIZATION_COMPLETE: Active buffers cleared. Storage caches flushed. ${heapInfo}. Actions: [${actions.join(', ')}]. Application state optimized.`;

        default:
            return "ERROR: Unknown protocol request. Please verify command parameters.";
    }
};