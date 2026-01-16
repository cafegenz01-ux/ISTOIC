
import React, { createContext, useContext, useEffect, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { debugService } from '../services/debugService';

export type SystemFeature = 'OMNI_RACE' | 'LIVE_LINK' | 'VISUAL_ENGINE' | 'HIGH_PERF_UI' | 'AUTO_DIAGNOSTICS';

interface FeatureContextType {
    features: Record<SystemFeature, boolean>;
    toggleFeature: (feat: SystemFeature) => void;
    isFeatureEnabled: (feat: SystemFeature) => boolean;
}

const defaultFeatures: Record<SystemFeature, boolean> = {
    OMNI_RACE: true,       // Heavy Data
    LIVE_LINK: true,       // Heavy Battery/Net
    VISUAL_ENGINE: true,   // Moderate
    HIGH_PERF_UI: false,   // OPTIMIZATION: Default to LOW PERF (False) for lighter browser load
    AUTO_DIAGNOSTICS: true // Moderate CPU
};

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [features, setFeatures] = useLocalStorage<Record<SystemFeature, boolean>>('sys_feature_flags', defaultFeatures);

    const toggleFeature = (feat: SystemFeature) => {
        setFeatures(prev => {
            const newState = !prev[feat];
            debugService.log('INFO', 'SYS_CONFIG', 'TOGGLE', `${feat} switched to ${newState ? 'ON' : 'OFF'}`);
            return { ...prev, [feat]: newState };
        });
    };

    const isFeatureEnabled = (feat: SystemFeature) => {
        return features[feat] ?? defaultFeatures[feat];
    };

    // Apply Global Effects (e.g., High Perf UI)
    useEffect(() => {
        const root = document.documentElement;
        if (!features.HIGH_PERF_UI) {
            // Low Perf Mode: Disable blurs and reduce motion
            root.style.setProperty('--backdrop-blur', '0px');
            root.classList.add('reduce-motion');
            document.body.classList.add('low-perf');
        } else {
            root.style.removeProperty('--backdrop-blur');
            root.classList.remove('reduce-motion');
            document.body.classList.remove('low-perf');
        }
    }, [features.HIGH_PERF_UI]);

    return (
        <FeatureContext.Provider value={{ features, toggleFeature, isFeatureEnabled }}>
            {children}
        </FeatureContext.Provider>
    );
};

export const useFeatures = () => {
    const context = useContext(FeatureContext);
    if (!context) {
        throw new Error('useFeatures must be used within a FeatureProvider');
    }
    return context;
};
