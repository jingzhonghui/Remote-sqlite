import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart: (options) => {
          options.startup()
        },
        vite: {
          build: {
            rollupOptions: {
              external: ['ssh2', 'cpu-features', 'nan'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['ssh2', 'cpu-features', 'nan'],
            },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
})
