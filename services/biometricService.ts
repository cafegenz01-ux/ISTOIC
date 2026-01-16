import { debugService } from './debugService';

// Base64URL encoding/decoding helper
function bufferToBase64URL(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export const BiometricService = {
    async isAvailable(): Promise<boolean> {
        if (!window.PublicKeyCredential) return false;
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (e) {
            return false;
        }
    },

    async register(username: string): Promise<{ id: string, rawId: string } | null> {
        if (!window.PublicKeyCredential) throw new Error("WebAuthn not supported");

        // Generate random challenge
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        // Generate User ID
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        try {
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: {
                        name: "IStoicAI Secure Terminal",
                        id: window.location.hostname // Must match current domain
                    },
                    user: {
                        id: userId,
                        name: username,
                        displayName: username
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: "public-key" }, // ES256
                        { alg: -257, type: "public-key" } // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform", // Forces FaceID/TouchID/Windows Hello
                        requireResidentKey: false,
                        userVerification: "required"
                    },
                    timeout: 60000,
                    attestation: "none"
                }
            }) as PublicKeyCredential;

            if (!credential) return null;

            debugService.log('INFO', 'BIO_AUTH', 'REG_SUCCESS', 'Biometric credential created.');
            
            return {
                id: credential.id,
                rawId: bufferToBase64URL(credential.rawId)
            };

        } catch (e: any) {
            debugService.log('ERROR', 'BIO_AUTH', 'REG_FAIL', e.message);
            throw e;
        }
    },

    async authenticate(): Promise<boolean> {
        if (!window.PublicKeyCredential) throw new Error("WebAuthn not supported");

        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        try {
            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge,
                    timeout: 60000,
                    userVerification: "required",
                    // We don't filter by allowCredentials to let the OS picker show available passkeys for this RP
                }
            }) as PublicKeyCredential;

            if (assertion) {
                debugService.log('INFO', 'BIO_AUTH', 'AUTH_SUCCESS', 'Biometric challenge verified.');
                return true;
            }
            return false;

        } catch (e: any) {
            console.error("Biometric Auth Failed:", e);
            // Don't log every cancellation as error
            if (e.name !== 'NotAllowedError') {
                debugService.log('WARN', 'BIO_AUTH', 'AUTH_FAIL', e.message);
            }
            return false;
        }
    }
};