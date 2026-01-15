import React, { useState, useEffect, useRef } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { type Note } from '../../types';
import { type FeatureID } from '../../constants';
import { Activity, Brain, ChevronDown, ChevronRight, Database, DatabaseZap, FileText, Lock, Unlock, Zap } from 'lucide-react';
import { VaultPinModal } from '../../components/VaultPinModal';
import { useVault } from '../../contexts/VaultContext';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { debugService } from '../../services/debugService';
import { DailyStoicWidget } from './components/DailyStoicWidget';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../utils/cn';

interface DashboardProps {
    onNavigate: (feature: FeatureID) => void;
    notes: Note[];
    userName?: string;
    onLogout?: () => void;
}

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; helper?: string; onClick?: () => void; }> = ({ label, value, icon, helper, onClick }) => {
    const isInteractive = typeof onClick === 'function';
    return (
        <Card as={isInteractive ? 'button' : 'div'} interactive={isInteractive} padding="md" onClick={onClick} className={cn(
            'text-left w-full border-border/60 shadow-[var(--shadow-soft)] transition-all duration-200',
            isInteractive ? 'cursor-pointer hover:-translate-y-0.5' : ''
        )} aria-label={isInteractive ? `${label}: ${value}` : undefined}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                    <p className="caption text-text-muted">{label}</p>
                    <p className="section-title text-text">{value}</p>
                    {helper && <p className="caption text-text-muted mt-0.5">{helper}</p>}
                </div>
                <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-surface-2 border border-border flex items-center justify-center text-text-muted flex-shrink-0">
                    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 18, strokeWidth: 1.8 }) : icon}
                </div>
            </div>
        </Card>
    );
};

const FeatureCard: React.FC<{ title: string; desc: string; icon: React.ReactNode; onClick: () => void; className?: string; delay?: number; }> = ({ title, desc, icon, onClick, className, delay }) => (
    <Card as="button" interactive padding="lg" onClick={onClick} aria-label={`Open ${title}`} style={{ animationDelay: `${delay || 0}ms` }} className={cn(
        'text-left w-full animate-slide-up',
        'bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--surface-2)]',
        'border border-[color:var(--border)]/60 shadow-[var(--shadow-soft)]',
        'hover:-translate-y-1 active:translate-y-0 transition-transform duration-300',
        className
    )}>
        <div className="flex items-start justify-between gap-4 mb-6">
            <div className="w-12 h-12 rounded-[var(--radius-md)] bg-surface border border-border flex items-center justify-center text-text-muted">
                {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 22, strokeWidth: 1.7 }) : icon}
            </div>
            <ChevronRight size={18} className="text-text-muted flex-shrink-0" />
        </div>
        <div className="space-y-2">
            <h3 className="section-title text-text">{title}</h3>
            <p className="caption text-text-muted">{desc}</p>
        </div>
    </Card>
);

