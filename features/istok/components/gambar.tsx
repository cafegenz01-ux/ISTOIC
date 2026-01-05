
import React, { useState, useEffect } from 'react';
import { Maximize2, AlertCircle, Loader2, Download, Image as ImageIcon, Lock, Eye, EyeOff } from 'lucide-react';

// --- UTILS: HIGH-PERFORMANCE IMAGE COMPRESSION ---

/**
 * Compresses image to WebP format, max 800px dimension.
 * Maintains aspect ratio and handles safe memory cleanup.
 * Optimized for P2P Data Channels (Target < 100KB).
 */
export const compressImage = (file: File): Promise<{base64: string, size: number, width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            // 1. Calculate Dimensions (Max 800px for speed/stability)
            const MAX_DIM = 800; 
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_DIM) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                }
            } else {
                if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }
            }

            // 2. Draw to Canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Canvas context failed"));
                return;
            }

            // Smooth scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            URL.revokeObjectURL(objectUrl);

            // 3. Compress to WebP (Quality 0.7 is sweet spot for P2P)
            const base64 = canvas.toDataURL('image/webp', 0.7); 
            
            // Calculate approximate size in bytes
            const head = 'data:image/webp;base64,';
            const size = Math.round((base64.length - head.length) * 3 / 4);

            resolve({ base64, size, width, height });
        };
        
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };

        img.src = objectUrl;
    });
};

// --- COMPONENT: ROBUST IMAGE BUBBLE ---

interface ImageMessageProps {
    content: string; // Base64 Data URL
    size?: number;
    onClick: () => void;
    onReveal?: () => void; // Trigger for Burn-on-View
}

export const ImageMessage = React.memo(({ content, size, onClick, onReveal }: ImageMessageProps) => {
    const [status, setStatus] = useState<'LOADING' | 'LOADED' | 'ERROR'>('LOADING');
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.src = content;
        img.onload = () => setStatus('LOADED');
        img.onerror = () => setStatus('ERROR');
    }, [content]);

    const handleReveal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRevealed(true);
        if (onReveal) onReveal(); // Trigger burner only when revealed
    };

    return (
        <div 
            className={`
                relative overflow-hidden rounded-xl border border-white/10 group cursor-pointer transition-all duration-300
                ${status === 'LOADING' ? 'bg-white/5 animate-pulse w-48 h-48' : 'bg-black'}
                ${status === 'ERROR' ? 'bg-red-500/10 border-red-500/30' : 'hover:border-emerald-500/50'}
                max-w-[280px] md:max-w-[320px]
            `}
            onClick={() => { if(isRevealed) onClick(); }}
        >
            {/* 1. LOADING STATE */}
            {status === 'LOADING' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <Loader2 size={24} className="text-neutral-500 animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">DECRYPTING...</span>
                </div>
            )}

            {/* 2. ERROR STATE */}
            {status === 'ERROR' && (
                <div className="flex flex-col items-center justify-center p-6 gap-2 text-red-500 min-w-[200px]">
                    <AlertCircle size={32} strokeWidth={1.5} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">DATA CORRUPTED</span>
                </div>
            )}

            {/* 3. SUCCESS STATE */}
            <div className="relative">
                <img 
                    src={content} 
                    alt="Secure Transmission" 
                    className={`
                        w-full h-auto max-h-[300px] object-cover transition-all duration-500 block
                        ${isRevealed ? 'filter-none' : 'blur-xl scale-110 opacity-50'}
                        ${status === 'LOADED' ? 'opacity-100' : 'opacity-0'}
                    `}
                    loading="lazy"
                />

                {/* SECURITY BLUR OVERLAY */}
                {!isRevealed && status === 'LOADED' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/40 backdrop-blur-sm" onClick={handleReveal}>
                        <div className="p-3 rounded-full bg-black/60 border border-white/10 text-emerald-500 mb-2 shadow-lg">
                            <EyeOff size={24} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">CONFIDENTIAL</span>
                        <span className="text-[8px] font-mono text-neutral-400 mt-1">TAP TO DECRYPT</span>
                    </div>
                )}
            </div>

            {/* 4. METADATA FOOTER (Only visible when revealed) */}
            {isRevealed && status === 'LOADED' && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                         <div className="bg-emerald-900/50 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[8px] font-mono text-emerald-400 flex items-center gap-1">
                            <Lock size={8} /> E2EE
                        </div>
                        {size && <span className="text-[8px] font-mono text-neutral-400">{(size/1024).toFixed(1)}KB</span>}
                    </div>
                    <div className="p-1.5 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors">
                        <Maximize2 size={12} />
                    </div>
                </div>
            )}
        </div>
    );
});
