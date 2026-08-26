import { expect, test } from 'vitest'

import { periksaToken } from '../../tools/audit/token-terdeklarasi.js'

/**
 * Penjaga token yang dipakai tanpa deklarasi.
 *
 * Ia lahir dari kegagalan sungguhan: `--size-chart-bar` dipakai dua komponen,
 * deklarasinya tidak pernah sampai ke server, dan tidak ada satu pun tanda —
 * deploy hijau, CSS tersaji, grafiknya tetap pendek.
 *
 * `var()` tanpa deklarasi tidak melempar apa pun. Itu yang membuat kegagalan
 * ini bertahan: hasilnya terlihat seperti keputusan desain yang memang begitu.
 */

test('token yang dipakai tanpa deklarasi tertangkap', () => {
  const { hilang } = periksaToken([
    ':root { --ada: 4px; }',
    '.kartu { padding: var(--ada); min-block-size: var(--size-chart-bar); }',
  ])

  expect(hilang.map((s: { nama: string }) => s.nama)).toEqual(['--size-chart-bar'])
})

test('jumlah pemakaian ikut disebut, supaya besarnya terlihat', () => {
  const { hilang } = periksaToken([
    '.a { block-size: var(--hilang); } .b { inline-size: var(--hilang); }',
  ])

  expect(hilang[0]!.jumlah).toBe(2)
})

test('nilai cadangan membuat token opsional, dan itu bukan pelanggaran', () => {
  /*
   * `var(--x, 4px)` memang dirancang bekerja tanpa deklarasi. Mengeluhkannya
   * berarti melarang satu-satunya cara sah memakai token yang belum ada.
   */
  const { hilang } = periksaToken(['.a { padding: var(--belum-ada, 4px); }'])

  expect(hilang).toEqual([])
})

test('token yang dideklarasikan di berkas LAIN tetap terhitung ada', () => {
  /*
   * Deklarasi dan pemakaian hampir selalu terpisah berkas: `tokens.css`
   * membangkitkan yang pertama, modul CSS memakai yang kedua. Memeriksanya
   * per berkas akan mengeluh atas setiap token yang ada.
   */
  const { hilang } = periksaToken([':root { --warna: #000; }', '.a { color: var(--warna); }'])

  expect(hilang).toEqual([])
})
