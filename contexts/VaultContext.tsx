
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { isSystemPinConfigured } from '../utils/crypto';

interface VaultContextType {
    isVaultUnlocked: boolean;
    unlockVault: () => void;
    lockVault: () => void;
    isVaultConfigEnabled: (persona: 'hanisah' | 'stoic') => boolean;
    isPinSet: boolean;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Session-based state (resets on refresh for security)
    const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
    const [isPinSet, setIsPinSet] = useState(false);

    // Persistent Configs
    const [hanisahConfig] = useLocalStorage('hanisah_tools_config', { search: true, vault: true, visual: true });
    const [stoicConfig] = useLocalStorage('stoic_tools_config', { search: true, vault: true, visual: false });

    // Check PIN status on mount
    useEffect(() => {
        setIsPinSet(isSystemPinConfigured());
    }, []);

    const unlockVault = useCallback(() => setIsVaultUnlocked(true), []);
    const lockVault = useCallback(() => setIsVaultUnlocked(false), []);

    const isVaultConfigEnabled = useCallback((persona: 'hanisah' | 'stoic') => {
        return persona === 'hanisah' ? hanisahConfig.vault : stoicConfig.vault;
    }, [hanisahConfig, stoicConfig]);

    // SECURITY: Auto-lock if the active configuration disables the vault
    useEffect(() => {
        if (!hanisahConfig.vault && !stoicConfig.vault && isVaultUnlocked) {
            console.warn("[SECURITY] Vault disabled in settings. Locking session.");
            setIsVaultUnlocked(false);
        }
    }, [hanisahConfig, stoicConfig, isVaultUnlocked]);

    return (
        <VaultContext.Provider value={{ isVaultUnlocked, unlockVault, lockVault, isVaultConfigEnabled, isPinSet }}>
            {children}
        </VaultContext.Provider>
    );
};

export const useVault = () => {
    const context = useContext(VaultContext);
    if (!context) {
        throw new Error('useVault must be used within a VaultProvider');
    }
    return context;
};
