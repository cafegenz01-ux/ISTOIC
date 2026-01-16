
/**
 * PRIVACY SHIELD PROTOCOL v1.1
 * blocks geolocation access at the browser level.
 */

export const activatePrivacyShield = () => {
    try {
        if (!navigator.geolocation) return;

        // Create a dummy geolocation object that denies everything
        const noop = () => {};
        const deny = (success: any, error: any) => {
            console.warn("[PRIVACY_SHIELD] Location request intercepted and blocked.");
            if (error && typeof error === 'function') {
                error({
                    code: 1, // PERMISSION_DENIED
                    message: "Location access blocked by Privacy Shield Protocol.",
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3
                });
            }
        };

        // Safety check: Don't crash if property is not configurable (e.g., protected by browser/extensions)
        const descriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
        if (descriptor && !descriptor.configurable) {
            console.warn("[PRIVACY_SHIELD] Geolocation property locked by environment. Interception skipped to prevent crash.");
            return; 
        }

        // Attempt to override the navigator.geolocation property
        try {
            Object.defineProperty(navigator, 'geolocation', {
                value: {
                    getCurrentPosition: deny,
                    watchPosition: (s: any, e: any) => { deny(s, e); return 0; },
                    clearWatch: noop
                },
                configurable: false,
                writable: false
            });
            console.log("%c[PRIVACY SHIELD] GEOLOCATION FIREWALL ACTIVE", "background: #000; color: #0f0; padding: 4px; font-weight: bold;");
        } catch (e) {
            // Fallback for strict environments where defineProperty fails silently or throws
            try {
                (navigator as any).geolocation.getCurrentPosition = deny;
                (navigator as any).geolocation.watchPosition = (s: any, e: any) => { deny(s, e); return 0; };
                console.log("[PRIVACY_SHIELD] Fallback interception active.");
            } catch(err) {
                console.error("[PRIVACY_SHIELD] Failed to attach hooks:", err);
            }
        }

    } catch (e) {
        console.error("[PRIVACY_SHIELD] Initialization failed:", e);
    }
};
