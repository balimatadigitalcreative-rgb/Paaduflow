import { expect, test } from 'vitest'

import { formatAccounting } from '#shared/money-format'

/**
 * Format angka untuk laporan keuangan.
 *
 * Ketiga aturannya berasal dari cara orang keuangan membaca kolom, bukan dari
 * selera: negatif dalam kurung, nol berbeda dari kosong, presisi konsisten.
 */

test('negatif ditulis dalam kurung, bukan dengan tanda minus', () => {
  // Tanda minus setebal satu piksel hilang saat laporan difotokopi, dan angka
  // yang terbaca terbalik tandanya adalah kesalahan yang tidak disadari siapa pun.
  expect(formatAccounting(-1_250_000, 'IDR')).toBe('(1.250.000)')
  expect(formatAccounting(1_250_000, 'IDR')).toBe('1.250.000')
})

test('nol dan kosong dibedakan', () => {
  // 0 berarti pernah ada dan sekarang habis; em dash berarti tidak pernah ada.
  expect(formatAccounting(0, 'IDR')).toBe('0')
  expect(formatAccounting(null, 'IDR')).toBe('—')
  expect(formatAccounting(undefined, 'IDR')).toBe('—')
})

test('presisi ditetapkan mata uang, bukan nilainya', () => {
  // Dua nilai di kolom yang sama harus punya jumlah desimal yang sama, atau
  // angkanya tidak sejajar dan mata harus membaca ulang tiap baris.
  const a = formatAccounting(1_000_000, 'USD')
  const b = formatAccounting(1_000_000.5, 'USD')
  expect(a).toBe('1,000,000.00'.replace(/,/g, '.').replace(/\.(\d\d)$/, ',$1'))
  expect(a.split(',')[1]?.length).toBe(b.split(',')[1]?.length)

  // IDR tanpa desimal, dan itu konsisten untuk nilai apa pun.
  expect(formatAccounting(1_000_000, 'IDR')).toBe('1.000.000')
  expect(formatAccounting(1_000_000.5, 'IDR')).toBe('1.000.001')
})
