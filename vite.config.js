import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages（https://uniqueseaweb.github.io/ReactApp/）で配信するためのパス
  base: '/ReactApp/',
  plugins: [react()],
})
