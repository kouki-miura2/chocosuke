import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    // PWA (implementation plan F2): our own service worker (`src/sw.ts`, push notifications), with
    // the app precached; `/api` is never cached. Off in `vp dev`.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // The Japanese text fonts (2 MB) come from the HTTP cache instead; offline falls back to the
        // system font.
        globIgnores: ['fonts/**'],
      },
      manifest: {
        name: 'チョコスケ',
        short_name: 'チョコスケ',
        description: '家族で共有するカレンダーアプリ',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FCFCFF',
        theme_color: '#2B5C8A',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // Dev only. Vuetify's auto-imported components are added at transform time, so Vite's dependency
  // scan can't see them; pre-bundling them lazily would re-optimize and reload the page on the
  // first visit to a lazy route that uses a new component (the navigation seems to do nothing).
  // Serving vuetify unbundled avoids that reload.
  optimizeDeps: {
    exclude: ['vuetify'],
  },
  // Same layout as production: frontend at `/`, backend at `/api` (backend dev server on 8787).
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
})
