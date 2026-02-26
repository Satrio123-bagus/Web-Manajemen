import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // ─── PROXY ──────────────────────────────────────────────
  // All /api/* requests are forwarded to the Express backend.
  // This eliminates CORS issues during development.
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://148.230.102.113:8080',
        changeOrigin: true,
      },
    },
  },
})
