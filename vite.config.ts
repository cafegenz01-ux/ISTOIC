import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load environment variables dengan aman
  const env = loadEnv(mode, ".", "");

  // ✅ FIX: variable harus di luar object return
  const shouldAnalyze =
    process.env.ANALYZE === "true" || env.ANALYZE === "true";

  return {
    base: "./",

    // 1. SERVER CONFIGURATION (Optimized for Local & Vercel)
    server: {
      port: 3000,
      host: true, // Listen on all IPs (0.0.0.0) agar bisa diakses di network lokal
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
        "Cross-Origin-Embedder-Policy": "unsafe-none",
      },
    },

    // Optional: preview config (biar konsisten saat `vite preview`)
    preview: {
      port: 4173,
      host: true,
    },

    // 2. PLUGINS (React + PWA Engine)
    plugins: [
      react(),

      // PWA ENGINE: Mengubah website menjadi Aplikasi Native
      VitePWA({
        registerType: "autoUpdate", // Update otomatis di background
        includeAssets: [
          "favicon.ico",
          "apple-touch-icon.png",
          "masked-icon.svg",
          "robots.txt",
        ],

        manifest: {
          name: "ISTOIC AI Titanium",
          short_name: "ISTOIC",
          description: "ISTOIC AI - Productivity + AI Assistant (Local-first)",
          theme_color: "#0b0b0c",
          background_color: "#0b0b0c",
          display: "standalone",
          scope: ".",
          start_url: ".",
          orientation: "portrait",
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },

        // Workbox defaults cukup aman; bisa kamu tweak belakangan
        workbox: {
          navigateFallback: "/index.html",
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,json,txt}"],
        },

        devOptions: {
          enabled: true, // PWA aktif saat dev (buat test PWA iOS/Android)
        },
      }),

      // ✅ Analyzer hanya aktif kalau ANALYZE=true
      ...(shouldAnalyze
        ? [
            visualizer({
              filename: "dist/stats.html",
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },

    build: {
      outDir: "dist",
      sourcemap: mode !== "production",
      rollupOptions: {
        output: {
          // Reduce chunking chaos (lebih stabil untuk mobile/pwa)
          manualChunks: undefined,
        },
      },
    },

    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
  };
});
