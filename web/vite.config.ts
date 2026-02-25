import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/pwa-maskable.svg'],
      manifest: {
        name: 'MeuTreino',
        short_name: 'MeuTreino',
        description: 'MeuTreino Web App',
        theme_color: '#10b981',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/pwa-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
