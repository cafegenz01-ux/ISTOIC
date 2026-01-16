import React, { useState, useEffect, useMemo, useRef } from 'react';
import { debugService } from '../services/debugService';
import { KEY_MANAGER, type ProviderStatus } from '../services/geminiService';
import { LogEntry } from '../types';
import { 
    X, Terminal, Trash2, Activity, Search, Cpu, Wifi, Layers, 
    AlertTriangle, Maximize2, Minimize2, Copy, Play, Pause, 
    ChevronRight, ChevronDown, Command, ArrowRight, Zap, RefreshCw,
    Clock, ShieldCheck, ShieldAlert, PowerOff, Database, HardDrive, 
    Server, Globe, Key, Sparkles, Box
} from 'lucide-react';
import { useFeatures } from '../contexts/FeatureContext';
import useLocalStorage from '../hooks/useLocalStorage';

// --- HELPER: JSON TREE VIEW ---
const JsonTree: React.FC<{ data: any; level?: number }> = ({ data, level = 0 }) => {
    const [expanded, setExpanded] = useState(level < 1);
    
    if (typeof data !== 'object' || data === null) {
        const valueColor = typeof data === 'string' ? 'text-emerald-400' : typeof data === 'number' ? 'text-orange-400' : 'text-purple-400';
        return <span className={`${valueColor} break-all`}>{JSON.stringify(data)}</span>;
    }

    const isArray = Array.isArray(data);
    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;

    return (
        <div className="font-mono text-[10px] leading-relaxed ml-3 border-l border-white/5 pl-1">
            <div 
                className={`flex items-center gap-1 cursor-pointer hover:text-white ${isEmpty ? 'opacity-50 cursor-default' : 'text-neutral-400'}`} 
                onClick={() => !isEmpty && setExpanded(!expanded)}
            >
                {!isEmpty && (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
                <span className="text-neutral-500">{isArray ? '[' : '{'}</span>
                {!expanded && !isEmpty && <span className="text-neutral-600">...</span>}
                {isEmpty && <span className="text-neutral-500">{isArray ? ']' : '}'}</span>}
                {!isEmpty && !expanded && <span className="text-neutral-500">{isArray ? ']' : '}'}</span>}
                {!isEmpty && <span className="text-neutral-600 text-[8px] ml-2">({keys.length} items)</span>}
            </div>
            
            {expanded && !isEmpty && (
                <div className="my-0.5">
                    {keys.map((key) => (
                        <div key={key} className="flex items-start">
                            <span className="text-[var(--accent-color)] opacity-70 mr-2 shrink-0">{key}:</span>
                            <JsonTree data={data[key]} level={level + 1} />
                        </div>
                    ))}
                    <div className="text-neutral-500">{isArray ? ']' : '}'}</div>
                </div>
            )}
        </div>
    );
};

export const DebugConsole: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'STREAM' | 'UPLINK' | 'MEMORY'>('STREAM');
    const [health, setHealth] = useState<any>({ avgLatency: 0, memoryMb: 0, errorCount: 0 });
    const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
    const [storageKeys, setStorageKeys] = useState<string[]>([]);
    const [selectedStorageKey, setSelectedStorageKey] = useState<string | null>(null);
    const [storageValue, setStorageValue] = useState<any>(null);
    
    // UX States
    const [isExpanded, setIsExpanded] = useState(false);
    
    // PERSISTENT PAUSE STATE
    const [isFrozen, setIsFrozen] = useLocalStorage<boolean>('debug_console_frozen', false);
    
    const [cliInput, setCliInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const { features } = useFeatures();

    // Initial Data Load
    useEffect(() => {
        if (!isOpen) return;

        setLogs(debugService.getLogs());
        setProviderStatuses(KEY_MANAGER.getAllProviderStatuses());
        updateStorageList();
        
        let statInterval: any = null;

        if (features.AUTO_DIAGNOSTICS) {
            statInterval = setInterval(() => {
                setHealth(debugService.getSystemHealth());
                setProviderStatuses(KEY_MANAGER.getAllProviderStatuses());
            }, 1000);
        } else {
            setHealth(debugService.getSystemHealth());
        }

        const sub = debugService.subscribe((newLogs) => {
            if (!isFrozen) {
                setLogs(newLogs);
            }
        });

        return () => {
            if (statInterval) clearInterval(statInterval);
            sub();
        };
    }, [isOpen, features.AUTO_DIAGNOSTICS, isFrozen]);

    const updateStorageList = () => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('app_') || k === 'chat_threads' || k === 'notes' || k.includes('config') || k.includes('voice'));
        setStorageKeys(keys.sort());
    };

    const loadStorageValue = (key: string) => {
        setSelectedStorageKey(key);
        try {
            const raw = localStorage.getItem(key);
            setStorageValue(raw ? JSON.parse(raw) : null);
        } catch (e) {
            setStorageValue("Raw String: " + localStorage.getItem(key));
        }
    };

    // Auto-scroll logic (Active only when NOT frozen)
    useEffect(() => {
        if (!isFrozen && activeTab === 'STREAM' && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isFrozen, activeTab]);

    const handleCLI = (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = cliInput.trim().toLowerCase();
        if (!cmd) return;

        debugService.log('INFO', 'CLI', 'EXEC', `> ${cmd}`);

        switch (cmd) {
            case 'clear':
                debugService.clear();
                break;
            case 'refresh_keys':
                KEY_MANAGER.refreshPools();
                debugService.log('INFO', 'CLI', 'REFRESH', 'API Key pools reloaded from ENV.');
                break;
            case 'nuke_storage':
                if(confirm('WARNING: WIPE ALL LOCAL DATA? THIS CANNOT BE UNDONE.')) {
                    localStorage.clear();
                    window.location.reload();
                }
                break;
            case 'reload':
                window.location.reload();
                break;
            default:
                debugService.log('WARN', 'CLI', 'UKN', `Command unknown: ${cmd}`);
        }
        setCliInput('');
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesFilter = filter === 'ALL' || log.level === filter;
            const matchesSearch = searchQuery === '' || 
                JSON.stringify(log).toLowerCase().includes(searchQuery.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [logs, filter, searchQuery]);

    const getLevelBadge = (level: string) => {
        const baseClass = "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border";
        switch (level) {
            case 'ERROR': return `${baseClass} bg-red-500/10 border-red-500/30 text-red-500`;
            case 'WARN': return `${baseClass} bg-amber-500/10 border-amber-500/30 text-amber-500`;
            case 'INFO': return `${baseClass} bg-blue-500/10 border-blue-500/30 text-blue-500`;
            case 'KERNEL': return `${baseClass} bg-purple-500/10 border-purple-500/30 text-purple-500`;
            case 'TRACE': return `${baseClass} bg-zinc-500/10 border-zinc-500/30 text-zinc-500`;
            default: return `${baseClass} bg-zinc-500/10 border-zinc-500/30 text-zinc-500`;
        }
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-y-0 right-0 bg-terminal-void border-l border-white/10 z-[9999] shadow-2xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] tech-mono terminal-scanlines ${isExpanded ? 'w-full md:w-[80vw]' : 'w-full md:w-[450px]'}`}>
            
            {/* HEADER */}
            <header className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-white/[0.02] shrink-0 relative z-20">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isFrozen ? 'bg-amber-500' : 'bg-[var(--accent-color)] animate-pulse'} shadow-[0_0_10px_currentColor]`}></div>
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white">
                        KERNEL_DEBUG <span className="text-[var(--accent-color)]">v25.0</span>
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-white/10 rounded-lg text-neutral-500 hover:text-white transition-all hidden md:block">
                        {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-lg text-neutral-500 hover:text-red-500 transition-all">
                        <X size={16} />
                    </button>
                </div>
            </header>

            {/* NAV TABS */}
            <div className="flex border-b border-white/10 bg-black/20 shrink-0 relative z-20">
                {['STREAM', 'UPLINK', 'MEMORY'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-3 text-[9px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${
                            activeTab === tab 
                            ? 'border-[var(--accent-color)] text-white bg-white/5' 
                            : 'border-transparent text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.02]'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden relative z-10">
                
                {/* --- STREAM TAB --- */}
                {activeTab === 'STREAM' && (
                    <div className="flex flex-col h-full">
                        {/* Toolbar */}
                        <div className="p-2 border-b border-white/5 flex gap-2 shrink-0 bg-white/[0.02]">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600" size={12} />
                                <input 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="GREP LOGS..." 
                                    className="w-full bg-white/5 border border-white/5 rounded-lg py-1.5 pl-8 pr-2 text-[10px] text-white focus:outline-none focus:border-[var(--accent-color)] transition-all font-mono uppercase placeholder:text-neutral-700"
                                />
                            </div>
                            <select 
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="bg-white/5 border border-white/5 rounded-lg px-2 text-[10px] font-bold text-neutral-400 focus:outline-none focus:border-[var(--accent-color)] uppercase"
                            >
                                <option value="ALL">ALL LEVELS</option>
                                <option value="ERROR">ERRORS</option>
                                <option value="WARN">WARNINGS</option>
                                <option value="INFO">INFO</option>
                                <option value="TRACE">NETWORK</option>
                            </select>
                            <button 
                                onClick={() => setIsFrozen(!isFrozen)} 
                                className={`p-1.5 rounded-lg border transition-all ${isFrozen ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'border-white/5 text-neutral-600 hover:text-white'}`}
                                title={isFrozen ? "Resume Stream" : "Pause Stream"}
                            >
                                {isFrozen ? <Play size={14} /> : <Pause size={14} />}
                            </button>
                            <button onClick={() => debugService.clear()} className="p-1.5 rounded-lg border border-white/5 text-neutral-600 hover:text-red-500 hover:border-red-500/30 transition-all">
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Logs */}
                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2 space-y-1 custom-scroll relative">
                            {filteredLogs.map((log) => (
                                <div key={log.id} className="p-3 rounded-lg border border-white/5 hover:border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[8px] text-neutral-600 font-mono">{log.timestamp.split('T')[1].slice(0, -1)}</span>
                                        <div className={getLevelBadge(log.level)}>{log.level}</div>
                                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-wider">{log.layer}</span>
                                        {log.level === 'ERROR' && <AlertTriangle size={10} className="text-red-500 animate-pulse ml-auto" />}
                                    </div>
                                    <p className={`text-[10px] font-medium font-mono leading-relaxed break-words ${log.level === 'ERROR' ? 'text-red-300' : 'text-neutral-300'}`}>
                                        {log.message}
                                    </p>
                                    {log.payload && Object.keys(log.payload).length > 0 && (
                                        <div className="mt-2 pl-2 border-l-2 border-white/5">
                                            <JsonTree data={log.payload} />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isFrozen && (
                                <div className="sticky bottom-0 left-0 right-0 p-2 bg-amber-900/40 text-amber-500 text-[9px] font-black uppercase text-center border-t border-amber-500/30 backdrop-blur-md">
                                    STREAM PAUSED - {debugService.getLogs().length - logs.length} NEW LOGS HIDDEN
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>
                    </div>
                )}

                {/* --- UPLINK TAB (API PROVIDERS) --- */}
                {activeTab === 'UPLINK' && (
                    <div className="flex-1 overflow-y-auto p-4 custom-scroll space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Wifi size={10}/> LATENCY</p>
                                <p className="text-2xl font-black text-white">{health.avgLatency}<span className="text-xs text-neutral-600 ml-1">ms</span></p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1 flex items-center gap-2"><HardDrive size={10}/> MEMORY</p>
                                <p className="text-2xl font-black text-white">{health.memoryMb || 'N/A'}<span className="text-xs text-neutral-600 ml-1">MB</span></p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 border-b border-white/5 pb-2">ACTIVE_PROVIDERS</h3>
                            {providerStatuses.map((p) => {
                                const isHealthy = p.status === 'HEALTHY';
                                const isCooldown = p.status === 'COOLDOWN';
                                
                                return (
                                <div key={p.id} className={`p-4 rounded-xl border flex flex-col gap-3 transition-all ${
                                    isHealthy ? 'bg-emerald-500/5 border-emerald-500/20' : 
                                    isCooldown ? 'bg-amber-500/5 border-amber-500/20' : 
                                    'bg-red-500/5 border-red-500/20'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${
                                                isHealthy ? 'bg-emerald-500/10 text-emerald-500' : 
                                                isCooldown ? 'bg-amber-500/10 text-amber-500' : 
                                                'bg-red-500/10 text-red-500'
                                            }`}>
                                                {p.id.includes('GEMINI') ? <Sparkles size={16} /> : 
                                                 p.id.includes('OPENAI') ? <Cpu size={16} /> : 
                                                 p.id.includes('GROQ') ? <Zap size={16} /> : 
                                                 p.id.includes('OPENROUTER') ? <Globe size={16} /> : <Box size={16} />}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-wider text-white">{p.id}</h4>
                                                <p className={`text-[9px] font-bold uppercase flex items-center gap-1 ${
                                                    isHealthy ? 'text-emerald-400' : 
                                                    isCooldown ? 'text-amber-400' : 
                                                    'text-red-400'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400' : isCooldown ? 'bg-amber-400' : 'bg-red-400'} animate-pulse`}></span>
                                                    {p.status}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">POOL_SIZE</p>
                                            <div className="flex items-center justify-end gap-1 text-white font-mono text-xs">
                                                <Key size={10} className="text-[var(--accent-color)]" /> {p.keyCount}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {isCooldown && (
                                        <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg text-amber-500 text-[9px] font-bold border border-amber-500/20 animate-pulse">
                                            <Clock size={12} /> RESTORING ACCESS IN {p.cooldownRemaining} MIN
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>
                    </div>
                )}

                {/* --- MEMORY TAB (LOCAL STORAGE) --- */}
                {activeTab === 'MEMORY' && (
                    <div className="flex h-full">
                        <div className="w-1/3 border-r border-white/5 overflow-y-auto custom-scroll p-2 bg-black/20">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 px-2">STORAGE_KEYS</h3>
                            {storageKeys.map(k => (
                                <button 
                                    key={k} 
                                    onClick={() => loadStorageValue(k)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-[9px] font-mono truncate transition-all mb-1 ${
                                        selectedStorageKey === k 
                                        ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] border border-[var(--accent-color)]/30' 
                                        : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0b]">
                            {selectedStorageKey ? (
                                <>
                                    <div className="p-3 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                        <span className="text-[10px] font-bold text-white uppercase tracking-wider truncate mr-2">{selectedStorageKey}</span>
                                        <button 
                                            onClick={() => { localStorage.removeItem(selectedStorageKey); updateStorageList(); setSelectedStorageKey(null); }}
                                            className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                                            title="Delete Key"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 custom-scroll">
                                        <JsonTree data={storageValue} />
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 gap-2">
                                    <Database size={32} strokeWidth={1.5} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">SELECT_DATA_NODE</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* CLI FOOTER */}
            <div className="p-3 bg-[#0a0a0b] border-t border-white/10 shrink-0 relative z-20">
                <form onSubmit={handleCLI} className="relative flex items-center group">
                    <span className="absolute left-3 text-[var(--accent-color)] font-black text-xs animate-pulse">{'>'}</span>
                    <input 
                        type="text" 
                        value={cliInput}
                        onChange={(e) => setCliInput(e.target.value)}
                        placeholder="ENTER_COMMAND..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-12 text-[11px] text-white focus:outline-none focus:border-[var(--accent-color)]/50 focus:bg-white/10 transition-all font-mono placeholder:text-neutral-700"
                    />
                    <button type="submit" disabled={!cliInput} className="absolute right-2 p-1.5 bg-white/10 rounded-lg text-neutral-400 hover:text-white hover:bg-[var(--accent-color)]/20 transition-all disabled:opacity-0">
                        <ArrowRight size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};