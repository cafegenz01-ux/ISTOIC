
/**
 * HIGH-PERFORMANCE IMAGE OPTIMIZER
 * Resizes large images to safe dimensions for Serverless payloads (max 4.5MB).
 * Target: Max 1024px dimension, JPEG Quality 0.7.
 */
export const optimizeImageForAI = (file: File): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
        // If file is already small (< 500KB) and is standard image, pass through
        if (file.size < 500 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/png')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const res = e.target?.result as string;
                resolve({ 
                    base64: res.split(',')[1], 
                    mimeType: file.type 
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            const MAX_DIM = 1024; // Safe limit for Vercel/Gemini payload
            let width = img.width;
            let height = img.height;

            // Maintain Aspect Ratio
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

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Canvas context failed"));
                return;
            }

            // High Quality Downscaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            URL.revokeObjectURL(objectUrl);

            // Export as efficient JPEG
            const mimeType = 'image/jpeg';
            const quality = 0.7; // Good balance for AI analysis

            const dataUrl = canvas.toDataURL(mimeType, quality);
            const base64 = dataUrl.split(',')[1];
            
            console.log(`[IMG_OPT] Compressed: ${(base64.length * 0.75 / 1024).toFixed(2)} KB`);
            resolve({ base64, mimeType });
        };
        
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Image corrupt or format unsupported."));
        };

        img.src = objectUrl;
    });
};
