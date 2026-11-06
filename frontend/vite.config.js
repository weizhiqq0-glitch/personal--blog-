import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // 使用相对资源路径，兼容 GitHub Pages 的仓库子目录。
  base: './',
})
