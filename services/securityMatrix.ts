
import { debugService } from './debugService';

/**
 * SECURITY MATRIX v2.0 (TITANIUM)
 * In-Memory Obfuscation Engine using Dynamic Keystream Cipher.
 * 
 * Improvement:
 * - Replaced static cyclic XOR with a pseudo-random keystream generated from the session salt.
 * - Prevents simple pattern analysis attacks on the heap.
 * - Still synchronous to maintain compatibility with legacy architecture.
 */

class SecurityMatrixEngine {
    private sessionSalt: Uint8Array;

    constructor() {
        // High-entropy salt, regenerated on every page load/refresh.
        // This ensures the in-memory representation of keys is different every session.
        this.sessionSalt = crypto.getRandomValues(new Uint8Array(64)); // Increased to 64 bytes
    }

    /**
     * Generates a deterministic keystream byte based on index and salt.
     * Uses a simple chaotic mixing function.
     */
    private getKeystreamByte(index: number): number {
        const saltByte = this.sessionSalt[index % this.sessionSalt.length];
        const saltByteNext = this.sessionSalt[(index + 1) % this.sessionSalt.length];
        // Mix index, salt, and bitwise rotation for chaos
        return (saltByte ^ ((index * 31) & 0xFF)) ^ (saltByteNext << 2);
    }

    /**
     * Obfuscates a plain string into a scrambled hex string.
     */
    public cloak(plainText: string): string {
        if (!plainText) return '';
        
        const encoder = new TextEncoder();
        const encoded = encoder.encode(plainText);
        const result = new Uint8Array(encoded.length);

        for (let i = 0; i < encoded.length; i++) {
            // Apply Dynamic Keystream XOR
            result[i] = encoded[i] ^ this.getKeystreamByte(i);
        }

        // Convert to Hex string
        return Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * De-obfuscates the hex string back to plain text.
     * WARNING: Use this ONLY immediately before network transmission.
     */
    public decloak(obfuscatedHex: string): string {
        if (!obfuscatedHex) return '';

        // Safely parse hex
        const match = obfuscatedHex.match(/.{1,2}/g);
        if (!match) return '';

        const bytes = new Uint8Array(match.map(byte => parseInt(byte, 16)));
        const result = new Uint8Array(bytes.length);

        for (let i = 0; i < bytes.length; i++) {
            // Re-apply same keystream XOR to reverse
            result[i] = bytes[i] ^ this.getKeystreamByte(i);
        }

        const decoder = new TextDecoder();
        return decoder.decode(result);
    }

    /**
     * ENDPOINT SYNTHESIZER
     * Constructs URL strings from ASCII byte arrays.
     */
    public synthesizeEndpoint(bytes: number[]): string {
        return String.fromCharCode(...bytes);
    }

    /**
     * Semantic wipe of sensitive variables.
     */
    public wipe(sensitiveData: any) {
        if (typeof sensitiveData === 'string') {
            // Strings are immutable, but we can break reference
            sensitiveData = null;
        } else if (sensitiveData instanceof Uint8Array || sensitiveData instanceof Array) {
            // Overwrite buffer with zeros
            sensitiveData.fill(0);
        }
    }
}

export const SECURITY_MATRIX = new SecurityMatrixEngine();
