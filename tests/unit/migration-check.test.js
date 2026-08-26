import { describe, expect, test } from 'vitest'

import { checkMigrations, checkNumbering, periksaIsi } from '../../tools/db/check-migrations.js'

/**
 * Pemeriksa migrasi — perakitannya.
 *
 * Aturan isinya diuji satu per satu di `aturan-migrasi.test.ts`, terhadap berkas
 * migrasi yang sengaja melanggar. Yang diuji DI SINI adalah hal yang tidak
 * terlihat dari aturan mana pun: penomoran, perakitan seluruh pemeriksaan, dan
 * cara penanda darurat melekat pada satu pernyataan alih-alih seluruh berkas.
 */

describe('cakupan pemeriksaan', () => {
  test('penanda darurat melewatkan satu pernyataan, bukan seluruh berkas', () => {
    const sql = [
      '-- paadu:allow-breaking kolom percobaan ini tidak pernah terpakai di rilis mana pun',
      'ALTER TABLE invoices DROP COLUMN percobaan;',
      'ALTER TABLE invoices DROP COLUMN catatan;',
    ].join('\n')

    /*
     * Yang kedua tetap tertangkap.
     *
     * Penanda yang membebaskan seluruh berkas adalah penanda yang, sekali
     * ditulis, membuat setiap baris berikutnya tidak terperiksa — termasuk
     * baris yang ditambahkan orang lain berbulan-bulan kemudian.
     */
    expect(periksaIsi('0099_uji.sql', sql)).toHaveLength(1)
  })

  test('kata terlarang di dalam komentar tidak dihitung', () => {
    const sql = [
      '-- kolom lama akan DROP COLUMN di rilis berikutnya',
      'ALTER TABLE t ADD COLUMN a int;',
    ].join('\n')

    expect(periksaIsi('0099_uji.sql', sql)).toEqual([])
  })

  test('bagian Down tidak diperiksa', () => {
    // Seluruh migrasi memuat RAISE di bagian Down, dan sebagian menyebut kata
    // yang dilarang di dalam pesannya. Memeriksanya akan menghasilkan kegagalan
    // palsu di setiap berkas.
    const sql = [
      'ALTER TABLE invoices ADD COLUMN catatan text;',
      '-- Down Migration',
      'DROP TABLE invoices;',
    ].join('\n')

    expect(periksaIsi('0099_uji.sql', sql)).toEqual([])
  })

  test('penambahan nullable atas tabel yang sudah ada lolos', () => {
    /*
     * Indeksnya sengaja TIDAK ikut di sini.
     *
     * Versi terdahulu test ini menyertakan `CREATE INDEX` atas tabel yang sudah
     * ada dan menyebutnya "penambahan biasa". Sejak D-163 itu memang bukan
     * penambahan biasa: ia menahan seluruh penulisan ke tabel itu selama indeks
     * dibangun, dan harus dijalankan di luar deploy.
     */
    expect(periksaIsi('0099_uji.sql', 'ALTER TABLE invoices ADD COLUMN catatan text;')).toEqual([])
  })
})

describe('penomoran', () => {
  test('berurutan tanpa celah lolos', () => {
    expect(checkNumbering(['0001_a.sql', '0002_b.sql', '0003_c.sql'])).toEqual([])
  })

  test('nomor yang melompat tertangkap', () => {
    expect(checkNumbering(['0001_a.sql', '0003_c.sql'])).toHaveLength(1)
  })

  test('nomor ganda tertangkap', () => {
    expect(checkNumbering(['0001_a.sql', '0001_b.sql'])).toHaveLength(1)
  })

  test('nama tanpa awalan angka tertangkap', () => {
    expect(checkNumbering(['tambahan.sql'])).toHaveLength(1)
  })
})

test('migrasi yang ada di repo lolos seluruh pemeriksaan', () => {
  expect(checkMigrations()).toEqual([])
})
