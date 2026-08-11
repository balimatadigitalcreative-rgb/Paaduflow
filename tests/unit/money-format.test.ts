import { describe, expect, test } from 'vitest'

import { currencyDecimals, formatAmount, parseAmount } from '#shared/money-format'

/**
 * Parser nominal — item terbuka di Component_Specs_Primitives §13:
 * "perilaku input mata uang saat tempel belum diuji".
 *
 * Test ini menutupnya. Pengguna menempel dari Excel, WhatsApp, dan PDF, dan
 * ketiganya memakai konvensi pemisah yang berbeda.
 */

describe('parsing', () => {
  test.each([
    ['185000', 185_000],
    ['185.000', 185_000],
    ['185,000', 185_000],
    ['1.234.567', 1_234_567],
    ['Rp 185.000', 185_000],
    ['  185.000  ', 185_000],
  ])('%s dibaca sebagai %i', (masukan, harapan) => {
    expect(parseAmount(masukan)).toBe(harapan)
  })

  test('titik dan koma bersamaan: yang terakhir adalah desimal', () => {
    // Konvensi Indonesia.
    expect(parseAmount('1.234,56')).toBe(1234.56)
    // Konvensi Inggris — pengguna menempel dari sumber apa pun.
    expect(parseAmount('1,234.56')).toBe(1234.56)
  })

  test('satu pemisah dengan dua angka di belakangnya adalah desimal', () => {
    expect(parseAmount('185,50')).toBe(185.5)
    expect(parseAmount('185.50')).toBe(185.5)
  })

  test('teks yang bukan angka menghasilkan null, bukan nol', () => {
    // Nol adalah nilai yang sah. Menyamakannya dengan "tidak terbaca" akan
    // diam-diam menyimpan nominal yang salah.
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('tidak ada')).toBeNull()
    expect(parseAmount('-')).toBeNull()
    expect(parseAmount('0')).toBe(0)
  })

  test('nilai negatif dipertahankan', () => {
    expect(parseAmount('-185.000')).toBe(-185_000)
  })
})

describe('format', () => {
  test('IDR tanpa desimal secara bawaan', () => {
    expect(formatAmount(185_000, 'IDR')).toBe('185.000')
    expect(currencyDecimals('IDR')).toBe(0)
  })

  test('desimal muncul hanya bila nilainya memang mengandungnya', () => {
    expect(formatAmount(185_000, 'USD')).toBe('185.000')
    expect(formatAmount(185_000.5, 'USD')).toBe('185.000,5')
  })

  test('bolak-balik: format lalu parse mengembalikan nilai semula', () => {
    for (const nilai of [0, 1, 185_000, 1_234_567, 42.5]) {
      expect(parseAmount(formatAmount(nilai, 'USD'))).toBe(nilai)
    }
  })
})
