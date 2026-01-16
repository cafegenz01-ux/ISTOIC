// IMPORT WAJIB: Penyeimbang WebRTC untuk semua browser (Safari/Android lama)
import 'webrtc-adapter';

// NOTE: Global Error Handlers for Web3 conflicts are now injected in index.html <head>
// to ensure they run before any extension code.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { VaultProvider } from './contexts/VaultContext';
import { FeatureProvider } from './contexts/FeatureContext';

// Note: Capacitor URL handler (untuk balik dari Google Login ke app)
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

// Firebase redirect result (ambil hasil login setelah balik)
import { getAuth, getRedirectResult } from 'firebase/auth';
const auth = getAuth();

// Mencegah error jika root tidak ditemukan (Safety check)
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('FATAL: Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

/**
 * Helper function to detect iOS PWA
 */
function isIosPwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return isIos && isStandalone;
}

/**
 * Note: Tangkap redirect balik dari browser ke app (Capacitor)
 * Ini penting untuk Firebase Google Login redirect.
 */
if (Capacitor.isNativePlatform()) {
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    console.log('APP URL OPEN:', url);

    try {
      // Ini akan menyelesaikan proses redirect login jika ada
      await getRedirectResult(auth);
    } catch (e) {
      console.error('Redirect error', e);
    }

    // Kembalikan ke root app (hindari nyangkut di handler page)
    window.location.replace('/');
  });
}

/**
 * Handle redirect result for PWA (especially iOS PWA)
 * NOTE: We don't call getRedirectResult here to avoid consuming it before AuthView can process it.
 * AuthView will handle the redirect through finalizeRedirectIfAny() which properly manages the flow.
 * This section only ensures the redirect flag is set if we detect a redirect return.
 */
if (!Capacitor.isNativePlatform() && isIosPwa()) {
  // Check if we're returning from a redirect by looking at URL params or session flag
  const redirectPending = sessionStorage.getItem("istok_login_redirect") === "pending";
  
  if (redirectPending) {
    // Just log that we detected a redirect return - let AuthView handle the actual processing
    console.log('[PWA_REDIRECT] Detected redirect return, AuthView will process it');
    // Don't call getRedirectResult here - let AuthView do it through finalizeRedirectIfAny
    // This prevents consuming the redirect result before AuthView can use it
  }
}

/**
 * Note: Service Worker untuk PWA
 * Jangan aktifkan SW di Capacitor (native webview), biar tidak intercept request/login.
 */
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW Registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW Registration Failed:', error);
      });
  });
}

// StrictMode diaktifkan untuk best practice
root.render(
  <React.StrictMode>
    <FeatureProvider>
      <VaultProvider>
        <App />
      </VaultProvider>
    </FeatureProvider>
  </React.StrictMode>
);


