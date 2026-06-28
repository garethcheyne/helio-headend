import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/tvh': {
        target: 'http://192.168.0.120:9981',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/tvh/, ''),
      },
      '/api/hls': {
        target: 'http://192.168.0.122:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/hls/, ''),
      },
    },
  },
})
