import { describe, expect, test } from 'vitest'

import { formatDate, parseDate } from '#shared/date-format'
import { formatPeriod, periodOf, periodsOfYear } from '#shared/fiscal-period'

describe('periode fiskal', () => {
  test('tahun fiskal Januari: periode sama dengan bulan kalender', () => {
    const periode = periodOf(new Date(2026, 7, 10), 1)
    expect(periode).toEqual({ fiscalYear: 2026, period: 8, calendarMonth: 8, calendarYear: 2026 })
  })

  test('tahun fiskal April: September adalah P6, dan tahun fiskalnya 2026', () => {
    const periode = periodOf(new Date(2026, 8, 10), 4)
    expect(periode.period).toBe(6)
    expect(periode.fiscalYear).toBe(2026)
  })

  test('bulan sebelum awal tahun fiskal masuk ke tahun fiskal sebelumnya', () => {
    // Februari 2026 pada tahun fiskal April berarti FY2025 P11.
    const periode = periodOf(new Date(2026, 1, 10), 4)
    expect(periode.fiscalYear).toBe(2025)
    expect(periode.period).toBe(11)
  })

  test('label memuat label fiskal DAN bulan kalender', () => {
    // Menampilkan "P6" saja memaksa setiap penggunanya menghitung sendiri.
    expect(formatPeriod(periodOf(new Date(2026, 8, 10), 4))).toBe('FY2026 P6 · Sep 2026')
  })

  test('dua belas periode berurutan, melintasi pergantian tahun kalender', () => {
    const periode = periodsOfYear(2026, 4)
    expect(periode).toHaveLength(12)
    expect(formatPeriod(periode[0]!)).toBe('FY2026 P1 · Apr 2026')
    expect(formatPeriod(periode[9]!)).toBe('FY2026 P10 · Jan 2027')
    expect(formatPeriod(periode[11]!)).toBe('FY2026 P12 · Mar 2027')
  })
})

describe('tanggal', () => {
  test('format tampilan', () => {
    expect(formatDate(new Date(2026, 7, 10))).toBe('10 Agu 2026')
  })

  test.each(['10/8/2026', '10-8-2026', '2026-08-10', '10 Agu 2026', '10 Agustus 2026'])(
    '%s terbaca sebagai 10 Agustus 2026',
    (masukan) => {
      const hasil = parseDate(masukan)
      expect(hasil).not.toBeNull()
      expect(formatDate(hasil!)).toBe('10 Agu 2026')
    },
  )

  test('tanggal yang tidak ada ditolak, bukan digulung ke bulan berikutnya', () => {
    // Konstruktor Date diam-diam mengubah 31 Februari menjadi 3 Maret.
    // Tanggal yang bergeser sendiri adalah bug senyap di dokumen keuangan.
    expect(parseDate('31/2/2026')).toBeNull()
    expect(parseDate('32/1/2026')).toBeNull()
  })

  test('teks yang tidak terbaca menghasilkan null, tanpa menebak', () => {
    expect(parseDate('kemarin')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})
