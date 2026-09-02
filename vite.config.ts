import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const dir = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

/**
 * Sha commit yang sedang dibangun.
 *
 * Diisi `tools/deploy/deploy.js` lewat lingkungan. Kosong saat pengembangan,
 * dan `dev` di kedua sisi berarti pemeriksaan versi tidak pernah berbunyi di
 * mesin siapa pun — yang memang benar, karena Vite sudah punya hot reload.
 */
const VERSI = process.env.PAADU_SHA ?? 'dev'

/**
 * Menuliskan versi ke DUA tempat dari satu nilai.
 *
 * `__VERSI_APLIKASI__` ikut terpanggang ke dalam bundel: itulah satu-satunya
 * hal yang dapat bersaksi bundel MANA yang sedang berjalan di tab seseorang.
 * `versi.json` ikut ke direktori hasil build: itulah yang dibaca server untuk
 * menjawab bundel mana yang sedang ia sajikan.
 *
 * Keduanya lahir dari satu nilai di satu build, jadi keduanya tidak dapat
 * berselisih. Mengambil salah satunya dari sumber lain — env proses server,
 * `git rev-parse` saat menyala — membuat keduanya dapat menjawab berbeda, dan
 * fitur yang membandingkan dua angka harus yakin keduanya berarti hal yang sama.
 */
function versiTerbangun(): Plugin {
  return {
    name: 'paadu-versi',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'versi.json',
        source: `${JSON.stringify({ sha: VERSI })}\n`,
      })
    },
  }
}

/**
 * Aplikasi satu halaman — D-037.
 *
 * Tanpa SSR: aplikasi ini seluruhnya di balik autentikasi, dan runtime server
 * kedua berarti dua tempat memutuskan izin.
 */
export default defineConfig({
  root: dir('./src/interface/web'),
  plugins: [react(), versiTerbangun()],
  define: {
    __VERSI_APLIKASI__: JSON.stringify(VERSI),
  },
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
