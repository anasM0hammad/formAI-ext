import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'public/manifest.json',
          dest: '.'
        },
        {
          src: 'public/icons',
          dest: '.'
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        content: resolve(__dirname, 'src/content/index.tsx'),
        background: resolve(__dirname, 'src/background/index.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Special handling for content and background scripts
          if (chunkInfo.name === 'content' || chunkInfo.name === 'background') {
            return `${chunkInfo.name}/index.js`
          }
          return `assets/[name].[hash].js`
        },
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          // Keep CSS files with their HTML pages
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name].[ext]'
          }
          return 'assets/[name].[ext]'
        }
      }
    }
  },
  // Ensure HTML files are output to root of dist
  root: '.'
})

