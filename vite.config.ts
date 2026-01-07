
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load local .env only for build process usage
    const env = loadEnv(mode, (process as any).cwd(), '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
            "Cross-Origin-Embedder-Policy": "unsafe-none"
        }
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      },
      // SECURITY FIX: Only expose PUBLIC variables. Never expose API Keys here.
      // We removed the dangerous 'process.env.GEMINI_API_KEY' injections.
      define: {
        // Safe variables only
        'process.env.VITE_VAULT_PIN_HASH': JSON.stringify(env.VITE_VAULT_PIN_HASH),
        'process.env.VITE_USE_SECURE_BACKEND': JSON.stringify('true') // Force Secure Mode
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild'
      }
    };
});
