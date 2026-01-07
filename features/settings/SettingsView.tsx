
import React, { useState, useEffect, useRef } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { 
    User, UserCheck, Database, Palette, Globe, Shield, 
    X, Check, LogOut, ChevronRight, Moon, Sun, Monitor,
    Save, RefreshCw, Cpu, Zap, Wifi, Activity, Layers, Download, Upload,
    Fingerprint, Lock, Key, Brain, Mic, Terminal, Sparkles, Server, ToggleLeft, ToggleRight, Edit3
} from 'lucide-react';
import { TRANSLATIONS, getLang } from '../../services/i18n';
import { IstokIdentityService } from '../istok/services/istokIdentity';
import { debugService } from '../../services/debugService';
import { getUserPersona } from '../../services/persona';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { useFeatures } from '../../contexts/FeatureContext';
import { db } from '../../services/storage';
import { KEY_MANAGER } from '../../services/geminiService';
import { BiometricService } from '../../services/biometricService';
import { HANISAH_KERNEL } from '../../services/melsaKernel';
import { HANISAH_BRAIN } from '../../services/melsaBrain';
import { type FeatureID } from '../../constants';

interface SettingsViewProps {
    onNavigate: (feature: FeatureID) => void;
}

// --- SUB-COMPONENTS ---

const SettingsSection: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode, className?: string }> = ({ title, icon, children, className }) => (
    <div className={`space-y-4 mb-8 ${className}`}>
        <div className="flex items-center gap-2 text-skin-muted px-2">
            {React.cloneElement(icon as React.ReactElement<any>, { size: 16 })}
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">{title}</h3>
        </div>
        <div className="space-y-3">
            {children}
        </div>
    </div>
);

const ToolRow: React.FC<{ label: string, desc: string, icon: React.ReactNode, isActive: boolean, onToggle: () => void }> = ({ label, desc, icon, isActive, onToggle }) => (
    <button 
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isActive ? 'bg-skin-surface border-accent/30' : 'bg-transparent border-skin-border opacity-60'}`}
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isActive ? 'bg-accent/10 text-accent' : 'bg-skin-surface text-skin-muted'}`}>
                {icon}
            </div>
            <div className="text-left">
                <div className="text-[10px] font-bold uppercase tracking-wider">{label}</div>
                <div className="text-[9px] text-skin-muted">{desc}</div>
            </div>
        </div>
        {isActive ? <ToggleRight className="text-accent" size={20}/> : <ToggleLeft className="text-skin-muted" size={20}/>}
    </button>
);

