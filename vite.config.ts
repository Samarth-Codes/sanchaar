import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/search': {
        target: 'https://railradar.in/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/search/, '/search')
      },
      '/trains': {
        target: 'https://railradar.in/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trains/, '/trains')
      },
      '/stations': {
        target: 'https://railradar.in/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/stations/, '/stations')
      }
    }
  }
})
