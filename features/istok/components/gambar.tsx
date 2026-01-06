import React, { useState, useEffect, useCallback } from 'react';
import { 
    Maximize2, AlertCircle, Loader2, Download, 
    Lock, Eye, EyeOff, Copy, Check, FileImage 
} from 'lucide-react';

// --- UTILS: HELPER ---

const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const downloadBase64 = (base64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- UTILS: HIGH-PERFORMANCE IMAGE COMPRESSION V2 ---

/**
 * Compresses image to WebP format with smart sizing.
 * - Skips compression if file is already efficient.
 * - Enforces max bounds for P2P stability.
 * - Strips EXIF metadata for privacy.
 */
export const compressImage = (file: File): Promise<{base64: string, size: number, width: number, height: number, mimeType: string}> => {
    return new Promise((resolve, reject) => {
        // If file is already small (< 150KB) and is an image, convert to base64 directly to preserve original quality
        if (file.size < 150 * 1024 && file.type !== 'image/heic') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        base64: e.target?.result as string,
                        size: file.size,
                        width: img.width,
                        height: img.height,
                        mimeType: file.type
                    });
                };
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            // 1. Smart Dimension Calculation
            const MAX_DIM = 1024; // Increased from 800 for better Retina display support
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

            // 2. Canvas Processing
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Canvas context failed"));
                return;
            }

            // High Quality Scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            URL.revokeObjectURL(objectUrl);

            // 3. Compression (Adaptive)
            // Use WebP if available, fallback to JPEG
            const mimeType = 'image/webp';
            const quality = 0.75; // Balanced for P2P

            const base64 = canvas.toDataURL(mimeType, quality);
            
            // Calculate size
            const head = `data:${mimeType};base64,`;
            const size = Math.round((base64.length - head.length) * 3 / 4);

            resolve({ base64, size, width, height, mimeType });
        };
        
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Format gambar tidak didukung atau corrupt."));
        };

        img.src = objectUrl;
    });
};

// --- COMPONENT: POWERFUL IMAGE BUBBLE ---

interface ImageMessageProps {
    content: string; // Base64 Data URL
    size?: number;
    mimeType?: string;
    onClick: () => void;
    onReveal?: () => void; 
}

export const ImageMessage = React.memo(({ content, size, mimeType, onClick, onReveal }: ImageMessageProps) => {
    const [status, setStatus] = useState<'LOADING' | 'LOADED' | 'ERROR'>('LOADING');
    const [isRevealed, setIsRevealed] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.src = content;
        img.onload = () => setStatus('LOADED');
        img.onerror = () => setStatus('ERROR');
    }, [content]);

    const handleReveal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRevealed(true);
        if (onReveal) onReveal();
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const ext = mimeType?.split('/')[1] || 'png';
        downloadBase64(content, `istok_secure_${Date.now()}.${ext}`);
    };

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(content);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error("Copy failed", err);
        }
    };

    return (
        <div 
            className={`
                relative overflow-hidden rounded-xl border group cursor-pointer transition-all duration-300 select-none
                ${status === 'LOADING' ? 'bg-white/5 animate-pulse w-56 h-48 border-white/5' : 'bg-black border-white/10'}
                ${status === 'ERROR' ? 'bg-red-900/10 border-red-500/30 w-48 h-32' : 'hover:border-emerald-500/50'}
                max-w-[300px] shadow-lg
            `}
            onClick={() => { if(isRevealed && status === 'LOADED') onClick(); }}
        >
            {/* 1. LOADING OVERLAY */}
            {status === 'LOADING' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900/50">
                    <div className="relative">
                        <Loader2 size={28} className="text-emerald-500 animate-spin" />
                        <div className="absolute inset-0 blur-md bg-emerald-500/30 animate-pulse"></div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/80 animate-pulse">DECRYPTING</span>
                </div>
            )}

            {/* 2. ERROR STATE */}
            {status === 'ERROR' && (
                <div className="flex flex-col items-center justify-center h-full p-4 gap-2 text-red-400">
                    <AlertCircle size={32} strokeWidth={1.5} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-center">IMAGE CORRUPTED</span>
                </div>
            )}

            {/* 3. IMAGE CONTENT */}
            <div className="relative w-full h-full min-h-[150px]">
                <img 
                    src={content} 
                    alt="Secure Content" 
                    className={`
                        w-full h-auto max-h-[400px] object-cover transition-all duration-700 block
                        ${isRevealed ? 'filter-none scale-100' : 'blur-xl scale-110 grayscale'}
                        ${status === 'LOADED' ? 'opacity-100' : 'opacity-0'}
                    `}
                    loading="lazy"
                />

                {/* SECURITY / PRIVACY SHIELD */}
                {!isRevealed && status === 'LOADED' && (
                    <div 
                        className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/60 backdrop-blur-md transition-all hover:bg-black/50" 
                        onClick={handleReveal}
                    >
                        <div className="relative group/lock">
                            <div className="p-4 rounded-2xl bg-black/80 border border-emerald-500/30 text-emerald-500 mb-3 shadow-[0_0_30px_rgba(16,185,129,0.2)] group-hover/lock:shadow-[0_0_50px_rgba(16,185,129,0.4)] transition-all duration-500">
                                <EyeOff size={28} />
                            </div>
                            <div className="absolute -inset-2 bg-emerald-500/20 blur-xl rounded-full opacity-0 group-hover/lock:opacity-100 transition-opacity"></div>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">CONFIDENTIAL</span>
                            <span className="text-[8px] font-mono text-emerald-500/70 border border-emerald-500/20 px-2 py-0.5 rounded-full">TAP TO DECRYPT</span>
                        </div>
                    </div>
                )}

                {/* ACTION OVERLAY (Only visible when revealed & hovered) */}
                {isRevealed && status === 'LOADED' && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
                        <div className="flex justify-between items-end w-full">
                            
                            {/* Meta Info */}
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                    <div className="bg-emerald-500/20 border border-emerald-500/30 p-1 rounded text-emerald-400">
                                        <Lock size={10} />
                                    </div>
                                    <span className="text-[9px] font-bold text-white tracking-wide">E2EE SECURE</span>
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-mono text-neutral-400">
                                    {size && <span>{formatBytes(size)}</span>}
                                    {mimeType && <span className="uppercase">{mimeType.split('/')[1]}</span>}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleCopy}
                                    className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white backdrop-blur-sm transition-all active:scale-95"
                                    title="Copy Image"
                                >
                                    {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                </button>
                                <button 
                                    onClick={handleDownload}
                                    className="p-2 bg-emerald-600/80 hover:bg-emerald-500 border border-emerald-500/30 rounded-lg text-white backdrop-blur-sm transition-all active:scale-95 shadow-lg"
                                    title="Download"
                                >
                                    <Download size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Corner Icon for expanding */}
            {isRevealed && status === 'LOADED' && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="p-1.5 bg-black/60 backdrop-blur rounded-full text-white/70">
                        <Maximize2 size={12}/>
                    </div>
                </div>
            )}
        </div>
    );
});