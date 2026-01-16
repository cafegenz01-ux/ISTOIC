
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { 
    User, UserCheck, Database, Palette, Globe, Shield, 
    X, Check, LogOut, ChevronRight, Moon, Sun, Monitor,
    Save, RefreshCw, Cpu, Zap, Wifi, Activity, Layers, Download, Upload,
    Fingerprint, Lock, Key, Brain, Mic, Terminal, Sparkles, Server, ToggleLeft, ToggleRight, Edit3, CheckCircle2,
    KeyRound
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
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { FormField } from '../../components/ui/FormField';
import { authStyles } from '../auth/authStyles';
import { auth } from '../../services/firebaseConfig';
import { 
    updatePassword, 
    reauthenticateWithCredential, 
    EmailAuthProvider, 
    sendPasswordResetEmail 
} from 'firebase/auth';
import { 
    isSystemPinConfigured, 
    setSystemPin, 
    verifySystemPin 
} from '../../utils/crypto';

interface SettingsViewProps {
    onNavigate: (feature: FeatureID) => void;
}

// --- CONSTANTS ---
const THEME_COLORS: Record<string, string> = {
  cyan: '#00F0FF',
  lime: '#CCFF00',
  purple: '#BF00FF',
  orange: '#FF5F00',
  silver: '#94a3b8',
  blue: '#0066FF',
  green: '#00FF94',
  red: '#FF003C',
  pink: '#FF0099',
  gold: '#FFD700'
};

// --- OPTIMIZED SUB-COMPONENTS (Memoized) ---

const SettingsSection: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode, className?: string }> = memo(({ title, icon, children, className }) => (
    <div className={`space-y-4 ${className || ''}`}>
        <div className="flex items-center gap-2 opacity-80">
            {React.cloneElement(icon as React.ReactElement<any>, { size: 16 })}
            <h3 className="bento-card-title text-lg">{title}</h3>
        </div>
        <div className="space-y-3">
            {children}
        </div>
    </div>
));

const ToolRow: React.FC<{ label: string, desc: string, icon: React.ReactNode, isActive: boolean, onToggle: () => void }> = memo(({ label, desc, icon, isActive, onToggle }) => (
    <button 
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 rounded-[var(--radius-md)] border border-[color:var(--border)]/50 shadow-[var(--shadow-bento)] transition-all active:scale-[0.98] hover:-translate-y-0.5 ${isActive ? 'bg-[var(--surface)] ring-1 ring-[color:var(--accent)]/20' : 'bg-[var(--surface-2)]'}`}
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${isActive ? 'bg-accent/10 text-accent border-accent/40' : 'bg-surface text-text-muted border-border/60'}`}>
                {icon}
            </div>
            <div className="text-left">
                <div className="section-title text-text">{label}</div>
                <div className="caption text-text-muted">{desc}</div>
            </div>
        </div>
        {isActive ? <ToggleRight className="text-accent" size={20}/> : <ToggleLeft className="text-text-muted" size={20}/>}
    </button>
));

