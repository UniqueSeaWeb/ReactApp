import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages（https://uniqueseaweb.github.io/ReactApp/）で配信するためのパス
  base: '/ReactApp/',
  plugins: [react()],
  build: {
    // three.js を含む太陽系ビューアのチャンクは約 1MB（gzip 約 260KB）になるため上限を緩める
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      // ToDo アプリ（/）・太陽系ビューア（/solar/）・巨人討伐ゲーム（/titan/）の 3 ページ構成
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        solar: resolve(import.meta.dirname, 'solar/index.html'),
        titan: resolve(import.meta.dirname, 'titan/index.html'),
      },
    },
  },
})
