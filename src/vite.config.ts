import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process
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
      {
        // Preload script
        entry: 'electron/preload.ts',
        onstart: (options) => {
          options.reload()
        },
        vite: {
          build: {
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs',
            },
            rollupOptions: {
              output: {
                dir: 'dist-electron',
              },
            },
          },
        },
      },
    ]),
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
