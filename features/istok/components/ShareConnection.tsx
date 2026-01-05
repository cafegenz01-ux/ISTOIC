
import React, { useState, useEffect } from 'react';
import { QrCode, Copy, Share2, Check, X, Link as LinkIcon, Smartphone } from 'lucide-react';
import { SharedQRCode } from '../../../components/SharedQRCode';

interface ShareConnectionProps {
    peerId: string;
    pin: string;
    onClose: () => void;
}

export const ShareConnection: React.FC<ShareConnectionProps> = ({ peerId, pin, onClose }) => {
    const [copied, setCopied] = useState(false);
    const [shareUrl, setShareUrl] = useState('');

    useEffect(() => {
        // Use query params '?' instead of hash '#' for better initial routing compatibility on static hosts
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/?connect=${peerId}&key=${pin}`;
        setShareUrl(url);
    }, [peerId, pin]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'IStok Secure Link',
                    text: `Secure P2P Request.\nID: ${peerId}\nPIN: ${pin}`,
                    url: shareUrl,
                });
            } catch (err) {
                // Ignore cancel
            }
        } else {
            handleCopy();
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in font-sans">
            <div className="relative w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 flex flex-col items-center gap-6">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="text-center">
                        <h3 className="text-xl font-bold text-white mb-1">SCAN TO CONNECT</h3>
                        <p className="text-xs text-neutral-500 font-mono">ID: {peerId}</p>
                    </div>

                    <div className="p-4 bg-white rounded-xl shadow-lg">
                        <SharedQRCode value={shareUrl} size={180} />
                    </div>

                    <div className="w-full space-y-3">
                        <button 
                            onClick={handleCopy}
                            className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${copied ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-black/40 border-white/10 text-neutral-300 hover:bg-white/5'}`}
                        >
                            <div className="flex flex-col items-start min-w-0 pr-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">COPY LINK</span>
                                <span className="text-xs font-mono truncate w-full">{shareUrl}</span>
                            </div>
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                        </button>

                        <button 
                            onClick={handleNativeShare}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Share2 size={16} /> SHARE VIA APP
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
