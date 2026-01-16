
import React, { useState, useEffect } from 'react';
import { toDataURL } from 'qrcode';

interface SharedQRCodeProps {
    value: string;
    size?: number;
    className?: string;
}

export const SharedQRCode: React.FC<SharedQRCodeProps> = ({ value, size = 220, className = "" }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        if (!value) return;
        setError(false);
        
        // Generate QR with standard high-contrast settings
        // UPGRADE: Error Correction Level 'H' (High) ensures better scannability
        toDataURL(value, {
            width: size,
            margin: 1, 
            color: { 
                dark: '#000000', 
                light: '#FFFFFF' 
            },
            errorCorrectionLevel: 'H' 
        })
        .then(setImgSrc)
        .catch((err) => {
            console.error("QR Gen Error:", err);
            setError(true);
        });
    }, [value, size]);

    if (error) {
        return (
            <div 
                className={`bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500 text-[10px] font-mono ${className}`}
                style={{ width: size, height: size }}
            >
                QR_GEN_FAIL
            </div>
        );
    }

    if (!imgSrc) {
        return (
            <div 
                className={`bg-white/10 animate-pulse rounded-xl ${className}`} 
                style={{ width: size, height: size }}
            />
        );
    }

    // Wrapped in white container to ensure scannability (contrast) regardless of parent theme
    return (
        <div className={`bg-white p-3 rounded-xl shadow-md ${className}`} style={{ display: 'inline-block' }}>
            <img 
                src={imgSrc} 
                alt="QR Code" 
                className="block pointer-events-auto select-none rounded-sm"
                style={{ width: size, height: size }} 
            />
        </div>
    );
};
