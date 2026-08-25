import 'i18next'

import type umum from './locales/id/umum.json'
import type shell from './locales/id/shell.json'
import type dasbor from './locales/id/dasbor.json'
import type akuntansi from './locales/id/akuntansi.json'
import type penjualan from './locales/id/penjualan.json'
import type pembelian from './locales/id/pembelian.json'
import type pajak from './locales/id/pajak.json'

/**
 * Pengetikan kunci terjemahan.
 *
 * Sumbernya berkas INDONESIA, karena Indonesia adalah sumber kebenaran makna.
 * Konsekuensinya disengaja: kunci yang ada di Inggris tetapi tidak di Indonesia
 * tidak dikenali TypeScript — dan itu memang cacat, bukan kelonggaran.
 *
 * Yang ditegakkan di sini: `t('shell.tidakAda')` gagal saat build, bukan
 * menampilkan teks kosong di layar. Kunci yang hilang adalah kesalahan yang
 * paling murah ditangkap kompiler dan paling mahal ditemukan pelanggan.
 *
 * Kesamaan antara kedua berkas locale dijaga terpisah oleh `check:i18n`,
 * karena TypeScript hanya melihat satu sisi.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'umum'
    resources: {
      umum: typeof umum
      shell: typeof shell
      dasbor: typeof dasbor
      akuntansi: typeof akuntansi
      penjualan: typeof penjualan
      pembelian: typeof pembelian
      pajak: typeof pajak
    }
  }
}
