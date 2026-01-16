
/**
 * SECURITY HELPER UTILITIES
 * Hardens input handling and data display.
 */

// Simple regex-based sanitizer for client-side display
// Note: For heavy-duty HTML sanitization, use DOMPurify. 
// This is a lightweight filter for preventing common injection vectors in simple text.
export const sanitizeInput = (input: string): string => {
    if (!input) return "";
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/javascript:/gi, "")
        .replace(/on\w+=/gi, ""); // Remove event handlers like onclick=
};

// Validates if string contains suspicious XSS patterns
export const hasMaliciousContent = (input: string): boolean => {
    const patterns = [
        /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
        /javascript:/gi,
        /onload=/gi,
        /onerror=/gi,
        /onclick=/gi
    ];
    return patterns.some(pattern => pattern.test(input));
};

export const enforceSafeText = (text: string): string => {
    if (hasMaliciousContent(text)) {
        console.warn("[SECURITY] XSS Attempt Blocked");
        return "[CONTENT_REDACTED_SECURITY_RISK]";
    }
    return text;
};
