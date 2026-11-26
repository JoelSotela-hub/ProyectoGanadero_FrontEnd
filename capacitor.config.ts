import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cr.guateganado.app',
  appName: 'GuateGanado',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
