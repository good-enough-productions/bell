import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/bell/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'bell.svg'],
      manifest: {
        name: 'Household Bell',
        short_name: 'Bell',
        description: 'Instant household call bell between Danny and Bri',
        theme_color: '#0F172A',
        background_color: '#090D16',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/bell/',
        scope: '/bell/',
        icons: [
          {
            src: 'bell-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'bell-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});