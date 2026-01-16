
import React from 'react';
import { Box, X } from 'lucide-react';

interface RawToggleProps {
    isActive: boolean;
    onToggle: () => void;
}

export const RawToggle: React.FC<RawToggleProps> = ({ isActive, onToggle }) => {
    return (
        <button
            onClick={onToggle}
            className={`
                fixed top-6 right-6 z-[9999] 
                w-12 h-12 rounded-full flex items-center justify-center 
                transition-all duration-500
                backdrop-blur-md
                ${isActive 
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-2xl' 
                    : 'bg-white/10 hover:bg-black/10 text-neutral-500 hover:text-black border border-black/5'
                }
            `}
            title={isActive ? "Close Raw Mode" : "Open Raw Mode"}
        >
            {isActive ? <X size={20} strokeWidth={1.5} /> : <Box size={20} strokeWidth={1.5} />}
        </button>
    );
};