const ProviderToggleRow: React.FC<{ id: string, name: string, isVisible: boolean, onToggle: () => void }> = ({ id, name, isVisible, onToggle }) => {
    const hasKey = !!KEY_MANAGER.getKey(id);
    return (
        <div className="flex items-center justify-between p-3 bg-skin-card border border-skin-border rounded-xl">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${hasKey ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></div>
                <div>
                    <div className="text-[10px] font-black uppercase tracking-wider">{name}</div>
                    <div className="text-[8px] font-mono text-skin-muted">{hasKey ? 'CONNECTED' : 'MISSING_KEY'}</div>
                </div>
            </div>
            <button onClick={onToggle} disabled={!hasKey} className={`text-[9px] font-bold px-3 py-1 rounded-lg border transition-all ${isVisible ? 'bg-accent/10 text-accent border-accent/20' : 'bg-skin-surface text-skin-muted border-skin-border'}`}>
                {isVisible ? 'ACTIVE' : 'HIDDEN'}
            </button>
        </div>
    );
};

const PromptEditorModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    persona: 'hanisah' | 'stoic',
    currentPrompt: string,
    onSave: (val: string) => void,
    onReset: () => void
}> = ({ isOpen, onClose, persona, currentPrompt, onSave, onReset }) => {
    const [value, setValue] = useState(currentPrompt);
    
    useEffect(() => { setValue(currentPrompt); }, [currentPrompt]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-2xl bg-skin-card border border-skin-border rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-skin-border flex justify-between items-center bg-skin-surface">
                    <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-accent"/>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">SYSTEM_PROMPT_OVERRIDE</span>
                    </div>
                    <button onClick={onClose}><X size={18} className="text-skin-muted hover:text-skin-text"/></button>
                </div>
                <textarea 
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    className="flex-1 bg-[#0a0a0b] text-white font-mono text-xs p-6 resize-none focus:outline-none"
                    spellCheck={false}
                />
                <div className="p-4 border-t border-skin-border bg-skin-surface flex justify-between items-center">
                    <div className="text-[9px] font-mono text-skin-muted">{value.length} CHARS</div>
                    <div className="flex gap-2">
                        <button onClick={() => { onReset(); onClose(); }} className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[9px] font-bold transition-all">RESET DEFAULT</button>
                        <button onClick={() => { onSave(value); onClose(); }} className="px-6 py-2 rounded-lg bg-accent text-black font-black text-[9px] uppercase tracking-widest hover:brightness-110 transition-all">SAVE KERNEL</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN VIEW ---

const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
    // --- GLOBAL STATE ---
    const [localPersona, setLocalPersona] = useLocalStorage('user_persona_config', getUserPersona());
    const [appTheme, setAppTheme] = useLocalStorage('app_theme', 'cyan');
    const [appLanguage, setAppLanguage] = useLocalStorage('app_language', 'id');
    const [colorScheme, setColorScheme] = useLocalStorage('app_color_scheme', 'system');
    const [identity] = useLocalStorage<any>('istok_user_identity', null);
    
    // Security State
    const [bioEnabled, setBioEnabled] = useLocalStorage<boolean>('bio_auth_enabled', false);
    const [providerVisibility, setProviderVisibility] = useLocalStorage<Record<string, boolean>>('provider_visibility', {});

    // Persona Config State
    const [activeConfigTab, setActiveConfigTab] = useState<'HANISAH' | 'STOIC'>('HANISAH');
    const [hanisahVoice, setHanisahVoice] = useLocalStorage('hanisah_voice', 'Hanisah');
    const [stoicVoice, setStoicVoice] = useLocalStorage('stoic_voice', 'Fenrir');
    const [hanisahTools, setHanisahTools] = useLocalStorage('hanisah_tools_config', { search: true, vault: true, visual: true });
    const [stoicTools, setStoicTools] = useLocalStorage('stoic_tools_config', { search: true, vault: true, visual: false });
    
    // Prompt Editor State
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [editPersona, setEditPersona] = useState<'hanisah' | 'stoic'>('hanisah');

    // UI State
    const [isSaving, setIsSaving] = useState(false);
    const [isBioAvailable, setIsBioAvailable] = useState(false);
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);
    const [newCodenameInput, setNewCodenameInput] = useState('');
    const [isEditingId, setIsEditingId] = useState(false);
    const [idUpdateMsg, setIdUpdateMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Derived
    const currentLang = getLang();
    const t = TRANSLATIONS[currentLang].settings;

    useEffect(() => {
        BiometricService.isAvailable().then(setIsBioAvailable);
    }, []);

    const handleSavePersona = () => {
        setIsSaving(true);
        debugService.logAction(UI_REGISTRY.SETTINGS_BTN_SAVE, FN_REGISTRY.SAVE_CONFIG, 'PERSONA_UPDATE');
        setTimeout(() => setIsSaving(false), 800);
    };

    const handleAutoGenBio = async () => {
        if(!localPersona.nama) return;
        setIsGeneratingBio(true);
        try {
            const prompt = `Generate a professional yet intriguing bio for a user named "${localPersona.nama}" who uses a high-tech Stoic AI terminal. Keep it under 20 words. Language: ${TRANSLATIONS[currentLang].meta.label}`;
            const res = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            if (res.text) setLocalPersona(prev => ({ ...prev, bio: res.text!.trim() }));
        } catch(e) {}
        setIsGeneratingBio(false);
    };

    const handleToggleBio = async () => {
        if (bioEnabled) {
            setBioEnabled(false);
        } else {
            const success = await BiometricService.register(identity?.codename || 'User');
            if (success) setBioEnabled(true);
            else alert("Biometric registration failed.");
        }
    };

    const handleResetPrompt = (persona: 'hanisah' | 'stoic') => {
        localStorage.removeItem(`${persona}_system_prompt`);
        alert("System prompt reset to factory default.");
    };

    const handleSavePrompt = (persona: 'hanisah' | 'stoic', val: string) => {
        localStorage.setItem(`${persona}_system_prompt`, val);
    };

    const handleBackup = async () => {
        try {
            const notes = await db.getAll('NOTES');
            const chats = await db.getAll('CHATS');
            const backupData = {
                version: "1.0",
                timestamp: new Date().toISOString(),
                notes, chats, persona: localPersona,
                hanisahTools, stoicTools
            };
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `istoic_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) { alert("Backup Failed"); }
    };

    const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                if (data.notes) await db.saveAll('NOTES', data.notes);
                if (data.chats) await db.saveAll('CHATS', data.chats);
                if (data.persona) setLocalPersona(data.persona);
                alert("Restore Successful. Reloading...");
                window.location.reload();
            } catch (err) { alert("Invalid Backup File"); }
        };
        reader.readAsDataURL(file);
    };
    
    const handleChangeId = async () => {
        if (!newCodenameInput || newCodenameInput.length < 3) { setIdUpdateMsg("Min 3 chars."); return; }
        if (!identity?.uid) { setIdUpdateMsg("No User UID."); return; }
        setIsSaving(true);
        try {
            const res = await IstokIdentityService.updateCodename(identity.uid, newCodenameInput); 
            setIdUpdateMsg(res.msg);
            if (res.success) {
                setTimeout(() => { setIsEditingId(false); setIdUpdateMsg(''); window.location.reload(); }, 1500);
            }
        } catch (e: any) { setIdUpdateMsg(e.message); } 
        finally { setIsSaving(false); }
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-8 lg:p-12 pb-32 overflow-hidden font-sans animate-fade-in text-skin-text">
            
            <PromptEditorModal 
                isOpen={isPromptModalOpen} 
                onClose={() => setIsPromptModalOpen(false)}
                persona={editPersona}
                currentPrompt={HANISAH_BRAIN.getSystemInstruction(editPersona)}
                onSave={(val) => handleSavePrompt(editPersona, val)}
                onReset={() => handleResetPrompt(editPersona)}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-skin-border pb-6 shrink-0 gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase">
                        SYSTEM <span className="text-accent">CONFIG</span>
                    </h1>
                    <p className="text-[10px] tech-mono font-bold text-skin-muted uppercase tracking-[0.3em] mt-2">
                        {t.title}
                    </p>
                </div>
                <button 
                    onClick={handleSavePersona}
                    disabled={isSaving}
                    className="px-6 py-3 bg-skin-text text-skin-card hover:bg-accent hover:text-black rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} {isSaving ? t.saved : t.save}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll pr-2 space-y-2">
                
                {/* 1. VISUAL & LANGUAGE */}
                <SettingsSection title={t.theme_label || "VISUAL_INTERFACE"} icon={<Palette size={18} />}>
                    <div className="p-6 bg-skin-card rounded-[24px] border border-skin-border grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Theme Toggle */}
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest pl-1">COLOR SCHEME</label>
                            <div className="flex bg-skin-surface p-1 rounded-xl border border-skin-border">
                                {['light', 'system', 'dark'].map((mode) => (
                                    <button 
                                        key={mode}
                                        onClick={() => setColorScheme(mode as any)}
                                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${colorScheme === mode ? 'bg-skin-card text-accent shadow-sm border border-skin-border' : 'text-skin-muted hover:text-skin-text'}`}
                                    >
                                        {mode === 'light' && <Sun size={12} />}
                                        {mode === 'dark' && <Moon size={12} />}
                                        {mode === 'system' && <Monitor size={12} />}
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language */}
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest pl-1 flex items-center gap-2">
                                <Globe size={12} /> LANGUAGE
                            </label>
                            <div className="flex bg-skin-surface p-1 rounded-xl border border-skin-border">
                                {['id', 'en', 'bn'].map((lang) => (
                                    <button 
                                        key={lang}
                                        onClick={() => { setAppLanguage(lang); window.location.reload(); }}
                                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appLanguage === lang ? 'bg-skin-card text-accent shadow-sm border border-skin-border' : 'text-skin-muted hover:text-skin-text'}`}
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                {/* 2. IDENTITY MATRIX */}
                <SettingsSection title={t.identity_title || "USER PROFILE"} icon={<UserCheck size={18} />}>
                    <div className="p-6 bg-skin-card rounded-[24px] border border-skin-border space-y-6">
                        
                        {/* ID EDITOR */}
                        <div className="space-y-3 pb-6 border-b border-skin-border">
                            <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest pl-1">ISTOIC ID (CODENAME)</label>
                            {!isEditingId ? (
                                <div className="flex justify-between items-center bg-skin-surface p-4 rounded-2xl border border-skin-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <span className="block text-sm font-black text-emerald-500 tracking-wider">
                                                {identity?.istokId || 'GUEST_USER'}
                                            </span>
                                            <span className="text-[9px] text-skin-muted font-mono">{identity?.email || 'Local Session'}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsEditingId(true)} className="px-4 py-2 bg-skin-card rounded-xl text-[9px] font-bold border border-skin-border hover:border-emerald-500 hover:text-emerald-500 transition-all uppercase tracking-wider">
                                        CHANGE ID
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3 bg-skin-surface p-4 rounded-2xl border border-emerald-500/30">
                                    <div className="flex gap-2">
                                        <div className="flex-1 flex items-center bg-skin-card rounded-xl border border-skin-border px-3 focus-within:border-emerald-500 transition-colors">
                                            <span className="text-[10px] font-black text-emerald-600 mr-2 select-none">ISTOIC-</span>
                                            <input 
                                                value={newCodenameInput}
                                                onChange={e => setNewCodenameInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                className="flex-1 bg-transparent py-3 text-sm font-bold outline-none uppercase text-skin-text placeholder:text-skin-muted"
                                                placeholder="NEW_CODENAME"
                                                maxLength={12}
                                                autoFocus
                                            />
                                        </div>
                                        <button onClick={handleChangeId} disabled={isSaving} className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all disabled:opacity-50">
                                            {isSaving ? '...' : 'SAVE'}
                                        </button>
                                        <button onClick={() => setIsEditingId(false)} className="px-3 bg-skin-card border border-skin-border rounded-xl text-skin-muted hover:text-skin-text transition-all">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    {idUpdateMsg && <p className={`text-[10px] font-bold uppercase tracking-wide ${idUpdateMsg.toLowerCase().includes('success') ? 'text-emerald-500' : 'text-red-500'}`}>{idUpdateMsg}</p>}
                                </div>
                            )}
                        </div>

                        {/* Profile Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest pl-1 flex items-center gap-2">
                                    <User size={12}/> {t.user_name || "DISPLAY NAME"}
                                </label>
                                <input 
                                    type="text" 
                                    value={localPersona.nama} 
                                    onChange={(e) => setLocalPersona({...localPersona, nama: e.target.value})} 
                                    className="w-full bg-skin-surface border border-skin-border rounded-2xl px-5 py-4 text-sm font-bold text-skin-text focus:outline-none focus:border-accent/50 focus:bg-skin-card transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center pr-1">
                                    <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest pl-1 flex items-center gap-2">
                                        <Database size={12}/> {t.user_bio || "CONTEXT"}
                                    </label>
                                    <button onClick={handleAutoGenBio} className="text-[9px] font-bold text-accent flex items-center gap-1 hover:underline">
                                        {isGeneratingBio ? <RefreshCw size={10} className="animate-spin"/> : <Sparkles size={10}/>} AUTO-GEN
                                    </button>
                                </div>
                                <input 
                                    type="text" 
                                    value={localPersona.bio} 
                                    onChange={(e) => setLocalPersona({...localPersona, bio: e.target.value})} 
                                    className="w-full bg-skin-surface border border-skin-border rounded-2xl px-5 py-4 text-sm font-bold text-skin-text focus:outline-none focus:border-accent/50 focus:bg-skin-card transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                {/* 3. ASSISTANT PERSONALITY */}
                <SettingsSection title="ASSISTANT_PERSONALITY" icon={<Brain size={18} />}>
                    <div className="p-6 bg-skin-card rounded-[24px] border border-skin-border">
                        <div className="flex bg-skin-surface p-1 rounded-xl border border-skin-border mb-6">
                             <button onClick={() => setActiveConfigTab('HANISAH')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeConfigTab === 'HANISAH' ? 'bg-skin-card text-orange-500 shadow-sm' : 'text-skin-muted hover:text-skin-text'}`}>
                                <Zap size={12}/> HANISAH (CREATIVE)
                             </button>
                             <button onClick={() => setActiveConfigTab('STOIC')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeConfigTab === 'STOIC' ? 'bg-skin-card text-cyan-500 shadow-sm' : 'text-skin-muted hover:text-skin-text'}`}>
                                <Brain size={12}/> LOGIC CORE
                             </button>
                        </div>

                        {activeConfigTab === 'HANISAH' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest">VOICE MODULE</label>
                                    <select value={hanisahVoice} onChange={e => setHanisahVoice(e.target.value)} className="w-full bg-skin-surface border border-skin-border rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-orange-500/50">
                                        <option value="Hanisah">Hanisah (Default)</option>
                                        <option value="Kore">Kore (Balanced)</option>
                                        <option value="Zephyr">Zephyr (Soft)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest">CAPABILITIES</label>
                                    <ToolRow label="VAULT ACCESS" desc="Allow reading/writing notes" icon={<Database size={14}/>} isActive={hanisahTools.vault} onToggle={() => setHanisahTools({...hanisahTools, vault: !hanisahTools.vault})} />
                                    <ToolRow label="VISUAL CORTEX" desc="Image Generation & Vision" icon={<Layers size={14}/>} isActive={hanisahTools.visual} onToggle={() => setHanisahTools({...hanisahTools, visual: !hanisahTools.visual})} />
                                    <ToolRow label="WEB UPLINK" desc="Google Search Access" icon={<Globe size={14}/>} isActive={hanisahTools.search} onToggle={() => setHanisahTools({...hanisahTools, search: !hanisahTools.search})} />
                                </div>
                                <button onClick={() => { setEditPersona('hanisah'); setIsPromptModalOpen(true); }} className="w-full py-3 mt-2 border border-orange-500/20 text-orange-500 hover:bg-orange-500/10 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                    <Edit3 size={12}/> EDIT SYSTEM PROMPT
                                </button>
                            </div>
                        )}

                        {activeConfigTab === 'STOIC' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest">VOICE MODULE</label>
                                    <select value={stoicVoice} onChange={e => setStoicVoice(e.target.value)} className="w-full bg-skin-surface border border-skin-border rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-cyan-500/50">
                                        <option value="Fenrir">Fenrir (Deep)</option>
                                        <option value="Puck">Puck (Clear)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest">CAPABILITIES</label>
                                    <ToolRow label="VAULT ACCESS" desc="Allow reading/writing notes" icon={<Database size={14}/>} isActive={stoicTools.vault} onToggle={() => setStoicTools({...stoicTools, vault: !stoicTools.vault})} />
                                    <div className="p-3 rounded-xl border border-skin-border bg-skin-surface opacity-50 flex items-center gap-3">
                                        <div className="p-2 bg-skin-card rounded-lg text-skin-muted"><Layers size={14}/></div>
                                        <div><div className="text-[10px] font-bold">VISUAL CORTEX</div><div className="text-[9px]">Disabled for Logic Core</div></div>
                                    </div>
                                </div>
                                <button onClick={() => { setEditPersona('stoic'); setIsPromptModalOpen(true); }} className="w-full py-3 mt-2 border border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/10 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                    <Edit3 size={12}/> EDIT SYSTEM PROMPT
                                </button>
                            </div>
                        )}
                    </div>
                </SettingsSection>

                {/* 4. NEURAL UPLINKS */}
                <SettingsSection title="NEURAL_UPLINKS" icon={<Server size={18} />}>
                    <div className="p-6 bg-skin-card rounded-[24px] border border-skin-border grid grid-cols-1 md:grid-cols-2 gap-3">
                        {['GEMINI', 'GROQ', 'OPENAI', 'DEEPSEEK', 'MISTRAL', 'HUGGINGFACE', 'ELEVENLABS'].map(p => (
                            <ProviderToggleRow 
                                key={p} 
                                id={p} 
                                name={p} 
                                isVisible={providerVisibility[p] !== false}
                                onToggle={() => setProviderVisibility(prev => ({ ...prev, [p]: !prev[p] }))}
                            />
                        ))}
                    </div>
                </SettingsSection>

                {/* 5. SECURITY PROTOCOLS */}
                <SettingsSection title="SECURITY_PROTOCOLS" icon={<Lock size={18} />}>
                    <div className="p-6 bg-skin-card rounded-[24px] border border-skin-border space-y-4">
                        <div className="flex items-center justify-between p-4 bg-skin-surface rounded-xl border border-skin-border">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-skin-card rounded-lg text-skin-text"><Key size={16}/></div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-wider">VAULT PIN</div>
                                    <div className="text-[9px] text-skin-muted">SHA-256 ENCRYPTED</div>
                                </div>
                            </div>
                            <button className="text-[9px] font-bold px-4 py-2 bg-skin-card border border-skin-border rounded-lg hover:border-accent/50 transition-all">RESET PIN</button>
                        </div>

                        {isBioAvailable && (
                            <button 
                                onClick={handleToggleBio}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${bioEnabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-skin-surface border-skin-border'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${bioEnabled ? 'bg-emerald-500 text-white' : 'bg-skin-card text-skin-muted'}`}>
                                        <Fingerprint size={16}/>
                                    </div>
                                    <div className="text-left">
                                        <div className={`text-[10px] font-black uppercase tracking-wider ${bioEnabled ? 'text-emerald-500' : 'text-skin-text'}`}>BIOMETRIC ACCESS</div>
                                        <div className="text-[9px] text-skin-muted">Hardware Security Module</div>
                                    </div>
                                </div>
                                {bioEnabled ? <ToggleRight size={24} className="text-emerald-500"/> : <ToggleLeft size={24} className="text-skin-muted"/>}
                            </button>
                        )}
                    </div>
                </SettingsSection>

                {/* 6. DATA GOVERNANCE */}
                <SettingsSection title={t.data_title || "DATA GOVERNANCE"} icon={<Database size={18} />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={handleBackup} className="p-4 bg-skin-card border border-skin-border hover:border-blue-500/50 rounded-2xl flex items-center gap-3 group transition-all">
                            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors"><Download size={18}/></div>
                            <div className="text-left">
                                <h4 className="text-[10px] font-black text-skin-text uppercase tracking-widest">{t.backup}</h4>
                                <p className="text-[9px] text-skin-muted">Export local vault to JSON.</p>
                            </div>
                        </button>

                        <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-skin-card border border-skin-border hover:border-emerald-500/50 rounded-2xl flex items-center gap-3 group transition-all">
                            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors"><Upload size={18}/></div>
                            <div className="text-left">
                                <h4 className="text-[10px] font-black text-skin-text uppercase tracking-widest">{t.restore}</h4>
                                <p className="text-[9px] text-skin-muted">Import JSON backup.</p>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="application/json" onChange={handleRestore} />
                        </button>

                        <button onClick={onNavigate.bind(null, 'system')} className="w-full p-4 bg-skin-surface hover:bg-skin-surface-hover border border-skin-border rounded-2xl flex items-center gap-3 group transition-all md:col-span-2">
                             <div className="p-2.5 bg-skin-card text-skin-text rounded-lg"><Activity size={18}/></div>
                             <div className="text-left">
                                <h4 className="text-[10px] font-black text-skin-text uppercase tracking-widest">SYSTEM DIAGNOSTICS</h4>
                                <p className="text-[9px] text-skin-muted">Check Kernel Health & API Status.</p>
                             </div>
                        </button>
                    </div>
                </SettingsSection>

            </div>
        </div>
    );
};

export default SettingsView;
