
import { debugService } from './debugService';
import { SECURITY_MATRIX } from './securityMatrix';

export type Provider = 'GEMINI' | 'GROQ' | 'OPENAI' | 'DEEPSEEK' | 'MISTRAL' | 'OPENROUTER' | 'ELEVENLABS' | 'HUGGINGFACE';
type KeyStatus = 'ACTIVE' | 'COOLDOWN';

interface KeyRecord {
  cloakedKey: string;
  provider: Provider;
  status: KeyStatus;
  fails: number;
  cooldownUntil: number;
  id: string; 
}

export interface ProviderStatus {
    id: string;
    status: 'HEALTHY' | 'COOLDOWN';
    keyCount: number;
    cooldownRemaining: number;
}

export class HydraVault {
  private vault: Record<string, KeyRecord[]> = {};
  private counters: Record<string, number> = {};

  constructor() {
      this.refreshPools();
  }

  public refreshPools() {
    const viteEnv = (import.meta as any).env || {};
    const providers: Provider[] = ['GEMINI', 'GROQ', 'OPENAI', 'DEEPSEEK', 'MISTRAL', 'OPENROUTER', 'ELEVENLABS', 'HUGGINGFACE'];

    // Check Global Secure Mode Flag (Injected by Vite)
    const isSecureMode = (typeof __SECURE_MODE__ !== 'undefined' && __SECURE_MODE__) || 
                         viteEnv.VITE_USE_SECURE_BACKEND === 'true';

    providers.forEach(provider => {
        const keys = new Set<string>(); 
        
        const addKey = (val: string | undefined) => {
            if (!val || typeof val !== 'string' || val.includes("GANTI_DENGAN")) return;
            val.split(/[\n,;]+/).forEach(part => {
                const clean = part.replace(/['"\s]/g, '').trim();
                if (clean.length > 8) keys.add(clean);
            });
        };

        // 1. Check Local Dev Keys (VITE_ prefix only)
        addKey(viteEnv[`VITE_${provider}_API_KEY`]);
        
        // 2. Fallback: If no local keys, inject Virtual Key for Proxy
        if (keys.size === 0) {
            if (isSecureMode) {
                keys.add('server-side-managed');
            } else {
               // Only warn in dev console if absolutely no keys and not in secure mode
               // console.warn(`[Hydra] No keys for ${provider}`);
            }
        }

        this.vault[provider] = Array.from(keys).map((k, index) => ({
            cloakedKey: SECURITY_MATRIX.cloak(k), 
            provider,
            status: 'ACTIVE',
            fails: 0,
            cooldownUntil: 0,
            id: `${provider}_${index}`
        }));
        
        if (this.counters[provider] === undefined) {
            this.counters[provider] = 0;
        }
    });
  }

  public getKey(provider: Provider): string | null {
    const pool = this.vault[provider];
    if (!pool || pool.length === 0) return null;

    const now = Date.now();
    
    // Auto-Heal
    pool.forEach(k => {
        if (k.status === 'COOLDOWN' && k.cooldownUntil <= now) {
            k.status = 'ACTIVE';
            k.fails = 0;
        }
    });

    const activeKeys = pool.filter((k) => k.status === 'ACTIVE');
    
    if (activeKeys.length === 0) {
        // If all keys failed, check if we have a server-managed key in cooldown
        // Server managed keys shouldn't really cooldown locally unless 429
        const managed = pool.find(k => SECURITY_MATRIX.decloak(k.cloakedKey) === 'server-side-managed');
        if (managed && managed.status === 'COOLDOWN' && managed.cooldownUntil > now) {
            return null; 
        }
        return null;
    }

    // Round Robin
    let currentIndex = this.counters[provider] % activeKeys.length;
    const selectedKey = activeKeys[currentIndex];
    this.counters[provider] = (currentIndex + 1) % activeKeys.length;

    return SECURITY_MATRIX.decloak(selectedKey.cloakedKey);
  }

  public reportFailure(provider: Provider, plainKeyString: string, error: any): void {
    // If it's a server-side managed key, log it but be lenient
    if (plainKeyString === 'server-side-managed') {
         debugService.log('ERROR', 'BACKEND_PROXY', 'FAIL', `${provider} proxy request failed.`, error);
         return;
    }

    const pool = this.vault[provider];
    const searchHash = SECURITY_MATRIX.cloak(plainKeyString);
    const record = pool?.find((k) => k.cloakedKey === searchHash);
    if (!record) return;

    record.fails++;
    record.status = 'COOLDOWN';
    
    const errStr = JSON.stringify(error).toLowerCase();
    let penaltyMs = 30000;

    if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('limit')) {
        penaltyMs = 300000; 
    } else if (errStr.includes('503') || errStr.includes('overloaded')) {
        penaltyMs = 60000;
    }
    
    record.cooldownUntil = Date.now() + penaltyMs;
  }

  public reportSuccess(provider: Provider) {
      // Success keeps key healthy
  }

  public isProviderHealthy(provider: Provider): boolean {
      return (this.vault[provider] || []).some(k => k.status === 'ACTIVE');
  }

  public getAllProviderStatuses(): ProviderStatus[] {
      const now = Date.now();
      return Object.keys(this.vault).map(id => {
          const pool = this.vault[id];
          const cooldowns = pool.filter(k => k.status === 'COOLDOWN');
          const minRemaining = cooldowns.length > 0 
            ? Math.ceil(Math.min(...cooldowns.map(k => k.cooldownUntil - now)) / 60000)
            : 0;

          return {
            id, 
            status: this.isProviderHealthy(id as Provider) ? 'HEALTHY' : 'COOLDOWN', 
            keyCount: pool.length,
            cooldownRemaining: minRemaining > 0 ? minRemaining : 0
          };
      });
  }
}

// Global Declaration for Vite define
declare const __SECURE_MODE__: boolean;

export const GLOBAL_VAULT = new HydraVault();