const DashboardView: React.FC<DashboardProps> = ({ onNavigate, notes, userName = 'Account', onLogout }) => {
    const { isVaultUnlocked, unlockVault, lockVault, isVaultConfigEnabled } = useVault();
    const [personaMode] = useLocalStorage<'hanisah' | 'stoic'>('ai_persona_mode', 'hanisah');
    const [language] = useLocalStorage<string>('app_language', 'id');
    const [showPinModal, setShowPinModal] = useState(false);
    const [syncLevel, setSyncLevel] = useState(0);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement | null>(null);
    const vaultEnabled = isVaultConfigEnabled(personaMode);

    useEffect(() => {
        const handleStatus = () => setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        let level = 20;
        if (isOnline) level += 30;
        if (isVaultUnlocked) level += 50;
        setSyncLevel(level);

        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, [isVaultUnlocked, isOnline]);

    useEffect(() => {
        if (!isAccountOpen) return;
        const handleClick = (event: MouseEvent) => {
            if (!accountMenuRef.current?.contains(event.target as Node)) {
                setIsAccountOpen(false);
            }
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsAccountOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [isAccountOpen]);

    const handleNavSystem = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BTN_SYSTEM_STATUS, FN_REGISTRY.OPEN_SYSTEM_MECHANIC, 'NAV_SYSTEM');
        onNavigate('system');
    };

    const handleNavNotes = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_CARD_NOTES, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'NOTES_QUICK_ACCESS');
        onNavigate('notes');
    };

    const handleNavArchive = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BENTO_ARCHIVE, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'NOTES_ARCHIVE');
        onNavigate('notes');
    };

    const handleNavChat = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BENTO_CHAT, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'CHAT');
        onNavigate('chat');
    };

    const handleNavTools = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BENTO_TOOLS, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'TOOLS');
        onNavigate('tools');
    };

    const handleToggleVault = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BTN_VAULT_TOGGLE, FN_REGISTRY.TOGGLE_VAULT_LOCK, isVaultUnlocked ? 'LOCK' : 'UNLOCK_ATTEMPT');
        if (!vaultEnabled) return;
        if (isVaultUnlocked) {
            lockVault();
        } else {
            setShowPinModal(true);
        }
    };

    const handleRecentNoteClick = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BTN_RECENT_LOGS, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'NOTES_FROM_RECENT');
        onNavigate('notes');
    };

    const t = {
        welcome: language === 'en' ? 'Welcome back' : 'Selamat datang kembali',
        uptime: language === 'en' ? 'Online' : 'Terhubung',
        offline: language === 'en' ? 'Offline' : 'Offline',
        nodes: language === 'en' ? 'Notes' : 'Catatan',
        focus: language === 'en' ? 'Sync' : 'Sinkronisasi',
        ready: language === 'en' ? 'Ready' : 'Siap',
        syncing: language === 'en' ? 'Syncing' : 'Sinkron',
        archiveTitle: language === 'en' ? 'Archive' : 'Arsip',
        archiveDesc: language === 'en' ? 'Long-term storage for finished notes.' : 'Penyimpanan jangka panjang untuk catatan selesai.',
        chatTitle: language === 'en' ? 'AI Assistant' : 'Asisten AI',
        chatDesc: language === 'en' ? 'Draft, summarize, and plan faster.' : 'Tulis, ringkas, dan rencanakan lebih cepat.',
        toolsTitle: language === 'en' ? 'AI Tools' : 'Alat AI',
        toolsDesc: language === 'en' ? 'Visual and utility tools in one place.' : 'Alat visual dan utilitas di satu tempat.',
        vault: language === 'en' ? 'Vault' : 'Vault',
        recent: language === 'en' ? 'Recent activity' : 'Aktivitas terbaru',
        recentEmpty: language === 'en' ? 'No recent notes yet.' : 'Belum ada catatan terbaru.',
        viewAll: language === 'en' ? 'View all' : 'Lihat semua',
        control: language === 'en' ? 'Vault' : 'Vault',
        vaultDescLocked: language === 'en' ? 'Your vault is locked. Unlock to access protected data.' : 'Vault terkunci. Buka untuk mengakses data terlindungi.',
        vaultDescUnlocked: language === 'en' ? 'Vault is unlocked. Remember to lock when finished.' : 'Vault terbuka. Kunci kembali setelah selesai.',
        vaultLocked: language === 'en' ? 'Locked' : 'Terkunci',
        vaultUnlocked: language === 'en' ? 'Unlocked' : 'Terbuka',
        vaultDisabled: language === 'en' ? 'Unavailable' : 'Tidak tersedia',
        vaultUnlock: language === 'en' ? 'Unlock vault' : 'Buka vault',
        vaultLock: language === 'en' ? 'Lock vault' : 'Kunci vault',
        systemStatus: language === 'en' ? 'Status' : 'Status',
        profile: language === 'en' ? 'Profile' : 'Profil',
        settings: language === 'en' ? 'Settings' : 'Pengaturan',
        logout: language === 'en' ? 'Logout' : 'Keluar',
        untitled: language === 'en' ? 'Untitled note' : 'Catatan tanpa judul',
        unknownDate: language === 'en' ? 'Unknown date' : 'Tanggal tidak diketahui'
    };

    const recentNotes = Array.isArray(notes) ? notes.slice(0, 3) : [];

    const formatDate = (iso?: string) => {
        if (!iso) return t.unknownDate;
        const date = new Date(iso);
        return isNaN(date.getTime()) ? t.unknownDate : date.toLocaleDateString();
    };

    const isReady = syncLevel >= 90;

    return (
        <div className="h-full w-full overflow-y-auto flex flex-col px-4 pt-safe pb-safe md:px-8 lg:px-10 animate-fade-in relative z-10">
            <VaultPinModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} onConfirm={unlockVault} />
            <div className="w-full max-w-6xl mx-auto space-y-8 py-6 md:py-8">
                <header className="space-y-6">
                    <Card padding="lg" className="border-border/40 bg-gradient-to-br from-surface to-surface-2">
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="space-y-2">
                                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-text">Dashboard</h1>
                                    <p className="body-sm text-text-muted">Polos, bersih, fokus pada tindakan cepat.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant={isOnline ? 'success' : 'warning'}>{isOnline ? t.uptime : t.offline}</Badge>
                                    <Badge variant="neutral">{Math.min(syncLevel, 100)}% sync</Badge>
                                    <Badge variant="neutral">{notes.length} catatan</Badge>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40">
                                <Button variant="secondary" size="sm" onClick={handleNavSystem} aria-label={t.systemStatus}>
                                    {t.systemStatus}
                                </Button>
                                <div className="relative ml-auto" ref={accountMenuRef}>
                                    <Button onClick={() => setIsAccountOpen((v) => !v)} variant="secondary" size="sm" className="flex items-center gap-2">
                                        {userName}
                                        <ChevronDown size={14} className={cn('transition-transform', isAccountOpen && 'rotate-180')} />
                                    </Button>
                                    {isAccountOpen && (
                                        <Card padding="sm" className="absolute top-full right-0 mt-2 w-48 border-border/60 shadow-[var(--shadow-soft)] z-20">
                                            <div className="space-y-1">
                                                <Button variant="ghost" size="sm" className="w-full justify-start text-text-muted hover:text-text" role="menuitem">
                                                    {t.profile}
                                                </Button>
                                                {onLogout && (
                                                    <Button variant="ghost" size="sm" className="w-full justify-start text-danger hover:bg-danger/10" onClick={() => {
                                                        setIsAccountOpen(false);
                                                        onLogout();
                                                    }} role="menuitem">
                                                        {t.logout}
                                                    </Button>
                                                )}
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                </header>
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard label={t.nodes} value={notes.length.toString().padStart(2, '0')} icon={<FileText />} onClick={handleNavNotes} />
                    <StatCard label={t.focus} value={`${syncLevel}%`} helper={isReady ? t.ready : t.syncing} icon={<Activity />} onClick={handleNavSystem} />
                    <StatCard label={t.vault} value={isVaultUnlocked ? t.vaultUnlocked : t.vaultLocked} helper={vaultEnabled ? t.control : t.vaultDisabled} icon={isVaultUnlocked ? <Unlock /> : <Lock />} onClick={vaultEnabled ? handleToggleVault : undefined} />
                </section>
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
                    <div className="md:col-span-2 lg:col-span-8">
                        <DailyStoicWidget />
                    </div>
                    <FeatureCard title={t.chatTitle} desc={t.chatDesc} icon={<Brain />} onClick={handleNavChat} className="md:col-span-1 lg:col-span-4 min-h-[220px]" delay={100} />
                    <FeatureCard title={t.archiveTitle} desc={t.archiveDesc} icon={<Database />} onClick={handleNavArchive} className="md:col-span-1 lg:col-span-4 min-h-[220px]" delay={200} />
                    <FeatureCard title={t.toolsTitle} desc={t.toolsDesc} icon={<Zap />} onClick={handleNavTools} className="md:col-span-2 lg:col-span-8 min-h-[220px]" delay={300} />
                    <Card padding="lg" className="md:col-span-2 lg:col-span-8 animate-slide-up border-border/60 shadow-[var(--shadow-soft)]" style={{ animationDelay: '400ms' }}>
                        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                            <h3 className="section-title text-text">{t.recent}</h3>
                            <Button variant="secondary" size="sm" onClick={handleNavNotes}>{t.viewAll}</Button>
                        </div>
                        <div className="space-y-3">
                            {recentNotes.map((note) => (
                                <button key={note.id} onClick={handleRecentNoteClick} onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleRecentNoteClick();
                                    }
                                }} className="w-full text-left flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-transparent hover:border-accent/20 hover:bg-surface-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40">
                                    <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-surface-2 border border-border flex items-center justify-center text-text-muted flex-shrink-0">
                                        <FileText size={18} strokeWidth={1.8} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="body text-text truncate">{note.title || t.untitled}</p>
                                        <p className="caption text-text-muted truncate">{formatDate(note.updated)}</p>
                                    </div>
                                    <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
                                </button>
                            ))}
                            {recentNotes.length === 0 && (
                                <p className="caption text-text-muted text-center py-6">{t.recentEmpty}</p>
                            )}
                        </div>
                    </Card>
                    <Card padding="lg" className="md:col-span-2 lg:col-span-4 animate-slide-up border-border/60 shadow-[var(--shadow-soft)]" style={{ animationDelay: '500ms' }}>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="w-12 h-12 rounded-[var(--radius-md)] bg-surface-2 border border-border flex items-center justify-center text-text-muted">
                                <DatabaseZap size={22} strokeWidth={1.7} />
                            </div>
                            <Badge variant={isVaultUnlocked ? 'success' : 'neutral'}>{isVaultUnlocked ? t.vaultUnlocked : t.vaultLocked}</Badge>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <h3 className="section-title text-text">{t.control}</h3>
                                <p className="caption text-text-muted mt-1">{isVaultUnlocked ? t.vaultDescUnlocked : t.vaultDescLocked}</p>
                            </div>
                        </div>
                        <Button onClick={vaultEnabled ? handleToggleVault : handleNavTools} variant={!vaultEnabled ? 'secondary' : isVaultUnlocked ? 'destructive' : 'primary'} size="lg" className={cn('mt-6 w-full', !vaultEnabled ? 'opacity-70' : '')} aria-label={!vaultEnabled ? t.vaultDisabled : isVaultUnlocked ? t.vaultLock : t.vaultUnlock}>
                            {isVaultUnlocked ? <Lock size={16}/> : <Unlock size={16}/>} {!vaultEnabled ? t.vaultDisabled : isVaultUnlocked ? t.vaultLock : t.vaultUnlock}
                        </Button>
                    </Card>
                </section>
            </div>
        </div>
    );
};

export default DashboardView;