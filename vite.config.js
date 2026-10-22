import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// フットサル大会アプリにだけ Content-Security-Policy を付ける（GitHub Pages はヘッダーを設定できないため meta で指定）。
// 開発サーバーはインラインスクリプトを使うので本番ビルドのときだけ有効にする
function futsalCsp(supabaseUrl) {
  const connect = ["'self'", supabaseUrl && new URL(supabaseUrl).origin].filter(Boolean).join(' ')
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'futsal-csp',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      if (!ctx.path.startsWith('/futsal/')) return html
      return html.replace('<meta charset="UTF-8" />', `$&\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')
  return {
    // GitHub Pages（https://uniqueseaweb.github.io/ReactApp/）で配信するためのパス
    base: '/ReactApp/',
    plugins: [react(), futsalCsp(env.VITE_SUPABASE_URL)],
    build: {
      // three.js を含む太陽系ビューアのチャンクは約 1MB（gzip 約 260KB）になるため上限を緩める
      chunkSizeWarningLimit: 1100,
      rollupOptions: {
        // アプリ一覧（/）と、ToDo（/todo/）・太陽系ビューア（/solar/）・巨人討伐ゲーム（/titan/）・フットサル大会（/futsal/）の 5 ページ構成
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          todo: resolve(import.meta.dirname, 'todo/index.html'),
          solar: resolve(import.meta.dirname, 'solar/index.html'),
          titan: resolve(import.meta.dirname, 'titan/index.html'),
          futsal: resolve(import.meta.dirname, 'futsal/index.html'),
        },
      },
    },
  }
})
