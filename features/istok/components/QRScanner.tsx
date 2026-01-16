
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Camera, Zap, ScanLine, AlertTriangle } from 'lucide-react';

interface QRScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const frameIdRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        // Native Barcode Detector (Shape Detection API) - Chrome/Android
        const BarcodeDetector = (window as any).BarcodeDetector;
        let detector: any = null;
        
        if (BarcodeDetector) {
            BarcodeDetector.getSupportedFormats()
                .then((formats: string[]) => {
                    if (formats.includes('qr_code')) {
                        detector = new BarcodeDetector({ formats: ['qr_code'] });
                    }
                })
                .catch(console.error);
        }

        const startCamera = async () => {
            try {
                // iOS Requirement: 'ideal' is safer than 'exact' for environment
                const constraints = {
                    video: { 
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                streamRef.current = stream;
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Required for iOS to play video inline without fullscreen
                    videoRef.current.setAttribute("playsinline", "true"); 
                    
                    // Wait for video to be ready
                    await new Promise((resolve) => {
                        if (videoRef.current) {
                            videoRef.current.onloadedmetadata = () => resolve(true);
                        }
                    });

                    await videoRef.current.play();
                    setLoading(false);
                    scanFrame();
                }
            } catch (err: any) {
                console.error("Camera Error:", err);
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setError("Izin kamera ditolak. Mohon izinkan akses kamera di pengaturan browser.");
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    setError("Kamera tidak ditemukan pada perangkat ini.");
                } else {
                    setError("Gagal mengakses kamera. Pastikan tidak ada aplikasi lain yang menggunakannya.");
                }
                setLoading(false);
            }
        };

        const scanFrame = async () => {
            if (!videoRef.current || !canvasRef.current) return;
            const video = videoRef.current;

            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                // 1. Try Native Detection (Fast & Efficient)
                if (detector) {
                    try {
                        const barcodes = await detector.detect(video);
                        if (barcodes.length > 0) {
                            onScan(barcodes[0].rawValue);
                            return; // Stop loop
                        }
                    } catch (e) {
                        // Fallback to jsQR if native detection fails momentarily
                    }
                }

                // 2. Fallback to jsQR (CPU Intensive but reliable across all devices)
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                if (ctx) {
                    canvas.height = video.videoHeight;
                    canvas.width = video.videoWidth;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    try {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert",
                        });

                        if (code && code.data) {
                            onScan(code.data);
                            return; // Stop loop
                        }
                    } catch(e) {
                        // Ignore frame processing errors
                    }
                }
            }
            frameIdRef.current = requestAnimationFrame(scanFrame);
        };

        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[5000] bg-black flex flex-col font-sans touch-none">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 pt-safe z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
                <div>
                    <h2 className="text-emerald-500 font-black text-xl tracking-widest flex items-center gap-2">
                        <ScanLine size={20} className="animate-pulse"/> SCANNER_V2
                    </h2>
                    <p className="text-[10px] text-white/60 font-mono">ALIGN QR CODE WITHIN FRAME</p>
                </div>
                <button onClick={onClose} className="p-3 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20 transition active:scale-95">
                    <X size={20}/>
                </button>
            </div>

            {/* Camera Viewport */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                        <p className="text-emerald-500 text-xs font-bold tracking-widest">INITIALIZING OPTICS...</p>
                    </div>
                )}
                
                {error && (
                    <div className="text-red-500 text-center p-6 bg-red-500/10 rounded-xl border border-red-500/30 max-w-xs mx-auto z-10 flex flex-col items-center gap-3">
                        <AlertTriangle size={40} className="opacity-80"/>
                        <div>
                            <p className="text-sm font-black mb-1 uppercase tracking-wider">CAMERA_OFFLINE</p>
                            <p className="text-xs opacity-80 leading-relaxed">{error}</p>
                        </div>
                        <button onClick={onClose} className="mt-2 px-6 py-2 bg-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/30 transition">
                            TUTUP
                        </button>
                    </div>
                )}

                <video 
                    ref={videoRef} 
                    className="absolute inset-0 w-full h-full object-cover opacity-80" 
                    playsInline 
                    muted
                />
                
                {/* Hidden canvas for processing */}
                <canvas ref={canvasRef} className="hidden" />

                {/* HUD Overlay (The "Cyberpunk" Feel) */}
                {!error && !loading && (
                    <div className="relative z-10 w-64 h-64 border-2 border-emerald-500/50 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.2)]">
                        {/* Corner Markers */}
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400"></div>
                        
                        {/* Scanning Beam */}
                        <div className="absolute inset-x-0 h-1 bg-emerald-400/80 shadow-[0_0_15px_#34d399] animate-scan-down top-0"></div>
                    </div>
                )}

                {!error && !loading && (
                    <div className="absolute bottom-32 text-center w-full z-10">
                        <p className="text-emerald-500/80 text-[10px] font-mono tracking-[0.3em] animate-pulse bg-black/40 px-4 py-1 rounded-full inline-block backdrop-blur-sm">SEARCHING PATTERN...</p>
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="bg-[#09090b] border-t border-white/10 p-6 pb-safe z-20">
                <div className="flex items-center justify-center gap-6">
                    <button className="flex flex-col items-center gap-2 text-neutral-500 group">
                        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition border border-white/5">
                            <Zap size={24} className="group-hover:text-yellow-400 transition"/>
                        </div>
                        <span className="text-[9px] font-bold tracking-wider">FLASH</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
