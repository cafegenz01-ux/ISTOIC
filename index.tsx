
// IMPORT WAJIB: Penyeimbang WebRTC untuk semua browser (Safari/Android lama)
import 'webrtc-adapter'; 

// Patch untuk mencegah crash karena Extension Wallet (Metamask/Phantom)
try {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    // Opsional: Freeze object jika extension nakal menimpa variabel global
    // Object.freeze((window as any).ethereum); 
  }
} catch (e) {
  console.warn("Web3 Provider Conflict Ignored");
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { VaultProvider } from './contexts/VaultContext';
import { FeatureProvider } from './contexts/FeatureContext';

// Mencegah error jika root tidak ditemukan (Safety check)
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("FATAL: Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Register Service Worker for PWA Capabilities (Notifications & Offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW Registered:', registration.scope);
      })
      .catch(error => {
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
