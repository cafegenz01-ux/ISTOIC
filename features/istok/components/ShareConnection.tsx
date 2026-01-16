import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { X, Copy, Check, Share2, Link as LinkIcon, ShieldCheck, Smartphone } from 'lucide-react';

interface ShareConnectionProps {
    peerId: string;
    pin: string;
    onClose: () => void;
}

export const ShareConnection: React.FC<ShareConnectionProps> = ({ peerId, pin, onClose }) => {
    // --- STATE ---
    const [shareUrl, setShareUrl] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedPin, setCopiedPin] = useState(false);
    const [isNativeShareSupported, setIsNativeShareSupported] = useState(false);

    // --- EFFECTS ---
    useEffect(() => {
        // 1. Construct Powerful Deep Link
        // Format: https://domain.com/?connect=PEER_ID&key=PIN
        try {
            const url = new URL(window.location.href);
            // Bersihkan params lama jika ada
            url.search = ''; 
            // Set params baru
            url.searchParams.set('connect', peerId);
            url.searchParams.set('key', pin);
            setShareUrl(url.toString());
        } catch (e) {
            // Fallback manual jika URL API gagal (jarang terjadi)
            const baseUrl = window.location.origin + window.location.pathname;
            setShareUrl(`${baseUrl}?connect=${peerId}&key=${pin}`);
        }

        // 2. Check Native Share Support
        if (typeof navigator !== 'undefined' && navigator.share) {
            setIsNativeShareSupported(true);
        }
    }, [peerId, pin]);

    // --- HANDLERS ---

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    const handleCopyPin = async () => {
        try {
            await navigator.clipboard.writeText(pin);
            setCopiedPin(true);
            setTimeout(() => setCopiedPin(false), 2000);
        } catch (err) { console.error(err); }
    };

    const handleNativeShare = async () => {
        if (!isNativeShareSupported) return;
        try {
            await navigator.share({
                title: 'IStoic Secure Link',
                text: `Connect to my encrypted channel.\nID: ${peerId}\nPIN: ${pin}`,
                url: shareUrl
            });
        } catch (err) {
            console.log("Share dismissed or failed", err);
        }
    };

    // --- RENDER ---
    return (
        <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-[#09090b] border border-white/10 rounded-[32px] w-full max-w-sm relative shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header Decoration */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none"></div>

                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors z-10"
                >
                    <X size={20}/>
                </button>

                <div className="p-6 pb-2 text-center">
                    <h3 className="text-white font-black text-xl tracking-wide mb-1">SECURE UPLINK</h3>
                    <p className="text-neutral-500 text-xs flex items-center justify-center gap-1.5">
                        <ShieldCheck size={12} className="text-emerald-500"/>
                        E2EE ENCRYPTED SESSION
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll p-6 pt-0 space-y-6">
                    
                    {/* 1. QR CODE SECTION */}
                    <div className="relative group perspective-1000">
                        <div className="bg-white p-5 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.15)] mx-auto w-fit transition-transform transform group-hover:scale-105 duration-300">
                            {shareUrl ? (
                                <QRCode 
                                    value={shareUrl} 
                                    size={180} 
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            ) : (
                                <div className="w-[180px] h-[180px] bg-neutral-200 animate-pulse rounded"></div>
                            )}
                        </div>
                        <p className="text-center text-[10px] text-neutral-500 mt-3 font-mono uppercase tracking-widest">
                            <Smartphone size={10} className="inline mr-1"/>
                            Scan with Camera
                        </p>
                    </div>

                    {/* 2. MANUAL DETAILS SECTION */}
                    <div className="space-y-3">
                        {/* Access PIN */}
                        <div className="bg-[#121214] border border-white/5 p-4 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors">
                            <div className="text-left">
                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Access PIN</p>
                                <p className="text-2xl font-mono font-bold text-white tracking-[0.2em]">{pin}</p>
                            </div>
                            <button 
                                onClick={handleCopyPin}
                                className="p-2.5 bg-white/5 hover:bg-emerald-500/20 text-neutral-400 hover:text-emerald-400 rounded-lg transition-all"
                            >
                                {copiedPin ? <Check size={18}/> : <Copy size={18}/>}
                            </button>
                        </div>

                        {/* Peer ID (Hidden/Collapsible or Small) */}
                        <div className="px-2">
                            <p className="text-[9px] text-neutral-600 font-mono text-center mb-1">SESSION ID</p>
                            <code className="block text-[10px] text-neutral-500 text-center break-all select-all hover:text-white transition-colors cursor-pointer" onClick={() => navigator.clipboard.writeText(peerId)}>
                                {peerId}
                            </code>
                        </div>
                    </div>

                    {/* 3. ACTION BUTTONS */}
                    <div className="grid grid-cols-1 gap-3">
                        {isNativeShareSupported ? (
                            <button 
                                onClick={handleNativeShare}
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                            >
                                <Share2 size={16}/> BAGIKAN LINK
                            </button>
                        ) : (
                            <button 
                                onClick={handleCopyLink}
                                className={`w-full py-3.5 font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg transition-all active:scale-95 ${copiedLink ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                            >
                                {copiedLink ? <Check size={16}/> : <LinkIcon size={16}/>}
                                {copiedLink ? 'LINK DISALIN' : 'SALIN LINK'}
                            </button>
                        )}
                        
                        {/* Secondary Copy if Native Share is active */}
                        {isNativeShareSupported && (
                            <button 
                                onClick={handleCopyLink}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                            >
                                <LinkIcon size={14}/> {copiedLink ? 'DISALIN' : 'SALIN URL MANUAL'}
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};