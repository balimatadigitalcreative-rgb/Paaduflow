import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

/**
 * Tautan internal tidak pernah memakai query string.
 *
 * Router aplikasi ini memecah hash dengan `/` dan tidak mengenal `?` sama
 * sekali. `#/akuntansi/buku-besar?account=xxx` karena itu menjadi SATU segmen
 * utuh bernama `buku-besar?account=xxx`, yang tidak cocok dengan perbandingan
 * mana pun — halamannya tidak dirender, dan kliknya berakhir di tempat yang
 * sama.
 *
 * Kegagalannya sunyi: tidak ada error, tidak ada layar merah, hanya tautan yang
 * tidak melakukan apa-apa. Ia sempat hidup di dua tempat sekaligus dengan kode
 * pengurai query yang rapi di ujung lain — kode benar yang tidak pernah
 * dijalankan. Karena itu diperiksa mesin.
 *
 * Bila suatu hari router benar-benar mengurai query, uji ini yang harus
 * dicabut lebih dulu — dan itu memaksa keputusannya diambil sadar.
 */

const AKAR = fileURLToPath(new URL('../../src/interface/web', import.meta.url))

function berkasTsx(direktori: string): string[] {
  const hasil: string[] = []
  for (const entri of readdirSync(direktori, { withFileTypes: true })) {
    const jalur = join(direktori, entri.name)
    if (entri.isDirectory()) hasil.push(...berkasTsx(jalur))
    else if (entri.name.endsWith('.tsx') || entri.name.endsWith('.ts')) hasil.push(jalur)
  }
  return hasil
}

test('tidak ada tautan hash internal yang membawa query string', () => {
  const pelanggaran: string[] = []

  for (const berkas of berkasTsx(AKAR)) {
    const isi = readFileSync(berkas, 'utf8')

    isi.split(/\r?\n/).forEach((baris, nomor) => {
      // `#/...` yang diikuti `?` sebelum kutip penutup, dan `href(...)`/
      // `pergiKe(...)` yang argumennya memuat `?`.
      const hashLangsung = /#\/[^`'"\s]*\?/.test(baris)
      const lewatHelper = /\b(href|pergiKe)\(\s*[`'"][^`'"]*\?/.test(baris)

      if (hashLangsung || lewatHelper) {
        pelanggaran.push(`${berkas.slice(AKAR.length + 1)}:${nomor + 1}  ${baris.trim()}`)
      }
    })
  }

  expect(
    pelanggaran,
    `tautan internal memakai query string, yang tidak dikenal router:\n${pelanggaran.join('\n')}`,
  ).toEqual([])
})