const ProviderToggleRow: React.FC<{ id: string, name: string, isVisible: boolean, onToggle: () => void }> = memo(({ id, name, isVisible, onToggle }) => {
    // Memoize key check if possible, or accept prop. For now calling lightweight getter is fine.
    const hasKey = !!KEY_MANAGER.getKey(id);
    return (
        <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-xl">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${hasKey ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></div>
                <div>
                    <div className="section-title text-text">{name}</div>
                    <div className="caption text-text-muted">{hasKey ? 'Connected' : 'Missing key'}</div>
                </div>
            </div>
            <button onClick={onToggle} disabled={!hasKey} className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-all active:scale-95 ${isVisible ? 'bg-accent/10 text-accent border-accent/20' : 'bg-surface-2 text-text-muted border-border'}`}>
                {isVisible ? 'Visible' : 'Hidden'}
            </button>
        </div>
    );
});

const PromptEditorModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    persona: 'hanisah' | 'stoic',
    currentPrompt: string,
    onSave: (val: string) => void,
    onReset: () => void
}> = memo(({ isOpen, onClose, persona, currentPrompt, onSave, onReset }) => {
    const [value, setValue] = useState(currentPrompt);
    
    useEffect(() => { setValue(currentPrompt); }, [currentPrompt]);

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title="System prompt"
            size="lg"
            footer={
                <div className="flex items-center justify-between w-full gap-3">
                    <span className="caption text-text-muted">{value.length} characters</span>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => { onReset(); onClose(); }}>
                            Reset default
                        </Button>
                        <Button variant="primary" onClick={() => { onSave(value); onClose(); }}>
                            Save
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-text-muted">
                    <Terminal size={16} />
                    <span className="caption">Editing {persona === 'hanisah' ? 'Hanisah' : 'Stoic'} prompt</span>
                </div>
                <Textarea
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    className="min-h-[260px] font-mono text-sm"
                    spellCheck={false}
                />
            </div>
        </Dialog>
    );
});

// --- MAIN VIEW ---

const SettingsView: React.FC<SettingsViewProps> = memo(({ onNavigate }) => {
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
    const [currentPromptToEdit, setCurrentPromptToEdit] = useState('');

    // UI State
    const [isSaving, setIsSaving] = useState(false);
    const [isBioAvailable, setIsBioAvailable] = useState(false);
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);
    const [newCodenameInput, setNewCodenameInput] = useState('');
    const [isEditingId, setIsEditingId] = useState(false);
    const [idUpdateMsg, setIdUpdateMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Password Change State
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    
    // PIN Change State
    const [showChangePin, setShowChangePin] = useState(false);
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinSuccess, setPinSuccess] = useState('');
    
    // Derived
    const currentLang = getLang();
    const t = TRANSLATIONS[currentLang].settings;

    useEffect(() => {
        BiometricService.isAvailable().then(setIsBioAvailable);
    }, []);

    const handleSavePersona = useCallback(() => {
        setIsSaving(true);
        debugService.logAction(UI_REGISTRY.SETTINGS_BTN_SAVE, FN_REGISTRY.SAVE_CONFIG, 'PERSONA_UPDATE');
        setTimeout(() => setIsSaving(false), 800);
    }, []);

    const handleAutoGenBio = useCallback(async () => {
        if(!localPersona.nama) return;
        setIsGeneratingBio(true);
        try {
            const prompt = `Generate a professional yet intriguing bio for a user named "${localPersona.nama}" who uses a high-tech Stoic AI terminal. Keep it under 20 words. Language: ${TRANSLATIONS[currentLang].meta.label}`;
            const res = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            if (res.text) setLocalPersona(prev => ({ ...prev, bio: res.text!.trim() }));
        } catch(e) {}
        setIsGeneratingBio(false);
    }, [localPersona.nama, currentLang, setLocalPersona]);

    const handleToggleBio = useCallback(async () => {
        if (bioEnabled) {
            setBioEnabled(false);
        } else {
            const success = await BiometricService.register(identity?.codename || 'User');
            if (success) setBioEnabled(true);
            else alert("Biometric registration failed.");
        }
    }, [bioEnabled, setBioEnabled, identity]);

    const handleResetPrompt = useCallback((persona: 'hanisah' | 'stoic') => {
        localStorage.removeItem(`${persona}_system_prompt`);
        alert("System prompt reset to factory default.");
    }, []);

    const handleSavePrompt = useCallback((persona: 'hanisah' | 'stoic', val: string) => {
        localStorage.setItem(`${persona}_system_prompt`, val);
    }, []);

    const handleOpenPromptEditor = useCallback(async (persona: 'hanisah' | 'stoic') => {
        setEditPersona(persona);
        const prompt = await HANISAH_BRAIN.getSystemInstruction(persona);
        setCurrentPromptToEdit(prompt);
        setIsPromptModalOpen(true);
    }, []);

    const handleBackup = useCallback(async () => {
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
    }, [localPersona, hanisahTools, stoicTools]);

    const handleRestore = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
    }, [setLocalPersona]);
    
    const handleChangeId = useCallback(async () => {
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
    }, [newCodenameInput, identity]);

    // Handlers for toggles to be used with useCallback to prevent re-renders of ToolRow
    const toggleHanisahVault = useCallback(() => setHanisahTools(p => ({...p, vault: !p.vault})), [setHanisahTools]);
    const toggleHanisahVisual = useCallback(() => setHanisahTools(p => ({...p, visual: !p.visual})), [setHanisahTools]);
    const toggleHanisahSearch = useCallback(() => setHanisahTools(p => ({...p, search: !p.search})), [setHanisahTools]);
    const toggleStoicVault = useCallback(() => setStoicTools(p => ({...p, vault: !p.vault})), [setStoicTools]);

    const handleProviderToggle = useCallback((id: string) => {
        setProviderVisibility(prev => ({ ...prev, [id]: !prev[id] }));
    }, [setProviderVisibility]);

    const handleChangePassword = useCallback(async () => {
        if (!auth || !auth.currentUser || !auth.currentUser.email) {
            setPasswordError('User not authenticated.');
            return;
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('All fields are required.');
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }

        setPasswordError('');
        setPasswordSuccess('');
        setIsSaving(true);

        try {
            const user = auth.currentUser;
            if (!user || !user.email) {
                setPasswordError('User not authenticated.');
                return;
            }

            // Re-authenticate user
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            
            // Update password
            await updatePassword(user, newPassword);
            
            // Send confirmation email
            try {
                await sendPasswordResetEmail(auth, user.email, {
                    url: window.location.origin,
                    handleCodeInApp: false,
                });
            } catch (e) {
                console.warn('Failed to send confirmation email', e);
            }
            
            setPasswordSuccess('Password changed successfully. Confirmation email sent.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setShowChangePassword(false);
                setPasswordSuccess('');
            }, 2000);
        } catch (e: any) {
            const errorMsg = e?.message || 'Failed to change password.';
            if (errorMsg.includes('wrong-password') || errorMsg.includes('invalid-credential')) {
                setPasswordError('Current password is incorrect.');
            } else {
                setPasswordError(errorMsg);
            }
        } finally {
            setIsSaving(false);
        }
    }, [currentPassword, newPassword, confirmPassword]);

    const handleChangePin = useCallback(async () => {
        if (!isSystemPinConfigured()) {
            setPinError('PIN not configured. Please set up PIN first.');
            return;
        }

        if (!currentPin || !newPin || !confirmPin) {
            setPinError('All fields are required.');
            return;
        }

        if (newPin.length < 4) {
            setPinError('PIN must be at least 4 digits.');
            return;
        }

        if (newPin !== confirmPin) {
            setPinError('New PINs do not match.');
            return;
        }

        // Verify current PIN
        const isValid = await verifySystemPin(currentPin);
        if (!isValid) {
            setPinError('Current PIN is incorrect.');
            return;
        }

        setPinError('');
        setPinSuccess('');
        setIsSaving(true);

        try {
            await setSystemPin(newPin);
            setPinSuccess('PIN changed successfully.');
            setCurrentPin('');
            setNewPin('');
            setConfirmPin('');
            
            // Send email notification if user has email
            if (auth && auth.currentUser && auth.currentUser.email) {
                try {
                    await sendPasswordResetEmail(auth, auth.currentUser.email, {
                        url: window.location.origin,
                        handleCodeInApp: false,
                    });
                } catch (e) {
                    console.warn('Failed to send PIN change notification email', e);
                }
            }
            
            setTimeout(() => {
                setShowChangePin(false);
                setPinSuccess('');
            }, 2000);
        } catch (e: any) {
            setPinError(e?.message || 'Failed to change PIN.');
        } finally {
            setIsSaving(false);
        }
    }, [currentPin, newPin, confirmPin]);

    return (
        <div className="h-full flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8 md:pt-12 lg:px-12 overflow-hidden font-sans animate-fade-in text-text relative">
            
            <PromptEditorModal 
                isOpen={isPromptModalOpen} 
                onClose={() => setIsPromptModalOpen(false)}
                persona={editPersona}
                currentPrompt={currentPromptToEdit}
                onSave={(val) => handleSavePrompt(editPersona, val)}
                onReset={() => handleResetPrompt(editPersona)}
            />

            <Card tone="bento-blue" padding="bento" bento className="bento-card mb-6 shadow-[0_30px_120px_-70px_rgba(var(--accent-rgb),0.9)]">
                <div className="bento-card-content">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="w-full space-y-3">
                            <p className="caption opacity-80 uppercase tracking-[0.2em]">Control Center</p>
                            <div className="flex items-center gap-3">
                                <div className="bento-card-icon">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h1 className="bento-card-title text-3xl">{t.title}</h1>
                                    <p className="bento-card-description">Manage appearance, identity, and security preferences.</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="neutral">{appLanguage.toUpperCase()}</Badge>
                                <Badge variant="neutral">{colorScheme}</Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button 
                                onClick={handleSavePersona}
                                disabled={isSaving}
                                variant="primary"
                                size="md"
                                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
                            >
                                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} {isSaving ? t.saved : t.save}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="flex-1 overflow-y-auto custom-scroll pr-2 space-y-2 pb-[calc(env(safe-area-inset-bottom)+4rem)]">
                <section className="bento-grid grid grid-cols-12 gap-[var(--bento-gap)]">
                
                {/* 1. VISUAL & LANGUAGE */}
                <div className="col-span-12">
                <Card tone="bento-purple" padding="bento" bento className="bento-card">
                    <div className="bento-card-content">
                        <SettingsSection title={t.theme_label || "Appearance & language"} icon={<Palette size={18} />}>
                    <div className="p-6 bg-[color:var(--surface)] rounded-[var(--bento-radius)] border border-[color:var(--border)]/50 grid grid-cols-1 md:grid-cols-2 gap-6 shadow-[var(--shadow-bento)]">
                        
                        {/* Theme Toggle */}
                        <div className="space-y-3">
                            <label className="caption text-[color:var(--text-muted)] pl-1">Color scheme</label>
                            <div className="flex bg-[color:var(--surface-2)] p-1 rounded-[var(--radius-lg)] border border-[color:var(--border)]">
                                {['light', 'system', 'dark'].map((mode) => (
                                    <button 
                                        key={mode}
                                        onClick={() => setColorScheme(mode as any)}
                                        className={`flex-1 py-2 rounded-[var(--radius-md)] text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 ${colorScheme === mode ? 'bg-[color:var(--surface)] text-[color:var(--primary)] shadow-sm border border-[color:var(--border)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]'}`}
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
                            <label className="caption text-[color:var(--text-muted)] pl-1 flex items-center gap-2">
                                <Globe size={12} /> Language
                            </label>
                            <div className="flex bg-[color:var(--surface-2)] p-1 rounded-[var(--radius-lg)] border border-[color:var(--border)]">
                                {['id', 'en', 'bn'].map((lang) => (
                                    <button 
                                        key={lang}
                                        onClick={() => { setAppLanguage(lang); window.location.reload(); }}
                                        className={`flex-1 py-2 rounded-[var(--radius-md)] text-sm font-semibold transition-all active:scale-95 ${appLanguage === lang ? 'bg-[color:var(--surface)] text-[color:var(--primary)] shadow-sm border border-[color:var(--border)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]'}`}
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ACCENT PALETTE */}
                        <div className="space-y-3 col-span-1 md:col-span-2 border-t border-[color:var(--border)] pt-4">
                            <label className="caption text-[color:var(--text-muted)] pl-1">Accent color</label>
                            <div className="flex flex-wrap gap-3 p-3 bg-[color:var(--surface-2)] rounded-[var(--radius-lg)] border border-[color:var(--border)]">
                                {Object.entries(THEME_COLORS).map(([key, color]) => (
                                    <button
                                        key={key}
                                        onClick={() => setAppTheme(key)}
                                        className={`relative w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center transform hover:scale-110 active:scale-95 ${appTheme === key ? 'border-[color:var(--text)] scale-110 shadow-lg' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                        aria-label={`Select ${key} theme`}
                                    >
                                        {appTheme === key && <CheckCircle2 size={16} className="text-black/50 mix-blend-hard-light" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </SettingsSection>
                    </div>
                </Card>
                </div>

                {/* 2. IDENTITY MATRIX */}
                <div className="col-span-12">
                <Card tone="bento-teal" padding="bento" bento className="bento-card">
                    <div className="bento-card-content">
                        <SettingsSection title={t.identity_title || "Profile"} icon={<UserCheck size={18} />}>
                    <div className="p-6 bg-[var(--surface)] rounded-[var(--bento-radius)] border border-[color:var(--border)]/50 space-y-6 shadow-[var(--shadow-bento)]">
                        
                        {/* ID EDITOR */}
                        <div className="space-y-3 pb-6 border-b border-[color:var(--border)]/50">
                            <label className="caption text-text-muted pl-1">Account ID</label>
                            {!isEditingId ? (
                                <div className="flex justify-between items-center bg-surface-2 p-4 rounded-2xl border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <span className="block text-sm font-black text-emerald-500 tracking-wider">
                                                {identity?.istokId || 'GUEST_USER'}
                                            </span>
                                            <span className="caption text-text-muted">{identity?.email || 'Local Session'}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsEditingId(true)} className="px-4 py-2 bg-surface rounded-xl text-sm font-semibold border border-border hover:border-emerald-500 hover:text-emerald-500 transition-all active:scale-95">
                                        Edit
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3 bg-surface-2 p-4 rounded-2xl border border-emerald-500/30">
                                    <div className="flex gap-2">
                                        <div className="flex-1 flex items-center bg-surface rounded-xl border border-border px-3 focus-within:border-emerald-500 transition-colors">
                                            <span className="caption font-semibold text-emerald-600 mr-2 select-none">ISTOIC-</span>
                                            <input 
                                                value={newCodenameInput}
                                                onChange={e => setNewCodenameInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                className="flex-1 bg-transparent py-3 text-sm font-bold outline-none uppercase text-text placeholder:text-text-muted"
                                                placeholder="NEW_CODENAME"
                                                maxLength={12}
                                                autoFocus
                                            />
                                        </div>
                                        <button onClick={handleChangeId} disabled={isSaving} className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 active:scale-95">
                                            {isSaving ? '...' : 'Save'}
                                        </button>
                                        <button onClick={() => setIsEditingId(false)} className="px-3 bg-surface border border-border rounded-xl text-text-muted hover:text-text transition-all active:scale-95">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    {idUpdateMsg && <p className={`caption ${idUpdateMsg.toLowerCase().includes('success') ? 'text-emerald-500' : 'text-danger'}`}>{idUpdateMsg}</p>}
                                </div>
                            )}
                        </div>

                        {/* Profile Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="caption text-text-muted pl-1 flex items-center gap-2">
                                    <User size={12}/> {t.user_name || "DISPLAY NAME"}
                                </label>
                                <Input 
                                    type="text" 
                                    value={localPersona.nama} 
                                    onChange={(e) => setLocalPersona({...localPersona, nama: e.target.value})} 
                                    className="text-sm font-semibold"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center pr-1">
                                    <label className="caption text-text-muted pl-1 flex items-center gap-2">
                                        <Database size={12}/> {t.user_bio || "CONTEXT"}
                                    </label>
                                    <button onClick={handleAutoGenBio} className="caption font-semibold text-accent flex items-center gap-1 hover:underline">
                                        {isGeneratingBio ? <RefreshCw size={12} className="animate-spin"/> : <Sparkles size={12}/>} Auto-generate
                                    </button>
                                </div>
                                <Input 
                                    type="text" 
                                    value={localPersona.bio} 
                                    onChange={(e) => setLocalPersona({...localPersona, bio: e.target.value})} 
                                    className="text-sm font-semibold"
                                />
                            </div>
                        </div>
                    </div>
                </SettingsSection>
                    </div>
                </Card>
                </div>

                {/* 3. ASSISTANT PERSONALITY */}
                <div className="col-span-12">
                <Card tone="bento-orange" padding="bento" bento className="bento-card">
                    <div className="bento-card-content">
                        <SettingsSection title="Assistant profile" icon={<Brain size={18} />}>
                    <div className="p-6 bg-[var(--surface)] rounded-[var(--bento-radius)] border border-[color:var(--border)]/50 shadow-[var(--shadow-bento)]">
                        <div className="flex bg-[var(--surface-2)] p-1 rounded-xl border border-[color:var(--border)]/50 mb-6 shadow-[var(--shadow-soft)]">
                             <button onClick={() => setActiveConfigTab('HANISAH')} className={`flex-1 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 ${activeConfigTab === 'HANISAH' ? 'bg-surface text-orange-500 shadow-sm' : 'text-text-muted hover:text-text'}`}>
                                <Zap size={12}/> Hanisah (Creative)
                             </button>
                             <button onClick={() => setActiveConfigTab('STOIC')} className={`flex-1 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 ${activeConfigTab === 'STOIC' ? 'bg-surface text-cyan-500 shadow-sm' : 'text-text-muted hover:text-text'}`}>
                                <Brain size={12}/> Stoic (Logic)
                             </button>
                        </div>

                        {activeConfigTab === 'HANISAH' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="caption text-text-muted">Voice</label>
                                    <select value={hanisahVoice} onChange={e => setHanisahVoice(e.target.value)} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500/50">
                                        <option value="Hanisah">Hanisah (Default)</option>
                                        <option value="Kore">Kore (Balanced)</option>
                                        <option value="Zephyr">Zephyr (Soft)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="caption text-text-muted">Capabilities</label>
                                    <ToolRow label="Vault access" desc="Allow reading and writing notes." icon={<Database size={14}/>} isActive={hanisahTools.vault} onToggle={toggleHanisahVault} />
                                    <ToolRow label="Visual generation" desc="Enable image generation and vision." icon={<Layers size={14}/>} isActive={hanisahTools.visual} onToggle={toggleHanisahVisual} />
                                    <ToolRow label="Web search" desc="Allow web search." icon={<Globe size={14}/>} isActive={hanisahTools.search} onToggle={toggleHanisahSearch} />
                                </div>
                                <Button onClick={() => handleOpenPromptEditor('hanisah')} variant="secondary" className="w-full mt-2">
                                    <Edit3 size={14}/> Edit system prompt
                                </Button>
                            </div>
                        )}

                        {activeConfigTab === 'STOIC' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="caption text-text-muted">Voice</label>
                                    <select value={stoicVoice} onChange={e => setStoicVoice(e.target.value)} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-500/50">
                                        <option value="Fenrir">Fenrir (Deep)</option>
                                        <option value="Puck">Puck (Clear)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="caption text-text-muted">Capabilities</label>
                                    <ToolRow label="Vault access" desc="Allow reading and writing notes." icon={<Database size={14}/>} isActive={stoicTools.vault} onToggle={toggleStoicVault} />
                                    <div className="p-3 rounded-xl border border-border bg-surface-2 opacity-50 flex items-center gap-3">
                                        <div className="p-2 bg-surface rounded-lg text-text-muted"><Layers size={14}/></div>
                                        <div><div className="text-sm font-semibold">Visual generation</div><div className="caption text-text-muted">Disabled for Stoic.</div></div>
                                    </div>
                                </div>
                                <Button onClick={() => handleOpenPromptEditor('stoic')} variant="secondary" className="w-full mt-2">
                                    <Edit3 size={14}/> Edit system prompt
                                </Button>
                            </div>
                        )}
                    </div>
                </SettingsSection>
                    </div>
                </Card>
                </div>

                {/* 4. NEURAL UPLINKS */}
                <div className="col-span-12">
                <Card tone="bento-green" padding="bento" bento className="bento-card">
                    <div className="bento-card-content">
                        <SettingsSection title="AI providers" icon={<Server size={18} />}>
                    <div className="p-6 bg-[var(--surface)] rounded-[var(--bento-radius)] border border-[color:var(--border)]/50 shadow-[var(--shadow-bento)] grid grid-cols-1 md:grid-cols-2 gap-3">
                        {['GEMINI', 'GROQ', 'OPENAI', 'DEEPSEEK', 'MISTRAL', 'HUGGINGFACE', 'ELEVENLABS'].map(p => (
                            <ProviderToggleRow 
                                key={p} 
                                id={p} 
                                name={p} 
                                isVisible={providerVisibility[p] !== false}
                                onToggle={() => handleProviderToggle(p)}
                            />
                        ))}
                    </div>
                </SettingsSection>
                    </div>
                </Card>
                </div>

                {/* 5. SECURITY PROTOCOLS */}
                <div className="col-span-12">
                <Card tone="bento-red" padding="bento" bento className="bento-card">
                    <div className="bento-card-content">
                        <SettingsSection title="Security" icon={<Lock size={18} />}>
                    <div className="p-6 bg-[var(--surface)] rounded-[var(--bento-radius)] border border-[color:var(--border)]/50 shadow-[var(--shadow-bento)] space-y-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[color:var(--border)]/50 shadow-[var(--shadow-soft)]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface rounded-lg text-text"><KeyRound size={16}/></div>
                                    <div>
                                        <div className="section-title text-text">System PIN</div>
                                        <div className="caption text-text-muted">
                                            {isSystemPinConfigured() ? 'SHA-256 encrypted' : 'Not configured'}
                                        </div>
                                    </div>
                                </div>
                                <Button 
                                    variant="secondary" 
                                    size="sm"
                                    onClick={() => setShowChangePin(!showChangePin)}
                                >
                                    {showChangePin ? 'Cancel' : isSystemPinConfigured() ? 'Change PIN' : 'Setup PIN'}
                                </Button>
                            </div>

                            {showChangePin && (
                                <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[color:var(--border)]/50 space-y-4 animate-slide-up shadow-[var(--shadow-soft)]">
                                    {isSystemPinConfigured() ? (
                                        <>
                                            <FormField label="Current PIN">
                                                <input
                                                    type="password"
                                                    inputMode="numeric"
                                                    value={currentPin}
                                                    onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                                    className={authStyles.input}
                                                    placeholder="Enter current PIN"
                                                />
                                            </FormField>
                                            <FormField label="New PIN">
                                                <input
                                                    type="password"
                                                    inputMode="numeric"
                                                    value={newPin}
                                                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                                    className={authStyles.input}
                                                    placeholder="Enter new PIN (min 4 digits)"
                                                />
                                            </FormField>
                                            <FormField label="Confirm New PIN">
                                                <input
                                                    type="password"
                                                    inputMode="numeric"
                                                    value={confirmPin}
                                                    onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                                    className={authStyles.input}
                                                    placeholder="Confirm new PIN"
                                                />
                                            </FormField>
                                        </>
                                    ) : (
                                        <>
                                            <FormField label="New PIN">
                                                <input
                                                    type="password"
                                                    inputMode="numeric"
                                                    value={newPin}
                                                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                                    className={authStyles.input}
                                                    placeholder="Enter new PIN (min 4 digits)"
                                                />
                                            </FormField>
                                            <FormField label="Confirm PIN">
                                                <input
                                                    type="password"
                                                    inputMode="numeric"
                                                    value={confirmPin}
                                                    onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                                    className={authStyles.input}
                                                    placeholder="Confirm PIN"
                                                />
                                            </FormField>
                                        </>
                                    )}
                                    {pinError && <p className="text-danger text-xs">{pinError}</p>}
                                    {pinSuccess && <p className="text-success text-xs">{pinSuccess}</p>}
                                    <Button
                                        onClick={handleChangePin}
                                        disabled={isSaving || (isSystemPinConfigured() && !currentPin) || !newPin || !confirmPin || newPin.length < 4}
                                        variant="primary"
                                        size="sm"
                                        className="w-full"
                                    >
                                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
                                        {isSaving ? 'Saving...' : isSystemPinConfigured() ? 'Change PIN' : 'Setup PIN'}
                                    </Button>
                                </div>
                            )}

                            {auth && auth.currentUser && auth.currentUser.email && (
                                <>
                                    <div className="flex items-center justify-between p-4 bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[color:var(--border)]/50 shadow-[var(--shadow-soft)]">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-surface rounded-lg text-text"><Lock size={16}/></div>
                                            <div>
                                                <div className="section-title text-text">Account Password</div>
                                                <div className="caption text-text-muted">Firebase authentication</div>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="secondary" 
                                            size="sm"
                                            onClick={() => setShowChangePassword(!showChangePassword)}
                                        >
                                            {showChangePassword ? 'Cancel' : 'Change Password'}
                                        </Button>
                                    </div>

                                    {showChangePassword && (
                                        <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[color:var(--border)]/50 space-y-4 animate-slide-up shadow-[var(--shadow-soft)]">
                                            <FormField label="Current Password">
                                                <input
                                                    type="password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    className={authStyles.input}
                                                    placeholder="Enter current password"
                                                />
                                            </FormField>
                                            <FormField label="New Password">
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className={authStyles.input}
                                                    placeholder="Enter new password (min 8 characters)"
                                                />
                                            </FormField>
                                            <FormField label="Confirm New Password">
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className={authStyles.input}
                                                    placeholder="Confirm new password"
                                                />
                                            </FormField>
                                            {passwordError && <p className="text-danger text-xs">{passwordError}</p>}
                                            {passwordSuccess && <p className="text-success text-xs">{passwordSuccess}</p>}
                                            <Button
                                                onClick={handleChangePassword}
                                                disabled={isSaving || !currentPassword || !newPassword || !confirmPassword || newPassword.length < 8}
                                                variant="primary"
                                                size="sm"
                                                className="w-full"
                                            >
                                                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                                                {isSaving ? 'Changing...' : 'Change Password'}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {isBioAvailable && (
                            <button 
                                onClick={handleToggleBio}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.98] ${bioEnabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-surface-2 border-border'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${bioEnabled ? 'bg-emerald-500 text-white' : 'bg-surface text-text-muted'}`}>
                                        <Fingerprint size={16}/>
                                    </div>
                                    <div className="text-left">
                                    <div className={`section-title ${bioEnabled ? 'text-emerald-500' : 'text-text'}`}>Biometric access</div>
                                    <div className="caption text-text-muted">Hardware security module</div>
                                    </div>
                                </div>
                                {bioEnabled ? <ToggleRight size={24} className="text-emerald-500"/> : <ToggleLeft size={24} className="text-text-muted"/>}
                            </button>
                        )}
                    </div>
                </SettingsSection>
                    </div>
                </Card>
                </div>

                {/* 6. DATA GOVERNANCE */}
                <div className="col-span-12">
                <Card tone="bento-blue" padding="bento" bento className="bento-card">
                    <div className="bento-card-content">
                        <SettingsSection title={t.data_title || "Data"} icon={<Database size={18} />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={handleBackup} className="p-4 bg-[var(--surface)] border border-[color:var(--border)]/50 hover:border-blue-500/50 rounded-[var(--bento-radius)] flex items-center gap-3 group transition-all active:scale-95 shadow-[var(--shadow-bento)]">
                            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors"><Download size={18}/></div>
                            <div className="text-left">
                                <h4 className="section-title text-text">{t.backup}</h4>
                                <p className="caption text-text-muted">Export local vault to JSON.</p>
                            </div>
                        </button>

                        <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-[var(--surface)] border border-[color:var(--border)]/50 hover:border-emerald-500/50 rounded-[var(--bento-radius)] flex items-center gap-3 group transition-all active:scale-95 shadow-[var(--shadow-bento)]">
                            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors"><Upload size={18}/></div>
                            <div className="text-left">
                                <h4 className="section-title text-text">{t.restore}</h4>
                                <p className="caption text-text-muted">Import JSON backup.</p>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="application/json" onChange={handleRestore} />
                        </button>

                        <button onClick={onNavigate.bind(null, 'system')} className="w-full p-4 bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-[color:var(--border)]/50 rounded-[var(--bento-radius)] flex items-center gap-3 group transition-all md:col-span-2 active:scale-[0.98] shadow-[var(--shadow-bento)]">
                             <div className="p-2.5 bg-surface text-text rounded-lg"><Activity size={18}/></div>
                             <div className="text-left">
                                <h4 className="section-title text-text">System diagnostics</h4>
                                <p className="caption text-text-muted">Check health and API status.</p>
                             </div>
                        </button>
                    </div>
                </SettingsSection>
                    </div>
                </Card>
                </div>

                </section>
            </div>
        </div>
    );
});

export default SettingsView;
