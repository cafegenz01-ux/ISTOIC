import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.istoic.app',
  appName: 'ISTOIC',
  webDir: 'dist',
  bundledWebRuntime: false,
  // PENTING: JANGAN isi server.url untuk production
  server: {
    androidScheme: 'https'
  }
};

export default config;
