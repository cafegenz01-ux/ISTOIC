// IMPORT WAJIB: Penyeimbang WebRTC untuk semua browser (Safari/Android lama)
import 'webrtc-adapter';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { VaultProvider } from './contexts/VaultContext';
import { FeatureProvider } from './contexts/FeatureContext';

import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

// ✅ pakai auth yang sama dengan seluruh app
import { auth } from './services/firebaseConfig';
// @ts-ignore
import { getRedirectResult } from 'firebase/auth';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('FATAL: Could not find root element to mount to');

const root = ReactDOM.createRoot(rootElement);

/**
 * ✅ Native handler: coba finalize redirect result saat app aktif lagi.
 * Catatan: ini BUTUH deep link (intent-filter) supaya appUrlOpen terpanggil.
 * Tapi juga kita fallback pakai "resume" event.
 */
async function finalizeFirebaseRedirect() {
  try {
    const res = await getRedirectResult(auth);
    if (res?.user) {
      console.log('[AUTH] Redirect result user:', res.user.uid);
    }
  } catch (e) {
    // kalau ga ada redirect result, biarkan aja
    console.log('[AUTH] No redirect result / ignored:', e);
  }
}

if (Capacitor.isNativePlatform()) {
  // 1) jika deep link terpanggil
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    console.log('[CAP] appUrlOpen:', url);
    await finalizeFirebaseRedirect();
    // Jangan paksa replace kalau lagi ada routing internal; tapi aman ke root:
    window.location.replace('/');
  });

  // 2) fallback: ketika app balik fokus (resume)
  CapApp.addListener('resume', async () => {
    console.log('[CAP] resume');
    await finalizeFirebaseRedirect();
  });

  // 3) juga coba sekali saat start
  finalizeFirebaseRedirect();
}

/**
 * ✅ Service Worker PWA hanya untuk web browser, bukan native webview
 */
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW Registered:', registration.scope))
      .catch(error => console.log('SW Registration Failed:', error));
  });
}

root.render(
  <React.StrictMode>
    <FeatureProvider>
      <VaultProvider>
        <App />
      </VaultProvider>
    </FeatureProvider>
  </React.StrictMode>
);
