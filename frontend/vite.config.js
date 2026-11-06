import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BLOG_')
  return {
    plugins: [react()],
    base: './',
    ...(mode === 'localpreview' ? { define: { 'import.meta.env.VITE_API_URL': JSON.stringify('') } } : {}),
    build: { rollupOptions: { input: { main: 'index.html', pet: 'pet.html' } } },
    server: {
      proxy: {
        '/api': { target: process.env.BLOG_BACKEND_URL || env.BLOG_BACKEND_URL || 'http://127.0.0.1:3000', changeOrigin: true },
      },
    },
  }
})
