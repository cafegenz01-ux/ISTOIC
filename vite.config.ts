import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load environment variables dengan aman
    const env = loadEnv(mode, '.', '');
    
    return {
      base: './',
      // 1. SERVER CONFIGURATION (Optimized for Local & Vercel)
      server: {
        port: 3000,
        host: true, // Listen on all IPs (0.0.0.0) agar bisa diakses di network lokal
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
            "Cross-Origin-Embedder-Policy": "unsafe-none"
        }
      },

      // 2. PLUGINS (React + PWA Engine)
      const shouldAnalyze = process.env.ANALYZE === 'true' || env.ANALYZE === 'true';

      plugins: [
        react(),
        
        // PWA ENGINE: Mengubah website menjadi Aplikasi Native
        VitePWA({
          registerType: 'autoUpdate', // Update otomatis di background
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'robots.txt'],
          
          manifest: {
            name: 'ISTOIC AI Titanium',
            short_name: 'ISTOIC',
            description: 'Advanced Neural AI Interface',
            theme_color: '#000000',
            background_color: '#000000',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '.',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable'
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          },

          // WORKBOX STRATEGY (Smart Caching)
          workbox: {
            // Naikkan batas cache untuk file besar (misal: library AI) agar build tidak warning
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, 
            
            // Cache semua aset statis penting
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
            
            // Runtime Caching (Cache API eksternal agar irit kuota & cepat)
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
                }
              }
            ]
          },
          // Pastikan PWA tidak error saat dev mode
          devOptions: {
            enabled: true,
            type: 'module'
          }
        }),
        // Conditional bundle visualizer for profiling (run with ANALYZE=true)
        ...(shouldAnalyze ? [visualizer({ filename: 'dist/bundle-visualizer.html', open: false, gzipSize: true, brotliSize: true })] : [])
      ],

      // 3. PATH RESOLUTION
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },

      // 4. GLOBAL CONSTANTS
      define: {
        'process.env.VITE_VAULT_PIN_HASH': JSON.stringify(env.VITE_VAULT_PIN_HASH),
        '__SECURE_MODE__': JSON.stringify(true) 
      },

      // 5. BUILD OPTIMIZATION (Performance Tuning)
      build: {
        outDir: 'dist',
        sourcemap: false, // Production performance
        minify: 'esbuild',
        chunkSizeWarningLimit: 1500, // Hindari warning chunk size di Vercel
        
        rollupOptions: {
          output: {
            // MANUAL CHUNKS: Memecah kode agar loading awal cepat
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-ai': ['@google/genai', 'ai', 'openai'],
              'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
              'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge', 'react-virtuoso', 'react-markdown']
            }
          }
        }
      }
    };
});
