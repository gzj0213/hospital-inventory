import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  // Windows必须设置相对路径
  base: './',
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
    // 解决Windows下文件名编码问题
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        // 强制使用UTF-8编码
        charset: 'utf-8'
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    // 允许局域网访问
    host: '0.0.0.0'
  }
})