
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
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
      define: {
        'process.env.VITE_VAULT_PIN_HASH': JSON.stringify(env.VITE_VAULT_PIN_HASH),
        // Global constant to force secure mode if needed
        '__SECURE_MODE__': JSON.stringify(true) 
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild'
      }
    };
});
