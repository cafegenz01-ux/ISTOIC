
// ... (imports)
import React, { useState, useEffect, useRef } from 'react';
import { 
    Activity, Terminal, Cpu, Zap, Wifi, HardDrive, 
    RefreshCw, ShieldCheck, Trash2, 
    ChevronRight, Send, Command, Network, Server,
    AlertTriangle, CheckCircle2, Play, FileText, BrainCircuit,
    LayoutGrid, MousePointer2, ToggleLeft, ToggleRight, Fingerprint, Info
} from 'lucide-react';
import { debugService, type UIStatus } from '../../services/debugService';
import { KEY_MANAGER, type ProviderStatus } from '../../services/geminiService';
import { HanisahKernel } from '../../services/melsaKernel';
import { HANISAH_BRAIN } from '../../services/melsaBrain';
import { mechanicTools, executeMechanicTool } from './mechanicTools';
import Markdown from 'react-markdown';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { useFeatures } from '../../contexts/FeatureContext'; 

// ... (Sub-Components: MetricRing, UIElementNode, DiagnosticReport - Keep logic same)

// Local Kernel Instance for Mechanic Context Isolation
const MECHANIC_KERNEL = new HanisahKernel();

// --- COMPONENTS ---

const MetricRing: React.FC<{ 
    label: string; 
    value: number; 
    max: number; 
    unit: string; 
    color?: string;
    icon?: React.ReactNode;
}> = ({ label, value, max, unit, color, icon }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(value / max, 1);
    const offset = circumference - progress * circumference;
    
    // Use dynamic accent color if no specific color provided
    const strokeColor = color || (progress > 0.9 ? '#ef4444' : progress > 0.7 ? '#eab308' : 'var(--accent-color)');

    return (
        <div className="relative flex flex-col items-center justify-center p-5 bg-white/5 dark:bg-white/[0.02] rounded-[24px] border border-black/5 dark:border-white/5 group hover:border-accent/30 transition-all duration-500 hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]">
            <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-black/5 dark:text-white/5" />
                    <circle cx="48" cy="48" r={radius} stroke={strokeColor} strokeWidth="8" fill="transparent" 
                        strokeDasharray={circumference} 
                        strokeDashoffset={offset} 
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{ filter: `drop-shadow(0 0 2px ${strokeColor})` }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col text-accent">
                    {icon && <div className="mb-1 opacity-80">{icon}</div>}
                    <span className="text-sm font-black text-black dark:text-white leading-none">{value}</span>
                    <span className="text-[9px] text-neutral-500 font-mono mt-0.5">{unit}</span>
                </div>
            </div>
            <span className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 group-hover:text-accent transition-colors">{label}</span>
        </div>
    );
};

