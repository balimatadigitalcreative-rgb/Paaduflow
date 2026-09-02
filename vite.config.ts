import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const dir = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

/**
 * Sha commit yang sedang dibangun.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   DUA SUMBER, DAN URUTANNYA MENUTUP KEGAGALAN YANG PALING SUNYI
 *
 *   Kalau satu-satunya sumber adalah `PAADU_SHA` dari `deploy.js`, maka build
 *   yang dijalankan dengan tangan — `npm run build:web` di server, yang
 *   didokumentasikan README sebagai bagian penyiapan — akan memanggang `dev`
 *   ke dalam bundel MAUPUN ke `versi.json`. Keduanya lalu cocok selamanya,
 *   pemberitahuan versi tidak pernah berbunyi lagi, dan tidak ada satu pun
 *   tanda di mana pun bahwa ia sudah mati.
 *
 *   Fitur yang mati diam-diam tidak dapat dibedakan dari fitur yang bekerja
 *   sampai hari ia dibutuhkan. Karena itu build apa pun di dalam repo ini
 *   mengambil sha-nya sendiri dari git bila lingkungan tidak memberinya.
 * ═══════════════════════════════════════════════════════════════════════════
 */
function shaTerbangun(): string {
  const dariLingkungan = process.env.PAADU_SHA
  if (dariLingkungan !== undefined && dariLingkungan !== '') return dariLingkungan

  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: dir('.'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    // Tanpa git — arsip sumber, kontainer build tanpa riwayat. Bukan galat.
    return 'dev'
  }
}

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
  let versi = 'dev'

  return {
    name: 'paadu-versi',

    /**
     * Server pengembangan SELALU `dev`, meski repo ini punya git.
     *
     * `/versi` menjawab `dev` saat tidak ada `webRoot`, dan di pengembangan
     * memang tidak ada — Vite yang menyajikan. Memanggang sha sungguhan ke
     * bundel dev berarti kedua sisi selamanya berbeda, dan setiap orang yang
     * menjalankan `npm run dev` akan melihat banner "ada versi baru" terus
     * menerus atas aplikasi yang sedang ia tulis sendiri.
     */
    config(_konfigurasi, lingkungan) {
      versi = lingkungan.command === 'build' ? shaTerbangun() : 'dev'
      return { define: { __VERSI_APLIKASI__: JSON.stringify(versi) } }
    },

    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'versi.json',
        source: `${JSON.stringify({ sha: versi })}\n`,
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
