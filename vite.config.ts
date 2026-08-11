import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dir = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

/**
 * Aplikasi satu halaman — D-037.
 *
 * Tanpa SSR: aplikasi ini seluruhnya di balik autentikasi, dan runtime server
 * kedua berarti dua tempat memutuskan izin.
 */
export default defineConfig({
  root: dir('./src/interface/web'),
  plugins: [react()],
  resolve: {
    alias: {
      '#shared': dir('./src/shared'),
      '#application': dir('./src/application'),
      '#styles': dir('./src/styles'),
    },
  },
  build: {
    outDir: dir('./dist/web'),
    emptyOutDir: true,
  },
})