const UIElementNode: React.FC<{ id: string, status: UIStatus, errors: number, usage: number, onToggle: () => void }> = ({ id, status, errors, usage, onToggle }) => {
    const getStatusColor = () => {
        if (status === 'DISABLED') return 'bg-red-500/10 border-red-500 text-red-500';
        if (status === 'UNSTABLE') return 'bg-yellow-500/10 border-yellow-500 text-yellow-500 animate-pulse';
        return 'bg-emerald-500/10 border-emerald-500 text-emerald-500';
    };

    const cleanName = id.replace(/UI_|BTN_/g, '').replace(/_/g, ' ');

    return (
        <div 
            onClick={onToggle}
            className={`
                relative p-3 rounded-xl border transition-all cursor-pointer group select-none
                ${getStatusColor()} hover:scale-[1.02] active:scale-95
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="p-1.5 rounded-lg bg-black/20">
                    {status === 'DISABLED' ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                </div>
                <div className="text-[9px] font-mono opacity-70">
                    ERR:{errors} | USE:{usage}
                </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider truncate" title={id}>
                {cleanName}
            </div>
            <div className="text-[8px] font-mono mt-1 opacity-60">
                {status}
            </div>
            
            {/* Holographic Overlay */}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        </div>
    );
};

export const HanisahMechanicView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'CONSOLE' | 'UI_MATRIX'>('CONSOLE');
    const [health, setHealth] = useState<any>({ avgLatency: 0, memoryMb: 0, errorCount: 0 });
    const [providers, setProviders] = useState<ProviderStatus[]>([]);
    const [uiMatrix, setUiMatrix] = useState<Record<string, any>>(debugService.getUIMatrix());
    const { features } = useFeatures();
    
    const [messages, setMessages] = useState<Array<{role: 'user'|'mechanic', text: string}>>([
        { role: 'mechanic', text: "System Diagnostics Online. Ready for input." }
    ]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ... (UseEffect and handlers logic remain same)
    
    useEffect(() => {
        const updateVitals = () => {
            setHealth(debugService.getSystemHealth());
            setProviders(KEY_MANAGER.getAllProviderStatuses());
        };
        
        updateVitals();
        const unsubscribeUI = debugService.subscribeUI((state) => setUiMatrix(state));

        let interval: any = null;
        if (features.AUTO_DIAGNOSTICS) {
            interval = setInterval(updateVitals, 2000);
        }

        return () => {
            if (interval) clearInterval(interval);
            unsubscribeUI();
        };
    }, [features.AUTO_DIAGNOSTICS]);

    useEffect(() => {
        if (activeTab === 'CONSOLE') {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, activeTab]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    const executeRepair = async (action: string) => {
        const uiId = action === 'REFRESH_KEYS' ? UI_REGISTRY.MECH_BTN_REFRESH_KEYS :
                     action === 'OPTIMIZE_MEMORY' ? UI_REGISTRY.MECH_BTN_OPTIMIZE :
                     action === 'CLEAR_LOGS' ? UI_REGISTRY.MECH_BTN_CLEAR_LOGS : UI_REGISTRY.MECH_BTN_HARD_RESET;
        
        if (!debugService.logAction(uiId, FN_REGISTRY.MECH_EXECUTE_FIX, action)) return;

        debugService.log('INFO', 'MECHANIC', 'FIX_EXEC', `Initiating protocol: ${action}`);
        
        if (action === 'HARD_RESET') {
            if(confirm("PERINGATAN: System Reboot akan merefresh halaman.")) window.location.reload();
            return;
        }

        await new Promise(r => setTimeout(r, 800));
        const result = await executeMechanicTool({ args: { action } });
        debugService.log('INFO', 'MECHANIC', 'FIX_RESULT', result);
        
        if (action === 'REFRESH_KEYS') setProviders(KEY_MANAGER.getAllProviderStatuses());
        else if (action === 'CLEAR_LOGS') {
            setMessages(prev => [{ role: 'mechanic', text: "Logs cleared. Buffer reset." }]);
            debugService.clear(); 
        } else if (action === 'OPTIMIZE_MEMORY') setHealth(debugService.getSystemHealth());
    };

    const runHanisahDiagnosis = async () => {
        if (!debugService.logAction(UI_REGISTRY.MECH_BTN_SCAN, FN_REGISTRY.MECH_RUN_DIAGNOSIS, 'START')) return;
        setMessages(prev => [...prev, { role: 'user', text: "Run full diagnostic scan." }]);
        setIsProcessing(true);
        
        try {
            debugService.log('INFO', 'MECHANIC', 'SCAN_INIT', 'Running full system diagnostics...');
            const toolResultJson = await executeMechanicTool({ args: { action: 'GET_DIAGNOSTICS' } });
            
            const prompt = `[ROLE: SYSTEM_MECHANIC]\nAnalisa data telemetri (CPU, RAM, Latency).\nBerikan laporan performa sistem yang jelas.\n\n[RAW_DATA]\n${toolResultJson}\n\nFORMAT:\n1. **SYSTEM INTEGRITY**: (SCORE %)\n2. **METRICS SUMMARY**: (CPU/Mem/Net Status)\n3. **ANOMALIES**: (List - be specific)\n4. **OPTIMIZATION**: (Actionable steps)`;
            
            const response = await MECHANIC_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            setMessages(prev => [...prev, { role: 'mechanic', text: response.text || "Diagnostic failed." }]);
            debugService.log('INFO', 'MECHANIC', 'SCAN_COMPLETE', 'Diagnosis generated successfully.');
        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'mechanic', text: `⚠️ **DIAGNOSTIC FAILURE**: ${e.message}` }]);
            debugService.log('ERROR', 'MECHANIC', 'SCAN_FAIL', e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCommand = async (cmdOverride?: string) => {
        const cmd = cmdOverride || input.trim();
        if (!cmd || isProcessing) return;

        if (!debugService.logAction(UI_REGISTRY.MECH_INPUT_CLI, FN_REGISTRY.MECH_CLI_EXEC, cmd)) return;

        setMessages(prev => [...prev, { role: 'user', text: cmd }]);
        setInput('');
        setIsProcessing(true);

        try {
            const stream = MECHANIC_KERNEL.streamExecute(
                cmd, 
                'gemini-3-flash-preview', 
                undefined, 
                undefined, 
                {
                    systemInstruction: HANISAH_BRAIN.getMechanicInstruction(),
                    tools: [mechanicTools]
                }
            );

            let responseText = "";
            setMessages(prev => [...prev, { role: 'mechanic', text: "..." }]);

            for await (const chunk of stream) {
                if (chunk.text) {
                    responseText += chunk.text;
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1] = { role: 'mechanic', text: responseText };
                        return newMsgs;
                    });
                }
                
                if (chunk.functionCall) {
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1] = { role: 'mechanic', text: `_Executing protocol: ${chunk.functionCall.name}..._` };
                        return newMsgs;
                    });

                    const result = await executeMechanicTool(chunk.functionCall);
                    const synthesisPrompt = `Tool Result: ${result}.\n\nProvide a human-readable status update.`;
                    
                    const followUp = await MECHANIC_KERNEL.execute(synthesisPrompt, 'gemini-3-flash-preview');
                    
                    if (followUp.text) {
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            newMsgs[newMsgs.length - 1] = { role: 'mechanic', text: followUp.text };
                            return newMsgs;
                        });
                    }
                }
            }
        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'mechanic', text: `**SYSTEM ERROR**: ${e.message}` }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommand();
        }
    };

    const toggleUIElement = (id: string) => {
        const current = uiMatrix[id];
        const newStatus = current.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
        debugService.setUIStatus(id, newStatus);
    };

    const runGhostScan = () => {
        const count = debugService.runGhostScan();
        setMessages(prev => [...prev, { role: 'mechanic', text: `**UI_SCAN_COMPLETE**: ${count} anomalies flagged in UI Matrix.` }]);
        setActiveTab('UI_MATRIX');
    };

    return (
        <div className="h-full flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-12 lg:px-16 overflow-hidden font-sans animate-fade-in bg-zinc-50 dark:bg-[#050505] text-black dark:text-white">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-black/5 dark:border-white/5 pb-6 shrink-0 gap-4">
                <div>
                    <h1 className="text-[10vw] lg:text-[7rem] heading-heavy text-black dark:text-white leading-[0.85] tracking-tighter uppercase">
                        SYSTEM <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-500 animate-gradient-text">DIAGNOSTICS</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                        <p className="text-[9px] tech-mono font-bold text-neutral-500 uppercase tracking-[0.3em]">MAINTENANCE_CONSOLE</p>
                    </div>
                </div>
                
                {/* Header Controls */}
                <div className="flex gap-3">
                    <div className="flex bg-white dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
                        <button onClick={() => setActiveTab('CONSOLE')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'CONSOLE' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-neutral-500 hover:text-black dark:hover:text-white'}`}>
                            CONSOLE
                        </button>
                        <button onClick={() => setActiveTab('UI_MATRIX')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'UI_MATRIX' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-neutral-500 hover:text-black dark:hover:text-white'}`}>
                            UI_MATRIX
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0 pb-safe">
                
                {/* Left: Vitals & Tools */}
                <div className="w-full lg:w-1/3 flex flex-col gap-6 overflow-y-auto custom-scroll pr-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    
                    <div className="grid grid-cols-2 gap-3">
                        <MetricRing label="LATENCY" value={health.avgLatency} max={2000} unit="ms" icon={<Network size={14}/>} />
                        <MetricRing label="MEMORY" value={health.memoryMb || 0} max={2000} unit="MB" icon={<HardDrive size={14}/>} />
                    </div>

                    <div className="bg-white dark:bg-[#0a0a0b] border border-black/5 dark:border-white/5 rounded-[32px] p-6 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-5 flex items-center gap-2">
                            <Zap size={12} className="text-accent" /> QUICK_MAINTENANCE
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            <button onClick={runHanisahDiagnosis} disabled={isProcessing} className="p-4 bg-zinc-50 dark:bg-white/5 hover:bg-accent hover:text-on-accent border border-black/5 dark:border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-wider text-left transition-all flex items-center gap-3 group">
                                <Activity size={16} className="text-accent group-hover:text-on-accent transition-colors" /> 
                                <span>FULL_SYSTEM_SCAN</span>
                                <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <button onClick={runGhostScan} className="p-4 bg-zinc-50 dark:bg-white/5 hover:bg-amber-500 hover:text-white border border-black/5 dark:border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-wider text-left transition-all flex items-center gap-3 group">
                                <MousePointer2 size={16} className="text-amber-500 group-hover:text-white transition-colors" /> 
                                <span>SCAN_UI_ERRORS</span>
                                <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <button onClick={() => executeRepair('CLEAR_LOGS')} disabled={isProcessing} className="p-4 bg-zinc-50 dark:bg-white/5 hover:bg-red-500 hover:text-white border border-black/5 dark:border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-wider text-left transition-all flex items-center gap-3 group">
                                <Trash2 size={16} className="text-red-500 group-hover:text-white transition-colors" /> 
                                <span>CLEAR_LOGS</span>
                                <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-white dark:bg-[#0a0a0b] rounded-[32px] border border-black/5 dark:border-white/5 overflow-hidden flex flex-col shadow-sm">
                        <div className="p-5 border-b border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.02]">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">ACTIVE_PROVIDERS</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scroll">
                            {providers.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 m-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${p.status === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-red-500'}`}></div>
                                        <span className="text-[9px] font-black uppercase tracking-wider">{p.id}</span>
                                    </div>
                                    <span className="text-[9px] font-mono text-neutral-500">{p.keyCount} KEYS</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Console / Matrix */}
                <div className="flex-1 flex flex-col bg-[#050505] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden relative mb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    {activeTab === 'CONSOLE' ? (
                        <>
                            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scroll relative font-mono text-sm leading-relaxed" onClick={() => inputRef.current?.focus()}>
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`mb-4 animate-fade-in ${msg.role === 'user' ? 'text-neutral-400' : 'text-emerald-400'}`}>
                                        <span className="opacity-50 mr-2 select-none">{msg.role === 'user' ? '>' : '#'}</span>
                                        <span className="whitespace-pre-wrap">{msg.text}</span>
                                    </div>
                                ))}
                                {isProcessing && <div className="text-emerald-500 animate-pulse"># Processing...</div>}
                                <div ref={messagesEndRef} />
                            </div>
                            <div className="p-4 border-t border-white/10 bg-white/5 pb-[max(env(safe-area-inset-bottom),1rem)]">
                                <form onSubmit={(e) => { e.preventDefault(); handleCommand(); }} className="flex gap-2 relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-pulse">{'>'}</span>
                                    <textarea 
                                        ref={inputRef}
                                        value={input} 
                                        onChange={e => setInput(e.target.value)} 
                                        onKeyDown={handleKeyDown}
                                        placeholder="Type command..." 
                                        rows={1}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-8 pr-12 text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                                        autoFocus
                                    />
                                    <button type="submit" disabled={!input || isProcessing} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-white transition-colors disabled:opacity-30">
                                        <Send size={16} />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scroll bg-[#0a0a0b]">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {Object.values(uiMatrix).map((el: any) => (
                                    <UIElementNode 
                                        key={el.id} 
                                        id={el.id} 
                                        status={el.status} 
                                        errors={el.errorCount} 
                                        usage={el.usageCount}
                                        onToggle={() => toggleUIElement(el.id)} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
