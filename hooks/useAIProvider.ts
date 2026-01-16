
import { useState, useEffect, useCallback } from 'react';
import { KEY_MANAGER, type ProviderStatus } from '../services/geminiService';

export const useAIProvider = (providerId: string) => {
    const [providerInfo, setProviderInfo] = useState<ProviderStatus | undefined>(() => 
        KEY_MANAGER.getAllProviderStatuses().find(p => p.id === providerId)
    );

    const checkHealth = useCallback(() => {
        const info = KEY_MANAGER.getAllProviderStatuses().find(p => p.id === providerId);
        // Only update if something changed to avoid re-renders if utilizing deep comparison or similar upstream (React handles prims/refs well usually)
        // But here we set a new object every time from map. Let's rely on React's state update optimization or just set it.
        setProviderInfo(info);
    }, [providerId]);

    useEffect(() => {
        checkHealth();
        // Poll status to catch cooldown expiry or kill-switch activation
        const interval = setInterval(checkHealth, 3000);
        return () => clearInterval(interval);
    }, [checkHealth]);

    return {
        status: providerInfo?.status || 'OFFLINE',
        isHealthy: providerInfo?.status === 'HEALTHY',
        isCooldown: providerInfo?.status === 'COOLDOWN',
        keyCount: providerInfo?.keyCount || 0,
        cooldownRemaining: providerInfo?.cooldownRemaining || 0,
        providerId
    };
};
