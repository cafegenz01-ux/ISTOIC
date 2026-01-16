import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Unlock, AlertCircle, Fingerprint, Settings } from 'lucide-react';
import { verifyVaultAccess, isSystemPinConfigured } from '../utils/crypto';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface VaultPinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const VaultPinModal: React.FC<VaultPinModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [isConfigured, setIsConfigured] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError(false);
            const configured = isSystemPinConfigured();
            setIsConfigured(configured);
            
            if (configured) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    }, [isOpen]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setVerifying(true);
        
        if (!isConfigured) {
            onSuccess();
            onClose();
            return;
        }

        const isValid = await verifyVaultAccess(pin);

        if (isValid) {
            onSuccess();
            onClose();
        } else {
            setError(true);
            setShake(true);
            setPin('');
            setTimeout(() => setShake(false), 500);
        }
        setVerifying(false);
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title="Vault access"
            size="sm"
            footer={
                <Button
                    onClick={() => handleSubmit()}
                    disabled={verifying}
                    color={error ? 'danger' : 'primary'}
                >
                    {isConfigured ? (error ? <Lock size={14} /> : <Unlock size={14} />) : <Settings size={14} />}
                    {isConfigured ? (verifying ? 'Verifying...' : (error ? 'Try again' : 'Unlock')) : 'Continue'}
                </Button>
            }
        >
            <div className="flex flex-col items-center gap-4">
                <div className={`w-16 h-16 rounded-[var(--radius-md)] flex items-center justify-center transition-all duration-300 ${error ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
                    {isConfigured ? (error ? <AlertCircle size={28} /> : <Shield size={28} />) : <Settings size={28} />}
                </div>

                <div className="text-center space-y-1">
                    <h3 className="section-title text-text">
                        {isConfigured ? (error ? 'Verification failed' : 'Enter your vault PIN') : 'Vault is not configured'}
                    </h3>
                    <p className="caption text-text-muted">
                        {isConfigured ? 'Use your PIN to access encrypted data.' : 'Set a PIN in Settings to enable vault protection.'}
                    </p>
                </div>

                {isConfigured ? (
                    <form onSubmit={handleSubmit} className="w-full relative">
                        <Input 
                            ref={inputRef}
                            type="password" 
                            value={pin}
                            onChange={(e) => { setPin(e.target.value); setError(false); }}
                            className={`w-full px-4 py-4 text-center tracking-[0.5em] text-lg font-semibold ${shake ? 'animate-[shake_0.5s_cubic-bezier(.36,.07,.19,.97)_both]' : ''}`}
                            placeholder="******"
                            maxLength={10}
                            autoComplete="off"
                            disabled={verifying}
                        />
                        <Fingerprint className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/50 pointer-events-none" size={20} />
                    </form>
                ) : (
                    <div className="text-center body text-text-muted px-2">
                        Vault protection is disabled. Configure a PIN in Settings to secure your data.
                    </div>
                )}
            </div>
            <style>{`
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
            `}</style>
        </Dialog>
    );
};
