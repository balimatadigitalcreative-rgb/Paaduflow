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
      '#domain': dir('./src/domain'),
      '#application': dir('./src/application'),
      // Tiga alias berikut hanya dipakai saat Vite memuat kode server lewat
      // `ssrLoadModule` di `tools/dev/start.js`. Berkas web tidak pernah
      // mengimpornya — lint `layer-direction` yang menegakkannya, bukan
      // ketiadaan alias.
      '#infrastructure': dir('./src/infrastructure'),
      '#interface': dir('./src/interface'),
      '#composition': dir('./src/composition'),
      '#styles': dir('./src/styles'),
    },
  },
  server: {
    // Browser memanggil API di origin yang sama, sehingga tidak ada CORS dan
    // tidak ada alamat API yang perlu dikonfigurasi di sisi web.
    proxy: {
      '/v1': { target: `http://localhost:${process.env.PORT ?? 3000}`, changeOrigin: true },
      '/openapi.json': { target: `http://localhost:${process.env.PORT ?? 3000}` },
    },
  },
  build: {
    outDir: dir('./dist/web'),
    emptyOutDir: true,
  },
})
