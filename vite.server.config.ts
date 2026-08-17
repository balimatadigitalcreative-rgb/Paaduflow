import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const dir = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

/**
 * Build server untuk produksi.
 *
 * Server ditulis TypeScript dan memakai alias `#`. Saat pengembangan, Vite yang
 * menyelesaikan keduanya lewat `ssrLoadModule` (D-134). Produksi tidak boleh
 * menjalankan Vite, jadi hal yang sama diselesaikan sekali di muka menjadi satu
 * berkas di `dist/server/`.
 *
 * Aliasnya sengaja disalin dari `vite.config.ts` alih-alih diimpor: konfigurasi
 * web berakar di `src/interface/web`, sedangkan build ini berakar di repo.
 * Menggabungkan keduanya berarti satu berkas yang harus benar untuk dua akar
 * berbeda.
 *
 * Dependensi runtime dibiarkan eksternal — `fastify`, `pg`, dan kawan-kawannya
 * dipasang `npm ci` di server. Membundelnya hanya menyalin `node_modules` ke
 * dalam satu berkas yang lebih sulit ditambal saat ada CVE.
 */
export default defineConfig({
  resolve: {
    alias: {
      '#shared': dir('./src/shared'),
      '#domain': dir('./src/domain'),
      '#application': dir('./src/application'),
      '#infrastructure': dir('./src/infrastructure'),
      '#interface': dir('./src/interface'),
      '#composition': dir('./src/composition'),
      '#styles': dir('./src/styles'),
    },
  },
  build: {
    ssr: dir('./src/composition/main.ts'),
    outDir: dir('./dist/server'),
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: {
      output: { entryFileNames: 'main.js' },
    },
  },
})
