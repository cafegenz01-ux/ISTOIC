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
import { BENTO_GRADIENTS } from '../../constants/bentoTheme';
import { appStyles } from '../auth/appStyles';

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
            isInteractive ? 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0' : ''
        )} aria-label={isInteractive ? `${label}: ${value}` : undefined}>
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
            <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[color:var(--surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--text-muted)]">
                {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 22, strokeWidth: 1.7 }) : icon}
            </div>
            <ChevronRight size={18} className="text-[color:var(--text-muted)] flex-shrink-0" />
        </div>
        <div className="space-y-2">
            <h3 className="section-title text-[color:var(--text)]">{title}</h3>
            <p className="caption text-[color:var(--text-muted)]">{desc}</p>
        </div>
    </Card>
);

const DashboardView: React.FC<DashboardProps> = ({ onNavigate, notes, userName = 'Account', onLogout }) => {
    const [language] = useLocalStorage<string>('app_language', 'id');
    const [showPinModal, setShowPinModal] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const { isVaultUnlocked, isVaultConfigEnabled, unlockVault } = useVault();
    const vaultEnabled = isVaultConfigEnabled('stoic'); // Default to stoic persona for dashboard
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const syncLevel = 95;

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

    const handleNavSystem = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BTN_RECENT_LOGS, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'SYSTEM_HEALTH');
        onNavigate('system');
    };

    const handleToggleVault = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BTN_VAULT_TOGGLE, FN_REGISTRY.TOGGLE_VAULT_LOCK, isVaultUnlocked ? 'LOCK' : 'UNLOCK_ATTEMPT');
        if (isVaultUnlocked) {
            // handle vault unlock
        } else {
            setShowPinModal(true);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
                setIsAccountOpen(false);
            }
        };
        if (isAccountOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isAccountOpen]);

    const t = {
        nodes: language === 'en' ? 'Notes' : 'Catatan',
        focus: language === 'en' ? 'Focus' : 'Fokus',
        ready: language === 'en' ? 'Ready' : 'Siap',
        syncing: language === 'en' ? 'Syncing...' : 'Sinkronisasi...',
        vault: language === 'en' ? 'Vault' : 'Vault',
        vaultUnlocked: language === 'en' ? 'Unlocked' : 'Terbuka',
        vaultLocked: language === 'en' ? 'Locked' : 'Terkunci',
        vaultDescUnlocked: language === 'en' ? 'Your vault is accessible.' : 'Vault Anda dapat diakses.',
        vaultDescLocked: language === 'en' ? 'Secure your sensitive notes.' : 'Amankan catatan sensitif Anda.',
        control: language === 'en' ? 'Vault Control' : 'Kontrol Vault',
        vaultDisabled: language === 'en' ? 'Vault disabled' : 'Vault dinonaktifkan',
        vaultLock: language === 'en' ? 'Lock vault' : 'Kunci vault',
        vaultUnlock: language === 'en' ? 'Unlock vault' : 'Buka vault',
        chatTitle: language === 'en' ? 'AI Assistant' : 'Asisten AI',
        chatDesc: language === 'en' ? 'Draft, summarize, and plan faster.' : 'Tulis, ringkas, dan rencanakan lebih cepat.',
        archiveTitle: language === 'en' ? 'Archive' : 'Arsip',
        archiveDesc: language === 'en' ? 'Long-term storage for finished notes.' : 'Penyimpanan jangka panjang untuk catatan selesai.',
        toolsTitle: language === 'en' ? 'AI Tools' : 'Alat AI',
        toolsDesc: language === 'en' ? 'Visual and utility tools in one place.' : 'Alat visual dan utilitas di satu tempat.',
        recent: language === 'en' ? 'Recent activity' : 'Aktivitas terbaru',
        recentEmpty: language === 'en' ? 'No recent notes yet.' : 'Belum ada catatan terbaru.',
        viewAll: language === 'en' ? 'View all' : 'Lihat semua',
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
        <div className={appStyles.page}>
            <VaultPinModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} onSuccess={unlockVault} />
            <div className={appStyles.container}>
                <div className="py-6 md:py-10">
                    {/* Header */}
                    <header className={appStyles.pageHeader}>
                        <div className={appStyles.card}>
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                                <div className="space-y-2">
                                    <h1 className={appStyles.titleLarge}>Dashboard</h1>
                                    <p className={appStyles.subtitle}>Polos, bersih, fokus pada tindakan cepat.</p>
                                </div>
                                <div className="relative" ref={accountMenuRef}>
                                    <button 
                                        onClick={() => setIsAccountOpen(!isAccountOpen)} 
                                        className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] hover:bg-[color:var(--surface-2)] transition-colors border border-[color:var(--border)]/50" 
                                        aria-label="Account menu"
                                    >
                                        <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[color:var(--surface-2)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--text-muted)] text-base font-semibold">
                                            {userName.charAt(0).toUpperCase()}
                                        </div>
                                        <ChevronDown size={18} className={`text-[color:var(--text-muted)] transition-transform ${isAccountOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isAccountOpen && (
                                        <div className={`${appStyles.cardCompact} absolute top-full right-0 mt-2 w-48 border-[color:var(--border)]/60 shadow-[var(--shadow-soft)] z-20`}> 
                                            <div className="space-y-1">
                                                <Button variant="ghost" size="sm" className="w-full justify-start text-[color:var(--text-muted)] hover:text-[color:var(--text)]" role="menuitem">{t.profile}</Button>
                                                {onLogout && (
                                                    <Button variant="ghost" size="sm" className="w-full justify-start text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10" onClick={() => { setIsAccountOpen(false); onLogout(); }} role="menuitem">{t.logout}</Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>
                {/* Premium Bento Grid */}
                <section className="bento-grid grid grid-cols-12 gap-[var(--bento-gap)] auto-rows-auto">
                    {/* Hero Card: Daily Stoic */}
                    <div className="col-span-12 md:col-span-8 row-span-2">
                        <DailyStoicWidget />
                    </div>
                    {/* Stat Cards: Bento style with gradients */}
                    <div className="col-span-6 md:col-span-4 flex flex-col gap-[var(--bento-gap)]">
                        <Card tone="bento-purple" padding="bento" interactive bento className="bento-card flex-1">
                            <div className="bento-card-content">
                                <div className="bento-card-icon">
                                    <FileText size={24} />
                                </div>
                                <p className="caption opacity-80 mb-1">{t.nodes}</p>
                                <p className="bento-card-title">{notes.length.toString().padStart(2, '0')}</p>
                            </div>
                        </Card>
                        <Card tone="bento-teal" padding="bento" interactive bento className="bento-card flex-1" onClick={handleNavSystem}>
                            <div className="bento-card-content">
                                <div className="bento-card-icon">
                                    <Activity size={24} />
                                </div>
                                <p className="caption opacity-80 mb-1">{t.focus}</p>
                                <p className="bento-card-title">{syncLevel}%</p>
                                <p className="bento-card-description mt-2">{isReady ? t.ready : t.syncing}</p>
                            </div>
                        </Card>
                        <Card tone={isVaultUnlocked ? "bento-green" : "bento-orange"} padding="bento" interactive={vaultEnabled} bento className="bento-card flex-1" onClick={vaultEnabled ? handleToggleVault : undefined}>
                            <div className="bento-card-content">
                                <div className="bento-card-icon">
                                    {isVaultUnlocked ? <Unlock size={24} /> : <Lock size={24} />}
                                </div>
                                <p className="caption opacity-80 mb-1">{t.vault}</p>
                                <p className="bento-card-title">{isVaultUnlocked ? t.vaultUnlocked : t.vaultLocked}</p>
                                <p className="bento-card-description mt-2">{vaultEnabled ? t.control : t.vaultDisabled}</p>
                            </div>
                        </Card>
                    </div>
                    {/* Feature Cards: Bento style with gradients */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-4">
                        <Card tone="bento-blue" padding="bento" interactive bento className="bento-card min-h-[180px] animate-slide-up" style={{ animationDelay: '100ms' }} onClick={handleNavChat}>
                            <div className="bento-card-content">
                                <div className="bento-card-icon">
                                    <Brain size={24} />
                                </div>
                                <h3 className="bento-card-title">{t.chatTitle}</h3>
                                <p className="bento-card-description">{t.chatDesc}</p>
                            </div>
                        </Card>
                    </div>
                    <div className="col-span-12 md:col-span-6 lg:col-span-4">
                        <Card tone="bento-teal" padding="bento" interactive bento className="bento-card min-h-[180px] animate-slide-up" style={{ animationDelay: '200ms' }} onClick={handleNavArchive}>
                            <div className="bento-card-content">
                                <div className="bento-card-icon">
                                    <Database size={24} />
                                </div>
                                <h3 className="bento-card-title">{t.archiveTitle}</h3>
                                <p className="bento-card-description">{t.archiveDesc}</p>
                            </div>
                        </Card>
                    </div>
                    <div className="col-span-12 lg:col-span-4">
                        <Card tone="bento-orange" padding="bento" interactive bento className="bento-card min-h-[180px] animate-slide-up" style={{ animationDelay: '300ms' }} onClick={handleNavTools}>
                            <div className="bento-card-content">
                                <div className="bento-card-icon">
                                    <Zap size={24} />
                                </div>
                                <h3 className="bento-card-title">{t.toolsTitle}</h3>
                                <p className="bento-card-description">{t.toolsDesc}</p>
                            </div>
                        </Card>
                    </div>
                    {/* Recent Notes: Bento card */}
                    <div className="col-span-12 md:col-span-8">
                        <Card padding="bento" bento className="bento-card animate-slide-up" style={{ animationDelay: '400ms' }}>
                            <div className="bento-card-content">
                                <div className="flex items-center justify-between border-b border-border/30 pb-4 mb-4">
                                    <h3 className="bento-card-title">{t.recent}</h3>
                                    <Button variant="secondary" size="sm" onClick={handleNavNotes}>{t.viewAll}</Button>
                                </div>
                                <div className="space-y-3">
                                    {recentNotes.map((note) => (
                                        <button 
                                            key={note.id || `note-${note.title}`} 
                                            onClick={() => onNavigate('notes')} 
                                            className="w-full p-3 rounded-[var(--radius-lg)] bg-[color:var(--surface-2)]/50 hover:bg-[color:var(--surface-2)] transition-colors text-left group backdrop-blur-sm border border-[color:var(--border)]/30" 
                                            aria-label={`Open note: ${note.title || t.untitled}`}
                                        > 
                                            <p className="section-title text-[color:var(--text)] group-hover:text-[color:var(--primary)] transition-colors">{note.title || t.untitled}</p>
                                            <p className="caption text-[color:var(--text-muted)] mt-1">{formatDate(note.created)}</p>
                                        </button>
                                    ))}
                                    {recentNotes.length === 0 && (
                                        <p className="caption text-[color:var(--text-muted)] text-center py-6">{t.recentEmpty}</p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                    {/* Vault Control Card: Bento style */}
                    <div className="col-span-12 md:col-span-4">
                        <Card padding="bento" bento className="bento-card animate-slide-up" style={{ animationDelay: '500ms' }}>
                            <div className="bento-card-content">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-[var(--radius-xl)] bg-surface-2 border border-border/50 flex items-center justify-center text-text-muted backdrop-blur-sm">
                                        <DatabaseZap size={22} strokeWidth={1.7} />
                                    </div>
                                    <Badge variant={isVaultUnlocked ? 'success' : 'neutral'}> {isVaultUnlocked ? t.vaultUnlocked : t.vaultLocked} </Badge>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="bento-card-title">{t.control}</h3>
                                        <p className="bento-card-description mt-1"> {isVaultUnlocked ? t.vaultDescUnlocked : t.vaultDescLocked} </p>
                                    </div>
                                </div>
                                <Button onClick={vaultEnabled ? handleToggleVault : handleNavTools} variant={!vaultEnabled ? 'secondary' : isVaultUnlocked ? 'destructive' : 'primary'} size="lg" className={cn('mt-6 w-full', !vaultEnabled ? 'opacity-70' : '')} aria-label={!vaultEnabled ? t.vaultDisabled : isVaultUnlocked ? t.vaultLock : t.vaultUnlock}>
                                    {isVaultUnlocked ? <Lock size={16} /> : <Unlock size={16} />} {!vaultEnabled ? t.vaultDisabled : isVaultUnlocked ? t.vaultLock : t.vaultUnlock}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default DashboardView;